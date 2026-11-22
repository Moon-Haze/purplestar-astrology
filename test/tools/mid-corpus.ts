#!/usr/bin/env node
/**
 * @file parquet 数据集的等距抽样中档排盘回归工具。
 */
// ── 中档回归：流式读 db/dataset，跑与层 1 同源的基准比对（手动 / CI 可选入口）──
//
// 定位：`npm test`（fixtures 385 条，秒级）与 `npm run test:corpus`（全量，条数自报）之间的
// **按需中档**——linspace 等距确定性抽样（不用随机数），跨数据集年份范围铺开：
//
//   npm run test:midcorpus -- --n 3000        # 默认三千量级，实测约 3 分钟
//   npm run test:midcorpus -- --n 500         # 更快的小档
//
// 三条设计口径（specs：quality-gates「parquet 中档快测」）：
//   · 比对面与层 1 **同一实现**（compare.ts 的 compareChart：同归一化、同
//     KNOWN_DIVERGENCES 白名单）——不存在第二套比对口径；
//   · **独立命令，不进 `npm test`**（日常回归不因此挂 DuckDB 原生依赖，时长不受拖累）；
//   · 环境缺失（无 `db/dataset` / DuckDB 不可用）→ 显式 SKIP 行 + **非零退出**
//     （「要求跑而环境不允许」不是成功；跳过必须看得见）。
//
// 开头内置一条 **fixtures 交叉核对**：取**第一条在数据集中存在**的基准样本走中档管线
// （parquet 取样 → generateChart → compareChart），结论必须与层 1 一致（零差异）
// ——「双档结论一致」由此钉住（两条链路各自得出「与基准一致」的同一结论）。
// 不写死取第几条：数据集年份范围随数据链演化（实测盘上为 1950–2026，fixtures 为
// 与数据集同范围（1950–2026），循环对数据集范围演化保持鲁棒），全部取不到即大声失败（基准与数据集彻底脱钩）。
//
// ⚠️ 抽样是**确定性的**：stride 按 `⌊样本总数 / N⌋` 取等距（总数现查不写死），同样的
//    输入必然产出同样的抽样面，覆盖维度随报告自报。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compareChart, formatDiffs, type BaselineSample } from "../lib/compare.ts";
import { loadAlgorithm } from "../lib/loader.ts";
import {
	closeSource,
	fetchSample,
	forEachSample,
	openSource,
	SourceError,
} from "../lib/sample-source.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)); // <仓库根>/test/tools

const N_DEFAULT = 3000;

/**
 * 解析 `--n <N>`（支持 `--n=3000` 与 `--n 3000` 两种形态）；非法值中文报错退出。
 *
 * @returns 抽样条数；`--n` 不是正整数时打印用法后 `process.exit(1)`
 */
function parseN(): number {
	const argv = process.argv.slice(2);
	const i = argv.indexOf("--n");
	if (i === -1) {
		return N_DEFAULT;
	}
	const raw = argv[i + 1] ?? argv[i]?.split("=")[1];
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) {
		console.error(
			`--n 需要正整数（实际：${String(raw)}）。用法：npm run test:midcorpus -- --n 3000`
		);
		process.exit(1);
	}
	return n;
}

/** 把出生信息渲染成用例标签。 */
const describeBirth = (b: BaselineSample["birthInfo"]): string =>
	`${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} ` +
	`时${b.timeIndex} ${b.gender}`;

/**
 * 中档回归入口：等距抽样后按层 1 同源口径比对。
 *
 * @returns 无返回值；数据源缺失或交叉核对失败时以非零码退出
 */
async function main(): Promise<void> {
	const n = parseN();

	// ── 打开数据源：环境缺失 = 显式 SKIP + 非零退出（SourceError 自带排查指引）──
	try {
		await openSource();
	} catch (err) {
		if (err instanceof SourceError) {
			console.error(`⏭ SKIP：中档回归未执行——${err.message}`);
			process.exit(1);
		}
		throw err;
	}

	const { generateChart } = await loadAlgorithm();
	const started = Date.now();

	// ── fixtures 交叉核对：第一条在数据集中存在的基准样本走中档管线 ──
	const fixtureSamples: BaselineSample[] = readFileSync(
		resolve(HERE, "../fixtures/charts.jsonl"),
		"utf8"
	)
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line) as BaselineSample);
	let fixture: BaselineSample | null = null;
	let viaParquet: BaselineSample | null = null;
	for (const s of fixtureSamples) {
		const via = await fetchSample({ ...s.birthInfo });
		if (via) {
			fixture = s;
			viaParquet = via;
			break;
		}
	}
	if (!fixture || !viaParquet) {
		console.error(
			`✖ 交叉核对失败：fixtures 全部 ${fixtureSamples.length} 条在 db/dataset 中都不存在——` +
				`基准与数据集彻底脱钩（数据集年份范围或内容被换过？），请先用 verify-source.ts 查清`
		);
		process.exit(1);
	}
	const cross = compareChart(generateChart({ ...fixture.birthInfo }), viaParquet.chart, {
		keepWhitelisted: true,
	}).filter(d => !d.whitelisted);
	if (cross.length) {
		console.error(
			`✖ 交叉核对失败：同一条样本，中档管线（parquet 取样）与层 1（fixtures）结论不一致——\n` +
				formatDiffs(cross, 10)
		);
		process.exit(1);
	}
	console.log(
		`  交叉核对通过：基准样本 ${describeBirth(fixture.birthInfo)}（fixtures 中第一条在数据集内存在）双档结论一致（零差异）`
	);

	// ── linspace 等距取样点：第 k 点 = round((k + 0.5) × total / n)（k=0..n−1）──
	// 总数现查不写死。刻意不用「固定步长 stride」：样本序存在日内周期（24 条/日），
	// 步长恰为周期因子时发生混叠——实测 stride=5624 时 121 条全是同一性别；
	// linspace 的间距在 ⌊total/n⌋ 与 ⌈total/n⌉ 间自然交替，相位被打散，且**不依赖
	// sample_id 的编码顺序假设**。流式计数器实现，取够 n 条即停（省去尾部扫描）。
	const conn = await openSource();
	const countReader = await conn.runAndReadAll("SELECT COUNT(*) AS total FROM samples");
	const total = Number((countReader.getRowObjectsJS()[0] as Record<string, unknown>).total);
	const goal = Math.min(n, total);
	/** 按等距抽样把序位映射到目标样例行号。 */
	const target = (k: number): number => Math.round(((k + 0.5) * total) / goal);

	// ── 流式取样 + 比对（与层 1 同一比对器）──
	let seen = 0;
	let picked = 0;
	let whitelistHits = 0;
	const failures: string[] = [];
	const years = new Set<number>();
	const genders = new Set<string>();
	const wuxing = new Set<string>();
	let leapCount = 0;

	await forEachSample({}, raw => {
		if (picked < goal && seen === target(picked)) {
			picked++;
			years.add(raw.birthInfo.year);
			genders.add(raw.birthInfo.gender);
			wuxing.add(raw.chart.fiveElementsClassName);
			if (raw.chart.lunarInfo?.isLeapMonth) {
				leapCount++;
			}
			const all = compareChart(generateChart({ ...raw.birthInfo }), raw.chart, {
				keepWhitelisted: true,
			});
			whitelistHits += all.filter(d => !d.whitelisted).length;
			const diffs = all.filter(d => !d.whitelisted);
			if (diffs.length) {
				failures.push(`${describeBirth(raw.birthInfo)}\n${formatDiffs(diffs, 5)}`);
			}
		}
		seen++;
		return picked < goal; // 取够即停
	});

	closeSource();

	// ── 报告：计数全部自报，耗时实测 ──
	const seconds = ((Date.now() - started) / 1000).toFixed(1);
	console.log(`\n中档回归（linspace 等距取样，样本总数 ${total}，目标 ${goal} 条）：`);
	console.log(
		`  抽样 ${picked} 条 · 覆盖 ${years.size} 年 / ${genders.size} 性别 / ${wuxing.size} 五行局 / 闰月样本 ${leapCount} 条`
	);
	console.log(
		`  白名单命中 ${whitelistHits} 处 · 比对失败 ${failures.length} 条 · 耗时 ${seconds}s`
	);

	if (failures.length) {
		console.error(`\n✖ ${failures.length} 条与 db/dataset 基准不符（白名单外）：`);
		for (const f of failures.slice(0, 10)) {
			console.error(`  ${f}`);
		}
		if (failures.length > 10) {
			console.error(`  …… 另有 ${failures.length - 10} 条未列出`);
		}
		process.exit(1);
	}
	if (picked < 1) {
		console.error("✖ 抽样为 0 条（stride 大于样本总数？）——检查 --n 与数据集");
		process.exit(1);
	}
}

// ── 仅直接执行才跑 main ──
// Node 的默认测试文件识别模式包含 `test/**/*`。若不加这道守卫，`node --test test/`
// 可能把会连库的脚本当成测试文件执行。与 build-fixtures.ts 同款双重保险。
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
