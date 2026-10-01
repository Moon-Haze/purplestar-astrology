// ── 层 6：仓库自洽（元测试）──
//
// 前五层测的是**排盘行为**：给定出生信息，排出的盘对不对。本层测的是**仓库自身的状态**：
// 代码与随它一起演化的文档、登记表是否还对得上。这类事实没有「行为」可断言，漂移了也不
// 会有任何东西报错 —— 只能靠专门的守卫盯。本层的分组：
//
//   一、登记一致性（test/ 下的测试文件 ↔ test/README.md 的层表 ↔ lib/run.ts 的 LAYERS）
//   二、skill 自包含（SKILL.md / package.json / CLI 入口齐备、type: module、底座哨兵）
//   三、骨架接线（SKILL.md ↔ references/ 双向一致）
//   四、解析钩子的候选序（boot-hooks.ts 的 `.` 与 `@/` 两条分支）
//
// ⚠️ **引文守卫不在这里**，它住在 [citations.test.ts](citations.test.ts)（2026-09-27 移出）。
// 从前它分散在三处：排盘解读 skill 的 `selftest` 扫自己的内核树、合盘 skill 的 `selftest`
// 扫自己的断语库（各存一份守卫副本），本文件再补一组「喂构造树」的元测试。收拢之后
// **一处扫全仓**，两个盲区（源扫不到合盘、合盘扫不到源）一并消失。
//
// ⚠️ **skill 之间的派生关系已不存在**（2026-09-27）。此前 `purplestar-classics` 与
// `purplestar-synastry` 是排盘解读的派生 skill：内核切片与源**逐字节相同**，由
// `tools/skills.ts` 声明、`npm run sync:skills` 执行、本文件的一批断言守卫。断开之后
// 每个 skill 都是普通 skill —— 文件就是它自己的实现，读代码的人不必先问「这是源还是副本」。
// 随之删掉的是：逐字节副本、切片闭包与残留、「两份 cli/args.ts 相同」、旗标作用域四条
// 双向一致（连同 `tools/` 下那两个文件与 `sync:skills` 这个 npm script）。
//
// ⚠️ **保留下来的是与派生关系无关的两组**，删了就丢了真守卫：
//   · skill 自包含与 `type: module` —— 保证每个 skill 仍可单独拷进 `~/.claude/skills/` 直接跑；
//   · 解析钩子候选序 —— 它测的是**源**的 `boot-hooks.ts`，而源仍用 `@/` 别名与省略扩展名，
//     本次改动没碰它。
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
// ⚠️ 本文件只写 mkdtemp 造的临时树，对本仓只读不写（读 README、run.ts 与各 SKILL.md 的源码文本）。
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

import { ALL_SKILLS, CHART_LIKE, SOURCE_SKILL, skillDir } from "./lib/skills.ts";
// ⚠️ 字面相对路径，带 `.ts` 扩展名，理由同 lib/loader.ts 的同一行：boot-hooks.ts 只依赖
//    `node:` 内置，故可在解析钩子注册之前被 Node 的原生类型擦除加载。
// ⚠️ 内核在仓库根 scripts/（2026-09-30 上提），挪内核时本行会静默失效。
import { makeResolveHook } from "../scripts/boot-hooks.ts";

/** 仓库根 —— 本文件在 `<仓库根>/test/` 下，故退一级。 */
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** `test/` 下的测试文件名（已排序）。登记一致性的两侧都拿它当基准。 */
function testFiles(): string[] {
	return readdirSync(resolve(SKILL_ROOT, "test"))
		.filter(f => f.endsWith(".test.ts"))
		.sort();
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

/** 造一棵假内核根，返回其路径；调用方负责在 finally 里 `rmSync` 掉。 */
function makeTree(files: Record<string, string>): string {
	const root = mkdtempSync(resolve(tmpdir(), "ziwei-resolve-"));
	for (const [rel, content] of Object.entries(files)) {
		const p = resolve(root, rel);
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, content, "utf8");
	}
	return root;
}

describe("仓库自洽（登记一致性 / skill 自包含 / 骨架接线）", () => {
	// ── 一、登记一致性：test/ 的文件系统 ↔ test/README.md 的层表 ↔ lib/run.ts 的 LAYERS ──

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

	// ── 二、skill 自包含 ──
	//
	// 这组与「源 → 派生」那套机制无关（那套已于 2026-09-27 退休）：它守的是本仓对用户的
	// **承诺** —— `skills/` 下每个子目录都能单独拷进 `~/.claude/skills/` 直接使用。
	// 判据因此不看任何清单，只看磁盘：目录下有 SKILL.md 就算一个 skill（见 lib/skills.ts）。

	it("清单与磁盘对得上：源在 ALL_SKILLS 里，CHART_LIKE 的每项也在", () => {
		// ALL_SKILLS 从磁盘推导，CHART_LIKE 手写 —— 后者是本组唯一会与磁盘脱钩的输入。
		// 脱钩的症状是**静默的**：那份名单里写错一个名字，底座哨兵检查就会少查一个 skill，
		// 而它照旧全绿。故这里把两个方向都钉住。
		assert.ok(
			ALL_SKILLS.includes(SOURCE_SKILL),
			`${SOURCE_SKILL} 不在 ALL_SKILLS 里（缺 SKILL.md？）—— 下面的断言会大面积失效`
		);
		const unknown = CHART_LIKE.filter(n => !ALL_SKILLS.includes(n));
		assert.deepEqual(
			unknown,
			[],
			`CHART_LIKE 里的以下名字不是本仓的 skill（改名了？还是拼错？）：\n${unknown.join("\n")}`
		);
	});

	it("每个 skill 都是自包含的：SKILL.md / package.json / CLI 入口齐备", () => {
		// 缺 SKILL.md → 拷到 `~/.claude/skills/` 下根本不会被触发（skill 的入口就是它）；
		// 缺 package.json → `npm install` 无依据，装到别人机器上跑不起来。
		const missing: string[] = [];
		for (const name of ALL_SKILLS) {
			for (const f of ["SKILL.md", "package.json", "scripts/purple-star.ts"]) {
				if (!existsSync(resolve(skillDir(name), f))) missing.push(`${name}: ${f}`);
			}
		}
		assert.deepEqual(missing, [], `skill 目录不完整：\n${missing.join("\n")}`);
	});

	it("每个 skill 的 package.json 都声明 type: module —— 少了它 .ts 会按 CJS 解析", () => {
		// 这是本仓一个**静默崩溃点**：Node 判定 `.ts` 的模块系统，看的是**最近的** package.json
		// 的 type 字段。在 skill 目录下新建 package.json 而漏了这一行，会让该 skill 下所有
		// `import` 语法当场报错 —— 而根 package.json 里明明写着 type: module，症状看起来像是
		// 「根配置被忽略了」，排查方向会被整个带偏（源 skill 的 package.json 正是拆分时新建的）。
		//
		// ⚠️ 2026-09-27 后这条**更重要了**：从前派生 skill 的 `.ts` 靠解析钩子加载，钩子与
		// type 字段无关；现在两个派生 skill 改走 Node 原生类型擦除，type 一错当场崩。
		const bad: string[] = [];
		for (const name of ALL_SKILLS) {
			const p = resolve(skillDir(name), "package.json");
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
		// 体系硬约束 / 已知事实），它们**不能**逐字节相同 —— 合盘的旗标带 `--a-` / `--b-` 前缀，
		// 正文里还多了一段「漏前缀会静默排出错盘」的警告。硬套逐字节断言只会生产一条永远
		// 为假的守卫（从前派生 skill 的副本断言正是这么绕开它的，改用哨兵）。
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
		assert.ok(
			CHART_LIKE.length > 0,
			"CHART_LIKE 为空 —— 底座哨兵检查会空转（见 test/lib/skills.ts 的 CHART_LIKE）"
		);
		const missing: string[] = [];
		for (const name of CHART_LIKE) {
			const md = readFileSync(resolve(skillDir(name), "SKILL.md"), "utf8");
			for (const [probe, what] of SENTINELS) {
				if (!md.includes(probe)) missing.push(`${name}: 缺「${probe}」（${what}）`);
			}
		}
		assert.deepEqual(
			missing,
			[],
			`以下 SKILL.md 疑似整节漏抄（哨兵句是各节的探针，见本断言的注释）：\n${missing.join("\n")}`
		);
	});

	// ── 三、骨架接线 ──

	it("SKILL.md 与 references/ 双向一致 —— 指路牌不能失效，也不能有孤儿", () => {
		// ## 为什么这条必须双向
		//
		// `SKILL.md` 是骨架、细则进 `references/` 按需加载 —— 这套设计成立的前提是**骨架里
		// 写了「何时读哪个文件」**。没有指路牌的 `references/` 等于不存在：文件躺在磁盘上，
		// 助手永远不知道它在那儿，那部分知识就等于没写。
		//
		// 两个方向都会静默出错，故两个方向都查：
		// - 链接指向不存在的文件 → 还算可见（助手去读时会失败），但已白费一次往返
		// - `references/` 下有文件没被链接 → **完全静默**，加文件的人以为写完了
		//
		// ⚠️ 本条守的只是「骨架与细则的**接线**」，与内容对不对无关 —— 链接过去了而内容写错了，
		// 断言一无所知，那是 review 的事。
		const problems: string[] = [];
		for (const name of ALL_SKILLS) {
			const dir = skillDir(name);
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

// ── 四、解析钩子的候选序 ──
//
// 本组测的是**源** skill 的 `boot-hooks.ts` —— 它仍用 `@/` 别名与省略扩展名的 import，
// 故仍需要那套解析钩子。两个派生 skill 已于 2026-09-27 改走 Node 原生类型擦除
// （import 写全 `.ts` 扩展名，不注册任何钩子），但**源不受影响**，本组因此原样保留。
//
// 内核里出现**文件夹模块**（`ziwei/patterns/`）之后，`./patterns` 这类说明符就有两种
// 合法落点：`patterns.ts` 与 `patterns/index.ts` —— 同名文件与目录**并存时**才是真的
// 二选一（把 `patterns.ts` 拆成 `patterns/` 的那个当口正是如此，故删除必须原子完成）。
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
