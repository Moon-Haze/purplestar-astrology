/**
 * 大限专题（--decadal / 别名 --daxian [虚岁]）—— 十年大运时间轴 + 指定限深入。
 */

import type { ZiweiChart } from "@/types";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { getYearStemIndex, getDaXianMutagen } from "@/mutagen";
import { surroundBranches } from "@/palace-relations";
import { renderPalace, surroundNames } from "../chart/render";
import { agePalaceOf, yearlyBranchOf } from "./primitives";
import { huiZhaoLine, nativeSiHuaOf, sihuaLines } from "./sihua-helpers";

/**
 * `--daxian [虚岁]`：大限（十年大运）专题 —— 十二年运时间轴 → 指定岁所在限深入
 * （限宫 + 限之三方四正 + 生年四化落点）→ 限内十年逐年对照（流年命宫 / 小限宫）。
 *
 * @param chart - 命盘
 * @param age - 深查的虚岁；`--daxian` 缺省时传当前虚岁
 *
 * @remarks
 * 混合口径：三合派论断框架（大限看**宫位移动**、限三方四正、生年四化落点会照）+
 * 文墨排盘展示层（本限**宫干**四化区块，随大限宫位走）。大限的三方四正即大限宫地支的
 * 三合 + 对宫（限之财官迁移）。
 */
export function decadalSection(chart: ZiweiChart, age: number): string[] {
	const dxIndex = chart.decadals.findIndex(d => age >= d.startAge && age <= d.endAge);
	const dx = chart.decadals[dxIndex];

	const out = [`【大限 · 十年大运】命主虚岁 ${chart.currentAge}`];
	out.push("十年大运时间轴：");
	for (const d of chart.decadals) {
		const p = chart.palaces.find(x => x.branch === d.palaceBranch);
		const majors = p
			? p.stars
					.filter(s => s.type === "major")
					.map(s => s.name)
					.join("、")
			: "";
		const cur = d === dx;
		out.push(
			`  ${String(d.startAge).padStart(3)}-${String(d.endAge).padStart(3)}岁  ${d.palaceName}(${BRANCHES[d.palaceBranch]})` +
				(majors ? `  ${majors}` : "  （空宫）") +
				(cur ? "  ← 本次深查" : "")
		);
	}
	if (!dx) {
		out.push(`虚岁 ${age} 未起运（童限）—— 按命宫论，不套大限。`);
		return out;
	}

	const dxPalace = chart.palaces.find(p => p.branch === dx.palaceBranch);
	out.push("");
	out.push(
		`深查大限：${age} 岁 → ${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})`
	);
	if (dxPalace) {
		out.push(renderPalace(dxPalace, chart));
	}
	const sanFang = surroundBranches(dx.palaceBranch);
	out.push(`大限三方四正（限之财官迁移）：${surroundNames(chart, dx.palaceBranch).join(" / ")}`);
	out.push(huiZhaoLine(chart, sanFang));

	out.push("");
	out.push("生年四化落点（★ = 落大限三方四正）：");
	const native = nativeSiHuaOf(chart);
	out.push(...sihuaLines(chart, native, sanFang));

	// 大限宫干四化（文墨排盘口径）：本限宫干查四化表，落宫照会照本限三方标 ★。
	// 三合派论断框架（宫位移动 + 生年四化会照）保持不变，此节是排盘展示层的追加。
	const dxMutagen = getDaXianMutagen(chart, dxIndex);
	if (dxMutagen) {
		out.push("");
		out.push(`大限宫干四化（文墨排盘口径，本限宫干 ${dxMutagen.stemName}）：`);
		out.push(...sihuaLines(chart, dxMutagen.transforms, sanFang));
	}

	out.push("");
	out.push("限内十年逐年（流年命宫 = 年支宫；小限宫见岁数表）：");
	for (let a = dx.startAge; a <= dx.endAge; a++) {
		const y = chart.lunarInfo.lunarYear + a - 1;
		const b = yearlyBranchOf(y);
		const lp = chart.palaces.find(p => p.branch === b);
		const xp = agePalaceOf(chart, a);
		out.push(
			`  ${String(a).padStart(3)}岁  ${y} ${STEMS[getYearStemIndex(y)]}${BRANCHES[b]}` +
				`  流年命宫${lp ? `${lp.name}` : "?"}  小限${xp.name}(${BRANCHES[xp.branch]})`
		);
	}
	return out;
}
