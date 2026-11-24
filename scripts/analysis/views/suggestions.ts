/**
 * ⚠️ 收尾节，无条件出：按盘推算（{@link buildTopicSuggestions}），未命中给收束句并标注；
 *    固定「继续深度追问」引导语保落点，勿加「有内容才出」条件。口径 docs/code/analysis.md。
 *    产出条目流见 `../items`。
 * @file 六、综合建议 —— 报告收尾节
 * @packageDocumentation
 */

import { TOPIC_LABEL } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import { buildTopicSuggestions, suggestionLine } from "../../analysis/suggestions";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「六、综合建议」条目流。
 * @param ctx - 上下文（{@link AnalysisContext}）：由 {@link buildTopicSuggestions} 按盘推算，只装配版式
 * @returns `【综合建议】` 节头 + 建议行 + `【继续深度追问】` 引导语；恒非空
 */
function renderSuggestionsItems(ctx: AnalysisContext): AnalysisItem[] {
	const { topic } = ctx;

	const items: AnalysisItem[] = [];

	items.push(headItem(`**【综合建议】**`, "suggestions"));
	items.push(blankItem("suggestions"));

	for (const s of buildTopicSuggestions(ctx)) {
		items.push(contentItem(suggestionLine(s), "suggestions"));
	}
	items.push(blankItem("suggestions"));
	items.push(headItem(`**【继续深度追问】**`, "suggestions"));
	items.push(
		contentItem(
			`可在下方输入具体问题，如："今年${TOPIC_LABEL[topic]}有何重大变化？""当前大限对${TOPIC_LABEL[topic]}影响如何？"——AI 将结合完整命盘为你进行个性化解读。`,
			"suggestions"
		)
	);

	return items;
}

/**
 * 渲染「六、综合建议」文本投影。
 * @param ctx - 上下文（{@link AnalysisContext}）
 * @returns 与 {@link renderSuggestionsItems} 对应文本行；恒非空
 */
export function renderSuggestions(ctx: AnalysisContext): string[] {
	return formatItems(renderSuggestionsItems(ctx));
}
