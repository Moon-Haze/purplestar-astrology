/**
 * 本 skill 的**旗标作用域** —— 排盘解读认哪些旗标。
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
 * ⚠️ **粒度是 skill 级**：`stars --json` 这类「本 skill 有、但当前命令不读」的参数
 * 仍会被收下不用。要修就得把每条命令实际读的键也声明出来，本仓不做。
 *
 * ## 本 skill 为什么两串前缀都是空的
 *
 * `a-` / `b-` 是**合盘**的写法（`synastry` 要分别读两方出生信息），本 skill 的单人命盘
 * 没有第二个出生方，故 `sidePrefixes` 为空。空数组不是省略：它让 `args.ts` 里的前缀分支
 * 与 `LEGAL_KEYS` 的前缀展开**整个不可达**——「前缀」这个概念在本 skill 里不存在。
 * 随之而来的一条行为变更：`analyze --a-city 北京` 由**静默忽略**变为**报错**
 * （以前它会排出一张默认经度的盘，全程无提示）。
 */
import type { FlagScope } from "./args";

/**
 * ⚠️ 类型标注写成 `: FlagScope`，**不要**改成 `as const satisfies FlagScope`：
 * 后者会把 `FLAG_SCOPE` 的类型钉成这里**字面量写出来的那个对象类型**，于是一旦某个
 * 可选字段（如 `prefixedCommands` 未给时的 `descOverrides`）没写，`args.ts` 里
 * `FLAG_SCOPE.descOverrides?.[...]` 就成了「访问一个不存在的属性」而编译不过 ——
 * 可选字段的「可选」在那一侧整个失效。这里也不需要字面量类型（args.ts 只用它建 Set）。
 */
export const FLAG_SCOPE: FlagScope = {
	/**
	 * 15 个出生信息旗标 + 7 个输出/选题旗标。
	 *
	 * ⚠️ 这里的每一项都必须是 `args.ts` 的 `FLAG_GROUPS` 里真有的名字：拼错不会报错，
	 * 只会让那个旗标在**本 skill 里失效**（用户在 help 里看不到它，用了则报「未知参数」）。
	 * 仓库测试盯这条：各作用域 ⊆ 全集，且全集 ⊆ 三作用域之并。
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
		// 输出与选题
		"json",
		"liunian",
		"liuyue",
		"focus",
		"topic",
		"view",
		"search",
	],
	sidePrefixes: [],
	prefixedCommands: [],
	/**
	 * 声明表里的 desc 是**全集视角**写的（`--search` 原写着「classics / stars / cities」），
	 * 而本 skill 没有 `classics` 命令——那句在 help 里会指着一个不存在的命令。
	 */
	descOverrides: {
		search: "stars / cities 检索关键字（也可用位置参数）",
	},
};
