/**
 * 一、总论（总-分结构）—— topic 报告的开篇。
 *
 * @remarks
 * 结构是「动态优先、静态兜底」：先出**命盘关键定制**（按本宫主星的亮度 / 四化从
 * `profile.topic_mods` 里取的专属开场）与**命盘特殊格局**（仅 overview / personality），
 * 再出静态白话总论（`profile.summary`，personality 段跳过以免与 overview 雷同），
 * 最后是本宫主星说明与星曜详解。
 *
 * 主宫无主星时整节退化成一句兜底提示 —— 注意此时 `ctx.mainStars` 可能仍非空
 * （借自对宫），但 `ctx.profile` 为 `null`，故 `if (primaryStar && profile)` 两侧
 * 会一并落到 `else`。
 *
 * @packageDocumentation
 */

import {
	SIHUA_CHAR_TO_KEY,
	STAR_BRIEF,
	SUMMARY_TOPICS,
	TOPIC_CONTENT_KEY,
	TOPIC_SUMMARY_KEY,
	type StarContent,
} from "../data";
import type { AnalysisContext } from "../context";
import { detectGeJu } from "../lookups";

/** 渲染「一、总论」整节。 */
export function renderOverview(ctx: AnalysisContext): string[] {
	const { chart, topic, topicLabel, palaceName, mainStars, primaryStar, profile, isLoan } = ctx;

	const lines: string[] = [];

	lines.push(`**【${topicLabel}】**`);
	lines.push("");

	if (primaryStar && profile) {
		const contentKey = TOPIC_CONTENT_KEY[topic];
		const summaryKey = TOPIC_SUMMARY_KEY[topic];
		const gender: "male" | "female" = chart.birthInfo?.gender === "female" ? "female" : "male";

		const isCoreTopic = SUMMARY_TOPICS.has(topic) || topic === "personality";
		const showSummarySection = SUMMARY_TOPICS.has(topic); // personality 不展示 summary 段

		const loanNote = isLoan ? `（${palaceName}空宫，借对宫${primaryStar.name}论事）` : "";

		// ── 动态内容优先：命盘关键定制（亮度 + 四化的 topic_mods，仅核心主题）──
		if (isCoreTopic) {
			const topicMod = profile.topic_mods?.[summaryKey as keyof typeof profile.topic_mods];
			const brightnessKey =
				primaryStar.brightness === "bright"
					? "bright"
					: primaryStar.brightness === "dim"
						? "dim"
						: null;
			const sihuaKey = primaryStar.siHua ? (SIHUA_CHAR_TO_KEY[primaryStar.siHua] ?? null) : null;

			const dynamicParts: string[] = [];
			if (brightnessKey && topicMod?.[brightnessKey]) {
				dynamicParts.push(topicMod[brightnessKey]!);
			}
			if (sihuaKey && topicMod?.[sihuaKey]) {
				dynamicParts.push(topicMod[sihuaKey]!);
			}

			if (dynamicParts.length > 0) {
				lines.push(`**【命盘关键定制】**`);
				lines.push("");
				dynamicParts.forEach(p => {
					lines.push(p);
					lines.push("");
				});
			}
		}

		// 格局识别（仅overview/personality展示）
		if (topic === "overview" || topic === "personality") {
			const geJuList = detectGeJu(chart);
			if (geJuList.length > 0) {
				lines.push(`**【命盘特殊格局】**`);
				lines.push("");
				geJuList.forEach(gj => {
					lines.push(`⭐ **${gj.name}**：${gj.description}`);
					lines.push("");
				});
			}
		}

		// ── 静态白话总论（summary）──
		// 5 个核心主题（命格/感情/事业/财运/健康）显示
		// personality 跳过（避免与 overview 用同一段 summary 'overview' 导致雷同）
		if (showSummarySection && profile.summary?.[gender]?.[summaryKey]) {
			lines.push(`**【星曜深层特质】**`);
			lines.push("");
			lines.push(profile.summary[gender][summaryKey]);
			lines.push("");
		}

		// 命盘推演标题及本宫主星说明
		const mainStarDesc =
			mainStars
				.map(
					s =>
						`${s.name}${s.siHua ? "化" + s.siHua : ""}${s.brightness === "bright" ? "（庙旺）" : s.brightness === "dim" ? "（落陷）" : ""}`
				)
				.join("、") || "空宫";

		lines.push(`**【命盘推演】**`);
		lines.push("");
		lines.push(
			`本宫主星：${loanNote}${mainStarDesc}${topic === "overview" ? `，${chart.wuxingJuName}` : ""}`
		);
		lines.push("");

		// 技术性星曜详解
		if (topic === "overview") {
			lines.push(profile.mingGong);
		} else {
			lines.push(profile[contentKey as keyof StarContent] as string);
		}

		// 亮度补充
		if (primaryStar.brightness === "bright" && profile.brightMod) {
			lines.push("");
			lines.push(`▶ ${profile.brightMod}`);
		} else if (primaryStar.brightness === "dim" && profile.dimMod) {
			lines.push("");
			lines.push(`▶ ${profile.dimMod}`);
		}

		// 同宫第二主星
		if (mainStars[1]) {
			const s2 = mainStars[1];
			const brief = STAR_BRIEF[s2.name] ?? "";
			lines.push("");
			lines.push(`同宫第二主星：**${s2.name}${s2.siHua ? "化" + s2.siHua : ""}**——${brief}`);
		}
	} else {
		lines.push(`${palaceName}空宫，需借对宫论事，命格整体以三方四正综合判断。`);
	}

	return lines;
}
