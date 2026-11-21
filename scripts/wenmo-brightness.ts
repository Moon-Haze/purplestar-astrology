/**
 * 文墨天机星曜亮度查询 —— 装配层逐星覆写的唯一入口（计算层；数据在 `data/wenmo-tables.ts`）。
 *
 * ⚠️ 数据与代码的分工、单向依赖方向、星 ID 1-based / 宫位「子起一」的索引口径、
 *    两套显示档位（7 档 QS/XD1 · 5 档 ZZ/XD2）、默认流派 XD2 的来历，
 *    一并见 docs/code/chart-kernel.md。
 *
 * @packageDocumentation
 */
import {
	WENMO_NAME_TO_ID,
	SB_BY_SCHOOL,
	NUM_TO_CN_BY_SCHOOL,
	type BrightnessSchool,
} from "./data/wenmo-tables";

export type { BrightnessSchool };

// ⚠️ 2026-11-21（评审 N3 / change 2026-11-21-brightness-knob-retire）：上游同款的
//    setBrightnessSchool / getBrightnessSchool / currentSchool 三件套已退役 —— 唯一合法
//    调用者类（插件层）被 extensibility spec 禁止修改内核模块状态（wenmo-nishi 注释
//    自证不调用），生产消费恒走默认值：零消费旋钮是假想 seam 的机制半边。
//    默认流派 XD2 现在是内核侧**常量事实**，经 wenmoStarBrightness 的可选 school 入参
//    表达；四流派数据表与维度自检原样保留（多流派对拍传显式实参）。

/**
 * 查文墨星曜亮度（中文细档，如「庙」「闲」）。
 *
 * @param starName - 星名（本仓口径星名，与文墨解码名一致）
 * @param branchIdx - 星所在宫的地支索引 0–11（0=子 … 11=亥）
 * @param school - 流派，缺省 XD2（内核常量事实；多流派对拍传显式实参）
 * @returns 中文亮度字；星未收录或文墨留白（0）时为 `undefined`
 */
export function wenmoStarBrightness(
	starName: string,
	branchIdx: number,
	school: BrightnessSchool = "XD2"
): string | undefined {
	const id = WENMO_NAME_TO_ID[starName];
	if (id == null) {
		return undefined;
	}
	const v = SB_BY_SCHOOL[school][id]?.[branchIdx + 1];
	if (v == null || v === 0) {
		return undefined;
	}
	return NUM_TO_CN_BY_SCHOOL[school][v];
}

/**
 * 维度自检：四表各 83 行 × 13 列、数值落在对应档位域内。模块加载即跑。
 *
 * ⚠️ 本函数**必须留在本文件、且必须在此处以语句形式立即调用**：它是排盘启动期的数据
 *    完整性防线。拆进 `data/` 的惰性 export 或被 tree-shaking 掉，损坏的表就会静默
 *    产出错亮度 —— 防线失效且不可见。完整理由见 docs/code/chart-kernel.md。
 */
export function validateWenmoBrightness(): void {
	const domains: Record<BrightnessSchool, number[]> = {
		QS: [1, 2, 3, 4, 5, 6, 7],
		XD1: [1, 2, 3, 4, 5, 6, 7],
		ZZ: [1, 2, 3, 4, 5],
		XD2: [1, 2, 3, 4, 5],
	};
	for (const school of ["QS", "XD1", "ZZ", "XD2"] as const) {
		const table = SB_BY_SCHOOL[school];
		if (table.length !== 83) {
			throw new Error(`SB_${school} 行数 ${table.length} ≠ 83`);
		}
		table.forEach((row, i) => {
			if (row.length !== 13) {
				throw new Error(`SB_${school}[${i}] 列数 ${row.length} ≠ 13`);
			}
			for (const v of row) {
				if (v !== 0 && !domains[school].includes(v)) {
					throw new Error(`SB_${school}[${i}] 含非法亮度值 ${v}`);
				}
			}
		});
	}
}
validateWenmoBrightness();
