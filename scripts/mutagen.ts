/**
 * 四化工具模块 —— 生年 / 流年 / 流月 / 大限宫干 / 流日 / 流时六层四化的映射查询。
 *
 * 本模块是**纯查表 + 纯算术**：输入天干索引（或公历年 / 农历月日），输出「禄权科忌」各自对应的
 * 星名。生年四化本身由排盘层（`algorithm.ts`）从 iztro 的 `mutagen` 字段直接落到 `Star.mutagen`
 * 上，这里不参与安星，也不产出任何盘面字段。
 *
 * ## 六层四化（本模块接口的全部）
 *
 * - 生年四化（本命）= 出生年天干四化，静态基础，落在 `Star.mutagen` 上（本模块不参与）
 * - 流年四化 = 当年年干的四化，一年动态（{@link getYearlyMutagen}）
 * - 流月四化 = 月柱天干（五虎遁）的四化，一月动态（{@link getMonthlyMutagen}）
 * - 大限四化 = **大限宫干**的四化，十年动态（{@link getDaXianMutagen}）
 * - 流日四化 = 农历日柱天干的四化，一日动态（{@link getDailyMutagen}）
 * - 流时四化 = 时柱天干（五鼠遁）的四化，一时辰动态（{@link getHourlyMutagen}）
 *
 * ## 体系口径：文墨排盘 + 倪师论断（混合口径）
 *
 * - **排盘与运限四化以文墨天机为准**——大限四化取大限宫干（非本命年干）是文墨排盘
 *   展示层的口径，与流年/流月/流日/流时同属「时间干四化」，随上游 2026-10 混合口径引入。
 * - **论断框架仍按倪师三合派**：命宫为本，三方为用；人事努力 + 地理调整 > 先天命运
 *   （2/3 > 1/3）；大道至简，解读不停留在术语堆砌。
 * - 论断层引用大限宫干四化时仍按「落宫与会照」组织（化 X 落某宫 → 该宫主管领域受引动），
 *   不引入「飞入飞出」的飞星派论法。
 *
 * ## ⚠️ 体系红线：本模块不含宫干自化与来因宫
 *
 * 以下两件飞星派工具在本项目**继续禁用**，本模块不提供对应函数，`algorithm.ts` 也不填充
 * 相关盘面字段：
 *
 * - ❌ **宫干自化** —— 某宫宫干引发的四化中被化星恰在本宫（`Palace.selfMutagen` 恒不填）
 * - ❌ **来因宫** —— 追溯某化星由哪个宫的宫干「飞」来的飞星派追溯法
 *
 * ⚠️ **`types.ts` 的绊线刻意保留**：`Palace.selfMutagen` / `Decadal.mutagen` 两个字段与
 * `SelfMutagenMark` / `DecadalMutagen` 两个类型仍在，理由是它们的作用**恰恰是「留着但不填」**
 * —— 断言要盯的是「有没有被填回」，字段没了就无从盯起。大限宫干四化走本模块的
 * {@link getDaXianMutagen} 纯函数层（调用方传大限索引、返回四化记录），**不往 `Decadal`
 * 结构上加字段** —— `school.test.ts` 的「大限键集合全等」断言继续有效。
 *
 * 完整立场见仓库根 `CLAUDE.md` 的「体系口径」一节与 `SKILL.md` 的同名章节。
 *
 * @packageDocumentation
 */

import { Lunar } from "lunar-typescript";
import type { Mutagen, ZiweiChart } from "./types";
import { SI_HUA_TABLE, STEMS } from "./constants";

// ─── 1) 由天干索引取四化四星 ───────────────────────────────────
/**
 * 天干索引 → { 禄, 权, 科, 忌 } 对应星名。
 *
 * @param stemIndex - 天干索引 0–9（0=甲 … 9=癸）
 * @returns 四化类型到星名的映射，键固定为 禄 / 权 / 科 / 忌
 *
 * @remarks
 * 表在 `constants.ts` 的 `SI_HUA_TABLE`，按天干索引取第 0–3 位。
 *
 * ⚠️ 索引越界（`SI_HUA_TABLE[stemIndex]` 取空）时返回**四项皆为空串**的记录而**不抛错** ——
 * 调用方靠空串自然短路。这与 `algorithm.ts` 的 `projectPalaceName`（未命中即抛错）是
 * 相反的取舍：宫名是下游索引的键，错不起；此处越界的代价只是算不出四化。
 */
export function getMutagenByStem(stemIndex: number): Record<Mutagen, string> {
	const arr = SI_HUA_TABLE[stemIndex];
	if (!arr) {return { 禄: "", 权: "", 科: "", 忌: "" };}
	return { 禄: arr[0], 权: arr[1], 科: arr[2], 忌: arr[3] };
}

// ─── 2) 公历年 → 年柱天干索引 ──────────────────────────────────
/**
 * 公历年份 → 年柱天干索引。
 *
 * @param year - 公历年份（公元纪年）
 * @returns 天干索引 0–9（0=甲 … 9=癸）
 *
 * @remarks
 * 公元 4 年为甲子年，故 `(year − 4) mod 10`。先 `%` 再 `+10` 再 `%` 是标准的两步取模，
 * 保证传入 4 之前的年份（含负数）仍落在 0–9，而不是得到 JS 的负数余数。
 *
 * ⚠️ **按公历年直接取模，不做农历年或节气的边界切换**：1–2 月出生者，其年柱按农历
 * 口径可能仍属上一农历年 —— 此时本函数与 `algorithm.ts` 的 `getLunarInfo` 返回的
 * `lunarInfo.yearStem`（由 `lunar-typescript` 算出的农历年干）会**相差一位**。
 * 两者用途不同：本函数**只服务流年四化**（用户问「2026 年运势」即指公历年份对应的
 * 干支年，取模恰好正确）；**生年四化必须用 `chart.lunarInfo.yearStem`** —— 盘面上
 * iztro 的 `Star.mutagen`（mutagen）按农历年干标注，生年若走公历取模，1–2 月出生者
 * 的【生年四化】区块会与宫详表自相矛盾（实测 1990-01-15：农历己巳 vs 公历庚）。
 * `test/cli.test.ts` 的「生年四化的年干口径」一节盯着这条红线。
 */
export function getYearStemIndex(year: number): number {
	return (((year - 4) % 10) + 10) % 10;
}

// ─── 3) 流年四化 ──────────────────────────────────────────────
/**
 * 流年四化：由**公历年份**推当年年干，再取其四化。
 *
 * @param year - 流年的公历年份（`cli/commands.ts` 取 `--liunian`，缺省为当前公历年）
 * @returns 年干索引、年干名与四化四星
 *
 * @remarks
 * 年干走 {@link getYearStemIndex}（纯取模），故同样**按公历年、不做农历年边界切换**。
 * 六层四化里的「一年动态」层，与生年四化（`Star.mutagen`）、流月四化并列；
 * 本函数**不涉及**任何宫干。
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
 * 五虎遁口诀：甲己年起丙寅、乙庚年起戊寅、丙辛年起庚寅、丁壬年起壬寅、戊癸年起甲寅。
 * 函数内的 `startStemOfYin` 表即把「年干索引 → 正月（寅月）天干索引」固化下来
 * （甲 0 / 己 5 → 丙 2，乙 1 / 庚 6 → 戊 4，丙 2 / 辛 7 → 庚 6，丁 3 / 壬 8 → 壬 8，
 * 戊 4 / 癸 9 → 甲 0），再按 `month − 1` 顺推。
 *
 * ⚠️ 起点是**正月（寅月）**而非子月，故 `month` 是农历月份序号，不是地支索引。
 * 表未命中（`yearStem` 越界）时兜底为 0（甲），属静默兜底 —— 代价只是该月的四化算错，
 * 不影响排盘。
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
 * 六层四化里的「一月动态」层。`cli/commands.ts` 对应 `--liuyue`（省略即不输出流月），
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
 * 这是文墨排盘展示层的口径：大限四化随大限宫位走，宫干来自盘面 `Palace.stem`
 * （五虎遁布局，排盘时已填）。**纯函数层** —— 不往 `Decadal` 结构上加字段，
 * `school.test.ts` 的「大限键集合全等」断言因此继续有效。
 *
 * ⚠️ **童限期（`currentDecadalIndex === -1`，未起运）没有大限宫干可言**，调用方须先判
 * 童限再调本函数，不要传 `-1` —— 传入负下标会拿到 `undefined` 大限并返回 `null`，
 * 语义是「无此大限」，不是「童限」。
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
	if (!dx) {return null;}
	const palace = chart.palaces.find(p => p.branch === dx.palaceBranch);
	if (!palace) {return null;}
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
 * 日柱由 `lunar-typescript` 现算（`Lunar.fromYmd(...).getDayGan()`），不做任何缓存 ——
 * 调用频度低（CLI 单次取数），不值得为它建表。日期非法时 lunar-typescript 会抛错，
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
 * 六层四化里的「一日动态」层。调用方（`cli/fortune.ts`）从 `--yearly` / `--monthly` /
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
	if (stemIndex === null) {return null;}
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
 * 五鼠遁口诀：甲己日起甲子、乙庚日起丙子、丙辛日起戊子、丁壬日起庚子、戊癸日起壬子。
 * 函数内的 `ziStemByDayStem` 表即「日干索引 → 子时天干索引」，再按 `hourBranch` 顺推。
 *
 * ⚠️ **晚子时（23:00–24:00）按当日日干起遁**（`hourBranch 12` 归一为子 0），不换次日的
 * 日干 —— 与上游文墨排盘展示层一致。传统晚子时派（子时归次日）会连日干一起换，那是
 * 另一套口径；本模块只提供文墨口径这一种。
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
 * split 口径（2026-09 随上游定版，150 组文墨专业版真机对照）：**闰月前半月（农历日
 * ≤ 15）按本月取月干，后半月（> 15）按下月取**；闰十二月后半跨到次年正月时月序回 1、
 * 月干须用**次年干**重推（调用方从返回值 `=== 1` 且 `isLeapMonth` 且日 > 15 自行判断，
 * 取 `options.nextYearStem` 重调 {@link getMonthlyStemIndex}）。非闰月输入原样返回。
 */
export function getEffectiveMonthlyMonth(month: number, options: MonthlyMonthOptions = {}): number {
	const normalized = Math.max(1, Math.min(12, Math.trunc(month)));
	if (!options.isLeapMonth || (options.day ?? 1) <= 15) {return normalized;}
	return normalized >= 12 ? 1 : normalized + 1;
}
