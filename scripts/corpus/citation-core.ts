/**
 * @file 引文比对核心：「倪师 / 倪海厦 + 引号句」判违例（黑名单/形态正则/提取）。
 * @packageDocumentation
 * 判据单点，消费者 `test/lib/citation-guard.ts`；免「文档一份判据、源码 一份判据、库一份判据」分叉。详见 docs/code/README.md。
 */

import { ANNOTATIONS, type AnnotationEntry } from "./data/annotations.ts";

/** 一次扫描的结果。 */
export interface CitationScan {
	/** 违例引文核心（截断到 40 字），按出现顺序。 */
	violations: string[];
	/** 参与比对的源码文件，相对扫描根、已排序；防「扫了个空」的证据。 */
	checked: string[];
	/**
	 * 因核对表自身被跳过的文件。
	 * @remarks 单 skill 常恰 1 个（`corpus/data/annotations.ts`），余 0 个属正常；
	 * 断言见 `test/citations.test.ts`「所有根合计至少有 1 个」。
	 * checked 空=根写歪，skipped 全仓空=核对表识别失配，故单列一栏。
	 */
	skipped: string[];
}

/**
 * 黑名单：核对表 suspect / fabricated 条目的引文核心（书名号 / 引号内部分）。
 * @remarks 各扫描面共用此构造，判据单点，免「一处放行了、另一处还拦着」分叉。
 * @param checklist - 核对表，通常传全仓唯一 `ANNOTATIONS`
 * @returns 被禁引文核心集合，供 {@link findViolations} 判命中。
 */
export function buildBannedSet(checklist: readonly AnnotationEntry[]): Set<string> {
	return new Set(
		checklist
			.filter(e => e.status === "suspect" || e.status === "fabricated")
			.flatMap(e => [...e.text.matchAll(/[「"『]([^」"』]{4,})[」"』]/g)].map(m => m[1]))
	);
}

/**
 * 在文本块里找出仍以倪师名义出现的未核实引文。
 * @param chunks - 文本块（源码/文档/逐行断语），调用方收集
 * @param banned - 黑名单（{@link buildBannedSet}），缺省用 `ANNOTATIONS`
 * @returns 违例引文核心（截断到 40 字），按出现顺序
 * @remarks 形态：倪(海厦|师)+≤10 非句号字符+说/言/称/警示/警告/明言/强调/描述/提醒
 * +可选冒号+引号内≥4 字。不放宽任何一项。
 */
export function findViolations(
	chunks: readonly string[],
	banned: ReadonlySet<string> = buildBannedSet(ANNOTATIONS)
): string[] {
	/** 所有「倪海厦/倪师…说/言/警示…：『引文』」的引文核心。 */
	const citeRe =
		/倪(?:海厦|师)[^。\n]{0,10}(?:说|言|称|警示|警告|明言|强调|描述|提醒)[：:]?\s*[「"『]([^」"』]{4,})[」"』]/g;
	return [...chunks.join("\n").matchAll(citeRe)]
		.filter(m => banned.has(m[1]))
		.map(m => m[1].slice(0, 40));
}
