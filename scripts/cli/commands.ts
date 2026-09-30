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
export const COMMAND_DESC: Record<CommandName, string> = {
	astrology: "排盘分析一条命令（概览默认 + 功能参数：专题/--palaces/--topic）★ 最常用",
	stars: "星曜释义",
	classics: "古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）",
	synastry: "合盘（双宫联参 + 夫妻宫断语 + 四化入夫妻宫）",
	selftest: "回归自检（排盘 / 古籍 / 合盘三段：农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）",
};
