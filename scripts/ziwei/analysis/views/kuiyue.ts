/**
 * 五点六、魁钺贵人倾向细分 —— 仅 overview / personality / career / wealth 出。
 *
 * @remarks
 * 天魁、天钺在**哪一宫**，就取 `KUI_YUE_GUIREN_MAP` 里该宫的断语。与本主题的宫位
 * 无关，故四个主题共用同一段内容 —— 出与不出由上面的主题清单决定，内容不变。
 *
 * 两星都没有（或所在宫无断语）时整节不出。
 *
 * @packageDocumentation
 */

import { KUI_YUE_GUIREN_MAP } from "../../analysis-data";
import type { AnalysisContext } from "../context";

/** 渲染「五点六、魁钺贵人倾向细分」整节（主题不符或无命中时返回空数组）。 */
export function renderKuiYue(ctx: AnalysisContext): string[] {
	const { chart, topic } = ctx;

	const lines: string[] = [];

	if (
		topic === "overview" ||
		topic === "personality" ||
		topic === "career" ||
		topic === "wealth"
	) {
		const kuiPalaceForTopic = chart.palaces.find(p => p.stars.some(s => s.name === "天魁"));
		const yuePalaceForTopic = chart.palaces.find(p => p.stars.some(s => s.name === "天钺"));
		const notes: string[] = [];
		if (kuiPalaceForTopic) {
			const map = KUI_YUE_GUIREN_MAP[kuiPalaceForTopic.name];
			if (map?.kui) notes.push(`**天魁在${kuiPalaceForTopic.name}**：${map.kui}`);
		}
		if (yuePalaceForTopic) {
			const map = KUI_YUE_GUIREN_MAP[yuePalaceForTopic.name];
			if (map?.yue) notes.push(`**天钺在${yuePalaceForTopic.name}**：${map.yue}`);
		}
		if (notes.length > 0) {
			lines.push(`**【贵人倾向·魁钺细分】**`);
			lines.push("");
			notes.forEach(n => lines.push(`◇ ${n}`));
			lines.push("");
		}
	}

	return lines;
}
