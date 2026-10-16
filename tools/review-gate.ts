#!/usr/bin/env node
// ── 代码评审闸门：按变更类型分档 + 机检硬项 + 产出评审工作单 ──
//
// 给谁用：`docs/reviews/code-review-20261012.md` 那套标准里**能被机器判**的部分。判断类
// （语义对不对、抽象边界划得对不对）永远留给人和评审 Agent —— 工具不假装能做。
//
// 用法（仓库根执行）：
//   npx tsx tools/review-gate.ts                # 对「工作区未提交改动」跑
//   npx tsx tools/review-gate.ts --base master  # 对某基线的差异跑（含已提交部分）
//   npx tsx tools/review-gate.ts --no-run       # 只出分档与检查单，不执行闸门命令
//   npx tsx tools/review-gate.ts -h
//
// 输出三段：
//   1. 分档 —— 从 diff 启发式判定变更类型，据此给出**必须跑的闸门**；
//   2. 机检 —— 只报「事实」，每条附文件与行号，可直接跳转；
//   3. 工作单 —— 把本次相关的判断题列成待填清单，交评审者。
//
// ⚠️ **刻意不做的事**（都是本项目踩过的坑）：
//   1. **不重复实现引文分级的判据**。`scripts/cli/selftest/guard.ts` 才是那条规则的
//      权威（正则 + `grades.ts` 双向对拍）。这里只**指出本次新增行里哪些长得像倪师引句**，
//      判「有没有登记」交给 selftest —— 复制一份判据就是第二个真相源，下次必然漂移。
//   2. **不替代 `npm test`**。工具只解析它的输出、核对内核层计数，不重跑任何断言。
//   3. **不做风格判断**。本仓库格式化口径未统一，工具去管风格只会制造无关 diff。
//   4. **逐字节对拍只在「重构（不改行为）」时成立**（`--byte-diff`）。行为新增类变更
//      本来就该变输出，此时报差异是正常的 —— 分档那一问就是提醒评审者别误用。
//
// 退出码：0 = 无阻断项且闸门全绿；1 = 有阻断项或闸门未过；2 = 参数/环境问题。

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/
const SKILL_ROOT = resolve(HERE, "..");
const RULE = "─".repeat(58);

// ── 内核层基线 ────────────────────────────────────────────────────────────────
// 跨阶段护栏盯的是**层 3**（排盘结构不变量 + 内核契约），不是总项数 —— 总数会被
// 新增插件项合法抬高。基线值由 tests/db.test.ts 之外的评审流程守护；变动时**同步更新
// 本常量并记入 docs/plans/2026-10-12-extensibility-roadmap-plan.md §9**。
// 减少 = 守卫被削弱或删除（阻断）；增加 = 冻结面可能长胖了（提示复核）。
const KERNEL_BASELINE = { invariants: 112, kernelContract: 5 };

/** 0C 冻结面：插件可引用，不得修改。来源 = scripts/types.ts 顶部契约区块。 */
const FROZEN_SURFACE = [
	"scripts/types.ts",
	"scripts/algorithm.ts",
	"scripts/mutagen.ts",
	"scripts/wenmo-brightness.ts",
	"scripts/palace-relations.ts",
	"scripts/corpus/data/annotations.ts",
];

/** 生成文件：头里写明「不要手改」，手改会被下次重跑静默覆盖。 */
const GENERATED = [/^scripts\/corpus\/data\/manual\/.+\.ts$/];

/** 真相源：动它们等于动全仓的一致性，评审必看。 */
const SOURCES_OF_TRUTH = [
	"scripts/analysis/data.ts", // TOPIC_DEFS / TOPIC_KEYS / STORAGE_TOPIC_KEYS
	"scripts/cli/args/table.ts", // 参数声明唯一来源
	"scripts/analysis/grades.ts", // 引文分级登记表
];

// ── git 薄封装 ────────────────────────────────────────────────────────────────
interface GitOut {
	ok: boolean;
	out: string;
	code: number;
}
function git(args: string[]): GitOut {
	const r = spawnSync("git", args, { encoding: "utf8", cwd: SKILL_ROOT, maxBuffer: 1 << 28 });
	if (r.error) {
		return { ok: false, out: String(r.error.message), code: -1 };
	}
	return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status ?? -1 };
}

interface ChangedFile {
	status: string; // A / M / D / R
	path: string;
}
/**
 * 变更文件清单：`base` 为空时看工作区（含未提交与已暂存），否则看相对 `base` 的差异。
 *
 * ⚠️ **必须并上未跟踪文件**（`git diff` 看不见它们）。新建文件是风险最高的一类 ——
 * 没有既有行为可比对、也没有既有测试覆盖；若评审对象里漏了它们，这次评审就是假的。
 * 这条是实测踩出来的：加了未跟踪文件后「变更 1 个文件」而实际有 2 个。
 */
function changedFiles(base: string | null): ChangedFile[] {
	const r = git(["diff", "--name-status", "-M", base ?? "HEAD"]);
	const tracked: ChangedFile[] = r.ok
		? r.out
				.split("\n")
				.filter(Boolean)
				.map(line => {
					const parts = line.split("\t");
					// R 形态是「状态 + 旧路径 + 新路径」，取新路径
					return { status: parts[0][0], path: parts[parts.length - 1] };
				})
		: [];
	// 未跟踪文件只在「看工作区」时才是评审对象；相对 base 时它们本就不在 base 里。
	if (base) {
		return tracked;
	}
	const un = git(["ls-files", "--others", "--exclude-standard"]);
	if (!un.ok) {
		return tracked;
	}
	const fresh = un.out
		.split("\n")
		.filter(Boolean)
		.filter(p => !tracked.some(t => t.path === p))
		.map(path => ({ status: "A", path }));
	return [...tracked, ...fresh];
}

interface AddedLine {
	path: string;
	line: number;
	text: string;
}
/**
 * 取**新增行**（逐行，带新文件行号）。`-U0` 让每个 hunk 只含真正变化的行，
 * 配合 hunk 头 `@@ -a,b +c,d @@` 还原行号。
 *
 * ⚠️ `base` 必须原样传给 git —— 漏传会让本函数去比工作区与 index，在 `--base` 模式下
 * 恒返回空，于是「新增了倪师引句」这类检查**静默全绿**。这是工具自己最典型的假绿来源，
 * 故调用方只能经 `collect(base)` 一条路拿数据，不单独调用本函数。
 */
function addedLines(base: string | null, files: ChangedFile[]): AddedLine[] {
	const paths = files.filter(f => f.status !== "D").map(f => f.path);
	if (!paths.length) {
		return [];
	}
	// 未跟踪文件：`git diff` 不含它们，用 --no-index 与 /dev/null 比（退出码 1 = 有差异，属正常）
	const untracked = files.filter(f => f.status === "A").map(f => f.path);
	const known = files.filter(f => f.status !== "A" && f.status !== "D").map(f => f.path);
	const chunks: string[] = [];
	if (known.length) {
		const r = git(["diff", "-U0", "--no-color", base ?? "HEAD", "--", ...known]);
		if (r.ok) {
			chunks.push(r.out);
		}
	}
	for (const f of untracked) {
		const r = git(["diff", "--no-index", "-U0", "--no-color", "/dev/null", f]);
		// --no-index 差异存在时退出码为 1，非 0 不代表失败
		if (r.out) {
			chunks.push(r.out);
		}
	}
	const out: AddedLine[] = [];
	let cur = "";
	let newLine = 0;
	for (const line of chunks.join("\n").split("\n")) {
		const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (hunk) {
			newLine = Number(hunk[1]);
			continue;
		}
		if (line.startsWith("+++ ")) {
			cur = line.slice(4).replace(/^b\//, "");
			continue;
		}
		if (line.startsWith("+") && !line.startsWith("+++")) {
			out.push({ path: cur, line: newLine, text: line.slice(1) });
			newLine++;
		}
	}
	return out;
}

// ── 变更类型分档 ──────────────────────────────────────────────────────────────
type Tier = "严" | "中" | "轻";
interface Classify {
	tier: Tier;
	kinds: string[];
	reasons: string[];
}
function classify(base: string | null, files: ChangedFile[], adds: AddedLine[]): Classify {
	const kinds = new Set<string>();
	const reasons: string[] = [];
	const paths = files.map(f => f.path);
	const touches = (frag: string): boolean => paths.some(p => p.includes(frag));

	// 冻结面 / 真相源 / 生成文件 —— 任一命中即升到「严」
	if (paths.some(p => FROZEN_SURFACE.includes(p))) {
		kinds.add("冻结面");
		reasons.push("触及 0C 冻结面：插件只可引用，不可修改");
	}
	if (paths.some(p => GENERATED.some(re => re.test(p)))) {
		kinds.add("生成文件");
		reasons.push("触及生成文件：应改生成器，不是改产物");
	}
	if (paths.some(p => SOURCES_OF_TRUTH.includes(p))) {
		kinds.add("真相源");
		reasons.push("触及真相源：全仓一致性依赖它");
	}
	// 依赖判定要看**版本行**，不能只看「动了 package.json」—— 加一条 npm script
	// 与升级 iztro 后果完全不同，后者会改变排盘结果。版本行形态：值以数字/~ /^ 开头。
	const pkgDiff = git(["diff", "-U0", "--no-color", base ?? "HEAD", "--", "package.json"]);
	const pkgLine = pkgDiff.out
		.split("\n")
		.filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
		.filter(l =>
			/"(dependencies|devDependencies|peerDependencies)"|"[^"]+"\s*:\s*"[~^]?\d/.test(l)
		);
	if (pkgLine.length) {
		kinds.add("依赖");
		reasons.push("动了依赖版本：iztro/lunar 升级会改变排盘结果，须 selftest + npm test 都跑");
	}
	// 重构线索：同文件增删都很大 → 像重排而非加法
	const heavy = git(["diff", "--numstat", base ?? "HEAD"])
		.out.split("\n")
		.filter(Boolean)
		.map(l => l.split("\t"))
		.filter(c => c.length >= 2 && /^\d+$/.test(c[0]) && /^\d+$/.test(c[1]))
		.map(c => ({ add: Number(c[0]), del: Number(c[1]) }))
		.filter(c => c.add >= 20 && c.del >= 20);
	if (heavy.length) {
		kinds.add("重构");
		reasons.push(`有 ${heavy.length} 个文件增删均 ≥20 行：像重排，需逐字节对拍`);
	}
	// 内容线索：新增行里出现长引号文案
	if (adds.some(a => a.text.length > 30 && /[「『]/.test(a.text))) {
		kinds.add("内容");
	}
	if (!kinds.size) {
		kinds.add("局部");
	}
	if (paths.filter(p => p.endsWith(".md")).length === paths.length) {
		kinds.add("文档");
	}

	// ⚠️ **「轻」档的唯一豁免是「没碰代码」**。任何 scripts/ · test/ · tools/ 的改动
	// 都必须跑全量回归 —— 尤其 test/：你在改的就是「验证一切的那个东西」，
	// 跳过它等于让守卫自己给自己免检。
	// 这条是实测补的：改 test/cli.test.ts 曾被判「轻」而跳过 npm test，
	// 于是一处真失败从闸门底下溜了过去（红灯仍由 npm test 报出，不是静默）。
	const touchesCode = paths.some(p => /\.(ts|json)$/.test(p) && !p.endsWith(".md"));
	if (touchesCode) {
		kinds.add("代码");
	}

	const tier: Tier =
		kinds.has("冻结面") || kinds.has("生成文件") || kinds.has("依赖") || kinds.has("重构")
			? "严"
			: touchesCode || kinds.has("真相源") || kinds.has("内容")
				? "中"
				: "轻";
	if (tier !== "轻") {
		reasons.push("碰到代码 → 必须跑全量回归（轻档只豁免纯文档改动）");
	}
	return { tier, kinds: [...kinds], reasons };
}

// ── 机检：只报事实，不下判断 ──────────────────────────────────────────────────
/**
 * 「可能进入文案数据」的代码行 —— 引文分级与计数写死两项只在这里查。
 *
 * ⚠️ 为什么收窄：`selftest` 的知识分级守卫本就**排除注释行**（`/^\s*(\/\/|\/\*|\*)/`），
 * 而 `.md` 文档里提到「倪师引句」只是**在讲规则**，不是在用引句。若不排除，
 * 本工具会对每一条讲解引文纪律的注释和文档刷出一条无意义的告警 —— 告警一旦失准，
 * 真正该看的就会被淹没（与 `grades.ts` 头注释「guard 的两条纪律」同一动机）。
 * 判据归 selftest，本函数只负责**把位置圈对**。
 */
function isContentLine(a: AddedLine): boolean {
	if (/\.(md|markdown)$/.test(a.path)) {
		return false;
	}
	if (!/^scripts\/(analysis|corpus\/data)\//.test(a.path)) {
		return false;
	}
	// 核对表与登记表本身：它们**持有**引句而非引用，改它们走的是另一条审查路径
	if (/(annotations|grades)\.ts$/.test(a.path)) {
		return false;
	}
	if (/^\s*(\/\/|\*|\/\*)/.test(a.text)) {
		return false;
	}
	return true;
}

interface Finding {
	level: "🔴" | "🟡" | "💭";
	title: string;
	where: string;
	why: string;
}
function mechanical(files: ChangedFile[], adds: AddedLine[]): Finding[] {
	const out: Finding[] = [];
	const paths = files.map(f => f.path);

	for (const f of FROZEN_SURFACE) {
		if (paths.includes(f)) {
			out.push({
				level: "🔴",
				title: "触及冻结面",
				where: f,
				why: "0C 冻结契约：插件可引用这些数据，但不得修改。若确有必要，先改契约并重跑全量。",
			});
		}
	}
	// 生成文件：**改动**是阻断（会被下次重跑静默覆盖），**新增**只提示
	// —— 新增一个生成物本身合理（首次落地），要确认的是「生成器也会产出它」。
	for (const f of files) {
		if (!GENERATED.some(re => re.test(f.path))) {
			continue;
		}
		if (f.status === "M") {
			out.push({
				level: "🔴",
				title: "改了已入库的生成文件",
				where: f.path,
				why: "由 tools/db/export-manual.ts code 产出，直接改会被下次重跑静默覆盖。改生成器。",
			});
		} else if (f.status === "A") {
			out.push({
				level: "🟡",
				title: "新增了生成物",
				where: f.path,
				why: "确认生成器重跑也会产出同样形态的文件（头注释 + 内容结构一致），否则下次重跑会凭空多出/丢掉它。",
			});
		}
	}

	// 新增行里的倪师引句形态 —— **只报位置，不判是否已登记**（判据归 selftest）
	const niQuote = adds.filter(
		a => isContentLine(a) && /(?<!非)倪(?:师|海厦)[^「」"“”]{0,18}[：:]?[「"]/.test(a.text)
	);
	if (niQuote.length) {
		out.push({
			level: "🟡",
			title: `新增 ${niQuote.length} 行含「倪师 + 引号」形态`,
			where: niQuote
				.slice(0, 5)
				.map(a => `${a.path}:${a.line}`)
				.join("  "),
			why: "① 若内容是自撰/占位，挂引语属伪造引文，应改为自述式；② 若确有出处，须在 grades.ts 登记档位。两者都由 selftest 拦截。",
		});
	}

	// 计数写死：新增行里带「N 个/项/主题」这类字面量数字
	const hardCount = adds.filter(
		a => isContentLine(a) && /\d+\s*(个主题|项|条断言|层)/.test(a.text)
	);
	if (hardCount.length) {
		out.push({
			level: "💭",
			title: `新增 ${hardCount.length} 行疑似写死计数`,
			where: hardCount
				.slice(0, 5)
				.map(a => `${a.path}:${a.line}`)
				.join("  "),
			why: "计数应能自报自报、能派生派生。确认这里不是必须固定的守卫基线值。",
		});
	}

	// 跨层：cli ↔ 内核 ↔ test 同时被改，通常意味着改的不是单一职责
	const layers = new Set<string>();
	if (touchesDir(paths, "scripts/cli/")) {
		layers.add("cli");
	}
	if (touchesDir(paths, "test/")) {
		layers.add("test");
	}
	if (paths.some(p => /^scripts\/[^/]+\.ts$/.test(p) || p.startsWith("scripts/analysis"))) {
		layers.add("内核");
	}
	if (layers.size >= 3) {
		out.push({
			level: "🟡",
			title: "跨层改动",
			where: [...layers].join(" / "),
			why: "同时动 CLI、内核、测试，通常意味着改动跨越了职责边界。确认没有把 CLI 细节漏进内核或反之。",
		});
	}

	// 规模
	if (paths.length >= 8) {
		out.push({
			level: "💭",
			title: `改动面较大（${paths.length} 个文件）`,
			where: paths.slice(0, 4).join("  ") + (paths.length > 4 ? " …" : ""),
			why: "确认每处改动都属于同一主题，没有夹带无关的格式或重命名。",
		});
	}
	return out;
}
function touchesDir(paths: string[], frag: string): boolean {
	return paths.some(p => p.startsWith(frag));
}

// ══════════════════════════════════════════════════════════════════════
// 逐字节对拍 —— 重构类变更的硬证据
//
// 本会话手工做过三次，每次都踩坑，故固化成工具：
//   ① 快照落 /tmp → 它会被清空 → cmp 对**两个都不存在**的文件返回失败
//      → 9 个场景全报 DIFFERS，差点当成「改动破坏了全部输出」否掉一次正确改动。
//      故快照落**仓库内** .review-tmp/（已 .gitignore），并逐个校验快照非空。
//   ② `cmd | grep -c X && next` 在零匹配时 grep 返回 1、next 根本不执行 ——
//      闸门"跑过"是假的。故比对前**显式校验每个快照**，校验不过报「验证手段失准」
//      并以失败退出，**绝不**报成 DIFFERS。
//   ③ stash 必须保证还原。故用 try/finally，并核对还原后的工作区与 stash 前一致。
// ══════════════════════════════════════════════════════════════════════

/** 快照目录（仓库内；已进 .gitignore，故不会被 stash 卷进去、也不会被误提交）。 */
const SNAP_DIR = resolve(SKILL_ROOT, ".review-tmp");

/** 样例盘（虚构数据，与 help 的示例同款）。 */
const SAMPLE_BIRTH = ["2011-06-24", "07:45", "男", "杭州"];

interface Scenario {
	name: string;
	args: readonly string[];
}

/**
 * 对拍场景。主题清单**由注册表派生**（`analysis/data.ts` 零 import，取它无开销），
 * 故加主题时本表自动跟上 —— 与 tools/cli-samples.ts 那种手维护清单相反，
 * 因为这里漏一个主题 = 少覆盖，而手维护的清单必然腐烂。
 */
async function buildScenarios(): Promise<Scenario[]> {
	const { TOPIC_KEYS } = (await import("../scripts/analysis/data")) as {
		TOPIC_KEYS: readonly string[];
	};
	const A = (extra: readonly string[]): string[] => ["astrology", ...SAMPLE_BIRTH, ...extra];
	return [
		{ name: "chart --json", args: A(["--json"]) },
		{ name: "astrology --report", args: A(["--report"]) },
		{ name: "astrology 默认概览", args: A([]) },
		...TOPIC_KEYS.map(t => ({ name: `topic ${t}`, args: A(["--topic", t]) })),
	];
}

/** 跑一批场景并把 stdout 落盘。返回「快照是否可信」——不可信时绝不进入比对。 */
function snapshot(tag: string, scenarios: readonly Scenario[]): Map<string, string> {
	const dir = resolve(SNAP_DIR, tag);
	mkdirSync(dir, { recursive: true });
	const out = new Map<string, string>();
	for (const s of scenarios) {
		const r = spawnSync(process.execPath, ["scripts/purple-star.ts", ...s.args], {
			cwd: SKILL_ROOT,
			encoding: "utf8",
			maxBuffer: 1 << 26,
		});
		if (r.status !== 0) {
			throw new Error(
				[
					`逐字节对拍中止：场景「${s.name}」退出码 ${r.status}，快照不可信。`,
					`　命令：node scripts/purple-star.ts ${s.args.join(" ")}`,
					`　先把这个命令单独跑通再对拍 —— 拿一份失真的基线比对，比对结果只会是噪声。`,
					`　stderr：${(r.stderr ?? "").split("\n").slice(0, 3).join(" | ").slice(0, 300)}`,
				].join("\n")
			);
		}
		const p = resolve(dir, `${s.name.replace(/[^\w.-]/g, "_")}.txt`);
		writeFileSync(p, r.stdout ?? "", "utf8");
		out.set(s.name, p);
	}
	return out;
}

/**
 * 读快照并**校验它真的存在且非空**。
 *
 * ⚠️ 这一段是为堵「验证手段失准」而存在的：快照缺失/为空时，`cmp` 只会返回「不同」，
 * 于是**工具失灵**会被读成**代码变了**。宁可直接失败，也不能给出方向相反的结论。
 */
function readShot(p: string): { ok: true; text: string } | { ok: false; why: string } {
	try {
		if (statSync(p).size === 0) {
			return { ok: false, why: "快照为空" };
		}
	} catch {
		return { ok: false, why: "快照文件不存在" };
	}
	try {
		return { ok: true, text: readFileSync(p, "utf8") };
	} catch (e) {
		return { ok: false, why: `快照读取失败：${e instanceof Error ? e.message : String(e)}` };
	}
}

interface ByteDiffResult {
	same: string[];
	diff: string[];
	toolFault: string[];
}

async function runByteDiff(): Promise<ByteDiffResult> {
	const scenarios = await buildScenarios();
	// 对拍前的**工作区指纹**（不是快照）—— 用来核对 stash pop 是否真的还原回去了
	const wsBefore = git(["status", "--porcelain"]).out;

	// 快照目录的清理由 finally 统一保证。散落在成功路径上看着没问题，实测有两个早退
	// （stash 失败 / 还原不一致）会跳过它 —— 而那恰恰是**最需要人看现场**的时候，
	// 留一堆快照在 .review-tmp/ 里会让人误以为还能据此判断。
	rmSync(SNAP_DIR, { recursive: true, force: true });
	try {
		const currentShots = snapshot("after", scenarios);

		const stash = git(["stash", "push", "--include-untracked", "-m", "review-gate:byte-diff"]);
		if (!stash.ok) {
			return {
				same: [],
				diff: [],
				toolFault: ["git stash 失败，取不到基线（工作区无变更时本就无从比起）"],
			};
		}

		let baselineShots: Map<string, string>;
		try {
			baselineShots = snapshot("before", scenarios);
		} finally {
			// 必须还原 —— 否则用户的改动就停在 stash 里了
			git(["stash", "pop"]);
		}
		// 且要**核对**还原成功：pop 静默失败时工作区停在基线态，此时下面所有比对都是假的
		if (git(["status", "--porcelain"]).out !== wsBefore) {
			return {
				same: [],
				diff: [],
				toolFault: [
					"stash pop 之后工作区与对拍前不一致 —— **请立刻检查工作区**（`git stash list` 看有没有残留），本次结果一律作废",
				],
			};
		}

		const same: string[] = [];
		const diff: string[] = [];
		const toolFault: string[] = [];
		for (const sc of scenarios) {
			const now = readShot(currentShots.get(sc.name)!);
			const base = readShot(baselineShots.get(sc.name)!);
			if (!now.ok || !base.ok) {
				const parts = [
					!now.ok && `改动侧 ${now.why}`,
					!base.ok && `基线侧 ${base.why}`,
				].filter(Boolean);
				toolFault.push(`${sc.name}：${parts.join("；")}`);
				continue;
			}
			if (now.text === base.text) {
				same.push(sc.name);
			} else {
				diff.push(sc.name);
			}
		}
		return { same, diff, toolFault };
	} finally {
		rmSync(SNAP_DIR, { recursive: true, force: true });
	}
}

// ── 闸门执行 ──────────────────────────────────────────────────────────────────
interface Gate {
	name: string;
	cmd: string;
	pass: boolean;
	tail: string;
}

/**
 * 「通过但无输出」时各闸门该自报什么。
 *
 * 为什么要这张表：`typecheck` 成功时**一个字都不打**。空着会让读闸门的人分不清
 * 「通过了」与「压根没跑」—— 而这两种情况的后果完全相反。计数类事实自报，
 * 是本仓库的既有纪律（CLAUDE.md「计数类事实一律不写死」）。
 */
const GATE_QUIET_PASS: Record<string, string> = {
	typecheck: "0 错误（静默通过）",
};
function runGates(tier: Tier): Gate[] {
	const gates: Gate[] = [
		{ name: "typecheck", cmd: "npm run typecheck", pass: true, tail: "" },
		{ name: "selftest", cmd: "node scripts/purple-star.ts selftest", pass: true, tail: "" },
	];
	// 「轻」档不必重跑全量回归 —— 但若动了 .ts 类型面，typecheck 已在必跑里
	if (tier !== "轻") {
		gates.push({ name: "npm test", cmd: "npm test", pass: true, tail: "" });
	}
	for (const g of gates) {
		const r = spawnSync(g.cmd, {
			encoding: "utf8",
			cwd: SKILL_ROOT,
			shell: true,
			maxBuffer: 1 << 28,
		});
		const text = ((r.stdout ?? "") + (r.stderr ?? ""))
			.split("\n")
			.filter(Boolean)
			// npm 自身的 notice 行与闸门结论无关，且会把关键判定挤出版面
			.filter(l => !/^npm (notice|error)/.test(l.trim()));
		g.pass = r.status === 0;
		g.tail = text.slice(-2).join(" | ").slice(0, 200);
		// 通过却无输出（如 typecheck 静默 0 错误）时**自报一句**，别留空让人猜是不是没跑
		if (g.pass && !text.length) {
			g.tail = GATE_QUIET_PASS[g.name] ?? "通过（无输出）";
		}
		if (g.name === "npm test") {
			// 核对内核层计数（总项数会被插件项合法抬高，内核层才是越界信号）
			const inv = text.join("\n").match(/层 3 排盘结构不变量\s+(\d+)\s+项/);
			const kc = text.join("\n").match(/层 3 内核契约\s+(\d+)\s+项/);
			if (!inv || !kc) {
				g.pass = false;
				g.tail =
					"无法从 npm test 输出解析内核层计数 —— 守卫口径变了，先核对 run.ts 的 LAYERS";
			} else {
				const cur = { invariants: Number(inv[1]), kernelContract: Number(kc[1]) };
				const total = text.join("\n").match(/总计 (\d+) 项/);
				const base = `${KERNEL_BASELINE.invariants}+${KERNEL_BASELINE.kernelContract}`;
				const now = `${cur.invariants}+${cur.kernelContract}`;
				if (
					cur.invariants < KERNEL_BASELINE.invariants ||
					cur.kernelContract < KERNEL_BASELINE.kernelContract
				) {
					g.pass = false;
					g.tail = `内核层 ${now} < 基线 ${base} —— 守卫被削弱或删除`;
				} else if (now !== base) {
					g.tail = `内核层 ${now}（基线 ${base}）⚠ 增长 —— 确认冻结面没有长胖`;
				} else {
					g.tail = `总计 ${total?.[1] ?? "?"} 项 · 内核层 ${now} 与基线一致`;
				}
			}
		}
	}
	return gates;
}

// ── 工作单：判断题（工具答不了的那部分）─────────────────────────────────────
const JUDGE_ITEMS: Array<[string, string]> = [
	["语义", "每处新逻辑对吗？边界条件（空盘 / 未知主题 / 非法输入）想过吗？"],
	["边界", "抽象的边界划在正确的位置吗？加一个实现是否只需「一个文件 + 一行注册」？"],
	["单职", "新增/改动的常量是否只承担一个角色？（一个名字、两种含义 = 下一个漂移的伏笔）"],
	["独立", "新增断言的期望值来自哪条**独立路径**？同源同路径的断言只是实现的复读机。"],
	["反向", "注入一个已知失效，确认只有目标断言变红 —— 做过吗？"],
	[
		"追溯",
		"文案改动是否与体系口径（文墨排盘 + 倪师论断）一致？改 CLI 输出时 SKILL.md 同步了吗？",
	],
];

function printUsage(): void {
	console.log(`
用法：
  npx tsx tools/review-gate.ts                # 对「工作区未提交改动」跑闸门
  npx tsx tools/review-gate.ts --base master  # 对某基线的差异跑（含已提交部分）
  npx tsx tools/review-gate.ts --no-run       # 只出分档与检查单，不执行闸门命令
  npx tsx tools/review-gate.ts --byte-diff   # 追加「逐字节对拍」（重构类必做证据）
  npx tsx tools/review-gate.ts -h

退出码：0 无阻断且闸门全绿 · 1 有阻断或闸门未过 · 2 参数/环境问题
`);
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	if (argv.includes("-h") || argv.includes("--help")) {
		printUsage();
		return;
	}
	const baseIdx = argv.indexOf("--base");
	const base = baseIdx >= 0 ? argv[baseIdx + 1] : null;
	if (baseIdx >= 0 && !base) {
		console.error("--base 需要一个 ref（如 master）");
		process.exit(2);
	}
	const noRun = argv.includes("--no-run");
	const byteDiff = argv.includes("--byte-diff");

	if (git(["rev-parse", "--git-dir"]).code !== 0) {
		console.error("不在 git 仓库内，无法取差异。");
		process.exit(2);
	}

	const files = changedFiles(base);
	if (!files.length) {
		console.log(`没有变更${base ? `（相对 ${base}）` : "（工作区）"}，评审无对象。`);
		// 显式要了 --byte-diff 却什么都不说 = 看着像跑了其实没跑（见 §4.1）
		if (byteDiff) {
			console.log(
				"逐字节对拍已跳过：逐字节对拍比的是「工作区 vs HEAD」，工作区无改动则无从比起。"
			);
		}
		return;
	}
	const adds = addedLines(base, files);
	const cls = classify(base, files, adds);
	const findings = mechanical(files, adds);

	console.log(`\n${RULE}`);
	console.log(
		`代码评审闸门　对象：${base ? `相对 ${base}` : "工作区未提交改动"}　分档：${cls.tier}`
	);
	console.log(
		`变更 ${files.length} 个文件 · 新增 ${adds.length} 行 · 类型：${cls.kinds.join(" / ")}`
	);
	for (const r of cls.reasons) {
		console.log(`  · ${r}`);
	}

	console.log(`\n── 机检 ──`);
	if (!findings.length) {
		console.log("  无硬项。");
	} else {
		for (const f of findings) {
			console.log(`  ${f.level} ${f.title}`);
			console.log(`      位置：${f.where}`);
			console.log(`      为什么是问题：${f.why}`);
		}
	}

	let gates: Gate[] = [];
	const bdCounters = { diff: 0, fault: 0 };
	if (!noRun) {
		gates = runGates(cls.tier);
		console.log(`\n── 闸门（${cls.tier}档必跑）──`);
		for (const g of gates) {
			console.log(`  ${g.pass ? "✅" : "❌"} ${g.name}　${g.tail}`);
		}
	} else {
		const names =
			cls.tier === "轻"
				? ["npm run typecheck", "node scripts/purple-star.ts selftest"]
				: ["npm run typecheck", "node scripts/purple-star.ts selftest", "npm test"];
		console.log(`\n── 闸门（未执行；去掉 --no-run 即会真的跑）──`);
		for (const n of names) {
			console.log(`  ☐ ${n}`);
		}
	}

	console.log(`\n── 工作单（判断题，工具答不了）──`);
	for (const [k, q] of JUDGE_ITEMS) {
		console.log(`  ☐ [${k}] ${q}`);
	}
	console.log(`  ☐ [分档] 本次是否属「重构（不改行为）」？是 → 必须补逐字节对拍证据`);

	const blockers = findings.filter(f => f.level === "🔴").length + bdCounters.diff;
	const failed = gates.filter(g => !g.pass).length + bdCounters.fault;
	if (byteDiff) {
		// 逐字节对拍：把改动 stash 掉取基线，跑同一批场景再逐字比对。
		// 只在「本次确属重构（声明不改行为）」时有意义 —— 行为新增本来就该变。
		console.log(`\n── 逐字节对拍 ──`);
		const bd = await runByteDiff();
		if (bd.toolFault.length) {
			// 验证手段失准 → 直接失败，绝不报成「代码变了」
			console.log(`  ❌ 验证手段失准，本次结果不可用：`);
			for (const t of bd.toolFault) {
				console.log(`      ${t}`);
			}
		} else if (bd.same.length) {
			console.log(`  ✅ ${bd.same.length} 个场景逐字节一致：${bd.same.join("、")}`);
		}
		if (bd.diff.length) {
			console.log(`  ❌ ${bd.diff.length} 个场景有差异：${bd.diff.join("、")}`);
			console.log(`      重构类变更不允许输出变化；行为新增则本项不适用。`);
		}
		if (!bd.same.length && !bd.diff.length && !bd.toolFault.length) {
			console.log("  （无场景可对拍）");
		}
		bdCounters.diff = bd.diff.length;
		bdCounters.fault = bd.toolFault.length;
	}

	console.log(`\n${RULE}`);
	const verdict =
		blockers || failed
			? `❌ ${blockers} 阻断项 / ${failed} 闸门未过 —— 不可合入`
			: `✅ 无阻断项${noRun ? "（闸门未执行）" : "，闸门全绿"} —— 可进入人工评审`;
	console.log(verdict);
	console.log(RULE);

	if (blockers || failed) {
		process.exitCode = 1;
	}
}

// ── 仅直接执行时跑 main（守卫口径同 tools/db/*.ts）──
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	try {
		await main();
	} catch (err) {
		// 只打 message，不打栈：这是一个给人看的评审工具，栈把「该怎么办」挤到屏幕外。
		// 真·编程错误也会经过这里，但它们的 message 通常已经足够定位。
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
