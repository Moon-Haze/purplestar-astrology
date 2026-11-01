/**
 * 三、本命四化会照 —— 三方四正范围内落的本命四化。
 *
 * ⚠️ 本节只负责**展示**：`mutagenInSanFang` 由 `context.ts` 的 `makeContext()` 算好，
 *    不要在节内另算（「三点五」要拿同一份做去重集合）。
 *
 * 一条都没有时给一段中性判语，而不是留空。完整口径见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：条目携带 star / mutagen / palace
 * 语义字段（来自 ctx 的结构化数据）。
 *
 * @packageDocumentation
 */

import { mutagenSymbol } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「三、本命四化会照」整节的结构化条目流（slot = `sihua`）。
 *
 * @param dedupe - 报告装配层的跨节去重表（键 = 文本）。语义注句（`note`）查表：
 *   首现给注并登记，复现只保留落点行（🔵 星化X（落宫））——注句全报告一次
 *   （四化注首现原则），落点行恒出不隐藏四化事实。缺省（`--topic` 单主题路径）
 *   为 `undefined`，注句照常输出，行为与不去重时一致。
 */
export function renderMutagenItems(ctx: AnalysisContext, dedupe?: Map<string, string>): AnalysisItem[] {
	const { mutagenInSanFang } = ctx;

	const items: AnalysisItem[] = [];

	items.push(headItem(`**【本命四化会照】**`, "sihua"));
	items.push(blankItem("sihua"));
	if (mutagenInSanFang.length > 0) {
		mutagenInSanFang.forEach(({ palaceName: pn, starName, mutagen, note }) => {
			items.push(
				contentItem(`${mutagenSymbol(mutagen)} **${starName}化${mutagen}**（落${pn}）`, "sihua", {
					star: starName,
					mutagen,
					palace: pn,
				})
			);
			if (note && !dedupe?.get(note)) {
				items.push(
					contentItem(`   ${note}`, "sihua", { star: starName, mutagen, palace: pn })
				);
				dedupe?.set(note, ctx.topicLabel);
			}
		});
		items.push(blankItem("sihua"));
	} else {
		items.push(
			contentItem(
				`三方四正范围内暂无本命四化落入，格局较为中性，需重点看落宫主星、对宫借星与煞曜吉曜组合来判断吉凶起伏。`,
				"sihua"
			)
		);
		items.push(blankItem("sihua"));
	}

	return items;
}

/**
 * 渲染「三、本命四化会照」整节（文本投影）。
 *
 * @param dedupe - 见 {@link renderMutagenItems}。
 */
export function renderMutagen(ctx: AnalysisContext, dedupe?: Map<string, string>): string[] {
	return formatItems(renderMutagenItems(ctx, dedupe));
}
