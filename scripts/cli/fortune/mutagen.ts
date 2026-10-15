/**
 * 四化专题（--mutagen / 别名 --sihua）—— 生年 / 大限宫干 / 流年 / 流月 / 流日 / 流时
 * 四化落宫 + 生年×流年同星引动。
 */

import type { ZiweiChart } from "@/types";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import {
	getYearlyMutagen,
	getMonthlyMutagen,
	getDaXianMutagen,
	getDailyMutagen,
	getHourlyMutagen,
} from "@/mutagen";
import { nativeSiHuaOf, sameStarPairs, sihuaLines } from "./sihua-helpers";

/**
 * `--mutagen` 的取数选项。
 *
 * @remarks
 * 取值链**逐级依赖**：流日须有流月（日干挂在农历年月日上）、流时须有流日（时干由日干
 * 五鼠遁）。护栏（谁缺谁报错）在 `cli/astrology.ts` 的分发层，本函数只按「给了才算」组装。
 */
export interface MutagenSectionOptions {
	/** 流年公历年（`--yearly` 的值；缺省当年由 caller 经 parseYearlyArg 归一后传入） */
	liuNianYear: number;
	/** 农历月 1–12；`null`/`undefined` = 不算流月（其下的流日流时一并不算） */
	liuYueMonth?: number | null;
	/** 农历日 1–30（须配 {@link liuYueMonth}） */
	liuRiDay?: number | null;
	/** 时支 0–12（须配 {@link liuRiDay}；12 = 晚子时，按当日日干起遁） */
	liuShiHour?: number | null;
}

/**
 * `--mutagen`：四化专题 —— 生年 / 当前大限宫干 / 流年（/ 流月 / 流日 / 流时）四化落宫 +
 * 生年×流年同星引动。
 *
 * @param chart - 命盘
 * @param options - 取数选项（流年必给；月日时逐级可选）
 * @returns 输出行
 *
 * @remarks
 * 大限区块是**文墨排盘展示口径**（大限宫干四化，随大限宫位走）；流年/流月/流日/流时是
 * 时间干四化。生年×流年同星引动保持三合派口径不变。童限期（未起运）大限区块只出
 * 一行标注 —— 没有大限宫就没有宫干四化。
 */
export function mutagenSection(chart: ZiweiChart, options: MutagenSectionOptions): string[] {
	const { liuNianYear, liuYueMonth, liuRiDay, liuShiHour } = options;
	const native = nativeSiHuaOf(chart);
	const liuNian = getYearlyMutagen(liuNianYear);

	const out = [`【生年四化】年干 ${STEMS[chart.lunarInfo.yearStem]}`];
	out.push(...sihuaLines(chart, native));

	// 大限四化：大限宫的宫干查四化表（文墨排盘口径）。童限未起运时无宫干可取。
	out.push("");
	if (chart.currentDecadalIndex === -1) {
		out.push(
			`【当前大限四化】童限未起运（虚岁 ${chart.currentAge} 小于五行局数）—— 暂无大限宫干四化`
		);
	} else {
		const daXian = getDaXianMutagen(chart, chart.currentDecadalIndex);
		if (!daXian) {
			out.push("【当前大限四化】（当前大限定位异常，跳过）");
		} else {
			const dx = chart.decadals[chart.currentDecadalIndex];
			out.push(
				`【当前大限 ${dx.startAge}–${dx.endAge}岁 · ${dx.palaceName}】大限四化：宫干 ${daXian.stemName}（文墨排盘口径，大限宫的宫干）`
			);
			out.push(...sihuaLines(chart, daXian.transforms));
		}
	}

	out.push("");
	out.push(`【${liuNianYear} 流年四化】年干 ${liuNian.stemName}`);
	out.push(...sihuaLines(chart, liuNian.transforms));
	if (liuYueMonth != null) {
		const liuYue = getMonthlyMutagen(liuNian.stemIndex, liuYueMonth);
		out.push("");
		out.push(
			`【${liuNianYear} 年 农历${liuYueMonth}月 流月四化】月干 ${liuYue.stemName}（五虎遁，由流年干 ${liuNian.stemName} 推）`
		);
		out.push(...sihuaLines(chart, liuYue.transforms));
		if (liuRiDay != null) {
			// 流日取数口径：农历年序 = 流年公历年（--daily 的语义是「流年 Y 的农历 M 月 D 日」）。
			// 闰月内核层支持（getDailyMutagen 的 isLeapMonth），CLI 暂未接旗标 —— 出生 --leap
			// 是另一个概念，不能混用。
			const liuRi = getDailyMutagen(liuNianYear, liuYueMonth, liuRiDay);
			if (!liuRi) {
				throw new Error(
					`--daily ${liuRiDay} 在 ${liuNianYear} 年农历 ${liuYueMonth} 月中不存在（该月天数不足），请核对农历日`
				);
			}
			out.push("");
			out.push(
				`【${liuNianYear} 年 农历${liuYueMonth}月${liuRiDay}日 流日四化】日干 ${liuRi.stemName}（日柱现算）`
			);
			out.push(...sihuaLines(chart, liuRi.transforms));
			if (liuShiHour != null) {
				const liuShi = getHourlyMutagen(liuRi.stemIndex, liuShiHour);
				const hourLabel = liuShiHour === 12 ? "晚子时" : `${BRANCHES[liuShiHour]}时`;
				out.push("");
				out.push(
					`【流时四化 · ${hourLabel}】时干 ${liuShi.stemName}（五鼠遁，由日干 ${liuRi.stemName} 推）`
				);
				out.push(...sihuaLines(chart, liuShi.transforms));
			}
		}
	}
	const pairs = sameStarPairs(chart, native, liuNian.transforms);
	if (pairs.length) {
		out.push("");
		out.push("【生年 × 流年 同星引动】");
		for (const p of pairs) {
			out.push(
				`  ${p.star}：生年化${p.nativeHua} × 流年化${p.liuNianHua} —— 同星双引动` +
					(p.branch !== null ? `（同落${BRANCHES[p.branch]}宫）` : "（未上盘）")
			);
		}
	}
	return out;
}
