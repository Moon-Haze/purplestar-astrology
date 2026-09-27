#!/usr/bin/env node
/**
 * purple-star.ts — 紫微斗数古籍检索 CLI（入口 + 参数面 + help）
 *
 * ## 本文件为什么这么短
 *
 * 2026-09-27 的简化把三份基础设施合成了一份。此前：引导层（本文件，261 行）只负责
 * 定位内核根 → 注册 TS 解析钩子 → 启动自检 → 分发，参数面与 help 在 `cli/args.ts`
 * （775 行），钩子机制在 `boot-hooks.ts`（237 行）—— 合计 1273 行，而本 skill 的
 * 真功能（三部古籍 + 检索）只有 851 行。
 *
 * 合成可行的技术支点是**本 skill 内部的 import 一律写全 `.ts` 扩展名**：
 * Node ≥ 22.15 的原生类型擦除可直接加载 `.ts`，故不需要 `registerHooks`。
 * 顺带消失的是 `pickRoot` / `ZIWEI_ROOT` / `ROOT_CANDIDATES` / `REQUIRED_EXPORTS`
 * 那一整套仪式 —— 内核就在本文件旁边，加载失败时 Node 自己会报错，指得比自检清单还准。
 *
 * ## 本 skill 与源 skill 的关系：**没有关系**
 *
 * 2026-09-27 起，切片 / 逐字节副本 / `npm run sync:skills` 那套机制随派生关系一并退休。
 * 本目录下的每个文件都是本 skill 自己的实现，改它不必先问「这是源还是副本」。
 * 与源 skill 共享的只剩**概念**（命令名、输出口径），不是文件。
 *
 * ## 简化时**刻意保留**的行为（一条不少）
 *
 * 下面每一条都有断言盯着（本 skill 的 `selftest` 与仓库的 `test/cli.test.ts`），
 * 精简代码时别顺手删：
 *
 * - 未知旗标 → 报错 + 编辑距离最近邻建议（拼错旗标曾静默落回默认值、排出错盘）
 * - 取值旗标裸写（`--limit` 后无值）→ 中文报错并点名，附示例值
 * - `-x` 短旗标拒绝（本项目只有长旗标）；单独的 `-` 仍是位置参数
 * - `--limit -3` → 值**原样到达**命令层，由它给出「需为正整数」
 * - `--k=v` 与 `--k v` 都认；`--` 之后全为位置参数；重复旗标取末值
 * - help 由声明表渲染，参数段与实际接受面同源（不各说各话）
 */

import { COMMANDS, COMMAND_DESC } from "./commands.ts";

// ══════════════════════ 参数面：声明表 ══════════════════════

/**
 * CLI 参数表：`_` 收位置参数，其余键对应 `--key`。
 *
 * @remarks
 * 带值的参数存 `string`，纯开关存布尔 `true`。
 *
 * ⚠️ **键是 camelCase**（`a-chart` → `aChart`、`late-zi` → `lateZi`），由
 * {@link camelKey} 在解析时换算 —— 这是**本项目自己的键名约定**。按下标读参数的地方
 * 必须经它拼键，否则读不到值会**静默落回默认值**，与拼错旗标同一种失败。
 */
export interface CliArgs {
	/** 位置参数：非 `--` 开头的 argv 项，按出现顺序收集 */
	_: string[];
	[key: string]: string | boolean | string[];
}

/**
 * 一个旗标的完整声明。
 *
 * @remarks
 * 界面刻意只留四格 —— 声明表要能被一眼扫完，免得「加旗标」变成一件要读文档才敢做的事。
 */
interface FlagSpec {
	/** 旗标名，不含 `--` */
	readonly name: string;
	/** `"value"` 取值、`"switch"` 纯开关 */
	readonly kind: "value" | "switch";
	/** `kind: "value"` 时的值域占位；同时充当裸写报错里的示例值 */
	readonly value?: string;
	/** 一行说明，即 help 里的描述列 */
	readonly desc: string;
}

/**
 * 本 skill 认的**全部**旗标 —— 「有哪些旗标」的唯一来源。
 *
 * @remarks
 * help 的参数段、校验基准、最近邻建议的候选集三处都从这一张表派生，加旗标只动这里。
 *
 * 表里没有的名字一律**报错**（不是静默忽略）—— 这是本项目在参数面上最重要的立场：
 * 拼错旗标（`--serch`）的代价曾是「命令读不到关键词、列出书目，而用户以为搜过了」。
 */
const GROUP_TITLE = "输出与选题";
const FLAGS: readonly FlagSpec[] = [
	{ name: "search", kind: "value", value: "机月同梁", desc: "检索关键词（也可用位置参数）" },
	{ name: "limit", kind: "value", value: "15", desc: "classics 命中条数上限（正整数）" },
];

/** 旗标名集合：校验基准 + 最近邻建议的候选集。 */
const FLAG_NAMES: ReadonlySet<string> = new Set(FLAGS.map(f => f.name));

/** 旗标名 → 声明。 */
const FLAG_BY_NAME: ReadonlyMap<string, FlagSpec> = new Map(FLAGS.map(f => [f.name, f]));

// ══════════════════════ 参数解析 ══════════════════════

/**
 * kebab → camelCase（`late-zi` → `lateZi`）。
 *
 * @remarks
 * 键名约定只有这一处。换算写错会让命令层读不到值、静默落回默认值 —— 故
 * `selftest` 里那条「命令能读到参数」的冒烟断言同时也是它的守卫。
 */
const camelKey = (name: string): string =>
	name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

/** 两个字符串的编辑距离（Levenshtein，换位算 2 步）。 */
function editDistance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			cur[j] = Math.min(sub, prev[j] + 1, cur[j - 1] + 1);
		}
		prev = cur;
	}
	return prev[b.length];
}

/**
 * 在合法旗标名里找与 `name` 最接近的一个。
 *
 * @param name - 用户实际敲的旗标名（不含 `--`）
 * @returns 编辑距离 ≤ 2 的最近者；都不够近则 `null`
 *
 * @remarks
 * 阈值取 2 是权衡：`limt` → `limit` 距离 1、`serch` → `search` 距离 1，都要抓；
 * 再放宽就会开始乱建议，反而把提示变成噪声。取不到就近的名字时**不猜**，
 * 只给一句「运行 help 查看全部参数」。
 */
function suggestFlag(name: string): string | null {
	let best: string | null = null;
	let bestD = 3;
	for (const n of FLAG_NAMES) {
		const d = editDistance(name, n);
		if (d < bestD) {
			bestD = d;
			best = n;
		}
	}
	return best;
}

/**
 * 校验旗标名，不合法即抛错。
 *
 * @param key - 已剥掉 `--` 的旗标名
 * @throws 名字不在 {@link FLAGS} 里时；报错带上最近邻建议
 *
 * @remarks
 * 刻意**不**校验「这个旗标属于这个命令」：`--limit` 给 `classics` 之外的多余参数是无害的，
 * 而把归属做成硬约束会让每条命令的合法集合成为第二个需要维护的真相 —— 拼错才是要挡的，
 * 归属错了顶多是没生效，不会给出错结果。
 */
function checkFlagName(key: string): void {
	if (FLAG_NAMES.has(key)) return;
	const hint = suggestFlag(key);
	throw new Error(
		`未知参数 --${key}。${hint ? `最接近的是 --${hint}。` : ""}运行 help 查看全部参数。`
	);
}

/**
 * 参数解析：`--key value` / `--key=value` / `--flag` / 位置参数。
 *
 * @param argv - 待解析的参数（**不含**命令名）
 * @returns 参数表；键已归一成 camelCase
 * @throws 未知旗标 / 短旗标 / 取值旗标裸写 —— 一律中文报错，不静默忽略
 *
 * @remarks
 * 单趟扫描，边扫边校验。判据取自声明表的 `kind`，不按「下一个 token 长什么样」猜：
 *
 * - **取值旗标**吃掉下一个 token。`--limit -3` 里的 `-3` 是**合法值**，故只挡以
 *   `--` 开头的（那是另一个旗标，不是值）；值原样到达命令层，由它给出「需为正整数」。
 * - **`--` 之后**的一切都是位置参数，不再当旗标校验 —— `classics -- --search`
 *   搜的就是字面的 `--search`。
 * - **单独的 `-`** 是「stdin」的传统写法，仍是位置参数；其余 `-x` 一律拒绝 ——
 *   本项目没有任何短选项，而放行它只会让用户以为某个短旗标生效了。
 * - **重复旗标取末值**（`--limit 5 --limit 2` → `"2"`）。
 */
function parseArgs(argv: readonly string[]): CliArgs {
	const args: CliArgs = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--") {
			args._.push(...argv.slice(i + 1));
			break;
		}
		if (!a.startsWith("--")) {
			if (a.startsWith("-") && a !== "-")
				throw new Error(
					`未知参数 ${a}。本项目只有 --xxx 长旗标形式。运行 help 查看全部参数。`
				);
			args._.push(a);
			continue;
		}
		const eq = a.indexOf("=");
		const key = eq < 0 ? a.slice(2) : a.slice(2, eq);
		checkFlagName(key);
		const spec = FLAG_BY_NAME.get(key);
		// `kind` 决定要不要吃下一个 token。`checkFlagName` 已确认它在表里。
		if (spec?.kind === "switch") {
			if (eq >= 0) throw new Error(`--${key} 是开关，不接受值。运行 help 查看全部参数。`);
			args[camelKey(key)] = true;
			continue;
		}
		if (eq >= 0) {
			args[camelKey(key)] = a.slice(eq + 1);
			continue;
		}
		const next: string | undefined = argv[i + 1];
		if (next === undefined || next.startsWith("--"))
			throw new Error(
				`--${key} 需要一个值${spec?.value ? `（如 --${key} ${spec.value}）` : ""}。` +
					`运行 help 查看全部参数。`
			);
		args[camelKey(key)] = next;
		i++;
	}
	return args;
}

// ══════════════════════ HELP 渲染 ══════════════════════

/**
 * 字符串在等宽终端里占的列数：CJK / 全角字符算 2 列，其余算 1 列。
 *
 * @remarks
 * 只为 help 的描述列对齐服务。用 `String.length` 会在含中文的值域占位上把描述列推歪
 * （`--search <机月同梁>` 实际占 19 列而 `length` 是 18）—— 那是**看得见**的排版缺陷，
 * 故值得这几行。区间取常见的几段（CJK 部首 / 假名 / 统一表意文字 / 全角形式 / 谚文），
 * 不求 Unicode 宽度表的完整实现：本文件的旗标名与值域占位只可能出现这些字符。
 */
function displayWidth(s: string): number {
	let width = 0;
	for (const ch of s) {
		const c = ch.codePointAt(0) ?? 0;
		const wide =
			(c >= 0x1100 && c <= 0x115f) ||
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

/**
 * 渲染整份 help 文本（`Usage:` / `Commands:` / `Options:` 三段 + 调用方给的追加段）。
 *
 * @param opts - 首行说明、命令表（`COMMAND_DESC`）、追加段
 * @returns 已排好版的完整帮助文本（不含尾随换行）
 *
 * @remarks
 * 参数段从 {@link FLAGS} 渲染，命令段从入参的 `COMMAND_DESC` 渲染 —— 两段各只有一个真相，
 * 且与实际接受面**自动一致**（改了声明表，help 跟着变，不会各说各话）。
 *
 * 命令表**作为入参**传入而不是 import 进来：`commands.ts` 依赖本文件的 `CliArgs` 类型，
 * 反向 import 会成环。
 *
 * `-h, --help` 那一行由本函数统一给出 —— {@link main} 在解析**之前**就拦下了
 * `-h` / `--help`（它们不是本 skill 声明的旗标，交给解析器只会得到一句「未知参数」），
 * 故这行与命令集无关。
 */
function renderHelp(opts: {
	head: string;
	commands: Readonly<Record<string, string>>;
	notes?: readonly { title: string; body: string }[];
}): string {
	const lines: string[] = [opts.head, "", "Usage:", "  $ purple-star <command> [options]"];
	const names = Object.keys(opts.commands);

	if (names.length) {
		lines.push("", "Commands:");
		const w = Math.max(...names.map(n => displayWidth(n))) + 2;
		for (const n of names) lines.push(`  ${n.padEnd(w)}${opts.commands[n]}`);
		lines.push(
			"",
			"For more info, run any command with the `--help` flag:",
			...names.map(n => `  $ purple-star ${n} --help`)
		);
	}

	// 参数段：先算出描述列的绝对位置，再让分组内的缩进与 `-h, --help` 那一行对齐
	const HELP_OPTION = "-h, --help";
	const label = (f: FlagSpec) =>
		f.kind === "value" ? `--${f.name} <${f.value ?? "值"}>` : `--${f.name}`;
	const column =
		4 + Math.max(displayWidth(HELP_OPTION), ...FLAGS.map(f => displayWidth(label(f)))) + 2;
	const row = (indent: number, name: string, desc: string) =>
		" ".repeat(indent) +
		name +
		" ".repeat(Math.max(1, column - indent - displayWidth(name))) +
		desc;

	lines.push("", "Options:", `  ${GROUP_TITLE}`);
	for (const f of FLAGS) lines.push(row(4, label(f), f.desc));
	lines.push(row(2, HELP_OPTION, "Display this message"));

	for (const note of opts.notes ?? []) lines.push("", `${note.title}:`, note.body);
	return lines.join("\n");
}

// ══════════════════════ 入口 ══════════════════════

/**
 * 常用调用示例，作为 help 的追加段。
 *
 * @remarks
 * ⚠️ 这段是**手写的领域知识**（`renderHelp` 渲染不到它），改参数名时要一并改 ——
 * 不过 `selftest` 有一条断言从 `help` 的 `Options:` 段扫旗标，示例段不在它的覆盖范围内。
 */
const HELP_EXAMPLES = `  # 检索一部古籍里的原文（按段落匹配，不分词）
  node scripts/purple-star.ts classics --search 机月同梁

  # 控制命中条数（默认 15）
  node scripts/purple-star.ts classics --search 紫微 --limit 5

  # 不带关键词：列出已收录的书目与章数
  node scripts/purple-star.ts classics

  # 回归自检
  node scripts/purple-star.ts selftest`;

/**
 * 关于「本 skill 认哪些旗标」的说明，作为 help 的追加段。
 *
 * @remarks
 * 参数段里已经没有别的旗标了（它只遍历本 skill 的 {@link FLAGS}），故这里要说清的是
 * **其余旗标为什么不在**，免得用户以为是漏了。
 */
const HELP_FLAGS_NOTE = `本 skill **不排盘**：内核只有三部古籍的原文，故只认 --search 与 --limit。
其余旗标（--date / --gender / --city 等）在这里既不显示也不接受 —— 传了会报「未知参数」，
而不是静默忽略。要排盘用 purplestar-astrology，要合盘用 purplestar-synastry。`;

/** 整份帮助文本。 */
const HELP_TEXT = renderHelp({
	head: "紫微斗数古籍原文检索 —— 三部古籍全文，零排盘内核",
	commands: COMMAND_DESC,
	notes: [
		{ title: "说明", body: HELP_FLAGS_NOTE },
		{ title: "示例", body: HELP_EXAMPLES },
	],
});

/**
 * CLI 入口：取命令名 → 查 `COMMANDS` 表 → 解析参数 → 打印命令的返回值。
 *
 * @remarks
 * `console.log` 只在这一处发生 —— 各 `cmdXxx` 一律**返回**已渲染好的文本，由这里统一输出。
 *
 * 无参数、`help`、`--help`、`-h` 都打印 {@link HELP_TEXT}；未知命令与命令内部抛出的错误
 * 都以非零码退出（只打印 `err.message`，不打印栈）。
 *
 * ⚠️ `--help` / `-h` 的判定必须留在 `parseArgs` **之前**：它们不是本 skill 声明的旗标，
 * 交给解析器只会得到一句「未知参数」。留在前面还有个副作用 —— `--help` 出现在任何位置
 * （含 `classics --search x --help`）都会走帮助，这是刻意保留的宽松。
 *
 * ⚠️ 命令名直接来自 `argv`，故查表必然可能未命中 —— `COMMANDS` 的值类型显式带 `| undefined`。
 */
function main(): void {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	if (!cmd || cmd === "help" || argv.includes("--help") || argv.includes("-h")) {
		console.log(HELP_TEXT);
		return;
	}
	const fn = COMMANDS[cmd];
	if (!fn) {
		console.error(
			`未知命令「${cmd}」。可用：${Object.keys(COMMANDS).join(" / ")}\n运行 help 查看完整用法。`
		);
		process.exit(1);
	}
	try {
		console.log(fn(parseArgs(argv.slice(1))));
	} catch (err) {
		console.error(`错误：${(err as Error).message}`);
		process.exit(1);
	}
}

main();
