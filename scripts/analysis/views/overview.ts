/**
 * 一、总论（总-分结构）—— topic 报告的开篇。
 *
 * ⚠️ 主宫无主星时整节退化成一句兜底提示（`emptyFallback`）。
 *
 * 取材规则住 `../overview-material`（单点），本文件只做【】版式装配；
 * 「动态优先、静态兜底」的三段结构见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：`renderOverviewItems` 是数据面
 * （条目流与行流一一对应），`renderOverview` 经 `formatItems` 投影为文本行。
 *
 * @packageDocumentation
 */

import type { AnalysisContext } from "../../analysis/context";
import { buildOverviewMaterial } from "../../analysis/overview-material";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「一、总论」整节的结构化条目流。
 *
 * slot 域：`topic-head` / `mods` / `geju` / `summary` / `main-palace`——与断语手册库
 * v2 的槽位同域。语义字段全部来自 material 透出的中间量（modsMeta / gejuMeta /
 * ctx.mainStars），不从成文反解。
 */
export function renderOverviewItems(ctx: AnalysisContext): AnalysisItem[] {
	const { topic, topicLabel, mainStars, primaryStar } = ctx;
	const m = buildOverviewMaterial(ctx);

	const items: AnalysisItem[] = [];

	items.push(headItem(`**【${topicLabel}】**`, "topic-head"));
	items.push(blankItem("topic-head"));

	if (!m.emptyFallback) {
		// ── 动态内容优先：命盘关键定制（仅核心主题才有内容）──
		if (m.mods.length > 0) {
			items.push(headItem(`**【命盘关键定制】**`, "mods"));
			items.push(blankItem("mods"));
			m.mods.forEach((p, i) => {
				items.push(
					contentItem(p, "mods", {
						star: primaryStar?.name,
						brightness: m.modsMeta[i]?.brightness,
						mutagen: m.modsMeta[i]?.mutagen,
					})
				);
				items.push(blankItem("mods"));
			});
		}

		// 格局识别（仅 overview / personality 有内容）
		if (m.geju.length > 0) {
			items.push(headItem(`**【命盘特殊格局】**`, "geju"));
			items.push(blankItem("geju"));
			m.geju.forEach((gj, i) => {
				items.push(
					contentItem(gj, "geju", {
						star: primaryStar?.name,
						patternName: m.gejuMeta[i]?.name,
					})
				);
				items.push(blankItem("geju"));
			});
		}

		// ── 静态白话总论（summary，核心 5 主题）──
		if (m.summary) {
			items.push(headItem(`**【星曜深层特质】**`, "summary"));
			items.push(blankItem("summary"));
			items.push(contentItem(m.summary, "summary", { star: primaryStar?.name }));
			items.push(blankItem("summary"));
		}

		// 命盘推演标题及本宫主星说明
		items.push(headItem(`**【命盘推演】**`, "main-palace"));
		items.push(blankItem("main-palace"));
		items.push(
			contentItem(
				`本宫主星：${m.loanNote}${m.mainBadge}${topic === "overview" ? `，${ctx.chart.fiveElementsClassName}` : ""}`,
				"main-palace",
				{ star: primaryStar?.name }
			)
		);
		items.push(blankItem("main-palace"));

		// 技术性星曜详解
		if (m.content) {
			items.push(contentItem(m.content, "main-palace", { star: primaryStar?.name }));
		}

		// 亮度补充
		if (m.brightNote) {
			items.push(blankItem("main-palace"));
			items.push(
				contentItem(m.brightNote, "main-palace", {
					star: primaryStar?.name,
					brightness: primaryStar?.brightness,
				})
			);
		}

		// 同宫第二主星（简述 + 同宫语境全文；全文无数据时只有简述行）
		const s2 = mainStars[1];
		if (m.secondStar) {
			items.push(blankItem("main-palace"));
			items.push(contentItem(m.secondStar, "main-palace", { star: s2?.name }));
		}
		if (m.secondStarContent) {
			items.push(blankItem("main-palace"));
			items.push(contentItem(m.secondStarContent, "main-palace", { star: s2?.name }));
		}
	} else {
		items.push(contentItem(m.emptyFallback, "main-palace"));
	}

	return items;
}

/** 渲染「一、总论」整节（文本投影）。 */
export function renderOverview(ctx: AnalysisContext): string[] {
	return formatItems(renderOverviewItems(ctx));
}
