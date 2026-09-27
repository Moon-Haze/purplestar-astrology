/**
 * 命令实现 —— 古籍检索 skill 的命令表。
 *
 * ⚠️ **本文件是手写的，不是副本**（见 `CLAUDE.md` 的「副本边界与同步流程」）。
 * 排盘解读 skill 的 `cli/commands.ts` 里有 9 个命令，本 skill 只该有 2 个 ——
 * `analyze` / `synastry` 之类出现在这里，只会让 Claude 照着一个跑不通的命令名去敲。
 * 裁过的文件无法逐字节守卫，这是拆 skill 的固有代价；它的正确性由
 * `cli/selftest.ts`（命令表 ↔ SKILL.md 双向一致）与仓库的 `test/cli.test.ts` 负责。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliArgs, CliContext } from "./args";
import { cmdSelftest } from "./selftest";
// ⚠️ 古籍内核用**相对路径**而非 `@/`：`@/` 在 tsc 眼里只映到**源** skill 的内核根
//    （见 tsconfig 的 paths），而 classics/ 已不住在源里（2026-09-27 起归本 skill），
//    写 `@/` 会让 `npm run typecheck` 报「找不到模块」。相对路径在两侧都对：运行期由钩子的
//    `.` 分支按**本文件**所在目录补 `.ts`（目录形态则兜底 `/index.ts`），tsc 同理。
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "../classics/index";

/**
 * `classics` 命令：古籍原文检索。
 *
 * @param args - CLI 参数表；`--search` 为关键词（也可用位置参数代替），`--limit` 为条数上限（默认 15）
 * @returns 已渲染好的文本
 *
 * @remarks
 * 无关键词时列出已收录的书目与总段数；有关键词时逐条输出「书名 · 章节」与摘要。
 *
 * 摘要里的 `<mark>` 高亮标签会换成 `『』`，并把 `『词『` 这类未闭合的嵌套收尾成一个 `』`。
 *
 * 与排盘解读 skill 的 `cmdClassics` 是**同一份实现**（逐行相同），但它是手写而非同步的 ——
 * 因为两个 skill 的 `commands.ts` 整个文件不是副本。改这里时要记得同步改那边，
 * 或反过来把两边都指向同一个内核函数（若这个命令再长大，那是更好的做法）。
 */
function cmdClassics(args: CliArgs) {
	if (!args.search && !args._.length) {
		return [
			`已收录古籍 ${ALL_BOOKS.length} 部，共 ${TOTAL_PARAGRAPHS} 段：`,
			...ALL_BOOKS.map(
				b => `  ▸ ${b.title ?? b.slug}（${b.slug}）${b.chapters?.length ?? 0} 章`
			),
			"",
			"用法：classics --search <关键词>",
		].join("\n");
	}
	const q = String(args.search ?? args._.join(" "));
	const limit = Number(args.limit ?? 15);
	// 非法上限必须在这里拦下：内核把 NaN / <1 一律归成空结果，若不区分就会掉进
	// 下面那条「未找到」——明明有命中，只是把上限设成了 0 或写成了非数字。
	//
	// `typeof ... === "boolean"` 挡的是「给了 --limit 却没跟值」：此时 parseArgs 存的是
	// 布尔 `true`，`Number(true)` 会得到 1 而蒙混过关（`--limit -3` 也落在这里 ——
	// 负值会被 cac 当短选项吃掉，取值校验是它唯一的兜底）。
	if (typeof args.limit === "boolean" || Number.isNaN(limit) || limit < 1)
		return `--limit 需为正整数，实得 ${String(args.limit)}。`;
	const hits = searchClassics(q, limit);
	if (!hits.length) return `古籍中未找到「${q}」。`;
	const out = [`古籍检索「${q}」命中 ${hits.length} 条：`, ""];
	for (const h of hits) {
		const plain = String(h.snippet ?? "")
			.replace(/<\/?mark>/g, "『")
			.replace(/『([^』]*)『/g, "『$1』");
		out.push(`  ▸ [${h.bookTitle ?? h.bookSlug ?? ""} · ${h.chapterTitle ?? ""}]`);
		out.push(`    ${plain.replace(/\n/g, " ")}`);
	}
	return out.join("\n");
}

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
 * `CommandName` 与 `COMMAND_DESC` 的完备性都建立在它之上。
 */
const COMMAND_TABLE = {
	classics: cmdClassics,
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
	classics: "古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）",
	selftest: "回归自检（数据源可用性 / 检索行为 / 参数面）",
};
