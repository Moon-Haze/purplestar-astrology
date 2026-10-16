/**
 * 一、总论（总-分结构）—— topic 报告的开篇。
 *
 * ⚠️ 主宫无主星时整节退化成一句兜底提示（`emptyFallback`）。
 *
 * 取材规则住 `../overview-material`（单点），本文件只做【】版式装配；
 * 「动态优先、静态兜底」的三段结构见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import type { AnalysisContext } from "../../analysis/context";
import { buildOverviewMaterial } from "../../analysis/overview-material";

/** 渲染「一、总论」整节。 */
export function renderOverview(ctx: AnalysisContext): string[] {
	const { chart, topic, topicLabel } = ctx;
	const m = buildOverviewMaterial(ctx);

	const lines: string[] = [];

	lines.push(`**【${topicLabel}】**`);
	lines.push("");

	if (!m.emptyFallback) {
		// ── 动态内容优先：命盘关键定制（仅核心主题才有内容）──
		if (m.mods.length > 0) {
			lines.push(`**【命盘关键定制】**`);
			lines.push("");
			m.mods.forEach(p => {
				lines.push(p);
				lines.push("");
			});
		}

		// 格局识别（仅 overview / personality 有内容）
		if (m.geju.length > 0) {
			lines.push(`**【命盘特殊格局】**`);
			lines.push("");
			m.geju.forEach(gj => {
				lines.push(gj);
				lines.push("");
			});
		}

		// ── 静态白话总论（summary，核心 5 主题）──
		if (m.summary) {
			lines.push(`**【星曜深层特质】**`);
			lines.push("");
			lines.push(m.summary);
			lines.push("");
		}

		// 命盘推演标题及本宫主星说明
		lines.push(`**【命盘推演】**`);
		lines.push("");
		lines.push(
			`本宫主星：${m.loanNote}${m.mainBadge}${topic === "overview" ? `，${chart.fiveElementsClassName}` : ""}`
		);
		lines.push("");

		// 技术性星曜详解
		if (m.content) {
			lines.push(m.content);
		}

		// 亮度补充
		if (m.brightNote) {
			lines.push("");
			lines.push(m.brightNote);
		}

		// 同宫第二主星
		if (m.secondStar) {
			lines.push("");
			lines.push(m.secondStar);
		}
	} else {
		lines.push(m.emptyFallback);
	}

	return lines;
}
