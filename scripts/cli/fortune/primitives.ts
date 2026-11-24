/** @file 运限原语。 */

import type { Palace, ZiweiChart } from "@/types";

/** @param year - 年 @returns 0–11 @remarks 年支宫即流年命宫。 */
export function yearlyBranchOf(year: number): number {
	return (((year - 4) % 12) + 12) % 12;
}

/** @param chart - 盘 @param age - 虚岁 @returns 宫 @throws 越界把「小限」指别宫 @remarks 1–120。 */
export function agePalaceOf(chart: ZiweiChart, age: number): Palace {
	const p = chart.palaces.find(x => x.ages?.includes(age));
	if (!p) {
		throw new Error(
			`虚岁 ${age} 不落在任何宫的小限岁数表内（有效域 1–120）—— 多半是参数敲错，不静默兜底`
		);
	}
	return p;
}

/** --daxian/--xiaoxian @param raw - 值 @param currentAge - 岁 @param flagName - 名
 * @returns 虚岁 @throws 非法 @remarks cli/commands/astrology-context.ts；裸开关=「看当前」。 */
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
