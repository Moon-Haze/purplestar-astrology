/**
 * 五、性格专属补充 —— 仅 personality 主题出。
 *
 * @remarks
 * 只有一段 `profile.personality`。之所以与「一、总论」分开：总论里的
 * **星曜深层特质**（`profile.summary`）在 personality 主题下**刻意跳过**
 * （它取的是 overview 那一段，两节同出会雷同），这块性格深描就是它的替代。
 *
 * @packageDocumentation
 */

import type { AnalysisContext } from "../context";

/** 渲染「五、性格专属补充」整节（非 personality 主题返回空数组）。 */
export function renderPersonality(ctx: AnalysisContext): string[] {
	const { topic, primaryStar, profile } = ctx;

	const lines: string[] = [];

	if (topic === "personality" && primaryStar && profile) {
		lines.push(`**【性格深描】**`);
		lines.push("");
		lines.push(profile.personality);
		lines.push("");
	}

	return lines;
}
