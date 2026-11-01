/**
 * 引文比对核心 —— 「倪师 / 倪海厦 + 引号句」形态的判违例逻辑：黑名单构造、
 * 形态正则、违例提取。**不含收集面**（扫哪些文件是调用方的事，见
 * `test/lib/citation-guard.ts` 的两套收集器）。
 *
 * **住在 `corpus/` 的理由**：引文质检是知识域的纪律，消费方不止测试——
 * `tools/db/export-manual.ts` 建断语手册库时对每行入库文本跑同一判据
 * （核对表外的引文形态不得入库）。住这里让测试侧与建库侧引**同一份判据**，
 * 不出现「文档一份判据、源码一份判据、库一份判据」的分叉。
 *
 * ⚠️ 本模块的 import 写全 `.ts` 扩展名：消费方（test / tools）在**无解析钩子**的
 * 原生 ESM 环境加载本模块，省扩展名的候选序兜底不可用。
 *
 * @packageDocumentation
 */

import { ANNOTATIONS, type AnnotationEntry } from "./data/annotations.ts";

/** 一次扫描的结果。 */
export interface CitationScan {
	/** 违例的引文核心（已截断到 40 字），按出现顺序 */
	violations: string[];
	/** 参与比对的源码文件，相对扫描根、已排序 —— 供调用方交代覆盖面，也是防「扫了个空」的证据 */
	checked: string[];
	/**
	 * 因是核对表自身而被跳过的文件。
	 *
	 * @remarks
	 * 扫**单个** skill 的 `scripts/` 时正常恰好 1 个（源 skill 的 `corpus/data/annotations.ts`），
	 * 其余 skill 为 0 个（它们不持有核对表）。**两者都不是异常**，故调用方不该断言它非零 ——
	 * 该断言的是「所有根合计至少有 1 个」，见 `test/citations.test.ts`。
	 *
	 * 但某一栏为空仍有诊断价值：`checked` 为空说明根写歪或递归坏了；`skipped` 全仓为空
	 * 说明核对表识别失配 —— 核对表已进比对集，那些 suspect 引文会把自己报成违例。
	 * 两种都是调用方该立刻发现的状态，故单独记一栏而不是并进 `checked` 里。
	 */
	skipped: string[];
}

/**
 * 黑名单：核对表里 suspect / fabricated 条目的**引文核心**（书名号 / 引号内的部分）。
 *
 * @remarks
 * 所有扫描面（`.ts` / `.md` / 断语手册库）共用这一个构造 —— 判据只有一份，改口径时
 * 处处同时变，不会出现「一处放行了、另一处还拦着」的分叉。
 */
export function buildBannedSet(checklist: readonly AnnotationEntry[]): Set<string> {
	return new Set(
		checklist
			.filter(e => e.status === "suspect" || e.status === "fabricated")
			.flatMap(e => [...e.text.matchAll(/[「"『]([^」"』]{4,})[」"』]/g)].map(m => m[1]))
	);
}

/**
 * 在给定的文本块里找出仍以倪师名义出现的未核实引文。
 *
 * @param chunks - 参与比对的文本块（源码、文档或逐行断语），由调用方收集
 * @param banned - 黑名单（见 {@link buildBannedSet}）；缺省用全仓唯一核对表
 * @returns 违例的引文核心（已截断到 40 字），按出现顺序
 *
 * @remarks
 * 形态正则：`倪(海厦|师)` + 最多 10 个非句号非换行字符 +
 * 说 / 言 / 称 / 警示 / 警告 / 明言 / 强调 / 描述 / 提醒 + 可选冒号 + 引号内 4 字以上。
 * 不为任何调用面放松任何一项 —— 放宽的那天就是失效的那天。
 */
export function findViolations(
	chunks: readonly string[],
	banned: ReadonlySet<string> = buildBannedSet(ANNOTATIONS)
): string[] {
	// 文本中所有「倪海厦/倪师…说/言/警示…：『引文』」的引文核心
	const citeRe =
		/倪(?:海厦|师)[^。\n]{0,10}(?:说|言|称|警示|警告|明言|强调|描述|提醒)[：:]?\s*[「"『]([^」"』]{4,})[」"』]/g;
	return [...chunks.join("\n").matchAll(citeRe)]
		.filter(m => banned.has(m[1]))
		.map(m => m[1].slice(0, 40));
}
