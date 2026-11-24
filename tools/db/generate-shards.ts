/**
 * 518k 分片生成器 tools/db/generate-shards.ts（内核直出样本分片，build:db --src 格式）。
 * 血缘：topics 是 analysis 内核在 518,400 样本上的预计算，生成即当前；
 *   旧链「内核 → 手工 vendor 进 toolkit → toolkit 生成语料」无同步，漂出「倪海夏」错字（2026-04-24，重导回退）。
 *   真相源收回主仓：五维键枚举 → generateChart + getTopicAnalysis 直跑 → 序列化。
 * 输出固定 samples-out（build:db 默认 --src），路径由常量派生：年份固定 1924–1983（sample-id 编码域），
 *   --from-year / --to-year 只过滤不进路径。格式同 toolkit samples-out/db-slim read_json：
 *   year-YYYY/YYYY-MM.jsonl.gz 每行 {birthInfo, chart, topics, system}：
 *   - birthInfo.hour = 时辰索引 0–11（语义非钟点）
 *   - chart 用导出口径字段名；宫名紧凑键（compactPalaceKey：交友宫→仆役），星曜 type soft→lucky、tough→sha
 *   - topics 13 列 = STORAGE_TOPIC_KEYS（study 是 career 别名视图，不另存列）
 * 分片可重算：整块算好 gzip 落盘（同 export-manual），中断留旧/缺片，重跑补齐。
 * @file 分片生成器
 */
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STORAGE_TOPIC_KEYS } from "../../scripts/analysis/data";
import { toShardChart } from "./shard-format";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/db
const SKILL_ROOT = resolve(HERE, "../..");
/** 输出目录固定（build:db 默认 --src 同址）；无 --out，写盘不受 CLI 影响。 */
const OUT = join(SKILL_ROOT, "samples-out");
/** 年域常量：sample-id 五维编码域（1924–1983），路径段只从它派生。 */
const YEAR_MIN = 1924;
const YEAR_MAX = 1983;

// 相对导入（tools/ 不走 @/ 别名），与 export-manual.ts 同款
const { generateChart } = await import("../../scripts/algorithm");
const { getTopicAnalysis } = await import("../../scripts/analysis");

// 参数：仅年段过滤、值域校验，不进路径
const argv = process.argv.slice(2);
/** 取 `--name=value` 参数值；缺省返回 fallback。 */
const getArg = (name: string, fallback: string): string =>
	argv.find(a => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const fromYear = Number(getArg("from-year", String(YEAR_MIN)));
const toYear = Number(getArg("to-year", String(YEAR_MAX)));
if (
	!Number.isInteger(fromYear) ||
	!Number.isInteger(toYear) ||
	fromYear < YEAR_MIN ||
	toYear > YEAR_MAX ||
	fromYear > toYear
) {
	throw new Error(`--from-year/--to-year 应为 ${YEAR_MIN}–${YEAR_MAX} 内的整数年段`);
}

// chart → 导出口径映射在 ./shard-format（与 tar-source 共用序列化单点）

// 主循环：年（常量域遍历+过滤）→ 月分片（30 日 × 12 时辰 × 2 性别 = 720 行/片）
const t0 = Date.now();
let shardCount = 0;
for (let year = YEAR_MIN; year <= YEAR_MAX; year++) {
	if (year < fromYear || year > toYear) {
		continue;
	}
	const yearDir = join(OUT, `year-${year}`);
	mkdirSync(yearDir, { recursive: true });
	for (let month = 1; month <= 12; month++) {
		const lines: string[] = [];
		for (let day = 1; day <= 30; day++) {
			for (let hour = 0; hour <= 11; hour++) {
				for (const gender of ["male", "female"] as const) {
					const birthInfo = { year, month, day, hour, gender, longitude: 120 };
					const chart = generateChart({
						year,
						month,
						day,
						timeIndex: hour,
						gender,
						longitude: 120,
					});
					const topics: Record<string, string> = {};
					for (const t of STORAGE_TOPIC_KEYS) {
						topics[t] = getTopicAnalysis(chart, t, { view: "mingpan" });
					}
					lines.push(
						JSON.stringify({
							birthInfo,
							chart: toShardChart(chart, birthInfo),
							topics,
							system: "倪海厦紫微斗数",
						})
					);
				}
			}
		}
		const file = join(yearDir, `${year}-${String(month).padStart(2, "0")}.jsonl.gz`);
		writeFileSync(file, gzipSync(Buffer.from(lines.join("\n") + "\n")));
		shardCount++;
		console.error(
			`[${shardCount}] ${file.slice(OUT.length + 1)}：720 样本，累计 ${((Date.now() - t0) / 1000).toFixed(0)}s`
		);
	}
}
console.error(
	`生成完成：${fromYear}–${toYear} 共 ${shardCount} 分片（${shardCount * 720} 样本），耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`
);
