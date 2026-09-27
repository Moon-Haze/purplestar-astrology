/**
 * 本 skill 的**旗标作用域** —— 合盘认哪些旗标。
 *
 * @remarks
 * 与 `./args.ts` 的分工：那份是**声明表 + 解析骨架**（`node:util` 的 `parseArgs` 驱动），
 * 本文件则是**各 skill 自己写**的那一层差异。故它不进同步清单（见 `tools/skills.ts`），
 * 派生 skill 里各有一份内容不同的同名文件。
 *
 * ⚠️ `args.ts` 与源 skill 那份**不再逐字节相同**（2026-09-27 换引擎）：源仍用 `cac`，
 * 两个派生用内置 `parseArgs`。两份派生副本之间逐字节相同，且**以 `purplestar-classics`
 * 那份为准** —— 就地改本文件那份会被「两份必须相同」的层 6 断言当场抓住。
 *
 * ## 正面清单，且刻意不按命令派生
 *
 * 只列「认哪些旗标」，不列「哪条命令读哪个旗标」—— 后者正是 `args.ts` 的
 * {@link checkFlagName} 明确拒绝维护的归属表（见那里的 ⚠️）。正面清单还天然 fail-closed：
 * 往声明表加一个新旗标，它不会自动泄漏给没声明它的 skill，加的人必须决定它归谁。
 *
 * ⚠️ **粒度是 skill 级**：`selftest --chart x` 这类「本 skill 有、但当前命令不读」的
 * 参数仍会被收下不用。要修就得把每条命令实际读的键也声明出来，本仓不做。
 *
 * ## 本 skill **不排盘**，故不再认任何出生信息旗标（2026-09-27 起）
 *
 * 从前这里列着 15 个出生信息旗标，因为 `synastry` 就地排两张盘。改造后命盘由
 * `purplestar-astrology` 产出，本 skill 只读它的 JSON，于是那 15 个旗标**既不注册**
 * （help 里看不到）**也不被接受**（用了直接报「未知参数」），而不是以前那样被静默收下。
 * 这与 `purplestar-classics` 的形态一致：不排盘的 skill，作用域里就没有出生信息。
 *
 * ⚠️ 连带影响：`SKILL.md` 里那些讲「出生信息漏了 `a-` 前缀会静默排出错盘」的段落
 * 已整个不成立（前缀现在只叠在 `--chart` 上），必须同步删掉 —— 本 skill 的 `selftest`
 * 会扫 `SKILL.md` 提到的旗标逐个查这里，提到任何一个出生信息旗标都会变红。
 *
 * ## 本 skill 仍是唯一认 `a-` / `b-` 前缀的
 *
 * 前缀的语义没变：合盘要同时读**两方**，故 `--chart` 能叠成 `--a-chart` / `--b-chart`。
 * `prefixedCommands` 这一维**不能省**：它声明只有 `synastry` 读前缀，别的命令（如
 * `selftest`）不读，给它 `--a-chart` 是**用户搞错了命令** —— 静默忽略会让人以为
 * 「带了命盘却没生效」，排查方向被整个带偏。本 skill 的 `selftest` 有一条断言钉着这件事。
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
	 * `--chart`（两方各一份命盘 JSON，可叠 `a-` / `b-` 前缀）+ `--json`。
	 *
	 * ⚠️ 这里的每一项都必须是 `args.ts` 的 `FLAG_GROUPS` 里真有的名字：拼错不会报错，
	 * 只会让那个旗标在**本 skill 里失效**（用户在 help 里看不到它，用了则报「未知参数」）。
	 * 仓库测试盯这条：各作用域 ⊆ 全集，且全集 ⊆ 三作用域之并 —— 后半句意味着
	 * **每个旗标都得有归属**，`--chart` 归本 skill。
	 */
	flags: ["chart", "json"],
	/** 两方命盘的前缀 —— 全仓只有本 skill 认它们。 */
	sidePrefixes: ["a-", "b-"],
	/** 只有 `synastry` 读前缀（也只有它读 `--chart`）；其余命令给了前缀要报错。 */
	prefixedCommands: ["synastry"],
	/**
	 * 声明表里的 desc 是**全集视角**写的，只说「代替该方出生信息」而不提前缀怎么写。
	 * 本 skill 的 help 里必须把「`--chart` 实际要敲成 `--a-chart` / `--b-chart`」说清楚
	 * —— 前缀机制是本 skill 独有的一维，用户在别处没见过它。
	 */
	descOverrides: {
		chart: "读 purplestar-astrology 的 analyze --json 输出（本 skill 靠它拿盘；书写时加 a- / b- 前缀，如 --a-chart /tmp/a.json）",
	},
};
