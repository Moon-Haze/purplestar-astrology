/**
 * 四、当前大限分析 —— 倪师《天纪》正统口径。
 *
 * ⚠️ **四化星永远固定不动，大限只看走到哪个宫位**，再看该宫三方四正会照哪几颗**本命**
 *    四化 —— **不是**按宫干重新起化（宫干自化 / 大限四化取宫干属飞星派，本项目已主动
 *    下线）。改本节时不要顺手加回按宫干起化的逻辑。
 *
 * 大限宫为空宫时借对宫论事，与 `palace-query.ts` 的空宫口径一致。
 * 完整口径见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：slot = `decadal`，全部条目
 * `clockDependent: true`（当前大限随系统日期漂移，预计算不可复现，直出链排除）。
 *
 * @packageDocumentation
 */

import { mutagenSymbol } from "../../analysis/data";
import { surroundBranches } from "../../palace-relations";
import type { AnalysisContext } from "../../analysis/context";
import { descPalaceStars, mutagenInPalaces } from "../../analysis/palace-query";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/** 渲染「四、当前大限分析」整节的结构化条目流（无当前大限时返回空数组）。 */
export function renderDecadalItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, currentDx } = ctx;

	const items: AnalysisItem[] = [];

	if (currentDx) {
		const dxPalace = chart.palaces.find(p => p.branch === currentDx.palaceBranch);
		const dxStarsDesc = dxPalace ? descPalaceStars(dxPalace) : "未知";

		items.push(
			headItem(
				`**【当前大限 ${currentDx.startAge}–${currentDx.endAge}岁 · ${currentDx.palaceName}】**`,
				"decadal"
			)
		);
		items.push(blankItem("decadal"));
		items.push(
			contentItem(
				`现走**${currentDx.palaceName}**大限（${dxStarsDesc}），此十年是人生的重要阶段。`,
				"decadal",
				{ clockDependent: true, palace: currentDx.palaceName }
			)
		);
		items.push(
			contentItem(
				`倪师《天纪 03》明示：「四化星永远固定在那个宫上面不要动…我们每年是流年在动，星都不动」——大限只看**宫位移动**，而非按宫干重新起化。`,
				"decadal",
				{ clockDependent: true }
			)
		);

		// ── 大限宫为空宫时借对宫 ──
		// 借宫信息直接读排盘填好的结构化字段（borrowedStars/borrowedFromName），不内联重算
		if (dxPalace && dxPalace.isEmpty) {
			const oppStars = dxPalace.borrowedStars ?? [];
			if (oppStars.length > 0) {
				items.push(blankItem("decadal"));
				items.push(
					contentItem(
						`▶ 大限宫为空宫，借**${dxPalace.borrowedFromName ?? ""}**的${oppStars.join("、")}入事——倪师强调「空宫必借对宫论事」。`,
						"decadal",
						{ clockDependent: true, palace: currentDx.palaceName }
					)
				);
			}
		}

		// ── 大限宫与本命四化的会照（倪师正统）──
		if (dxPalace) {
			const dxSanFangBranches = surroundBranches(dxPalace.branch);
			const dxSanFangPalaces = chart.palaces.filter(p =>
				dxSanFangBranches.includes(p.branch)
			);
			// 星曜口径取 palace-query 的会照单点（含文昌/文曲/左辅/右弼四颗辅星四化），
			// 不再在此处按 type === "major" 另立一套。
			const sihuaInDx = mutagenInPalaces(dxSanFangPalaces);
			const sihuaInDxSanFang = sihuaInDx.map(
				({ palace, starName, mutagen }) =>
					`${mutagenSymbol(mutagen)} **本命${starName}化${mutagen}** 落${palace.name} ${palace.branch === dxPalace.branch ? "（大限本宫）" : "（大限三方四正）"}`
			);
			if (sihuaInDxSanFang.length > 0) {
				items.push(blankItem("decadal"));
				items.push(
					contentItem(`**大限三方四正会照的本命四化**（倪师批大限的核心）：`, "decadal", {
						clockDependent: true,
					})
				);
				sihuaInDx.forEach(({ palace, starName, mutagen }) => {
					items.push(
						contentItem(
							`${mutagenSymbol(mutagen)} **本命${starName}化${mutagen}** 落${palace.name} ${palace.branch === dxPalace.branch ? "（大限本宫）" : "（大限三方四正）"}`,
							"decadal",
							{ clockDependent: true, star: starName, mutagen, palace: palace.name }
						)
					);
				});
				items.push(blankItem("decadal"));
			} else {
				items.push(blankItem("decadal"));
				items.push(
					contentItem(
						`（大限三方四正未会本命四化，此十年走平盘，重点看落宫主星本身。）`,
						"decadal",
						{ clockDependent: true }
					)
				);
				items.push(blankItem("decadal"));
			}
		}
		items.push(blankItem("decadal"));
	}

	return items;
}

/** 渲染「四、当前大限分析」整节（文本投影；无当前大限时返回空数组）。 */
export function renderDecadal(ctx: AnalysisContext): string[] {
	return formatItems(renderDecadalItems(ctx));
}
