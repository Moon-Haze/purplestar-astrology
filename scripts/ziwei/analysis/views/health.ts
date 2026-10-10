/**
 * 五点五、疾厄宫 —— 地支主轴 + 星曜辅助 + 煞忌警示（仅 health 主题出）。
 *
 * @remarks
 * 三层结构，权重递减：
 *   1. **宫位主轴**（`PALACE_BRANCH_ORGAN`）—— 疾厄宫落在哪个地支，这是倪师原法
 *   2. **星曜辅助**（`ZIWU_LIUZHU`）—— 主星五行的加重 / 减轻提示，只作附加
 *   3. **警示**—— 四煞入疾厄、三方四正见化忌、女命妇科保养
 *
 * @packageDocumentation
 */

import { PALACE_BRANCH_ORGAN, ZIWU_LIUZHU } from "../data";
import { BRANCHES } from "../../constants";
import type { AnalysisContext } from "../context";

/**
 * 疾厄宫 · 地支宫位 → 脏腑映射（倪师体系主轴）
 *
 * ⚠️ 倪师《天纪 05》原话明示：
 *   - 化忌在酉宫 = 肾
 *   - 火星地空在丑宫 = 肝
 *   - 头肩胸区域 = 妇科子宫 / 右卵巢
 *
 * 倪师疾厄论断**以疾厄宫落在哪个地支为主轴**，星曜五行为辅。
 * 这与「按星曜五行对应脏腑」的做法不同——后者是传统三合派用法。
 *
 * @remarks
 * 该映射表本身在 `../data` 的 `PALACE_BRANCH_ORGAN`，本函数是它的
 * **唯一使用点**。
 */
export function renderHealth(ctx: AnalysisContext): string[] {
	const { chart, topic, mainPalace, primaryStar, sanFang } = ctx;

	const lines: string[] = [];

	if (topic === "health") {
		// 主轴：疾厄宫所在地支 → 脏腑（倪师原法）
		const branchOrgan = PALACE_BRANCH_ORGAN[mainPalace.branch];
		if (branchOrgan) {
			lines.push(`**【倪师疾厄论 · 宫位主轴】**`);
			lines.push("");
			lines.push(`疾厄宫落于 **${BRANCHES[mainPalace.branch]}宫**——倪师《天纪 05》原法：`);
			lines.push(`▸ 主管脏腑：**${branchOrgan.organ}**`);
			lines.push(`▸ 对应经络：${branchOrgan.meridian}`);
			lines.push(`▸ 子午流注映射：${branchOrgan.peakTime}`);
			lines.push(`▸ 经络旺时：${branchOrgan.peakTime}`);
			lines.push(`▸ 养生要点：${branchOrgan.advice}`);
			lines.push("");
		}

		// 辅助：星曜五行作为加重 / 减轻的附加参考
		if (primaryStar) {
			const ziwu = ZIWU_LIUZHU[primaryStar.name];
			if (ziwu) {
				lines.push(`**【星曜辅助 · 五行加重】**`);
				lines.push("");
				lines.push(
					`疾厄宫主星 **${primaryStar.name}**（${ziwu.element}）辅助指向 **${ziwu.organ}**——星曜五行是"附加提示"，与宫位地支脏腑叠加判断：`
				);
				lines.push(`▸ ${ziwu.advice}`);
				lines.push("");
			}
		}

		// 煞星警示
		const shaInPalace = mainPalace.stars.filter(s =>
			["擎羊", "陀罗", "火星", "铃星"].includes(s.name)
		);
		if (shaInPalace.length > 0) {
			lines.push(
				`⚠️ **煞星入疾厄**：${shaInPalace.map(s => s.name).join("、")}——倪师《天纪 11-12》：「陀罗、擎羊入疾厄宫，开刀见血光」。需提前体检，流年化忌入此宫时尤防手术意外。`
			);
			lines.push("");
		}

		// 化忌叠加警示
		const jiInSanFang = sanFang.some(p =>
			p.stars.some(s => s.mutagen === "忌" && s.type === "major")
		);
		if (jiInSanFang && branchOrgan) {
			lines.push(
				`⚠️ 三方四正有化忌——倪师提醒：疾厄宫主管的 **${branchOrgan.organ}** 在化忌年份最需重点体检；经络旺时（${branchOrgan.peakTime.split("、")[0]}）应让该脏腑充分休息。`
			);
			lines.push("");
		}

		if (chart.birthInfo.gender === "female") {
			lines.push(`**【女命妇科保养】**`);
			lines.push("");
			lines.push(
				`女命疾厄需把妇科、经期、孕产列为长期观察轴线：每年妇科超声与基础激素检查，记录经期周期、经量、痛经与情绪波动；备孕、孕产、产后恢复阶段尤其要结合医嘱，不以命理判断替代现代医学检查。`
			);
			lines.push("");
		}
	}

	return lines;
}
