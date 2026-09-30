/**
 * 本 skill 的**参数作用域** —— 单 skill 认哪些参数。
 *
 * @remarks
 * 与 `./args.ts` 的分工：那份是**声明表 + 解析骨架**（`util.parseArgs` tokens 底座 +
 * 薄适配层），本文件则是「本 skill 认声明表里的哪些参数」那一层。
 *
 * 2026-09-30 三 skill 合一后全量声明表都归本 skill，这层在 Task 8 的 help 归属表
 * （命令 → 参数子集视图）之外保留了「参数名正面清单」的守门职责。
 *
 * ## 正面清单，且刻意不按命令派生
 *
 * 只列「认哪些参数」，不列「哪条命令读哪个参数」—— 后者是 help 归属表（视图）的事，
 * 不做硬校验。正面清单还天然 fail-closed：往声明表加一个新参数，它不会自动泄漏。
 *
 * ⚠️ **粒度是 skill 级**：`stars --json` 这类「本 skill 有、但当前命令不读」的参数
 * 仍会被收下不用。
 */
import type { OptionScope } from "./args";

/**
 * ⚠️ 类型标注写成 `: OptionScope`，**不要**改成 `as const satisfies OptionScope`：
 * 后者会把 `OPTION_SCOPE` 的类型钉成这里**字面量写出来的那个对象类型**，于是一旦某个
 * 可选字段（如 `prefixedCommands` 未给时的 `descOverrides`）没写，`args.ts` 里
 * `OPTION_SCOPE.descOverrides?.[...]` 就成了「访问一个不存在的属性」而编译不过 ——
 * 可选字段的「可选」在那一侧整个失效。这里也不需要字面量类型（args.ts 只用它建 Set）。
 */
export const OPTION_SCOPE: OptionScope = {
	/**
	 * 全量参数（英文主名；拼音别名在 `args.ts` 的 OPTION_ALIASES，不进这张表）。
	 *
	 * ⚠️ 这里的每一项都必须是 `args.ts` 的 `OPTION_GROUPS` 里真有的名字：拼错不会报错，
	 * 只会让那个参数失效（用户在 help 里看不到它，用了则报「未知参数」）。
	 */
	options: [
		// 出生日期（二选一）
		"date",
		"lunar",
		"leap",
		// 出生时辰（二选一）
		"time",
		"branch",
		"late-zi",
		"eot",
		// 其他出生信息
		"gender",
		"lng",
		"city",
		"province",
		"name",
		// 命盘输入（synastry 的 a- / b- 前缀叠在 chart 上）
		"chart",
		// 专题深入（英文主名；拼音别名见 OPTION_ALIASES）
		"info",
		"pattern",
		"mutagen",
		"decadal",
		"ages",
		"palaces",
		// 输出与选题
		"json",
		"yearly",
		"monthly",
		"focus",
		"topic",
		"view",
		"search",
		// classics
		"limit",
	],
	/**
	 * 合盘的出生方前缀（唯一的前缀消费者是 synastry 命令）。
	 * Task 7 输入改 `--charts` 单参数后此表回到空 —— a- / b- 前缀随之退役。
	 */
	sidePrefixes: ["a-", "b-"],
	prefixedCommands: ["synastry"],
};
