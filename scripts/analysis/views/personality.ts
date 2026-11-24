/**
 * @file「五、性格专属补充」节，仅 personality 主题渲染。
 * ⚠️「一、总论」的 profile.summary 与本节雷同，故跳过、由本节替代。
 * 详见 docs/code/analysis.md；一源双投影见 `../items`。
 * @packageDocumentation
 */

import type { AnalysisContext } from "../../analysis/context";
import { selectBranches } from "../../analysis/lookups";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * @param ctx - {@link AnalysisContext}；经 {@link selectBranches} 按四化 / 亮度投影
 * @returns `【性格深描】` 节头 + 全文；非 personality / 缺主星 profile 空
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
 * @param ctx - {@link AnalysisContext}
 * @returns 对应 {@link renderPersonalityItems} 文本行；非 personality 空
 */
export function renderPersonality(ctx: AnalysisContext): string[] {
	return formatItems(renderPersonalityItems(ctx));
}
