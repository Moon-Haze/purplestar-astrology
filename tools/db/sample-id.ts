/**
 * @file 样本五维 ID 双日历编解码。
 */
// 五维键公式按口径选（MANIFEST.calendar → {@link sqlSampleIdExpr}）：
// synthetic 基1924 容器30 → 518,400 稠密；solar 基1950 容器31 → 686,880 ≥ 674,976。
// ⚠️ SQL 三陷阱：hour 非钟点 / day 配口径 / year 显式 BIGINT 防 SMALLINT 溢出，详见 docs/code/db-tools.md

/** 性别：male=0 / female=1。 */
export type Gender = "male" | "female";
/** 口径：synthetic / solar。 */
export type Calendar = "synthetic" | "solar";

/** 编码参数：基年、day 容器宽。 */
const CALIBER: Record<Calendar, { baseYear: number; dayContainer: number }> = {
	synthetic: { baseYear: 1924, dayContainer: 30 },
	solar: { baseYear: 1950, dayContainer: 31 },
};

/**
 * 出生五元组 → 样本 ID。
 * @param year - 公历年
 * @param month - 月 1–12
 * @param day - 日
 * @param timeIndex - 时辰索引 0–11
 * @param gender - male=0 / female=1
 * @param calendar - 口径
 * @returns 样本 ID（口径内不重复）
 */
export function sampleId(
	year: number,
	month: number,
	day: number,
	timeIndex: number,
	gender: Gender,
	calendar: Calendar
): number {
	const { baseYear, dayContainer } = CALIBER[calendar];
	return (
		((((year - baseYear) * 12 + (month - 1)) * dayContainer + (day - 1)) * 12 + timeIndex) * 2 +
		(gender === "male" ? 0 : 1) +
		1
	);
}

/**
 * 样本 ID → 五元组（口径须一致）。
 * @param id - 样本 ID（1 起）
 * @param calendar - 口径
 * @returns 出生五元组
 */
export function decodeSampleId(
	id: number,
	calendar: Calendar
): { year: number; month: number; day: number; timeIndex: number; gender: Gender } {
	const { baseYear, dayContainer } = CALIBER[calendar];
	const n = id - 1;
	const gender: Gender = n % 2 === 0 ? "male" : "female";
	const rest = Math.floor(n / 2);
	const timeIndex = rest % 12;
	const rest2 = Math.floor(rest / 12);
	const day = (rest2 % dayContainer) + 1;
	const rest3 = Math.floor(rest2 / dayContainer);
	const month = (rest3 % 12) + 1;
	const year = Math.floor(rest3 / 12) + baseYear;
	return { year, month, day, timeIndex, gender };
}

/**
 * SQL 侧 ID 表达式，口径须与读侧一致。
 * @param prefix - SQL 表别名
 * @param calendar - 口径
 * @returns 与 {@link sampleId} 同公式的表达式
 */
export function sqlSampleIdExpr(prefix: string, calendar: Calendar): string {
	const { baseYear, dayContainer } = CALIBER[calendar];
	return (
		`(((((CAST(${prefix}.year AS BIGINT) - ${baseYear}) * 12 + (${prefix}.month - 1)) * ${dayContainer} + (${prefix}.day - 1)) * 12 + ${prefix}.hour) * 2 ` +
		`+ CASE WHEN ${prefix}.gender = 'male' THEN 0 ELSE 1 END) + 1`
	);
}
