/**
 * CLI 参数解析引擎 —— `util.parseArgs` tokens 底座 + 薄适配层（cac 已退役）。
 * 不依赖任何内核模块，也不使用 `@/` 别名；三层分工里本文件只管**怎么解析**。
 *
 * 薄适配层做四件事：声明表校验（未知参数中文报错）、别名归一、判重（重复报错，
 * 旧「取末值」废止）、贪婪取值（`--limit -3` 的 `-3` 是值，**版本敏感**，selftest 钉死）。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载 —— 不要在 purple-star.ts 顶部用
 *    静态 `import` 引它（钩子未注册时解析会失败）。底座与适配层的分工论证、
 *    `--ctiy 喀什` 那类静默失败史，见 docs/code/cli-args.md。
 */

import { parseArgs as nodeParseArgs } from "node:util";

import { OPTION_SCOPE } from "./scope";
import {
	ALL_OPTION_NAMES,
	camelKey,
	OPTION_ALIASES,
	OPTION_GROUPS,
	type OptionSpec,
} from "./table";

/**
 * CLI 参数表：`_` 收位置参数，其余键对应 `--key`（camelCase）。
 *
 * @remarks
 * 带值的参数存 `string`，纯开关存 `boolean` 的 `true`（见 {@link parseArgs}），
 * 因此取值前通常要先收窄类型。
 *
 * 索引签名里保留 `string[]` 是为了与 `_` 的写入同域 —— TS 要求索引签名涵盖所有具名属性。
 */
export interface CliArgs {
	/** 位置参数：非 `--` 开头的 argv 项，按出现顺序收集（`astrology` 命令另有形态归类） */
	_: string[];
	[key: string]: string | boolean | string[];
}

/**
 * **本 skill** 认的参数名（英文主名）—— {@link parseArgs} 的校验基准，
 * 同时是 {@link suggestOption} 的候选集。
 *
 * @remarks
 * 从 `./table` 的全集按 `OPTION_SCOPE.excluded` **差量**派生：单 skill 形态下排除表为空，
 * 作用域即全集 —— 「有哪些参数」因此真正只有 OPTION_GROUPS 一处声明。
 */
export const OPTION_NAMES: ReadonlySet<string> = new Set(
	[...ALL_OPTION_NAMES].filter(n => !OPTION_SCOPE.excluded.includes(n))
);

/** 主名 → 声明（扫描循环里反复查，建一次索引）。 */
const ALL_SPECS: ReadonlyMap<string, OptionSpec> = new Map(
	OPTION_GROUPS.flatMap(g => g.options).map(o => [o.name, o])
);

/**
 * 本 skill 认的出生方前缀（合盘是 `a-` / `b-`，它要分别读两方的命盘）。
 *
 * @remarks
 * 取自 `./scope` 的 `OPTION_SCOPE.sidePrefixes`。导出是给 selftest 用的：它扫 `SKILL.md`
 * 里提到的参数，要先剥掉这层前缀再与 {@link OPTION_NAMES} 比对 —— 前缀表不该有第二份。
 */
export const SIDE_PREFIXES: readonly string[] = OPTION_SCOPE.sidePrefixes;

/**
 * 编辑距离：把 `a` 改成 `b` 至少几步。只用于「拼错了？最接近的是……」这句提示，
 * 故实现取最朴素的滚动数组版本，不追求性能。
 */
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

/**
 * 在合法参数名里找与 `name` 最接近的一个。
 *
 * @param name - 用户实际敲的参数名（不含 `--`）
 * @returns 编辑距离 ≤ 2 的最近者；都不够近则 `null`
 *
 * @remarks
 * 阈值取 2 是权衡：`ctiy` → `city`（换位算 2 步）、`year` → `yearly` 都要抓；
 * 再放宽就会开始乱建议，反而把提示变成噪声。
 */
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

/**
 * 校验参数名（先别名归一，再查主名表），不合法即抛错。
 *
 * @param key - 已剥掉 `--` 的参数名（可带出生方前缀）
 * @param command - 当前命令名；接受前缀的那几条由 `option-scope.ts` 的 `prefixedCommands` 声明
 *
 * @remarks
 * 三条规则各挡一种**静默失败**：① 归一后不在 {@link OPTION_NAMES} → 拼错，报最近的名字；
 * ② 前缀出现在不收它的命令上（写法被整个忽略，排的是默认经度的盘）；
 * ③ 前缀后仍须是声明过的名字。
 *
 * ⚠️ 刻意**不**校验「这个参数属于这个命令」—— 把归属做成硬约束会让每条命令的合法集合
 *    成为第二个需要维护的真相，拼错才是要挡的。三条的展开见 docs/code/cli-args.md。
 */
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

/** `util.parseArgs` 的 token（`strict: false` 形态，官方类型的宽松收窄）。 */
interface Token {
	kind: "option" | "positional" | "option-terminator";
	index: number;
	/** option：不含 `--` 的名字（可能来自 `-3` 这类短假名，见 parseArgs 的扫描注释） */
	name?: string;
	/** option：用户敲的原文（如 `--limit` / `-3`） */
	rawName?: string;
	/** option：`--key=value` 的内联值；空格式或 positional 无此字段 */
	value?: string;
	/** option：值是否内联（`--key=value` 为 true） */
	inlineValue?: boolean;
}

/**
 * 参数解析：`--key value` / `--key=value` / `--flag` / `--` 分隔 / 重复报错 / 别名归一。
 *
 * @param argv - 待解析的参数数组（**不含**命令名）
 * @param command - 当前命令名。给了就**校验参数名**（见 {@link checkOptionName}），
 *   未知或错位的前缀参数一律抛错而非静默忽略
 * @returns 参数表；键已归一为 camelCase 的英文主名；`--flag` 裸开关存布尔 `true`
 *
 * @remarks
 * **两步：底座切分 → 单趟适配**（底座 `nodeParseArgs({ strict: false, tokens: true })`
 * 只交 token 流，取值判据 / 判重 / 归一 / 中文报错全在这趟扫描里）：
 * 贪婪取值（`--limit -3` 的 `-3` 是值，⚠️ **版本敏感**，selftest 钉死）·
 * 重复报错（旧 cac「取末值」废止）· `--` 之后全进 `_` · `-x` 短参数一律报错。
 *
 * `command` 省略即退回「照单全收」的宽松解析。四条规则的展开见 docs/code/cli-args.md。
 */
export function parseArgs(argv: string[], command?: string): CliArgs {
	const { tokens } = nodeParseArgs({
		args: argv,
		strict: false,
		tokens: true,
	}) as { tokens: Token[] };

	const args: CliArgs = { _: [] };
	/** 已出现的归一后主名（camelCase）—— 判重基准 */
	const seen = new Set<string>();
	/** `--` 之后的内容只进 `_`，不参与 astrology 的形态归类 */
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

/**
 * 出生信息位置参数的形态归类（spec §1.2）。
 *
 * @param tokens - 位置参数（已剔除 `--` 之后的内容）
 * @returns `date` / `time` / `gender` / `city` 四键（camelCase，与旗标同名）
 * @throws 同类 token 出现两个（两个日期 / 两个城市 …）—— 省与市带空格同属此类，
 *   报错并提示连写
 *
 * @remarks
 * 形态正则：日期 `^\d{4}-\d{1,2}-\d{1,2}$`、时刻 `^\d{1,2}:\d{2}$`、性别 `男|女|male|female|m|f`，
 * 其余中文 token 为城市名（含省市连写与裸省名）。农历生日只能走 `--lunar`（与公历同形）。
 *
 * ⚠️ 住本文件而非 `birth-info.ts`（计划原案）：归类在 {@link parseArgs} 内完成，而
 *    birth-info 静态 import 本文件的 {@link CliArgs} —— 挪过去会成环（见 docs/code/cli-args.md）。
 */
export function classifyPositionals(tokens: readonly string[]): Partial<CliArgs> {
	const out: Partial<CliArgs> = {};
	/** 同类槽位：已有值即同类重复。城市槽的报错文案额外提示连写。 */
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

/**
 * 运行期上下文：只有引导层才知道的东西。
 *
 * 目前仅 selftest 用得上（它要在输出里交代「排这张盘用的是哪一份内核」），
 * 但类型在此统一，免得将来再多一个命令时又改一遍所有签名。
 */
export interface CliContext {
	/** 实际生效的内核根目录（已解析为绝对路径） */
	root: string;
	/** 该根目录的来源描述，如「技能自带内核」「ZIWEI_ROOT 环境变量」 */
	rootLabel: string;
}
