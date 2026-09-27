/**
 * 六、综合建议 —— 报告的收尾节，**无条件出**。
 *
 * @remarks
 * 唯一不判条件的小节：`TOPIC_SUGGESTIONS[topic]` 的建议清单 + 一句固定的
 * 「继续深度追问」引导语。它保证报告末尾总有一个可交互的落点 ——
 * 故不要在别处加「有内容才出」的条件。
 *
 * @packageDocumentation
 */

import { TOPIC_LABEL, TOPIC_SUGGESTIONS } from "../data";
import type { AnalysisContext } from "../context";

/** 渲染「六、综合建议」整节。 */
export function renderSuggestions(ctx: AnalysisContext): string[] {
	const { topic } = ctx;

	const lines: string[] = [];

	lines.push(`**【综合建议】**`);
	lines.push("");

	TOPIC_SUGGESTIONS[topic].forEach(s => lines.push(`→ ${s}`));
	lines.push("");
	lines.push(`**【继续深度追问】**`);
	lines.push(
		`可在下方输入具体问题，如："今年${TOPIC_LABEL[topic]}有何重大变化？""当前大限对${TOPIC_LABEL[topic]}影响如何？"——AI 将结合完整命盘为你进行个性化解读。`
	);

	return lines;
}
