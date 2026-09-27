/**
 * 命宫摘要 —— 命宫主星的简要概括：星名、关键词、星性。
 *
 * @remarks
 * 与格局判定**零耦合**：本文件不调用 `./helpers` 里任何查询函数，也不读 `./data`，
 * 两张映射表直接写在这里 —— 是格局层里最干净的一刀。
 *
 * 「保持向后兼容」指的是：它是格局层最早对外暴露的导出之一，
 * `cli/commands.ts` 的 `analyze` 至今按原样取用，签名与返回结构不得改动。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";

// ────────────────── 命宫摘要（保持向后兼容）──────────────────
/**
 * 取命宫主星的简要概括：星名、关键词、星性。
 *
 * @param chart - 已排好的命盘
 * @returns `stars` 为命宫主星名列表（按宫内星序），`keywords` 为关键词（最多 5 个），
 *   `nature` 为星性；命宫缺失时三项皆空
 *
 * @remarks
 * 为**向后兼容**保留的轻量摘要：两张大表（`keywordMap` / `natureMap`）是按 14 主星硬编码
 * 的中文词条，故与 `./helpers` 及各分组识别器都不同 —— 这里**不判条件，只做映射**，属纯文案层。
 * `cli/commands.ts` 的 `analyze`（文本与 `--json` 的 `mingGongSummary`）都取它，与
 * `detectPatterns` 的输出拼成完整解读素材。
 *
 * 三处口径需要注意：
 *
 * 1. **只看主星**：`keywordMap` 与 `natureMap` 都只覆盖 14 主星，吉煞杂耀一概不参与
 * 2. **空宫给"空宫"**：`stars` 为空（命宫无主星）时 `nature` 直接是字面量 `"空宫"`，
 *    `keywords` 为空数组 —— 此时调用方需改为从**借入的对宫主星**取释义，
 *    `cli/commands.ts` 就是这么处理的（见 `Palace.borrowedStars`）
 * 3. **`nature` 与 `keywords` 都锚在首颗主星**：`nature` 取 `starNames[0]`，而
 *    `keywords` 把**所有**主星的词条摊平后 `slice(0, 5)` —— 命宫坐双主星时，
 *    首星决定星性、两星共同贡献关键词
 *
 * 未收录的星名（表外键）不会报错：`keywordMap[n] ?? []` 跳过，`nature` 兜底为空串。
 *
 * @example
 * ```ts
 * const { stars, keywords, nature } = getMingGongSummary(chart);
 * // 空宫时 stars = []、nature = "空宫"，改用 chart 里该宫的 borrowedStars 取释义
 * ```
 */
export function getMingGongSummary(chart: ZiweiChart): {
	stars: string[];
	keywords: string[];
	nature: string;
} {
	const mingPalace = chart.palaces.find(p => p.branch === chart.mingGongBranch);
	if (!mingPalace) return { stars: [], keywords: [], nature: "" };

	const majorStars = mingPalace.stars.filter(s => s.type === "major");
	const starNames = majorStars.map(s => s.name);

	const keywordMap: Record<string, string[]> = {
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

	const natureMap: Record<string, string> = {
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

	const keywords = starNames.flatMap(n => keywordMap[n] ?? []).slice(0, 5);
	const nature = starNames.length > 0 ? (natureMap[starNames[0]] ?? "") : "空宫";

	return { stars: starNames, keywords, nature };
}
