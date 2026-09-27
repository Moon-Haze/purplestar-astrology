/**
 * 回归自检 —— 古籍数据源与检索行为的快速验证。
 *
 * ⚠️ **本文件是手写的，不是副本**（2026-09-27 起本 skill 与源 skill 不再有派生关系）。
 *
 * ## 为什么这里**不复制**排盘解读 skill 的那几百行断言
 *
 * 排盘内核（农历换算、真太阳时、晚子时、排盘不变量、三合派约束）在本 skill 里
 * **连被断言的对象都不存在**。内核回归的主场是源 skill 的 `selftest` 与仓库的 `npm test`。
 *
 * 本文件只负责**本 skill 自己的**四件事：数据源在不在、检索行为对不对、
 * 参数面接不接受得住、命令表与 SKILL.md 是否还对得上。
 *
 * ⚠️ 它留在 `scripts/` 而非 `test/`：分发时只带走 `SKILL.md + scripts/ + package.json`，
 * 自检必须在交付包内，否则装到别人机器上就没法自证。
 *
 * ## 参数面断言为什么**起子进程**而不是 import 解析函数
 *
 * 从前的三条参数面断言直接 `import { parseArgs, FLAG_NAMES } from "./args"`。那有两个代价：
 *
 * 1. **它测不到用户真正遇到的界面** —— 用户敲的是命令行，不是函数调用。
 * 2. **它把断言钉在实现上**：解析函数一改名 / 一挪窝，整个 `selftest` 在加载期就崩，
 *    而**跑任何一项断言之前**就崩 —— 报的是模块找不到，不是哪条行为坏了。
 *
 * 现在三条全走子进程：拼错旗标看 stderr、旗标清单从 `help` 的 `Options:` 段扫。
 * `help` 那个参数段由 `purple-star.ts` 的声明表渲染，故「SKILL.md ⊆ help」与
 * 「SKILL.md ⊆ 声明表」等价，且顺带证明了本 skill 最想保证的那件事：
 * **help 里显示的旗标就是实际接受的旗标**。
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// ⚠️ 内核 import 写全 `.ts` 扩展名 —— 本 skill 不再注册解析钩子（见 purple-star.ts 文件头）。
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "./index.ts";

/**
 * 本 skill 的内核根，即 `scripts/`。
 *
 * @remarks
 * 从前它由引导层经 `CliContext` 注入（因为 `scripts/cli/*` 是被动态加载的，拿不到引导层的
 * 局部变量）。简化的入口就是本文件的同层邻居，故一行算得出来，`CliContext` 随之取消。
 */
const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * `selftest` 命令：跑一组数据源与检索行为断言，返回逐项报告。
 *
 * @returns 已渲染好的报告文本；首行为「通过 N/N」
 *
 * @remarks
 * 首行自报项数，故任何文档都不写死这个数字（本仓既有规矩：计数类事实能自报的自报）。
 *
 * ⚠️ 有失败项时**不抛错，而是先 `console.error` 全量报告再 `process.exit(1)`** ——
 * `test/cli.test.ts` 依赖这个退出码判定自检是否全绿。
 */
export function cmdSelftest(): string {
	/** 单条断言的结果 */
	interface Assertion {
		pass: boolean;
		name: string;
		detail: string;
	}
	const results: Assertion[] = [];
	/** 相等断言，不等即抛错。 */
	const eq = (actual: unknown, expected: unknown, msg = "") => {
		if (actual !== expected)
			throw new Error(
				`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`
			);
	};
	/** 跑一条断言并登记结果；抛错即判失败，一条失败不影响其余断言继续跑。 */
	const ok = (name: string, fn: () => unknown) => {
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};

	/**
	 * 起子进程跑一次本 CLI。
	 *
	 * @param args - 命令与参数
	 * @returns 退出码与两路输出
	 *
	 * @remarks
	 * ⚠️ **不是就地 import `./commands`**：命令表里挂着 `cmdSelftest`（本函数），
	 * 就地 import 会成环。更实际的理由是 —— 参数面要测的正是
	 * 「入口 → 解析 → 命令表 → 渲染」这**整条链**，只调一个函数测不到其中任何一环。
	 */
	const run = (args: string[]): { code: number; out: string; err: string } => {
		const r = spawnSync(process.execPath, [resolve(ROOT, "purple-star.ts"), ...args], {
			encoding: "utf8",
		});
		return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
	};

	// ── 1. 数据源可用性 ──

	ok("数据源：三部古籍全部可加载，段落总数为正", () => {
		// 判据是**逐部点名**而不是「数组长度等于 3」：长度断言在「少了一部、多了一部」
		// 两种故障上都只能给出一句「不等于 3」，指不到缺的是哪一部。
		const want = ["gusuifu", "quanji", "quanshu"];
		const got = ALL_BOOKS.map(b => b.slug);
		for (const s of want) {
			if (!got.includes(s)) throw new Error(`缺少古籍 ${s}，实得 ${got.join("、")}`);
		}
		// 段落总数是「数据真的读进来了」的哨兵：slug 在而段落为空，说明 data/*.ts 被清空了。
		if (!(TOTAL_PARAGRAPHS > 0)) throw new Error("段落总数为 0 —— 古籍数据可能未加载");
		return `${ALL_BOOKS.length} 部 / ${TOTAL_PARAGRAPHS} 段`;
	});

	ok("数据源：每部书都有章节，每章都有段落", () => {
		// 上面那条只看总数，这条看结构：某部书 chapters 为空时总数仍可能为正（别的书贡献的），
		// 而检索会静默跳过它 —— 用户搜那部书里的词，得到的是「未找到」。
		for (const b of ALL_BOOKS) {
			if (!b.chapters?.length) throw new Error(`${b.slug} 没有章节`);
			const empty = b.chapters.filter(c => !c.paragraphs?.length).map(c => c.title);
			if (empty.length) throw new Error(`${b.slug} 下有空章节：${empty.join("、")}`);
		}
		return ALL_BOOKS.map(b => `${b.slug} ${b.chapters.length} 章`).join(" / ");
	});

	// ── 2. 检索行为 ──

	ok("检索：命中已知词，且结果带书名 / 章节 / 摘要", () => {
		const hits = searchClassics("机月同梁");
		if (!hits.length) throw new Error("「机月同梁」零命中 —— 数据源或匹配逻辑可能已失效");
		const bad = hits.filter(h => !h.bookTitle || !h.chapterTitle || !h.snippet);
		if (bad.length) throw new Error(`${bad.length} 条命中缺书名/章节/摘要`);
		// 摘要必须带高亮标记：它是渲染层把 <mark> 换成『』的依据，丢了会静默退化成纯文本。
		if (!hits.some(h => String(h.snippet).includes("<mark>")))
			throw new Error("摘要里没有 <mark> 高亮 —— snippet 的拼装可能已失效");
		return `${hits.length} 条命中，均带书名/章节/摘要`;
	});

	ok("检索：未收录的词返回空数组，而不是抛错或全量返回", () => {
		// 全量返回是这里真正要防的：`indexOf` 的判定若被写成恒真，检索会变成「列全部段落」，
		// 而调用方只看到「命中很多条」，不会觉得哪里不对。
		const hits = searchClassics("这句话在古籍里绝不可能出现zzzq");
		eq(hits.length, 0, "生僻词应零命中，");
		return "零命中";
	});

	ok("检索：空/纯空白关键词返回空数组", () => {
		// 空串是 `indexOf` 的恒真输入（任何字符串都包含空串）—— 不拦就是全量返回。
		eq(searchClassics("").length, 0, "空串应零命中，");
		eq(searchClassics("   ").length, 0, "纯空白应零命中，");
		return "空串与纯空白均零命中";
	});

	ok("检索：limit 是硬上限，且非法值不给出结果", () => {
		const one = searchClassics("紫微", 1);
		eq(one.length, 1, "limit=1 应恰好 1 条，");
		const many = searchClassics("紫微", 3);
		eq(many.length, 3, "limit=3 应恰好 3 条，");
		// 非法上限归空：调用方（`cmdClassics`）会先把非正整数单独拦成一句参数错误，
		// 走到内核时只剩合法值；这里锁的是「万一漏拦也不会变成无上限」。
		eq(searchClassics("紫微", 0).length, 0, "limit=0 应零命中，");
		eq(searchClassics("紫微", Number.NaN).length, 0, "limit=NaN 应零命中，");
		return "上限生效，0 / NaN 归空";
	});

	ok("检索：命中数不受 limit 之外的隐式截断（Infinity = 无上限）", () => {
		// 反向的一条：上面全是「上限生效」，若内核把上限写成恒真的 0，上面全绿而这条红。
		const all = searchClassics("紫微", Number.POSITIVE_INFINITY);
		const capped = searchClassics("紫微", 2);
		if (all.length <= capped.length)
			throw new Error(`无上限应多于有上限，实得 ${all.length} vs ${capped.length}`);
		return `无上限 ${all.length} 条 > 上限 2 条`;
	});

	// ── 3. 参数面（全部经子进程，测的是用户真正敲的那条链）──

	ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 拼错旗标以前是**静默**的：解析层任何 `--xxx` 都照单全收，命令读不到就落回默认值
		// —— `--serch 机月同梁` 会变成「不带关键词」，列出书目而用户以为搜过了。
		// 这类静默错结果正是本项目各处守卫在防的东西。
		//
		// 本断言锁的是**行为**（未知旗标必须抛错）而非文案。
		const probes: Array<[string, string]> = [
			["--serch", "search"], // 漏字
			["--limt", "limit"], // 漏字
			["--searches", "search"], // 多字
		];
		for (const [bad, want] of probes) {
			const r = run(["classics", bad, "x"]);
			if (r.code === 0)
				throw new Error(`${bad} 未报错（退出码 0）—— 未知旗标又变成静默忽略了`);
			if (!r.err.includes(`--${want}`))
				throw new Error(`${bad} 的提示应指向 --${want}，实得：${r.err.trim()}`);
		}
		return `${probes.length} 个拼写错误均被拦下`;
	});

	ok("参数面：取值旗标裸写必须报错并点名（不是静默当成开关）", () => {
		// `--search` 后不跟值会被解析层拒掉；若改成静默当开关，命令层读不到关键词，
		// 于是列出书目 —— 用户以为搜过了。`SKILL.md` 明确承诺过「会被明确拒绝」。
		const r = run(["classics", "--search"]);
		if (r.code === 0) throw new Error("裸写 --search 未报错 —— 取值旗标被当成了开关");
		if (!r.err.includes("--search"))
			throw new Error(`报错未点名 --search，实得：${r.err.trim()}`);
		return "裸写被拦下，且点名了旗标";
	});

	ok("参数面：非法 --limit 的值原样到达命令层，由它给出中文报错", () => {
		// ⚠️ 这条盯的是解析层**不能吃掉**以 `-` 开头的值：`--limit -3` 若被判成
		// 「未知参数 -3」，报错里就不会有 `--limit`，用户拿到的是一句指错方向的提示。
		// 仓库的 `test/cli.test.ts` 也拿 0 / -3 / abc 三个输入断言这点。
		for (const bad of ["0", "-3", "abc"]) {
			const r = run(["classics", "--search", "紫微", "--limit", bad]);
			if (!r.out.includes("--limit"))
				throw new Error(
					`--limit ${bad} 的报错未提到 --limit，实得：${r.out.trim() || r.err.trim()}`
				);
		}
		return "0 / -3 / abc 均被命令层拦下";
	});

	ok("参数面：SKILL.md 提到的旗标都在 help 的参数段里", () => {
		// help 的 `Options:` 段由 purple-star.ts 的声明表渲染，故这条同时保证两件事：
		// Claude 照着 SKILL.md 敲的旗标一定被接受，且 help 上写的与实际接受的同源。
		// 只查「SKILL.md → help」一个方向：反向刻意不查 —— 声明表里的旗标没必要都写进
		// SKILL.md（`-h` / `--help` 就从不写）。
		const r = run(["help"]);
		if (r.code !== 0) throw new Error(`help 退出码 ${r.code}：${r.err.trim()}`);
		const at = r.out.indexOf("\nOptions:");
		if (at < 0) throw new Error("help 输出里找不到 Options: 段 —— 版式可能已变");
		// 参数段到下一个空行为止（其后是「说明:」追加段）
		const seg = r.out.slice(at + 1);
		const options = seg.slice(0, seg.indexOf("\n\n"));
		const declared = new Set([...options.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]));
		// 先确认真扫到了东西：正则写歪或版式变了都会得到空集，那样的「零违规」是假绿。
		if (!declared.size) throw new Error("未从 help 的 Options 段扫到旗标 —— 版式或正则已失效");

		const md = readFileSync(resolve(ROOT, "..", "SKILL.md"), "utf8");
		const mentioned = [...md.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]);
		if (!mentioned.length)
			throw new Error("未从 SKILL.md 扫到任何旗标 —— 正则或路径可能已失效");
		const unknown = [...new Set(mentioned)].filter(n => !declared.has(n));
		if (unknown.length)
			throw new Error(
				`SKILL.md 提到但 help 里没有的旗标：${unknown.map(n => "--" + n).join("、")}`
			);
		return `${new Set(mentioned).size} 种旗标写法全部在 help 里`;
	});

	ok("参数面：SKILL.md 命令速查表提到的命令都在 commands.ts 的命令表里", () => {
		// 与上一条同源：SKILL.md 提到的命令若不存在，Claude 会照着敲一条必然失败的命令行。
		//
		// ⚠️ 这里读的是 commands.ts 的**源码文本**而非它的导出 —— `COMMAND_TABLE` 里挂着
		// `cmdSelftest`，而本文件就是 selftest：静态 import 成环。正则抽键是与「读 SKILL.md
		// 文本」同一手法。
		const src = readFileSync(resolve(ROOT, "commands.ts"), "utf8");
		const table = src.match(/const COMMAND_TABLE = \{([\s\S]*?)\} satisfies/)?.[1];
		if (!table) throw new Error("未从 commands.ts 抽到 COMMAND_TABLE —— 声明块形状已变");
		// ⚠️ 键上的双引号是**可选**的：命令名含连字符时不是合法标识符，
		// 必须加引号。只认裸键的写法会静默漏抽这一项。
		const defined = [...table.matchAll(/^\t+"?([a-z][a-z0-9-]*)"?:/gm)].map(m => m[1]);
		if (!defined.length)
			throw new Error("COMMAND_TABLE 里一个命令名都没抽到 —— 正则或路径可能已失效");

		const md = readFileSync(resolve(ROOT, "..", "SKILL.md"), "utf8");
		const at = md.indexOf("## 命令速查");
		if (at < 0) throw new Error("SKILL.md 里找不到「## 命令速查」小节");
		// 只取该小节里的表格：正文提到命令名的散文不构成「速查表说这个命令存在」的声明。
		// 先跳过标题行与其后的空行，否则下面第一个 `\n\n` 就是标题后的空行，切出个空表。
		const body = md.slice(at + md.slice(at).indexOf("\n\n") + 2);
		const rows = body
			.slice(0, body.indexOf("\n\n"))
			.split("\n")
			.filter(l => l.startsWith("|"));
		const mentioned = rows
			.map(l => l.match(/^\|\s*`([a-z][a-z0-9-]*)/)?.[1])
			.filter(n => n !== undefined);
		if (!mentioned.length) throw new Error("未从命令速查表扫到命令 —— 表格格式已变");

		const unknown = mentioned.filter(n => !defined.includes(n));
		if (unknown.length)
			throw new Error(`SKILL.md 提到但 commands.ts 未定义的命令：${unknown.join("、")}`);
		return `${mentioned.length} 个命令全部有实现`;
	});

	// ── 输出 ──
	const passed = results.filter(r => r.pass).length;
	const failed = results.length - passed;
	const out = [
		`紫微斗数古籍检索 skill 回归自检 —— 通过 ${passed}/${results.length}`,
		`内核根：${ROOT}`,
		"",
	];
	for (const r of results) {
		out.push(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? `\n     ${r.detail}` : ""}`);
	}
	if (failed) {
		out.push(
			"",
			`❌ ${failed} 项未通过。若为命令行为变更所致，请核对 scripts/ 下的实现与本文件的` +
				`断言哪一侧该改。`
		);
	} else {
		out.push("", "✅ 全部通过。");
	}
	const text = out.join("\n");
	if (failed) {
		console.error(text);
		process.exit(1);
	}
	return text;
}
