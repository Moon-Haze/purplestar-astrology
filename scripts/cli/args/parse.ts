/** 解析。@remarks registerHooks 加载，purple-star.ts 静态 import 即崩；`--ctiy 喀什` 见 docs/code/cli-args.md。 */

import { parseArgs as nodeParseArgs } from "node:util";

import { OPTION_SCOPE } from "./scope";
import {
	ALL_OPTION_NAMES,
	camelKey,
	OPTION_ALIASES,
	OPTION_GROUPS,
	type OptionSpec,
} from "./table";

/** 表。@remarks 带值 string/开关 true（{@link parseArgs}）收窄；string[] 与 _ 同域（TS）。 */
export interface CliArgs {
	/** 位置参数 */
	_: string[];
	[key: string]: string | boolean | string[];
}

/** 名。@remarks {@link parseArgs}/{@link suggestOption}：excluded 派生，空表全集；「有哪些参数」仅 OPTION_GROUPS 声明。 */
export const OPTION_NAMES: ReadonlySet<string> = new Set(
	[...ALL_OPTION_NAMES].filter(n => !OPTION_SCOPE.excluded.includes(n))
);

/** 主名→声明索引 */
const ALL_SPECS: ReadonlyMap<string, OptionSpec> = new Map(
	OPTION_GROUPS.flatMap(g => g.options).map(o => [o.name, o])
);

/** 前缀。@remarks selftest 扫 `SKILL.md` 剥前缀比 {@link OPTION_NAMES}，勿存第二份。 */
export const SIDE_PREFIXES: readonly string[] = OPTION_SCOPE.sidePrefixes;

/** 步数（「拼错了？最接近的是……」）。@param a - 名 @param b - 候选 @returns 步数 */
function editDistance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			cur.push(Math.min(sub, prev[j] + 1, cur[j - 1] + 1));
		}
		prev = cur;
	}
	return prev[b.length];
}

/** 最近名。@param name - 名 @returns ≤2 近者或 `null` @remarks 阈值 2，放宽即噪声。 */
export function suggestOption(name: string): string | null {
	let best: string | null = null;
	let bestD = 3;
	for (const n of OPTION_NAMES) {
		const d = editDistance(name, n);
		if (d < bestD) {
			bestD = d;
			best = n;
		} else if (d === bestD && best !== null && n.includes(name) && !best.includes(name)) {
			// 同距离偏好**包含**敲入名的候选：`--year` 距 `--leap` 与 `--yearly` 同为 2，
			// 但 yearly 以 year 为前缀，几乎总是用户想要的那个（leap 只是无辜的等距词）。
			best = n;
		}
	}
	return best;
}

/** 查名。@param key - 名 @param command - 命令 @remarks 防静默：非 {@link OPTION_NAMES}→最近名；前缀落不收命令→默认经度盘；前缀后须声明。⚠️ 不查「这个参数属于这个命令」（第二真相）。 @returns 主名 @throws 非 `prefixedCommands` 前缀→指路；非 {@link OPTION_NAMES} 非别名→最近提示 */
function checkOptionName(key: string, command: string | undefined): string {
	const prefix = SIDE_PREFIXES.find(p => key.startsWith(p));
	if (prefix) {
		// 前缀只在作用域声明的那几条命令上合法（合盘是 synastry）。
		if (command === undefined || !OPTION_SCOPE.prefixedCommands.includes(command)) {
			throw new Error(
				`--${key}：\`${prefix}\` 前缀只有 ${OPTION_SCOPE.prefixedCommands.join(" / ")} 命令认` +
					`（它要分别读 ${SIDE_PREFIXES.join(" / ")} 两方）。` +
					`${command ? `当前命令是 ${command}，` : ""}请改用 --${key.slice(prefix.length)}。`
			);
		}
		return prefix + checkOptionName(key.slice(prefix.length), command);
	}
	// 别名归一：--geju → --pattern（显式声明的映射，不是拼错容错）
	const canonical = OPTION_ALIASES[key] ?? key;
	if (OPTION_NAMES.has(canonical)) {
		return canonical;
	}
	const hint = suggestOption(canonical);
	throw new Error(
		`未知参数 --${key}。${hint ? `最接近的是 --${hint}。` : ""}运行 help 查看全部参数。`
	);
}

/** token（`strict: false`） */
interface Token {
	/** 类别 */
	kind: "option" | "positional" | "option-terminator";
	/** argv 下标 */
	index: number;
	/** 名（或 `-3` 假名） */
	name?: string;
	/** 原文 */
	rawName?: string;
	/** 内联值 */
	value?: string;
	/** 内联? */
	inlineValue?: boolean;
}

/** 解析（`--key`/`--flag`）。@param argv - 参 @param command - 命令 @returns 表 @remarks `--limit -3` 取值（版本敏感，selftest 钉死）、「取末值」废止、`--` 进 `_`、`-x` 报错、省略 command 即「照单全收」；见 {@link checkOptionName}、docs/code/cli-args.md。 */
export function parseArgs(argv: string[], command?: string): CliArgs {
	const { tokens } = nodeParseArgs({
		args: argv,
		strict: false,
		tokens: true,
	}) as { tokens: Token[] };

	const args: CliArgs = { _: [] };
	/** 判重 */
	const seen = new Set<string>();
	/** `--` 后进 `_` */
	let afterTerminator = false;

	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.kind === "option-terminator") {
			// 其后一切皆位置参数（不参与 astrology 的形态归类）
			afterTerminator = true;
			for (let j = i + 1; j < tokens.length; j++) {
				const rest = tokens[j];
				args._.push(
					rest.kind === "positional" ? (rest.value as string) : (rest.rawName as string)
				);
			}
			break;
		}
		if (t.kind === "positional") {
			args._.push(t.value as string);
			continue;
		} // option token（含 `-3` 这类假名——贪婪吃值会先把它消费掉，落到这里的才是真短参数）
		const raw = String(t.rawName ?? "");
		const key = String(t.name ?? "");
		if (raw.startsWith("-") && !raw.startsWith("--")) {
			// 单独的 `-` 是「stdin」的传统写法，当位置参数；其余 `-x` 一律拒绝
			if (raw === "-") {
				args._.push("-");
				continue;
			}
			throw new Error(
				`未知参数 ${raw}。本项目只有 --xxx 长参数形式。运行 help 查看全部参数。`
			);
		}
		// 校验 + 别名归一（宽松模式跳过校验，直接归一）
		const canonical =
			command !== undefined ? checkOptionName(key, command) : (OPTION_ALIASES[key] ?? key);
		const spec = ALL_SPECS.get(canonical);
		const storeKey = camelKey(canonical);
		// 判重：归一后主名判（前缀形态的 storeKey 天然不同：aChart ≠ chart，不算重复）
		if (seen.has(storeKey)) {
			throw new Error(`参数 --${canonical} 重复给出（含主名与别名同现）。每个参数只给一次。`);
		}
		seen.add(storeKey);

		if (spec?.kind === "switch") {
			if (t.inlineValue === true) {
				throw new Error(`--${canonical} 是开关，不接受值。运行 help 查看全部参数。`);
			}
			args[storeKey] = true;
			continue;
		}
		// 取值参数：内联值直接取；空格式贪婪吃**紧随 token**（不论形状）。
		// 紧随 token 是另一个 option / terminator / 结尾时，存布尔 true（可选值形态：
		// `--decadal` 裸开关 = 默认当前虚岁、`--topic` 裸开关 = 列清单）——
		// 是否接受裸开关由各命令自己的取值校验兜底（如 cmdKnowledge 把布尔判为非法）。
		if (t.inlineValue === true) {
			args[storeKey] = String(t.value);
			continue;
		}
		const next = tokens[i + 1];
		// 紧随 token 是真 option（`--xxx`）/ terminator / 结尾 → 可选值形态存 true。
		// ⚠️ `-3` 这类假 option（底座把负数切成 name "3" 的 option token）**不算**——
		//    贪婪取值恰恰要吃它（`--limit -3` 的 -3 是值）。
		if (
			!next ||
			next.kind === "option-terminator" ||
			(next.kind === "option" && String(next.rawName).startsWith("--"))
		) {
			args[storeKey] = true;
			continue;
		}
		// 贪婪吃值：positional 的 value 或假 option 的 rawName（`-3`）
		args[storeKey] = next.kind === "positional" ? String(next.value) : String(next.rawName);
		i++;
	}

	// ── astrology 命令的位置参数形态归类（spec §1.2）──
	// 其他命令的 `_` 原样保留；astrology 的出生信息可零参数给，按形态归类、顺序无关。
	// `--` 之后的内容已进 `_` 且不归类（用户明确说了「这些是字面量」）。
	if (command === "astrology" && args._.length && !afterTerminator) {
		const pos = classifyPositionals(args._);
		args._ = [];
		// 参数优先：位置参数只填空，旗标已给的项不被覆盖
		for (const [k, v] of Object.entries(pos)) {
			if (v !== undefined && args[k] === undefined) {
				args[k] = v;
			}
		}
	}
	return args;
}

/** 归类。@param tokens - 参 @returns date/time/gender/city @throws 同类重复→连写 @remarks 农历仅 `--lunar`；⚠️ 免与 `birth-info.ts` 成环（{@link parseArgs}/{@link CliArgs}）。 */
export function classifyPositionals(tokens: readonly string[]): Partial<CliArgs> {
	const out: Partial<CliArgs> = {};
	/** 重复→连写 */
	const put = (slot: "date" | "time" | "gender" | "city", value: string) => {
		if (out[slot] !== undefined) {
			throw new Error(
				slot === "city"
					? `城市 token 只能给一个：省+市请连写（如「山东青岛」），或用 --city / --province 分别指定。收到：${out[slot]} 与 ${value}`
					: `同类出生信息 token 只能给一个（${slot}）：已收 ${out[slot]}，又收 ${value}`
			);
		}
		out[slot] = value;
	};
	for (const t of tokens) {
		if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
			put("date", t);
		} else if (/^\d{1,2}:\d{2}$/.test(t)) {
			put("time", t);
		} else if (/^(男|女|male|female|m|f)$/i.test(t)) {
			put("gender", t);
		} else if (/[\u4e00-\u9fff]/.test(t)) {
			put("city", t);
		} else {
			throw new Error(
				`无法识别的位置参数：${t}。出生信息按形态归类（日期 YYYY-M-D / 时刻 HH:MM / 性别 / 中文城市名），` +
					`其余输入请用参数给出。运行 help 查看全部参数。`
			);
		}
	}
	return out;
}

/** 上下文（「排这张盘用的是哪一份内核」）；统一类型免改签名。 */
export interface CliContext {
	/** 内核根（绝对） */
	root: string;
	/** 来源：「技能自带内核」「ZIWEI_ROOT 环境变量」 */
	rootLabel: string;
}
