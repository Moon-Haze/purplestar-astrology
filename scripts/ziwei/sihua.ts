/**
 * 四化工具模块 —— 年干 / 流年干 / 流月干四化的映射查询，另含三个已下线的飞星派工具。
 *
 * 本模块是**纯查表 + 纯算术**：输入天干索引（或公历年 / 农历月），输出「禄权科忌」各自对应的
 * 星名。四化本身由排盘层（`algorithm.ts`）从 iztro 的 `mutagen` 字段直接落到 `Star.siHua` 上，
 * 这里不参与安星，也不产出任何盘面字段。
 *
 * ## 三合派采用的三个四化层次（本模块的**在用**接口）
 *
 * - 生年四化（本命）= 出生年天干四化，静态基础，落在 `Star.siHua` 上
 * - 流年四化 = 当年年干的四化，一年动态（{@link getLiuNianSiHua}）
 * - 流月四化 = 月柱天干（五虎遁）的四化，一月动态（{@link getLiuYueSiHua}）
 *
 * ## ⚠️ 体系红线：飞星派工具已主动下线（存在不等于该用）
 *
 * 本项目严格遵循倪海夏《天纪》**三合派**。下列导出**不得用于解读**：
 *
 * - {@link detectSelfSihua} / {@link buildAllSelfSihua}（宫干自化）
 * - {@link getDaXianSiHua}（大限四化取大限宫**宫干**）
 * - {@link findIncomingPalaces}（来因宫追溯）
 * - {@link buildOverlayForStar} / {@link SiHuaOverlay}（依赖上述层次的多层叠加视图）
 *
 * 它们仅作历史遗留与前端展示兼容保留。`algorithm.ts` 已停止填充 `Palace.selfSihua`、
 * `daXians[].siHua` / `stemIndex`，故此处的函数在排盘链路上**没有调用点**。
 * 完整立场见 `.claude/CLAUDE.md` 的「体系硬约束：三合派，不是飞星派」一节，以及 `SKILL.md`
 * 的同名陷阱条目；`test/school.test.ts` 与 `cli/selftest.ts` 各有断言盯着这些字段不被重新填回。
 *
 * ## 保留的上游口径原文（飞星派，本项目不采用）
 *
 * 本模块原按下列口径组织，原文保留于此以免信息丢失：
 *
 * ```
 * 大限四化 = 大限宫**宫干**（非本命年干）的四化（十年动态）
 * 自化     = 某宫的宫干四化，其中被化星恰在本宫
 * 来因宫   = 某颗化星的"动力来源宫"——即宫干引发该化的宫位
 * ```
 *
 * @packageDocumentation
 */

import type { ZiweiChart, Palace, SiHua } from "./types";
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
 * ⚠️ 索引越界（`SI_HUA_TABLE[stemIndex]` 取空）时返回**四项皆为空串**的记录而**不抛错**
 * —— 调用方靠空串自然短路（{@link detectSelfSihua} 的 `if (starName && ...)`、
 * {@link buildStarSiHuaMap} 的提前返回）。这与 `algorithm.ts` 的
 * `projectPalaceName`（未命中即抛错）是相反的取舍：宫名是下游索引的键，错不起；
 * 此处越界的代价只是算不出四化。
 */
export function getSiHuaByStem(stemIndex: number): Record<SiHua, string> {
	const arr = SI_HUA_TABLE[stemIndex];
	if (!arr) return { 禄: "", 权: "", 科: "", 忌: "" };
	return { 禄: arr[0], 权: arr[1], 科: arr[2], 忌: arr[3] };
}

/**
 * 星名 → 四化类型（由某天干确定）。
 *
 * @param stemIndex - 天干索引 0–9
 * @returns 星名到四化类型的映射；索引越界时返回**空对象**
 *
 * @remarks
 * {@link getSiHuaByStem} 的方向是「四化 → 星名」，本函数是它的反向，用于按星名反查
 * 该星在此天干下化什么（{@link buildOverlayForStar} 的入参就是这种映射）。
 *
 * 与 {@link getSiHuaByStem} 的兜底不同：越界时**不产生空串键**，直接给 `{}` ——
 * 否则会多出一个 `{"": "忌"}` 这样的伪星名条目，污染反查。
 */
export function buildStarSiHuaMap(stemIndex: number): Record<string, SiHua> {
	const arr = SI_HUA_TABLE[stemIndex];
	if (!arr) return {};
	return { [arr[0]]: "禄", [arr[1]]: "权", [arr[2]]: "科", [arr[3]]: "忌" };
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
 * iztro 的 `Star.siHua`（mutagen）按农历年干标注，生年若走公历取模，1–2 月出生者
 * 的【生年四化】区块会与宫详表自相矛盾（实测 1990-01-15：农历己巳 vs 公历庚）。
 * `test/cli.test.ts` 的「生年四化的年干口径」一节盯着这条红线。
 */
export function getYearStemIndex(year: number): number {
	return (((year - 4) % 10) + 10) % 10;
}

/**
 * 公历年份 → 年柱地支索引。
 *
 * @param year - 公历年份（公元纪年）
 * @returns 地支索引 0–11（0=子 … 11=亥）
 *
 * @remarks
 * 与 {@link getYearStemIndex} 同一套取模写法，只是模数换成 12 —— 公历 4 年为甲子年，
 * 子位即索引 0。⚠️ 同样**只按公历年**，不切换农历年边界。
 */
export function getYearBranchIndex(year: number): number {
	return (((year - 4) % 12) + 12) % 12;
}

// ─── 3) 大限四化：取大限宫的宫干（非本命年干）───────────────
/**
 * 大限宫干四化。
 *
 * @param chart - 命盘
 * @param dxIndex - 大限索引（`chart.daXians[dxIndex]`）
 * @returns 该大限的宫干索引、宫干名与四化四星；大限或对应宫位不存在时返回 `null`
 *
 * @remarks
 * 取的是**大限宫的宫干**（`Palace.stem`，按 `dx.palaceBranch` 找回该宫），不是本命年干
 * —— 这正是飞星派「大限四化」的口径。
 *
 * ⚠️ **本项目不使用、存在不等于该用。** 飞星派的大限四化已随宫干自化、来因宫一并主动
 * 下线：`algorithm.ts` 不再生成 `daXians[].siHua` / `stemIndex` / `stemName`，倪师《天纪》
 * 立场是「四化星永远固定不动，大限只看宫位移动」。此函数仅为历史遗留与前端展示兼容保留，
 * **在排盘链路上没有调用点**，用其解读即背离本项目的体系立场。见 `.claude/CLAUDE.md` 的
 * 「体系硬约束：三合派，不是飞星派」一节。
 */
export function getDaXianSiHua(
	chart: ZiweiChart,
	dxIndex: number
): { stemIndex: number; stemName: string; transforms: Record<SiHua, string> } | null {
	const dx = chart.daXians[dxIndex];
	if (!dx) return null;
	const dxPalace = chart.palaces.find(p => p.branch === dx.palaceBranch);
	if (!dxPalace) return null;
	const stemIndex = dxPalace.stem;
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getSiHuaByStem(stemIndex),
	};
}

// ─── 4) 流年四化 ──────────────────────────────────────────────
/**
 * 流年四化：由**公历年份**推当年年干，再取其四化。
 *
 * @param year - 流年的公历年份（`cli/commands.ts` 取 `--liunian`，缺省为当前公历年）
 * @returns 年干索引、年干名与四化四星
 *
 * @remarks
 * 年干走 {@link getYearStemIndex}（纯取模），故同样**按公历年、不做农历年边界切换**。
 * 三合派三层四化里的「一年动态」层，与生年四化（`Star.siHua`）、流月四化并列；
 * 本函数**不涉及**任何宫干，故不受飞星派下线影响。
 */
export function getLiuNianSiHua(year: number): {
	stemIndex: number;
	stemName: string;
	transforms: Record<SiHua, string>;
} {
	const stemIndex = getYearStemIndex(year);
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getSiHuaByStem(stemIndex),
	};
}

// ─── 5) 流月四化（月柱天干，由年干 + 月序推） ───────────────
/**
 * 流月天干（五虎遁）。
 *
 * @param yearStem - 年干索引 0–9（0=甲 … 9=癸），通常来自 {@link getLiuNianSiHua} 的 `stemIndex`
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
export function getLiuYueStemIndex(yearStem: number, month: number): number {
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
 * 流月四化：先由 {@link getLiuYueStemIndex} 取月柱天干，再取其四化。
 *
 * @param yearStem - 年干索引 0–9，通常传流年的 `stemIndex`
 * @param month - 农历月 1–12
 * @returns 月柱天干索引、天干名与四化四星
 *
 * @remarks
 * 三合派三层四化里的「一月动态」层。`cli/commands.ts` 对应 `--liuyue`（省略即不输出流月），
 * 且**由流年干推月干**，故调用时传的是 `getLiuNianSiHua(...).stemIndex` 而非出生年干。
 */
export function getLiuYueSiHua(
	yearStem: number,
	month: number
): {
	stemIndex: number;
	stemName: string;
	transforms: Record<SiHua, string>;
} {
	const stemIndex = getLiuYueStemIndex(yearStem, month);
	return {
		stemIndex,
		stemName: STEMS[stemIndex] ?? "",
		transforms: getSiHuaByStem(stemIndex),
	};
}

// ─── 6) 宫干自化检测 ──────────────────────────────────────────
/**
 * 单条自化记录：某宫的宫干引发了哪一个四化，且被化之星恰在本宫。
 *
 * @remarks
 * ⚠️ **飞星派结构，本项目不使用、存在不等于该用。** 见 `.claude/CLAUDE.md` 的
 * 「体系硬约束：三合派，不是飞星派」一节。
 */
export interface SelfSihua {
	siHua: SiHua; // 禄/权/科/忌
	starName: string; // 被化的星
}

/**
 * 检测单宫的自化。
 *
 * @param palace - 待检测的宫位
 * @returns 该宫触发的自化列表，按 禄 / 权 / 科 / 忌 的顺序排列；无自化则为空数组
 *
 * @remarks
 * 自化 = 该宫宫干引发的四化里，被化星恰在本宫。例：宫干为甲（廉破武阳），若本宫主星含
 * 「廉贞」，则该宫有「自化禄」。
 *
 * 判定用 `Set` 做星名存在性检查，故**不区分**同名星在本宫出现几次；宫干取 `Palace.stem`。
 *
 * ⚠️ **本项目不使用、存在不等于该用。** 宫干自化是飞星派工具，已主动下线 ——
 * `algorithm.ts` 不再填充 `Palace.selfSihua`，本函数在排盘链路上**没有调用点**，
 * 仅为历史遗留与前端展示兼容保留。`test/school.test.ts` 与 `cli/selftest.ts` 都有断言
 * 盯着 `selfSihua` 不被重新填回。见 `.claude/CLAUDE.md` 的
 * 「体系硬约束：三合派，不是飞星派」一节。
 */
export function detectSelfSihua(palace: Palace): SelfSihua[] {
	const transforms = getSiHuaByStem(palace.stem);
	const found: SelfSihua[] = [];
	const palaceStarNames = new Set(palace.stars.map(s => s.name));
	(["禄", "权", "科", "忌"] as SiHua[]).forEach(sh => {
		const starName = transforms[sh];
		if (starName && palaceStarNames.has(starName)) {
			found.push({ siHua: sh, starName });
		}
	});
	return found;
}

// ─── 7) 来因宫追溯 ────────────────────────────────────────────
/**
 * 来因宫追溯：对某颗星的某种化，找出是哪个宫的宫干「飞」过来的。
 *
 * @param chart - 命盘
 * @param starName - 被化的星名（如 `"太阴"`）
 * @param sihua - 四化类型（如 `"忌"`）
 * @returns 引发该化的宫位数组（通常只有一个，但若多宫宫干相同可能多个）
 *
 * @remarks
 * 判定方式：遍历十二宫，凡 `getSiHuaByStem(宫干)[sihua] === starName` 的宫即为来因宫。
 * 因为只比对宫干，**宫干相同的宫会一并返回**，故返回值是数组而非单个宫位；调用方若只
 * 需要「根源宫位」，取首个即为上游口径（`chart.palaces` 按地支序，非宫位顺序）。
 *
 * 原注释称「倪师体系常用：化忌的来因宫 —— 化忌由哪个宫位的宫干引发，那个宫位就是问题的
 * 根源宫位」。此说法与项目现行立场冲突，原文保留于此以免信息丢失，但**不作为使用依据**：
 * 来因宫属飞星派工具，本项目已主动下线。
 *
 * ⚠️ **本项目不使用、存在不等于该用。** 本函数在排盘链路上**没有调用点**，仅为历史遗留与
 * 前端展示兼容保留。见 `.claude/CLAUDE.md` 的「体系硬约束：三合派，不是飞星派」一节。
 */
export function findIncomingPalaces(chart: ZiweiChart, starName: string, sihua: SiHua): Palace[] {
	const result: Palace[] = [];
	chart.palaces.forEach(p => {
		const transforms = getSiHuaByStem(p.stem);
		if (transforms[sihua] === starName) {
			result.push(p);
		}
	});
	return result;
}

/**
 * 批量计算盘面所有宫位的自化列表。
 *
 * @param chart - 命盘
 * @returns 以**地支索引**为键的自化列表；无自化的宫不出现在结果里（不产生空数组条目）
 *
 * @remarks
 * {@link detectSelfSihua} 的全盘循环版。键用地支索引而非宫名或数组下标，与
 * `chart.palaces` 按地支序排列的口径一致（见 `.claude/CLAUDE.md` 关于
 * `chart.palaces` 数组序的说明）。
 *
 * ⚠️ **本项目不使用、存在不等于该用。** 依赖 {@link detectSelfSihua}（宫干自化），
 * 同属已下线的飞星派工具，在排盘链路上**没有调用点**。见 `.claude/CLAUDE.md` 的
 * 「体系硬约束：三合派，不是飞星派」一节。
 */
export function buildAllSelfSihua(chart: ZiweiChart): Record<number, SelfSihua[]> {
	const result: Record<number, SelfSihua[]> = {};
	chart.palaces.forEach(p => {
		const list = detectSelfSihua(p);
		if (list.length > 0) result[p.branch] = list;
	});
	return result;
}

// ─── 8) 综合覆盖（overlay）：多个四化层叠加后的效果 ──────────
/**
 * 某颗星在多层四化下的合成视图。
 *
 * @remarks
 * 用于在宫位上同时显示：本命化 / 大限化 / 流年化 / 流月化。各层字段皆可缺省，缺省表示
 * 该星在该层没有四化（或该层未参与计算）。
 *
 * 原注释称「优先级：本命 < 大限 < 流年（但都标出来）」—— **本接口与
 * {@link buildOverlayForStar} 只负责把各层原值都标出来，不实现任何优先级裁决**，
 * 取舍由展示层自行决定。
 *
 * ⚠️ **本项目不使用、存在不等于该用。** 其中的 `daXian` 层来自飞星派口径
 * （{@link getDaXianSiHua}），已随宫干自化、来因宫一并主动下线。见 `.claude/CLAUDE.md`
 * 的「体系硬约束：三合派，不是飞星派」一节。
 */
export interface SiHuaOverlay {
	native?: SiHua; // 本命（年干）
	daXian?: SiHua; // 大限
	liuNian?: SiHua; // 流年
	liuYue?: SiHua; // 流月
}

/**
 * 由各层的「星名 → 四化」映射，取出某颗星在四层上的合成视图。
 *
 * @param starName - 目标星名
 * @param nativeMap - 本命（年干）层的星名到四化映射，必填
 * @param daXianMap - 大限层，可省
 * @param liuNianMap - 流年层，可省
 * @param liuYueMap - 流月层，可省
 * @returns 四层各自的四化取值；某层未提供或该星无化时对应字段为 `undefined`
 *
 * @remarks
 * 纯查表，不做优先级裁决也不改写入参（见 {@link SiHuaOverlay} 的说明）。入参映射可用
 * {@link buildStarSiHuaMap} 由天干索引生成。
 *
 * ⚠️ **本项目不使用、存在不等于该用。** 其中大限层属飞星派口径，已主动下线，
 * 本函数在排盘链路上**没有调用点**，仅为历史遗留与前端展示兼容保留。见
 * `.claude/CLAUDE.md` 的「体系硬约束：三合派，不是飞星派」一节。
 */
export function buildOverlayForStar(
	starName: string,
	nativeMap: Record<string, SiHua>,
	daXianMap?: Record<string, SiHua>,
	liuNianMap?: Record<string, SiHua>,
	liuYueMap?: Record<string, SiHua>
): SiHuaOverlay {
	return {
		native: nativeMap[starName],
		daXian: daXianMap?.[starName],
		liuNian: liuNianMap?.[starName],
		liuYue: liuYueMap?.[starName],
	};
}
