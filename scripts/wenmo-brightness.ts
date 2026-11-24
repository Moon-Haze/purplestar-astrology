/** @file @packageDocumentation */
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

/** @param starName @param branchIdx @param school @returns */
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

/** 加载即跑的数据防线；拆出则坏表静默出错亮度。
 * @returns @throws `SB_<流派>` 行列 */
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
