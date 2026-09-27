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
// ②③ 均在**真实 node 子进程**中测，不在本进程内。原因：本编排脚本跑在 tsx 下，
// 而 tsx 的 esbuild 转换成本与源文件大小成正比 —— 实测把 nihai 的加载成本从 5ms
// 抬到 14ms、cli/commands 从 13ms 抬到 38ms，大源文件被高估约 2–3 倍（nihai 模块已于
// 2026-09-27 随同名命令一并移除，此处数据留作 tsx 高估幅度的例证）。子进程探针
// 复用 test/lib/loader.ts 的 registerHooks（该文件是 CLI 引导层的既定副本，且有一条
// 漂移断言盯着），因此**不需要**在这里再写第三份 hook 逻辑。
//
// 口径纪律（本项目踩过的坑）：
//   比较「某处占端到端多少」时，必须用**首次调用**耗时，不能用暖机后的均摊值 ——
//   前者对齐 CLI「一次解读调一次」的真实形态，后者只在循环场景（测试）里才有意义。
//   拿均摊值去除冷启动端到端，会得出「热路径占 11%」这种虚高结论。
//
// 为什么要有这个脚本：本仓库 CLI 总耗时 160ms 量级，其中绝大部分是 Node 启动与排盘
// 引擎的入场费。不做端到端对照、只读代码形态（「这里 40 处线性扫描」「这里 flatMap
// 了 335 个城市」），极易把 0.02ms 的热路径误判成 P1。脚本的意义就是让这类判断
// 先过一遍数据。

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/ziwei/types"; // 仅参与 typecheck，运行时被擦除

// HERE = <仓库根>/tools/bench，上溯两级即仓库根（口径同 tools/db/*.ts）
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "../..");
// ⚠️ 字面路径，且 tools/ 不在 npm test 覆盖内 —— 内核 2026-09-27 搬进 skills/ 后这类行
//    漏改不会变红，只会在实跑时报模块找不到。probe 里的 `@/…` 动态 import 不在此列：
//    它们走 LOADER 装的解析钩子，跟着 loader 的 ROOT 走。
const CLI = resolve(SKILL_ROOT, "skills/purplestar-astrology/scripts/purple-star.ts");
const LOADER = resolve(SKILL_ROOT, "test/lib/loader.ts");

const RULE = "─".repeat(78);

/** 中位数：奇数取中，偶数取中间两者均值。对冷启动抖动比均值稳健。 */
function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function ms(v: number, w = 10): string {
	return `${v.toFixed(v < 1 ? 4 : 2).padStart(w)} ms`;
}

// ── ① 端到端 ──

/**
 * 三条代表性命令：纯引导层 / 完整排盘 / 主题论断（唯一用得上分析数据库的命令）。
 *
 * ⚠️ 原先的第三条是 `classics`，2026-09-27 拆 skill 后古籍检索归了 `purplestar-classics`，
 *    本脚本量的是**排盘解读 skill 的 CLI**，故换成 `topic`。要量古籍那份，改 `CLI` 常量
 *    指向另一个 skill —— 同一时刻只量一份，混在一起的中位数没有解释力。
 */
const E2E_CASES: Array<{ label: string; args: string[] }> = [
	{ label: "help（纯引导层，不执行任何计算）", args: ["help"] },
	{
		label: "analyze（排盘 + 格局 + 渲染）",
		args: [
			"analyze",
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
		label: "topic（排盘 + 分析数据库 v3）",
		args: ["topic", "--topic", "career", "--date", "1990-05-15", "--time", "09:30", "--gender", "male"],
	},
];

interface E2ERow {
	label: string;
	med: number;
	min: number;
	max: number;
}

function benchE2E(runs: number): E2ERow[] {
	return E2E_CASES.map(({ label, args }) => {
		const times: number[] = [];
		for (let i = 0; i < runs; i++) {
			const t = performance.now();
			const r = spawnSync(process.execPath, [CLI, ...args], { stdio: "ignore" });
			const dt = performance.now() - t;
			if (r.status !== 0) throw new Error(`CLI 退出码 ${r.status}：${args.join(" ")}`);
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
 * ⚠️ 2026-09-27 拆 skill 时删掉了 `+ classics` 与 `+ heming-knowledge` 两组：那两个模块
 *    已随同名命令搬去 `purplestar-classics` / `purplestar-synastry`，源的内核根里**没有
 *    这两个文件**，留着会让探针以 ERR_MODULE_NOT_FOUND 退出（tools/ 不在 npm test 覆盖内，
 *    这类失效只会在实跑时暴露）。它们当年记的是「仅某条命令需要」的懒加载余地，
 *    接手这个角色的现在是 `+ analysis`。
 */
const LOAD_GROUPS: Array<{ label: string; specs: string[]; note: string }> = [
	{
		label: "核心",
		specs: [
			"@/ziwei/algorithm",
			"@/ziwei/patterns",
			"@/ziwei/sihua",
			"@/ziwei/constants",
			"@/ziwei/cities",
			"@/cli/args",
		],
		note: "analyze 必需（含 iztro / lunar-typescript）",
	},
	{ label: "+ analysis", specs: ["@/ziwei/analysis"], note: "仅 topic 命令需要（v3 分析数据库）" },
	{ label: "+ cli/commands", specs: ["@/cli/commands"], note: "命令表本体，analyze 必需" },
];

/** 可懒加载的组（analyze 用不到）——用于算「懒加载收益上限」。 */
const DEFERRABLE = new Set(["+ analysis"]);

/** 热路径样本。hour 是**时辰序号 0–12**，不是钟表时（见 types.ts 的 BirthInfo.hour）。 */
const HOT_INFO: BirthInfo = { year: 1990, month: 5, day: 15, hour: 5, gender: "male" };

// ── ②③ 子进程探针 ──

interface LoadRow {
	label: string;
	note: string;
	marginal: number;
	cumulative: number;
}

interface HotRow {
	label: string;
	first: number;
	avg: number;
}

interface ProbeResult {
	hookMs: number;
	rows: LoadRow[];
	hot: HotRow[];
}

/**
 * 探针源码。在**真实 node** 下运行；先加载 loader（注册 registerHooks），
 * 之后所有 `@/...` 动态 import 才能解析。
 *
 * ⚠️ 探针内不得出现静态 `@/` import —— 那会在 hook 注册前求值而崩溃，
 * 与 CLI 引导层是同一条约束。
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

const { generateChart } = await import("@/ziwei/algorithm");
const { detectPatterns } = await import("@/ziwei/patterns");
const { findLongitude } = await import("@/cli/birth-info");

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

async function main(): Promise<void> {
	const runsArg = process.argv.find(a => a.startsWith("--runs="));
	const runs = runsArg ? Number(runsArg.slice(7)) : 9;
	if (!Number.isInteger(runs) || runs < 1) throw new Error(`--runs 需要正整数，收到：${runsArg}`);

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
	const deferrable = loads.filter(r => DEFERRABLE.has(r.label)).reduce((s, r) => s + r.marginal, 0);

	console.log("\n【② 模块加载拆解（真实 node 口径）】");
	console.log(`  ${"阶段".padEnd(22)}${"边际".padStart(11)}${"累计".padStart(12)}  说明`);
	for (const r of loads) {
		console.log(`  ${r.label.padEnd(22)}${ms(r.marginal, 11)}${ms(r.cumulative, 12)}  ${r.note}`);
	}
	console.log(`  ${"加载合计".padEnd(22)}${ms(loadTotal, 11)}`);
	console.log(`  （另：registerHooks 一次性开销 ${ms(hookMs)}，不归属任何分组）`);

	console.log("\n【③ 热路径】");
	console.log(
		`  ${"调用".padEnd(38)}${"首次".padStart(11)}${"暖机均摊".padStart(13)}`
	);
	for (const r of hot) console.log(`  ${r.label.padEnd(38)}${ms(r.first, 11)}${ms(r.avg, 13)}`);

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
