/**
 * {@link AnalysisItem}：`formatItems` 投影；禁从 text 反解
 * @file 条目模型
 * @packageDocumentation
 */

/** 条目 */
export interface AnalysisItem {
	/** `""`=空行 */
	text: string;
	/**
	 * head=标题/content=内容
	 */
	kind: "head" | "content";
	/**
	 * 节槽/`extra`
	 */
	slot: string;
	/** 主星 */
	star?: string;
	/** 亮度 */
	brightness?: string;
	/** 化曜 */
	mutagen?: string;
	/** 落宫 */
	palace?: string;
	/** 辅煞 */
	aux?: string;
	/** 格局 */
	patternName?: string;
	/** 书证 */
	book?: { loc: string; text: string };
}

/**
 * @param items - 条目
 * @returns 等长行
 */
export function formatItems(items: readonly AnalysisItem[]): string[] {
	return items.map(it => it.text);
}

/**
 * @param text - 文本
 * @param slot - 节槽
 * @returns `head`
 */
export function headItem(text: string, slot: string): AnalysisItem {
	return { text, slot, kind: "head" };
}

/**
 * @param slot - 节槽
 * @returns 空行
 */
export function blankItem(slot: string): AnalysisItem {
	return { text: "", slot, kind: "content" };
}

/**
 * @param text - 文本
 * @param slot - 节槽
 * @param extra - 标注
 * @returns `content`
 */
export function contentItem(
	text: string,
	slot: string,
	extra?: Partial<Omit<AnalysisItem, "text" | "slot" | "kind">>
): AnalysisItem {
	return { text, slot, kind: "content", ...extra };
}
