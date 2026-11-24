/**
 * @file {@link ALL_BOOKS} 入口
 * @packageDocumentation
 */
// 入口 API、段落口径与数据文件分工见 docs/code/corpus.md。

import type { Book, Paragraph, SearchHit } from "./types";
import { guSuiFu } from "./data/gusuifu";
import { ziWeiQuanJi } from "./data/quanji";
import { ziWeiQuanShu } from "./data/quanshu";

/** 古籍。⚠️ 序即 {@link searchClassics} 命中序。 */
export const ALL_BOOKS: Book[] = [guSuiFu, ziWeiQuanJi, ziWeiQuanShu];

/** 段落总数。@remarks 加载时算，`selftest` 哨兵「数据源可用」。 */
export const TOTAL_PARAGRAPHS = ALL_BOOKS.reduce(
	(sum, b) => sum + b.chapters.reduce((s, c) => s + c.paragraphs.length, 0),
	0
);

/**
 * 检索。
 * @param query - 词；裁空白则 []
 * @param limit - 30；`NaN`/<1→[]，`Infinity` 无上限
 * @returns 命中，按 {@link ALL_BOOKS} 书→章→段序
 * @remarks 逐段子串（`indexOf`、中文OK）、大小写敏感；仅 `text` 不搜 `translation`/`niNote`；按段非次数；无相关度、先命中先收、满即返；繁简不转。`snippet` 裹 `<mark>`、余经 {@link escapeHtml} 转义、截断补…
 */
export function searchClassics(query: string, limit = 30): SearchHit[] {
	const keywords = query.trim().split(/\s+/).filter(Boolean);
	if (keywords.length < 1) {
		return [];
	}
	// 上限的合法性必须在扫描前判定：命中数是扫描中才累积的，放在循环里判会
	// 让 limit<=0 至少漏出 1 条（上限判定排在 push 之后），而 NaN 参与比较恒为假、
	// 等于没有上限。两种都会让「设了上限」与「给出的结果数」对不上。
	// Infinity 不在此列 —— 它是「无上限」，走正常路径返回全部。
	if (Number.isNaN(limit) || limit < 1) {
		return [];
	}

	const hits: SearchHit[] = [];
	for (const book of ALL_BOOKS) {
		for (const chapter of book.chapters) {
			for (const p of chapter.paragraphs) {
				// 每个关键词都要在同一段命中；锚点取最早出现的那一个
				let idx = -1;
				let anchor = "";
				let hit = true;
				for (const kw of keywords) {
					const at = p.text.indexOf(kw);
					if (at < 0) {
						hit = false;
						break;
					}
					if (idx < 0 || at < idx) {
						idx = at;
						anchor = kw;
					}
				}
				if (!hit) {
					continue;
				}

				// 提取上下文（前后各 40 字）
				const start = Math.max(0, idx - 40);
				const end = Math.min(p.text.length, idx + anchor.length + 40);
				const before = p.text.slice(start, idx);
				const matched = p.text.slice(idx, idx + anchor.length);
				const after = p.text.slice(idx + anchor.length, end);

				const snippet =
					(start > 0 ? "…" : "") +
					escapeHtml(before) +
					`<mark>${escapeHtml(matched)}</mark>` +
					escapeHtml(after) +
					(end < p.text.length ? "…" : "");

				hits.push({
					bookSlug: book.slug,
					bookTitle: book.title,
					chapterTitle: chapter.title,
					paragraphId: p.id,
					snippet,
					text: p.text,
				});

				if (hits.length >= limit) {
					return hits;
				}
			}
		}
	}
	return hits;
}

/**
 * 转义，供 {@link searchClassics} 拼 `snippet`。
 * @param s - 原文
 * @returns 文本
 * @remarks 先于 `<mark>` 转义，仅 `<mark>` 未转义。
 */
function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/** 类型转出。 */
export type { Book, Chapter, Paragraph, SearchHit } from "./types";
