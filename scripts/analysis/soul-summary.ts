/**
 * @remarks 签名不改，详 docs/code/analysis.md。
 * @file 命宫摘要
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";

// ────────────────── 两张主星词条表（模块级导出，键域由 invariants 互证）──────────────────
/** 键域`data/stars.ts`互证；`?? []`空宫 */
export const SOUL_KEYWORD_MAP: Record<string, string[]> = {
	紫微: ["尊贵", "独立", "领导"],
	天机: ["智慧", "机变", "善谋"],
	太阳: ["阳刚", "官贵", "慷慨"],
	武曲: ["财富", "刚毅", "果断"],
	天同: ["温和", "享福", "随缘"],
	廉贞: ["才艺", "桃花", "多变"],
	天府: ["财库", "稳重", "保守"],
	太阴: ["柔美", "财富", "细腻"],
	贪狼: ["欲望", "桃花", "多才"],
	巨门: ["善辩", "多思", "口才"],
	天相: ["辅佐", "行政", "稳健"],
	天梁: ["荫护", "医药", "长辈"],
	七杀: ["将星", "果决", "孤克"],
	破军: ["开创", "变动", "破旧"],
};

/** 星性。键域同 {@link SOUL_KEYWORD_MAP} */
export const SOUL_NATURE_MAP: Record<string, string> = {
	紫微: "帝王星",
	天机: "智慧星",
	太阳: "贵人星",
	武曲: "财帛星",
	天同: "福德星",
	廉贞: "桃花星",
	天府: "财库星",
	太阴: "财富星",
	贪狼: "桃花星",
	巨门: "是非星",
	天相: "印绶星",
	天梁: "荫庇星",
	七杀: "将帅星",
	破军: "变动星",
};

// ────────────────── 命宫摘要（保持向后兼容）──────────────────
/**
 * @param chart - 盘
 * @returns stars/keywords/nature；空宫空
 * @remarks {@link SOUL_KEYWORD_MAP}/{@link SOUL_NATURE_MAP} 仅14主星，杂耀不算。空宫 nature`"空宫"`取`borrowedStars`。nature首星、keywords摊平前5。表外键`?? []`、nature空串，不掩抄错。
 * @example 空宫→借宫。
 */
export function getMingGongSummary(chart: ZiweiChart): {
	stars: string[];
	keywords: string[];
	nature: string;
} {
	const mingPalace = chart.palaces.find(p => p.branch === chart.soulBranch);
	if (!mingPalace) {
		return { stars: [], keywords: [], nature: "" };
	}

	const majorStars = mingPalace.stars.filter(s => s.type === "major");
	const starNames = majorStars.map(s => s.name);

	const keywords = starNames.flatMap(n => SOUL_KEYWORD_MAP[n] ?? []).slice(0, 5);
	const nature = starNames.length > 0 ? (SOUL_NATURE_MAP[starNames[0]] ?? "") : "空宫";

	return { stars: starNames, keywords, nature };
}
