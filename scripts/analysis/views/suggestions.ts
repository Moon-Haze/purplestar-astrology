/**
 * 六、综合建议 —— 报告的收尾节，**无条件出**。
 *
 * ⚠️ 建议内容按盘推算（{@link buildTopicSuggestions}，change dynamic-topic-suggestions），
 *    信号全未命中时给通用收束句并显式标注；一句固定的「继续深度追问」引导语保证
 *    报告末尾总有一个可交互的落点 —— 故不要在别处加「有内容才出」的条件。
 *
 * 完整口径见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：slot = `suggestions`，「当前大限」
 * 依据的建议条目 `clockDependent: true`。
 *
 * @packageDocumentation
 */

import { TOPIC_LABEL } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import { buildTopicSuggestions } from "../../analysis/suggestions";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/** 渲染「六、综合建议」整节的结构化条目流。 */
export function renderSuggestionsItems(ctx: AnalysisContext): AnalysisItem[] {
	const { topic } = ctx;

	const items: AnalysisItem[] = [];

	items.push(headItem(`**【综合建议】**`, "suggestions"));
	items.push(blankItem("suggestions"));

	for (const s of buildTopicSuggestions(ctx)) {
		items.push(
			contentItem(
				s.basis === "无命中信号"
					? `→ ${s.text}（本盘无此主题的直接信号，此为通用收束）`
					: `→ ${s.text}`,
				"suggestions",
				{ ...(s.basis === "当前大限" ? { clockDependent: true } : {}) }
			)
		);
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

/** 渲染「六、综合建议」整节（文本投影）。 */
export function renderSuggestions(ctx: AnalysisContext): string[] {
	return formatItems(renderSuggestionsItems(ctx));
}
