/**
 * 四化工具模块 —— 年干 / 流年干 / 流月干四化的映射查询。
 *
 * 本模块是**纯查表 + 纯算术**：输入天干索引（或公历年 / 农历月），输出「禄权科忌」各自对应的
 * 星名。四化本身由排盘层（`algorithm.ts`）从 iztro 的 `mutagen` 字段直接落到 `Star.mutagen` 上，
 * 这里不参与安星，也不产出任何盘面字段。
 *
 * ## 三合派采用的三个四化层次（本模块接口的全部）
 *
 * - 生年四化（本命）= 出生年天干四化，静态基础，落在 `Star.mutagen` 上（本模块不参与）
 * - 流年四化 = 当年年干的四化，一年动态（{@link getYearlyMutagen}）
 * - 流月四化 = 月柱天干（五虎遁）的四化，一月动态（{@link getMonthlyMutagen}）
 *
 * ## 体系基准（本项目立场，全项目适用）
 *
 * - 大道至简 —— 飞星飞来飞去太复杂，不搞这个。
 * - 命宫为本，三方为用。
 * - 人事努力 + 地理调整 > 先天命运（2/3 > 1/3）。
 *
 * 本节陈述的是**全项目**立场，不限于四化；下面的红线即由它推出。
 *
 * ## ⚠️ 体系红线：飞星派工具已从本模块删除（2026-09-27）
 *
 * 本项目严格遵循倪海夏《天纪》**三合派**。本模块曾一并携带宫干自化、大限四化取宫干、
 * 来因宫与四化叠加视图 —— 那些名字现已删除，弃用的是**函数与接口**，理由有二：
 *
 * 1. **删除测试**：`algorithm.ts` 停止填充 `Palace.selfMutagen` / `decadals[].mutagen` 之后，
 *    它们在**全仓**（`cli/`、`test/`、`tools/` 一并算上）没有任何调用点 —— 删掉，
 *    复杂度直接消失，而不是转移到别的模块。
 * 2. **文档对冲本身是成本**：它们留在这里时，每个名字的注释都得写一遍「存在不等于该用」，
 *    文件头还要再写一遍 —— 读者得先学会忽略近一半的接口面，才看得见真正可用的那五个函数。
 *    删除之后，红线不再靠自律维持，而是**不存在**。
 *
 * ⚠️ **`types.ts` 的绊线刻意保留**：`Palace.selfMutagen` / `Decadal.mutagen` 两个字段与
 * `SelfMutagenMark` / `DecadalMutagen` 两个类型仍在，理由是它们的作用**恰恰是「留着但不填」**
 * —— 断言要盯的是「有没有被填回」，字段没了就无从盯起。要删它们，先读 `types.ts` 里
 * 紧挨着这两个字段的那段说明。
 *
 * 完整立场见本文件上方的「体系基准」节、`.claude/CLAUDE.md` 的「体系硬约束：三合派，
 * 不是飞星派」一节，以及 `SKILL.md` 的同名陷阱条目。
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

import type { Mutagen } from "./types";
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
	if (!arr) return { 禄: "", 权: "", 科: "", 忌: "" };
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
 * 三合派三层四化里的「一年动态」层，与生年四化（`Star.mutagen`）、流月四化并列；
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
 * 三合派三层四化里的「一月动态」层。`cli/commands.ts` 对应 `--liuyue`（省略即不输出流月），
 * 且**由流年干推月干**，故调用时传的是 `getYearlyMutagen(...).stemIndex` 而非出生年干。
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
