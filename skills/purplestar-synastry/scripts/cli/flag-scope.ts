/**
 * 本 skill 的**旗标作用域** —— 合盘认哪些旗标。
 *
 * @remarks
 * 与 `./args.ts` 的分工：那份是**三份逐字节相同**的副本（声明表 + cac/mri 的解析骨架），
 * 本文件则是**各 skill 自己写**的那一层差异。故它不进同步清单（见 `tools/skills.ts`），
 * 派生 skill 里各有一份内容不同的同名文件。
 *
 * ## 正面清单，且刻意不按命令派生
 *
 * 只列「认哪些旗标」，不列「哪条命令读哪个旗标」—— 后者正是 `args.ts` 的
 * {@link checkFlagName} 明确拒绝维护的归属表（见那里的 ⚠️）。正面清单还天然 fail-closed：
 * 往声明表加一个新旗标，它不会自动泄漏给没声明它的 skill，加的人必须决定它归谁。
 *
 * ⚠️ **粒度是 skill 级**：`selftest --json` 这类「本 skill 有、但当前命令不读」的
 * 参数仍会被收下不用。要修就得把每条命令实际读的键也声明出来，本仓不做。
 *
 * ## 本 skill 是唯一认 `a-` / `b-` 前缀的
 *
 * 合盘要同时读**两方**出生信息，故 15 个出生信息旗标都能叠前缀。`prefixedCommands`
 * 这一维**不能省**：它声明只有 `synastry` 读前缀，别的命令（如 `selftest`）不排盘，
 * 给它 `--a-date` 是**用户搞错了命令** —— 静默忽略会让人以为「带了出生信息却没生效」，
 * 排查方向被整个带偏。本 skill 的 `selftest` 有一条断言钉着这件事。
 */
import type { FlagScope } from "./args";

/**
 * ⚠️ 类型标注写成 `: FlagScope`，**不要**改成 `as const satisfies FlagScope`：
 * 后者会把 `FLAG_SCOPE` 的类型钉成这里**字面量写出来的那个对象类型** —— 本文件没写
 * `descOverrides`，`args.ts` 里 `FLAG_SCOPE.descOverrides?.[...]` 便成了「访问一个
 * 不存在的属性」而编译不过；`prefixedCommands.includes(command)` 同理，会被要求参数
 * 必须是字面量 `"synastry"`。可选字段的「可选」在那一侧整个失效。
 */
export const FLAG_SCOPE: FlagScope = {
	/**
	 * 15 个出生信息旗标（`synastry` 上各自还能叠 `a-` / `b-`）+ `--json`。
	 *
	 * ⚠️ 这里的每一项都必须是 `args.ts` 的 `FLAG_GROUPS` 里真有的名字：拼错不会报错，
	 * 只会让那个旗标在**本 skill 里失效**（用户在 help 里看不到它，用了则报「未知参数」）。
	 * 仓库测试盯这条：各作用域 ⊆ 全集，且全集 ⊆ 三作用域之并。
	 *
	 * ⚠️ 也**必须是全集里出生信息那一整组**：本 skill 的 `selftest` 会扫 `SKILL.md`
	 * 提到的旗标（剥掉前缀后）逐个查这里，漏一个就有一条断言变红。
	 */
	flags: [
		// 出生日期（三选一）
		"date",
		"lunar",
		"leap",
		"year",
		"month",
		"day",
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
		// 输出
		"json",
	],
	/** 两方出生信息的前缀 —— 全仓只有本 skill 认它们。 */
	sidePrefixes: ["a-", "b-"],
	/** 只有 `synastry` 排盘，故只有它读前缀；其余命令给了前缀要报错。 */
	prefixedCommands: ["synastry"],
};
