/**
 * 古籍原典查询库 — 入口
 *
 * 汇总三部古籍数据 + 提供全文检索与书目/段落统计（`searchClassics` /
 * `ALL_BOOKS` / `TOTAL_PARAGRAPHS`）。
 * 数据以 TS 模块静态打包进代码（见 `data/`），零 DB 依赖、零网络请求。
 *
 * ⚠️ {@link ALL_BOOKS} 的数组顺序即检索命中顺序，调整会改变输出排列。
 *
 * @packageDocumentation
 */
// 入口 API、段落口径与数据文件分工见 docs/code/corpus.md。

import type { Book, Paragraph, SearchHit } from "./types";
import { guSuiFu } from "./data/gusuifu";
import { ziWeiQuanJi } from "./data/quanji";
import { ziWeiQuanShu } from "./data/quanshu";

/**
 * 所有已收录古籍 —— 骨髓赋、紫微斗数全集、紫微斗数全书。
 *
 * ⚠️ 数组顺序即 {@link searchClassics} 的命中顺序（按书 → 章节 → 段落逐层遍历），
 *    也是 `classics` 命令默认列出的顺序；调整顺序会改变检索结果的排列。
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
 * 古籍全文检索。
 *
 * @param query - 检索词。首尾空白先被裁掉；裁后长度不足 1 则直接返回空数组
 * @param limit - 命中数上限，默认 30（`classics` 命令传 15）。
 *   `NaN` 或小于 1 时返回空数组；`Infinity` 表示无上限
 * @returns 命中列表，按 {@link ALL_BOOKS} 的书序 → 章节序 → 段落序排列
 *
 * @remarks
 * 匹配方式是**逐段落的子串匹配**（`String.prototype.indexOf`，对中文 OK）。
 * 检索词按空白分词：多个关键词须**全部出现在同一段**才算命中（AND），
 * 单个关键词即单串子串匹配：
 * - **大小写敏感** —— `indexOf` 不做大小写折叠，故 `"abc"` 不匹配 `"ABC"`
 * - **只搜原文** `paragraph.text`，不搜 `translation` / `niNote`
 * - 计数单位是**段落**而非出现次数：同一段落里命中词出现多次也只产出一条
 * - **无相关度排序**，纯文档顺序、先命中先收；凑满 `limit` 立刻返回，不再继续扫描
 * - 繁简转换不做，繁体检索词匹配不到简体原文
 *
 * `snippet` 取锚点**前后各 40 字**的上下文：锚点是**最早出现**的关键词，
 * 裹 `<mark>`，其余部分经 {@link escapeHtml} 转义，首尾若被截断则补 `…`。
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
