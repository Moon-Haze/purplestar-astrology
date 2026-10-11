/**
 * 古籍原典查询库 — 类型定义
 *
 * 设计：所有古籍以静态数据打包进代码（`data/*.ts`，是 TS 模块而非外部 JSON 文件；
 * 收录的都是公版古籍，无版权风险）。线上站点（Next.js）启动时一次性加载到内存，
 * 零 DB 依赖。
 *
 * @packageDocumentation
 */

/**
 * 古籍的一个段落 —— 检索与展示的最小单位。
 *
 * @remarks
 * 段落是 `classics --search` 的命中单位：命中列表按段落计数，不是按词出现次数。
 */
export interface Paragraph {
	/** 段落唯一 id（用于锚点跳转） */
	id: string;
	/** 段落序号（章节内） */
	idx: number;
	/** 段落原文（古文） */
	text: string;
	/** 现代翻译（可选，未来填充） */
	translation?: string;
	/** 倪师注解（可选，标注来源） */
	niNote?: string;
}

/** 古籍的一章 —— 段落的分组，也是「按章节序号取用」这一 API 的索引粒度。 */
export interface Chapter {
	/** 章节标题（如"卷一"、"总论篇"）*/
	title: string;
	/** 章节副标题/简介（可选）*/
	subtitle?: string;
	/** 本章段落，顺序即原文顺序（也是检索命中与展示的顺序） */
	paragraphs: Paragraph[];
}

/**
 * 一部古籍 —— 元数据 + 全部章节。
 *
 * @remarks
 * 本类型是 `data/*.ts` 三个数据文件的顶层形状，也是 {@link ALL_BOOKS} 的元素类型。
 */
export interface Book {
	/** 书名 */
	title: string;
	/** 书 slug（URL 用，如 'guisuifu'）*/
	slug: string;
	/** 朝代 */
	dynasty: string;
	/** 作者（多人或不详时填"不详"或多人）*/
	author: string;
	/** 简介 */
	intro: string;
	/** 总字数（粗略）*/
	wordCount: number;
	/** 全书章节，顺序即原文顺序（也是检索命中与 `classics` 概览输出的顺序） */
	chapters: Chapter[];
}

/**
 * 一条检索命中 —— {@link searchClassics} 的返回元素。
 *
 * @remarks
 * 同时带「货架位置」（书 / 章 / 段）与「展示内容」（`snippet` / `text`），
 * 调用方无需再回查 `ALL_BOOKS` 即可直接渲染。
 */
export interface SearchHit {
	/** 命中所在书的 slug */
	bookSlug: string;
	/** 命中所在书的书名 */
	bookTitle: string;
	/** 命中所在章节的标题 */
	chapterTitle: string;
	/** 命中段落的 id（锚点跳转用） */
	paragraphId: string;
	/** 高亮片段（含 <mark> 标签） */
	snippet: string;
	/** 原文 */
	text: string;
}
