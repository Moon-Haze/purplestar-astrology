/**
 * 知识源注册表（Phase 1 · KnowledgeSource 接缝）
 *
 * 把 `knowledge` 命令的四域收成一张声明式注册表。CLI 分发入口只查这张表，不再写
 * `switch`（ADR-002：清单注册而非文件系统自动发现——typecheck 兜底、与现有
 * `COMMAND_TABLE` 哲学一致）。新增一个域 = 写一个 `sources/<id>.ts` + 下面加一行，
 * 不必改 `cli/knowledge/index.ts`。
 *
 * 懒加载纪律：tianji / oracle 两域的实现在 `search` 内 `await import` 重数据，注册表
 * 静态 import 这些包装模块（轻量）不会把 392KB / 4.4MB 数据拉进 CLI 启动。
 *
 * ⚠️ `KNOWLEDGE_SOURCES` 的**键序即概览列出与报错提示的顺序**；`KNOWLEDGE_SOURCE_IDS`
 *    是键集合的单一真相源，CLI 报错提示与自检断言复用它，**不手抄字符串**。
 *
 * 「清单注册而非文件系统自动发现」的取舍与新增一个域的步骤，见 docs/code/knowledge.md。
 */

import type { KnowledgeSource } from "./types";
import { booksSource } from "./sources/books";
import { starsSource } from "./sources/stars";
import { tianjiSource } from "./sources/tianji";
import { oracleSource } from "./sources/oracle";

/** 所有已注册知识源（键 = `--source` 取值）。顺序即概览列出与报错提示的顺序。 */
export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
	books: booksSource,
	stars: starsSource,
	tianji: tianjiSource,
	oracle: oracleSource,
};

/** 注册表键集合（稳定顺序）；CLI 报错提示与自检断言复用，不手抄字符串。 */
export const KNOWLEDGE_SOURCE_IDS: readonly string[] = Object.keys(KNOWLEDGE_SOURCES);
