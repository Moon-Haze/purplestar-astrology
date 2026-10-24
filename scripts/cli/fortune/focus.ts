/**
 * 宫盘聚焦专题（--focus <宫>）—— 目标宫详表 + 对宫 + 三方四正 + 格局 + 四化 + 运限引动。
 */

import type { ZiweiChart } from "@/types";
import { BRANCHES } from "@/data/ganzhi";
import { getYearlyMutagen, getNativeMutagen } from "@/mutagen";
import { surroundBranches, oppositeBranch } from "@/palace-relations";
import { detectPatterns } from "@/patterns";
import { FOCUS_ALIASES, locateSihua, renderPalace, starLine } from "../chart/render";
import { agePalaceOf, yearlyBranchOf } from "./primitives";
import { huiZhaoMajors } from "./sihua-helpers";

/**
 * `--focus <宫>`：宫盘分析专题 —— 目标宫详表 + 对宫 + 三方四正会照星曜 +
 * 四化落宫标注 + 大限年龄段与流年/小限引动。
 *
 * @param chart - 命盘
 * @param focusRaw - 用户原始输入（项目全名 / 口语简称 / iztro 旧口径 / 地支名）
 * @param liuNianYear - 流年公历年（引动标注用）
 * @returns 渲染好的文本
 * @throws 宫名不命中任何写法时（值域非法与命令其它 throw 行为一致：
 *   引导层打「错误：」并 exit 1；原「聚焦失败」文本段会被机器路径当正常输出吞掉）
 */
export function focusSection(chart: ZiweiChart, focusRaw: string, liuNianYear: number): string[] {
	const want = FOCUS_ALIASES.get(focusRaw);
	const target = chart.palaces.find(p => p.name === want || BRANCHES[p.branch] === focusRaw);
	if (!target) {
		// 指路信息全留在 message 里，stderr 一条不丢
		throw new Error(
			`找不到宫位「${focusRaw}」。可用：${chart.palaces.map(p => p.name).join("、")}` +
				`（也接受口语简称与旧写法，如「交友」「仆役」；或直接给地支名）`
		);
	}

	const sanFang = surroundBranches(target.branch);
	const oppBranch = oppositeBranch(target.branch);
	const lnBranch = yearlyBranchOf(liuNianYear);
	const liuNian = getYearlyMutagen(liuNianYear);

	const out = [`【聚焦：${target.name}】`];
	out.push(renderPalace(target, chart));
	// 命主 / 身主星标注 + 身宫标记（spec §1 四项深化的第四件）
	if (target.isSoulPalace) {
		out.push(`  命宫 —— 命主星：${chart.mingZhu}`);
	}
	if (target.isBodyPalace) {
		out.push(`  ⭐ 此宫为身宫 —— 身主星：${chart.shenZhu}`);
	}
	out.push("");

	// ── 深化一：对宫完整详表（renderPalace 同规格）──
	const oppPalace = chart.palaces.find(p => p.branch === oppBranch);
	out.push(`对宫详表：${oppPalace?.name ?? "?"}`);
	if (oppPalace) {
		out.push(renderPalace(oppPalace, chart));
	}
	out.push("");

	// ── 深化二：三方四正逐宫全星曜（主星含亮度四化 + 吉煞杂曜，不再只列主星）──
	out.push("三方四正会照（逐宫全星曜）：");
	for (const b of sanFang) {
		const p = chart.palaces.find(x => x.branch === b);
		if (!p) {
			continue;
		}
		const all = p.stars.map(starLine).join("、");
		out.push(`  ${p.name}(${BRANCHES[b]})：${all || `空宫借${p.borrowedFromName ?? "?"}`}`);
	}
	out.push(`  会照主星汇总：${huiZhaoMajors(chart, sanFang).join("、") || "（无）"}`);

	// ── 深化三：涉及此宫的格局全列（detectPatterns 过滤 palaces 含此宫）──
	out.push("");
	out.push("涉及此宫的格局：");
	const patternsHere = detectPatterns(chart).filter(pt =>
		(pt.palaces ?? []).some(n => n === target.name || n.includes(target.name))
	);
	if (patternsHere.length) {
		for (const pt of patternsHere) {
			out.push(`  · ${pt.name}（${pt.level}）`);
		}
	} else {
		out.push("  （无成立的格局涉及此宫）");
	}

	out.push("");
	out.push("四化落宫：");
	const native = getNativeMutagen(chart);
	const nativesHere = locateSihua(chart, native.transforms).filter(x => x.palace === target.name);
	if (nativesHere.length) {
		for (const x of nativesHere) {
			out.push(`  生年化${x.hua} ${x.star} 落此宫`);
		}
	} else {
		out.push("  生年四化：无落此宫");
	}
	const liuNianHere = locateSihua(chart, liuNian.transforms).filter(
		x => x.palace === target.name
	);
	if (liuNianHere.length) {
		for (const x of liuNianHere) {
			out.push(`  ${liuNianYear} 流年化${x.hua} ${x.star} 落此宫`);
		}
	} else {
		out.push(`  ${liuNianYear} 流年四化：无落此宫`);
	}

	out.push("");
	out.push("运限引动：");
	if (target.decadalRange) {
		out.push(
			`  此宫为 ${target.decadalRange[0]}-${target.decadalRange[1]} 岁大限宫${target.isCurrentDecadal ? "（当前所行）" : ""}`
		);
	}
	if (target.branch === lnBranch) {
		out.push(`  ${liuNianYear} 流年命宫在此 —— 值年之宫`);
	} else if (lnBranch === oppBranch) {
		out.push(`  ${liuNianYear} 流年命宫在其对宫 —— 对冲引动`);
	} else if (sanFang.includes(lnBranch)) {
		out.push(`  ${liuNianYear} 流年命宫会照此宫（三方四正内）`);
	}
	const xx = agePalaceOf(chart, chart.currentAge);
	if (xx.branch === target.branch) {
		out.push(`  当前虚岁 ${chart.currentAge} 小限在此宫`);
	}
	// ── 深化四（续）：小限岁数段 + 当前大限十年内此宫被流年引动的年份 ──
	const ages = target.ages ?? [];
	if (ages.length) {
		out.push(
			`  小限岁数段：${ages[0]}-${ages[ages.length - 1]} 岁（共 ${ages.length} 个落点）`
		);
	}
	const cur = chart.decadals[chart.currentDecadalIndex];
	if (cur) {
		// 大限起止虚岁 → 公历年区间（虚岁 = 出生公历年 + 虚岁 - 1 的近似口径，
		// 与 overviewSection 的速览同源）；逐年看流年命宫是否落此宫 / 对宫 / 三方
		const birthYear = chart.lunarInfo.lunarYear;
		const y0 = birthYear + cur.startAge - 1;
		const y1 = Math.min(birthYear + cur.endAge - 1, new Date().getFullYear() + 10);
		const hits: number[] = [];
		for (let y = y0; y <= y1; y++) {
			const b = yearlyBranchOf(y);
			if (b === target.branch || b === oppBranch || sanFang.includes(b)) {
				hits.push(y);
			}
		}
		out.push(
			`  当前大限（${cur.startAge}-${cur.endAge} 岁，${y0}-${y1} 年）内流年引动此宫（含对冲/会照）：` +
				(hits.length ? hits.join("、") : "（无）")
		);
	}
	return out;
}
