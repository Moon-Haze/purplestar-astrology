/**
 * ⚠️ 宫名按 `Palace.name` 严格等值（带「宫」字、「仆役」→「交友宫」）；旧名静默落兜底。
 * 见 docs/code/analysis.md。
 * @file 宫位查询：取宫 / 三方四正 / 星曜成文
 * @packageDocumentation
 */

import type { Palace, Star, ZiweiChart } from "../types";
// 三方四正偏移单点在 ../palace-relations
import { oppositeBranch, palaceAtBranch, surroundBranches } from "../palace-relations";
import { starBadge } from "./lookups";

/**
 * @param chart - 命盘
 * @param palaceName - 宫名（严格等值，带「宫」字）
 * @returns 主星 + 借宫标记；空宫借对宫 `isLoan` 为 `true`，两宫皆空则空数组、`false`；找不到 `null`
 */
export function getPalaceStars(
	chart: ZiweiChart,
	palaceName: string
): { palace: Palace; mainStars: Star[]; isLoan: boolean } | null {
	const palace = chart.palaces.find(p => p.name === palaceName);
	if (!palace) {
		return null;
	}

	const mainStars = palace.stars.filter(s => s.type === "major");
	if (mainStars.length > 0) {
		return { palace, mainStars, isLoan: false };
	}

	// 空宫：借对宫
	const oppBranch = oppositeBranch(palace.branch);
	const oppPalace = palaceAtBranch(chart, oppBranch);
	if (!oppPalace) {
		return { palace, mainStars: [], isLoan: false };
	}

	const oppMainStars = oppPalace.stars.filter(s => s.type === "major");
	return { palace, mainStars: oppMainStars, isLoan: true };
}

/**
 * @param chart - 命盘
 * @param palaceName - 基准宫名（严格等值）
 * @returns 本宫 / 官禄 / 财帛 / 迁移，序即偏移序；找不到空数组
 */
export function getSanFangSiZheng(chart: ZiweiChart, palaceName: string): Palace[] {
	const main = chart.palaces.find(p => p.name === palaceName);
	if (!main) {
		return [];
	}

	return surroundBranches(main.branch)
		.map(b => chart.palaces.find(p => p.branch === b))
		.filter(Boolean) as Palace[];
}

/**
 * 宫内主星徽标行，徽标取 `overview-material` starBadge。
 * @param palace - 目标宫（直接取 `stars`）
 * @returns 主星徽标以「、」连成一行（星名 / 化象 / 亮度）；无主星 `<宫名>空宫`
 */
export function descPalaceStars(palace: Palace): string {
	const main = palace.stars.filter(s => s.type === "major");
	if (main.length === 0) {
		return `${palace.name}空宫`;
	}
	return main.map(s => starBadge(s)).join("、");
}

/**
 * @param palace - 目标宫
 * @returns 带四化的星与字（`name` / `mutagen`），只按 `mutagen` 真值不限类型；无则空数组
 */
export function getPalaceMutagen(palace: Palace): { name: string; mutagen: string }[] {
	return palace.stars.filter(s => s.mutagen).map(s => ({ name: s.name, mutagen: s.mutagen! }));
}

/**
 * 会照条目：宫内一颗带四化的星，连同落宫。
 * @remarks
 * 只按 `mutagen` 真值、不按 `Star.type` 过滤（含辅星四化）；
 * 三处消费方（主题主宫 / 大限宫 / 流年宫）范围各异，共用此步。
 */
export interface MutagenHit {
	/** 该四化落在哪个宫 */
	palace: Palace;
	/** 带四化的星名 */
	starName: string;
	/** 四化字：禄 / 权 / 科 / 忌 */
	mutagen: string;
}

/**
 * 会照本命四化，按「宫序 → 宫内星序」展开。
 * @param palaces - 宫集合，调用方按范围给出
 * @returns 会照条目；无四化空数组（调用方出兜底句）
 */
export function mutagenInPalaces(palaces: readonly Palace[]): MutagenHit[] {
	const hits: MutagenHit[] = [];
	for (const palace of palaces) {
		for (const { name, mutagen } of getPalaceMutagen(palace)) {
			hits.push({ palace, starName: name, mutagen });
		}
	}
	return hits;
}
