/**
 * 命令注册薄层 —— 只留 COMMAND_TABLE 与 COMMAND_DESC。
 *
 * 2026-09-30 各命令实现按文件拆分（spec §2.2「cli/ 按命令一文件」）：
 * 各 `cmdXxx` 住在各自的 `cli/<命令名>.ts`，本文件只做注册 —— 改某条命令去它的文件，
 * 加命令则在这里挂一行（漏挂的命令敲了就是「未知命令」）。
 *
 * `cities` 命令已删（spec §3.1）：`ziwei/cities.ts` 的数据表**保留**（`--city` 的容错
 * 解析与省名回退仍在用），删的只是查询命令。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 各命令文件。
 */

import type { CliArgs, CliContext } from "./args";
import { cmdSelftest } from "./selftest";
import { cmdAstrology } from "./astrology";
import { cmdStars } from "./stars";
import { cmdClassics } from "./classics";
import { cmdSynastry } from "./synastry";

// ══════════════════════ 命令表 ══════════════════════

/** 命令实现的签名：返回**已渲染好的文本**，由引导层统一 `console.log`。 */
type Cmd = (args: CliArgs, ctx: CliContext) => string;

/**
 * 命令名 → 实现。
 *
 * @remarks
 * 刻意**不导出**这张裸表：导出的是下面两个视图（{@link COMMANDS} 供分发、
 * {@link COMMAND_DESC} 供渲染 HELP）。调用方拿不到「键集与描述可能对不上」的中间态。
 *
 * 用 `satisfies` 而非 `: Record<...>` 标注，是为了保住字面量键集 ——
 * `CommandName` 与 `COMMAND_DESC` 的完备性都建立在它之上（见下）。
 */
const COMMAND_TABLE = {
	astrology: cmdAstrology,
	stars: cmdStars,
	classics: cmdClassics,
	synastry: cmdSynastry,
	selftest: (_args: CliArgs, ctx: CliContext) => cmdSelftest(ctx),
} satisfies Record<string, Cmd>;

/** 合法命令名。 */
export type CommandName = keyof typeof COMMAND_TABLE;

/**
 * 分发用的命令表：命令名 → 实现。
 *
 * @remarks
 * 值类型显式写出 `| undefined`：命令名来自 argv，查表必然未命中，
 * 这里让「未命中」在类型上就成立，而不是靠断言把 undefined 抹掉。
 *
 * 多数命令（含各 `cmdXxx`）只需要 args，签名里少的那个参数 TS 允许省略；
 * 只有 selftest 用得上 ctx（它要在输出里交代内核根是哪一份）。
 *
 * `help` 不在表内 —— 引导层单独处理，见 `purple-star.ts` 的 `main()`。
 */
export const COMMANDS: Record<string, Cmd | undefined> = COMMAND_TABLE;

/**
 * 命令名 → 一行说明，HELP 的命令段据此派生。
 *
 * @remarks
 * 类型写成 `Record<CommandName, string>` 而非 `Record<string, string>`：**新增命令忘了
 * 写说明就编译不过**。
 */
/**
 * 命令名 → 多行详细说明（`<命令> --help` 的 DESCRIPTION 节，spec §3.2）。
 *
 * @remarks
 * 与 COMMAND_DESC 的分工：DESC 是一行速览（总览 COMMANDS 节），HELP 是逐命令展开
 * （功能 / 专属参数 / 注意事项）。类型钉在 CommandName 上，新增命令漏写说明编译不过。
 */
export const COMMAND_HELP: Record<CommandName, readonly string[]> = {
	astrology: [
		"排盘分析一条命令（2026-09-30 四命令合一：原 analyze / chart / topic 融入参数）。",
		"不带功能参数 = 概览：命盘总览三行 + 基本信息 12 行面板（无条件）+ 口径提示 + 运限速览 + 功能参数指路。",
		"功能参数可叠加：--pattern 格局 / --mutagen 四化 / --yearly [年] 流年 / --monthly 流月 /",
		"--decadal [虚岁] 大限 / --ages [虚岁] 小限 / --focus <宫>（四项深化：三方四正逐宫全星曜、",
		"对宫完整详表、涉及格局全列、运限引动年份）/ --palaces 十二宫逐宫详表 / --topic 主题论断。",
		"出生信息支持零参数快捷形态（按形态归类、顺序无关）与完整参数形态，二者可混用（参数优先）。",
		"⚠️ 排盘四必问：日期、时间、性别、出生地 —— 缺一问一，不要猜。",
	],
	stars: ["星曜释义查询：不给关键词列出全部已收录星曜，给定时出该星的「关键词 · 星性 · 五行」。"],
	classics: [
		"古籍原文检索（骨髓赋 / 紫微斗数全集 / 紫微斗数全书三部全文）。",
		"逐段子串匹配（不分词、繁简不转换）；--limit 控制命中条数上限（默认 15，正整数）。",
		"解读需要引原句佐证时用本命令，不要凭记忆转写古籍。",
	],
	synastry: [
		"合盘（双宫联参）：看婚姻不能只看夫妻宫，必须同时看福德宫（倪海夏口径）。",
		"输入 --charts 为逗号分隔恰好两份 astrology --json 的产物（甲先乙后；两路径相同 = 自盘对照，允许）。",
		"输出两方命宫 / 夫妻宫 / 福德宫主星、天作之合判定、夫妻宫断语（空宫借对宫）、",
		"生年四化入夫妻宫、桃花孤克星；方法论与评分标准见 references/synastry-guide.md。",
		"⚠️ 本命令不排盘：没有出生信息回退路径，缺输入会指路先排盘。",
	],
	selftest: [
		"回归自检（排盘 / 古籍 / 合盘三段合一，末行自报项数）。",
		"改动本 skill、升级 iztro 或换 Node 版本后跑一次；有失败项时退出码非零。",
	],
};

export const COMMAND_DESC: Record<CommandName, string> = {
	astrology: "排盘分析一条命令（概览默认 + 功能参数：专题/--palaces/--topic）★ 最常用",
	stars: "星曜释义",
	classics: "古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）",
	synastry: "合盘（双宫联参 + 夫妻宫断语 + 四化入夫妻宫）",
	selftest: "回归自检（排盘 / 古籍 / 合盘三段：农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）",
};
