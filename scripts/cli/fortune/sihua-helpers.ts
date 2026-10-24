/**
 * 四化与会照的专题共用 helper —— 落宫行拼装、会照主星并集、生年四化取数、同星引动。
 *
 * 收拢原先散在各专题节里的同构循环，被 mutagen / yearly / decadal / age / focus 共用。
 */

import type { ZiweiChart, Mutagen } from "@/types";
import { locateSihua } from "../chart/render";

/**
 * 一个地支集合内的**会照主星**汇总（跨宫并集，按盘面出现顺序）。
 *
 * @param chart - 命盘
 * @param branches - 地支索引集合（通常是三方四正四支）
 */
export function huiZhaoMajors(chart: ZiweiChart, branches: number[]): string[] {
	const seen: string[] = [];
	for (const b of branches) {
		const p = chart.palaces.find(x => x.branch === b);
		if (!p) {
			continue;
		}
		for (const s of p.stars.filter(x => x.type === "major")) {
			if (!seen.includes(s.name)) {
				seen.push(s.name);
			}
		}
	}
	return seen;
}

/**
 * 四化落宫行：`化{化} {星} → {宫}(支)`。
 *
 * @param sanFang - 给定时，落在其中的行追加 {@link mark} 后缀（★ 类标记）
 * @param mark - 三方命中的标记文案（流年节是「★ 入流年三方四正」，大限节是短「★」）
 *
 * @remarks
 * 收拢原先散在 5 个专题节里的同构循环（生年 / 流年 / 流月 / 流年深入 / 大限深入）——
 * 各节差异只有「要不要三方标记、标记文案」，一个参数表达；「（未上盘）」兜底与支号
 * 括号的拼接规则也只活在一处。
 */
export function sihuaLines(
	chart: ZiweiChart,
	transforms: Record<Mutagen, string>,
	sanFang?: number[],
	mark = " ★"
): string[] {
	return locateSihua(chart, transforms).map(x => {
		const base = `  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`;
		if (!sanFang) {
			return base;
		}
		const palace = chart.palaces.find(p => x.palace !== null && p.name === x.palace);
		const hit = palace ? sanFang.includes(palace.branch) : false;
		return base + (hit ? mark : "");
	});
}

/**
 * 「会照主星：…」行（{@link huiZhaoMajors} 的并集；空时给兜底文案）—— 三个专题节同款。
 */
export function huiZhaoLine(chart: ZiweiChart, sanFang: number[]): string {
	return `  会照主星：${huiZhaoMajors(chart, sanFang).join("、") || "（无主星会照）"}`;
}

/**
 * 生年×流年的**同星引动**：同一颗星同时被两套四化点到（不论何化）。
 *
 * @returns 每条含星名、生年化、流年化与落宫地支
 *
 * @remarks
 * 三合派传统论「叠」的可靠形态之一（双忌 / 忌逢禄引动等）的**事实陈述**，
 * 具体吉凶交给解读层 —— 这里只报「谁被双引动、落哪」。
 */
export function sameStarPairs(
	chart: ZiweiChart,
	native: Record<string, string>,
	liuNian: Record<string, string>
) {
	const out: { star: string; nativeHua: string; liuNianHua: string; branch: number | null }[] =
		[];
	for (const hua of ["禄", "权", "科", "忌"] as const) {
		for (const hua2 of ["禄", "权", "科", "忌"] as const) {
			if (native[hua] === liuNian[hua2] && !out.some(o => o.star === native[hua])) {
				const palace = chart.palaces.find(p => p.stars.some(s => s.name === native[hua]));
				out.push({
					star: native[hua],
					nativeHua: hua,
					liuNianHua: hua2,
					branch: palace ? palace.branch : null,
				});
			}
		}
	}
	return out;
}
