/**
 * help 渲染 —— 总览 help 与每命令 `--help`（man 手册页结构，spec §3.2）。
 *
 * - **总览 `help`**：NAME / SYNOPSIS / DESCRIPTION / COMMANDS / OPTIONS / EXAMPLES /
 *   NOTES / SEE ALSO 八节（比每命令版多一节 COMMANDS），节标题大写、节序固定 ——
 *   `less purple-star.ts help` 的观感即 man。
 * - **`<命令> --help`**：同一结构减 COMMANDS 节；OPTIONS 按命令 → 参数归属表
 *   （{@link OPTION_OWNERSHIP}）过滤成该命令实际读取的子集。
 * - **归属表是 help 视图**，不做硬校验（作用域仍 skill 级）：「哪条命令读哪个参数」
 *   的诚实边界收窄只发生在 help 层。
 *
 * 两处数据源：`commands.ts` 的 COMMAND_HELP（逐命令多行说明）与本文件就近声明的
 * 示例与注意事项。参数清单从 `args.ts` 的 OPTION_GROUPS 派生（与实际接受面同源）。
 */

import { COMMAND_DESC, COMMAND_HELP, COMMAND_NAMES, type CommandName } from "./command-meta";
import { OPTION_GROUPS, OPTION_ALIASES, type OptionSpec } from "./args";

/**
 * 命令 → 专属参数名表（help 视图）。
 *
 * @remarks
 * 列出的名字是该命令**实际读取**的参数；未列出的参数对它无害（skill 级作用域收下
 * 不用），但 help 不展示 —— 用户照 help 敲不会被误导。
 */
export const OPTION_OWNERSHIP: Record<CommandName, readonly string[]> = {
	astrology: [
		"date",
		"lunar",
		"leap",
		"time",
		"branch",
		"late-zi",
		"eot",
		"gender",
		"lng",
		"city",
		"province",
		"name",
		"info",
		"pattern",
		"mutagen",
		"decadal",
		"ages",
		"palaces",
		"yearly",
		"monthly",
		"focus",
		"topic",
		"view",
		"json",
		"config",
		"template",
	],
	stars: ["search"],
	classics: ["search", "limit"],
	synastry: ["charts", "json"],
	selftest: [],
};

/** 两条最容易排出错盘的口径（NOTES 节的核心，原文与旧 help 一致）。 */
const HELP_CAUTION = [
	"  · 晚子时：23:00–23:59 出生时，子时横跨两日，【当日早子时】与【晚子时算次日】",
	"    排出的是两张不同的盘。复核请加 --late-zi 或 --branch 12。",
	"",
	"  · 真太阳时跨过午夜：出生日期会自动回退/顺延一天，输出里会写明「已跨过午夜，",
	"    出生日期…」。这是正确行为 —— 只换时辰不换日期，排出的「日 + 时」指向的",
	"    就不是出生时刻（喀什 00:30 的真太阳时是前一日 21:34，农历日会错一天）。",
];

/** 拼音别名表（NOTES 节；别名仍是合法输入，主名进 help 正文）。 */
const ALIAS_NOTE =
	"  拼音别名（仍被识别，归一到主名）：" +
	Object.entries(OPTION_ALIASES)
		.map(([alias, main]) => `--${alias} → --${main}`)
		.join("、");

/** 示例数据统一为虚构组合（spec §3.4）：甲方 2011-06-24 杭州 / 乙方 1999-11-03 成都。 */
const FICTION_NOTE = "  （示例数据为虚构，无真实人物）";

/** 总览 EXAMPLES 节：逐命令一条 + 一句说明。 */
const OVERVIEW_EXAMPLES = [
	`  # 单人排盘解读（概览默认含基本信息；零参数快捷形态按形态归类）
  node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州`,
	"",
	`  # 专题深入可叠加：格局 + 四化 + 指定流年 + 聚焦财帛宫
  node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --pattern --mutagen --yearly 2027 --focus 财帛`,
	"",
	`  # 十二宫逐宫详表与主题论断
  node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --palaces
  node scripts/purple-star.ts astrology --date 1999-11-03 --time 15:20 --city 成都 --gender female --topic love`,
	"",
	`  # 合盘：先排两张盘，再逗号分隔交给 synastry（甲先乙后）
  node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json > /tmp/a.json
  node scripts/purple-star.ts astrology --date 1999-11-03 --time 15:20 --city 成都 --gender female --json > /tmp/b.json
  node scripts/purple-star.ts synastry --charts /tmp/a.json,/tmp/b.json`,
	"",
	`  # 古籍原文检索与星曜释义
  node scripts/purple-star.ts classics --search 机月同梁
  node scripts/purple-star.ts stars --search 紫微`,
	"",
	FICTION_NOTE,
];

/** 每命令示例（`<命令> --help` 的 EXAMPLES 节）。 */
const COMMAND_EXAMPLES: Record<CommandName, readonly string[]> = {
	astrology: [
		"  node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州",
		"  node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --pattern --mutagen",
		"  node scripts/purple-star.ts astrology --date 1999-11-03 --time 15:20 --city 成都 --gender female --topic love --view liunian",
		"  # 完全零输入不报错：以虚构示例演示基本信息面板 + 运限速览 + 专题指路",
		"  node scripts/purple-star.ts astrology",
		"",
		FICTION_NOTE,
	],
	stars: ["  node scripts/purple-star.ts stars --search 紫微", "", FICTION_NOTE],
	classics: [
		"  node scripts/purple-star.ts classics --search 机月同梁",
		"  node scripts/purple-star.ts classics --search 紫微 --limit 5",
		"",
		FICTION_NOTE,
	],
	synastry: [
		"  node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json > /tmp/a.json",
		"  node scripts/purple-star.ts astrology --date 1999-11-03 --time 15:20 --city 成都 --gender female --json > /tmp/b.json",
		"  node scripts/purple-star.ts synastry --charts /tmp/a.json,/tmp/b.json",
		"",
		FICTION_NOTE,
	],
	selftest: ["  node scripts/purple-star.ts selftest"],
};

/** 字符串在等宽终端里占的列数：CJK / 全角算 2 列。 */
function displayWidth(s: string): number {
	let width = 0;
	for (const ch of s) {
		const c = ch.codePointAt(0) ?? 0;
		const wide =
			(c >= 0x2e80 && c <= 0xa4cf) ||
			(c >= 0xac00 && c <= 0xd7a3) ||
			(c >= 0xf900 && c <= 0xfaff) ||
			(c >= 0xfe30 && c <= 0xfe6f) ||
			(c >= 0xff00 && c <= 0xff60) ||
			(c >= 0xffe0 && c <= 0xffe6);
		width += wide ? 2 : 1;
	}
	return width;
}

/** 参数的 help 标签：`--name <值域>`（必值）、`--name <[值域]>`（可选值）或裸 `--name`；别名尾注由调用方拼接。 */
const label = (o: OptionSpec) =>
	o.kind === "switch"
		? `--${o.name}`
		: o.optionalValue
			? `--${o.name} <[${o.value ?? "值"}]>`
			: `--${o.name} <${o.value ?? "值"}>`;

/** 主名 → 拼音别名（尾注用，倒排 OPTION_ALIASES）。 */
const ALIAS_OF = new Map<string, string>(
	Object.entries(OPTION_ALIASES).map(([alias, main]) => [main, alias])
);

/**
 * 渲染 OPTIONS 节正文：按声明表分组、只列 `owned` 里的参数，别名做行尾注。
 *
 * @param owned - 该命令归属的参数名集合（总览 = 全量）
 */
function renderOptions(owned: ReadonlySet<string>): string[] {
	// 逐组收集（相邻同名组合并），最后按组序同步输出标题与参数 —— 旧写法把组标题
	// 即时 push、参数行收集到循环外统一 append，结果所有标题堆在前面，分组名存实亡。
	const groups: Array<{ title: string; rows: Array<[string, string]> }> = [];
	for (const g of OPTION_GROUPS) {
		const opts = g.options.filter(o => owned.has(o.name));
		if (!opts.length) continue;
		const rows: Array<[string, string]> = opts.map(o => [
			`  ${label(o)}${ALIAS_OF.get(o.name) ? `（别名 --${ALIAS_OF.get(o.name)}）` : ""}`,
			o.desc,
		]);
		const last = groups[groups.length - 1];
		if (last && last.title === g.title) last.rows.push(...rows);
		else groups.push({ title: g.title, rows });
	}
	const allRows: Array<[string, string]> = [
		["  -h, --help", "显示本帮助（任何命令可用）"],
		...groups.flatMap(g => g.rows),
	];
	const column = Math.max(...allRows.map(([l]) => displayWidth(l))) + 2;
	const pad = (l: string, d: string) => l + " ".repeat(Math.max(1, column - displayWidth(l))) + d;
	const lines: string[] = [pad("  -h, --help", "显示本帮助（任何命令可用）")];
	for (const g of groups) {
		lines.push(`  ${g.title}`);
		for (const [l, d] of g.rows) lines.push(pad(l, d));
	}
	return lines;
}

/** 总览 help（man 八节：多一节 COMMANDS）。 */
export function renderOverviewHelp(): string {
	const lines: string[] = [];
	lines.push("NAME", "  purple-star —— 紫微斗数 CLI（排盘解读 / 古籍检索 / 合盘，三域合一）", "");
	lines.push(
		"SYNOPSIS",
		"  node scripts/purple-star.ts <command> [options]",
		"  node scripts/purple-star.ts help",
		""
	);
	lines.push("DESCRIPTION");
	lines.push(
		"  单条 CLI 承载三个领域：astrology 排盘解读（四命令合一）、classics 古籍原文检索、",
		"  synastry 合盘（双宫联参）。内核住 scripts/ziwei|classics|synastry/，排盘口径为",
		"  倪海夏《天纪》三合派（不做宫干四化 / 自化 / 来因宫）。",
		""
	);
	lines.push("COMMANDS");
	const names = Object.keys(COMMAND_DESC);
	const cw = Math.max(...names.map(displayWidth)) + 2;
	for (const n of names) lines.push(`  ${n.padEnd(cw)}${COMMAND_DESC[n as CommandName]}`);
	lines.push("  help".padEnd(cw + 2) + "本帮助");
	lines.push("  各命令的专属用法：node scripts/purple-star.ts <command> --help", "");
	lines.push("OPTIONS");
	lines.push(
		...renderOptions(new Set(OPTION_GROUPS.flatMap(g => g.options.map(o => o.name)))),
		""
	);
	lines.push("EXAMPLES", ...OVERVIEW_EXAMPLES, "");
	lines.push("NOTES");
	lines.push("  · 排盘四必问：出生日期、出生时间、性别、出生地 —— 缺一问一，不要猜。");
	lines.push(...HELP_CAUTION);
	lines.push("  · " + ALIAS_NOTE);
	lines.push("  · 需要经 npm install 装依赖（iztro / lunar-typescript），拷走即装。", "");
	lines.push("SEE ALSO");
	lines.push(
		"  SKILL.md（使用总纲）· references/（workflow / options / output-contract / troubleshooting）"
	);
	return lines.join("\n");
}

/** 每命令 help（man 七节：无 COMMANDS 节）。 */
export function renderCommandHelp(cmd: CommandName): string {
	const owned = new Set(OPTION_OWNERSHIP[cmd]);
	const lines: string[] = [];
	lines.push("NAME", `  ${cmd} —— ${COMMAND_DESC[cmd]}`, "");
	lines.push("SYNOPSIS");
	if (cmd === "astrology")
		lines.push(
			"  node scripts/purple-star.ts astrology <日期> <时刻> <性别> [<城市>]",
			"  node scripts/purple-star.ts astrology --date … --time … --gender … [--city …] [专题参数…]"
		);
	else if (cmd === "classics" || cmd === "stars")
		lines.push(
			`  node scripts/purple-star.ts ${cmd} [--search <关键词>] [--limit N]`,
			`  node scripts/purple-star.ts ${cmd} <关键词>`
		);
	else lines.push(`  node scripts/purple-star.ts ${cmd} [options]`);
	lines.push("");
	lines.push("DESCRIPTION", ...(COMMAND_HELP[cmd] ?? []).map(l => (l ? `  ${l}` : l)), "");
	lines.push("OPTIONS");
	lines.push(...renderOptions(owned), "");
	lines.push("EXAMPLES", ...(COMMAND_EXAMPLES[cmd] ?? []), "");
	// NOTES 按命令裁剪：四必问 / 晚子时 / 真太阳时跨午夜都是**排盘**铁律 —— synastry
	// 不排盘、stars/classics 不涉出生信息，全量模板会让命令级 help 教人用对它无效的
	// 参数（如 synastry --help 里的 --late-zi）。全量铁律保留在总览 help。
	if (cmd === "astrology") {
		lines.push("NOTES");
		lines.push("  · 排盘四必问：出生日期、出生时间、性别、出生地 —— 缺一问一，不要猜。");
		lines.push(...HELP_CAUTION);
		lines.push("  · " + ALIAS_NOTE);
		lines.push("");
	}
	lines.push("SEE ALSO");
	const others = Object.keys(COMMAND_DESC).filter(n => n !== cmd);
	lines.push(`  其余命令：${others.join("、")} · 总览：node scripts/purple-star.ts help`);
	return lines.join("\n");
}
