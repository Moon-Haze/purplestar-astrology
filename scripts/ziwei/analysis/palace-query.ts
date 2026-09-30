/**
 * 宫位查询 —— 按宫名取宫、按宫取三方四正、把宫里的星曜渲染成一行文字。
 *
 * @remarks
 * 本文件是 `analysis/` 的**只读查询层**：四个函数都只读 `ZiweiChart`，不持有状态、
 * 不产生输出行，被 `context.ts` 与 `views/` 各节共用。`descPalaceStars` 被 4 处共用
 * （三方四正联动 / 当前大限 / 流年 / 流月），故与 `getSanFangSiZheng` 同处一层。
 *
 * ⚠️ **宫名一律按 `Palace.name` 严格等值匹配**（带「宫」字、「仆役」→「交友宫」）。
 * 传旧口径名（`迁移`、`仆役`）会直接找不到宫，并静默落到调用方的兜底文案 ——
 * 这是本模块从上游 toolkit 拷入时做的第 1 处口径适配，理由见 `index.ts` 的文件头。
 *
 * @packageDocumentation
 */

import type { Palace, Star, ZiweiChart } from "../types";
// 对宫与三方四正的偏移：全仓单点在 ../palace-relations
// （2026-09-26 收敛之前，本目录的前身 analysis.ts 自写了 6 处）
import { oppositeBranch, surroundBranches } from "../palace-relations";

/** 获取宫位的主星列表（空宫则借对宫） */
export function getPalaceStars(
	chart: ZiweiChart,
	palaceName: string
): { palace: Palace; mainStars: Star[]; isLoan: boolean } | null {
	const palace = chart.palaces.find(p => p.name === palaceName);
	if (!palace) return null;

	const mainStars = palace.stars.filter(s => s.type === "major");
	if (mainStars.length > 0) return { palace, mainStars, isLoan: false };

	// 空宫：借对宫
	const oppBranch = oppositeBranch(palace.branch);
	const oppPalace = chart.palaces.find(p => p.branch === oppBranch);
	if (!oppPalace) return { palace, mainStars: [], isLoan: false };

	const oppMainStars = oppPalace.stars.filter(s => s.type === "major");
	return { palace, mainStars: oppMainStars, isLoan: true };
}

/** 获取三方四正（4个宫位）*/
export function getSanFangSiZheng(chart: ZiweiChart, palaceName: string): Palace[] {
	const main = chart.palaces.find(p => p.name === palaceName);
	if (!main) return [];

	return surroundBranches(main.branch)
		.map(b => chart.palaces.find(p => p.branch === b))
		.filter(Boolean) as Palace[];
}

/** 描述一个宫位的星曜（带四化） */
export function descPalaceStars(palace: Palace): string {
	const main = palace.stars.filter(s => s.type === "major");
	if (main.length === 0) return `${palace.name}空宫`;
	return main
		.map(
			s =>
				`${s.name}${s.mutagen ? "化" + s.mutagen : ""}${s.brightness === "bright" ? "（庙旺）" : s.brightness === "dim" ? "（落陷）" : ""}`
		)
		.join("、");
}

/** 获取宫位中的所有四化信息 */
export function getPalaceMutagen(palace: Palace): { name: string; mutagen: string }[] {
	return palace.stars.filter(s => s.mutagen).map(s => ({ name: s.name, mutagen: s.mutagen! }));
}
