/**
 * 五点五、疾厄宫 —— 地支主轴 + 星曜辅助 + 煞忌警示（仅 health 主题出）。
 *
 * ⚠️ 三层结构，权重递减：① **宫位主轴**（`PALACE_BRANCH_ORGAN`，疾厄宫落在哪个地支，
 *    倪师原法）→ ② **星曜辅助**（`ZIWU_LIUZHU`，只作附加）→ ③ **警示**（四煞入疾厄 /
 *    三方四正见化忌 / 女命妇科保养）。
 *
 * 完整口径见 docs/code/analysis.md。
 *
 * 产出**结构化条目流**（一源双投影，见 `../items`）：三个逻辑组各成 slot
 * （`extra:倪师疾厄论 · 宫位主轴` / `extra:星曜辅助 · 五行加重` / `extra:煞忌警示`
 * / `extra:女命妇科保养`），警示行无节头但归属煞忌警示组。
 *
 * @packageDocumentation
 */

import { PALACE_BRANCH_ORGAN, ZIWU_LIUZHU } from "../../analysis/data";
import { SHA_HARD } from "../../corpus/data/patterns";
import { BRANCHES } from "@/data/ganzhi";
import type { AnalysisContext } from "../../analysis/context";
import { selectGender } from "../../analysis/lookups";
import type { AnalysisItem } from "../items";
import { blankItem, contentItem, formatItems, headItem } from "../items";

const SLOT_MAIN = "extra:倪师疾厄论 · 宫位主轴";
const SLOT_AUX = "extra:星曜辅助 · 五行加重";
const SLOT_WARN = "extra:煞忌警示";
const SLOT_FEMALE = "extra:女命妇科保养";

/**
 * 疾厄宫 · 地支宫位 → 脏腑映射（倪师体系主轴）
 *
 * ⚠️ 倪师疾厄论断**以疾厄宫落在哪个地支为主轴**，星曜五行为辅 —— 这与「按星曜五行
 *    对应脏腑」的做法不同，后者是传统三合派用法。
 * ⚠️ 本函数是 `../data` 的 `PALACE_BRANCH_ORGAN` 的**唯一使用点**。
 *
 * 《天纪 05》原话条目（化忌在酉 = 肾、火星地空在丑 = 肝、头肩胸 = 妇科子宫 / 右卵巢）
 * 见 docs/code/analysis.md。
 */
export function renderHealthItems(ctx: AnalysisContext): AnalysisItem[] {
	const { chart, topic, mainPalace, primaryStar, sanFang } = ctx;

	const items: AnalysisItem[] = [];

	if (topic === "health") {
		// 主轴：疾厄宫所在地支 → 脏腑（倪师原法）
		const branchOrgan = PALACE_BRANCH_ORGAN[mainPalace.branch];
		if (branchOrgan) {
			items.push(headItem(`**【倪师疾厄论 · 宫位主轴】**`, SLOT_MAIN));
			items.push(blankItem(SLOT_MAIN));
			items.push(
				contentItem(`疾厄宫落于 **${BRANCHES[mainPalace.branch]}宫**——倪师《天纪 05》原法：`, SLOT_MAIN)
			);
			items.push(contentItem(`▸ 主管脏腑：**${branchOrgan.organ}**`, SLOT_MAIN));
			items.push(contentItem(`▸ 对应经络：${branchOrgan.meridian}`, SLOT_MAIN));
			items.push(contentItem(`▸ 子午流注映射：${branchOrgan.peakTime}`, SLOT_MAIN));
			items.push(contentItem(`▸ 经络旺时：${branchOrgan.peakTime}`, SLOT_MAIN));
			items.push(contentItem(`▸ 养生要点：${branchOrgan.advice}`, SLOT_MAIN));
			items.push(blankItem(SLOT_MAIN));
		}

		// 辅助：星曜五行作为加重 / 减轻的附加参考
		if (primaryStar) {
			const ziwu = ZIWU_LIUZHU[primaryStar.name];
			if (ziwu) {
				items.push(headItem(`**【星曜辅助 · 五行加重】**`, SLOT_AUX));
				items.push(blankItem(SLOT_AUX));
				items.push(
					contentItem(
						`疾厄宫主星 **${primaryStar.name}**（${ziwu.element}）辅助指向 **${ziwu.organ}**——星曜五行是"附加提示"，与宫位地支脏腑叠加判断：`,
						SLOT_AUX,
						{ star: primaryStar.name }
					)
				);
				items.push(
					contentItem(`▸ ${selectGender(ziwu.advice, chart.birthInfo.gender)}`, SLOT_AUX, {
						star: primaryStar.name,
					})
				);
				items.push(blankItem(SLOT_AUX));
			}
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

		// 化忌叠加警示
		const jiInSanFang = sanFang.some(p =>
			p.stars.some(s => s.mutagen === "忌" && s.type === "major")
		);
		if (jiInSanFang && branchOrgan) {
			items.push(
				contentItem(
					`⚠️ 三方四正有化忌——倪师提醒：疾厄宫主管的 **${branchOrgan.organ}** 在化忌年份最需重点体检；经络旺时（${branchOrgan.peakTime.split("、")[0]}）应让该脏腑充分休息。`,
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
