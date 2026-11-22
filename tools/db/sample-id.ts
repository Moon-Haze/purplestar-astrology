/**
 * @file 基准样本五维标识的双日历编码与解码。
 */
// 五维自然键编码。公式**按数据集的日历口径选择**（build 读 MANIFEST.calendar 后传给
// {@link sqlSampleIdExpr}）——一个 dataset 只对应一个源数据集，id 域因此自洽：
//   - synthetic（v3，合成历每月 30 天）：year∈[1924,1983]，基 1924，day 容器 30 → 1..518,400 稠密
//   - solar（v4，真实公历）：year∈[1950,2026]，基 1950，day 容器 31（2 月等短月产生稀疏 id）
//     → 最大 686,880 ≥ v4 totalCharts 674,976
// hour 两口径同为时辰索引 0–11（子=0…亥=11），gender 二值 male=0/female=1。
/** 性别编码：male=0 / female=1。 */
export type Gender = "male" | "female";
/** 日历口径：synthetic（合成历）或 solar（真实公历）。 */
export type Calendar = "synthetic" | "solar";

/** 各日历口径的编码参数：基年与 day 容器宽。 */
const CALIBER: Record<Calendar, { baseYear: number; dayContainer: number }> = {
	synthetic: { baseYear: 1924, dayContainer: 30 },
	solar: { baseYear: 1950, dayContainer: 31 },
};

/**
 * 按日历口径把出生五元组编码成样本 ID。
 *
 * @param year - 公历年（synthetic 1924–1983 / solar 1950–2026）
 * @param month - 公历月（1–12）
 * @param day - 公历日（1–30 或 1–31，随口径）
 * @param timeIndex - 时辰索引 0–11（子=0…亥=11）
 * @param gender - 性别（male 编 0、female 编 1）
 * @param calendar - 数据集日历口径
 * @returns 编码后的样本 ID（口径内两两不重复）
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
 * 把样本 ID 解码回出生五元组；口径须与编码时一致。
 *
 * @param id - 样本 ID（1 起）
 * @param calendar - 数据集日历口径
 * @returns 解出的出生五元组
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

// SQL 侧同一公式，列名以 prefix 限定（'birthInfo' 对应 read_json 的 struct 字段，
// 's' 对应 samples 表别名）。构建按源数据集的日历口径传入 calendar，避免公式分叉。
// ⚠️ 三个实测陷阱（源字段名 `hour` 实为时辰索引 / day 容器须配日历口径 / year 必须显式
// BIGINT 防 SMALLINT 溢出）：详见 docs/code/db-tools.md
/**
 * 生成 SQL 侧的样本 ID 表达式，口径须与读侧一致。
 *
 * @param prefix - SQL 里的表别名（如 `s`）
 * @param calendar - 数据集日历口径
 * @returns 与 {@link sampleId} 同公式的 SQL 表达式
 */
export function sqlSampleIdExpr(prefix: string, calendar: Calendar): string {
	const { baseYear, dayContainer } = CALIBER[calendar];
	return (
		`(((((CAST(${prefix}.year AS BIGINT) - ${baseYear}) * 12 + (${prefix}.month - 1)) * ${dayContainer} + (${prefix}.day - 1)) * 12 + ${prefix}.hour) * 2 ` +
		`+ CASE WHEN ${prefix}.gender = 'male' THEN 0 ELSE 1 END) + 1`
	);
}
