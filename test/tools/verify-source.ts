#!/usr/bin/env node
// ── 互验：jsonl 语料 ↔ DuckDB 逐条比对 ──
//
// 本次改造的主要验收手段。它回答一个别人替不了的问题：**从关系表重建出的样本，
// 与 jsonl 里那一行，是不是逐字节相同？**
//
// 为什么非要有它：本次映射里有多处隐晦约定（siHua 键的存在性、星曜四段顺序、宫位顺序、
// chart.birthInfo 的存在），它们**全都不影响 npm test 的结果** —— 比对器或按名索引、
// 或做了空值归一化。只有字节级比对能兜住。
//
// 取样本时刻意**不用下标算址**。旧 build-fixtures.ts 的 pickFrom 用
// `idx = (day-1)*24 + hour*2 + genderIdx`，隐含「每月每天都齐 24 条」的假设；
// 互验若沿用它，就继承了待验证的假设。这里改为：读 jsonl 的一行 → 取它的出生五元组 →
// 拿这个五元组向 DuckDB 查同一条 → 逐字节比。于是「pickFrom 是否曾经错位」变成一个
// 可直接证实或证伪的问题：差异报告里会同时给出该行的**行号**与**旧公式算出的下标**。
//
// 用法（在 skill 根执行）：
//   node test/tools/verify-source.ts                       # 全量 720 个分片，约 2.3 小时
//   node test/tools/verify-source.ts --shard 1962-06       # 单个分片（720 条，秒级）
//   node test/tools/verify-source.ts --year 1924 --month 1 # 指定年/月（可只给其一）
//   node test/tools/verify-source.ts --limit 50 --quiet    # 全局至多 50 条 + 静默进度
//
// 退出码：0 = 全部逐字节一致；1 = 有差异，或语料**目录**缺失、依赖/库缺失；
//         2 = 参数写错（如 --shard 62-6）。「单个分片缺失」是警告不是失败，
//         见 summary 里的「未检查分片」行。
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/ziwei/types";
import type { BaselineSample } from "../lib/compare.ts";
import { fetchSample, openSource, closeSource, SourceError, SAMPLE_DB } from "../lib/sample-source.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/tools
const SKILL_ROOT = resolve(HERE, "../..");

/**
 * jsonl 语料目录。
 *
 * `ZIWEI_SAMPLES` 环境变量可覆盖 —— 这个缝**只为验证「语料缺失」那条错误分支可达**
 * （Step 5 会指向一个不存在的路径）。CLI 引导层的 `pickRoot()` 也是这个套路
 * （`ZIWEI_ROOT` 优先），保持一致。
 */
const SAMPLES = process.env.ZIWEI_SAMPLES ?? resolve(SKILL_ROOT, "reference/ziwei-samples-toolkit/samples-out");

const RULE = "─".repeat(46);

// ── 参数 ──
const argv = process.argv.slice(2);
const optOf = (name: string): string | null => {
	const i = argv.indexOf(`--${name}`);
	if (i < 0) return null;
	const v = argv[i + 1];
	return v && !v.startsWith("--") ? v : null;
};

const SHARD = optOf("shard"); // "1962-06"，与 --year/--month 互斥
const YEAR = optOf("year") ? Number(optOf("year")) : null;
const MONTH = optOf("month") ? Number(optOf("month")) : null;
const LIMIT = optOf("limit") ? Number(optOf("limit")) : Infinity;
const QUIET = argv.includes("--quiet");

function shardPath(year: number, month: number): string {
	return resolve(SAMPLES, `year-${year}`, `${year}-${String(month).padStart(2, "0")}.jsonl.gz`);
}

/**
 * 把 jsonl 的一行裁剪成基准样本。
 *
 * 与 `build-fixtures.ts` 写盘时的裁剪规则**必须一致**：顶层只留 `birthInfo` 与 `chart`。
 * 样本的 `topics`（13 主题解读文本）占单条体积 90%，且由 toolkit 私有的 db-analysis.ts
 * 生成，本项目刻意不含该文件 —— 基准与互验两侧都剔除它才比得起来。
 */
function trim(raw: { birthInfo: BirthInfo; chart: unknown }): BaselineSample {
	return { birthInfo: raw.birthInfo, chart: raw.chart } as BaselineSample;
}

/** 递归按 key 排序的规范 JSON —— 用来判定「差异是否**只是键序**」。 */
function canonical(v: unknown): unknown {
	if (Array.isArray(v)) return v.map(canonical);
	if (v && typeof v === "object") {
		const o = v as Record<string, unknown>;
		return Object.fromEntries(Object.keys(o).sort().map(k => [k, canonical(o[k])]));
	}
	return v;
}

/** 逐字段找第一处不同，返回 `路径 = 基准 / 实际`（找不到返回 null）。 */
function firstStructuralDiff(a: unknown, b: unknown, path = ""): string | null {
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return `${path} = ${JSON.stringify(a)} / ${JSON.stringify(b)}`;
		if (a.length !== b.length) return `${path}.length = ${a.length} / ${b.length}`;
		for (let i = 0; i < a.length; i++) {
			const d = firstStructuralDiff(a[i], b[i], `${path}[${i}]`);
			if (d) return d;
		}
		return null;
	}
	if (a && b && typeof a === "object" && typeof b === "object") {
		const ao = a as Record<string, unknown>;
		const bo = b as Record<string, unknown>;
		for (const k of Object.keys(ao)) if (!(k in bo)) return `${path}.${k} = 存在 / **缺失**`;
		for (const k of Object.keys(bo)) if (!(k in ao)) return `${path}.${k} = **缺失** / 存在`;
		for (const k of Object.keys(ao)) {
			const d = firstStructuralDiff(ao[k], bo[k], `${path}.${k}`);
			if (d) return d;
		}
		return null;
	}
	return a === b ? null : `${path} = ${JSON.stringify(a)} / ${JSON.stringify(b)}`;
}

type DiffKind = "五元组不符" | "键序不同" | "结构不同";

/** 判定两侧差异属于哪一类。 */
function classify(want: unknown, got: unknown): { kind: DiffKind; detail: string } {
	if (JSON.stringify(canonical(want)) === JSON.stringify(canonical(got))) {
		return { kind: "键序不同", detail: `逐字段值相同，但键的插入顺序不同（改重建侧的构造顺序）` };
	}
	return { kind: "结构不同", detail: firstStructuralDiff(want, got) ?? "（未定位到具体字段）" };
}

async function main(): Promise<void> {
	if (!existsSync(SAMPLES)) {
		console.error(
			`找不到 jsonl 语料：${SAMPLES}\n` +
				`  它是 5.5 GB 的只读语料（720 个 jsonl.gz / 60 个年份目录），不入版本控制。\n` +
				`  只有**本互验工具**需要它 —— 重建 fixtures 与全量核验都不需要。\n` +
				`  日常回归更不需要：跑 npm test 即可，fixtures 已入库。`
		);
		process.exit(1);
	}

	try {
		await openSource();
	} catch (err) {
		if (err instanceof SourceError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	}

	// 分片清单：--shard 单个 > --year/--month > 全量 1924-01 ~ 1983-12
	const shards: Array<{ year: number; month: number }> = [];
	if (SHARD) {
		const m = /^(\d{4})-(\d{2})$/.exec(SHARD);
		if (!m) {
			console.error(`--shard 需要形如 1962-06 的值，收到：${SHARD}`);
			process.exit(2);
		}
		shards.push({ year: Number(m[1]), month: Number(m[2]) });
	} else {
		const years = YEAR ? [YEAR] : Array.from({ length: 60 }, (_, i) => 1924 + i);
		const months = MONTH ? [MONTH] : Array.from({ length: 12 }, (_, i) => i + 1);
		for (const y of years) for (const mo of months) shards.push({ year: y, month: mo });
	}

	console.log(RULE);
	console.log("基准数据源互验（jsonl ↔ DuckDB 逐字节）");
	console.log(`  数据库  : ${SAMPLE_DB}`);
	console.log(`  语料    : ${SAMPLES}`);
	console.log(`  范围    : ${shards.length} 个分片${Number.isFinite(LIMIT) ? `，全局至多 ${LIMIT} 条` : ""}`);
	console.log(RULE);

	let checked = 0;
	let identical = 0;
	let skippedShards = 0;
	const buckets = new Map<string, number>();
	const failures: Array<{
		shard: string;
		lineNo: number;
		birth: BirthInfo;
		kind: string;
		detail: string;
		legacyIdx: number;
		aligned: boolean;
	}> = [];

	for (const { year, month } of shards) {
		const file = shardPath(year, month);
		if (!existsSync(file)) {
			console.error(`  ⚠ 分片缺失：${file}`);
			skippedShards++;
			continue;
		}

		let lineNo = 0;
		const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
		for await (const line of rl) {
			if (!line.trim()) continue;
			lineNo++;
			if (checked >= LIMIT) break;

			const raw = JSON.parse(line) as { birthInfo: BirthInfo; chart: unknown };
			const rebuilt = await fetchSample(raw.birthInfo);
			checked++;

			const want = JSON.stringify(trim(raw));
			const got = rebuilt === null ? null : JSON.stringify(rebuilt);

			if (got === want) {
				identical++;
				continue;
			}

			// ── 差异分类 ──
			// 问「五元组是否相符」优先于问「内容哪里不同」：不符说明取错了样本，
			// 后面逐字段比毫无意义（且这正是旧 pickFrom 下标算址错位会表现出的样子）。
			const sameKey =
				rebuilt !== null &&
				rebuilt.birthInfo.year === raw.birthInfo.year &&
				rebuilt.birthInfo.month === raw.birthInfo.month &&
				rebuilt.birthInfo.day === raw.birthInfo.day &&
				rebuilt.birthInfo.hour === raw.birthInfo.hour &&
				rebuilt.birthInfo.gender === raw.birthInfo.gender;

			// 旧 pickFrom 的公式：仅供诊断，**不参与取数**。
			// 行号与它算出的下标不一致 = 旧实现曾经错位取数的直接证据。
			const legacyIdx =
				(raw.birthInfo.day - 1) * 24 + raw.birthInfo.hour * 2 + (raw.birthInfo.gender === "female" ? 1 : 0);

			let kind: DiffKind | "查无此样本";
			let detail: string;
			if (rebuilt === null) {
				kind = "查无此样本";
				detail = `DuckDB 中五元组未命中`;
			} else if (!sameKey) {
				kind = "五元组不符";
				detail =
					`DuckDB 侧五元组 ${JSON.stringify(rebuilt.birthInfo)}\n` +
					`      jsonl 侧五元组 ${JSON.stringify(raw.birthInfo)}`;
			} else {
				const c = classify(trim(raw), rebuilt);
				kind = c.kind;
				detail = c.detail;
			}

			buckets.set(kind, (buckets.get(kind) ?? 0) + 1);
			failures.push({
				shard: `${year}-${String(month).padStart(2, "0")}`,
				lineNo,
				birth: raw.birthInfo,
				kind,
				detail,
				legacyIdx,
				aligned: legacyIdx === lineNo - 1,
			});
		}
		rl.close();

		if (!QUIET) {
			process.stderr.write(`  分片 ${year}-${String(month).padStart(2, "0")} 完成（累计 ${checked} 条）\n`);
		}

		if (checked >= LIMIT) break;
	}

	console.log(`\n${RULE}`);
	console.log(`  检查条数  : ${checked}`);
	console.log(`  逐字节一致: ${identical}`);
	console.log(`  有差异    : ${failures.length}`);
	if (skippedShards > 0) {
		console.log(`  未检查分片: ${skippedShards}   ⚠ 这些分片未被核验，上面的「一致/差异」不含它们`);
	}
	console.log(RULE);

	if (failures.length) {
		console.log(`\n按类型分桶：`);
		for (const [k, n] of [...buckets].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12, "　")} ${n}`);

		console.log(`\n差异明细（前 10 条）：`);
		for (const f of failures.slice(0, 10)) {
			console.log(`\n  ✗ [${f.kind}] 分片 ${f.shard} 第 ${f.lineNo} 行（该行在分片内下标 ${f.lineNo - 1}）`);
			console.log(`      样本：${JSON.stringify(f.birth)}`);
			console.log(`      ${f.detail}`);
			console.log(
				`      旧 pickFrom 公式算出的下标：${f.legacyIdx}` +
					(f.aligned ? "（与本行位置一致）" : "（**与本行位置不一致** —— 旧实现曾经错位取数）")
			);
		}
		if (failures.length > 10) console.log(`\n  …… 另有 ${failures.length - 10} 条未列出`);
		console.log(
			`\n处理（按 spec 第五节的顺序）：\n` +
				`  1. 「键序不同」→ 改 test/lib/sample-source.ts 里重建对象的键插入顺序\n` +
				`  2. 「五元组不符」或「查无此样本」→ 先查取数路径，再看旧 pickFrom 是否曾经错位\n` +
				`  3. 「结构不同」→ 逐字段定位，改映射\n` +
				`  ⚠️ jsonl 与 DuckDB 是同一份语料的两个载体，不存在引擎版本噪音，\n` +
				`     所以这里**没有**「已知差异」的容身之处 —— 任何 diff 都是映射写错了。\n` +
				`  ⚠️ **不得**直接把新结果覆盖上去当基准：基准是负债还是保障，取决于它有没有被审阅过。`
		);
	}

	closeSource();
	process.exit(failures.length > 0 ? 1 : 0);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
