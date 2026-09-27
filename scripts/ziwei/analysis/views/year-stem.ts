/**
 * 三点五、年干四化·全局关键宫位解读 —— 补三方四正之外的漏网四化。
 *
 * @remarks
 * 「三、本命四化会照」只看三方四正；本节的职责是**补齐其余宫位里、对本主题有意义的**
 * 那几条：拿 `TOPIC_KEY_PALACES[topic]` 给出的关键宫位清单，去全盘四化里筛，
 * 再**去掉三方四正已展示过的** —— 去重集就来自 `ctx.siHuaInSanFang`（跨小节依赖，
 * 见 `context.ts` 文件头）。
 *
 * 一条都没剩时整节不输出（连标题都不出），这与「三」的「留一段中性判语」不同：
 * 这里没内容是**正常**的，不值得占版面。
 *
 * @packageDocumentation
 */

import { SIHUA_CHAR_TO_KEY, TOPIC_KEY_PALACES, siHuaSymbol } from "../../analysis-data";
import type { AnalysisContext } from "../context";

/** 渲染「三点五、年干四化·全局关键宫位影响」整节（无命中时返回空数组）。 */
export function renderYearStem(ctx: AnalysisContext): string[] {
	const { chart, topic, siHuaInSanFang } = ctx;

	const lines: string[] = [];

	const keyPalaceRules = TOPIC_KEY_PALACES[topic];

	// 收集全盘所有四化（含三方四正外的宫位）
	const allChartSiHua: { palace: string; star: string; siHua: string }[] = [];
	chart.palaces.forEach(p => {
		p.stars
			.filter(s => s.siHua)
			.forEach(s => {
				allChartSiHua.push({ palace: p.name, star: s.name, siHua: s.siHua! });
			});
	});

	// 找出落在关键宫位、但尚未在三方四正中展示的四化
	const alreadyShown = new Set(
		siHuaInSanFang.map(s => `${s.starName}-${s.siHua}-${s.palaceName}`)
	);
	const globalKeyFindings: { palace: string; star: string; siHua: string; meaning: string }[] =
		[];

	keyPalaceRules.forEach(rule => {
		allChartSiHua
			.filter(sh => sh.palace === rule.palace)
			.forEach(sh => {
				const key = `${sh.star}-${sh.siHua}-${sh.palace}`;
				if (alreadyShown.has(key)) return; // 三方四正已展示，跳过
				const ruleKey = SIHUA_CHAR_TO_KEY[sh.siHua];
				const meaning = ruleKey ? rule[ruleKey] : undefined;
				if (meaning) {
					globalKeyFindings.push({
						palace: sh.palace,
						star: sh.star,
						siHua: sh.siHua,
						meaning,
					});
				}
			});
	});

	if (globalKeyFindings.length > 0) {
		lines.push(`**【年干四化·关键宫位影响】**`);
		lines.push("");
		globalKeyFindings.forEach(({ palace, star, siHua, meaning }) => {
			lines.push(`${siHuaSymbol(siHua)} **${star}化${siHua}**（落${palace}）→ ${meaning}`);
		});
		lines.push("");
	}

	return lines;
}
