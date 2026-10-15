/**
 * 小限专题（--ages / 别名 --xiaoxian [虚岁]）—— 小限宫三方四正 + 岁数分布 + 流年对照。
 */

import type { ZiweiChart } from "@/types";
import { BRANCHES } from "@/data/ganzhi";
import { surroundBranches, oppositeBranch } from "@/palace-relations";
import { renderPalace, surroundNames } from "../chart/render";
import { agePalaceOf, yearlyBranchOf } from "./primitives";
import { huiZhaoLine } from "./sihua-helpers";

/**
 * `--xiaoxian [虚岁]`：小限专题 —— 指定岁的小限宫与三方四正 → 十二宫小限岁数分布
 * → 小限宫与流年命宫的对照。
 *
 * @param chart - 命盘
 * @param age - 小限虚岁；缺省时传当前虚岁
 * @param liuNianYear - 流年公历年（对照行用；缺省当前年由调用方给）
 */
export function ageSection(chart: ZiweiChart, age: number, liuNianYear: number): string[] {
	const xp = agePalaceOf(chart, age);
	const sanFang = surroundBranches(xp.branch);
	const lnBranch = yearlyBranchOf(liuNianYear);

	const out = [`【小限】虚岁 ${age} 的小限：${xp.name}(${BRANCHES[xp.branch]})`];
	out.push(renderPalace(xp, chart));
	out.push(`小限三方四正：${surroundNames(chart, xp.branch).join(" / ")}`);
	out.push(huiZhaoLine(chart, sanFang));

	out.push("");
	const relation =
		xp.branch === lnBranch
			? `小限宫与 ${liuNianYear} 流年命宫**同宫**（${BRANCHES[lnBranch]}）—— 限年并临，引动力最强`
			: oppositeBranch(xp.branch) === lnBranch
				? `小限宫与 ${liuNianYear} 流年命宫**互为对宫**（${BRANCHES[xp.branch]}↔${BRANCHES[lnBranch]}）—— 对冲引动`
				: `小限宫（${BRANCHES[xp.branch]}）与 ${liuNianYear} 流年命宫（${BRANCHES[lnBranch]}）无直接会照 —— 各自论`;
	out.push(relation);

	out.push("");
	out.push("十二宫小限岁数分布（虚岁；每宫 10 岁，1–120 连续）：");
	for (const p of chart.palaces) {
		out.push(`  ${p.name}(${BRANCHES[p.branch]})：${(p.ages ?? []).join(",")}`);
	}
	return out;
}
