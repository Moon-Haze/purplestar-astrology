/**
 * 古籍原典查询库 — 入口
 *
 * 汇总三部古籍数据 + 提供「按 slug / 章节序号 / 段落 id 取用」与「全文检索」两组 API。
 * 数据以 TS 模块静态打包进代码（见 `data/`），零 DB 依赖、零网络请求。
 *
 * @packageDocumentation
 */

import type { Book, Paragraph, SearchHit } from "./types";
import { guSuiFu } from "./data/gusuifu";
import { ziWeiQuanJi } from "./data/quanji";
import { ziWeiQuanShu } from "./data/quanshu";

/**
 * 所有已收录古籍 —— 骨髓赋、紫微斗数全集、紫微斗数全书。
 *
 * @remarks
 * 数组顺序即 {@link searchClassics} 的命中顺序（按书 → 章节 → 段落逐层遍历），
 * 也是 `classics` 命令默认列出的顺序；调整顺序会改变检索结果的排列。
 */
export const ALL_BOOKS: Book[] = [guSuiFu, ziWeiQuanJi, ziWeiQuanShu];

/**
 * 全部古籍的段落总数（各书各章 `paragraphs.length` 之和）。
 *
 * @remarks
 * 模块加载时一次性算出。用于首页统计与 `classics` 命令的概览输出
 * （`selftest` 也拿它当「数据源可用」的哨兵）。
 */
export const TOTAL_PARAGRAPHS = ALL_BOOKS.reduce(
	(sum, b) => sum + b.chapters.reduce((s, c) => s + c.paragraphs.length, 0),
	0
);

/**
 * 按 slug 取书。
 *
 * @param slug - 书的 slug（URL 用标识），如 `"gusuifu"` / `"quanji"` / `"quanshu"`
 * @returns 命中的 {@link Book}；未收录该 slug 时返回 `null`
 */
export function getBookBySlug(slug: string): Book | null {
	return ALL_BOOKS.find(b => b.slug === slug) ?? null;
}

/**
 * 按「书 slug + 章节序号」取章节。
 *
 * @param bookSlug - 书的 slug，取值见 {@link getBookBySlug}
 * @param chapterIdx - 章节序号，是 `book.chapters` 的**数组下标（从 0 起）**，不是原文里的卷次
 * @returns 含 `book` / `chapter` / `chapterIdx` 的对象；书不存在或下标越界时返回 `null`
 */
export function getChapter(bookSlug: string, chapterIdx: number) {
	const book = getBookBySlug(bookSlug);
	if (!book) return null;
	const chapter = book.chapters[chapterIdx];
	if (!chapter) return null;
	return { book, chapter, chapterIdx };
}

/**
 * 按段落 id 取段落，连同所属书与章节一并返回。
 *
 * @param id - 段落 id，如 `"gsf-1-1"`（各书的 id 前缀见对应 `data/*.ts`）
 * @returns 含 `book` / `chapter` / `chapterIdx` / `paragraph` 的对象；未命中时返回 `null`
 *
 * @remarks
 * 线性全表扫描（书 → 章节 → 段落）。数据量小、调用不频繁，故不建索引。
 */
export function getParagraphById(id: string) {
	for (const book of ALL_BOOKS) {
		for (let i = 0; i < book.chapters.length; i++) {
			const ch = book.chapters[i];
			const p = ch.paragraphs.find(p => p.id === id);
			if (p) {
				return { book, chapter: ch, chapterIdx: i, paragraph: p };
			}
		}
	}
	return null;
}

/**
 * 古籍全文检索。
 *
 * @param query - 检索词。首尾空白先被裁掉；裁后长度不足 1 则直接返回空数组
 * @param limit - 命中数上限，默认 30（`classics` 命令传 15）
 * @returns 命中列表，按 {@link ALL_BOOKS} 的书序 → 章节序 → 段落序排列
 *
 * @remarks
 * 匹配方式是**逐段落的子串匹配**（`String.prototype.indexOf`，不分词，对中文 OK）：
 * - **大小写敏感** —— `indexOf` 不做大小写折叠，故 `"abc"` 不匹配 `"ABC"`
 * - **只搜原文** `paragraph.text`，不搜 `translation` / `niNote`
 * - 计数单位是**段落**而非出现次数：同一段落里命中词出现多次也只产出一条
 * - **无相关度排序**，纯文档顺序、先命中先收；凑满 `limit` 立刻返回，不再继续扫描
 * - 繁简转换不做，繁体检索词匹配不到简体原文
 *
 * `snippet` 取命中处**前后各 40 字**的上下文：命中词裹 `<mark>`，其余部分经
 * {@link escapeHtml} 转义，首尾若被截断则补 `…`。
 */
export function searchClassics(query: string, limit = 30): SearchHit[] {
	const q = query.trim();
	if (q.length < 1) return [];

	const hits: SearchHit[] = [];
	for (const book of ALL_BOOKS) {
		for (const chapter of book.chapters) {
			for (const p of chapter.paragraphs) {
				const idx = p.text.indexOf(q);
				if (idx < 0) continue;

				// 提取上下文（前后各 40 字）
				const start = Math.max(0, idx - 40);
				const end = Math.min(p.text.length, idx + q.length + 40);
				const before = p.text.slice(start, idx);
				const matched = p.text.slice(idx, idx + q.length);
				const after = p.text.slice(idx + q.length, end);

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

				if (hits.length >= limit) return hits;
			}
		}
	}
	return hits;
}

/**
 * 转义 HTML 特殊字符，供 {@link searchClassics} 拼装 `snippet` 时使用。
 *
 * @param s - 原始文本（段落原文，可能含 `<`、`&` 等字符）
 * @returns 把 `& < > " '` 换成实体后的文本
 *
 * @remarks
 * 转义在**拼 `<mark>` 之前**完成，所以 `snippet` 里唯一未被转义的标签就是那对
 * `<mark>` —— 原文中的尖括号不会混进 HTML。
 */
function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/** 类型转出：调用方从入口一处即可拿到全部公开类型，无需深入 `./types` */
export type { Book, Chapter, Paragraph, SearchHit } from "./types";
