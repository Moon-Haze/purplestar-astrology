/**
 * `knowledge` 命令：统一知识检索 —— 四域合一（books 古籍 / stars 星曜释义 /
 * tianji 天纪判语 / oracle 断语手册）。
 *
 * Phase 1 · KnowledgeSource 接缝：分发走 `KNOWLEDGE_SOURCES` 注册表，本文件做
 * 「前置守卫 → 查表 → 调 `search`」，不再写 `switch`（ADR-002：清单注册）。
 * 新增域只加一个源文件 + 一行注册，不必改本入口（接缝与各域参数见
 * docs/code/cli-commands.md）。
 *
 * 参数样板的单点：`--search` 裸开关与 `--limit` 值域是四域同形的东西，由
 * {@link assertKnowledgeArgs} 在入口统一拦截（throw → stderr + 非零退出）；
 * 位置参数回退是**域知识**（books/stars/tianji 回退为检索词、oracle 回退为
 * topic/star），留在各域实现内。
 */

import type { CliArgs } from "../args";
import { KNOWLEDGE_SOURCES, KNOWLEDGE_SOURCE_IDS } from "@/knowledge/registry";

/**
 * knowledge 命令的公共参数守卫：三态归一与 limit 校验的单点。
 *
 * @remarks
 * 四域同形的两件事在这里一次说清，域实现不再各抄一份（历史上 books 的
 * `--search` 缺值走 return、其余三域走 throw，exit code 曾实际漂移）：
 * - `--search` 裸开关（解析层存成 `true`）一律 throw——不把报错当正常输出打
 *   stdout，机器路径（退出码）可感知；
 * - `--limit` 给了就必须是正整数（books/tianji 两份文案合一）。
 */
function assertKnowledgeArgs(args: CliArgs, source: string): void {
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
}

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
 * tianji / oracle 域的重语料在各自 `search` 内动态 import 懒加载（见 `knowledge/sources/`）。
 */
export async function cmdKnowledge(args: CliArgs): Promise<string> {
	const source = String(args.source ?? "books");
	assertKnowledgeArgs(args, source);
	const ks = KNOWLEDGE_SOURCES[source];
	if (!ks) {
		throw new Error(`--source 应为 ${KNOWLEDGE_SOURCE_IDS.join("/")}，收到：${source}`);
	}
	return ks.search(args);
}
