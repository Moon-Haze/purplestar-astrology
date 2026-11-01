/**
 * 二、三方四正联动分析 —— 本宫之外三宫的星曜详解。
 *
 * ⚠️ 本宫只出一行星曜概要（详解已在「一、总论」给过）；空宫借对宫论事只是**列名**，
 *    不参与后续论断。
 *
 * 逐宫展开次序与次星（六吉 + 禄存 + 天马）深度文案的口径，见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：`renderSanFangItems` 是数据面，
 * `renderSanFang` 经 `formatItems` 投影为文本行。
 *
 * @packageDocumentation
 */

import {
	PALACE_TO_CONTENT_KEY,
	STAR_BRIEF,
	STAR_CONTENT_MAP,
	type PalaceContent,
} from "../../analysis/data";
import type { AnalysisContext } from "../../analysis/context";
import { starBadge } from "../../analysis/overview-material";
import {
	getMinorStarNote,
	getMutagenNote,
	selectBranches,
	selectGender,
} from "../../analysis/lookups";
import { descPalaceStars } from "../../analysis/palace-query";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

/**
 * 渲染「二、三方四正联动」整节的结构化条目流（slot = `san-fang`，宫头行与全部条目
 * 携带 `palace`）。
 *
 * @param dedupe - 报告装配层的跨节去重表（键 = 论断全文文本，值 = 首现 / 主场板块名）。
 *   命中的全文降级为「星曜徽标 + 指引回首现板块」一行；未命中给全文并登记本板块。
 *   缺省（`--topic` 单主题路径）为 `undefined`，输出与不去重时逐字节一致。
 *   主场登记由装配层预扫描完成（见 `analysis/report.ts` 的 `getTopicMainContentText`）。
 */
export function renderSanFangItems(
	ctx: AnalysisContext,
	dedupe?: Map<string, string>
): AnalysisItem[] {
	const { palaceName, sanFang, sanFangLabels, gender } = ctx;

	const items: AnalysisItem[] = [];

	items.push(blankItem("san-fang"));
	items.push(headItem(`**【三方四正联动】**`, "san-fang"));
	items.push(blankItem("san-fang"));

	sanFang.forEach((p, idx) => {
		const isMain = p.name === palaceName;
		const label = isMain
			? `本宫 · ${p.name}`
			: `${sanFangLabels[idx - 1] ?? "联动宫"} · ${p.name}`;
		const starsDesc = descPalaceStars(p);
		const mainStarsOfP = p.stars.filter(s => s.type === "major");

		items.push(contentItem(`▍**${label}**：${starsDesc}`, "san-fang", { palace: p.name }));

		if (!isMain && mainStarsOfP.length > 0) {
			mainStarsOfP.forEach(s => {
				const starProfile = STAR_CONTENT_MAP[s.name];
				const palaceContentKey = PALACE_TO_CONTENT_KEY[p.name];
				const fullContent =
					starProfile && palaceContentKey
						? selectBranches(
								starProfile[palaceContentKey] as PalaceContent | undefined,
								s,
								gender
							) || null
						: null;
				const mutagenStr = s.mutagen ? `化${s.mutagen}` : "";
				const brightStr =
					s.brightness === "bright"
						? "（庙旺）"
						: s.brightness === "dim"
							? "（落陷）"
							: "";
				const mutagenNote = s.mutagen ? getMutagenNote(s.name, s.mutagen, gender) : "";

				if (fullContent) {
					const seenAt = dedupe?.get(fullContent);
					if (seenAt) {
						// 跨节去重：同段全文已登记（他板块首现，或本板块主场预登记）——
						// 降级为徽标 + 指引行，全文恒只在其首现 / 主场板块出现一次。
						items.push(
							contentItem(`**${starBadge(s)}**（论断详见「${seenAt}」板块）`, "san-fang", {
								star: s.name,
								palace: p.name,
								brightness: s.brightness,
								mutagen: s.mutagen,
							})
						);
					} else {
						// 有完整宫位段落，直接输出全文 + 四化补充
						items.push(
							contentItem(`**${s.name}${mutagenStr}${brightStr}** 在${p.name}：`, "san-fang", {
								star: s.name,
								palace: p.name,
								brightness: s.brightness,
								mutagen: s.mutagen,
							})
						);
						items.push(blankItem("san-fang"));
						items.push(
							contentItem(fullContent, "san-fang", {
								star: s.name,
								palace: p.name,
								brightness: s.brightness,
								mutagen: s.mutagen,
							})
						);
						if (mutagenNote) {
							items.push(blankItem("san-fang"));
							items.push(
								contentItem(`▶ 化${s.mutagen}：${mutagenNote}`, "san-fang", {
									star: s.name,
									palace: p.name,
									mutagen: s.mutagen,
								})
							);
						}
						dedupe?.set(fullContent, ctx.topicLabel);
					}
				} else {
					// 无专项段落，用简述 + 四化
					const brief = STAR_BRIEF[s.name] ?? "";
					items.push(
						contentItem(
							`  ${s.name}${mutagenStr}${brightStr}${brief ? "（" + brief + "）" : ""}${mutagenNote ? " | 化" + s.mutagen + "：" + mutagenNote : ""}`,
							"san-fang",
							{ star: s.name, palace: p.name, brightness: s.brightness, mutagen: s.mutagen }
						)
					);
				}
				items.push(blankItem("san-fang"));
			});
		} else if (!isMain && mainStarsOfP.length === 0) {
			// 借宫信息直接读排盘填好的结构化字段（borrowedStars/borrowedFromName），不内联重算
			const oppName = p.borrowedFromName ?? "";
			const oppStars = p.borrowedStars ?? [];
			if (oppStars.length > 0) {
				items.push(
					contentItem(`  （空宫，借对宫${oppName}：${oppStars.join("、")}入事）`, "san-fang", {
						palace: p.name,
					})
				);
			} else {
				items.push(contentItem(`  （空宫）`, "san-fang", { palace: p.name }));
			}
		}

		// ── 次星（六吉 + 禄存 + 天马）深度文案 ──
		const minorStarNotes: Array<{ name: string; note: string }> = [];
		p.stars
			.filter(s => s.type === "soft")
			.forEach(ls => {
				const note = getMinorStarNote(ls.name, p.name);
				if (note) {
					minorStarNotes.push({ name: ls.name, note });
				}
			});
		if (minorStarNotes.length > 0) {
			minorStarNotes.forEach(({ name, note }) => {
				items.push(contentItem(`✦ **${name}**：${note}`, "san-fang", { aux: name, palace: p.name }));
			});
			items.push(blankItem("san-fang"));
		}

		items.push(blankItem("san-fang"));
	});

	return items;
}

/**
 * 渲染「二、三方四正联动」整节（文本投影）。
 *
 * @param dedupe - 见 {@link renderSanFangItems}。
 */
export function renderSanFang(ctx: AnalysisContext, dedupe?: Map<string, string>): string[] {
	return formatItems(renderSanFangItems(ctx, dedupe));
}
