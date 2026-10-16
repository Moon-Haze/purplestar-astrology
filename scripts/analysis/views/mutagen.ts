/**
 * 三、本命四化会照 —— 三方四正范围内落的本命四化。
 *
 * ⚠️ 本节只负责**展示**：`mutagenInSanFang` 由 `context.ts` 的 `makeContext()` 算好，
 *    不要在节内另算（「三点五」要拿同一份做去重集合）。
 *
 * 一条都没有时给一段中性判语，而不是留空。完整口径见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import { mutagenSymbol } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";

/** 渲染「三、本命四化会照」整节。 */
export function renderMutagen(ctx: AnalysisContext): string[] {
	const { mutagenInSanFang } = ctx;

	const lines: string[] = [];

	if (mutagenInSanFang.length > 0) {
		lines.push(`**【本命四化会照】**`);
		lines.push("");
		mutagenInSanFang.forEach(({ palaceName: pn, starName, mutagen, note }) => {
			lines.push(`${mutagenSymbol(mutagen)} **${starName}化${mutagen}**（落${pn}）`);
			if (note) {lines.push(`   ${note}`);}
		});
		lines.push("");
	} else {
		lines.push(`**【本命四化会照】**`);
		lines.push("");
		lines.push(
			`三方四正范围内暂无本命四化落入，格局较为中性，需重点看落宫主星、对宫借星与煞曜吉曜组合来判断吉凶起伏。`
		);
		lines.push("");
	}

	return lines;
}
