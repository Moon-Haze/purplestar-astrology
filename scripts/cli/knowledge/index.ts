/**
 * `knowledge` 命令：统一知识检索 —— 四域合一（books 古籍 / stars 星曜释义 /
 * tianji 天纪判语 / oracle 断语手册）。
 *
 * Phase 1 · KnowledgeSource 接缝：分发走 `KNOWLEDGE_SOURCES` 注册表，本文件只做
 * 「查表 → 调 `search`」，不再写 `switch`（ADR-002：清单注册）。新增域只加一个源文件 +
 * 一行注册，不必改本入口（接缝与各域参数见 docs/code/cli-commands.md）。
 */

import type { CliArgs } from "../args";
import { KNOWLEDGE_SOURCES, KNOWLEDGE_SOURCE_IDS } from "@/knowledge/registry";

/**
 * `knowledge` 命令：统一知识检索（四域）。
 *
 * @param args - CLI 参数表；`--source` 选域（books 缺省 / stars / tianji / oracle），
 *   各域参数：books `--search/--limit`、stars `--search`、tianji `--search/--book/--limit`、
 *   oracle `--topic/--star`
 * @returns 已渲染好的文本
 *
 * @remarks
 * `--source books`（缺省）为古籍检索，行为与「classics 只搜古籍」的旧用法逐字兼容。
 * tianji / oracle 域的实现在各自源文件内动态 import 懒加载（见 `knowledge/sources/`）。
 */
export async function cmdKnowledge(args: CliArgs): Promise<string> {
	const source = String(args.source ?? "books");
	const ks = KNOWLEDGE_SOURCES[source];
	if (!ks) {
		throw new Error(`--source 应为 ${KNOWLEDGE_SOURCE_IDS.join("/")}，收到：${source}`);
	}
	return ks.search(args);
}
