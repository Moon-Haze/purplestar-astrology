/**
 * @file 仓库结构、文档登记、注释指针和分层约束的自洽测试。
 */
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
// ⚠️ **引文守卫不在这里**，它住在 [citations.test.ts](citations.test.ts)：
// 引文扫描在 test/ 里**一处扫全仓**，源与合盘的断语库都覆盖，没有各扫各的盲区。
//
// ⚠️ **skill 之间没有派生关系**：每个 skill 都是普通 skill —— 文件就是它自己的实现，
// 读代码的人不必先问「这是源还是副本」。
//
// ⚠️ **保留的两组真守卫**，删了就丢：
//   · skill 自包含与 `type: module` —— 保证每个 skill 仍可单独拷进 `~/.claude/skills/` 直接跑；
//   · 解析钩子候选序 —— 它测的是**源**的 `boot-hooks.ts`，而源仍用 `@/` 别名与省略扩展名。
//
// ## 为什么登记一致性也要测
//
// 计数类事实（层数、项数、断言数）一律不写死在文档里，理由见 `AGENTS.md` 的
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
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ResolveHookSync } from "node:module";

import { ALL_SKILLS, CHART_LIKE, SOURCE_SKILL, skillDir } from "./lib/skills.ts";
// ⚠️ 字面相对路径，带 `.ts` 扩展名，理由同 lib/loader.ts 的同一行：boot-hooks.ts 只依赖
//    `node:` 内置，故可在解析钩子注册之前被 Node 的原生类型擦除加载。
// ⚠️ 内核在仓库根 scripts/，挪内核时本行会静默失效。
import { makeResolveHook } from "../scripts/boot-hooks.ts";
// kit 是叶子模块（运行时只依赖 node: 内置，`../args` 是被擦除的类型导入），可静态引入。
import { skipUnlessRepo } from "../scripts/cli/selftest/kit.ts";

/** 仓库根 —— 本文件在 `<仓库根>/test/` 下，故退一级。 */
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `test/` 下的测试文件名（已排序）。登记一致性的两侧都拿它当基准。
 *
 * @returns 已排序的测试文件名清单
 */
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
 * 这正是不把这条断言放进 `cli/selftest/index.ts` 的原因：那里是同步函数，`await import()` 放不下。
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
		/** 桩解析钩子，用于钉死候选序分支。 */
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

/**
 * 造一棵假内核根，返回其路径；调用方负责在 finally 里 `rmSync` 掉。
 *
 * @param files - 相对路径 → 文件内容的表
 * @returns 临时内核根的绝对路径（调用方负责清理）
 */
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
		// run.ts 的对账（分层合计 ≠ node:test 官方总计）2026-11-22 起在全量回归下
		// **硬失败**（退出码非零）——本断言把它守的「文件级登记」前移到源码层。
		const src = readFileSync(resolve(SKILL_ROOT, "test/lib/run.ts"), "utf8");
		const missing = testFiles().filter(f => !src.includes(`"${f}"`));
		assert.deepEqual(missing, [], `lib/run.ts 的 LAYERS 漏登记：${missing.join("、")}`);
	});

	it("LAYERS 的 suites 与各文件顶层 describe/test 标题逐字对应（spec「suites 名字不符」兑现）", () => {
		// quality-gates「基准回归的分层与登记」：LAYERS 的 suites SHALL 与测试内的
		// describe 名逐字对应，「suites 名字不符」SHALL 断言失败不静默跳过。脱钩的
		// 现实后果是最慢榜混入聚合套件（SUITE_LAYER_NAMES 按名排除）。单向断言：
		// 登记的 suites 必须在对应文件里真实存在（describe 自由分组不要求全登记）。
		// chart.test 的顶层名是动态模板（manifest.baselineEngine）—— 源码级逐字对拍
		// 两侧同为模板字面量，天然一致。
		const runSrc = readFileSync(resolve(SKILL_ROOT, "test", "lib", "run.ts"), "utf8");
		const layerBlock = runSrc.slice(runSrc.indexOf("const LAYERS = ["));
		// 闭合只用 \]（不带 ,）——单元素数组 `["X"] }` 的 ] 后是 }，闭合含 , 会让
		// lazy 扩张吞掉后续条目（首版实测 16 条漏 4）。
		const entries = [...layerBlock.matchAll(/file: "([^"]+)",\s*suites: \[([\s\S]*?)\]/g)];
		assert.equal(entries.length, 16, `LAYERS 段抽取异常：仅 ${entries.length} 条`);
		for (const [, file, suitesSrc] of entries) {
			const suites = [...suitesSrc.matchAll(/[`"]([^`"]+)[`"]/g)].map(m => m[1]);
			assert.ok(suites.length > 0, `${file} 的 suites 抽取为空（解析形态失配）`);
			const testSrc = readFileSync(resolve(SKILL_ROOT, "test", file), "utf8");
			const titles = [...testSrc.matchAll(/^(?:describe|test)\(\s*[`"]([^`"]+)[`"]/gm)].map(
				m => m[1]
			);
			for (const s of suites) {
				assert.ok(
					titles.includes(s),
					`${file}：LAYERS.suites「${s}」在顶层 describe/test 中无对应——套件名脱钩（spec「suites 名字不符」）`
				);
			}
		}
	});

	// ── 二、skill 自包含 ──
	//
	// 这组与「源 → 派生」那套机制无关（那套已退休）：它守的是本仓对用户的
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
				if (!existsSync(resolve(skillDir(name), f))) {
					missing.push(`${name}: ${f}`);
				}
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
		// ⚠️ 这条**尤其重要**：`.ts` 若靠解析钩子加载，钩子与
		// type 字段无关；若改走 Node 原生类型擦除，type 一错当场崩。
		const bad: string[] = [];
		for (const name of ALL_SKILLS) {
			const p = resolve(skillDir(name), "package.json");
			const pkg = JSON.parse(readFileSync(p, "utf8")) as { type?: string };
			if (pkg.type !== "module") {
				bad.push(`${name}: type=${String(pkg.type)}`);
			}
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
				if (!md.includes(probe)) {
					missing.push(`${name}: 缺「${probe}」（${what}）`);
				}
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
				if (!target.startsWith("references/")) {
					continue;
				}
				linked.add(target.slice("references/".length));
				if (!existsSync(resolve(dir, target))) {
					problems.push(`${name}: SKILL.md 链接指向不存在的 ${target}`);
				}
			}
			if (!existsSync(refDir)) {
				continue;
			}
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

	it("仓库态 selftest 零跳过 —— skipUnlessRepo 锚点失效会让守卫恒真（反恒真）", () => {
		// 恒真守卫比没有守卫更坏：探针指向不存在的文件时，仓库态与分发态不可区分，
		// 依赖仓库级文档的断言静默跳过且记 pass。两层设防：
		//   轻层 —— 探针在仓库态必须放行；锚点文件被删 / 改名时这里先红。
		//   重层 —— 端到端跑一遍 selftest，报告全文不得出现 ⏭：仓库态的合法跳过不存在，
		//           新增跳过属于「白白丢覆盖」（判据见 scripts/cli/selftest/kit.ts）。
		assert.equal(
			skipUnlessRepo({ root: resolve(SKILL_ROOT, "scripts") }, "反恒真探针"),
			undefined,
			"skipUnlessRepo 在仓库态应放行 —— 探针锚点（包根 AGENTS.md）是否已被移动或删除？"
		);
		// selftest 入口自带缓存旁路（cmdSelftest 的 setCacheBypassAll），子进程无需再注入
		const r = spawnSync(
			process.execPath,
			[resolve(SKILL_ROOT, "scripts", "purple-star.ts"), "selftest"],
			{
				encoding: "utf8",
			}
		);
		assert.equal(r.status, 0, `selftest 应全绿退出，stderr：${(r.stderr ?? "").slice(0, 200)}`);
		const skippedLines = (r.stdout ?? "").split("\n").filter(l => l.includes("⏭"));
		assert.deepEqual(
			skippedLines,
			[],
			`仓库态 selftest 出现跳过项（应要么移除断言对仓库级文档的依赖，要么该断言本不该跳过）：\n${skippedLines.join("\n")}`
		);
	});

	it("退役环境变量在入口当场报错（失败可见性）", () => {
		// 外壳残留的退役变量会被 {...process.env} 静默携带——入口（purple-star / run.ts）
		// 对其当场拒收而非放行（spec：回归链路显式禁缓存「退役变量当场报错」）。
		const r = spawnSync(
			process.execPath,
			[resolve(SKILL_ROOT, "scripts", "purple-star.ts"), "selftest"],
			{
				encoding: "utf8",
				env: { ...process.env, ZIWEI_NO_CACHE: "1" },
			}
		);
		assert.equal(r.status, 2, `退役变量注入应使入口退出码为 2，实际 ${r.status}`);
		assert.match(
			r.stderr ?? "",
			/已退役环境变量.*ZIWEI_NO_CACHE/,
			"报错须点名退役变量并给移除指引"
		);
	});

	it("ADR-003 豁免边界：插件树对 cli 的引用边与白名单逐边一致（多边 / 少边 / 锚点消失均红）", () => {
		// corpus / synastry 的 selftest-asserts.ts 是 selftest 宿主的测试件，允许引用 cli 的
		// kit（静态）与命令表 / 参数面（动态 import 打断「commands → selftest → 本文件」静态环）
		// ——豁免按文件具名（spec：内核与内容严格分层「唯一豁免边界」）。本守卫把边界钉死：
		// 任何插件文件出现白名单外的 cli 引用边、白名单少边、或白名单文件被改名 / 删除都当场红，
		// 「测试件」名义不构成扩散通道（change exempt-selftest-asserts-from-layering）。
		const whitelist: Record<string, { static: string[]; dynamic: string[] }> = {
			"scripts/corpus/selftest-asserts.ts": {
				static: ["../cli/selftest/kit"],
				dynamic: ["../cli/commands", "../cli/args"],
			},
			"scripts/synastry/selftest-asserts.ts": {
				static: ["../cli/selftest/kit"],
				dynamic: ["../cli/commands", "../cli/args", "../cli/args/scope"],
			},
		};
		// 反恒真锚点：白名单文件必须真实在盘——锚点失效不得静默降级为「扫到零边即绿」。
		for (const f of Object.keys(whitelist)) {
			assert.ok(
				existsSync(resolve(SKILL_ROOT, f)),
				`豁免白名单锚点失效：${f} 不在盘上（改名 / 删除须同步本守卫）`
			);
		}
		/** 递归列出目录下的 `.ts`（相对路径）。 */
		const walk = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap(e =>
				e.isDirectory()
					? walk(resolve(dir, e.name))
					: e.name.endsWith(".ts")
						? [resolve(dir, e.name)]
						: []
			);
		const observed: string[] = [];
		for (const plugin of ["corpus", "synastry"]) {
			for (const f of walk(resolve(SKILL_ROOT, "scripts", plugin))) {
				const rel = relative(resolve(SKILL_ROOT), f);
				const text = readFileSync(f, "utf8");
				// 静态边：import/export … from "spec"；动态边：import("spec")。命中 /cli/ 即记边。
				for (const m of text.matchAll(/from\s*["']([^"']+)["']/g)) {
					if (/\/cli\//.test(m[1])) {
						observed.push(`${rel}#static#${m[1]}`);
					}
				}
				for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
					if (/\/cli\//.test(m[1])) {
						observed.push(`${rel}#dynamic#${m[1]}`);
					}
				}
			}
		}
		const expected = Object.entries(whitelist)
			.flatMap(([f, kinds]) => [
				...kinds.static.map(s => `${f}#static#${s}`),
				...kinds.dynamic.map(s => `${f}#dynamic#${s}`),
			])
			.sort();
		const extra = observed.filter(e => !expected.includes(e));
		const missing = expected.filter(e => !observed.includes(e));
		assert.deepEqual(
			observed.sort(),
			expected,
			`插件树 cli 引用边与 ADR-003 豁免白名单不一致——多出的边：${extra.join("、") || "无"}；缺失的边：${missing.join("、") || "无"}`
		);
	});
});

// ── 四、解析钩子的候选序 ──
//
// 本组测的是**源** skill 的 `boot-hooks.ts` —— 它仍用 `@/` 别名与省略扩展名的 import，
// 故仍需要那套解析钩子。派生 skill（若存在）改走 Node 原生类型擦除
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

// ── 注释指针有效性：四波改名各留一批断锚，现有闸门全查不到 ─────────────────────
// 只查「指向的文件是否存在」，不审查注释说了什么对不对（那是 review 的事）。
// 白名单逐项写明理由；下面断言盯住每项都真的被命中过，跳过不会退化成静默豁免。
const MD_POINTER_ALLOWLIST: Readonly<Record<string, string>> = {
	"docs/plans/2026-09-25-duckdb-corpus-source-design.md":
		"历史设计文档已随 docs/plans 清理删除，注释保留沿革出处，不是现行契约指针",
};

const MD_POINTER =
	/(?:^|[\s`（「『"'=])((?:[A-Za-z0-9_-]+\.md)|(?:(?:docs|references|notes|test|scripts|tools)\/)[A-Za-z0-9_./-]*\.md)/g;

/**
 * 递归列出目录下的 .ts 文件（相对仓库根）。
 *
 * @param dir - 相对仓库根的目录
 * @returns 该目录下 `.ts` 的相对路径，已排序
 */
function tsFilesUnder(dir: string): string[] {
	const out: string[] = [];
	/** 递归收集 `.ts` 的相对路径。 */
	const walk = (abs: string): void => {
		for (const entry of readdirSync(abs, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) {
				continue;
			}
			const p = resolve(abs, entry.name);
			if (entry.isDirectory()) {
				walk(p);
			} else if (entry.name.endsWith(".ts")) {
				out.push(p.slice(SKILL_ROOT.length + 1));
			}
		}
	};
	walk(resolve(SKILL_ROOT, dir));
	return out.sort();
}

/**
 * 逐行取出注释文本；块注释状态跨行保持，指针词元形态已收窄到根级名与几个既有目录。
 *
 * @param text - 源文件全文
 * @returns 每段注释的行号与正文（块注释状态跨行保持）
 */
function commentSpans(text: string): { line: number; body: string }[] {
	const out: { line: number; body: string }[] = [];
	let inBlock = false;
	text.split("\n").forEach((line, i) => {
		let body = "";
		if (inBlock) {
			const end = line.indexOf("*/");
			body = end >= 0 ? line.slice(0, end) : line;
			inBlock = end < 0;
		} else {
			const lineAt = line.indexOf("//");
			const blockAt = line.indexOf("/*");
			if (blockAt >= 0 && (lineAt < 0 || blockAt < lineAt)) {
				const end = line.indexOf("*/", blockAt + 2);
				body = line.slice(blockAt + 2, end < 0 ? undefined : end);
				inBlock = end < 0;
			} else if (lineAt >= 0) {
				body = line.slice(lineAt + 2);
			}
		}
		if (body) {
			out.push({ line: i + 1, body });
		}
	});
	return out;
}

/**
 * 逐行取出字符串字面量文本（单引号 / 双引号 / 同行反引号，忽略转义）；字符串侧指针的扫描面。
 *
 * @param text - 源文件全文
 * @returns 每个字符串字面量的行号与内容
 */
function stringSpans(text: string): { line: number; body: string }[] {
	const out: { line: number; body: string }[] = [];
	text.split("\n").forEach((line, i) => {
		for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)) {
			const body = m[1] ?? m[2] ?? m[3];
			if (body) {
				out.push({ line: i + 1, body });
			}
		}
	});
	return out;
}

describe("注释指针有效性（源码注释的 .md 引用必须存在）", () => {
	it("scripts/ test/ tools/ 注释里的 .md 引用都指向仓库内实际存在的文件", t => {
		const files = ["scripts", "test", "tools"].flatMap(tsFilesUnder);
		const hits: { file: string; line: number; token: string }[] = [];
		for (const rel of files) {
			const text = readFileSync(resolve(SKILL_ROOT, rel), "utf8");
			for (const { line, body } of commentSpans(text)) {
				for (const m of body.matchAll(MD_POINTER)) {
					if (m[1]) {
						hits.push({ file: rel, line, token: m[1] });
					}
				}
			}
		}
		assert.ok(files.length > 100, `扫描面异常：只找到 ${files.length} 个 .ts 文件`);
		assert.ok(hits.length > 0, "未提取到任何 .md 引用词元，守卫恒真");
		const skipped = hits.filter(h => h.token in MD_POINTER_ALLOWLIST);
		const violations = hits.filter(
			h => !(h.token in MD_POINTER_ALLOWLIST) && !existsSync(resolve(SKILL_ROOT, h.token))
		);
		if (skipped.length > 0) {
			t.diagnostic(
				`白名单跳过 ${skipped.length} 项：` +
					[...new Set(skipped.map(h => h.token))]
						.map(tok => `${tok}（${MD_POINTER_ALLOWLIST[tok]}）`)
						.join("、")
			);
		}
		assert.deepEqual(
			Object.keys(MD_POINTER_ALLOWLIST).filter(tok => skipped.every(h => h.token !== tok)),
			[],
			"白名单里有从未命中的条目（疑似静默豁免），请删除或修正"
		);
		assert.deepEqual(
			violations,
			[],
			`注释指针断裂：\n${violations.map(v => `${v.file}:${v.line} → ${v.token}`).join("\n")}`
		);
	});

	// ── 词元扩展（评审 2026-11-21 候选 2）：三类「承诺某物在某处」的形态各有守卫 ──
	it("scripts/ test/ tools/ 注释与字符串里的 npm run X 都指向 package.json scripts 现有命令", () => {
		const scripts = Object.keys(
			JSON.parse(readFileSync(resolve(SKILL_ROOT, "package.json"), "utf8")).scripts
		) as string[];
		const files = ["scripts", "test", "tools"].flatMap(tsFilesUnder);
		const hits: { file: string; line: number; token: string }[] = [];
		for (const rel of files) {
			const text = readFileSync(resolve(SKILL_ROOT, rel), "utf8");
			for (const { line, body } of [...commentSpans(text), ...stringSpans(text)]) {
				for (const m of body.matchAll(/npm run ([a-z0-9][a-z0-9:._-]*)/g)) {
					hits.push({ file: rel, line, token: m[1] });
				}
			}
		}
		assert.ok(hits.length > 0, "未提取到任何 npm run 词元，守卫恒真");
		const bad = hits.filter(h => !scripts.includes(h.token));
		assert.deepEqual(
			bad,
			[],
			`npm run 指向不存在的 script（补别名或改指向）：\n${bad.map(b => `${b.file}:${b.line} → npm run ${b.token}`).join("\n")}`
		);
	});

	it("字符串字面量里 references/ 前缀的 .md 路径都指向仓库内实际存在的文件", () => {
		const files = ["scripts", "test", "tools"].flatMap(tsFilesUnder);
		const hits: { file: string; line: number; token: string }[] = [];
		for (const rel of files) {
			const text = readFileSync(resolve(SKILL_ROOT, rel), "utf8");
			for (const { line, body } of stringSpans(text)) {
				for (const m of body.matchAll(/references\/[A-Za-z0-9_./-]*\.md/g)) {
					hits.push({ file: rel, line, token: m[0] });
				}
			}
		}
		assert.ok(hits.length > 0, "未提取到任何字符串路径词元，守卫恒真");
		const bad = hits.filter(h => !existsSync(resolve(SKILL_ROOT, h.token)));
		assert.deepEqual(
			bad,
			[],
			`字符串路径断裂：\n${bad.map(b => `${b.file}:${b.line} → ${b.token}`).join("\n")}`
		);
	});

	it(".ts 注释里的裸 *.test.ts 文件名都指向 test/ 下实际存在的文件", () => {
		const files = ["scripts", "test", "tools"].flatMap(tsFilesUnder);
		const hits: { file: string; line: number; token: string }[] = [];
		for (const rel of files) {
			const text = readFileSync(resolve(SKILL_ROOT, rel), "utf8");
			for (const { line, body } of commentSpans(text)) {
				for (const m of body.matchAll(/\b([A-Za-z0-9_-]+\.test\.ts)\b/g)) {
					hits.push({ file: rel, line, token: m[1] });
				}
			}
		}
		assert.ok(hits.length > 0, "未提取到任何裸 .test.ts 词元，守卫恒真");
		const bad = hits.filter(h => !existsSync(resolve(SKILL_ROOT, "test", h.token)));
		assert.deepEqual(
			bad,
			[],
			`断言覆盖者断针（注释承诺的测试文件不存在）：\n${bad.map(b => `${b.file}:${b.line} → test/${b.token}`).join("\n")}`
		);
	});
});

// ── 五、数据集指纹对账 ──
//
// 基准数据集（db/dataset 的两个 parquet）是日常回归的对标真值——它被静默替换过一次
//（1924–1983 → 1950–2026，2026-11-21 实证），当时没有任何闸门报警。本组把「替换而未
// 重登记」变成当场红：登记面（MANIFEST.json）由导出工具在导出收尾自报（build-duckdb
// 的 writeDatasetManifest），本组只读文件字节算哈希比对——不查库内容、不引 DuckDB
// 原生依赖，日常回归的零依赖前提不破。
describe("数据集指纹对账（db/dataset 替换而未重登记即红）", () => {
	const MANIFEST = resolve(SKILL_ROOT, "db/dataset/MANIFEST.json");
	const sha256 = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

	it("登记面存在且字段齐备——缺失即红并指路，不静默放行", () => {
		assert.ok(
			existsSync(MANIFEST),
			"db/dataset/MANIFEST.json 缺失——重导数据集走生成器自报登记（build-duckdb --mode=dataset），" +
				"或确认现值后按同一函数补登记"
		);
		const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
			files?: Record<string, { sha256?: string; bytes?: number }>;
			sampleCount?: number;
			yearRange?: number[];
		};
		assert.ok(
			m.files && typeof m.files === "object" && Object.keys(m.files).length > 0,
			"登记面缺 files 节"
		);
		for (const [name, entry] of Object.entries(m.files ?? {})) {
			assert.ok(
				entry?.sha256 && /^[0-9a-f]{64}$/.test(entry.sha256),
				`${name} 的 sha256 缺失或非 64 位十六进制`
			);
			assert.ok(
				Number.isFinite(entry?.bytes) && (entry?.bytes ?? 0) > 0,
				`${name} 的 bytes 缺失或非法`
			);
		}
		assert.ok(
			Number.isFinite(m.sampleCount) && (m.sampleCount ?? 0) > 0,
			"sampleCount 缺失或非法"
		);
		assert.ok(
			Array.isArray(m.yearRange) &&
				m.yearRange.length === 2 &&
				m.yearRange.every(Number.isFinite),
			"yearRange 缺失或非法"
		);
	});

	it("指纹比对：parquet 实测哈希 ≡ 登记哈希（字节级）", () => {
		const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
			files: Record<string, { sha256: string }>;
		};
		const mismatches: string[] = [];
		for (const [name, entry] of Object.entries(m.files)) {
			const p = resolve(SKILL_ROOT, "db/dataset", name);
			assert.ok(existsSync(p), `登记面列出的 ${name} 不在盘上`);
			const actual = sha256(p);
			if (actual !== entry.sha256) {
				mismatches.push(
					`${name}: 登记 ${entry.sha256.slice(0, 16)}… ≠ 实测 ${actual.slice(0, 16)}…`
				);
			}
		}
		assert.deepEqual(
			mismatches,
			[],
			`数据集指纹不一致——文件被替换而登记未更新？${mismatches.join("；")}。出路两条：` +
				"重导数据集走生成器自报登记（build-duckdb --mode=dataset），或确认变更后按同一函数显式重登记"
		);
	});
});
