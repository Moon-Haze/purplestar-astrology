/**
 * `knowledge` 命令：统一知识检索 —— 三域合一（books 古籍 / stars 星曜释义 /
 * tianji 天纪判语；oracle 断语手册已随 remove-manual-oracle 下线）。
 *
 * Phase 1 · KnowledgeSource 接缝：分发走 `KNOWLEDGE_SOURCES` 注册表，本文件做
 * 「前置守卫 → 查表 → 调 `search`」，不再写 `switch`（ADR-002：清单注册）。
 * 新增域只加一个源文件 + 一行注册，不必改本入口（接缝与各域参数见
 * docs/code/cli-commands.md）。
 *
 * 参数样板的单点：`--search` 裸开关与 `--limit` 值域是三域同形的东西，由
 * {@link decodeKnowledgeQuery} 在入口统一拦截（throw → stderr + 非零退出）；
 * 位置参数回退是**域知识**（books/stars/tianji 回退为检索词），留在各域实现内。
 */

import type { CliArgs } from "../args";
import type { KnowledgeQuery } from "@/knowledge/types";
import { KNOWLEDGE_SOURCES, KNOWLEDGE_SOURCE_IDS } from "@/knowledge/registry";

/**
 * knowledge 命令的公共参数解码：三态归一 + limit 校验 + 值解码的单点。
 *
 * @remarks
 * 校验与解码合并在这里，域实现不再各抄一份（历史上 books 的 `--search` 缺值走
 * return、其余三域走 throw，exit code 曾实际漂移）：
 * - `--search`/`--book` 裸开关（解析层存成 `true`）一律 throw——不把报错
 *   当正常输出打 stdout，机器路径（退出码）可感知；
 * - `--topic`（astrology 的主题论断参数）出现即 throw——oracle 域退役后它对本命令
 *   无语义，显式报错而非静默吞参（失败可见性）；
 * - `--limit` 给了就必须是正整数（books/tianji 两份文案合一）；
 * - 取值参数解码为精确 `string`（或 `undefined`），裸开关的 boolean 形态在此被拦截，
 *   各源无需再 `typeof x === "boolean"` 收窄。位置参数回退仍是域知识，原样透传。
 *
 * @param args - CLI 参数表（读 `--search` / `--limit` / `--book` / `--topic` 与位置参数 `_`）
 * @param source - 本次选中的知识域 id（只用于报错文案里的位置参数示例）
 * @returns 归一后的 {@link KnowledgeQuery}：`term` 未给为 `undefined`、`limit` 缺省 15、
 *   `book` 未给为 `undefined`、`positional` 原样透传
 * @throws `--search` / `--book` 是裸开关、`--limit` 非正整数、或出现已退役的 `--topic` 时抛错
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
	// --topic 在此**硬拒收**是刻意的迁移礼遇，不是归属校验的双标（评审 S2 如实标注）：
	// 它曾是 knowledge（oracle 域）自己的参数，旧命令行带着它来应得到指路而非静默吞；
	// 其余从未属于本命令的 astrology 旗标（--pattern 等）按归属投影决策静默收下。
	// 若未来再有「曾属本命令」的旗标退役，照此例各自硬拒收。
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
 * `knowledge` 命令：统一知识检索（三域）。
 *
 * @param args - CLI 参数表；`--source` 选域（books 缺省 / stars / tianji），
 *   各域参数：books `--search/--limit`、stars `--search`、tianji `--search/--book/--limit`、
 *   （已下线的）oracle 曾用 `--topic/--star`
 * @returns 已渲染好的文本
 *
 * @remarks
 * `--source books`（缺省）为古籍检索，行为与「classics 只搜古籍」的旧用法逐字兼容。
 * tianji 域的重语料在 `search` 内动态 import 懒加载（见 `knowledge/sources/`）。
 * oracle 域已下线——断语手册由 astrology 按盘现场推算取代（a234a96）。
 *
 * @throws `--source` 不在注册表的域 id 列表里时抛错并列出可用域（不做静默回退到 books）
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
