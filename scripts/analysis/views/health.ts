/**
 * 五点五、疾厄宫 —— 通盘最差宫 + 煞忌警示（仅 health 主题出）。
 *
 * ⚠️ 倪师真法三层（语料 05-illness「核心方法论(重大修正)」章节，逐条带回放）：
 *    ① 疾厄宫**星曜**断病「参考可以，真批没有用」（「七杀在疾厄不是痔疮，这都没有
 *    用」）——星曜断病内容不进现役输出；② 真批先看**整个通盘**找最差的宫
 *    （「两个宫都差，肝肾一起病」）；③ 脏腑按《内经》歌诀查——按宫位**地支**，
 *    不按星曜五行。
 *
 * ⚠️ 曾有的「星曜辅助」（`ZIWU_LIUZHU` 主星五行映射脏腑）2026-11-21 退役后经重审
 *    **彻底删除**：倪师明说星曜断病无用，主星映射无重建依据（重建时曾查语料，
 *    依据落在地支歌诀而非星曜）。口径史见 docs/code/analysis.md §8.9 与
 *    corpus/data/annotations.ts 同条目。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：三个逻辑组各成 slot
 * （`extra:倪师疾厄论 · 通盘最差宫` / `extra:疾厄宫参考` / `extra:煞忌警示`
 * / `extra:女命妇科保养`）。
 *
 * @packageDocumentation
 */

import { PALACE_BRANCH_ORGAN, ZI_WU_ORGAN_VERSE } from "../../analysis/data";
import { SHA_HARD, SHA_NAMES } from "../../corpus/data/patterns";
import { BRANCHES } from "@/data/ganzhi";
import type { AnalysisContext } from "../../analysis/context";
import type { ZiweiChart } from "../../types";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

const SLOT_MAIN = "extra:倪师疾厄论 · 通盘最差宫";
const SLOT_REF = "extra:疾厄宫参考";
const SLOT_WARN = "extra:煞忌警示";
const SLOT_FEMALE = "extra:女命妇科保养";

/**
 * 通盘最差宫判定（评审拍板 Q2：按语料示例**归纳**，非原话规则）——化忌落宫与煞星
 * 聚合者为最凶（语料示例：「这个在子时是不是化忌，最凶的在什么胆，七杀在这边七杀
 * 是个杀星」）。化忌权重高于单颗煞星；同分并列取前二（倪师「两个宫都差」的双宫
 * 形态）。通盘无化忌无煞时返回空数组，主轴降级为「未见显著凶宫」。
 */
function worstPalaces(chart: ZiweiChart): number[] {
	const scored = chart.palaces.map(p => {
		const ji = p.stars.some(s => s.mutagen === "忌") ? 2 : 0;
		const sha = p.stars.filter(s => SHA_NAMES.includes(s.name)).length;
		return { branch: p.branch, score: ji + sha };
	});
	const max = Math.max(...scored.map(s => s.score));
	if (max <= 0) {
		return [];
	}
	return scored
		.filter(s => s.score === max)
		.slice(0, 2)
		.map(s => s.branch);
}

/**
 * 疾厄宫 · 通盘最差宫主轴（倪师真法）+ 疾厄宫参考（降级级）+ 煞忌警示。
 *
 * ⚠️ 本函数是 `../data` 的 `PALACE_BRANCH_ORGAN` / `ZI_WU_ORGAN_VERSE` 的**唯一使用点**。
 */
function renderHealthItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, topic, mainPalace, sanFang } = ctx;

	const items: AnalysisItem[] = [];

	if (topic === "health") {
		// 主轴：通盘最差宫 → 歌诀查脏腑（倪师原法；歌诀常量值内含出处与锚点）
		items.push(headItem(`**【倪师疾厄论 · 通盘最差宫】**`, SLOT_MAIN));
		items.push(blankItem(SLOT_MAIN));
		items.push(
			contentItem(
				`疾厄宫星曜断病只作参考——真批先看**整个通盘**找最差的宫，脏腑按歌诀查：${ZI_WU_ORGAN_VERSE}`,
				SLOT_MAIN
			)
		);
		items.push(
			contentItem(
				`判定口径（按语料示例归纳，非原话规则）：化忌落宫与煞星聚合者为最差宫。`,
				SLOT_MAIN
			)
		);
		const worst = worstPalaces(chart);
		if (worst.length > 0) {
			worst.forEach((branch, i) => {
				const organ = PALACE_BRANCH_ORGAN[branch];
				const label = worst.length > 1 && i > 0 ? "▸ 并列凶宫" : "▸ 最差宫";
				items.push(
					contentItem(
						`${label}：**${BRANCHES[branch]}宫**——主管脏腑：**${organ.organ}**（${organ.meridian}，${organ.peakTime}）`,
						SLOT_MAIN
					)
				);
			});
			if (worst.length > 1) {
				items.push(contentItem(`两宫同差则脏腑同病——两处脏腑都列入观察。`, SLOT_MAIN));
			}
		} else {
			items.push(contentItem(`▸ 通盘未见化忌与煞星聚合的显著凶宫。`, SLOT_MAIN));
		}
		// 疾厄宫参考（降级级：星曜断病只作参考，宫位地支的脏腑映射仍可参考）
		const refOrgan = PALACE_BRANCH_ORGAN[mainPalace.branch];
		if (refOrgan) {
			items.push(blankItem(SLOT_MAIN));
			items.push(
				contentItem(
					`▸ 疾厄宫（**${BRANCHES[mainPalace.branch]}宫**）参考：${refOrgan.organ}——星曜断病只作参考，真批以通盘最差宫为准。`,
					SLOT_REF
				)
			);
			items.push(
				contentItem(`▸ 养生要点（通用参考，非倪师口径）：${refOrgan.advice}`, SLOT_REF)
			);
			items.push(blankItem(SLOT_MAIN));
		}

		// 煞星警示（四煞口径取单点 SHA_HARD，与格局判定同源）
		const shaInPalace = mainPalace.stars.filter(s => SHA_HARD.includes(s.name));
		if (shaInPalace.length > 0) {
			items.push(
				contentItem(
					`⚠️ **煞星入疾厄**：${shaInPalace.map(s => s.name).join("、")}——倪师《天纪 11-12》：「陀罗、擎羊入疾厄宫，开刀见血光」。需提前体检，流年化忌入此宫时尤防手术意外。`,
					SLOT_WARN,
					{ aux: shaInPalace.map(s => s.name).join("、") }
				)
			);
			items.push(blankItem(SLOT_WARN));
		}

		// 化忌叠加警示（三方四正见化忌；脏腑取疾厄宫参考口径）
		const jiInSanFang = sanFang.some(p =>
			p.stars.some(s => s.mutagen === "忌" && s.type === "major")
		);
		if (jiInSanFang && refOrgan) {
			items.push(
				contentItem(
					`⚠️ 三方四正有化忌——疾厄宫参考脏腑（**${refOrgan.organ}**）在化忌年份最需重点体检；旺时（${refOrgan.peakTime.split("、")[0]}）应让该脏腑充分休息。`,
					SLOT_WARN,
					{ mutagen: "忌" }
				)
			);
			items.push(blankItem(SLOT_WARN));
		}

		if (chart.birthInfo.gender === "female") {
			items.push(headItem(`**【女命妇科保养】**`, SLOT_FEMALE));
			items.push(blankItem(SLOT_FEMALE));
			items.push(
				contentItem(
					`女命疾厄需把妇科、经期、孕产列为长期观察轴线：每年妇科超声与基础激素检查，记录经期周期、经量、痛经与情绪波动；备孕、孕产、产后恢复阶段尤其要结合医嘱，不以命理判断替代现代医学检查。`,
					SLOT_FEMALE
				)
			);
			items.push(blankItem(SLOT_FEMALE));
		}
	}

	return items;
}

/** 渲染「五点五、疾厄宫」整节（文本投影；仅 health 主题出）。 */
export function renderHealth(ctx: AnalysisContext): string[] {
	return formatItems(renderHealthItems(ctx));
}
