// ── 层 6：仓库自洽（元测试）──
//
// 前五层测的是**排盘行为**：给定出生信息，排出的盘对不对。本层测的是**仓库自身的状态**：
// 代码与随它一起演化的文档、登记表是否还对得上。这类事实没有「行为」可断言，漂移了也不
// 会有任何东西报错 —— 只能靠专门的守卫盯。本层的分组：
//
//   一、引文守卫（ziwei/citation-guard.ts，位于排盘解读 skill 的内核里）
//   二、登记一致性（test/ 下的测试文件 ↔ test/README.md 的层表 ↔ lib/run.ts 的 LAYERS）
//   三、解析钩子的候选序（boot-hooks.ts 的 `.` 与 `@/` 两条分支）
//   四、派生 skill 的副本一致性（切片清单 ↔ 各派生 skill 的实际文件）
//   五、旗标作用域（各 skill 的 cli/flag-scope.ts ↔ 各 skill 的 cli/args.ts 声明表）
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
// 计数类事实（层数、项数、断言数）一律不写死在文档里，理由见 `CLAUDE.md` 的
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
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ResolveHookSync } from "node:module";

import { load, loadFromSkill } from "./lib/loader.ts";
// ⚠️ 字面相对路径 + `.ts` 扩展名：`tools/skills.ts` 只 import `node:` 内置，故靠 Node 原生
//    类型擦除即可加载（与下一行的 boot-hooks.ts 同理）。本模块是**切片声明的唯一源** ——
//    同步器（`tools/sync-skills.ts`）与下面的副本断言都从它取清单，两边不会各存一份。
import {
	DERIVED_SKILLS,
	SKILLS_DIR,
	SOURCE_SKILL,
	actualFiles,
	isOwned,
	skillDir,
	sourcePathOf,
	syncedFiles,
} from "../tools/skills.ts";
// ⚠️ 字面相对路径，带 `.ts` 扩展名，理由同 lib/loader.ts 的同一行：boot-hooks.ts 只依赖
//    `node:` 内置，故可在解析钩子注册之前被 Node 的原生类型擦除加载。
// ⚠️ 内核已移入 skills/purplestar-astrology/scripts/（2026-09-27），挪内核时本行会静默失效。
import { makeResolveHook } from "../skills/purplestar-astrology/scripts/boot-hooks.ts";

/** 仓库根 —— 本文件在 `<仓库根>/test/` 下，故退一级。 */
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** `test/` 下的测试文件名（已排序）。登记一致性的两侧都拿它当基准。 */
function testFiles(): string[] {
	return readdirSync(resolve(SKILL_ROOT, "test"))
		.filter(f => f.endsWith(".test.ts"))
		.sort();
}

const { scanCitations } =
	await load<typeof import("@/ziwei/citation-guard")>("@/ziwei/citation-guard");
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

describe("仓库自洽（引文守卫 / 登记一致性 / 副本一致性）", () => {
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
		const mentioned = [
			...new Set([...readme.matchAll(/[a-z-]+\.test\.ts/g)].map(m => m[0])),
		].sort();
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
			aliased
				.at(-1)
				?.replace(/^file:\/\//, "")
				.endsWith("/sub/index.ts"),
			`@/ 分支没落到 sub/index.ts，实际：${aliased.at(-1)}`
		);
	});

	it("已有 `.ts` 扩展名的说明符不被改写 —— 不凭空多出候选", () => {
		assert.deepEqual(resolveAttempts("./sub.ts", { "sub.ts": "export const v = 1;\n" }), [
			"./sub.ts",
		]);
	});

	it("非 TS 目标只多两次失败的尝试，最终仍落到字面路径（`./data.json` 行为不变）", () => {
		// 这是「补兜底有没有副作用」的答案：`tools/db/db.ts` 那类按字面相对路径引 `analysis/data`
		// 的调用点，解析目标一字不改，只是路上多两次 existsSync。
		assert.deepEqual(resolveAttempts("./data.json", { "data.json": "{}\n" }), [
			"./data.json.ts",
			"./data.json/index.ts",
			"./data.json",
		]);
	});
});

// ── 四、派生 skill 的副本一致性 ──
//
// 本仓是各自包含 skill 的源：排盘解读（`purplestar-astrology`）是源，合盘与古籍检索由它
// 派生 —— 其中「与 skill 无关的整文件」与源**逐字节一致**（清单与边界见 `tools/skills.ts`
// 与 `CLAUDE.md` 的「副本边界与同步流程」）。
//
// 手工维护这种一致性必然漂移，故实际同步由 `npm run sync:skills` 执行；而**同步器本身也会
// 忘了跑** —— 本组断言就是那个提醒。这与本仓「能派生的派生、不能派生的由断言盯双向一致」
// 是同一路数：清单来自 `tools/skills.ts`（唯一源），断言据此逐字节比对，不另存一份。
//
// ⚠️ 本组只守**副本**。各 skill 手写的文件（`purple-star.ts` / `cli/commands.ts` /
// `cli/selftest.ts` / `SKILL.md` / `package.json`）不在守卫范围 —— 它们按 skill 裁开，
// 逐字节断言对它们是永远为假的守卫。那些的正确性由各自的 `selftest`（命令表 ↔ SKILL.md
// 一致）与 `test/cli.test.ts`（子进程跑每个 CLI 入口）负责。
describe("派生 skill 的副本一致性与底座哨兵", () => {
	/** 每个派生 skill 的清单项，进程内算一次（describe 回调只跑一次）。 */
	const plans = DERIVED_SKILLS.map(spec => ({ spec, wanted: syncedFiles(spec) }));

	it("清单里的文件在源里都存在 —— 声明写错会让切片静默变小", () => {
		// `importClosure` 对 `kernelEntries` 自己会抛错（入口不存在时），但 `sharedFiles`
		// 不经过闭包 —— 名字写错时只有同步器在复制那一刻才崩，报的是 ENOENT 而非「声明写错了」。
		const missing = plans.flatMap(({ spec, wanted }) =>
			wanted.filter(f => !existsSync(sourcePathOf(f))).map(f => `${spec.name}: ${f}`)
		);
		assert.deepEqual(missing, [], `切片声明指向了源里不存在的文件：\n${missing.join("\n")}`);
	});

	it("每个副本都与源逐字节相同", () => {
		const drifted = plans.flatMap(({ spec, wanted }) =>
			wanted
				.filter(f => {
					const to = resolve(skillDir(spec), "scripts", f);
					return (
						!existsSync(to) || !readFileSync(to).equals(readFileSync(sourcePathOf(f)))
					);
				})
				.map(f => `${spec.name}: ${f}`)
		);
		assert.deepEqual(
			drifted,
			[],
			`以下副本与源不一致（跑 npm run sync:skills 修复）：\n${drifted.join("\n")}`
		);
	});

	it("scripts/ 下没有清单外的 .ts 残留 —— 上面那条只看得见清单里的文件", () => {
		// 清单缩小时（某个文件不再被入口引用），上一次同步留下的副本不会被任何逐字节断言发现：
		// 断言只检查「清单里的都在且一致」，清单外的它不看。而残留的副本会**继续被解析钩子
		// 加载** —— 「已经删掉的模块」于是在派生 skill 里阴魂不散。
		const stale = plans.flatMap(({ spec, wanted }) =>
			actualFiles(spec)
				.filter(f => !wanted.includes(f) && !isOwned(spec, `scripts/${f}`))
				.map(f => `${spec.name}: ${f}`)
		);
		assert.deepEqual(
			stale,
			[],
			`以下文件既不在清单内也不是 skill 自有（跑 npm run sync:skills 清理）：\n${stale.join("\n")}`
		);
	});

	it("每个 skill 都是自包含的：SKILL.md / package.json / CLI 入口齐备", () => {
		// 缺 SKILL.md → 拷到 `~/.claude/skills/` 下根本不会被触发（skill 的入口就是它）；
		// 缺 package.json → `npm install` 无依据，装到别人机器上跑不起来。
		const missing: string[] = [];
		for (const { spec } of plans) {
			for (const f of ["SKILL.md", "package.json", "scripts/purple-star.ts"]) {
				if (!existsSync(resolve(skillDir(spec), f))) missing.push(`${spec.name}: ${f}`);
			}
		}
		assert.deepEqual(missing, [], `skill 目录不完整：\n${missing.join("\n")}`);
	});

	it("每个 skill 的 package.json 都声明 type: module —— 少了它 .ts 会按 CJS 解析", () => {
		// 这是本仓一个**静默崩溃点**：Node 判定 `.ts` 的模块系统，看的是**最近的** package.json
		// 的 type 字段。在 skill 目录下新建 package.json 而漏了这一行，会让该 skill 下所有
		// `import` 语法当场报错 —— 而根 package.json 里明明写着 type: module，症状看起来像是
		// 「根配置被忽略了」，排查方向会被整个带偏（源 skill 的 package.json 正是本次拆分新建的）。
		const bad: string[] = [];
		for (const name of [SOURCE_SKILL, ...DERIVED_SKILLS.map(s => s.name)]) {
			const p = resolve(SKILLS_DIR, name, "package.json");
			const pkg = JSON.parse(readFileSync(p, "utf8")) as { type?: string };
			if (pkg.type !== "module") bad.push(`${name}: type=${String(pkg.type)}`);
		}
		assert.deepEqual(
			bad,
			[],
			`以下 skill 的 package.json 未声明 "type": "module"：\n${bad.join("\n")}`
		);
	});

	it("排盘类 skill 的 SKILL.md 都含底座哨兵句 —— 抓的是整节漏抄", () => {
		// ## 为什么是哨兵而不是逐字节比对
		//
		// 排盘类 skill 的 `SKILL.md` 各有一份**手抄的底座**（路径约定 / 铁律 / 晚子时 /
		// 体系硬约束 / 已知事实），它们**不能**逐字节相同 —— 合盘的性别栏是 `--a-gender` /
		// `--b-gender`，出生地是 `--a-city`，正文里还多了一段「漏前缀会静默排出错盘」的警告。
		// 硬套逐字节断言只会生产一条永远为假的守卫。
		//
		// 故改用**探针**：每个关键节各取一个句子，断言它还在。抓住的是「整节漏抄」，
		// **抓不住「节内改了一处」** —— 这个强度是刻意选的：`SKILL.md` 改动低频且必过 review，
		// 而漏抄整节（写新 skill 时最常犯的错）恰恰是人工 review 最容易滑过去的。
		const SENTINELS: ReadonlyArray<[string, string]> = [
			["不要猜", "铁律：缺失输入必须追问"],
			["两张完全不同的盘", "晚子时：两种口径排出的是两张盘"],
			["宫干自化", "体系硬约束：三合派，不用飞星派工具"],
			["虚岁", "其他已知事实：年龄一律虚岁"],
		];
		// ⚠️ 先确认真有条目声明了 `chartLike`。少了这一步，下面的检查会在一份空清单上跑完
		// 并全绿 —— 一条恒真的守卫比没有守卫更坏，它会被当成保障。
		const chartLike = DERIVED_SKILLS.filter(s => s.chartLike === true);
		assert.ok(
			chartLike.length > 0,
			"没有任何派生 skill 声明 chartLike: true —— 底座哨兵检查会空转（见 tools/skills.ts 的 SkillSpec.chartLike）"
		);
		// 源 skill 也排盘，一并检查：它是这份底座的**原始出处**，整节被删同样是事故。
		const targets = [
			{ name: SOURCE_SKILL, dir: resolve(SKILLS_DIR, SOURCE_SKILL) },
			...chartLike.map(s => ({ name: s.name, dir: skillDir(s) })),
		];
		const missing: string[] = [];
		for (const t of targets) {
			const md = readFileSync(resolve(t.dir, "SKILL.md"), "utf8");
			for (const [probe, what] of SENTINELS) {
				if (!md.includes(probe)) missing.push(`${t.name}: 缺「${probe}」（${what}）`);
			}
		}
		assert.deepEqual(
			missing,
			[],
			`以下 SKILL.md 疑似整节漏抄（哨兵句是各节的探针，见本断言的注释）：\n${missing.join("\n")}`
		);
	});

	it("SKILL.md 与 references/ 双向一致 —— 指路牌不能失效，也不能有孤儿", () => {
		// ## 为什么这条必须双向
		//
		// `SKILL.md` 是骨架、细则进 `references/` 按需加载 —— 这套设计成立的前提是**骨架里
		// 写了「何时读哪个文件」**。没有指路牌的 `references/` 等于不存在：文件躺在磁盘上，
		// Claude 永远不知道它在那儿，那部分知识就等于没写。
		//
		// 两个方向都会静默出错，故两个方向都查：
		// - 链接指向不存在的文件 → 还算可见（Claude 去读时会失败），但已白费一次往返
		// - `references/` 下有文件没被链接 → **完全静默**，加文件的人以为写完了
		//
		// ⚠️ 本条守的只是「骨架与细则的**接线**」，与内容对不对无关 —— 链接过去了而内容写错了，
		// 断言一无所知，那是 review 的事。
		const problems: string[] = [];
		for (const name of [SOURCE_SKILL, ...DERIVED_SKILLS.map(s => s.name)]) {
			const dir = resolve(SKILLS_DIR, name);
			const refDir = resolve(dir, "references");
			const linked = new Set<string>();
			const md = readFileSync(resolve(dir, "SKILL.md"), "utf8");
			// 只认指向 `references/` 的相对链接。skill 之间互相转指用的是**技能名**
			// （「用 purplestar-classics 技能」）而不是路径 —— 那种跨 skill 的相对路径在装到
			// `~/.claude/skills/` 之后并不成立，本就不该写成链接。
			for (const m of md.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
				const target = m[1];
				if (!target.startsWith("references/")) continue;
				linked.add(target.slice("references/".length));
				if (!existsSync(resolve(dir, target))) {
					problems.push(`${name}: SKILL.md 链接指向不存在的 ${target}`);
				}
			}
			if (!existsSync(refDir)) continue;
			for (const entry of readdirSync(refDir).filter(n => n.endsWith(".md"))) {
				if (!linked.has(entry)) {
					problems.push(
						`${name}: references/${entry} 没有被 SKILL.md 链接（等于不存在）`
					);
				}
			}
		}
		assert.deepEqual(problems, [], `骨架与 references/ 的接线有问题：\n${problems.join("\n")}`);
	});
});

describe("旗标作用域：各 skill 的声明与共用声明表的双向一致", () => {
	// ## 为什么这几条必须双向
	//
	// 每个 skill 的 `cli/args.ts` 里都有一张全量旗标声明表（`FLAG_GROUPS`）；
	// 「本 skill 认其中哪些」则由各 skill 自写的 `cli/flag-scope.ts` 声明。两层之间的错配
	// **全部是静默的** —— 这正是本节存在的理由：
	//
	// - 作用域里写错一个名字 → 该旗标既不注册也不被认，而 `FLAG_NAMES` 是个 Set，
	//   拼错只是「少了一个成员」，没有任何东西会报错。用户敲它才被拒。
	// - 往声明表加了旗标却没人认领 → 三个 skill 全都不认它，等于加了个死参数。
	//   加旗标的人以为自己加好了。
	// - 出生信息旗标加了却忘了写进**源的**声明表 → `analyze --<新旗标>` 会被当作未知旗标
	//   **拒掉**（好过从前那样静默落回默认经度），但那是在用户面前炸，不是在 CI 里炸。
	//
	// 第四条（`ownFiles` 落地）看似与旗标无关，其实同属「声明与磁盘对不对得上」：
	// 目录形态的 `ownFiles` 项（`"scripts/classics/"`）写错一个字母，同步器会认为那个目录
	// **不受保护**，于是把里面每个文件都当残留删掉 —— 而逐字节断言只检查清单内的文件，
	// 清单一空，它也就全绿了。
	//
	// ⚠️ **2026-09-27 换解析引擎后，`cli/args.ts` 不再是与源逐字节相同的副本**：源那份仍由
	// `cac` 驱动，两个派生改用了 Node 内置的 `util.parseArgs`，两边不可能相同。于是「副本 == 源」
	// 那条逐字节守卫在这里**失效**（硬套只会生产一条永远为假的断言）。本节补回的是它原本
	// 要防的两半，各一条：声明表 `FLAG_GROUPS` 与源 deep-equal（旗标名漂移是本节最重的后果），
	// 以及两份派生副本之间逐字节相同（把「两份手工维护」压回「一份 + 一次复制」）。

	/** 声明表全集。取源那一份 —— 派生那两份与它 deep-equal，下面有断言盯着。 */
	const ALL_FLAG_NAMES = load<typeof import("@/cli/args")>("@/cli/args").then(
		m => new Set(m.ALL_FLAG_NAMES)
	);

	/** 各 skill 的作用域。源走 `@/`，派生的内核不在源里，走 `loadFromSkill`。 */
	const SCOPES: ReadonlyArray<{ skill: string; flags: Promise<ReadonlySet<string>> }> = [
		{
			skill: SOURCE_SKILL,
			flags: load<typeof import("@/cli/flag-scope")>("@/cli/flag-scope").then(
				m => new Set<string>(m.FLAG_SCOPE.flags)
			),
		},
		{
			skill: "purplestar-synastry",
			flags: loadFromSkill<
				typeof import("../skills/purplestar-synastry/scripts/cli/flag-scope")
			>("purplestar-synastry", "cli/flag-scope").then(
				m => new Set<string>(m.FLAG_SCOPE.flags)
			),
		},
		{
			skill: "purplestar-classics",
			flags: loadFromSkill<
				typeof import("../skills/purplestar-classics/scripts/cli/flag-scope")
			>("purplestar-classics", "cli/flag-scope").then(
				m => new Set<string>(m.FLAG_SCOPE.flags)
			),
		},
	];

	it("各 skill 的作用域都 ⊆ 声明表全集 —— 拼错的旗标名不会被任何东西拦下", async () => {
		const all = await ALL_FLAG_NAMES;
		const bogus: string[] = [];
		for (const s of SCOPES) {
			for (const f of await s.flags) {
				if (!all.has(f)) bogus.push(`${s.skill}: ${f}`);
			}
		}
		assert.deepEqual(
			bogus,
			[],
			`以下作用域项不在 args.ts 的 FLAG_GROUPS 里（拼错？还是忘了往声明表加？）：\n${bogus.join("\n")}`
		);
	});

	it("声明表全集 ⊆ 各作用域之并 —— 新加的旗标必须有人认领", async () => {
		const all = await ALL_FLAG_NAMES;
		const union = new Set<string>();
		for (const s of SCOPES) for (const f of await s.flags) union.add(f);
		const orphans = [...all].filter(f => !union.has(f)).sort();
		assert.deepEqual(
			orphans,
			[],
			`以下旗标在声明表里，却没有任何 skill 认领（加了等于没加），请决定它归谁：\n${orphans.join("\n")}`
		);
	});

	it("出生信息旗标必须被源全部认领 —— 它是唯一还排盘的 skill", async () => {
		// 键取自 birth-info.ts 的**源码文本**（`g("…")` 的调用点）而不是手抄一份清单：
		// 手抄的清单会与源码一起漂移，而漂移后这条断言正好失去意义。
		const KEYS = [
			...new Set(
				[
					...readFileSync(sourcePathOf("cli/birth-info.ts"), "utf8").matchAll(
						/\bg\("([^"]+)"\)/g
					),
				].map(m => m[1])
			),
		];
		// ⚠️ 先确认抽出来的样本有份量，否则正则失效时下面的循环会在空数组上跑完全绿。
		assert.ok(
			KEYS.length >= 10,
			`从 birth-info.ts 只抽到 ${KEYS.length} 个 g() 键，正则可能已失效`
		);

		const all = await ALL_FLAG_NAMES;
		// ⚠️ 2026-09-27 起**只查源这一个 skill**。这条断言原本要求「源与合盘两边都认领」，
		// 理由是「合盘也要排盘」—— 而合盘已改为消费源排好的命盘，那个理由随改造消失了。
		// 若继续要求合盘认领，只会逼它的 flag-scope 保留 15 个用不上的旗标，而那恰好复活了
		// 本次要消灭的缺口：旗标在作用域里、命令却不读，用户漏写 `a-` 前缀时静默排出错盘。
		// **排盘只有一处实现，故只有一处认领。** 古籍 skill 同理不在此列（它也不排盘）。
		const source = SCOPES.find(s => s.skill === SOURCE_SKILL);
		assert.ok(source, `SCOPES 里没有源 skill（${SOURCE_SKILL}）—— 断言会空转`);
		const missing: string[] = [];
		for (const key of KEYS) {
			// 键来自源码，说明它被 `g()` 读了却不在此表 —— 那它根本不可能被解析出来
			if (!all.has(key)) missing.push(`（不在声明表）${key}`);
			if (!(await source.flags).has(key)) missing.push(`${SOURCE_SKILL}: ${key}`);
		}
		assert.deepEqual(
			missing,
			[],
			`以下出生信息旗标没有被源的 flag-scope 认领：\n${missing.join("\n")}`
		);
	});

	it("派生的 FLAG_GROUPS 与源 deep-equal —— 声明表漂移是静默错盘的入口", async () => {
		// 声明表是「有哪些旗标」的唯一来源，而它的漂移**没有任何运行时症状**：本 skill 认的
		// 那几项照常工作，只是拼错的那个名字让旗标静默落回默认值（`--ctiy 喀什` 落回默认经度
		// 120°E，排出一张错约 3 个时辰的盘而全程无提示）。
		//
		// ⚠️ 换引擎之后，这条断言是**唯一**盯住派生声明表的东西：从前它靠「派生副本 == 源
		// 逐字节」顺带守住，而那条路径已不存在（两个引擎不同）。三份声明表必须一起改。
		const src = await load<typeof import("@/cli/args")>("@/cli/args");
		for (const spec of DERIVED_SKILLS) {
			// 两份派生 args.ts 逐字节相同（下一条断言），故取哪一份的类型都一样。
			const mod = await loadFromSkill<
				typeof import("../skills/purplestar-classics/scripts/cli/args")
			>(spec.name, "cli/args");
			assert.deepStrictEqual(
				mod.FLAG_GROUPS,
				src.FLAG_GROUPS,
				`${spec.name} 的 FLAG_GROUPS 与源不一致 —— 改声明表要三个 skill 一起改`
			);
		}
	});

	it("两份派生的 cli/args.ts 逐字节相同 —— 改哪份，以 purplestar-classics 那份为准", () => {
		// 源那份是 `cac` 版，与这两份不可能逐字节相同，故「副本 == 源」那条断言对它们不适用。
		// 而这对副本**没有任何其它守卫** —— `args.ts` 已移出 `sharedFiles`（不在同步器的
		// `wanted` 里），层 4 的逐字节断言因此不再覆盖它。
		//
		// ⚠️ 两份若内容不同，同一个旗标会在两个 skill 里有两种行为，而两边的 selftest 各测各的
		// 那一份，谁也发现不了。**以 `purplestar-classics` 那份为准**（两个派生里它的内核更简单，
		// 是 args.ts 能自洽运行的最小环境），改完拷给 `purplestar-synastry`。
		const REFERENCE = "purplestar-classics";
		const readArgs = (skill: string) =>
			readFileSync(resolve(SKILLS_DIR, skill, "scripts", "cli", "args.ts"), "utf8");
		const ref = readArgs(REFERENCE);
		const names = DERIVED_SKILLS.map(s => s.name);
		// 空转防护：基准不在派生清单里时，下面的循环会跑完却什么都没比。
		assert.ok(
			names.includes(REFERENCE),
			`基准 ${REFERENCE} 不在 DERIVED_SKILLS 里 —— 本断言会空转`
		);
		const drifted = names.filter(n => readArgs(n) !== ref);
		assert.deepEqual(
			drifted,
			[],
			`以下 skill 的 cli/args.ts 与 ${REFERENCE} 那份不同：\n${drifted.join("\n")}\n` +
				`两份必须逐字节相同 —— 改 ${REFERENCE} 那份，改完拷给另一个。`
		);
	});

	it("ownFiles 的每一项都真实存在；目录形态的必须是目录 —— 写错即失去保护", () => {
		const problems: string[] = [];
		for (const spec of DERIVED_SKILLS) {
			for (const f of spec.ownFiles) {
				const abs = resolve(skillDir(spec), f);
				if (!existsSync(abs)) {
					problems.push(`${spec.name}: ${f} 不存在`);
				} else if (f.endsWith("/") && !statSync(abs).isDirectory()) {
					problems.push(`${spec.name}: ${f} 声明为目录，实际是文件`);
				}
			}
		}
		// 同上的空转防护：清单为空时这条断言什么都没测。
		assert.ok(
			DERIVED_SKILLS.some(s => s.ownFiles.length > 0),
			"没有任何派生 skill 声明 ownFiles —— 本断言会空转"
		);
		assert.deepEqual(problems, [], `ownFiles 与磁盘不符：\n${problems.join("\n")}`);
	});
});
