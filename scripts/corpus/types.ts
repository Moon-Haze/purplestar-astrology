/**
 * @file 古籍类型
 * @packageDocumentation
 * 公版古籍静态打包 Next.js，零 DB。
 */
/** @remarks 形状契约与缘由见 docs/code/corpus.md。 「为什么用 TS 模块而非外部 JSON」 */

/**
 * 段落：检索/展示单位。
 * @remarks `knowledge --search`（`--source books`）按段落计数，非词频。
 */
export interface Paragraph {
	/** 段落 id（跳转） */
	id: string;
	/** 章内序号 */
	idx: number;
	/** 古文 */
	text: string;
	/** 译文（可选） */
	translation?: string;
	/** 倪师注（可选） */
	niNote?: string;
}

/** 章：段落分组/「按章节序号取用」索引。 */
export interface Chapter {
	/** 章标题 */
	title: string;
	/** 副题（可选） */
	subtitle?: string;
	/** 段落（原文序） */
	paragraphs: Paragraph[];
}

/**
 * 古籍：元数据+章。
 * @remarks `data/*.ts` 顶层形状，{@link ALL_BOOKS} 的元素类型。
 */
/** 书名/章节/段落。 */
export interface Book {
	/** 书名 */
	title: string;
	/** slug（URL 用） */
	slug: string;
	/** 朝代 */
	dynasty: string;
	/** 作者 */
	author: string;
	/** 简介 */
	intro: string;
	/** 总字数 */
	wordCount: number;
	/** 章节（原文序） */
	chapters: Chapter[];
}

/**
 * 命中：{@link searchClassics} 返回。
 * @remarks 带「货架位置」与「展示内容」，免回查。
 */
export interface SearchHit {
	/** 书 slug */
	bookSlug: string;
	/** 书名 */
	bookTitle: string;
	/** 章标题 */
	chapterTitle: string;
	/** 段落 id */
	paragraphId: string;
	/** 高亮片段 */
	snippet: string;
	/** 原文 */
	text: string;
}
