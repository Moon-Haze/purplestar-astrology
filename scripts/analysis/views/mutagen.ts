/**
 * ⚠️ 只展示：`mutagenInSanFang` 由 `context.ts` `makeContext()` 算好，勿节内另算（「三点五」去重同一份）。
 *    无命中中性判语；口径 docs/code/analysis.md；条目流见 `../items`（一源双投影）。
 * @file 三、本命四化会照：三方四正内落的本命四化
 * @packageDocumentation
 */

import { mutagenSymbol } from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「三、本命四化会照」条目流。
 * @param ctx - 上下文（{@link AnalysisContext}），只读不算
 * @param dedupe - 跨节去重表：`note` 首现注并登记，复现仅落点；注全报告一次（四化注首现），落点恒出；缺省（--topic）照常出注
 * @returns 节头+落点行（star/mutagen/palace）+首现注句；无命中中性判语
 */
function renderMutagenItems(ctx: AnalysisContext, dedupe?: Map<string, string>): AnalysisItem[] {
	const { mutagenInSanFang } = ctx;

	const items: AnalysisItem[] = [];

	items.push(headItem(`**【本命四化会照】**`, "sihua"));
	items.push(blankItem("sihua"));
	if (mutagenInSanFang.length > 0) {
		mutagenInSanFang.forEach(({ palaceName: pn, starName, mutagen, note }) => {
			items.push(
				contentItem(
					`${mutagenSymbol(mutagen)} **${starName}化${mutagen}**（落${pn}）`,
					"sihua",
					{
						star: starName,
						mutagen,
						palace: pn,
					}
				)
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
 * 文本投影，对应 {@link renderMutagenItems}。
 * @param ctx - 上下文（{@link AnalysisContext}）
 * @param dedupe - 见 {@link renderMutagenItems}。
 * @returns 文本行
 */
export function renderMutagen(ctx: AnalysisContext, dedupe?: Map<string, string>): string[] {
	return formatItems(renderMutagenItems(ctx, dedupe));
}
