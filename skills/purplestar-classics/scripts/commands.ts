/**
 * 命令实现 —— 古籍检索 skill 的命令表。
 *
 * ⚠️ **本文件是手写的，不是副本**（2026-09-27 起本 skill 与源 skill 不再有派生关系）。
 * 排盘解读 skill 的 `commands.ts` 里有 9 个命令，本 skill 只该有 2 个 ——
 * `analyze` / `topic` 之类出现在这里，只会让 Claude 照着一个跑不通的命令名去敲。
 *
 * 命令表的正确性由 `selftest.ts`（命令表 ↔ SKILL.md 双向一致）与仓库的
 * `test/cli.test.ts` 负责。
 */

import type { CliArgs } from "./purple-star.ts";
import { cmdSelftest } from "./selftest.ts";
// ⚠️ 内核 import 写全 `.ts` 扩展名：本 skill 不再注册 TS 解析钩子，靠 Node ≥ 22.15 的
//    原生类型擦除直接加载（见 purple-star.ts 文件头）。写全扩展名不是风格偏好 ——
//    漏了它 Node 会 ERR_MODULE_NOT_FOUND，而这是本 skill 唯一的加载路径。
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "./index.ts";

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
	// ⚠️ 这条校验依赖解析层「值原样到达」：`--limit -3` 里的 `-3` 是**合法值**
	// （解析器只挡以 `--` 开头的下一个 token），故它走完全程、在这里被 `limit < 1`
	// 拦下 —— 报错里因此带着 `--limit`，正是 `test/cli.test.ts` 要求的那条
	// （它拿 `0` / `-3` / `abc` 三个输入断言这点）。
	//
	// `typeof ... === "boolean"` 那一支是**第二道防线**：裸写 `--limit`（没跟值）
	// 已在解析层被拒（`SKILL.md` 承诺过「会被明确拒绝」），走不到这里。
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

/** 命令实现的签名：返回**已渲染好的文本**，由入口统一 `console.log`。 */
type Cmd = (args: CliArgs) => string;

/**
 * 命令名 → 实现。
 *
 * @remarks
 * 刻意**不导出**这张裸表：导出的是下面两个视图（{@link COMMANDS} 供分发、
 * {@link COMMAND_DESC} 供渲染 HELP）。调用方拿不到「键集与描述可能对不上」的中间态。
 *
 * 用 `satisfies` 而非 `: Record<...>` 标注，是为了保住字面量键集 ——
 * `CommandName` 与 `COMMAND_DESC` 的完备性都建立在它之上。
 *
 * `selftest` 那一项包一层箭头函数（而不是直接写 `cmdSelftest`）：命令签名带 `args`，
 * 而自检不读任何参数 —— 包一层比让 `cmdSelftest` 多接一个用不上的形参清楚。
 */
const COMMAND_TABLE = {
	classics: cmdClassics,
	selftest: () => cmdSelftest(),
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
 * `help` 不在表内 —— 入口单独处理，见 `purple-star.ts` 的 `main()`。
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
