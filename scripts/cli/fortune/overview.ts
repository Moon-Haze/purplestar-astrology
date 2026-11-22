/**
 * 概览节 —— 「无功能参数的概览」「--info」与零输入演示态共用的运限速览 + 专题指路。
 *
 * @file 概览节 —— 「无功能参数的概览」「--info」与零输入演示态共用的运限速览 + 专题指路
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
 * @param liuNianYear - 流年公历年（缺省当前年；给了 `--yearly` 时取它）
 * @returns 两行文本
 *
 * @remarks
 * 契约：在「无功能参数的概览」「--info」与零输入演示态输出；给了具体
 * 专题参数（`--pattern` / `--mutagen` / `--yearly` 等）的输出不带 —— 已在深入，
 * 指路是噪声。速览行同时给出四个运限坐标（虚岁 / 大限 / 流年命宫 / 小限宫），
 * 让「一眼定位」与「该往哪个专题旗标深入」在未深入形态的输出里就能完成。
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
		// 专题指路行由声明表的 DEEP_DIVE_MENU 拼装（评审 N7）—— 手抄九旗标的第二份文案已消灭，
		// 新增专题只标 deep: true 并登记菜单，指路自动跟上（selftest 双向对拍盯漏登记）。
		`【专题深入】${DEEP_DIVE_MENU.map(e => deepDiveSegment(e)).join(" · ")}`,
	];
}
