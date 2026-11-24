/** @file 四化六层 @packageDocumentation 「生年四化取农历年干」（1–2月农历公历干差一位）；宫干层取宫干非年干；绊线字段留着不填；禁宫干自化/来因宫。 */

import { Lunar } from "lunar-typescript";
import type { Mutagen, ZiweiChart } from "./types";
import { SI_HUA_TABLE } from "./data/sihua";
import { STEMS } from "./data/ganzhi";

/** @remarks @param stemIndex @returns */
function mutagenOf(stemIndex: number): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 1) 由天干索引取四化四星 ───────────────────────────────────
/** @param stemIndex @returns @remarks `data/sihua.ts`；越界返空串不抛。 */
export function getMutagenByStem(stemIndex: number): Record<Mutagen, string> {
	const arr = SI_HUA_TABLE[stemIndex];
	if (!arr) {
		return { 禄: "", 权: "", 科: "", 忌: "" };
	}
	return { 禄: arr[0], 权: arr[1], 科: arr[2], 忌: arr[3] };
}

// ─── 1b) 生年四化（chart 适配层） ──────────────────────────────
/** @param chart @returns @remarks {@link getYearStemIndex} */
export function getNativeMutagen(chart: ZiweiChart): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = chart.lunarInfo.yearStem;
	return mutagenOf(stemIndex);
}

// ─── 2) 公历年 → 年柱天干索引 ──────────────────────────────────
/** @param year @returns @remarks */
export function getYearStemIndex(year: number): number {
	return (((year - 4) % 10) + 10) % 10;
}

// ─── 3) 流年四化 ──────────────────────────────────────────────
/** @param year @returns @remarks 「一年动态」 {@link getYearStemIndex} */
export function getYearlyMutagen(year: number): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = getYearStemIndex(year);
	return mutagenOf(stemIndex);
}

// ─── 4) 流月四化（月柱天干，由年干 + 月序推） ───────────────
/** @param yearStem {@link getYearlyMutagen} @param month @returns @remarks --liuyue */
export function getMonthlyStemIndex(yearStem: number, month: number): number {
	// 五虎遁：正月（寅月）天干
	const startStemOfYin: Record<number, number> = {
		0: 2,
		5: 2, // 甲己 → 丙
		1: 4,
		6: 4, // 乙庚 → 戊
		2: 6,
		7: 6, // 丙辛 → 庚
		3: 8,
		8: 8, // 丁壬 → 壬
		4: 0,
		9: 0, // 戊癸 → 甲
	};
	const yinStem = startStemOfYin[yearStem] ?? 0;
	// 从寅（正月）到目标月（month 取 1-12）
	return (yinStem + ((month - 1) % 12) + 10) % 10;
}

/** {@link getMonthlyStemIndex} @param yearStem @param month @returns @remarks 「一月动态」 {@link getEffectiveMonthlyMonth} */
export function getMonthlyMutagen(
	yearStem: number,
	month: number
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = getMonthlyStemIndex(yearStem, month);
	return mutagenOf(stemIndex);
}

// ─── 5) 大限四化（大限宫干，文墨排盘展示口径） ───────────────
/** @param chart @param dxIndex @returns @remarks 取宫干非年干、`Palace.stem`、不加`Decadal`字段。 */
export function getDaXianMutagen(
	chart: ZiweiChart,
	dxIndex: number
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} | null {
	const dx = chart.decadals[dxIndex];
	if (!dx) {
		return null;
	}
	const palace = chart.palaces.find(p => p.branch === dx.palaceBranch);
	if (!palace) {
		return null;
	}
	const stemIndex = palace.stem;
	return mutagenOf(stemIndex);
}

// ─── 6) 流日四化（农历日柱天干） ─────────────────────────────
/** @param lunarYear @param lunarMonth @param lunarDay @param isLeapMonth @returns @remarks 现算、非法返null。 */
export function getDailyStemIndex(
	lunarYear: number,
	lunarMonth: number,
	lunarDay: number,
	isLeapMonth = false
): number | null {
	try {
		const monthKey = isLeapMonth ? -Math.abs(lunarMonth) : Math.abs(lunarMonth);
		const lunar = Lunar.fromYmd(lunarYear, monthKey, lunarDay);
		const stemIndex = STEMS.indexOf(lunar.getDayGan());
		return stemIndex >= 0 ? stemIndex : null;
	} catch {
		return null;
	}
}

/** {@link getDailyStemIndex} @returns @remarks 「一日动态」 `cli/fortune/mutagen.ts` @param lunarYear @param lunarMonth @param lunarDay @param isLeapMonth {@link getDailyStemIndex} */
export function getDailyMutagen(
	lunarYear: number,
	lunarMonth: number,
	lunarDay: number,
	isLeapMonth = false
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} | null {
	const stemIndex = getDailyStemIndex(lunarYear, lunarMonth, lunarDay, isLeapMonth);
	if (stemIndex === null) {
		return null;
	}
	return mutagenOf(stemIndex);
}

// ─── 7) 流时四化（五鼠遁：日干起子时天干） ───────────────────
/** @param dayStemIndex {@link getDailyMutagen} @param hourBranch @returns @remarks */
export function getHourlyStemIndex(dayStemIndex: number, hourBranch: number): number {
	// 五鼠遁：日干 → 子时天干
	const ziStemByDayStem: Record<number, number> = {
		0: 0,
		5: 0, // 甲己 → 甲
		1: 2,
		6: 2, // 乙庚 → 丙
		2: 4,
		7: 4, // 丙辛 → 戊
		3: 6,
		8: 6, // 丁壬 → 庚
		4: 8,
		9: 8, // 戊癸 → 壬
	};
	const branch = ((Math.trunc(hourBranch) % 12) + 12) % 12;
	return ((((ziStemByDayStem[dayStemIndex] ?? 0) + branch) % 10) + 10) % 10;
}

/** {@link getHourlyStemIndex} @returns @remarks 「一时辰动态」 {@link getDailyMutagen} @param dayStemIndex {@link getDailyMutagen} @param hourBranch {@link getHourlyStemIndex} */
export function getHourlyMutagen(
	dayStemIndex: number,
	hourBranch: number
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = getHourlyStemIndex(dayStemIndex, hourBranch);
	return mutagenOf(stemIndex);
}

// ─── 8) 闰月流月的月序换算（split 口径） ─────────────────────
/** {@link getEffectiveMonthlyMonth} */
export interface MonthlyMonthOptions {
	/** 闰月 */
	isLeapMonth?: boolean;
	/** 农历日 */
	day?: number;
	/** 次年干 */
	nextYearStem?: number;
}

/** @param month @param options @returns @remarks 前半月本月，后半月下月。 */
export function getEffectiveMonthlyMonth(month: number, options: MonthlyMonthOptions = {}): number {
	const normalized = Math.max(1, Math.min(12, Math.trunc(month)));
	if (!options.isLeapMonth || (options.day ?? 1) <= 15) {
		return normalized;
	}
	return normalized >= 12 ? 1 : normalized + 1;
}

// ─── 9) 六层取数链（单点） ───────────────────────────────────

/** {@link buildMutagenChain} */
export interface MutagenChainInput {
	/** --liunian */
	liuNianYear: number;
	/** 农历月 */
	liuYueMonth?: number | null;
	/** {@link liuYueMonth} */
	liuRiDay?: number | null;
	/** {@link liuRiDay} */
	liuShiHour?: number | null;
}

/** @remarks */
export interface MutagenChain {
	/** 农历年干索引 */
	yearStem: number;
	/** 生年四化：取农历年干，不与流年层混用公历取模 */
	native: ReturnType<typeof getNativeMutagen>;
	/** 流年四化：由公历年份经 {@link getYearStemIndex} 取干 */
	liuNian: ReturnType<typeof getYearlyMutagen>;
	/** 流月四化；`null` = 未给 `--monthly` */
	liuYue: ReturnType<typeof getMonthlyMutagen> | null;
	/** 流日四化；`null` = 未给月日或该日不存在（文本抛错 / JSON 静默） */
	liuRi: ReturnType<typeof getDailyMutagen> | null;
	/** 流时四化：当日日干起遁；`null` = 未给日时 */
	liuShi: ReturnType<typeof getHourlyMutagen> | null;
	/** 大限宫干四化（文墨口径）；童限未起运或定位异常为 `null` */
	daXian: ReturnType<typeof getDaXianMutagen>;
	/** 童限未起运；daXian 为 null 的原因之一 */
	decadalNotStarted: boolean;
}

/** @param chart @param input @remarks 对拍钉「六层四化取数链对拍」。 @returns 六层结果 */
export function buildMutagenChain(chart: ZiweiChart, input: MutagenChainInput): MutagenChain {
	const { liuNianYear, liuYueMonth, liuRiDay, liuShiHour } = input;
	const native = getNativeMutagen(chart);
	const liuNian = getYearlyMutagen(liuNianYear);
	const liuYue = liuYueMonth != null ? getMonthlyMutagen(liuNian.stemIndex, liuYueMonth) : null;
	const liuRi =
		liuYueMonth != null && liuRiDay != null
			? getDailyMutagen(liuNianYear, liuYueMonth, liuRiDay)
			: null;
	const liuShi =
		liuRi && liuShiHour != null ? getHourlyMutagen(liuRi.stemIndex, liuShiHour) : null;
	const daXian =
		chart.currentDecadalIndex === -1
			? null
			: getDaXianMutagen(chart, chart.currentDecadalIndex);
	return {
		yearStem: native.stemIndex,
		native,
		liuNian,
		liuYue,
		liuRi,
		liuShi,
		daXian,
		decadalNotStarted: chart.currentDecadalIndex === -1,
	};
}
