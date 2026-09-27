/**
 * 四、当前大限分析 —— 倪师《天纪》正统口径。
 *
 * @remarks
 * 核心口径写在节内的那句引文里：**四化星永远固定不动，大限只看走到哪个宫位**，
 * 再看该宫三方四正会照了哪几颗**本命**四化 —— 而**不是**按宫干重新起化
 * （宫干自化 / 大限四化取宫干属飞星派，本项目已主动下线，见 `.claude/CLAUDE.md`
 * 的「体系硬约束」）。改本节时不要顺手加回按宫干起化的逻辑。
 *
 * 大限宫为空宫时借对宫论事，与 `palace-query.ts` 的空宫口径一致。
 *
 * @packageDocumentation
 */

import { siHuaSymbol } from "../data";
import { duiGongBranch, sanFangBranches } from "../../palace-relations";
import type { AnalysisContext } from "../context";
import { descPalaceStars } from "../palace-query";

/** 渲染「四、当前大限分析」整节（无当前大限时返回空数组）。 */
export function renderDaXian(ctx: AnalysisContext): string[] {
	const { chart, currentDx } = ctx;

	const lines: string[] = [];

	if (currentDx) {
		const dxPalace = chart.palaces.find(p => p.branch === currentDx.palaceBranch);
		const dxStarsDesc = dxPalace ? descPalaceStars(dxPalace) : "未知";

		lines.push(
			`**【当前大限 ${currentDx.startAge}–${currentDx.endAge}岁 · ${currentDx.palaceName}】**`
		);
		lines.push("");
		lines.push(
			`现走**${currentDx.palaceName}**大限（${dxStarsDesc}），此十年是人生的重要阶段。`
		);
		lines.push(
			`倪师《天纪 03》明示：「四化星永远固定在那个宫上面不要动…我们每年是流年在动，星都不动」——大限只看**宫位移动**，而非按宫干重新起化。`
		);

		// ── 大限宫为空宫时借对宫 ──
		if (dxPalace && dxPalace.stars.filter(s => s.type === "major").length === 0) {
			const oppBranch = duiGongBranch(dxPalace.branch);
			const oppP = chart.palaces.find(q => q.branch === oppBranch);
			const oppStars = oppP?.stars.filter(s => s.type === "major").map(s => s.name) ?? [];
			if (oppStars.length > 0) {
				lines.push("");
				lines.push(
					`▶ 大限宫为空宫，借**${oppP?.name}**的${oppStars.join("、")}入事——倪师强调「空宫必借对宫论事」。`
				);
			}
		}

		// ── 大限宫与本命四化的会照（倪师正统）──
		if (dxPalace) {
			const dxSanFangBranches = sanFangBranches(dxPalace.branch);
			const dxSanFangPalaces = chart.palaces.filter(p =>
				dxSanFangBranches.includes(p.branch)
			);
			const sihuaInDxSanFang: string[] = [];
			dxSanFangPalaces.forEach(p => {
				p.stars
					.filter(s => s.siHua && s.type === "major")
					.forEach(s => {
						sihuaInDxSanFang.push(
							`${siHuaSymbol(s.siHua!)} **本命${s.name}化${s.siHua}** 落${p.name} ${p.branch === dxPalace.branch ? "（大限本宫）" : "（大限三方四正）"}`
						);
					});
			});
			if (sihuaInDxSanFang.length > 0) {
				lines.push("");
				lines.push(`**大限三方四正会照的本命四化**（倪师批大限的核心）：`);
				sihuaInDxSanFang.forEach(x => lines.push(x));
				lines.push("");
			} else {
				lines.push("");
				lines.push(`（大限三方四正未会本命四化，此十年走平盘，重点看落宫主星本身。）`);
				lines.push("");
			}
		}
		lines.push("");
	}

	return lines;
}
