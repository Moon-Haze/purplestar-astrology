/**
 * 518k 分片生成器 —— 用**本仓当前内核**直出样本语料分片（build:db 的 --src 消费格式）。
 *
 *   npx tsx tools/db/generate-shards.ts                                  # 全量 1924–1983（单线程约 3 小时）
 *   npx tsx tools/db/generate-shards.ts --from-year=1924 --to-year=1933   # 分段并行（6 段约 29 分钟/段）
 *
 * 血缘（重要）：topics 文本是本仓 analysis 内核在 518,400 设计样本上的预计算产物，
 * **生成即当前**——此前的链路是「内核 → 手工 vendor 进 toolkit → toolkit 生成语料」，
 * 副本无同步机制、半年漂移出「倪海夏」错字一代（2026-04-24 快照，重导即内容回退）。
 * 本生成器把内容真相源收回主仓：五维键空间枚举 → generateChart + getTopicAnalysis
 * 直跑 → 序列化成既有导出格式。排盘事实部分与 toolkit 生成器同源同口径。
 *
 * 输出目录**固定**为 <仓库根>/samples-out（build:db 的默认 --src，主仓自产自销）。
 * 写盘路径全部由常量派生：年份遍历固定走 1924–1983 常量域（sample-id 编码域），
 * --from-year / --to-year 只做**过滤**不进路径。格式与 toolkit samples-out /
 * db-slim read_json 契约逐字一致：
 *   year-YYYY/YYYY-MM.jsonl.gz，每行 {birthInfo, chart, topics, system}，其中
 *
 * 结构化第二产出（structure-analysis-outputs）：每行另含 `items` 字段 ——
 * `getTopicAnalysisItems` 的 13 主题条目流（{topic, items}），**已过滤**
 * `kind === "head"` 与空行条目（渲染面专属，不入数据面）。时钟依赖条目保留
 * `clockDependent` 标记随行携带，由消费端（build-duckdb 入库）排除——标记在
 * 源头、排除在消费，比导出时静默丢弃可见。
 *   - birthInfo.hour = **时辰索引 0–11**（导出口径的字段名，语义非钟点）
 *   - chart 用导出口径字段名（mingGongBranch/siHua/daXianAge/isMingGong…），
 *     宫名为**紧凑键**（compactPalaceKey：交友宫→仆役），星曜 type soft→lucky、tough→sha
 *   - topics 13 列 = STORAGE_TOPIC_KEYS（study 是 career 别名视图，不另存列）
 * 分片是可整片重算的再生 artifacts：每片在内存整块算好、gzip 后一次落盘
 * （与 export-manual 的写法同款），中断只留旧片或缺片，重跑该年段即补齐。
 */
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STORAGE_TOPIC_KEYS } from "../../scripts/analysis/data";
import { toShardChart } from "./shard-format";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/db
const SKILL_ROOT = resolve(HERE, "../..");
/** 输出目录固定（build:db 默认 --src 同址）；不提供 --out，写盘路径不受 CLI 影响。 */
const OUT = join(SKILL_ROOT, "samples-out");
/** 年域常量：sample-id 五维编码域（1924–1983），路径段只从它派生。 */
const YEAR_MIN = 1924;
const YEAR_MAX = 1983;

// 相对导入（tools/ 不走 @/ 别名），与 export-manual.ts 同款
const { generateChart } = await import("../../scripts/algorithm");
const { getTopicAnalysis, getTopicAnalysisItems } = await import("../../scripts/analysis");

// ── 参数（仅年段过滤，值域校验，不进路径）───────────────────────────────────
const argv = process.argv.slice(2);
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

// ── 本仓 chart → 导出口径的映射在 ./shard-format（与 tar-source 共用的序列化单点）──

// ── 主循环：年（常量域遍历 + 过滤）→ 月分片（30 日 × 12 时辰 × 2 性别 = 720 行/片）
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
					const structured: Array<{ topic: string; items: unknown[] }> = [];
					for (const t of STORAGE_TOPIC_KEYS) {
						topics[t] = getTopicAnalysis(chart, t, { view: "mingpan" });
						const its = getTopicAnalysisItems(chart, t, { view: "mingpan" });
						if (typeof its !== "string") {
							structured.push({
								topic: t,
								items: its.filter(it => it.kind !== "head" && it.text !== ""),
							});
						}
					}
					lines.push(
						JSON.stringify({
							birthInfo,
							chart: toShardChart(chart, birthInfo),
							topics,
							items: structured,
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
