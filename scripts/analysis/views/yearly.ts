/**
 * 四点五、流年分析 + 四点六、流月分析 —— 倪师正统口径。
 *
 * ⚠️ 口径与「四、当前大限」同源：流年只看年支移到哪个本命宫位、月支再移一格，
 *    本命四化星固定不动，看流年/流月三方四正会哪几颗 —— 不按年柱、月柱起化。
 *
 * 两节共用一个起点：流年地支（单点局部常量）。
 * 触发条件：流年段在 `view` 为 `liunian` / `liuyue` 时出，流月段只在 `liuyue` 时出。
 * 完整口径见 docs/code/analysis.md。
 *
 * 产出结构化条目流（views 内部形态，见 `../items`）：slot = `liunian` /
 * `liuyue`。条目依赖运行时时钟（取系统当前日期，预计算不可复现）。
 *
 * @file 四点五、流年分析 + 四点六、流月分析 —— 倪师正统口径
 *
 * @packageDocumentation
 */

import { BRANCHES, STEMS } from "@/data/ganzhi";
import { surroundBranches } from "../../palace-relations";
// getYearStemIndex 是**公历年取模**口径，本层只用于流年干（唯一合法用途；
// 生年四化必须用 chart.lunarInfo.yearStem —— 两口径在 1-2 月出生者身上分叉，
// 见 sihua.ts 的口径说明与 test/cli.test.ts 的「生年四化的年干口径」）
import { getYearStemIndex } from "../../mutagen";
import { mutagenSymbol } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import { descPalaceStars, mutagenInPalaces } from "../../analysis/palace-query";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「四点五、流年」与「四点六、流月」两节的结构化条目流（视角不符时返回空数组）。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）：只读命盘、视角（`view`）、流年公历年（`liunianYear`）与流月月份（`liuyueMonth`）；年支由公历年取模单点推出，不按年柱 / 月柱起化
 * @returns 条目流：`view` 为 `liunian` / `liuyue` 时出流年段（流年宫与三方四正会照的本命四化），`liuyue` 时再出流月段；`mingpan` 等其余值返回空数组
 */
function renderLiuNianItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, view, liunianYear, liuyueMonth } = ctx;

	const items: AnalysisItem[] = [];

	// 流年地支：公历年 → 年支下标（`(year - 4) mod 12`，负数取正）。
	// 流年段原用一次、流月段又算一次，此处单点。
	const lnYearBranch = (((liunianYear - 4) % 12) + 12) % 12;

	if (view === "liunian" || view === "liuyue") {
		const lnYearStem = getYearStemIndex(liunianYear);
		const lnPalace = chart.palaces.find(p => p.branch === lnYearBranch);
		items.push(
			headItem(
				`**【${liunianYear}年 流年 · ${STEMS[lnYearStem]}${BRANCHES[lnYearBranch]}年】**`,
				"liunian"
			)
		);
		items.push(blankItem("liunian"));
		items.push(
			contentItem(
				`流年命宫落${lnPalace?.name ?? BRANCHES[lnYearBranch]}（${lnPalace ? descPalaceStars(lnPalace) : ""}）——倪师正法：**流年只看年支移到哪里，本命四化星固定不动**，看流年三方四正会哪几颗本命化禄/化权/化科/化忌。`,
				"liunian",
				{ palace: lnPalace?.name }
			)
		);
		items.push(blankItem("liunian"));

		if (lnPalace) {
			const lnSanFangBranches = surroundBranches(lnPalace.branch);
			const lnSanFangPalaces = chart.palaces.filter(p =>
				lnSanFangBranches.includes(p.branch)
			);
			// 星曜口径取 palace-query 的会照单点（含文昌/文曲/左辅/右弼四颗辅星四化），
			// 不再在此处按 type === "major" 另立一套。
			const lnHits = mutagenInPalaces(lnSanFangPalaces);
			if (lnHits.length > 0) {
				items.push(contentItem(`**流年三方四正会本命四化**：`, "liunian"));
				lnHits.forEach(({ palace, starName, mutagen }) => {
					items.push(
						contentItem(
							`${mutagenSymbol(mutagen)} **本命${starName}化${mutagen}** 在${palace.name}${palace.branch === lnPalace.branch ? "（流年本宫）" : "（流年三方四正）"}`,
							"liunian",
							{ star: starName, mutagen, palace: palace.name }
						)
					);
				});
				items.push(blankItem("liunian"));
			} else {
				items.push(
					contentItem(
						`（流年三方四正未会本命四化，此年运势按本宫主星与本命格局判读。）`,
						"liunian"
					)
				);
				items.push(blankItem("liunian"));
			}
		}
	}

	if (view === "liuyue") {
		const lyBranch = (lnYearBranch + (liuyueMonth - 1)) % 12;
		const lyPalace = chart.palaces.find(p => p.branch === lyBranch);
		items.push(
			headItem(
				`**【${liunianYear}年${liuyueMonth}月 流月 · ${BRANCHES[lyBranch]}月】**`,
				"liuyue"
			)
		);
		items.push(blankItem("liuyue"));
		items.push(
			contentItem(
				`流月落${lyPalace?.name ?? BRANCHES[lyBranch]}（${lyPalace ? descPalaceStars(lyPalace) : ""}）——倪师不主张按月柱重新起化，只看月支移到哪个本命宫位，借该宫主星与本命四化的会照判月运。`,
				"liuyue",
				{ palace: lyPalace?.name }
			)
		);
		items.push(blankItem("liuyue"));
	}

	return items;
}

/**
 * 渲染「四点五、流年」与「四点六、流月」两节（文本投影；视角不符时返回空数组）。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）
 * @returns 与 {@link renderLiuNianItems} 条目流逐条对应的文本行；视角不符时为空数组
 */
export function renderLiuNian(ctx: AnalysisContext): string[] {
	return formatItems(renderLiuNianItems(ctx));
}
