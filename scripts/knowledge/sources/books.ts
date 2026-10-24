/**
 * knowledge 的 **books 域**：古籍原文检索（默认域）。
 *
 * 从 `cli/knowledge/index.ts` 的 `renderBooks` 迁来（Phase 1 · KnowledgeSource 接缝），
 * 逻辑逐字不变，仅改为 `KnowledgeSource` 形态。books 域静态引 `@/corpus`（古籍数据
 * 已静态打包进代码，零 DB 依赖），启动无懒加载顾虑。
 */

import type { CliArgs } from "@/cli/args";
import type { KnowledgeSource } from "../types";
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/corpus";

/** 渲染 books 域：无关键词列四域概览，有关键词出古籍命中。 */
export const booksSource: KnowledgeSource = {
	id: "books",
	label: "古籍",
	search(args: CliArgs): string {
		if (!args.search && !args._.length) {
			return [
				"知识检索四域：books 古籍（默认）· stars 星曜释义 · tianji 天纪判语 · oracle 断语手册",
				"",
				`已收录古籍 ${ALL_BOOKS.length} 部，共 ${TOTAL_PARAGRAPHS} 段：`,
				...ALL_BOOKS.map(
					b => `  ▸ ${b.title ?? b.slug}（${b.slug}）${b.chapters?.length ?? 0} 章`
				),
				"",
				"用法：knowledge --search <关键词>",
				"其他域：--source stars（星曜释义）/ --source tianji（天纪判语）/ --source oracle（断语手册）",
			].join("\n");
		}
		const q = String(args.search ?? args._.join(" "));
		// 值域合法性由入口守卫保证（assertKnowledgeArgs），这里只做类型收窄。
		const hits = searchClassics(q, Number(args.limit ?? 15));
		if (!hits.length) {
			return `古籍中未找到「${q}」。`;
		}
		const out = [`古籍检索「${q}」命中 ${hits.length} 条：`, ""];
		for (const h of hits) {
			const plain = String(h.snippet ?? "")
				.replace(/<\/?mark>/g, "『")
				.replace(/『([^』]*)『/g, "『$1』");
			out.push(`  ▸ [${h.bookTitle ?? h.bookSlug ?? ""} · ${h.chapterTitle ?? ""}]`);
			out.push(`    ${plain.replace(/\n/g, " ")}`);
		}
		return out.join("\n");
	},
};

// 四域包装的迁移史与懒加载纪律见 docs/code/knowledge.md。
