/**
 * 四化专题（--mutagen / --sihua）：六层四化落宫 + 生年×流年同星引动。
 *
 * @file 四化专题（--mutagen / --sihua）：六层四化与同星引动
 */

import type { ZiweiChart } from "@/types";
import { BRANCHES } from "@/data/ganzhi";
import { buildMutagenChain } from "@/mutagen";
import { sameStarPairs, sihuaLines } from "./sihua-helpers";

/**
 * `--mutagen` 取数选项。
 *
 * @remarks
 * 逐级依赖：流日须有流月（日干挂农历年月日）、流时须有流日（日干五鼠遁）。护栏（缺谁报错）在 `cli/commands/astrology.ts` 分发层；本函数只「给了才算」。
 */
export interface MutagenSectionOptions {
	/** 流年公历年（`--yearly`；缺省当年由 caller 经 parseYearlyArg 归一传入） */
	liuNianYear: number;
	/** 农历月 1–12；`null`/`undefined` = 不算流月（流日流时亦不算） */
	liuYueMonth?: number | null;
	/** 农历日 1–30（须配 {@link liuYueMonth}） */
	liuRiDay?: number | null;
	/** 时支 0–12（须配 {@link liuRiDay}；12 = 晚子时，按当日日干起遁） */
	liuShiHour?: number | null;
}

/**
 * `--mutagen`：生年 / 大限宫干 / 流年～流时四化落宫 + 生年×流年同星引动。
 *
 * @param chart - 命盘
 * @param options - 取数项（流年必给；月日时可选）
 * @returns 输出行
 *
 * @remarks
 * 大限区块文墨展示口径（宫干四化随宫位走）；流年～流时为时间干四化；同星引动保持三合派口径。童限期只出一行标注 —— 无大限宫即无宫干四化。
 */
export function mutagenSection(chart: ZiweiChart, options: MutagenSectionOptions): string[] {
	const { liuNianYear, liuYueMonth, liuRiDay, liuShiHour } = options;
	// 六层链单点（@/mutagen 的 buildMutagenChain）：本函数只渲染，与 --json 的 buildAnalyzeJson 同源（对拍在 astrology-sections 测试）。
	const { native, liuNian, liuYue, liuRi, liuShi, daXian, decadalNotStarted } = buildMutagenChain(
		chart,
		options
	);

	const out = [`【生年四化】年干 ${native.stemName}`];
	out.push(...sihuaLines(chart, native.transforms));

	// 大限四化：大限宫宫干查四化表（文墨口径）；童限未起运无宫干。
	out.push("");
	if (decadalNotStarted) {
		out.push(
			`【当前大限四化】童限未起运（虚岁 ${chart.currentAge} 小于五行局数）—— 暂无大限宫干四化`
		);
	} else {
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
	if (liuYueMonth != null && liuYue) {
		out.push("");
		out.push(
			`【${liuNianYear} 年 农历${liuYueMonth}月 流月四化】月干 ${liuYue.stemName}（五虎遁，由流年干 ${liuNian.stemName} 推）`
		);
		out.push(...sihuaLines(chart, liuYue.transforms));
		if (liuRiDay != null) {
			// 流日取数在链单点（农历年序 = 流年公历年；--daily「流年 Y 的农历 M 月 D 日」）。
			// 闰月内核支持（getDailyMutagen 的 isLeapMonth），CLI 未接旗标 —— 出生 --leap 另一概念，不可混用。农历日不存在时链返回 null，此处抛错指路（JSON 静默 null，刻意）。
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
			if (liuShiHour != null && liuShi) {
				const hourLabel = liuShiHour === 12 ? "晚子时" : `${BRANCHES[liuShiHour]}时`;
				out.push("");
				out.push(
					`【流时四化 · ${hourLabel}】时干 ${liuShi.stemName}（五鼠遁，由日干 ${liuRi.stemName} 推）`
				);
				out.push(...sihuaLines(chart, liuShi.transforms));
			}
		}
	}
	const pairs = sameStarPairs(chart, native.transforms, liuNian.transforms);
	if (pairs.length) {
		// 【生年 × 流年 同星引动】是 --mutagen 节头；--yearly 同名块是行内小节（无【】头）—— 排版刻意不同（评审 2026-11-20 #7），同源 sameStarPairs，行文（双引动/未上盘）勿「统一」。
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
