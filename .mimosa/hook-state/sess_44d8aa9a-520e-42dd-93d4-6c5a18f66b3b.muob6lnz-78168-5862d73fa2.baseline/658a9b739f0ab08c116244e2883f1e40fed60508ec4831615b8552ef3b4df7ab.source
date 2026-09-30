/**
 * `classics` 命令：古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）。
 *
 * 2026-09-30 三 skill 合一时从 classics 自带的 commands.ts 搬入 —— 实现逐字保留，
 * 只换 import 来源（`@/classics` 内核）与命令注册（进 `./commands.ts` 的 COMMAND_TABLE）。
 */

import type { CliArgs } from "./args";
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/classics";

/**
 * @param args - CLI 参数表；`--search` 为关键词（也可用位置参数代替），`--limit` 为条数上限（默认 15）
 * @returns 已渲染好的文本
 *
 * @remarks
 * 无关键词时列出已收录的书目与总段数；有关键词时逐条输出「书名 · 章节」与摘要。
 *
 * 摘要里的 `<mark>` 高亮标签会换成 `『』`，并把 `『词『` 这类未闭合的嵌套收尾成一个 `』`。
 */
export function cmdClassics(args: CliArgs): string {
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
	// `typeof ... === "boolean"` 那一支是裸写 `--limit`（没跟值）的第二道防线。
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
