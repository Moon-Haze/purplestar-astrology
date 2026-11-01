// 五维自然键编码。公式**按数据集的日历口径选择**（build 读 MANIFEST.calendar 后传给
// {@link sqlSampleIdExpr}）——一个 dataset 只对应一个源数据集，id 域因此自洽：
//   - synthetic（v3，合成历每月 30 天）：year∈[1924,1983]，基 1924，day 容器 30 → 1..518,400 稠密
//   - solar（v4，真实公历）：year∈[1950,2026]，基 1950，day 容器 31（2 月等短月产生稀疏 id）
//     → 最大 686,880 ≥ v4 totalCharts 674,976
// hour 两口径同为时辰索引 0–11（子=0…亥=11），gender 二值 male=0/female=1。
export type Gender = "male" | "female";
export type Calendar = "synthetic" | "solar";

/** 各日历口径的编码参数：基年与 day 容器宽。 */
const CALIBER: Record<Calendar, { baseYear: number; dayContainer: number }> = {
	synthetic: { baseYear: 1924, dayContainer: 30 },
	solar: { baseYear: 1950, dayContainer: 31 },
};

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
//
// ⚠️ 源字段名是 `hour`（ziwei-interp 分片的导出口径），**语义是时辰索引 0–11**、
//    不是钟点 —— 曾误改成本仓内部命名 timeIndex，导致 read_json 永远取 NULL、
//    palaces.sample_id 全数违约。
//
// ⚠️ day 容器必须与日历口径配套：solar（真实公历）若用 30 容器，31 日会与次月 1 号
//    撞 id（(m-1)*30+30 = m*30+0）。
//
// 必须把 year 显式转 BIGINT：read_json 的 columns 把 year/month/day/hour 声明为 SMALLINT，
// 而 DuckDB 会把「能容纳于 SMALLINT 的字面量」下推为 SMALLINT，使整式在 INT16 内求值 ——
// 真实数据上必然 "Overflow in multiplication of INT16"。
// 一旦首项为 BIGINT，其后各级运算随之提升（solar 最大 686,880 亦无碍）。
export function sqlSampleIdExpr(prefix: string, calendar: Calendar): string {
	const { baseYear, dayContainer } = CALIBER[calendar];
	return (
		`(((((CAST(${prefix}.year AS BIGINT) - ${baseYear}) * 12 + (${prefix}.month - 1)) * ${dayContainer} + (${prefix}.day - 1)) * 12 + ${prefix}.hour) * 2 ` +
		`+ CASE WHEN ${prefix}.gender = 'male' THEN 0 ELSE 1 END) + 1`
	);
}
