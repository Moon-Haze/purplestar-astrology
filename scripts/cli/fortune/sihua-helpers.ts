/**
 * 四化会照专题 helper：收拢同构循环，5 节共用。
 */

import type { ZiweiChart, Mutagen } from "@/types";
import { locateSihua } from "../chart/render";

/**
 * @param chart - 命盘
 * @param branches - 地支索引集合（三方四正四支）
 * @returns 主星名数组（跨宫并集、按盘面去重；空则空数组）
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
 * 四化落宫行 `化{化} {星} → {宫}(支)`。
 * @param sanFang - 三方四正支集；给出时命中行加 {@link mark} 后缀
 * @param mark - 标记文案（流年「★ 入流年三方四正」，大限「★」）
 * @remarks
 * @param chart - 命盘
 * @param transforms - 本层四化映射（键化禄 / 化权 / 化科 / 化忌）
 * @returns 每落点一行，未上盘记「（未上盘）」
 * 各节差异只在「要不要三方标记、标记文案」，由参数表达；兜底与支号拼接只此一处。
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
 * 「会照主星：…」行（{@link huiZhaoMajors} 并集）。
 * @param chart - 命盘
 * @param sanFang - 三方四正地支索引
 * @returns 「会照主星：A、B」；无主星「（无主星会照）」
 */
export function huiZhaoLine(chart: ZiweiChart, sanFang: number[]): string {
	return `  会照主星：${huiZhaoMajors(chart, sanFang).join("、") || "（无主星会照）"}`;
}

/**
 * 生年×流年同星引动：同星被两套四化点到。
 * @returns 星名、生年化、流年化、落宫地支
 * @remarks
 * @param chart - 命盘（查落宫）
 * @param native - 生年四化映射（键化禄 / 化权 / 化科 / 化忌，值星名）
 * @param liuNian - 流年四化映射（与 `native` 同星不同化也算引动）
 * 三合派「叠」形态（双忌 / 忌逢禄）的事实陈述；吉凶交由解读层 —— 只报「谁被双引动、落哪」。
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
