/**
 * 运限定位原语 —— 流年地支 / 小限落宫 / 虚岁参数解析的共享底座。
 *
 * 被各专题节（overview / decadal / age / focus …）与 selftest 共用，
 * 是 `fortune/` 目录里唯一不含渲染的纯函数组。
 */

import type { Palace, ZiweiChart } from "@/types";

/**
 * 公历年 → 流年地支索引。
 *
 * @param year - 公历年（用户问「2026 年运势」即指该公历年对应的干支年）
 * @returns 地支索引 0–11
 *
 * @remarks
 * 与内核 `mutagen.ts` 的 `getYearStemIndex` 同一口径（`(year - 4) % 12`）。
 * 流年命宫就是**年支所在的那个宫**（三合派：不重排十二宫，以年支宫为流年命宫论三方四正）。
 */
export function yearlyBranchOf(year: number): number {
	return (((year - 4) % 12) + 12) % 12;
}

/**
 * 虚岁 → 该岁小限所在宫。
 *
 * @param chart - 命盘
 * @param age - 虚岁（1–120）
 * @returns 小限落宫
 * @throws 当该虚岁不落在任何宫的小限岁数表内时（如 0 / 121 —— 多半是参数敲错，
 *   静默兜底会把「小限」指到一个不相干的宫）
 *
 * @remarks
 * 数据取自 iztro 的 `palace.ages`（`algorithm.ts` 提取为 `Palace.ages`），
 * 十二宫并集连续覆盖 1–120，故正常输入必命中。
 */
export function agePalaceOf(chart: ZiweiChart, age: number): Palace {
	const p = chart.palaces.find(x => x.ages?.includes(age));
	if (!p) {
		throw new Error(
			`虚岁 ${age} 不落在任何宫的小限岁数表内（有效域 1–120）—— 多半是参数敲错，不静默兜底`
		);
	}
	return p;
}

/**
 * 解析 `--daxian` / `--xiaoxian` 的可选值形态 `[虚岁]`。
 *
 * @param raw - CliArgs 里的原始值：字符串（带值）、`true`（裸开关）、`undefined`（未给）；
 *   类型上还含 `string[]`（CliArgs 索引签名的宽域，归一层实际已把重复值并成末值）
 * @param currentAge - 当前虚岁（裸开关与缺省都取它）
 * @param flagName - 旗标名，只用于错误文案
 * @returns 有效的虚岁
 * @throws 非整数、超出 1–120 时
 *
 * @remarks
 * 与 `parseLiuNianArg` 同一条纪律：非数字静默传下去会产出错盘，宁可报错。
 * 裸开关（`true`）不报错 —— 它的语义就是「看当前」。
 */
export function parseAgesArg(
	raw: string | boolean | string[] | undefined,
	currentAge: number,
	flagName: string
): number {
	if (raw === undefined || raw === true) {
		return currentAge;
	}
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1 || n > 120) {
		throw new Error(`${flagName} 应为 1-120 的整数虚岁，收到：${raw}`);
	}
	return n;
}
