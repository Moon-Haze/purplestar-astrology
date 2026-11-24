/**
 * @file `knowledge` 三域检索。「前置守卫 → 查表 → 调 `search`」经 {@link decodeKnowledgeQuery} 分发，详见 docs/code/cli-commands.md。
 */

import type { CliArgs } from "../args";
import type { KnowledgeQuery } from "@/knowledge/types";
import { KNOWLEDGE_SOURCES, KNOWLEDGE_SOURCE_IDS } from "@/knowledge/registry";

/**
 * 参数解码。
 * @remarks 校验解码合一（曾 exit code 漂移）。
 * `--search`/`--book` 裸开关、`--topic` 出现、`--limit` 非法即 throw。
 * @param args - 参数表（含 `_`）
 * @param source - 域 id
 * @returns 归一 {@link KnowledgeQuery}
 * @throws 非法参数
 */
function decodeKnowledgeQuery(args: CliArgs, source: string): KnowledgeQuery {
	if (typeof args.search === "boolean") {
		throw new Error(
			`--search 需要一个检索词（如 --search 紫微），也可直接写位置参数：knowledge --source ${source} 紫微。`
		);
	}
	if (args.limit !== undefined) {
		const n = Number(args.limit);
		if (typeof args.limit === "boolean" || Number.isNaN(n) || n < 1) {
			throw new Error(`--limit 需为正整数，实得 ${String(args.limit)}。`);
		}
	}
	if (typeof args.book === "boolean") {
		throw new Error("--book 需要一个册名（如 --book 01-stars）。");
	}
	// `--topic` 原属 knowledge（oracle），旧命令行应指路；
	// 「曾属本命令」退役旗标照此硬拒，其余 `--pattern` 等按归属投影收下。
	if (args.topic !== undefined) {
		throw new Error(
			"--topic 是 astrology 的主题论断参数；knowledge 检索用 --search 或直接写位置参数，--source 选域。"
		);
	}

	return {
		term: typeof args.search === "string" ? args.search : undefined,
		positional: args._,
		limit: args.limit === undefined ? 15 : Number(args.limit),
		book: typeof args.book === "string" ? args.book : undefined,
	};
}

/**
 * `knowledge` 三域检索。
 * @param args - 参数表；`--source` 选域（books/stars/tianji）；tianji 收 `--star`
 * @returns 渲染文本
 * @remarks books 兼容「classics 只搜古籍」；tianji 懒加载；oracle 下线。
 * @throws `--source` 非法
 */
export async function cmdKnowledge(args: CliArgs): Promise<string> {
	const source = String(args.source ?? "books");
	const query = decodeKnowledgeQuery(args, source);
	const ks = KNOWLEDGE_SOURCES[source];
	if (!ks) {
		throw new Error(`--source 应为 ${KNOWLEDGE_SOURCE_IDS.join("/")}，收到：${source}`);
	}
	return ks.search(query);
}
