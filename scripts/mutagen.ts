/**
 * 四化工具模块 —— 生年 / 流年 / 流月 / 大限宫干 / 流日 / 流时**六层四化**的映射查询。
 *
 * 本模块是**纯查表 + 纯算术**：输入天干索引（或公历年 / 农历月日），输出「禄权科忌」各自
 * 对应的星名。生年四化由排盘层落在 `Star.mutagen` 上，这里不参与安星、也不产出盘面字段。
 *
 * ⚠️ 体系红线：本模块**不含宫干自化与来因宫**（飞星派工具，继续禁用）；
 *    `types.ts` 的绊线字段刻意保留为「留着但不填」，大限宫干四化走纯函数层、
 *    **不往 `Decadal` 上加字段**。六层清单、混合口径与红线的完整论证见
 *    docs/code/chart-kernel.md，体系立场另见仓库根 `AGENTS.md` 与 `SKILL.md`。
 *
 * @packageDocumentation
 */

import { Lunar } from "lunar-typescript";
import type { Mutagen, ZiweiChart } from "./types";
import { SI_HUA_TABLE } from "@/data/sihua";
import { STEMS } from "@/data/ganzhi";

// ─── 1) 由天干索引取四化四星 ───────────────────────────────────
/**
 * 天干索引 → { 禄, 权, 科, 忌 } 对应星名。
 *
 * @param stemIndex - 天干索引 0–9（0=甲 … 9=癸）
 * @returns 四化类型到星名的映射，键固定为 禄 / 权 / 科 / 忌
 *
 * @remarks
 * 表在 `data/sihua.ts` 的 `SI_HUA_TABLE`，按天干索引取第 0–3 位。
 *
 * ⚠️ 索引越界时返回**四项皆为空串**的记录而**不抛错**（与 `projectPalaceName` 未命中即抛错
 *    是相反的取舍）—— 调用方靠空串自然短路。取舍理由见 docs/code/chart-kernel.md。
 */
export function getMutagenByStem(stemIndex: number): Record<Mutagen, string> {
	const arr = SI_HUA_TABLE[stemIndex];
	if (!arr) {
		return { 禄: "", 权: "", 科: "", 忌: "" };
	}
	return { 禄: arr[0], 权: arr[1], 科: arr[2], 忌: arr[3] };
}

// ─── 1b) 生年四化（chart 适配层） ──────────────────────────────
/**
 * 生年四化：从命盘取**农历年干**（`chart.lunarInfo.yearStem`），再查其四化。
 *
 * @param chart - 命盘（`algorithm` 的产物）
 * @returns 年干索引、年干名与四化四星
 *
 * @remarks
 * ⚠️ **生年四化必须用农历年干，不可用公历取模**（{@link getYearStemIndex} 只服务流年）：
 *    1–2 月出生者两者的年干会相差一位，走错口径会让【生年四化】与宫详表自相矛盾。
 *    该红线的 chart 适配收进本函数，与流年层的警告同址 —— `test/cli.test.ts` 盯着这条。
 */
export function getNativeMutagen(chart: ZiweiChart): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = chart.lunarInfo.yearStem;
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 2) 公历年 → 年柱天干索引 ──────────────────────────────────
/**
 * 公历年份 → 年柱天干索引。
 *
 * @param year - 公历年份（公元纪年）
 * @returns 天干索引 0–9（0=甲 … 9=癸）
 *
 * @remarks
 * 公元 4 年为甲子年，故 `(year − 4) mod 10`；两步取模保证 4 之前的年份仍落在 0–9。
 *
 * ⚠️ **按公历年直接取模，不做农历年边界切换**：本函数**只服务流年四化**，
 *    **生年四化必须用 `chart.lunarInfo.yearStem`** —— 1–2 月出生者两者的年干会相差一位，
 *    走错口径会让【生年四化】与宫详表自相矛盾。`test/cli.test.ts` 盯着这条红线，
 *    完整论证见 docs/code/chart-kernel.md。
 */
export function getYearStemIndex(year: number): number {
	return (((year - 4) % 10) + 10) % 10;
}

// ─── 3) 流年四化 ──────────────────────────────────────────────
/**
 * 流年四化：由**公历年份**推当年年干，再取其四化。
 *
 * @param year - 流年的公历年份（`cli/commands/index.ts` 取 `--liunian`，缺省为当前公历年）
 * @returns 年干索引、年干名与四化四星
 *
 * @remarks
 * 年干走 {@link getYearStemIndex}（纯取模），故同样**按公历年、不做农历年边界切换**。
 * 六层四化里的「一年动态」层，本函数**不涉及**任何宫干（细节见 docs/code/chart-kernel.md）。
 */
export function getYearlyMutagen(year: number): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = getYearStemIndex(year);
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 4) 流月四化（月柱天干，由年干 + 月序推） ───────────────
/**
 * 流月天干（五虎遁）。
 *
 * @param yearStem - 年干索引 0–9（0=甲 … 9=癸），通常来自 {@link getYearlyMutagen} 的 `stemIndex`
 * @param month - 农历月 1–12（1 = 正月 / 寅月）
 * @returns 目标月的月柱天干索引 0–9
 *
 * @remarks
 * 五虎遁：甲己年起丙寅、乙庚年起戊寅、丙辛年起庚寅、丁壬年起壬寅、戊癸年起甲寅 ——
 * `startStemOfYin` 表即「年干索引 → 正月（寅月）天干索引」，再按 `month − 1` 顺推。
 *
 * ⚠️ 起点是**正月（寅月）**而非子月，故 `month` 是农历月份序号，不是地支索引；
 *    表未命中时兜底为 0（甲）—— 代价只是该月四化算错，不影响排盘（见 docs/code/chart-kernel.md）。
 */
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

/**
 * 流月四化：先由 {@link getMonthlyStemIndex} 取月柱天干，再取其四化。
 *
 * @param yearStem - 年干索引 0–9，通常传流年的 `stemIndex`
 * @param month - 农历月 1–12
 * @returns 月柱天干索引、天干名与四化四星
 *
 * @remarks
 * 六层四化里的「一月动态」层。`cli/commands/index.ts` 对应 `--liuyue`（省略即不输出流月），
 * 且**由流年干推月干**，故调用时传的是 `getYearlyMutagen(...).stemIndex` 而非出生年干。
 * 闰月的月序换算不在本函数内 —— 调用方先用 {@link getEffectiveMonthlyMonth}
 * 把「闰月 + 农历日」折算成有效月序再传入。
 */
export function getMonthlyMutagen(
	yearStem: number,
	month: number
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = getMonthlyStemIndex(yearStem, month);
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 5) 大限四化（大限宫干，文墨排盘展示口径） ───────────────
/**
 * 大限四化：取**大限宫的宫干**（非本命年干）查四化表。
 *
 * @param chart - 已排好的命盘
 * @param dxIndex - 大限下标（`chart.decadals[dxIndex]`）
 * @returns 宫干索引、天干名与四化四星；大限下标越界或宫干缺失时为 `null`
 *
 * @remarks
 * 文墨排盘展示层口径：宫干来自盘面 `Palace.stem`。**纯函数层** —— 不往 `Decadal` 上加字段。
 *
 * ⚠️ **童限期（`currentDecadalIndex === -1`）没有大限宫干可言**，调用方须先判童限再调本函数：
 *    传 `-1` 得到 `null`，语义是「无此大限」，不是「童限」（见 docs/code/chart-kernel.md）。
 */
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
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 6) 流日四化（农历日柱天干） ─────────────────────────────
/**
 * 流日天干：由农历年月日取当日日柱的天干索引。
 *
 * @param lunarYear - 农历年（正月初一口径）
 * @param lunarMonth - 农历月 1–12（闰月传 `isLeapMonth = true`，内部转负月号）
 * @param lunarDay - 农历日 1–30
 * @param isLeapMonth - 是否闰月
 * @returns 日干索引 0–9；日期非法（该月无此日等）时为 `null`
 *
 * @remarks
 * 日柱由 `lunar-typescript` 现算（不缓存：CLI 单次取数，不值得建表）。日期非法时它抛错，
 * 本函数捕获后返回 `null`，由调用方转为「流日参数超出该月天数」的中文报错。
 */
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

/**
 * 流日四化：先由 {@link getDailyStemIndex} 取日柱天干，再取其四化。
 *
 * @returns 日干索引、天干名与四化四星；日期非法时为 `null`
 *
 * @remarks
 * 六层四化里的「一日动态」层。调用方（`cli/fortune/mutagen.ts`）从 `--yearly` / `--monthly` /
 * `--daily` 组出农历年月日，闰月沿用 `--leap` 旗标。
 */
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
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 7) 流时四化（五鼠遁：日干起子时天干） ───────────────────
/**
 * 流时天干（五鼠遁）。
 *
 * @param dayStemIndex - 日干索引 0–9，通常来自 {@link getDailyMutagen} 的 `stemIndex`
 * @param hourBranch - 时支索引 0–11（0=子 … 11=亥）；**12（晚子时）归一为 0**
 * @returns 时柱天干索引 0–9
 *
 * @remarks
 * 五鼠遁：甲己日起甲子、乙庚日起丙子、丙辛日起戊子、丁壬日起庚子、戊癸日起壬子 ——
 * `ziStemByDayStem` 表即「日干索引 → 子时天干索引」，再按 `hourBranch` 顺推。
 *
 * ⚠️ **晚子时（23:00–24:00）按当日日干起遁**（12 归一为子 0），不换次日日干 —— 与文墨
 *    排盘展示层一致；传统晚子时派是另一套口径，本模块只提供这一种
 *    （见 docs/code/chart-kernel.md）。
 */
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

/**
 * 流时四化：先由 {@link getHourlyStemIndex} 取时柱天干，再取其四化。
 *
 * @returns 时干索引、天干名与四化四星
 *
 * @remarks
 * 六层四化里的「一时辰动态」层，粒度到时辰即止 —— 本模块不提供流分。
 * 调用方须自备**当日日干**（传 {@link getDailyMutagen} 的 `stemIndex`）。
 */
export function getHourlyMutagen(
	dayStemIndex: number,
	hourBranch: number
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<Mutagen, string>;
} {
	const stemIndex = getHourlyStemIndex(dayStemIndex, hourBranch);
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getMutagenByStem(stemIndex),
	};
}

// ─── 8) 闰月流月的月序换算（split 口径） ─────────────────────
/** {@link getEffectiveMonthlyMonth} 的选项。 */
export interface MonthlyMonthOptions {
	/** 是否闰月（`--leap`）。非闰月时本对象可整体省略。 */
	isLeapMonth?: boolean;
	/** 农历日 1–30；闰月的半月归属按它判断，缺省按 1（取本月）。 */
	day?: number;
	/** 闰十二月后半跨到次年正月时使用的年干（次年干），供换月后重推月干。 */
	nextYearStem?: number;
}

/**
 * 闰月流月的**有效月序**（split 半月口径）。
 *
 * @param month - 农历月 1–12（闰月本身也传 1–12，闰与否由 options 区分）
 * @param options - 闰月标记与农历日
 * @returns 用于推月干的有效月序 1–12
 *
 * @remarks
 * split 口径：**闰月前半月（农历日 ≤ 15）按本月取月干，后半月（> 15）按下月取**；闰十二月
 * 后半跨到次年正月时月序回 1、月干须用 `options.nextYearStem` 重推（由调用方自行判断）。
 * 非闰月输入原样返回。口径来历与真机对照见 docs/code/chart-kernel.md。
 */
export function getEffectiveMonthlyMonth(month: number, options: MonthlyMonthOptions = {}): number {
	const normalized = Math.max(1, Math.min(12, Math.trunc(month)));
	if (!options.isLeapMonth || (options.day ?? 1) <= 15) {
		return normalized;
	}
	return normalized >= 12 ? 1 : normalized + 1;
}
