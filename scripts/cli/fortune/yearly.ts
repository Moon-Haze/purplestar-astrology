/**
 * 流年专题（--yearly [年]）—— 流年命宫三方四正 + 流年四化落点 + 与大限关系 + 同星引动。
 */

import type { ZiweiChart } from "@/types";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { getYearlyMutagen, getYearStemIndex, getNativeMutagen } from "@/mutagen";
import { surroundBranches } from "@/palace-relations";
import { renderPalace, surroundNames } from "../chart/render";
import { yearlyBranchOf } from "./primitives";
import { huiZhaoLine, sameStarPairs, sihuaLines } from "./sihua-helpers";

/**
 * `--yearly [年]`（拼音别名 `--liunian`）：流年专题 —— 流年命宫（年支宫）→ 流年三方四正会照 →
 * 流年四化落点（标 ★ 于入流年三方者）→ 与当前大限三方的关系 → 生年×流年同星引动。
 *
 * @param chart - 命盘
 * @param year - 流年公历年
 *
 * @remarks
 *
 * @returns 流年专题的输出行（流年命宫 + 三方四正会照 + 流年四化落点 + 与大限三方关系 + 生年×流年同星引动）；只拼行，未 `join`
 * @throws 年支对应的流年命宫不在 `chart.palaces` 里时抛错 —— 那说明内核输出已损坏，不允许静默给出一份缺了流年命宫的解读
 *
 * 三合派口径：流年命宫就是**年支所在宫**，不重排十二宫；四化取流年干（年干）与生年干，
 * **不取宫干**（飞星派工具已下线）。
 */
export function yearlySection(chart: ZiweiChart, year: number): string[] {
	const lnBranch = yearlyBranchOf(year);
	const lnPalace = chart.palaces.find(p => p.branch === lnBranch);
	if (!lnPalace) {
		throw new Error(`流年命宫（${BRANCHES[lnBranch]}）不在十二宫内 —— 内核输出已损坏`);
	}
	const sanFang = surroundBranches(lnBranch);
	const liuNian = getYearlyMutagen(year);
	// 流年虚岁：流年农历年 − 出生农历年 + 1（与 currentAge 同域同口径）
	const lnAge = year - chart.lunarInfo.lunarYear + 1;
	const dx = chart.decadals[chart.currentDecadalIndex];

	const out = [
		`【${year} 流年】年柱 ${STEMS[getYearStemIndex(year)]}${BRANCHES[lnBranch]} · 该年虚岁 ${lnAge}`,
		`流年命宫：${lnPalace.name}(${BRANCHES[lnBranch]}) —— 年支所在宫`,
		renderPalace(lnPalace, chart),
		`流年三方四正：${surroundNames(chart, lnBranch).join(" / ")}`,
		huiZhaoLine(chart, sanFang),
		"",
		`流年四化（年干 ${liuNian.stemName}）：`,
	];
	out.push(...sihuaLines(chart, liuNian.transforms, sanFang, " ★ 入流年三方四正"));
	if (dx) {
		const dxSanFang = surroundBranches(dx.palaceBranch);
		const entered = dxSanFang.includes(lnBranch);
		// 大限三方名一次取好（入/不入两分支共用；原先两分支各查一次）
		const dxSanFangNames = surroundNames(chart, dx.palaceBranch).join("/");
		out.push("");
		out.push(
			`与当前大限（${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})）：` +
				(entered
					? `流年命宫**入**大限三方四正（${dxSanFangNames}）—— 限运引动流年`
					: `流年命宫**不入**大限三方四正（${dxSanFangNames}）—— 流年独立于限运看`)
		);
	}
	const pairs = sameStarPairs(chart, getNativeMutagen(chart).transforms, liuNian.transforms);
	if (pairs.length) {
		// 「生年 × 流年同星引动」在本专题是**行内小节**（无【】头）；--mutagen 专题的同名
		// 块是节标题【生年 × 流年 同星引动】—— 排版刻意不同（节内行 vs 专题节头，评审
		// 2026-11-20 #7 确认为刻意），判定同源 sameStarPairs，勿「统一」两处文案。
		out.push("生年 × 流年同星引动：");
		for (const p of pairs) {
			out.push(
				`  ${p.star}（生年化${p.nativeHua} × 流年化${p.liuNianHua}）` +
					(p.branch !== null ? `同落${BRANCHES[p.branch]}宫` : "")
			);
		}
	}
	return out;
}
