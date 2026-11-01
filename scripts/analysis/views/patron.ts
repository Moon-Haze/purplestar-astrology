/**
 * 五点六、魁钺贵人倾向细分 —— 仅 overview / personality / career / wealth 出。
 *
 * ⚠️ 天魁、天钺在**哪一宫**就取 `KUI_YUE_GUIREN_MAP` 里该宫的断语，与本主题的宫位无关
 *    —— 故四个主题共用同一段内容，出与不出只由主题清单决定，内容不变。
 *
 * 两星都没有（或所在宫无断语）时整节不出。
 *
 * 完整口径见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：slot = `kui-yue`，条目带 aux
 * （魁/钺星名）与 palace（所在宫）。
 *
 * @packageDocumentation
 */

import { KUI_YUE_GUIREN_MAP } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/** 渲染「五点六、魁钺贵人倾向细分」的结构化条目流（主题不符或无命中时返回空数组）。 */
export function renderKuiYueItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, topic } = ctx;

	const items: AnalysisItem[] = [];

	if (
		topic === "overview" ||
		topic === "personality" ||
		topic === "career" ||
		topic === "wealth"
	) {
		const kuiPalaceForTopic = chart.palaces.find(p => p.stars.some(s => s.name === "天魁"));
		const yuePalaceForTopic = chart.palaces.find(p => p.stars.some(s => s.name === "天钺"));
		const notes: Array<{ star: string; palace: string; text: string }> = [];
		if (kuiPalaceForTopic) {
			const map = KUI_YUE_GUIREN_MAP[kuiPalaceForTopic.name];
			if (map?.kui) {
				notes.push({
					star: "天魁",
					palace: kuiPalaceForTopic.name,
					text: `**天魁在${kuiPalaceForTopic.name}**：${map.kui}`,
				});
			}
		}
		if (yuePalaceForTopic) {
			const map = KUI_YUE_GUIREN_MAP[yuePalaceForTopic.name];
			if (map?.yue) {
				notes.push({
					star: "天钺",
					palace: yuePalaceForTopic.name,
					text: `**天钺在${yuePalaceForTopic.name}**：${map.yue}`,
				});
			}
		}
		if (notes.length > 0) {
			items.push(headItem(`**【贵人倾向·魁钺细分】**`, "kui-yue"));
			items.push(blankItem("kui-yue"));
			notes.forEach(({ star, palace, text }) => {
				items.push(contentItem(`◇ ${text}`, "kui-yue", { aux: star, palace }));
			});
			items.push(blankItem("kui-yue"));
		}
	}

	return items;
}

/** 渲染「五点六、魁钺贵人倾向细分」整节（文本投影；主题不符或无命中时返回空数组）。 */
export function renderKuiYue(ctx: AnalysisContext): string[] {
	return formatItems(renderKuiYueItems(ctx));
}
