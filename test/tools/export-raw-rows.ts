#!/usr/bin/env node
// ── 从样本数据集导出**真实行**，作为 rowsToSample 的 CI 基准 ──
//
// 手动执行（重建 fixtures 或首次启用时）：
//   node test/tools/export-raw-rows.ts
//
// ## 它补的是哪条缝
//
// `rowsToSample`（真实行 → BaselineSample）是重建链路的关键一步，但它此前**只在本机、
// 用完整语料**验过（`verify-source.ts` 逐字节互验，要 5.5 GB 的 reference/ 语料）。
// `npm test` 里跑的是 `sample-source.test.ts` 的**合成行** —— 而合成行编码的是
// 「我以为真实行长什么样」：列名、类型、数组形状一变，合成行照旧通过。
// 更隐晦的是 `hasSiHuaKey` 那条规则（键的存在性 vs 值为 `""`）—— 文件头自己写着
// 「搞错了 npm test 也不会红」。
//
// 本脚本把一小片真实行固化进 `test/fixtures/raw-rows.json`，于是 CI 里能断言：
//
//     rowsToSample(真实行) === charts.jsonl 里那一条的原文    （逐字节）
//
// 输入是真实行、答案是 fixtures —— 两者都在仓库里，`npm test` 不碰数据集。
//
// ## 产物形状：原样存，不拆列
//
// 每条 = 一条 JOIN 行的 12 份（samples 列 + palaces 列混在一起），**与 `fetchSample`
// 喂给 `rowsToSample` 的入参逐字同形**：它传的就是 `rowsToSample(first, rows)`。
// 刻意**不**拆成 {sample, palaces} 两个对象 —— 拆就要在脚本里列一遍列名，而那份清单
// 是 `SampleRow` / `PalaceRow` 两个接口的第三份副本。原样存则零副本：`rowsToSample`
// 只读它要用的列，多余列（含 `sample_id`）不影响。
//
// ⚠️ `sample_id` 在 JS 侧是 BigInt，而 `JSON.stringify` **遇到 BigInt 直接抛错**。
//    导出时统一 `Number()` 归一（映射不读这一列，归一不影响任何断言）。
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COLUMNS, closeSource, openSource, SourceError } from "../lib/sample-source.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)); // <skill 根>/test/tools
const FIX_DIR = resolve(HERE, "../fixtures");

/** charts.jsonl 的一行（只声明挑选用得上的字段，其余不解析）。 */
interface FixtureLine {
	birthInfo: { year: number; month: number; day: number; hour: number; gender: string };
	chart: {
		lunarInfo: { isLeapMonth: boolean };
		palaces: Array<{ stars: Array<{ name: string; siHua?: string }> }>;
	};
}

/** 产物的一个条目：挑选理由 + 12 行 JOIN 行。 */
interface RawEntry {
	/** 为什么挑它 —— 写进产物，让人看得出这一片的覆盖意图 */
	why: string;
	rows: Array<Record<string, unknown>>;
}

/**
 * 从 charts.jsonl 按特征挑样本。找不到即抛错，不静默少导。
 *
 * ⚠️ **每条特征各占一个样本**（已挑走的不再参与后续挑选）。少了这层去重，前几个特征
 *    会全部落在同一条样本上 —— 实测「首条 / 天钺 / 真四化」都指向 1924-1-1，
 *    四条产物缩水成两条，覆盖面白丢一半。
 */
function pickSamples(parsed: FixtureLine[]): Array<{ why: string; line: FixtureLine }> {
	const taken = new Set<string>();
	const keyOf = (f: FixtureLine): string => {
		const b = f.birthInfo;
		return `${b.year}-${b.month}-${b.day}-${b.hour}-${b.gender}`;
	};
	const firstWhere = (pred: (f: FixtureLine) => boolean, why: string): FixtureLine => {
		const found = parsed.find(f => !taken.has(keyOf(f)) && pred(f));
		if (!found) {
			throw new Error(`charts.jsonl 里找不到（未被前几条挑走的）「${why}」样本 —— 挑选规则已失效`);
		}
		taken.add(keyOf(found));
		return found;
	};
	const hasStar = (name: string) => (f: FixtureLine) =>
		f.chart.palaces.some(p => p.stars.some(s => s.name === name));

	return [
		// 每条都对着一个具体的失效模式，不是「多导几条保险」：
		{ why: "首条：兜底，保证产物永不为空", line: firstWhere(() => true, "首条") },
		{
			why: "闰月：is_leap_month 为 true，农历月序与常规不同",
			line: firstWhere(f => f.chart.lunarInfo.isLeapMonth, "闰月"),
		},
		{
			why: "天钺：恒无 siHua 键的辅星，盯 hasSiHuaKey 的「整键缺失」一侧",
			line: firstWhere(hasStar("天钺"), "天钺"),
		},
		{
			why: "真四化：有星曜带非空 siHua，盯同一规则的另一侧",
			line: firstWhere(f => f.chart.palaces.some(p => p.stars.some(s => s.siHua)), "四化"),
		},
	];
}

async function main(): Promise<void> {
	const lines = readFileSync(resolve(FIX_DIR, "charts.jsonl"), "utf8").trim().split("\n");
	const parsed = lines.map(l => JSON.parse(l) as FixtureLine);
	const picked = pickSamples(parsed);

	const conn = await openSource().catch((err: unknown) => {
		// 数据源不可用时 err.message 已是完整指引，不要拿堆栈把它埋了
		if (err instanceof SourceError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	});
	const out: RawEntry[] = [];
	for (const { why, line } of picked) {
		const b = line.birthInfo;
		const reader = await conn.runAndReadAll(
			`SELECT ${COLUMNS} FROM samples s JOIN palaces p USING (sample_id)
			 WHERE s.year = ? AND s.month = ? AND s.day = ? AND s.hour = ? AND s.gender = ?
			 ORDER BY (p.branch + 10) % 12`,
			[b.year, b.month, b.day, b.hour, b.gender]
		);
		const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;
		// 形状守卫：与运行时同一判据 —— 不是 12 行，产物就是残缺的，宁可现在就炸
		if (rows.length !== 12) {
			throw new SourceError(
				`${b.year}-${b.month}-${b.day} 时辰${b.hour}（${b.gender}）取到 ${rows.length} 行宫位，预期 12 行`
			);
		}
		// BigInt 不能被 JSON.stringify 序列化，统一归一（映射不读这一列）
		out.push({ why, rows: rows.map(r => ({ ...r, sample_id: Number(r.sample_id) })) });
		console.log(`  ✓ ${why} → ${b.year}-${b.month}-${b.day} 时辰${b.hour} ${b.gender}`);
	}

	writeFileSync(resolve(FIX_DIR, "raw-rows.json"), JSON.stringify(out, null, "\t") + "\n", "utf8");
	const bytes = readFileSync(resolve(FIX_DIR, "raw-rows.json")).length;
	console.log(
		`已写出 ${out.length} 条真实样本行 → test/fixtures/raw-rows.json（${(bytes / 1024).toFixed(0)} KiB）`
	);
	console.log("现在跑 npm test：sample-source.test.ts 会拿它逐字节复现 charts.jsonl");
	closeSource();
}

// 仅直接执行才跑 —— Node 的默认测试文件识别模式含 test/**/*，没有这道守卫时
// `node --test test/` 会把它当测试文件执行（同 tools/ 下其余脚本）。
const isDirectRun =
	process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
