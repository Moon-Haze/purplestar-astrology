/**
 * 命令注册薄层 —— 只留 COMMAND_TABLE 与 COMMAND_DESC。
 *
 * 各命令实现按文件拆分（spec §2.2「cli/ 按命令一文件」）：
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
// 命令名清单与 HELP 描述文案住在 command-meta（轻模块，不 import 命令实现）——
// help / 未知命令路径只需要它们，不必拉起 iztro（见 purple-star.ts 的懒加载）。
import type { CommandName } from "./command-meta";

// 公开面保持不变：meta 从这里 re-export，旧调用方（help.ts 已改直连 meta）零感知。
export { COMMAND_DESC, COMMAND_HELP, COMMAND_NAMES } from "./command-meta";
export type { CommandName } from "./command-meta";

// ══════════════════════ 命令表 ══════════════════════

/**
 * 命令实现的签名：返回**已渲染好的文本**（或其 Promise），由引导层统一 `await` 后 `console.log`。
 *
 * @remarks
 * 允许 async 是给 `cmdSelftest` 的：它要 `await import("./commands")` 取命令表键集
 * （替代旧的「读源码文本正则抽键」），动态 import 是打断「commands → selftest → commands」
 * 静态环的唯一手段 —— 同步签名下这条 seam 只能用对物理排版敏感的正则走第三条路。
 */
type Cmd = (args: CliArgs, ctx: CliContext) => string | Promise<string>;

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
} satisfies Record<CommandName, Cmd>;

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
