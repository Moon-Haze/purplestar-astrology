/**
 * 五点五、疾厄宫 —— 通盘最差宫 + 煞忌警示（仅 health 出）。
 * ⚠️ 倪师真法三层（语料 05-illness「核心方法论(重大修正)」，带回放）：① 星曜断病
 * 「参考可以，真批没有用」（「七杀在疾厄不是痔疮，这都没有
 *    用」）——不进现役；② 真批先看**通盘**找最差宫（「两个宫都差，肝肾一起病」）；
 * ③ 脏腑按《内经》歌诀查**地支**，非星曜五行。
 * ⚠️ 引语两档：歌诀 `ZI_WU_ORGAN_VERSE` **逐字**有守卫；其余为**轻清洗转述**（可溯
 * 非逐字，不在 grades 对拍面，本注释声明）。旧「星曜辅助」（`ZIWU_LIUZHU` 主星
 * 五行映射）退役后**彻底删除**。口径史见 docs/code/analysis.md §8.9 与
 * corpus/data/annotations.ts 同条目。产出**结构化条目流**（见 `../items`）：四个 slot
 * （`extra:倪师疾厄论 · 通盘最差宫` / `extra:疾厄宫参考` / `extra:煞忌警示` /
 * `extra:女命妇科保养`）。
 * @file 五点五、疾厄宫 —— 通盘最差宫 + 煞忌警示
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
 * 通盘最差宫判定（评审 Q2：按语料示例**归纳**，非原话规则）——化忌落宫与煞星聚合者
 * 最凶（示例：「这个在子时是不是化忌，最凶的在什么胆，七杀在这边七杀 是个杀星」）。
 * 化忌权重高于单煞；同分并列取前二（「两个宫都差」双宫形态）。无化忌无煞返回空数组，
 * 主轴降级「未见显著凶宫」。⚠️ 取舍：例句「杀星」含七杀（主星），实现只数六煞
 * （SHA_NAMES），**主星杀星不计**；六煞与四煞（SHA_HARD）并存。
 * @param chart - 命盘（逐宫：化忌 +2、每颗六煞 +1）
 * @returns 最高分宫地支索引，同分并列取前二（盘序在先优先）；全盘无化忌无煞为空数组
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
 * 疾厄宫主轴（真法）+ 参考（降级）+ 煞忌警示。
 * ⚠️ 本函数是 `../data` 的 `PALACE_BRANCH_ORGAN` / `ZI_WU_ORGAN_VERSE` **唯一使用点**。
 * @param ctx - 主题上下文（{@link AnalysisContext}）：读命盘、主题键、主宫与三方四正；非 `health` 返回空数组
 * @returns 条目流：最差宫主轴（无凶宫降级）→ 疾厄参考 → 煞忌警示 → 女命妇科保养；非 health 为空数组
 */
function renderHealthItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, topic, mainPalace, sanFang } = ctx;

	const items: AnalysisItem[] = [];

	if (topic === "health") {
		// 主轴：通盘最差宫 → 歌诀查脏腑（歌诀常量值含出处锚点）
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
		// 疾厄参考（降级：星曜断病只作参考，地支脏腑映射仍可参考）
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

		// 煞星警示（四煞取单点 SHA_HARD，与格局同源）。⚠️ 引文与 grades 对拍盲区：
		// 对拍只扫 analysis/data.ts（selftest/guard.ts），渲染面引语不在对拍面——
		// 本行引语准确性靠本注释与语料锚点人工维持。
		const shaInPalace = mainPalace.stars.filter(s => SHA_HARD.includes(s.name));
		if (shaInPalace.length > 0) {
			items.push(
				contentItem(
					`⚠️ **煞星入疾厄**：${shaInPalace.map(s => s.name).join("、")}——倪师《天纪 07》擎羊陀罗病灾论：「流年逢到这两颗星，身体病灾就来了」。需提前体检，流年化忌入此宫时尤防手术意外。`,
					SLOT_WARN,
					{ aux: shaInPalace.map(s => s.name).join("、") }
				)
			);
			items.push(blankItem(SLOT_WARN));
		}

		// 化忌叠加警示（三方四正见化忌；脏腑取疾厄参考口径）
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

/**
 * 渲染「五点五、疾厄宫」整节（仅 health 出）。
 * @param ctx - 主题上下文（{@link AnalysisContext}）
 * @returns 与 {@link renderHealthItems} 逐条对应的文本行；非 `health` 为空数组
 */
export function renderHealth(ctx: AnalysisContext): string[] {
	return formatItems(renderHealthItems(ctx));
}
