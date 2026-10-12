/**
 * 文墨天机星曜亮度查询 —— 装配层逐星覆写的唯一入口。
 *
 * ## 数据与代码的分工（2026-10-11 已落实为物理分层）
 *
 * - **数据** → `data/wenmo-tables.ts`：SB 四流派亮度表（83 星 × 12 宫），提取自文墨
 *   天机 v2.5.8 反编译整数表（与上游开源仓库逐字同源），由提取脚本生成，**勿手改**——
 *   改表先改上游 / 提取脚本再重新生成。
 * - **代码** → 本文件：流派单例状态与查询函数。星 ID 映射、两套「数值 → 中文」档位
 *   表随数据下沉（它们以 {@link BrightnessSchool} 为键，是数据的 schema 契约），
 *   本文件从数据层引入后对外 re-export。
 *
 * ## 依赖方向
 *
 * `本文件（计算层） → data/wenmo-tables.ts（数据层）` 单向。
 * 数据层**不得**反向依赖本文件 —— 这正是 {@link BrightnessSchool} 类型下沉的原因。
 *
 * ## 索引口径（对拍复核过）
 *
 * - **星 ID 1-based**：`[0]` 行占位；1–14 主星、15–20 六吉、21–28 禄马+六煞、29 起杂曜。
 *   实际 83 行（ID 0–82）—— 上游注释写「85 星」是滞后说法，以数据 + 维度自检为准。
 * - **宫位列「子起一」**：`[0]` 列占位，1=子 … 12=亥。传入地支索引（子起 0）后取
 *   `col = branchIdx + 1`。
 *
 * ## 两套显示档位
 *
 * - QS（全书派）/ XD1（现代修订一）：7 档制 `1庙 2旺 3得 4利 5平 6不 7陷`；
 * - ZZ（中州派）/ XD2（现代修订二）：5 档制 `1庙 2旺 3平 4闲 5陷`。
 * - 表值 0 = 文墨留白（该宫不标亮度），查询返回 `undefined`。
 *
 * ## 默认流派
 *
 * **XD2（现代修订二）** —— 文墨 APP 默认亮度流派即它（用户实证 + 真盘全 12 宫 27/27）。
 * 上游注释里的「default = 全书派」是被 XD2 结论推翻的滞后说法，不要采信。
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

/**
 * 当前生效的亮度流派（模块级状态，默认 XD2）。
 *
 * @remarks
 * 与上游一致是**模块级单例**：排盘是同步的，进程内不存在并发覆写窗口。
 * CLI 不暴露切换参数 —— 本变量只服务测试（切流派对拍）与未来可选的流派开关。
 *
 * ⚠️ 本状态**留在本模块而非下沉数据层**：它是可变运行时状态，不是数据。
 */
let currentSchool: BrightnessSchool = "XD2";

/**
 * 切换亮度流派。
 *
 * @param school - 流派名；`"default"` 归一为 `"XD2"`（与上游 setBrightnessSchool 同语义）
 */
export function setBrightnessSchool(school: BrightnessSchool | "default"): void {
	currentSchool = school === "default" ? "XD2" : school;
}

/** 当前生效的亮度流派（测试断言用）。 */
export function getBrightnessSchool(): BrightnessSchool {
	return currentSchool;
}

/**
 * 查文墨星曜亮度（中文细档，如「庙」「闲」）。
 *
 * @param starName - 星名（本仓口径星名，与文墨解码名一致）
 * @param branchIdx - 星所在宫的地支索引 0–11（0=子 … 11=亥）
 * @param school - 流派，缺省用 {@link currentSchool}
 * @returns 中文亮度字；星未收录或文墨留白（0）时为 `undefined`
 */
export function wenmoStarBrightness(
	starName: string,
	branchIdx: number,
	school: BrightnessSchool = currentSchool
): string | undefined {
	const id = WENMO_NAME_TO_ID[starName];
	if (id == null) return undefined;
	const v = SB_BY_SCHOOL[school][id]?.[branchIdx + 1];
	if (v == null || v === 0) return undefined;
	return NUM_TO_CN_BY_SCHOOL[school][v];
}

/**
 * 维度自检：四表各 83 行 × 13 列、数值落在对应档位域内。
 * 模块加载即跑（排盘启动期的数据完整性防线，坏了当场炸而不是静默错亮度）。
 *
 * ⚠️ 本函数**必须留在本文件、且必须在此处以语句形式立即调用**：它是排盘启动期的
 * 数据完整性防线。拆分时若把它移进 `data/` 的惰性 export，或被 tree-shaking 掉，
 * 损坏的表就会静默产出错亮度 —— 防线失效且不可见。
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
		if (table.length !== 83) throw new Error(`SB_${school} 行数 ${table.length} ≠ 83`);
		table.forEach((row, i) => {
			if (row.length !== 13) throw new Error(`SB_${school}[${i}] 列数 ${row.length} ≠ 13`);
			for (const v of row) {
				if (v !== 0 && !domains[school].includes(v))
					throw new Error(`SB_${school}[${i}] 含非法亮度值 ${v}`);
			}
		});
	}
}
validateWenmoBrightness();