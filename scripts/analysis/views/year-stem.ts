/**
 * 三点五、年干四化·全局关键宫位解读 —— 补三方四正之外的漏网四化。
 *
 * ⚠️ 去重集来自 `ctx.mutagenInSanFang`（跨小节依赖，见 `context.ts` 文件头）——
 *    它是本模块唯一一条真实的跨节状态，不要在节内另算。
 *
 * 一条都没剩时整节不输出（连标题都不出），这与「三」的「留一段中性判语」不同：
 * 这里没内容是**正常**的，不值得占版面。完整口径见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import { SIHUA_CHAR_TO_KEY, TOPIC_KEY_PALACES, mutagenSymbol } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";

/** 渲染「三点五、年干四化·全局关键宫位影响」整节（无命中时返回空数组）。 */
export function renderYearStem(ctx: AnalysisContext): string[] {
	const { chart, topic, mutagenInSanFang } = ctx;

	const lines: string[] = [];

	const keyPalaceRules = TOPIC_KEY_PALACES[topic];

	// 收集全盘所有四化（含三方四正外的宫位）
	const allChartMutagen: { palace: string; star: string; mutagen: string }[] = [];
	chart.palaces.forEach(p => {
		p.stars
			.filter(s => s.mutagen)
			.forEach(s => {
				allChartMutagen.push({ palace: p.name, star: s.name, mutagen: s.mutagen! });
			});
	});

	// 找出落在关键宫位、但尚未在三方四正中展示的四化
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
				if (alreadyShown.has(key)) {return;} // 三方四正已展示，跳过
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
		lines.push(`**【年干四化·关键宫位影响】**`);
		lines.push("");
		globalKeyFindings.forEach(({ palace, star, mutagen, meaning }) => {
			lines.push(`${mutagenSymbol(mutagen)} **${star}化${mutagen}**（落${palace}）→ ${meaning}`);
		});
		lines.push("");
	}

	return lines;
}
