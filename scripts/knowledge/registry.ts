/**
 * @file 知识源注册表：三域声明式，CLI 查表不写 switch。
 * ADR-002「清单注册而非文件系统自动发现」、typecheck 兜底；「实现即插件」，tianji 懒加载，新域加一行。详见 docs/code/knowledge.md。
 */

import type { KnowledgeSource } from "./types";
import { booksSource } from "./sources/books";
import { starsSource } from "./sources/stars";
import { tianjiSource } from "./sources/tianji";

/** 键=`--source`；序即概览/报错序。 */
export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
	books: booksSource,
	stars: starsSource,
	tianji: tianjiSource,
};

/** 键集单一真相，不手抄。 */
export const KNOWLEDGE_SOURCE_IDS: readonly string[] = Object.keys(KNOWLEDGE_SOURCES);
