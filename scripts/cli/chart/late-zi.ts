/**
 * 晚子时对照盘 —— 取数单点：按口径标志排出**另一口径**的对照盘。
 *
 * `render.ts` 的 `lateZiSection` 只渲染不排盘（渲染层零排盘、零 IO），对照盘由
 * 调用方（cmdAstrology / composeSections / buildReport）经本函数显式取出后作参数递入。
 * 排盘走缓存层，与主盘同键不同 `timeIndex`，各占一个缓存条目、只排一次。
 */

import type { BirthInfo, ZiweiChart } from "@/types";
import type { CaliberBasis } from "../birth/birth-info-defs";
import { generateChartCached } from "./chart-cache";

/**
 * 排晚子时对照盘。
 *
 * @param info - 出生信息；重排对照盘时只改 `timeIndex`，其余照用
 * @param basis - 口径载体（只读 `isLateZi` 与 `lateZiCandidate` 两字段）
 * @returns 对照盘：`isLateZi` 时为**当日早子时**口径（`timeIndex: 0`），否则若校正后
 *   落在 23:00–23:59（`lateZiCandidate`）则为**晚子时·算次日**口径（`timeIndex: 12`）；
 *   两种口径都不涉及时返回 `null`
 *
 * @remarks
 * 返回值非空 ⇔ `isLateZi || lateZiCandidate`，`lateZiSection` 依赖这一配对不变量
 * （`alt === null` 即「两种口径都不涉及」），两处判据同源，不会分叉。
 */
export function lateZiCounterChart(
	info: BirthInfo,
	basis: Pick<CaliberBasis, "isLateZi" | "lateZiCandidate">
): ZiweiChart | null {
	if (basis.isLateZi) {
		return generateChartCached({ ...info, timeIndex: 0 });
	}
	if (basis.lateZiCandidate) {
		return generateChartCached({ ...info, timeIndex: 12 });
	}
	return null;
}
