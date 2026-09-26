// 五维自然键编码：spec §5.1。year∈[1924,1983]、month∈[1,12]、day∈[1,30]、hour∈[0,11] 时辰索引
export type Gender = 'male' | 'female';

export function sampleId(year: number, month: number, day: number, hour: number, gender: Gender): number {
  return (((((year - 1924) * 12 + (month - 1)) * 30 + (day - 1)) * 12 + hour) * 2
    + (gender === 'male' ? 0 : 1)) + 1;
}

export function decodeSampleId(id: number): { year: number; month: number; day: number; hour: number; gender: Gender } {
  const n = id - 1;
  const gender: Gender = n % 2 === 0 ? 'male' : 'female';
  const rest = Math.floor(n / 2);
  const hour = rest % 12;
  const rest2 = Math.floor(rest / 12);
  const day = (rest2 % 30) + 1;
  const rest3 = Math.floor(rest2 / 30);
  const month = (rest3 % 12) + 1;
  const year = Math.floor(rest3 / 12) + 1924;
  return { year, month, day, hour, gender };
}

// SQL 侧同一公式，列名以 prefix 限定（'birthInfo' 对应 read_json 的 struct 字段，
// 's' 对应 samples 表别名）。构建与验证共用此定义，避免公式分叉。
// 两侧一致性由 tests/db.test.ts 锁定。
//
// 必须把 year 显式转 BIGINT：read_json 的 columns 把 year/month/day/hour 声明为 SMALLINT，
// 而 DuckDB 会把「能容纳于 SMALLINT 的字面量」下推为 SMALLINT，使整式在 INT16 内求值 ——
// 真实数据（720 分片）上从 1928-07 起必然 "Overflow in multiplication of INT16"。
// 一旦首项为 BIGINT，其后各级运算随之提升，最大中间值 518,399 亦无碍。
export function sqlSampleIdExpr(prefix: string): string {
  return `(((((CAST(${prefix}.year AS BIGINT) - 1924) * 12 + (${prefix}.month - 1)) * 30 + (${prefix}.day - 1)) * 12 + ${prefix}.hour) * 2 `
    + `+ CASE WHEN ${prefix}.gender = 'male' THEN 0 ELSE 1 END) + 1`;
}

export const SQL_SAMPLE_ID_EXPR = sqlSampleIdExpr('birthInfo');
