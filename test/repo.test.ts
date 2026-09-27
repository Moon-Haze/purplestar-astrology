// ── 层 6：仓库自洽（元测试）──
//
// 前五层测的是**排盘行为**：给定出生信息，排出的盘对不对。本层测的是**仓库自身的状态**：
// 代码与随它一起演化的文档、登记表是否还对得上。这类事实没有「行为」可断言，漂移了也不
// 会有任何东西报错 —— 只能靠专门的守卫盯。本层三组：
//
//   一、引文守卫（scripts/ziwei/citation-guard.ts）
//   二、登记一致性（test/ 下的测试文件 ↔ test/README.md 的层表 ↔ lib/run.ts 的 LAYERS）
//   三、解析钩子的候选序（scripts/boot-hooks.ts 的 `.` 与 `@/` 两条分支）
//
// ## 为什么引文守卫要在这里再测一遍
//
// 守卫的失效方式不是「报错」，而是**什么都没扫到却一片绿**：目录写歪、递归写坏、核对表
// 没被排除（它自己的内容自我命中，真违例被淹没在噪声里）。这些都不会让任何东西变红。
//
// 这种失效只有喂给守卫一棵**构造的目录树**才看得见 —— 而 `cli/selftest.ts` 里的同名
// 断言跑在**真实**源码树上，那里造不出违例文件（不能往自己源码里写一句未核实引文），
// 只能验证「结果是零违例」。零违例既可能是守卫生效，也可能是守卫根本没在工作。
// 本文件补上后者，也是把扫描逻辑从 selftest 抽出来的**全部理由**。
//
// ## 为什么登记一致性也要测
//
// 计数类事实（层数、项数、断言数）一律不写死在文档里，理由见 `.claude/CLAUDE.md` 的
// 「SKILL.md 与 CLI 的耦合」一节。但**层表是内容不是计数**：新增一个测试文件，就该在
// README 里有一行、在 LAYERS 里有一条。README 是文档不是构建产物，派不出单一来源，
// 所以只能双向断言。
//
// ⚠️ 两侧各自盯得住的失效不同，不可互相替代：`lib/run.ts` 的对账告警（分层合计 ≠
// node:test 官方总计）**只打印一行、不影响退出码**，`npm test` 照旧绿；本层把它变成红。
//
// ⚠️ 本文件只写 mkdtemp 造的临时树，对本仓只读不写（读 README 与 run.ts 的源码文本）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ResolveHookSync } from "node:module";

import { load } from "./lib/loader.ts";
// ⚠️ 带 `.ts` 扩展名，理由同 lib/loader.ts 的同一行：boot-hooks.ts 只依赖 `node:` 内置，
//    故可在解析钩子注册之前被 Node 的原生类型擦除加载。
import { makeResolveHook } from "../scripts/boot-hooks.ts";

/** skill 根 —— 本文件在 `<skill 根>/test/` 下，故退一级。 */
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** `test/` 下的测试文件名（已排序）。登记一致性的两侧都拿它当基准。 */
function testFiles(): string[] {
	return readdirSync(resolve(SKILL_ROOT, "test"))
		.filter(f => f.endsWith(".test.ts"))
		.sort();
}

const { scanCitations } = await load<typeof import("@/ziwei/citation-guard")>(
	"@/ziwei/citation-guard"
);
const { ANNOTATIONS } = await load<typeof import("@/ziwei/annotations")>("@/ziwei/annotations");

/**
 * 从核对表里现取一条未核实引文的核心，用作违例样本。
 *
 * @remarks
 * 刻意不硬编码：核对表里的条目会被增删，写死的样本迟早指向一条已被改归属的引文，
 * 那时「违例抓得到」的用例会变成假红 —— 而它的失败信息会指向守卫，不是指向样本本身。
 *
 * ⚠️ 必须**筛出带引号的那类**条目：核对表的 `text` 是整句引用（如
 * `倪海夏说「紫微在迁移，外地逢贵人」`），但并非每条都带引号 —— 实测第一条 suspect 是
 * 「紫微斗数分析数据库 v2 — 倪海夏三合派体系」这样的**标题句**，直接取 `[0]` 会得到空样本，
 * 而空样本会让「违例抓得到」退化成「什么都没抓到也是对的」。
 */
const QUOTE =
	ANNOTATIONS.filter(e => e.status === "suspect" || e.status === "fabricated")
		.map(e => e.text.match(/[「"『]([^」"』]{4,})[」"』]/)?.[1])
		.find(q => q !== undefined) ?? "";

/** 以倪师名义带出某段引文的伪造源码行。 */
const fakeCitation = (quote: string): string => `// 倪海夏说：「${quote}」\n`;

/** 造一棵假内核根，返回其路径；调用方负责在 finally 里 `rmSync` 掉。 */
function makeTree(files: Record<string, string>): string {
	const root = mkdtempSync(resolve(tmpdir(), "ziwei-citation-"));
	for (const [rel, content] of Object.entries(files)) {
		const p = resolve(root, rel);
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, content, "utf8");
	}
	return root;
}

/** 在临时树上跑守卫，跑完即删。 */
function scanTree(files: Record<string, string>) {
	const root = makeTree(files);
	try {
		return scanCitations(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

/**
 * 直接跑一次解析钩子，返回它**依次交给 `nextResolve` 的说明符**。
 *
 * @param specifier - 待解析的说明符（`./sub`、`@/sub`、`./data.json` …）
 * @param files - 临时树的文件表，作用同 {@link makeTree}
 * @returns 钩子在解析过程中依次尝试的说明符，顺序即候选序
 *
 * @remarks
 * 刻意用**桩** `nextResolve`，而不是真的 `registerHooks`：后者是**进程级且无法撤销**的，
 * 在测试中途注册会渗到本文件之后的用例上，把一条局部断言变成全局副作用。
 *
 * 桩的行为与 Node 一致 —— 说明符相对 `parentURL` 解析，文件不存在即抛错，
 * 于是钩子的 try/catch 兜底链被真实地走一遍，而不是只断言源码里有某段正则。
 * 这正是不把这条断言放进 `cli/selftest.ts` 的原因：那里是同步函数，`await import()` 放不下。
 */
function resolveAttempts(specifier: string, files: Record<string, string>): string[] {
	const root = makeTree(files);
	try {
		const parentURL = pathToFileURL(resolve(root, "anchor.ts")).href;
		const context: Parameters<ResolveHookSync>[1] = {
			parentURL,
			conditions: [],
			importAttributes: {},
		};
		const attempts: string[] = [];
		const nextResolve: Parameters<ResolveHookSync>[2] = (spec, ctx) => {
			attempts.push(spec);
			const url = new URL(spec, ctx?.parentURL ?? parentURL);
			if (!existsSync(fileURLToPath(url))) {
				throw new Error(`Cannot find module '${spec}'`);
			}
			return { url: url.href, shortCircuit: true };
		};
		makeResolveHook(root)(specifier, context, nextResolve);
		return attempts;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

describe("仓库自洽（引文守卫 / 登记一致性）", () => {
	it("核对表里确有可用的未核实引文样本 —— 否则黑名单为空，本守卫恒判零违例", () => {
		// 黑名单 = suspect / fabricated 条目里**引号内的核心**。它为空时，守卫对任何源码都报
		// 「零违例」—— 那不是通过，是没在工作。若某天这些条目真被清空（引文全部改归属），
		// 这条会红，那时的正确处理是**删掉守卫**（连同 selftest 里的同名断言），而不是放宽它。
		assert.ok(
			QUOTE,
			"核对表里已取不到带引号的 suspect / fabricated 引文 —— 黑名单为空，引文守卫无事可做"
		);
	});

	it("违例藏在两级子目录里也抓得到（扫描范围是推导的，不是硬编码目录）", () => {
		const r = scanTree({
			"ziwei/a.ts": "export const x = 1;\n",
			"ziwei/deep/nested/b.ts": fakeCitation(QUOTE),
		});
		assert.deepEqual(r.violations, [QUOTE.slice(0, 40)]);
		// 排序后核对：收集顺序依 readdirSync，不该被依赖
		assert.deepEqual(r.checked, ["ziwei/a.ts", "ziwei/deep/nested/b.ts"]);
		assert.deepEqual(r.skipped, []);
	});

	it("排除核对表按语义而非文件名：换了名字仍被跳过", () => {
		// 文件名**不叫** annotations.ts，但导出了 ANNOTATIONS —— 它仍是核对表，仍应跳过。
		// 这条盯着的是「排除逻辑会不会因为一次改名而失效」，那正是硬编码清单的老毛病。
		const r = scanTree({
			"ziwei/checklist.ts": `export const ANNOTATIONS = [];\n${fakeCitation(QUOTE)}`,
			"ziwei/other.ts": "export const y = 2;\n",
		});
		assert.deepEqual(r.violations, [], "核对表自身的内容被当成了违例 —— 排除规则失效");
		assert.deepEqual(r.skipped, ["ziwei/checklist.ts"]);
		assert.deepEqual(r.checked, ["ziwei/other.ts"]);
	});

	it("核对表没被排除时，其自身内容确实会自我命中（故排除是必需的，不是保险）", () => {
		// 反向验证：同样一段引文，放在一个**不导出 ANNOTATIONS** 的文件里就会被抓。
		// 两相对照才说明 isChecklistSource 真的在起作用，而不是「恰好没匹配上」。
		const r = scanTree({
			"ziwei/looks-like-checklist.ts": `// 只是长得像核对表，没有导出 ANNOTATIONS\n${fakeCitation(QUOTE)}`,
		});
		assert.deepEqual(r.violations, [QUOTE.slice(0, 40)]);
		assert.deepEqual(r.skipped, []);
	});

	it("空目录得到零违例 —— 故调用方必须另外检查 checked / skipped 是否为空", () => {
		// 这是「假绿」的指纹：守卫对一棵空树无话可说，而它的返回值与「全部核对通过」
		// 长得一模一样。cli/selftest.ts 与 test/citation-guard.test.ts 的调用点都据此设防。
		const r = scanTree({});
		assert.deepEqual(r.violations, []);
		assert.deepEqual(r.checked, []);
		assert.deepEqual(r.skipped, []);
	});

	it("非 .ts 文件与 node_modules / 点目录不进扫描范围", () => {
		const r = scanTree({
			"ziwei/a.ts": "export const x = 1;\n",
			"ziwei/notes.md": fakeCitation(QUOTE),
			"ziwei/node_modules/dep/index.ts": fakeCitation(QUOTE),
			"ziwei/.cache/gen.ts": fakeCitation(QUOTE),
		});
		assert.deepEqual(r.violations, [], "扫描卷进了不该扫的目录或非 .ts 文件");
		assert.deepEqual(r.checked, ["ziwei/a.ts"]);
	});

	// ── 登记一致性：test/ 的文件系统 ↔ test/README.md 的层表 ↔ lib/run.ts 的 LAYERS ──

	it("test/ 下的每个测试文件都在 README 的层表里 —— 新增文件要补一行", () => {
		const readme = readFileSync(resolve(SKILL_ROOT, "test/README.md"), "utf8");
		const missing = testFiles().filter(f => !readme.includes(f));
		assert.deepEqual(missing, [], `test/README.md 的层表漏登记：${missing.join("、")}`);
	});

	it("README 提到的测试文件都真实存在 —— 改名或删除后要同步", () => {
		// 反向的一条：正向只抓「文件没进文档」，抓不到「文档写着已消失的文件」。
		// 两者都是同一个失效的两面 —— 文档与文件系统脱钩。
		const readme = readFileSync(resolve(SKILL_ROOT, "test/README.md"), "utf8");
		const files = testFiles();
		const mentioned = [...new Set([...readme.matchAll(/[a-z-]+\.test\.ts/g)].map(m => m[0]))].sort();
		assert.deepEqual(
			mentioned.filter(f => !files.includes(f)),
			[],
			"test/README.md 提到了不存在的测试文件"
		);
	});

	it("lib/run.ts 的 LAYERS 登记了每个测试文件 —— 否则汇总只报警、不报错", () => {
		// run.ts 自己有一条对账（分层合计 ≠ node:test 官方总计 → 打印一行告警），
		// 但**告警不影响退出码**：漏登记时 npm test 照旧绿，只有翻日志才看得见。
		const src = readFileSync(resolve(SKILL_ROOT, "test/lib/run.ts"), "utf8");
		const missing = testFiles().filter(f => !src.includes(`"${f}"`));
		assert.deepEqual(missing, [], `lib/run.ts 的 LAYERS 漏登记：${missing.join("、")}`);
	});
});

// ── 三、解析钩子的候选序 ──
//
// 内核里出现**文件夹模块**（`ziwei/patterns/`、`classics/`）之后，`./patterns` 这类说明符
// 就有两种合法落点：`patterns.ts` 与 `patterns/index.ts` —— 同名文件与目录**并存时**才是
// 真的二选一（把 `patterns.ts` 拆成 `patterns/` 的那个当口正是如此，故删除必须原子完成）。
// 两条分支必须给出**同一条候选序**，否则会出现「类型绿、运行崩」——
//
//   - `moduleResolution: "bundler"` 会把 `./patterns` 解析到 `patterns/index.ts`，故 tsc 全绿；
//   - 而运行时只有 `@/` 分支有 `/index.ts` 兜底，`./patterns` 直接 ERR_UNSUPPORTED_DIR_IMPORT。
//
// 这类分叉不会让 `npm run typecheck` 变红，只在真跑时炸，故必须由本组钉死。
describe("解析钩子候选序（boot-hooks）", () => {
	it("`.` 分支：文件夹模块兜底到 `<spec>/index.ts`", () => {
		assert.deepEqual(resolveAttempts("./sub", { "sub/index.ts": "export const v = 1;\n" }), [
			"./sub.ts",
			"./sub/index.ts",
		]);
	});

	it("`.` 分支：同名 `.ts` 文件优先于目录 —— 候选序颠倒会改变既有引用的解析目标", () => {
		// 反向的一条。若把 `/index.ts` 提到 `.ts` 之前，`./foo` 会在 `foo.ts` 与 `foo/index.ts`
		// 并存时静默改判到后者 —— 而本仓此刻正有这种并存期（拆分时旧文件与新目录短暂共存）。
		assert.deepEqual(
			resolveAttempts("./sub", {
				"sub.ts": "export const v = 1;\n",
				"sub/index.ts": "export const v = 2;\n",
			}),
			["./sub.ts"]
		);
	});

	it("`.` 与 `@/` 两条分支对同一个文件夹模块给出一致的落点", () => {
		const tree = { "sub/index.ts": "export const v = 1;\n" };
		const rel = resolveAttempts("./sub", tree);
		const aliased = resolveAttempts("@/sub", tree);
		assert.equal(rel.at(-1), "./sub/index.ts");
		assert.ok(
			aliased.at(-1)?.replace(/^file:\/\//, "").endsWith("/sub/index.ts"),
			`@/ 分支没落到 sub/index.ts，实际：${aliased.at(-1)}`
		);
	});

	it("已有 `.ts` 扩展名的说明符不被改写 —— 不凭空多出候选", () => {
		assert.deepEqual(resolveAttempts("./sub.ts", { "sub.ts": "export const v = 1;\n" }), [
			"./sub.ts",
		]);
	});

	it("非 TS 目标只多两次失败的尝试，最终仍落到字面路径（`./data.json` 行为不变）", () => {
		// 这是「补兜底有没有副作用」的答案：`tools/db/db.ts` 那类按字面相对路径引 `analysis-data`
		// 的调用点，解析目标一字不改，只是路上多两次 existsSync。
		assert.deepEqual(resolveAttempts("./data.json", { "data.json": "{}\n" }), [
			"./data.json.ts",
			"./data.json/index.ts",
			"./data.json",
		]);
	});
});
