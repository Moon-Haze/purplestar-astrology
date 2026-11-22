/**
 * 五、性格专属补充 —— 仅 personality 主题出。
 *
 * ⚠️ 与「一、总论」分开的原因：总论里的**星曜深层特质**（`profile.summary`）在
 *    personality 主题下**刻意跳过**（两节同出会雷同），这块性格深描就是它的替代。
 *
 * 完整口径见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）。
 *
 * @file 五、性格专属补充 —— 仅 personality 主题出
 *
 * @packageDocumentation
 */

import type { AnalysisContext } from "../../analysis/context";
import { selectBranches } from "../../analysis/lookups";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「五、性格专属补充」整节的结构化条目流（非 personality 主题返回空数组）。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）：本函数只读主题键、主星、主星 profile 与性别；性格文案经 {@link selectBranches} 按主星实际四化 / 亮度分支投影
 * @returns 条目流：`【性格深描】` 节头 + 一段性格全文（带 star 语义字段）；主题不是 `personality`、或主星 / profile 缺任一项时为空数组
 */
function renderPersonalityItems(ctx: AnalysisContext): AnalysisItem[] {
	const { topic, primaryStar, profile, gender } = ctx;

	const items: AnalysisItem[] = [];

	if (topic === "personality" && primaryStar && profile) {
		items.push(headItem(`**【性格深描】**`, "extra:性格深描"));
		items.push(blankItem("extra:性格深描"));
		items.push(
			contentItem(
				selectBranches(profile.personality, primaryStar, gender),
				"extra:性格深描",
				{
					star: primaryStar.name,
				}
			)
		);
		items.push(blankItem("extra:性格深描"));
	}

	return items;
}

/**
 * 渲染「五、性格专属补充」整节（文本投影；非 personality 主题返回空数组）。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）
 * @returns 与 {@link renderPersonalityItems} 条目流逐条对应的文本行；非 personality 主题为空数组
 */
export function renderPersonality(ctx: AnalysisContext): string[] {
	return formatItems(renderPersonalityItems(ctx));
}
