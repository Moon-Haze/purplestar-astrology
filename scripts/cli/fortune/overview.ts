/**
 * 概览节 —— 「无功能参数的概览」「--info」与零输入演示态共用的运限速览 / 专题指路。
 *
 * @file 概览节：运限速览 + 专题指路（概览 / --info / 零输入演示态共用）
 */

import type { ZiweiChart } from "@/types";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { getYearStemIndex } from "@/mutagen";
import { DEEP_DIVE_MENU, deepDiveSegment } from "@/cli/args/table";
import { agePalaceOf, yearlyBranchOf } from "./primitives";

/**
 * 概览节：一行运限速览 + 一行专题指路。
 *
 * @param chart - 命盘
 * @param liuNianYear - 流年公历年（缺省当年；有 `--yearly` 取它）
 * @returns 两行文本
 *
 * @remarks
 * 契约：上述三形态输出；给了专题参数（`--pattern`/`--mutagen`/`--yearly` 等）则不带（已深入）。速览行给四坐标（虚岁 / 大限 / 流年命宫 / 小限宫），未深入形态即可「一眼定位」与「该往哪个专题旗标深入」。
 */
export function overviewSection(chart: ZiweiChart, liuNianYear: number): string[] {
	const dx = chart.decadals[chart.currentDecadalIndex];
	const lnBranch = yearlyBranchOf(liuNianYear);
	const lnPalace = chart.palaces.find(p => p.branch === lnBranch);
	const xx = agePalaceOf(chart, chart.currentAge);
	const ganZhi = `${STEMS[getYearStemIndex(liuNianYear)]}${BRANCHES[lnBranch]}`;
	return [
		`【运限速览】虚岁 ${chart.currentAge} · 大限 ${
			dx
				? `${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})`
				: "童限未起运"
		} · 流年 ${liuNianYear} ${ganZhi} 流年命宫${BRANCHES[lnBranch]}·${lnPalace?.name ?? "?"} · 小限${BRANCHES[xx.branch]}·${xx.name}`,
		// 指路行由 DEEP_DIVE_MENU 拼装（评审 N7），手抄九旗标文案已消灭；新增专题标 deep: true + 登记菜单即跟上（selftest 对拍）。
		`【专题深入】${DEEP_DIVE_MENU.map(e => deepDiveSegment(e)).join(" · ")}`,
	];
}
