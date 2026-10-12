/**
 * `knowledge` 命令：统一知识检索 —— 四域合一（books 古籍 / stars 星曜释义 / tianji 天纪判语 / oracle 断语手册）。
 *
 * 本文件是**分发入口 + books 域**；三个附加域的实现各住本目录一文件：
 *   stars  → ./stars.ts（内核轻表，静态引）
 *   tianji → ./tianji.ts（语料 392KB，函数内动态 import 懒加载）
 *   oracle → ./oracle.ts（手册 4.4MB，函数内动态 import 懒加载）
 * 懒加载纪律：CLI 主链路（commands.ts → knowledge/index.ts）不静态引这两份大数据，
 * `knowledge --search …` 主路径与启动不吃它们。
 *
 * 域由 `--source` 选择（缺省 `books`，与「classics 只搜古籍」的历史用法向后兼容）；
 * 旧命令 `stars` / `oracle` 已并入（原命令名不保留），`classics` 本命令原名（随四域
 * 合并改名 knowledge，用法逐字不变）。
 */

import type { CliArgs } from "../args";
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/corpus";

// ══════════════════════ books 域：古籍原文检索（默认） ══════════════════════

function renderBooks(args: CliArgs): string {
	if (typeof args.search === "boolean")
		{return "--search 需要一个检索词（如 --search 机月同梁）。";}
	if (!args.search && !args._.length) {
		return [
			"知识检索四域：books 古籍（默认）· stars 星曜释义 · tianji 天纪判语 · oracle 断语手册",
			"",
			`已收录古籍 ${ALL_BOOKS.length} 部，共 ${TOTAL_PARAGRAPHS} 段：`,
			...ALL_BOOKS.map(
				b => `  ▸ ${b.title ?? b.slug}（${b.slug}）${b.chapters?.length ?? 0} 章`
			),
			"",
			"用法：knowledge --search <关键词>",
			"其他域：--source stars（星曜释义）/ --source tianji（天纪判语）/ --source oracle（断语手册）",
		].join("\n");
	}
	const q = String(args.search ?? args._.join(" "));
	const limit = Number(args.limit ?? 15);
	// 非法上限必须在这里拦下：内核把 NaN / <1 一律归成空结果，若不区分就会掉进
	// 下面那条「未找到」——明明有命中，只是把上限设成了 0 或写成了非数字。
	//
	// `typeof ... === "boolean"` 那一支是裸写 `--limit`（没跟值）的第二道防线。
	// 值域非法走 throw（引导层打「错误：」并 exit 1），与命令其它 throw 行为一致，
	// 不再走 return——return 会把报错当正常输出打 stdout 且 exit 0，机器路径无法感知。
	if (typeof args.limit === "boolean" || Number.isNaN(limit) || limit < 1)
		{throw new Error(`--limit 需为正整数，实得 ${String(args.limit)}。`);}
	const hits = searchClassics(q, limit);
	if (!hits.length) {return `古籍中未找到「${q}」。`;}
	const out = [`古籍检索「${q}」命中 ${hits.length} 条：`, ""];
	for (const h of hits) {
		const plain = String(h.snippet ?? "")
			.replace(/<\/?mark>/g, "『")
			.replace(/『([^』]*)『/g, "『$1』");
		out.push(`  ▸ [${h.bookTitle ?? h.bookSlug ?? ""} · ${h.chapterTitle ?? ""}]`);
		out.push(`    ${plain.replace(/\n/g, " ")}`);
	}
	return out.join("\n");
}

// ══════════════════════ 四域分发 ══════════════════════

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
 * tianji / oracle 域的实现在各自域文件内动态 import（懒加载，见文件头）。
 */
export async function cmdKnowledge(args: CliArgs): Promise<string> {
	const source = String(args.source ?? "books");
	switch (source) {
		case "books":
			return renderBooks(args);
		case "stars":
			return (await import("./stars")).renderStars(args);
		case "tianji":
			return (await import("./tianji")).renderTianji(args);
		case "oracle":
			return (await import("./oracle")).renderOracle(args);
		default:
			throw new Error(`--source 应为 books/stars/tianji/oracle，收到：${source}`);
	}
}
