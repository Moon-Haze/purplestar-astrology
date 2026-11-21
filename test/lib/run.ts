#!/usr/bin/env node
// ── npm test 的入口：包一层 node --test，头尾各加一块汇总 ──
//
// 为什么需要它：node:test 原生输出只有逐项 ✔ 与末尾 8 行计数 —— 日志「长」而「薄」，
// 存档到 log/ 回看时缺上下文（何时、什么环境、什么版本）。本入口做三件事：
//   1. 头部环境块：时间 / Node / git / 引擎版本 / 内核根 / 基准覆盖维度 / 筛选
//   2. 中间原样透传：node --test 的 spec 输出直连终端，一行不动
//   3. 尾部汇总：分层项数与耗时（来自 test/lib/reporter.ts 的聚合事件流）、
//      白名单命中总数（比对器活着的证据）、最慢 5 项、失败明细
//
// 失败时尾部汇总照常打印并透传退出码 —— 红的时候更需要分层定位。
// 额外参数：--year <N> 只跑层 1 该年基准（两阶段 spawn：非层 1 文件全量 +
// 层 1 文件经 node --test 原生 --test-name-pattern 按用例名首段年份过滤；
// 其余各层照常全跑）；其余参数原样透传给 node --test。
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { retiredEnvVars } from "../../scripts/boot-hooks.ts";
import { ROOT, ROOT_LABEL } from "./loader.ts";
import type { TestEventRecord } from "./reporter.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/lib
const SKILL_ROOT = resolve(HERE, "../..");

const RULE = "─".repeat(46);

// ── 参数：--year 归自己，其余透传给 node --test ──
const argv = process.argv.slice(2);
let year: number | null = null;
const passthrough: string[] = [];
for (let i = 0; i < argv.length; i++) {
	if (argv[i] === "--year") {
		const v = Number(argv[i + 1]);
		if (!Number.isInteger(v) || v < 1900 || v > 2100) {
			console.error(`--year 需要一个 1900-2100 的整数，收到：${argv[i + 1]}`);
			process.exit(2);
		}
		year = v;
		i++;
	} else {
		passthrough.push(argv[i]);
	}
}

// ── 已退役环境变量守卫（失败可见性）──
// 与 purple-star.ts 入口同款（清单单点在 boot-hooks）：外壳残留的退役变量会被
// {...process.env} 带进全部测试子进程——读取点虽已删除，仍当场报错而非放行。
const retiredVars = retiredEnvVars();
if (retiredVars.length > 0) {
	console.error(
		`已退役环境变量：${retiredVars.join("、")}——其读取点已删除，不再有任何作用。` +
			"请从运行环境中移除后重试（缓存旁路与年份过滤已改走显式旗标）。"
	);
	process.exit(2);
}

// ── 环境块的取数（各处失败都兜底成 "?" / "n/a"，环境块永远不该把测试跑挂） ──
function pkgVersion(name: string): string {
	try {
		const p = JSON.parse(
			readFileSync(resolve(SKILL_ROOT, "node_modules", name, "package.json"), "utf8")
		) as {
			version?: string;
		};
		return p.version ?? "?";
	} catch {
		return "?";
	}
}

function gitInfo(): { head: string; dirty: number } {
	const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
	const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
	return {
		head: head.status === 0 ? head.stdout.trim() : "n/a",
		dirty: status.status === 0 ? status.stdout.split("\n").filter(Boolean).length : -1,
	};
}

const manifest = JSON.parse(readFileSync(resolve(HERE, "../fixtures/manifest.json"), "utf8")) as {
	count: number;
	yearRange: [number, number];
	baselineEngine: string;
	coverage: { months: number[]; hours: number[]; leapYears: string[] };
};

// ── 头部环境块 ──
const pad2 = (n: number): string => String(n).padStart(2, "0");
const now = new Date();
const git = gitInfo();
const line = (k: string, v: string): string => `${k.padEnd(4, "　")}: ${v}`;

console.log(RULE);
console.log("紫微斗数排盘基准回归");
console.log(
	line(
		"时间",
		`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
	) + `    ${line("Node", process.version)}`
);
console.log(
	line(
		"Git",
		`${git.head}${git.dirty > 0 ? ` (dirty: ${git.dirty})` : git.dirty === 0 ? " (clean)" : ""}`
	) +
		`    ${line("引擎", `iztro ${pkgVersion("iztro")} / lunar-typescript ${pkgVersion("lunar-typescript")}`)}`
);
console.log(line("内核根", `${ROOT}（${ROOT_LABEL}）`));
console.log(
	line(
		"基准",
		`${manifest.count} 条（${manifest.baselineEngine} 快照，${manifest.yearRange[0]}-${manifest.yearRange[1]} 抽样）` +
			`· 覆盖 ${manifest.coverage.months.length}/12 月 · ${manifest.coverage.hours.length}/12 时辰 · ${manifest.coverage.leapYears.length} 闰月年`
	)
);
if (year !== null) {
	console.log(line("筛选", `${year} 年（层 1 仅该年基准，其余各层照常全跑）`));
}
console.log(RULE);

const LAYERS = [
	{
		label: "层 1 排盘对标",
		file: "chart.test.ts",
		suites: [`排盘对标（基准：${manifest.baselineEngine} 样本）`],
	},
	{
		label: "层 1 排盘对标",
		file: "json-contract.test.ts",
		suites: ["JSON 契约语料级回归"],
	},
	{ label: "层 2 CLI 端到端", file: "cli.test.ts", suites: ["CLI 端到端"] },
	{
		label: "层 2 CLI 端到端",
		file: "knowledge-registry.test.ts",
		suites: ["KnowledgeSource 注册表（Phase 1）"],
	},
	{
		label: "层 2 CLI 端到端",
		file: "astrology-sections.test.ts",
		suites: ["专题旗标→section 接线（候选 3）", "会照口径：三方四正本命四化的星曜口径"],
	},
	{ label: "层 2 CLI 端到端", file: "report.test.ts", suites: ["astrology --report 全盘报告"] },
	{
		label: "层 2 CLI 端到端",
		file: "chart-cache.test.ts",
		suites: [
			"chart-cache · 落盘与命中",
			"chart-cache · 五条失效路径（任何一条都必须重排，绝不返回坏盘）",
			"chart-cache · 开关与时钟",
			"chart-cache · CLI 端到端",
		],
	},
	{ label: "层 3 排盘结构不变量", file: "invariants.test.ts", suites: ["排盘结构不变量"] },
	{
		label: "层 3 内核契约",
		file: "kernel-contract.test.ts",
		suites: ["内核对外契约（冻结 @ 2026-10-12）"],
	},
	{
		label: "层 3 主题注册表",
		file: "topic-defs.test.ts",
		suites: [
			"主题注册表：覆盖与 TOPIC_KEYS 完全一致",
			"主题注册表：每个主题字段齐备且类型合理",
			"主题注册表：派生具名表与 TOPIC_DEFS 同步",
		],
	},
	{
		label: "层 3 主题注册表",
		file: "topic-study.test.ts",
		suites: ["Phase 4 验证：第 14 主题 study 经 getTopicAnalysis 可用且产出非空文本"],
	},
	{
		label: "层 3 主题注册表",
		file: "topic-suggestions.test.ts",
		suites: ["综合建议按盘推算"],
	},
	{ label: "层 4 三合派约束", file: "school.test.ts", suites: ["三合派体系约束"] },
	{
		label: "层 5 数据源纯函数",
		file: "sample-source.test.ts",
		suites: ["基准数据源（纯函数与错误指引）"],
	},
	{
		label: "层 6 仓库自洽",
		file: "repo.test.ts",
		suites: [
			"仓库自洽（登记一致性 / skill 自包含 / 骨架接线）",
			"解析钩子候选序（boot-hooks）",
			"注释指针有效性（源码注释的 .md 引用必须存在）",
			"数据集指纹对账（db/dataset 替换而未重登记即红）",
		],
	},
	{
		label: "层 7 引文守卫",
		file: "citations.test.ts",
		suites: [
			"引文守卫：扫描逻辑（喂构造的临时目录树）",
			"引文守卫：按流派分派（每校扫各自 citationRoots）",
		],
	},
] as const;

// ── 跑：spec → stdout 照旧，聚合事件流 → 临时文件 ──
const workDir = mkdtempSync(resolve(tmpdir(), "ziwei-test-"));
const t0 = Date.now();
const reporterArgs = [
	"--test-reporter",
	"spec",
	"--test-reporter-destination",
	"stdout",
	"--test-reporter",
	resolve(HERE, "reporter.ts"),
	"--test-reporter-destination",
] as const;
// 单次 spawn 即一个聚合事件流文件；--year 两阶段各落一份，聚合时合并 records。
const statuses: Array<number | null> = [];
const runNodeTest = (files: string[], namePattern: string | null, aggPath: string) => {
	const r = spawnSync(
		"node",
		[
			"--test",
			...(namePattern === null ? [] : ["--test-name-pattern", namePattern]),
			...reporterArgs,
			aggPath,
			...passthrough,
			...files,
		],
		{ stdio: "inherit", cwd: SKILL_ROOT, env: { ...process.env } }
	);
	statuses.push(r.status);
};

const aggFiles: string[] = [];
if (year === null) {
	// 默认：单次全量（glob 口径与既往一致）
	const aggFile = resolve(workDir, "events.jsonl");
	runNodeTest(["test/**/*.test.ts"], null, aggFile);
	aggFiles.push(aggFile);
} else {
	// --year 两阶段（旗标过滤，零环境变量）：非层 1 文件全量——「其余各层照常全跑」的
	// 鉴别语义（层 2/3 是层 1 红时的鉴别器）不变；层 1 文件经 node --test 原生的
	// --test-name-pattern 按用例名首段年份过滤（层 1 用例名首段即出生年）。
	// 文件清单从 LAYERS 派生（LAYERS ⊇ 全部测试文件由 repo 层断言钉住）。
	const layer1Files = LAYERS.filter(l => l.label.startsWith("层 1")).map(l => `test/${l.file}`);
	const otherFiles = [...new Set(LAYERS.map(l => `test/${l.file}`))].filter(
		f => !layer1Files.includes(f)
	);
	const aggMain = resolve(workDir, "events.jsonl");
	runNodeTest(otherFiles, null, aggMain);
	aggFiles.push(aggMain);
	const aggYear = resolve(workDir, "events-year.jsonl");
	runNodeTest(layer1Files, String(year), aggYear);
	aggFiles.push(aggYear);
}
const wallMs = Date.now() - t0;

// ── 聚合：分层项数 / 耗时 / 白名单命中 / 最慢 / 失败明细 ──
const records: TestEventRecord[] = aggFiles.flatMap(f =>
	existsSync(f)
		? readFileSync(f, "utf8")
				.split("\n")
				.filter(Boolean)
				.map(l => JSON.parse(l) as TestEventRecord)
		: []
);

// 分层依据 = 测试文件（与 test/README.md 的层定义一一对应）。
// 项数与层耗时取每个文件的 test:summary（官方口径，多文件并行下依然可靠）；
// 事件流的 classname / nesting / parentId 在并行下会丢字段，一律不用。
// ⚠️ `suites` 是该文件**全部顶层 describe 的名字**，用于把套件级的聚合耗时从「最慢 5 项」
// 里排除掉（一个套件的 duration 是它所有子项之和，不排除就会霸榜）。写漏一个不会报错 ——
// 症状只是最慢榜里混进一行套件名，而 describe 名只存在于运行时输出里，**没有断言盯得住
// 这处脱钩**。故改 describe 标题时，顺手改这里；`repo.test.ts` 有一条断言只盯得住 file 字段。
const basename = (p: string | null): string => p?.split("/").pop() ?? "";
const layerOf = (file: string | null): string =>
	LAYERS.find(l => l.file === basename(file))?.label ?? "其他";

interface LayerStat {
	total: number;
	passed: number;
	failed: number;
	ms: number;
}
const bucket = new Map<string, LayerStat>();
// 全局 summary（file 为空）是各文件汇总的再合计 —— 记下用于对账，不进分层数字
// --year 两阶段各有自己的全局 summary：跨阶段累加（每个 file 为空的记录是一段 run 的合计）
let globalSummary: { total: number; passed: number; failed: number } | null = null;
for (const r of records) {
	if (r.type !== "summary" || !r.counts) {
		continue;
	}
	if (!r.file) {
		// 直接赋值而非经闭包——TS 的控制流分析不追踪闭包内写入，内联后对账处的窄化才成立
		globalSummary = globalSummary
			? {
					total: globalSummary.total + r.counts.total,
					passed: globalSummary.passed + r.counts.passed,
					failed: globalSummary.failed + r.counts.failed,
				}
			: { ...r.counts };
		continue;
	}
	const key = layerOf(r.file);
	const b = bucket.get(key) ?? { total: 0, passed: 0, failed: 0, ms: 0 };
	b.total += r.counts.total;
	b.passed += r.counts.passed;
	b.failed += r.counts.failed;
	b.ms += r.durationMs ?? 0;
	bucket.set(key, b);
}

// 白名单命中总数：层 1 每条基准的诊断行自报（chart.test.ts 的 t.diagnostic，格式自控）
let whitelisted = 0;
for (const r of records) {
	if (r.type !== "diagnostic" || !r.message) {
		continue;
	}
	for (const m of r.message.matchAll(/白名单(\d+)/g)) {
		whitelisted += Number(m[1]);
	}
}

const fmtMs = (ms: number): string =>
	ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
// 失败明细与最慢项来自逐测试事件（name / duration / error 均为单事件字段，可靠）。
// 套件也会发 fail 事件（errorMessage 形如「N subtests failed」），与逐项明细重复，滤掉：
// it 失败的 errorMessage 是断言详情，以此为判据（覆盖 assert 抛错与断言消息两种形态）。
const failed = records.filter(
	r => r.type === "fail" && r.errorMessage && !/subtests failed/.test(r.errorMessage)
);
// 最慢榜排除与分层汇总重复的聚合值：各层的顶层套件（= 层耗时）与「YYYY 年」年份套件。
// 中间套件（如「大限」）保留 —— 它指向具体的慢块，名字自说明。
const SUITE_LAYER_NAMES = new Set<string>(LAYERS.flatMap(l => l.suites));
const isAggSuite = (name: string): boolean =>
	SUITE_LAYER_NAMES.has(name) || /^(19|20)\d{2} 年$/.test(name);
const slowest = [...records]
	.filter(
		r =>
			(r.type === "pass" || r.type === "fail") && r.durationMs !== null && !isAggSuite(r.name)
	)
	.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
	.slice(0, 5);
const total = [...bucket.values()].reduce((s, b) => s + b.total, 0);
const totalFailed = [...bucket.values()].reduce((s, b) => s + b.failed, 0);

console.log(`\n${RULE}`);
console.log("分层汇总（层耗时 = 该文件墙钟）");
for (const { label } of LAYERS) {
	const b = bucket.get(label);
	if (!b) {
		continue;
	}
	console.log(
		`  ${label.padEnd(10, "　")} ${b.total} 项 ${b.failed ? `✗${b.failed}` : "✓"}   ${fmtMs(b.ms)}`
	);
}
console.log(
	`  总计 ${total} 项：${total - totalFailed} 通过${totalFailed ? ` / ${totalFailed} 失败` : ""} · 墙钟 ${fmtMs(wallMs)}`
);
// 对账：分层合计应等于 node:test 全局 summary。不等说明聚合漏了事件（比如新增了测试文件
// 而没登记进 LAYERS）—— 显式报出来，而不是静默少计。
if (globalSummary && globalSummary.total !== total) {
	console.log(
		`  ⚠ 分层合计 ${total} ≠ node:test 官方总计 ${globalSummary.total}（test/ 下有未映射到层的文件？）`
	);
}

if (slowest.length) {
	console.log("  最慢 5 项：");
	for (const r of slowest) {
		console.log(`    ${fmtMs(r.durationMs ?? 0).padStart(6)}  ${r.name}`);
	}
}
if (whitelisted > 0) {
	console.log(`  白名单命中 ${whitelisted} 处（太阳/太阴@酉的已知亮度差异，比对器在工作）`);
}

if (failed.length) {
	console.log(`\n${RULE}\n失败明细（${failed.length} 项）`);
	for (const r of failed) {
		console.log(`  ✗ [${layerOf(r.file)}] ${r.name}`);
		if (r.errorMessage) {
			console.log(`      ${r.errorMessage.split("\n").slice(0, 3).join("\n      ")}`);
		}
	}
}
console.log(RULE);

rmSync(workDir, { recursive: true, force: true });
// 任一阶段失败即失败（status null = 被信号终止，按失败计）
process.exit(statuses.some(s => (s ?? 1) !== 0) ? 1 : 0);
