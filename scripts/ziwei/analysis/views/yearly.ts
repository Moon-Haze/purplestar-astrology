/**
 * 四点五、流年分析 + 四点六、流月分析 —— 倪师正统口径。
 *
 * @remarks
 * 两节合在一个文件里，因为它们共用同一个起点：**流年地支**。原实现在流年段与流月段
 * 各算了一遍 `(((liunianYear - 4) % 12) + 12) % 12`，此处单点为一个局部常量。
 *
 * 口径与「四、当前大限」同源：**流年只看年支移到哪个本命宫位、月支再移一格**，
 * 本命四化星固定不动，看流年/流月三方四正会哪几颗 —— 不按年柱、月柱重新起化。
 *
 * 两节的触发条件不同：流年段在 `view` 为 `liunian` 或 `liuyue` 时出，
 * 流月段只在 `view === "liuyue"` 时出；其余视角（mingpan / daxian）两节都不出。
 *
 * @packageDocumentation
 */

import { BRANCHES, STEMS } from "../../constants";
import { surroundBranches } from "../../palace-relations";
// getYearStemIndex 是**公历年取模**口径，本层只用于流年干（唯一合法用途；
// 生年四化必须用 chart.lunarInfo.yearStem —— 两口径在 1-2 月出生者身上分叉，
// 见 sihua.ts 的口径说明与 test/cli.test.ts 的「生年四化的年干口径」）
import { getYearStemIndex } from "../../mutagen";
import { mutagenSymbol } from "../data";
import type { AnalysisContext } from "../context";
import { descPalaceStars } from "../palace-query";

/** 渲染「四点五、流年」与「四点六、流月」两节（视角不符时返回空数组）。 */
export function renderLiuNian(ctx: AnalysisContext): string[] {
	const { chart, view, liunianYear, liuyueMonth } = ctx;

	const lines: string[] = [];

	// 流年地支：公历年 → 年支下标（`(year - 4) mod 12`，负数取正）。
	// 流年段原用一次、流月段又算一次，此处单点。
	const lnYearBranch = (((liunianYear - 4) % 12) + 12) % 12;

	if (view === "liunian" || view === "liuyue") {
		const lnYearStem = getYearStemIndex(liunianYear);
		const lnPalace = chart.palaces.find(p => p.branch === lnYearBranch);
		lines.push(
			`**【${liunianYear}年 流年 · ${STEMS[lnYearStem]}${BRANCHES[lnYearBranch]}年】**`
		);
		lines.push("");
		lines.push(
			`流年命宫落${lnPalace?.name ?? BRANCHES[lnYearBranch]}（${lnPalace ? descPalaceStars(lnPalace) : ""}）——倪师正法：**流年只看年支移到哪里，本命四化星固定不动**，看流年三方四正会哪几颗本命化禄/化权/化科/化忌。`
		);
		lines.push("");

		if (lnPalace) {
			const lnSanFangBranches = surroundBranches(lnPalace.branch);
			const lnSanFangPalaces = chart.palaces.filter(p =>
				lnSanFangBranches.includes(p.branch)
			);
			const lnHits: string[] = [];
			lnSanFangPalaces.forEach(p => {
				p.stars
					.filter(s => s.mutagen && s.type === "major")
					.forEach(s => {
						lnHits.push(
							`${mutagenSymbol(s.mutagen!)} **本命${s.name}化${s.mutagen}** 在${p.name}${p.branch === lnPalace.branch ? "（流年本宫）" : "（流年三方四正）"}`
						);
					});
			});
			if (lnHits.length > 0) {
				lines.push(`**流年三方四正会本命四化**：`);
				lnHits.forEach(x => lines.push(x));
				lines.push("");
			} else {
				lines.push(`（流年三方四正未会本命四化，此年运势按本宫主星与本命格局判读。）`);
				lines.push("");
			}
		}
	}

	if (view === "liuyue") {
		const lyBranch = (lnYearBranch + (liuyueMonth - 1)) % 12;
		const lyPalace = chart.palaces.find(p => p.branch === lyBranch);
		lines.push(`**【${liunianYear}年${liuyueMonth}月 流月 · ${BRANCHES[lyBranch]}月】**`);
		lines.push("");
		lines.push(
			`流月落${lyPalace?.name ?? BRANCHES[lyBranch]}（${lyPalace ? descPalaceStars(lyPalace) : ""}）——倪师不主张按月柱重新起化，只看月支移到哪个本命宫位，借该宫主星与本命四化的会照判月运。`
		);
		lines.push("");
	}

	return lines;
}
