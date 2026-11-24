/**
 * 补三方四正之外的漏网四化。
 *
 * ⚠️ 去重集来自 `ctx.mutagenInSanFang`（跨小节依赖，见 `context.ts` 文件头）——
 *    本模块唯一跨节状态，勿在节内另算。
 *
 * 无命中则整节不输出（连标题都不出），与「三」的「留一段中性判语」不同：
 * 无内容属**正常**，不占版面。口径见 docs/code/analysis.md。
 *
 * 产出结构化条目流（一源双投影，见 `../items`）：携带 star / mutagen / palace 字段。
 *
 * @file 年干四化·全局关键宫位解读，补三方四正之外的漏网四化
 *
 * @packageDocumentation
 */

import { SIHUA_CHAR_TO_KEY, TOPIC_KEY_PALACES, mutagenSymbol } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「三点五」整节的结构化条目流（slot = `year-stem`；无命中时返回空数组）。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）：只读命盘全部四化、主题键
 * （决定查哪组 `TOPIC_KEY_PALACES` 关键宫位）与 `mutagenInSanFang` 去重集；去重集不重算
 * @returns 条目流：节头 + 每条「落在关键宫位、且三方四正未展示过」的四化行
 * （带 star / mutagen / palace 字段）；无命中时为空数组（整节连标题都不出）
 */
function renderYearStemItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, topic, mutagenInSanFang } = ctx;

	const items: AnalysisItem[] = [];

	const keyPalaceRules = TOPIC_KEY_PALACES[topic];

	// 收集全盘四化（含三方四正外的宫位）
	const allChartMutagen: { palace: string; star: string; mutagen: string }[] = [];
	chart.palaces.forEach(p => {
		p.stars
			.filter(s => s.mutagen)
			.forEach(s => {
				allChartMutagen.push({ palace: p.name, star: s.name, mutagen: s.mutagen! });
			});
	});

	// 找出落在关键宫位、三方四正未展示的四化
	const alreadyShown = new Set(
		mutagenInSanFang.map(s => `${s.starName}-${s.mutagen}-${s.palaceName}`)
	);
	const globalKeyFindings: { palace: string; star: string; mutagen: string; meaning: string }[] =
		[];

	keyPalaceRules.forEach(rule => {
		allChartMutagen
			.filter(sh => sh.palace === rule.palace)
			.forEach(sh => {
				const key = `${sh.star}-${sh.mutagen}-${sh.palace}`;
				if (alreadyShown.has(key)) {
					return;
				} // 三方四正已展示，跳过
				const ruleKey = SIHUA_CHAR_TO_KEY[sh.mutagen];
				const meaning = ruleKey ? rule[ruleKey] : undefined;
				if (meaning) {
					globalKeyFindings.push({
						palace: sh.palace,
						star: sh.star,
						mutagen: sh.mutagen,
						meaning,
					});
				}
			});
	});

	if (globalKeyFindings.length > 0) {
		items.push(headItem(`**【年干四化·关键宫位影响】**`, "year-stem"));
		items.push(blankItem("year-stem"));
		globalKeyFindings.forEach(({ palace, star, mutagen, meaning }) => {
			items.push(
				contentItem(
					`${mutagenSymbol(mutagen)} **${star}化${mutagen}**（落${palace}）→ ${meaning}`,
					"year-stem",
					{ star, mutagen, palace }
				)
			);
		});
		items.push(blankItem("year-stem"));
	}

	return items;
}

/**
 * 渲染「三点五、年干四化·全局关键宫位影响」整节（文本投影；无命中时返回空数组）。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）
 * @returns 与 {@link renderYearStemItems} 逐条对应的文本行；无命中时为空数组
 */
export function renderYearStem(ctx: AnalysisContext): string[] {
	return formatItems(renderYearStemItems(ctx));
}
