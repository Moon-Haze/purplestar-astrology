#!/usr/bin/env node
/**
 * @file 代码改动的机械审查、生成物漂移与基线对拍闸门。
 */
// ── 代码评审闸门：按变更类型分档 + 机检硬项 + 产出评审工作单 ──
//
// 给谁用：`docs/reviews/code-review-20261012.md` 那套标准里**机器能判**的部分。判断类
// （语义对不对、抽象边界划得对不对）永远留给人 —— 工具不假装能做。
//
// 用法（仓库根执行）：
//   npx tsx tools/review-gate.ts                # 对「工作区未提交改动」跑
//   npx tsx tools/review-gate.ts --base master  # 对某基线的差异跑（含已提交部分）
//   npx tsx tools/review-gate.ts --no-run       # 只出分档与检查单，不执行闸门命令
//   npx tsx tools/review-gate.ts -h
//
// 输出三段：
//   1. 分档 —— 从 diff 启发式判定变更类型，据此给出**必须跑的闸门**；
//   2. 机检 —— 只报「事实」，每条附文件行号，可直接跳转；
//   3. 工作单 —— 本次相关判断题列成待填清单，交评审者。
//
// ⚠️ **刻意不做的事**（都是本项目踩过的坑）：
//   1. **不重复实现引文分级判据**。`scripts/cli/selftest/guard.ts` 才是权威（正则 +
//      `grades.ts` 双向对拍）。这里只**指出新增行里哪些长得像倪师引句**，判「有没有登记」
//      交 selftest —— 复制判据就是第二真相源，下次必然漂移。
//   2. **不替代 `npm test`**。工具只解析它的输出、核对内核层计数，不重跑任何断言。
//   3. **不做风格判断**。本仓格式化口径未统一，工具管风格只会制造无关 diff。
//   4. **逐字节对拍只在「重构（不改行为）」时成立**（`--byte-diff`）。行为新增本就该变
//      输出，报差异正常 —— 分档那一问是提醒评审者别误用。
//
// 退出码：0 = 无阻断且闸门全绿；1 = 有阻断或闸门未过；2 = 参数/环境问题。

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_POSITIONAL } from "../scripts/cli/selftest/sample.ts";
import {
	MANUAL_MANAGED_PATHS,
	NOTES_MANAGED_DIRS,
	NOTES_MANAGED_METHOD_FILES,
	REGISTERED_GENERATED,
	TIANJI_MANAGED_PATHS,
} from "./db/managed-paths.ts";
import { checkLongComments } from "./code-style/long-comment-check.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/
const SKILL_ROOT = resolve(HERE, "..");
const RULE = "─".repeat(58);

// ── 内核层基线 ────────────────────────────────────────────────────────────────
// 跨阶段护栏盯**层 3**（排盘结构不变量 + 内核契约），不是总项数 —— 总数会被插件项合法
// 抬高。基线由评审流程守护；变动时**同步更新本常量**，并记入
// docs/plans/2026-10-12-extensibility-roadmap-plan.md §9。减少 = 守卫被削弱（阻断）；
// 增加 = 冻结面可能长胖（提示复核）。
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

/**
 * 生成文件：头写明「不要手改」，手改会被下次重跑静默覆盖。
 *
 * 真相源在 tools/db/managed-paths.ts（生成器与闸门共消费，评审候选 3——手抄单曾三处
 * 漂移：README 误伤 / notes 分区缺位 / wenmo-tables、tianji 缺位）。matcher 支持精确
 * 路径与目录前缀两种形态；手写文件（docs/manual/README.md）刻意不在列。
 */
const GENERATED: readonly ((path: string) => boolean)[] = [
	...MANUAL_MANAGED_PATHS.map(
		p =>
			(path: string): boolean =>
				path === p
	),
	...NOTES_MANAGED_DIRS.map(
		d =>
			(path: string): boolean =>
				path.startsWith(`notes/${d}/`)
	),
	...NOTES_MANAGED_METHOD_FILES.map(
		f =>
			(path: string): boolean =>
				path === `notes/60-方法/${f}`
	),
	...TIANJI_MANAGED_PATHS.map(
		p =>
			(path: string): boolean =>
				path === p
	),
	...REGISTERED_GENERATED.map(
		p =>
			(path: string): boolean =>
				path === p
	),
];
/** 判断路径是否属于登记在册的生成物（由生成器产出，不手改）。 */
const isGenerated = (path: string): boolean => GENERATED.some(fn => fn(path));

/** 真相源：动它们等于动全仓的一致性，评审必看。 */
const SOURCES_OF_TRUTH = [
	"scripts/analysis/data.ts", // TOPIC_DEFS / TOPIC_KEYS / STORAGE_TOPIC_KEYS
	"scripts/cli/args/table.ts", // 参数声明唯一来源
	"scripts/analysis/grades.ts", // 引文分级登记表
];

// ── git 薄封装 ────────────────────────────────────────────────────────────────
/** 一次 git 调用的结果（薄封装统一形态，失败也不抛错）。 */
interface GitOut {
	/** 退出码是否为 0（`spawnSync` 起不来时为 false） */
	ok: boolean;
	/** stdout 与 stderr 的合并文本（两者都往后接，便于一次看全） */
	out: string;
	/** 退出码；进程起不来时为 -1 */
	code: number;
}
/**
 * 薄封装 git：统一工作目录与缓冲上限，返回是否成功、输出与退出码。
 *
 * @param args - git 子命令与参数（不含 `git` 本身）
 * @returns 是否成功、合并后的 stdout+stderr、以及退出码（起不来时为 -1）
 */
function git(args: string[]): GitOut {
	const r = spawnSync("git", args, { encoding: "utf8", cwd: SKILL_ROOT, maxBuffer: 1 << 28 });
	if (r.error) {
		return { ok: false, out: String(r.error.message), code: -1 };
	}
	return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? ""), code: r.status ?? -1 };
}

/** 变更文件清单的一项（含按「看工作区」并上的未跟踪文件）。 */
interface ChangedFile {
	/** 单字母状态：A 新增 / M 修改 / D 删除 / R 重命名（未跟踪文件记作 A） */
	status: string; // A / M / D / R
	/** 相对仓库根的路径（重命名取新路径） */
	path: string;
}
/**
 * 变更文件清单：`base` 为空看工作区（含未提交与已暂存），否则看相对 `base` 的差异。
 *
 * ⚠️ **必须并上未跟踪文件**（`git diff` 看不见）。新建文件风险最高 —— 无既有行为
 * 可比对、也无测试覆盖；漏了它们评审就是假的。实测：加了未跟踪文件后「变更 1 个文件」
 * 而实际有 2 个。
 *
 * @param base - 比对基线；`null` 表示看工作区（并上未跟踪文件）
 * @returns 变更文件清单：状态字符与路径
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

/** 新增行：所在文件、新文件行号与行文本。 */
interface AddedLine {
	/** 该行所在文件（相对仓库根） */
	path: string;
	/** 新文件的 1-based 行号（由 hunk 头 `@@ … +c,d @@` 推进） */
	line: number;
	/** 该行的正文（已去掉前导 `+`） */
	text: string;
}
/**
 * 取**新增行**（逐行，带新文件行号）。`-U0` 让每个 hunk 只含真正变化的行，
 * 配合 hunk 头 `@@ -a,b +c,d @@` 还原行号。
 *
 * ⚠️ `base` 必须原样传给 git —— 漏传会让本函数比工作区与 index，`--base` 模式下恒返回空，
 * 「新增了倪师引句」这类检查**静默全绿**。这是工具最典型的假绿来源，故调用方只能经
 * `collect(base)` 一条路拿数据，不单独调用本函数。
 *
 * @param base - 比对基线（必须原样传给 git），`null` 表示对 HEAD
 * @param files - {@link changedFiles} 的清单，未跟踪文件在此按新增处理
 * @returns 逐行的新增内容，带新文件行号
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
/** 变更分档结果：等级、命中的改动类型与判定理由。 */
interface Classify {
	/** 分档：严（冻结面 / 生成文件 / 依赖 / 重构）、中（碰代码 / 真相源 / 内容）、轻（纯文档） */
	tier: Tier;
	/** 命中的改动类型标签（如「冻结面」「依赖」「代码」）；都没命中时为「局部」 */
	kinds: string[];
	/** 人读理由，逐条对应 kinds 的命中依据 */
	reasons: string[];
}
/**
 * 按改动面给本次变更分档（严 / 中 / 轻）并记录理由。
 *
 * @param base - 比对基线，`null` 表示看工作区
 * @param files - 变更文件清单
 * @param adds - 新增行（用于识别依赖版本行等）
 * @returns 分档结果：等级、命中类型与理由
 */
function classify(base: string | null, files: ChangedFile[], adds: AddedLine[]): Classify {
	const kinds = new Set<string>();
	const reasons: string[] = [];
	const paths = files.map(f => f.path);
	/** 判断改动路径里是否有片段命中指定子串。 */
	const touches = (frag: string): boolean => paths.some(p => p.includes(frag));

	// 冻结面 / 真相源 / 生成文件 —— 任一命中即升到「严」
	if (paths.some(p => FROZEN_SURFACE.includes(p))) {
		kinds.add("冻结面");
		reasons.push("触及 0C 冻结面：插件只可引用，不可修改");
	}
	if (paths.some(p => isGenerated(p))) {
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
 * ⚠️ 为何收窄：`selftest` 的知识分级守卫本就**排除注释行**（`/^\s*(\/\/|\/\*|\*)/`），
 * `.md` 里提「倪师引句」只是**在讲规则**而非用引句。不排除的话，本工具会对每条讲解引文
 * 纪律的注释和文档刷无意义告警 —— 告警失准，真正该看的就被淹没（与 `grades.ts` 头注释
 * 「guard 的两条纪律」同一动机）。判据归 selftest，本函数只负责**把位置圈对**。
 *
 * @param a - 新增的一行（路径 + 文本）
 * @returns 该行是否可能进入文案数据（注释、文档、核对表一律不算）
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

/** 一条机检发现：等级、标题、位置与理由（只报事实，不下判断）。 */
interface Finding {
	/** 等级：🔴 阻断（必须处理）、🟡 提示（要确认）、💭 建议（可留档） */
	level: "🔴" | "🟡" | "💭";
	/** 一句话结论（如「触及冻结面」「新增/改动文件含 >10 行连续注释」） */
	title: string;
	/** 位置：文件路径，或「文件:行（行数）」形式的若干处 */
	where: string;
	/** 为什么该看它：判据出处与处置方向 */
	why: string;
}
/**
 * 机械检查：对冻结面、真相源、生成物与文档登记做可直接判定的核对。
 *
 * @param files - 变更文件清单
 * @param adds - 新增行
 * @returns 机检发现清单（等级 / 标题 / 位置 / 理由）
 */
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
		if (!isGenerated(f.path)) {
			continue;
		}
		if (f.status === "M") {
			out.push({
				level: "🔴",
				title: "改了已入库的生成文件",
				where: f.path,
				why: "由 npm run manual:export / npm run notes:export 产出，直接改会被下次重导静默覆盖。改生成器或数据源。",
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

	// 长注释：code-style spec 硬条款（连续 >10 行外置 docs/code/），这里只报位置与行数，
	// 阈值与排除口径的登记处在该 spec。存量已一次性清零，新增/改动文件必须守；
	// 级别 🔴 —— 报而不拦等于没守（proposal 的验证义务）。
	const longComments = checkLongComments(files.filter(f => f.status !== "D").map(f => f.path));
	if (longComments.length) {
		out.push({
			level: "🔴",
			title: "新增/改动文件含 >10 行连续注释",
			where: longComments
				.slice(0, 5)
				.map(h => `${h.file}:${h.line}（${h.lines} 行）`)
				.join("  "),
			why: "code-style spec：连续注释 >10 行 SHALL 外置 docs/code/<topic>.md，源码留单行引用（头块/JSDoc/test/ 除外）。",
		});
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
/**
 * 判断路径列表里是否有条目落在指定目录前缀下。
 *
 * @param paths - 改动路径清单
 * @param frag - 目录前缀（如 `scripts/cli/`）
 * @returns 是否有路径落在该前缀下
 */
function touchesDir(paths: string[], frag: string): boolean {
	return paths.some(p => p.startsWith(frag));
}

// ══════════════════════════════════════════════════════════════════════
// 逐字节对拍 —— 重构类变更硬证据。三条实测教训（快照落点 / 校验 / stash 还原）：
// 详见 docs/code/review-gate.md
// ══════════════════════════════════════════════════════════════════════

/** 快照目录（仓库内；已进 .gitignore，故不会被 stash 卷进去、也不会被误提交）。 */
const SNAP_DIR = resolve(SKILL_ROOT, ".review-tmp");

/** 样例盘（虚构数据，与 help 的示例同款）—— argv 单点在 cli/selftest/sample.ts。 */
const SAMPLE_BIRTH: readonly string[] = DEMO_POSITIONAL;

/** 逐字节对拍的一个场景：名字（作快照文件名）与 CLI argv。 */
interface Scenario {
	/** 场景名（如「chart --json」「topic career」），同时作快照文件名 */
	name: string;
	/** 传给 scripts/purple-star.ts 的参数（排盘场景另由 snapshot 追加 --no-cache） */
	args: readonly string[];
}

/**
 * 对拍场景。主题清单**由注册表派生**（`analysis/data.ts` 零 import，取它无开销），
 * 加主题时本表自动跟上 —— 与 tools/cli-samples.ts 手维护清单相反：这里漏一个主题 = 少覆盖，
 * 手维护清单必然腐烂。
 *
 * @returns 对拍场景清单：固定三项 + 按主题注册表派生的 topic 场景
 */
async function buildScenarios(): Promise<Scenario[]> {
	const { TOPIC_KEYS } = (await import("../scripts/analysis/data")) as {
		TOPIC_KEYS: readonly string[];
	};
	/** 组一份 astrology 场景的 argv，公共出生串在最前。 */
	const A = (extra: readonly string[]): string[] => ["astrology", ...SAMPLE_BIRTH, ...extra];
	return [
		{ name: "chart --json", args: A(["--json"]) },
		{ name: "astrology --report", args: A(["--report"]) },
		{ name: "astrology 默认概览", args: A([]) },
		...TOPIC_KEYS.map(t => ({ name: `topic ${t}`, args: A(["--topic", t]) })),
	];
}

/**
 * 跑一批场景并把 stdout 落盘。返回「快照是否可信」——不可信时绝不进入比对。
 *
 * @param tag - 快照子目录名（`before` / `after`）
 * @param scenarios - 要跑的场景清单
 * @returns 场景名 → 快照文件路径
 * @throws 任一场景退出码非零（快照不可信，直接中止）
 */
function snapshot(tag: string, scenarios: readonly Scenario[]): Map<string, string> {
	const dir = resolve(SNAP_DIR, tag);
	mkdirSync(dir, { recursive: true });
	const out = new Map<string, string>();
	for (const s of scenarios) {
		// 直排豁免：byte-diff 是「重构不改行为」的验收证据，快照与当次两侧都必须绕过缓存
		// —— 否则忘递增 CACHE_VERSION 的漂移在这里假绿。旁路走显式旗标（排盘命令 argv 携带
		// --no-cache；synastry / knowledge 不排盘不带），环境变量注入通道已删除。
		const argv = [...s.args, ...(s.args[0] === "astrology" ? ["--no-cache"] : [])];
		const r = spawnSync(process.execPath, ["scripts/purple-star.ts", ...argv], {
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
 * ⚠️ 为堵「验证手段失准」：快照缺失/为空时 `cmp` 只返回「不同」，于是**工具失灵**被读成
 * **代码变了**。宁可直接失败，也不能给出相反结论。
 *
 * @param p - 快照文件路径
 * @returns 读取成功时带 `text`，失败时带 `why`（缺失 / 为空 / 读失败）
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

/** 逐字节对拍结果：一致 / 不同 / 工具自身故障（故障时整份结果作废）。 */
interface ByteDiffResult {
	/** 改动前后 stdout 逐字节一致的场景名 */
	same: string[];
	/** 改动前后 stdout 有差异的场景名（重构类变更应当为空） */
	diff: string[];
	/** 工具自身故障说明（快照失败、stash 失败、还原不一致等）；非空时结果一律作废 */
	toolFault: string[];
}

/**
 * 按内置场景跑改动前后的逐字节对拍，并核对 stash 还原是否干净。
 *
 * @returns 逐字节对拍结果：一致 / 不同场景清单，以及工具自身故障说明
 */
async function runByteDiff(): Promise<ByteDiffResult> {
	const scenarios = await buildScenarios();
	// 对拍前的**工作区指纹**（不是快照）—— 用来核对 stash pop 是否真的还原回去了
	const wsBefore = git(["status", "--porcelain"]).out;

	// 快照清理由 finally 统一保证。散在成功路径上没问题，但两个早退（stash 失败 /
	// 还原不一致）会跳过它 —— 那恰恰是**最需要人看现场**时，留一堆快照会让人误判。
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
/** 一条闸门命令的执行结果。 */
interface Gate {
	/** 闸门名（报告里逐行展示，如 typecheck / selftest / npm test / manual:check） */
	name: string;
	/** 实际执行的命令字符串（经 shell 跑） */
	cmd: string;
	/** 是否通过：主体看退出码，`npm test` 另需从中解析内核层计数（解析不出即判不通过） */
	pass: boolean;
	/** 输出摘要：滤掉 npm 自身 notice 行后取末两行、截到 200 字；静默通过时自报一句防误读 */
	tail: string;
}

/**
 * 「通过但无输出」时各闸门该自报什么。
 *
 * 为何要这张表：`typecheck` 成功时**一个字都不打**。空着让人分不清「通过了」与
 * 「压根没跑」—— 两者后果完全相反。计数类事实自报是本仓纪律（AGENTS.md
 * 「计数类事实一律不写死」）。
 */
const GATE_QUIET_PASS: Record<string, string> = {
	typecheck: "0 错误（静默通过）",
};
/**
 * 按分档组装要执行的闸门命令清单。
 *
 * @param tier - 分档（「轻」档不跑全量回归与生成物漂移探针）
 * @returns 按分档组装好的闸门命令清单（跑完就地回填 pass 与末两行输出）
 */
function runGates(tier: Tier): Gate[] {
	const gates: Gate[] = [
		{ name: "typecheck", cmd: "npm run typecheck", pass: true, tail: "" },
		{ name: "selftest", cmd: "node scripts/purple-star.ts selftest", pass: true, tail: "" },
	];
	// 「轻」档不必重跑全量回归 —— 但若动了 .ts 类型面，typecheck 已在必跑里
	if (tier !== "轻") {
		gates.push({ name: "npm test", cmd: "npm test", pass: true, tail: "" });
		// 生成物漂移探针（manual-drift-guard tasks 2.3）：内核表或导出工具改了而
		// docs/manual 未重导 → 非零退出（差异文件 + 样例行）；
		// 环境不可用（无库无 dataset / DuckDB 残缺）时探针自身 ⏭ 可见跳过且零退出。
		// 全量重导对拍实测约 5 分钟，故不进「轻」档、也不进 npm test 日常回归。
		gates.push({ name: "manual:check", cmd: "npm run manual:check", pass: true, tail: "" });
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

/**
 * 打印命令行用法与退出码约定。
 *
 * @returns 无返回值；用法与退出码约定已打印到 stdout
 */
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

/**
 * 评审闸门入口：解析参数、收集改动、分档并执行闸门。
 *
 * @returns 无返回值；有阻断或闸门未过时以退出码 1 结束，参数/环境问题为 2
 */
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
