/**
 * 命令注册薄层：COMMAND_TABLE、COMMAND_DESC；加命令挂一行（漏挂即「未知命令」）。
 * @file 命令注册薄层
 */

import type { CliArgs, CliContext } from "../args";
import { cmdSelftest } from "../selftest";
import { cmdAstrology } from "./astrology";
import { cmdKnowledge } from "../knowledge";
import { cmdSynastry } from "./synastry";

import type { CommandName } from "./command-meta";

export { COMMAND_DESC, COMMAND_HELP, COMMAND_NAMES } from "./command-meta";
export type { CommandName } from "./command-meta";

/**
 * 命令签名：返回已渲染文本或 Promise。
 * @remarks async 为 `cmdSelftest` 打破静态环，见 docs/code/cli-commands.md。
 */
type Cmd = (args: CliArgs, ctx: CliContext) => string | Promise<string>;

/**
 * 命令名 → 实现。
 * @remarks 只导出 COMMANDS/COMMAND_DESC，`satisfies` 保键集。
 */
const COMMAND_TABLE = {
	astrology: cmdAstrology,
	knowledge: cmdKnowledge,
	synastry: cmdSynastry,
	selftest: (_args: CliArgs, ctx: CliContext) => cmdSelftest(ctx),
} satisfies Record<CommandName, Cmd>;

/**
 * 分发用命令表。
 * @remarks 值类型 `| undefined` 让「未命中」成立；`help` 单独处理，见 `purple-star.ts`。
 */
export const COMMANDS: Record<string, Cmd | undefined> = COMMAND_TABLE;
