/**
 * 二、三方四正联动分析 —— 本宫之外三宫的星曜详解。
 *
 * ⚠️ 本宫只出一行星曜概要（详解已在「一、总论」给过）；空宫借对宫论事只是**列名**，
 *    不参与后续论断。
 *
 * 逐宫展开次序与次星（六吉 + 禄存 + 天马）深度文案的口径，见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import { PALACE_TO_CONTENT_KEY, STAR_BRIEF, STAR_CONTENT_MAP } from "../../analysis/data";
import { oppositeBranch } from "../../palace-relations";
import type { AnalysisContext } from "../../analysis/context";
import { getMinorStarNote, getMutagenNote } from "../../analysis/lookups";
import { descPalaceStars } from "../../analysis/palace-query";

/** 渲染「二、三方四正联动」整节。 */
export function renderSanFang(ctx: AnalysisContext): string[] {
	const { chart, palaceName, sanFang, sanFangLabels } = ctx;

	const lines: string[] = [];

	lines.push("");
	lines.push(`**【三方四正联动】**`);
	lines.push("");

	sanFang.forEach((p, idx) => {
		const isMain = p.name === palaceName;
		const label = isMain
			? `本宫 · ${p.name}`
			: `${sanFangLabels[idx - 1] ?? "联动宫"} · ${p.name}`;
		const starsDesc = descPalaceStars(p);
		const mainStarsOfP = p.stars.filter(s => s.type === "major");

		lines.push(`▍**${label}**：${starsDesc}`);

		if (!isMain && mainStarsOfP.length > 0) {
			mainStarsOfP.forEach(s => {
				const starProfile = STAR_CONTENT_MAP[s.name];
				const palaceContentKey = PALACE_TO_CONTENT_KEY[p.name];
				const fullContent =
					starProfile && palaceContentKey
						? (starProfile[palaceContentKey] as string | undefined)
						: null;
				const mutagenStr = s.mutagen ? `化${s.mutagen}` : "";
				const brightStr =
					s.brightness === "bright"
						? "（庙旺）"
						: s.brightness === "dim"
							? "（落陷）"
							: "";
				const mutagenNote = s.mutagen ? getMutagenNote(s.name, s.mutagen) : "";

				if (fullContent) {
					// 有完整宫位段落，直接输出全文 + 四化补充
					lines.push(`**${s.name}${mutagenStr}${brightStr}** 在${p.name}：`);
					lines.push("");
					lines.push(fullContent);
					if (mutagenNote) {
						lines.push("");
						lines.push(`▶ 化${s.mutagen}：${mutagenNote}`);
					}
				} else {
					// 无专项段落，用简述 + 四化
					const brief = STAR_BRIEF[s.name] ?? "";
					lines.push(
						`  ${s.name}${mutagenStr}${brightStr}${brief ? "（" + brief + "）" : ""}${mutagenNote ? " | 化" + s.mutagen + "：" + mutagenNote : ""}`
					);
				}
				lines.push("");
			});
		} else if (!isMain && mainStarsOfP.length === 0) {
			const oppBranch = oppositeBranch(p.branch);
			const oppP = chart.palaces.find(q => q.branch === oppBranch);
			const oppStars = oppP?.stars.filter(s => s.type === "major") ?? [];
			if (oppStars.length > 0) {
				lines.push(
					`  （空宫，借对宫${oppP?.name ?? ""}：${oppStars.map(s => s.name).join("、")}入事）`
				);
			} else {
				lines.push(`  （空宫）`);
			}
		}

		// ── 次星（六吉 + 禄存 + 天马）深度文案 ──
		const minorStarNotes: string[] = [];
		p.stars
			.filter(s => s.type === "soft")
			.forEach(ls => {
				const note = getMinorStarNote(ls.name, p.name);
				if (note) {minorStarNotes.push(`✦ **${ls.name}**：${note}`);}
			});
		if (minorStarNotes.length > 0) {
			minorStarNotes.forEach(n => lines.push(n));
			lines.push("");
		}

		lines.push("");
	});

	return lines;
}
