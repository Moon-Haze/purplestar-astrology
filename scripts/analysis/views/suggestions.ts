/**
 * 六、综合建议 —— 报告的收尾节，**无条件出**。
 *
 * ⚠️ 建议内容按盘推算（{@link buildTopicSuggestions}，change dynamic-topic-suggestions），
 *    信号全未命中时给通用收束句并显式标注；一句固定的「继续深度追问」引导语保证
 *    报告末尾总有一个可交互的落点 —— 故不要在别处加「有内容才出」的条件。
 *
 * 完整口径见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import { TOPIC_LABEL } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import { buildTopicSuggestions } from "../../analysis/suggestions";

/** 渲染「六、综合建议」整节。 */
export function renderSuggestions(ctx: AnalysisContext): string[] {
	const { topic } = ctx;

	const lines: string[] = [];

	lines.push(`**【综合建议】**`);
	lines.push("");

	for (const s of buildTopicSuggestions(ctx)) {
		lines.push(
			s.basis === "无命中信号"
				? `→ ${s.text}（本盘无此主题的直接信号，此为通用收束）`
				: `→ ${s.text}`
		);
	}
	lines.push("");
	lines.push(`**【继续深度追问】**`);
	lines.push(
		`可在下方输入具体问题，如："今年${TOPIC_LABEL[topic]}有何重大变化？""当前大限对${TOPIC_LABEL[topic]}影响如何？"——AI 将结合完整命盘为你进行个性化解读。`
	);

	return lines;
}
