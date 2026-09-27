/**
 * 回归自检 —— 古籍数据源与检索行为的快速验证。
 *
 * ⚠️ **本文件是手写的，不是副本**（见 `CLAUDE.md` 的「副本边界与同步流程」）。
 *
 * ## 为什么这里**不复制**排盘解读 skill 的那 700 行断言
 *
 * 那两个 skill 的内核是**副本**，没人会就地改它 —— 开发循环是「改源 → `npm test` →
 * `npm run sync:skills`」。把排盘内核的断言复制过来，只会生产两份需要手工同步的副本，
 * 而且其中绝大多数（农历换算、真太阳时、晚子时、排盘不变量、三合派约束）**在本 skill 里
 * 连被断言的对象都不存在**。
 *
 * 内核回归的主场是源 skill 的 `selftest` 与仓库的 `npm test`（见 `test/README.md`）。
 * 本文件只负责**本 skill 自己的**事：数据源在不在、检索行为对不对、命令表与 SKILL.md
 * 是否还对得上、引导层的豁免有没有越界。这四件都是副本断言覆盖不到的。
 *
 * ⚠️ 它留在 `scripts/` 而非 `test/`，与源 skill 同理：分发时只带走
 * `SKILL.md + scripts/ + package.json`，自检必须在交付包内，否则装到别人机器上就没法自证。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliContext } from "./args";
import { FLAG_NAMES, parseArgs } from "./args";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// ⚠️ 相对路径而非 `@/`：`@/` 在 tsc 眼里只映到**源** skill 的内核根，而 classics/ 已不住
//    在源里（2026-09-27 起归本 skill）。理由详见 ./commands.ts 同一处注释。
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "../classics/index";

/**
 * `selftest` 命令：跑一组数据源与检索行为断言，返回逐项报告。
 *
 * @param ctx - 运行期上下文（内核根与其来源）—— 自检要在输出里交代用的是哪一份内核
 * @returns 已渲染好的报告文本；首行为「通过 N/N」，第二行是内核根
 *
 * @remarks
 * 首行自报项数，故任何文档都不写死这个数字（本仓既有规矩：计数类事实能自报的自报）。
 *
 * ⚠️ 有失败项时**不抛错，而是先 `console.error` 全量报告再 `process.exit(1)`** ——
 * `test/cli.test.ts` 依赖这个退出码判定自检是否全绿。
 */
export function cmdSelftest(ctx: CliContext): string {
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
			throw new Error(`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
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

	// ── 3. 参数面 ──

	ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 拼错旗标以前是**静默**的：parseArgs 任何 `--xxx` 都照单全收，命令读不到就落回默认值
		// —— `--serch 机月同梁` 会变成「不带关键词」，列出书目而用户以为搜过了。
		// 这类静默错结果正是本项目各处守卫在防的东西。
		//
		// 本断言锁的是**行为**（未知旗标必须抛错）而非文案。
		const probes: Array<[string, string]> = [
			["--serch", "search"], // 换位
			["--limt", "limit"], // 漏字
			["--searches", "search"], // 多字
		];
		for (const [bad, want] of probes) {
			let msg = "";
			try {
				parseArgs([bad, "x"], "classics");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) throw new Error(`${bad} 未报错 —— 未知旗标又变成静默忽略了`);
			if (!msg.includes(`--${want}`))
				throw new Error(`${bad} 的提示应指向 --${want}，实得：${msg}`);
		}
		return `${probes.length} 个拼写错误均被拦下`;
	});

	ok("参数面：SKILL.md 提到的旗标都在 args.ts 的声明表里", () => {
		// SKILL.md 是给 Claude 读的**行为规范**（改它就等于改 skill 的行为）。它提到的旗标若在
		// 解析层不存在，Claude 会照着敲一个被拒的参数。只查「SKILL.md → 声明表」一个方向：
		// 反向（声明表里的旗标都要写进 SKILL.md）刻意不查 —— 声明表是各 skill 的**全集**，
		// 本 skill 的 SKILL.md 本就不该提到 --date / --gender 那些用不上的旗标。
		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
		const mentioned = [...md.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]);
		// 先确认真扫到了东西：正则写歪或文件挪了位置都会得到空数组，那样的「零违规」是假绿。
		if (!mentioned.length) throw new Error("未从 SKILL.md 扫到任何旗标 —— 正则或路径可能已失效");
		const names = [...new Set(mentioned)];
		const unknown = names.filter(n => !FLAG_NAMES.has(n));
		if (unknown.length)
			throw new Error(
				`SKILL.md 提到但 args.ts 未声明的旗标：${unknown.map(n => "--" + n).join("、")}`
			);
		return `${names.length} 种旗标写法全部有声明`;
	});

	ok("参数面：SKILL.md 命令速查表提到的命令都在 commands.ts 的命令表里", () => {
		// 与上一条同源：SKILL.md 提到的命令若不存在，Claude 会照着敲一条必然失败的命令行。
		//
		// ⚠️ 这里读的是 commands.ts 的**源码文本**而非它的导出 —— `COMMAND_TABLE` 里挂着
		// `cmdSelftest`，而本文件就是 selftest：静态 import 成环。正则抽键是与「读 SKILL.md
		// 文本」同一手法，也是源 skill 那份 selftest 用的办法。
		const src = readFileSync(resolve(ctx.root, "cli", "commands.ts"), "utf8");
		const table = src.match(/const COMMAND_TABLE = \{([\s\S]*?)\} satisfies/)?.[1];
		if (!table) throw new Error("未从 commands.ts 抽到 COMMAND_TABLE —— 声明块形状已变");
		// ⚠️ 键上的双引号是**可选**的：命令名含连字符时不是合法标识符，
		// 必须加引号。只认裸键的写法会静默漏抽这一项。
		const defined = [...table.matchAll(/^\t+"?([a-z][a-z0-9-]*)"?:/gm)].map(m => m[1]);
		if (!defined.length)
			throw new Error("COMMAND_TABLE 里一个命令名都没抽到 —— 正则或路径可能已失效");

		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
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

	// ── 4. 引导层豁免有界 ──

	ok("引导层豁免有界：boot-hooks.ts 只依赖 node: 内置", () => {
		// scripts/boot-hooks.ts 是引导层**唯一**被允许静态 import 的非 node: 模块。
		// 「引导层不得出现普通静态 import」那条规则的实质是「禁止在钩子注册前触发 .ts 解析」，
		// 而 boot-hooks.ts 只依赖 node: 内置、调用点又写全了 .ts 扩展名，故由 Node 原生类型擦除
		// 加载，不触碰钩子 —— 这份豁免正是靠这一点成立。
		//
		// ⚠️ 越界有两种形态，只有一种会自己喊出来：
		//   · 省略扩展名 → 钩子尚未注册，CLI 当场崩 ERR_MODULE_NOT_FOUND。吵，但不危险。
		//   · 写全扩展名 → **照常跑通**（那个文件恰好没有自己的依赖）。这是颗哑雷 ——
		//     哪天它多一个 `@/` 依赖，引导层就会在钩子注册前崩掉，而崩因指向一次看似无关的改动。
		// 本断言守的是后一种。
		const src = readFileSync(resolve(ctx.root, "boot-hooks.ts"), "utf8");
		const specs = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(m => m[1]);
		// 先确认真的扫到了东西：正则写歪或文件被改名都会得到空数组，那样的「零违规」是假绿。
		if (!specs.length)
			throw new Error("未扫到任何 import —— 正则或 boot-hooks.ts 的路径可能已失效");
		const bad = specs.filter(s => !s.startsWith("node:"));
		if (bad.length) {
			throw new Error(
				`boot-hooks.ts 不得依赖非 node: 模块（它要在解析钩子注册**之前**被加载），实得：${bad.join("、")}`
			);
		}
		return `${specs.length} 条 import 全为 node: 内置`;
	});

	// ── 输出 ──
	const passed = results.filter(r => r.pass).length;
	const failed = results.length - passed;
	const srcNote = ctx.rootLabel === "技能自带内核" ? "" : `（来源：${ctx.rootLabel}）`;
	const out = [
		`紫微斗数古籍检索 skill 回归自检 —— 通过 ${passed}/${results.length}`,
		`内核根：${ctx.root} ${srcNote}`,
		"",
	];
	for (const r of results) {
		out.push(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? `\n     ${r.detail}` : ""}`);
	}
	if (failed) {
		out.push(
			"",
			`❌ ${failed} 项未通过。若为内核重构所致，请核对 scripts/cli/ 各模块的 import 列表与` +
				`scripts/classics/ 的实际导出是否对得上。`
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
