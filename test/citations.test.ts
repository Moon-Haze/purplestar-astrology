// ── 引文守卫（元测试 + 全仓扫描）──
//
// 本文件是 `test/lib/citation-guard.ts` 的**唯一消费者**。它做两件事，
// 对应下面两个 describe：
//
//   一、喂守卫一棵**构造的临时目录树**，验它的扫描范围与排除规则本身对不对；
//   二、对**每个 skill 的 `scripts/`** 各跑一次真扫描，零违例才算过。
//
// ## 为什么第一件事必须做
//
// 守卫的失效方式不是「报错」，而是**什么都没扫到却一片绿**：目录写歪、递归写坏、核对表
// 没被排除（它自己的内容自我命中，真违例被淹没在噪声里）。这些都不会让任何东西变红。
//
// 这种失效只有喂给守卫一棵构造的树才看得见 —— 因为在**真实**源码树上造不出违例文件
// （不能往自己源码里写一句未核实引文），真扫描只能验证「结果是零违例」，而零违例既可能
// 是守卫生效，也可能是守卫根本没在工作。本文件补上后者。
//
// ## 为什么第二件事覆盖全部三个 skill
//
// 从前是各 skill 各扫各的：排盘解读扫自己的内核树、合盘扫自己的断语库。于是**各有盲区** ——
// 源扫不到合盘的断语、合盘扫不到源的格局库。收拢到 `test/` 之后一处扫全仓，盲区一并消失。
// 守卫的受众本就是**改内核的开发者**而非拷走 skill 的用户（`test/` 不随 skill 分发），
// 这是它该在的位置。
//
// ⚠️ 本文件只写 `mkdtemp` 造的临时树，对本仓**只读不写**。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { scanCitations } from "./lib/citation-guard.ts";
import { ALL_SKILLS, SOURCE_SKILL, skillDir } from "./lib/skills.ts";
// ⚠️ 核对表是**唯一一份数据资产**，它留在内核里 —— 数据留原地，逻辑搬到测试侧。
import { ANNOTATIONS } from "../scripts/ziwei/annotations.ts";

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

describe("引文守卫：扫描逻辑（喂构造的临时目录树）", () => {
	it("核对表里确有可用的未核实引文样本 —— 否则黑名单为空，本守卫恒判零违例", () => {
		// 黑名单 = suspect / fabricated 条目里**引号内的核心**。它为空时，守卫对任何源码都报
		// 「零违例」—— 那不是通过，是没在工作。若某天这些条目真被清空（引文全部改归属），
		// 这条会红，那时的正确处理是**删掉守卫**（连同本文件的全仓扫描那组），而不是放宽它。
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

	it("空目录得到零违例 —— 故调用方必须另外检查 checked 是否为空", () => {
		// 这是「假绿」的指纹：守卫对一棵空树无话可说，而它的返回值与「全部核对通过」
		// 长得一模一样。下面那个 describe 的第一条断言据此设防。
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
});

describe("引文守卫：扫全仓每个 skill 的 scripts/", () => {
	/**
	 * 每个 skill 的扫描结果，进程内算一次（describe 回调只跑一次）。
	 *
	 * @remarks
	 * 根取该 skill 的 `scripts/`（内核根），与从前各 skill 自扫时的根**完全一致** ——
	 * 变的只是「谁来扫」。
	 */
	const SCANS = ALL_SKILLS.map(name => {
		const root = resolve(skillDir(name), "scripts");
		return { name, root, exists: existsSync(root), ...scanCitations(root) };
	});

	it("每个 skill 的 scripts/ 都真的扫到了文件 —— 根写歪时守卫会静默零违例", () => {
		// 空转防护。少了这条，下面两条会在一份空结果上跑完全绿 —— 一条恒真的守卫比没有
		// 守卫更坏，它会被当成保障。
		assert.ok(SCANS.length > 0, "skills/ 下一个 skill 都没扫到 —— ALL_SKILLS 为空？");
		const empty = SCANS.filter(s => s.checked.length === 0).map(
			s => `${s.name}（${s.exists ? "scripts/ 在，但一个 .ts 都没扫到" : "scripts/ 不存在"}）`
		);
		assert.deepEqual(empty, [], `以下 skill 的扫描范围是空的：\n${empty.join("\n")}`);
	});

	it("全仓合计至少跳过一份核对表 —— 零份说明排除规则失配，其内容会自我命中", () => {
		// 单看某个 skill 看不出问题：只有源持有核对表，另外两个本来就是 0。故查**全仓合计**。
		// 若为零，`isChecklistSource` 已失配，那些 suspect 引文会把自己报成违例 —— 而下面
		// 那条「零违例」会因此变红，报的却是一堆假违例。
		const total = SCANS.reduce((n, s) => n + s.skipped.length, 0);
		assert.ok(
			total > 0,
			`全仓没有跳过任何核对表 —— ${SOURCE_SKILL} 的 ziwei/annotations.ts 是否仍导出 ANNOTATIONS？`
		);
	});

	it("全仓零违例：没有未核实引文仍冒充倪师原话", () => {
		// ⚠️ 这条是**内容**断言，上面两条是**结构**断言，缺一不可：单独看这条，一个什么都没
		// 扫到的守卫也会通过。三者的失败信息各自指向不同的故障，不要合并成一条。
		const bad = SCANS.flatMap(s => s.violations.map(v => `${s.name}: ${v}`));
		assert.deepEqual(
			bad,
			[],
			`以下未核实引文仍冒充倪师原话（应改古诀云/紫微斗数有云/一说，或补核对记录）：\n${bad.join("\n")}`
		);
	});
});
