/**
 * 文墨天机星曜亮度查询 —— 装配层逐星覆写的唯一入口。
 *
 * ## 数据与代码的分工
 *
 * - **数据**：`wenmo-sb-tables.json` —— SB 四流派亮度表（83 星 × 12 宫），
 *   提取自文墨天机 v2.5.8 反编译表（与上游开源仓库逐字同源），由提取脚本生成，
 *   **勿手改**；文件内 `_source` / `_index` 键记录来源与索引口径。
 * - **代码**：本文件 —— 星 ID 映射、两套「数值 → 中文」档位、流派状态与查询函数。
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
 */

import sbTables from "./wenmo-sb-tables.json" with { type: "json" };

/** JSON 数据文件里的一张 SB 表（83 行 × 13 列）。 */
type SbTable = ReadonlyArray<ReadonlyArray<number>>;

const TABLES = sbTables as unknown as {
	SB_QS: SbTable;
	SB_XD1: SbTable;
	SB_ZZ: SbTable;
	SB_XD2: SbTable;
};

/**
 * 一个文墨亮度流派。
 * - `QS` 全书派 / `XD1` 现代修订一（7 档制）
 * - `ZZ` 中州派 / `XD2` 现代修订二（5 档制，XD2 为默认）
 */
export type BrightnessSchool = "QS" | "XD1" | "ZZ" | "XD2";

/** 文墨内部星 ID → 星名。未收录的星（不在表里的杂曜）查询返回 `undefined`。 */
export const WENMO_STAR_ID_TO_NAME: Record<number, string> = {
	// 14 主星（紫微系 6 + 天府系 8）
	1: "紫微",
	2: "天机",
	3: "太阳",
	4: "武曲",
	5: "天同",
	6: "廉贞",
	7: "天府",
	8: "太阴",
	9: "贪狼",
	10: "巨门",
	11: "天相",
	12: "天梁",
	13: "七杀",
	14: "破军",
	// 六吉
	15: "文昌",
	16: "文曲",
	17: "左辅",
	18: "右弼",
	19: "天魁",
	20: "天钺",
	// 禄马 + 六煞
	21: "禄存",
	22: "天马",
	23: "火星",
	24: "铃星",
	25: "擎羊",
	26: "陀罗",
	27: "地空",
	28: "地劫",
	// 杂曜（上游 2026-06-20 逆向文墨安星源码定版；38 天厨等留白项剔除不收）
	29: "天福",
	30: "天官",
	32: "八座",
	33: "三台",
	34: "天才",
	37: "天空",
	39: "天哭",
	41: "天虚",
	42: "天贵",
	43: "天寿",
	45: "天德",
	46: "大耗",
	48: "孤辰",
	50: "解神",
	51: "红鸾",
	52: "恩光",
	53: "破碎",
	55: "华盖",
	57: "寡宿",
	58: "凤阁",
	59: "蜚廉",
	60: "龙池",
	62: "月德",
	64: "天使",
	65: "天伤",
	77: "截空",
	78: "副旬",
	79: "年解",
	80: "阴煞",
	81: "龙德",
	82: "咸池",
};

/** 星名 → 文墨星 ID（{@link WENMO_STAR_ID_TO_NAME} 反查，模块加载时构建一次）。 */
const WENMO_NAME_TO_ID: Record<string, number> = {};
for (const k in WENMO_STAR_ID_TO_NAME)
	WENMO_NAME_TO_ID[WENMO_STAR_ID_TO_NAME[Number(k)]] = Number(k);

/** 按流派取 SB 表。 */
const SB_BY_SCHOOL: Record<BrightnessSchool, SbTable> = {
	QS: TABLES.SB_QS,
	XD1: TABLES.SB_XD1,
	ZZ: TABLES.SB_ZZ,
	XD2: TABLES.SB_XD2,
};

/** 7 档制数值 → 中文（QS / XD1 用）。 */
const NUM_TO_CN_7: Record<number, string> = {
	1: "庙",
	2: "旺",
	3: "得",
	4: "利",
	5: "平",
	6: "不",
	7: "陷",
};

/** 5 档制数值 → 中文（ZZ / XD2 用；「闲」由文墨真盘 27/27 坐实）。 */
const NUM_TO_CN_5: Record<number, string> = { 1: "庙", 2: "旺", 3: "平", 4: "闲", 5: "陷" };

/** 按流派选「数值 → 中文」映射：QS/XD1 = 7 档，ZZ/XD2 = 5 档。 */
const NUM_TO_CN_BY_SCHOOL: Record<BrightnessSchool, Record<number, string>> = {
	QS: NUM_TO_CN_7,
	XD1: NUM_TO_CN_7,
	ZZ: NUM_TO_CN_5,
	XD2: NUM_TO_CN_5,
};

/**
 * 当前生效的亮度流派（模块级状态，默认 XD2）。
 *
 * @remarks
 * 与上游一致是**模块级单例**：排盘是同步的，进程内不存在并发覆写窗口。
 * CLI 不暴露切换参数 —— 本变量只服务测试（切流派对拍）与未来可选的流派开关。
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
