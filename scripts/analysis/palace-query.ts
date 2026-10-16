/**
 * 宫位查询 —— 按宫名取宫、按宫取三方四正、把宫里的星曜渲染成一行文字。
 *
 * ⚠️ **宫名一律按 `Palace.name` 严格等值匹配**（带「宫」字、「仆役」→「交友宫」）：
 *    传旧口径名（`迁移`、`仆役`）会直接找不到宫，并静默落到调用方的兜底文案。
 *
 * 只读查询层定位与四处共用的理由，见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import type { Palace, Star, ZiweiChart } from "../types";
// 对宫与三方四正的偏移：全仓单点在 ../palace-relations
import { oppositeBranch, palaceAtBranch, surroundBranches } from "../palace-relations";
import { starBadge } from "./overview-material";

/** 获取宫位的主星列表（空宫则借对宫） */
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

/** 获取三方四正（4个宫位）*/
export function getSanFangSiZheng(chart: ZiweiChart, palaceName: string): Palace[] {
	const main = chart.palaces.find(p => p.name === palaceName);
	if (!main) {
		return [];
	}

	return surroundBranches(main.branch)
		.map(b => chart.palaces.find(p => p.branch === b))
		.filter(Boolean) as Palace[];
}

/** 描述一个宫位的星曜（带四化；徽标拼式取 `overview-material` 的 starBadge 单点） */
export function descPalaceStars(palace: Palace): string {
	const main = palace.stars.filter(s => s.type === "major");
	if (main.length === 0) {
		return `${palace.name}空宫`;
	}
	return main.map(s => starBadge(s)).join("、");
}

/** 获取宫位中的所有四化信息 */
export function getPalaceMutagen(palace: Palace): { name: string; mutagen: string }[] {
	return palace.stars.filter(s => s.mutagen).map(s => ({ name: s.name, mutagen: s.mutagen! }));
}
