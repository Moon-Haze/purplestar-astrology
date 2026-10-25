/**
 * 五、性格专属补充 —— 仅 personality 主题出。
 *
 * ⚠️ 与「一、总论」分开的原因：总论里的**星曜深层特质**（`profile.summary`）在
 *    personality 主题下**刻意跳过**（两节同出会雷同），这块性格深描就是它的替代。
 *
 * 完整口径见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import type { AnalysisContext } from "../../analysis/context";
import { selectGender } from "../../analysis/lookups";

/** 渲染「五、性格专属补充」整节（非 personality 主题返回空数组）。 */
export function renderPersonality(ctx: AnalysisContext): string[] {
	const { topic, primaryStar, profile, gender } = ctx;

	const lines: string[] = [];

	if (topic === "personality" && primaryStar && profile) {
		lines.push(`**【性格深描】**`);
		lines.push("");
		lines.push(selectGender(profile.personality, gender));
		lines.push("");
	}

	return lines;
}
