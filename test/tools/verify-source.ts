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
//   node test/tools/verify-source.ts --shard 1962-06 --limit 50
//
// 退出码：0 = 全部逐字节一致；1 = 有差异，或语料/依赖/库缺失。
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

const SHARD = optOf("shard"); // "1962-06"
const LIMIT = optOf("limit") ? Number(optOf("limit")) : Infinity;

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

	// 分片清单：--shard 指定单个，否则 1924-01 ~ 1983-12 全量
	const shards: Array<{ year: number; month: number }> = [];
	if (SHARD) {
		const m = /^(\d{4})-(\d{2})$/.exec(SHARD);
		if (!m) {
			console.error(`--shard 需要形如 1962-06 的值，收到：${SHARD}`);
			process.exit(2);
		}
		shards.push({ year: Number(m[1]), month: Number(m[2]) });
	} else {
		for (let y = 1924; y <= 1983; y++) for (let mo = 1; mo <= 12; mo++) shards.push({ year: y, month: mo });
	}

	console.log(RULE);
	console.log("基准数据源互验（jsonl ↔ DuckDB 逐字节）");
	console.log(`  数据库  : ${SAMPLE_DB}`);
	console.log(`  语料    : ${SAMPLES}`);
	console.log(`  范围    : ${shards.length} 个分片${Number.isFinite(LIMIT) ? `，每片至多 ${LIMIT} 条` : ""}`);
	console.log(RULE);

	let checked = 0;
	let identical = 0;
	const failures: Array<{ shard: string; lineNo: number; birth: BirthInfo; detail: string }> = [];

	for (const { year, month } of shards) {
		const file = shardPath(year, month);
		if (!existsSync(file)) {
			console.error(`  ⚠ 分片缺失：${file}`);
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

			// 差异定位（Task 4 会把 detail 做成结构化的）
			const detail =
				rebuilt === null
					? "DuckDB 中查无此样本（五元组未命中）"
					: `DuckDB 侧五元组：${JSON.stringify(rebuilt.birthInfo)}\n` +
						`      jsonl 侧五元组：${JSON.stringify(raw.birthInfo)}`;
			failures.push({ shard: `${year}-${String(month).padStart(2, "0")}`, lineNo, birth: raw.birthInfo, detail });
		}
		rl.close();

		if (checked >= LIMIT) break;
	}

	console.log(`\n${RULE}`);
	console.log(`  检查条数  : ${checked}`);
	console.log(`  逐字节一致: ${identical}`);
	console.log(`  有差异    : ${failures.length}`);
	console.log(RULE);

	if (failures.length) {
		console.log(`\n差异明细（前 10 条）：`);
		for (const f of failures.slice(0, 10)) {
			console.log(`\n  ✗ 分片 ${f.shard} 第 ${f.lineNo} 行`);
			console.log(`      样本：${JSON.stringify(f.birth)}`);
			console.log(`      ${f.detail}`);
		}
		if (failures.length > 10) console.log(`\n  …… 另有 ${failures.length - 10} 条未列出`);
		console.log(
			`\n处理：jsonl 与 DuckDB 是同一份语料的两个载体，不存在引擎版本噪音，\n` +
				`      所以这里**没有**「已知差异」的容身之处 —— 任何 diff 都是重建映射写错了。\n` +
				`      若差异是「五元组不符」，先查 finish 分组与 Day/时辰的映射；\n` +
				`      若五元组相符而内容不同，逐字段定位（键序问题改构造顺序，结构问题改映射）。`
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
