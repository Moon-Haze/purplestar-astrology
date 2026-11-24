/**
 * @file CLI 冷启动与模块加载耗时的基准测量工具。
 */
// ── 启动耗时基准：把「这个 CLI 为什么慢 / 该优化哪里」量成一张表 ──
//
// 用法：npm run bench:startup [-- --runs=9]
//
// 分三段，**口径不同，用途不同**：
//
//   ① 端到端   spawn 真实 CLI 子进程，测「Node 启动 + registerHooks + 全量模块加载
//              + 命令执行」。这是**唯一可以对外引用的数字** —— 它等于用户等多久。
//
//   ② 模块拆解 逐组 import 计时，回答「谁占大头」。
//   ③ 热路径   单次调用耗时（排盘 / 格局 / 城市查找），回答「某处是不是瓶颈」。
//
// ②③ 均在**真实 node 子进程**中测，不在本进程内：本脚本跑在 tsx 下，
// tsx 的 esbuild 成本与源文件大小成正比 —— 实测把 nihai 加载从 5ms 抬到 14ms、
// cli/commands 从 13ms 抬到 38ms，大源文件被高估约 2–3 倍（nihai 已随命令移除，
// 此处留作 tsx 高估幅度例证）。探针复用 test/lib/loader.ts 的 registerHooks
// （与 CLI 共用 boot-hooks.ts 一份实现——机制单点、无副本），故**不需要**再写 hook 逻辑。
//
// 口径纪律（本项目踩过的坑）：
//   比较「某处占端到端多少」必须用**首次调用**耗时，不能用暖机后的均摊值 ——
//   前者对齐 CLI「一次解读调一次」的真实形态，后者只在循环场景（测试）里才有意义。
//   拿均摊值除冷启动端到端，会得出「热路径占 11%」这种虚高结论。
//
// 为什么要有这个脚本：本仓 CLI 总耗时 160ms 量级，绝大部分是 Node 启动与排盘引擎
// 的入场费。不做端到端对照、只读代码形态（「这里 40 处线性扫描」「这里 flatMap 了
// 335 个城市」），极易把 0.02ms 的热路径误判成 P1。脚本就是让这类判断先过一遍数据。

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/types"; // 仅参与 typecheck，运行时被擦除

// HERE = <仓库根>/tools/bench，上溯两级即仓库根（口径同 tools/db/*.ts）
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "../..");
// ⚠️ 字面路径，tools/ 不在 npm test 覆盖内 —— 漏改不会变红，只在实跑时报模块找不到。
//    probe 里的 `@/…` 动态 import 不在此列：走 LOADER 装的钩子，跟着 loader 的 ROOT 走。
const CLI = resolve(SKILL_ROOT, "scripts/purple-star.ts");
const LOADER = resolve(SKILL_ROOT, "test/lib/loader.ts");

const RULE = "─".repeat(78);

/**
 * 中位数：奇数取中，偶数取中间两者均值。对冷启动抖动比均值稳健。
 *
 * @param xs - 耗时样本（毫秒）
 * @returns 中位数；样本为空时得到 NaN
 */
function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 毫秒数右对齐成定宽文本；小于 1ms 时保留 4 位小数。
 *
 * @param v - 毫秒数
 * @param w - 右对齐的目标宽度（默认 10）
 * @returns 定宽文本；小于 1ms 时保留 4 位小数，否则 2 位
 */
function ms(v: number, w = 10): string {
	return `${v.toFixed(v < 1 ? 4 : 2).padStart(w)} ms`;
}

// ── ① 端到端 ──

/**
 * 三条代表性命令：纯引导层 / 完整排盘 / 主题论断（唯一用得上分析数据库的命令）。
 * 探针命令为 `astrology` / `astrology --topic`。
 */
const E2E_CASES: Array<{ label: string; args: string[] }> = [
	{ label: "help（纯引导层，不执行任何计算）", args: ["help"] },
	{
		label: "astrology（排盘 + 格局 + 渲染）",
		args: [
			"astrology",
			"--date",
			"1990-05-15",
			"--time",
			"09:30",
			"--city",
			"北京",
			"--gender",
			"male",
		],
	},
	{
		label: "astrology --topic（排盘 + 分析数据库）",
		args: [
			"astrology",
			"--topic",
			"career",
			"--date",
			"1990-05-15",
			"--time",
			"09:30",
			"--gender",
			"male",
		],
	},
];

/** 一条端到端用例的耗时统计（① 口径：spawn 真实 CLI 子进程的墙钟耗时）。 */
interface E2ERow {
	/** 用例标签，取自 E2E_CASES 的 label（命令 + 参数的可读描述） */
	label: string;
	/** 重复 runs 次的中位数（毫秒）——对外引用用这个，比均值抗冷启动抖动 */
	med: number;
	/** runs 次样本的最小值（毫秒） */
	min: number;
	/** runs 次样本的最大值（毫秒） */
	max: number;
}

/**
 * 对每条端到端用例重复跑 `runs` 次，收集耗时样本。
 *
 * @param runs - 每条用例重复次数
 * @returns 每条用例的中位数、最快与最慢耗时
 * @throws 某次子进程退出码非零（附命令）
 */
function benchE2E(runs: number): E2ERow[] {
	return E2E_CASES.map(({ label, args }) => {
		const times: number[] = [];
		for (let i = 0; i < runs; i++) {
			const t = performance.now();
			const r = spawnSync(process.execPath, [CLI, ...args], { stdio: "ignore" });
			const dt = performance.now() - t;
			if (r.status !== 0) {
				throw new Error(`CLI 退出码 ${r.status}：${args.join(" ")}`);
			}
			times.push(dt);
		}
		return { label, med: median(times), min: Math.min(...times), max: Math.max(...times) };
	});
}

// ── ② 加载分组定义 ──

/**
 * 顺序**必须**依赖先于依赖者：`cli/commands` 静态 import 了分析数据库等，
 * 放最后才能让它的边际值只反映自身与**尚未列入前面组**的那几份依赖。
 *
 * ⚠️ `+ classics` 与 `+ synastry-knowledge` 两组已删：那两个模块
 *    随同名命令搬去 `purplestar-classics` / `purplestar-synastry` 后，源的内核根里**没有
 *    这两个文件**，留着会让探针以 ERR_MODULE_NOT_FOUND 退出（tools/ 不在 npm test 覆盖内，
 *    这类失效只会在实跑时暴露）。它们当年记的是「仅某条命令需要」的懒加载余地，
 *    接手这个角色的现在是 `+ analysis`。
 */
const LOAD_GROUPS: Array<{ label: string; specs: string[]; note: string }> = [
	{
		label: "核心",
		specs: [
			"@/algorithm",
			"@/patterns",
			"@/mutagen",
			"@/data",
			"@/cli/birth/cities",
			"@/cli/args",
		],
		note: "analyze 必需（含 iztro / lunar-typescript）",
	},
	{
		label: "+ analysis",
		specs: ["@/analysis"],
		note: "仅 topic 命令需要（v3 分析数据库）",
	},
	{ label: "+ cli/commands", specs: ["@/cli/commands"], note: "命令表本体，analyze 必需" },
];

/** 可懒加载的组（analyze 用不到）——用于算「懒加载收益上限」。 */
const DEFERRABLE = new Set(["+ analysis"]);

/** 热路径样本。timeIndex 是**时辰序号 0–12**，不是钟表时（见 types.ts 的 BirthInfo.timeIndex）。 */
const HOT_INFO: BirthInfo = { year: 1990, month: 5, day: 15, timeIndex: 5, gender: "male" };

// ── ②③ 子进程探针 ──

/** ② 模块加载拆解的一行：一条加载组合的边际与累计耗时。 */
interface LoadRow {
	/** 加载组合的标签（对应 LOAD_GROUPS 的 label，如「核心」「+ analysis」） */
	label: string;
	/** 该组合的用途说明，取自 LOAD_GROUPS 的 note（缺省为空串） */
	note: string;
	/** 边际耗时（毫秒）：只导入本组 specs 的墙钟时间，已扣除前面各组 */
	marginal: number;
	/** 累计耗时（毫秒）：从第一组到本组（含）的边际之和 */
	cumulative: number;
}

/** ③ 热路径的一行：单次调用耗时，首次值与暖机均摊值分开记。 */
interface HotRow {
	/** 被调函数标签（如 generateChart / detectPatterns / findLongitude） */
	label: string;
	/** 首次调用耗时（毫秒）——与端到端占比对齐，用小值不用均摊值 */
	first: number;
	/** 暖机后重复调用的均摊耗时（毫秒），循环场景才具意义 */
	avg: number;
}

/** 子进程探针的完整输出：由 probeSource 生成的脚本以 JSON 打印回来。 */
interface ProbeResult {
	/** registerHooks 的一次性注册开销（毫秒），不归属任何加载分组 */
	hookMs: number;
	/** 各加载组合的耗时，顺序与 LOAD_GROUPS 一致 */
	rows: LoadRow[];
	/** 三条热路径的首次与均摊耗时 */
	hot: HotRow[];
}

/**
 * 探针源码。在**真实 node** 下运行；先加载 loader（注册 registerHooks），
 * 之后所有 `@/...` 动态 import 才能解析。
 *
 * ⚠️ 探针内不得出现静态 `@/` import —— 那会在 hook 注册前求值而崩溃，
 * 与 CLI 引导层是同一条约束。
 *
 * @returns 探针脚本源码（在目标进程里现写现跑，故为字符串）
 */
function probeSource(): string {
	return `
const t0 = performance.now();
await import(${JSON.stringify(LOADER)});
const hookMs = performance.now() - t0;

const groups = ${JSON.stringify(LOAD_GROUPS.map(g => ({ label: g.label, specs: g.specs })))};
const rows = [];
for (const g of groups) {
	const s = performance.now();
	for (const spec of g.specs) await import(spec);
	rows.push({ label: g.label, marginal: performance.now() - s });
}

const { generateChart } = await import("@/algorithm");
const { detectPatterns } = await import("@/patterns");
const { findLongitude } = await import("@/cli/birth/birth-info");

const info = ${JSON.stringify(HOT_INFO)};
const once = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
const avg = (n, fn) => { const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };

const chart = generateChart(info);
const hot = [
	{ label: "generateChart（iztro 排盘）", first: once(() => generateChart(info)), avg: avg(200, () => generateChart(info)) },
	{ label: "detectPatterns（全部格局识别器）", first: once(() => detectPatterns(chart)), avg: avg(2000, () => detectPatterns(chart)) },
	{ label: "findLongitude（城市容错查找）", first: once(() => findLongitude("北京")), avg: avg(2000, () => findLongitude("北京")) },
];

console.log(JSON.stringify({ hookMs, rows, hot }));
`;
}

/**
 * 在临时目录生成探针脚本并子进程执行，测冷启动的真实耗时。
 *
 * @returns 探针输出的解析结果：各档冷启动耗时
 * @throws 探针退出码非零（附 stderr）
 */
function runProbe(): ProbeResult {
	const dir = mkdtempSync(join(tmpdir(), "ziwei-bench-"));
	const file = join(dir, "probe.mjs");
	try {
		writeFileSync(file, probeSource(), "utf8");
		const r = spawnSync(process.execPath, [file], { encoding: "utf8" });
		if (r.status !== 0) {
			throw new Error(`探针退出码 ${r.status}\n${r.stderr || ""}`);
		}
		return JSON.parse(r.stdout.trim()) as ProbeResult;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

// ── 汇总 ──

/**
 * 基准入口：解析 `--runs` 并依次输出各档测量结果。
 *
 * @returns 无返回值；各档测量结果打印到 stdout
 * @throws `--runs` 不是正整数
 */
async function main(): Promise<void> {
	const runsArg = process.argv.find(a => a.startsWith("--runs="));
	const runs = runsArg ? Number(runsArg.slice(7)) : 9;
	if (!Number.isInteger(runs) || runs < 1) {
		throw new Error(`--runs 需要正整数，收到：${runsArg}`);
	}

	console.log(RULE);
	console.log("紫微斗数 skill 启动耗时基准");
	console.log(`  Node ${process.version} · 内核根 ${SKILL_ROOT}`);
	console.log(`  端到端每条命令跑 ${runs} 次取中位数；②③ 在真实 node 子进程中测`);
	console.log(RULE);

	const e2e = benchE2E(runs);
	console.log("\n【① 端到端（权威口径）】");
	console.log(
		`  ${"命令".padEnd(40)}${"中位数".padStart(12)}${"最快".padStart(12)}${"最慢".padStart(12)}`
	);
	for (const r of e2e) {
		console.log(`  ${r.label.padEnd(40)}${ms(r.med, 12)}${ms(r.min, 12)}${ms(r.max, 12)}`);
	}

	const { hookMs, rows, hot } = runProbe();

	let cum = 0;
	const loads = rows.map(r => {
		cum += r.marginal;
		const note = LOAD_GROUPS.find(g => g.label === r.label)?.note ?? "";
		return { ...r, note, cumulative: cum };
	});
	const loadTotal = cum;
	const deferrable = loads
		.filter(r => DEFERRABLE.has(r.label))
		.reduce((s, r) => s + r.marginal, 0);

	console.log("\n【② 模块加载拆解（真实 node 口径）】");
	console.log(`  ${"阶段".padEnd(22)}${"边际".padStart(11)}${"累计".padStart(12)}  说明`);
	for (const r of loads) {
		console.log(
			`  ${r.label.padEnd(22)}${ms(r.marginal, 11)}${ms(r.cumulative, 12)}  ${r.note}`
		);
	}
	console.log(`  ${"加载合计".padEnd(22)}${ms(loadTotal, 11)}`);
	console.log(`  （另：registerHooks 一次性开销 ${ms(hookMs)}，不归属任何分组）`);

	console.log("\n【③ 热路径】");
	console.log(`  ${"调用".padEnd(38)}${"首次".padStart(11)}${"暖机均摊".padStart(13)}`);
	for (const r of hot) {
		console.log(`  ${r.label.padEnd(38)}${ms(r.first, 11)}${ms(r.avg, 13)}`);
	}

	const analyze = e2e.find(r => r.label.startsWith("analyze"));
	const pct = (v: number, base: number) => `${((v / base) * 100).toFixed(2)}%`;

	console.log(`\n${RULE}`);
	console.log("【结论】");
	if (analyze) {
		const gen = hot[0];
		const rest = hot.slice(1).reduce((s, r) => s + r.first, 0);
		console.log(`  · analyze 端到端中位数 ${ms(analyze.med, 0)}（① 权威口径）`);
		console.log(
			`  · 其中排盘（generateChart 首次 ${ms(gen.first, 0)}）≈ 端到端的 ${pct(gen.first, analyze.med)}`
		);
		console.log(
			`  · 格局 + 城市查找首次合计 ${ms(rest, 0)} ≈ 端到端的 ${pct(rest, analyze.med)}`
		);
		console.log(
			`  · 余额 ${ms(analyze.med - gen.first - rest, 0)} 为 Node 启动 + 模块加载 + 参数解析 + 渲染输出`
		);
	}
	console.log(
		`  · 可懒加载上限 ${ms(deferrable, 0)} —— 占 ② 加载合计的 ${pct(deferrable, loadTotal)}（② 口径）`
	);
	console.log("  · 读法：② 回答「谁占大头」，③ 回答「某处是不是瓶颈」。");
	console.log("    优化收益只认 ① 的前后对照；③ 用**首次**值参与占比，不用暖机均摊值。");
	console.log(RULE);
}

main();
