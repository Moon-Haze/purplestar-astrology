/**
 * 格局查询底座
 * @remarks ../palace-relations；docs/code/patterns.md。
 * @file 辅助底座
 * @packageDocumentation
 */

import type { ZiweiChart, Palace, Star, Mutagen } from "../types";
import type { PatternVerdict } from "../patterns/types";
import { SHA_NAMES, SHA_HARD, SHA_KONG } from "../corpus/data/patterns";
import { oppositeBranch, palaceAtBranch, surroundBranches } from "../palace-relations";

// 「与某处同源」「命宫」

/**
 * 主星名
 * @param palace
 * @returns
 * @remarks
 */
export function getMajorStarNames(palace: Palace): string[] {
	return palace.stars.filter(s => s.type === "major").map(s => s.name);
}
/**
 * 按名取星
 * @param palace
 * @param name
 * @returns
 * @remarks {@link hasStar}
 */
export function findStar(palace: Palace, name: string): Star | undefined {
	return palace.stars.find(s => s.name === name);
}
/**
 * 有某星
 * @param palace
 * @param name
 * @returns
 */
export function hasStar(palace: Palace, name: string): boolean {
	return palace.stars.some(s => s.name === name);
}
/**
 * 找宫
 * @param chart
 * @param name
 * @returns
 * @remarks
 */
export function findStarPalace(chart: ZiweiChart, name: string): Palace | undefined {
	return chart.palaces.find(p => p.stars.some(s => s.name === name));
}
/**
 * 按支取宫
 * @param chart
 * @param branch
 * @returns
 * @remarks
 */
export function getPalaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
	return palaceAtBranch(chart, branch);
}
/**
 * 煞星数
 * @param palace
 * @param list
 * @returns
 * @remarks
 */
export function shaCountInPalace(palace: Palace, list: string[] = SHA_HARD): number {
	return palace.stars.filter(s => list.includes(s.name)).length;
}
/**
 * 坐煞
 * @param palace
 * @param list
 * @returns
 * @remarks {@link shaCountInPalace}
 */
export function hasShaInPalace(palace: Palace, list: string[] = SHA_NAMES): boolean {
	return palace.stars.some(s => list.includes(s.name));
}
/**
 * 三方四正
 * @param chart
 * @returns
 * @remarks 「取宫位」
 */
export function getSurroundPalaces(chart: ZiweiChart): Palace[] {
	const branches = surroundBranches(chart.soulBranch);
	return chart.palaces.filter(p => branches.includes(p.branch));
}
/**
 * 支在三方四正
 * @param chart
 * @param branch
 * @returns
 * @remarks {@link getSurroundPalaces}{@link getPalaceByBranch}
 */
export function isInSanFang(chart: ZiweiChart, branch: number): boolean {
	return surroundBranches(chart.soulBranch).includes(branch);
}
/**
 * 对宫
 * @param chart
 * @param branch
 * @returns
 * @remarks
 */
export function getDuiGong(chart: ZiweiChart, branch: number): Palace | undefined {
	return getPalaceByBranch(chart, oppositeBranch(branch));
}
/**
 * 夹宫
 * @param chart
 * @param branch
 * @returns
 * @remarks {@link getSurroundPalaces}
 */
export function getJiaPalaces(chart: ZiweiChart, branch: number): { prev?: Palace; next?: Palace } {
	return {
		prev: getPalaceByBranch(chart, (branch + 11) % 12),
		next: getPalaceByBranch(chart, (branch + 1) % 12),
	};
}
/**
 * 全部星名
 * @param chart
 * @returns
 * @remarks {@link getSurroundPalaces}{@link sanFangShaCount}
 */
export function sanFangAllStars(chart: ZiweiChart): Set<string> {
	return new Set(getSurroundPalaces(chart).flatMap(p => p.stars.map(s => s.name)));
}
/**
 * 三方煞星数
 * @param chart
 * @param list
 * @returns
 * @remarks {@link shaCountInPalace}{@link sanFangAllStars}
 */
export function sanFangShaCount(chart: ZiweiChart, list: string[] = SHA_HARD): number {
	return getSurroundPalaces(chart).reduce((sum, p) => sum + shaCountInPalace(p, list), 0);
}
/**
 * 庙旺
 * @param palace
 * @param starName
 * @returns
 * @remarks
 */
export function isBright(palace: Palace, starName: string): boolean {
	const s = findStar(palace, starName);
	return s?.brightness === "bright";
}
/**
 * 落陷
 * @param palace
 * @param starName
 * @returns
 * @remarks {@link isBright}
 */
export function isDim(palace: Palace, starName: string): boolean {
	const s = findStar(palace, starName);
	return s?.brightness === "dim";
}
/**
 * 星四化
 * @param palace
 * @param starName
 * @returns
 * @remarks
 */
export function getStarMutagen(palace: Palace, starName: string): Star["mutagen"] | undefined {
	return findStar(palace, starName)?.mutagen;
}
/**
 * 宫内有四化
 * @param palace
 * @param hua
 * @returns
 * @remarks {@link getStarMutagen}「**某颗指定星**化没化」「**这一宫**里 有没有星化」「命宫见禄」「禄」「权」「科」「忌」「化禄」
 */
export function palaceHasMutagen(palace: Palace, hua: Mutagen): boolean {
	return palace.stars.some(s => s.mutagen === hua);
}
/**
 * 三方有四化
 * @param chart
 * @param hua
 * @returns
 * @remarks {@link palaceHasMutagen}{@link palaceHasMutagen}：「再会化科」「三方有化禄或化权」「四宫里有没有」⚠️ `has` 恒假。
 */
export function sanFangHasMutagen(chart: ZiweiChart, hua: Mutagen): boolean {
	return getSurroundPalaces(chart).some(p => palaceHasMutagen(p, hua));
}

/**
 * 替换占位符
 * @param verdict - ../corpus/data/patterns.ts
 * @param vars
 * @returns
 * @remarks ../corpus/data/patterns.ts。
 */
export function fillVerdict(verdict: PatternVerdict, vars: Record<string, string>): PatternVerdict {
	/** 替换占位符。 */
	const sub = (s: string): string => s.replace(/\{([^{}]+)\}/g, (m, k: string) => vars[k] ?? m);
	const out: PatternVerdict = { description: sub(verdict.description) };
	if (verdict.topicDescription !== undefined) {
		out.topicDescription = sub(verdict.topicDescription);
	}
	if (verdict.source !== undefined) {
		out.source = sub(verdict.source);
	}
	return out;
}
