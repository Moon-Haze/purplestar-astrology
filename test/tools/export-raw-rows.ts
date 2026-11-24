#!/usr/bin/env node
/**
 * @file 导出真实数据库行作为 rowsToSample 回归基准的工具。
 */
// 手动：node test/tools/export-raw-rows.ts
// ## 补的缝
// `rowsToSample`（真实行→BaselineSample）此前只在本机用完整语料验过
// （`verify-source.ts` 逐字节互验，5.5GB reference/）；`npm test` 跑 `sample-source.test.ts`
// 合成行编码「我以为真实行长什么样」：列名/类型/数组一变仍照过。
// 更隐晦的是 `hasMutagenKey`（键存在 vs 值 `""`）—— 文件头自写「搞错了 npm test 也不会红」。
// 固化真实行进 `test/fixtures/raw-rows.json`，CI 断言：
//   rowsToSample(真实行) === charts.jsonl 那条原文  （逐字节）
// 输入/答案（fixtures）均在仓库，`npm test` 不碰数据集。
// ## 产物形状：原样存不拆列
// 每条 = JOIN 行的 12 份（samples+palaces 列混排），与 `fetchSample` 入参同形
// （即 `rowsToSample(first, rows)`）。
// 不拆 {sample, palaces}：拆就得列名，成 `SampleRow` / `PalaceRow` 第三副本；原样存零副本，
// 只读要用的列，多余列（含 `sample_id`）无影响。
// ⚠️ `sample_id` 是 BigInt，`JSON.stringify` 遇即抛；统一 `Number()` 归一（不影响断言）。
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COLUMNS, closeSource, openSource, SourceError } from "../lib/sample-source.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)); // <skill 根>/test/tools
const FIX_DIR = resolve(HERE, "../fixtures");

/** charts.jsonl 一行（只声明要用字段） */
interface FixtureLine {
	/** 出生信息（`pickSamples` 键与判据五字段） */
	birthInfo: { year: number; month: number; day: number; timeIndex: number; gender: string };
	/** 基准盘（只取「闰月」「天钺 / 真四化」两组特征字段） */
	chart: {
		lunarInfo: { isLeapMonth: boolean };
		palaces: Array<{ stars: Array<{ name: string; mutagen?: string }> }>;
	};
}

/** 产物条目：理由 + 12 行 JOIN */
interface RawEntry {
	/** 挑选理由，写进产物示覆盖意图 */
	why: string;
	/** 12 行真实 JOIN（列集由 `COLUMNS` 定） */
	rows: Array<Record<string, unknown>>;
}

/**
 * 从 charts.jsonl 按特征挑样本，找不到即抛错，不静默少导。
 * ⚠️ 每条特征各占一样本（挑走的不参与后续），无去重则前几条落同一样本 ——
 * 实测「首条 / 天钺 / 真四化」都指向 1924-1-1，四条缩水成两条。
 * @param parsed - charts.jsonl 全部行
 * @returns 按特征挑出的样本，各占一条
 * @throws {Error} 某特征在剩余 fixture 行里无匹配
 */
function pickSamples(parsed: FixtureLine[]): Array<{ why: string; line: FixtureLine }> {
	const taken = new Set<string>();
	/** 出生五元组作唯一键 */
	const keyOf = (f: FixtureLine): string => {
		const b = f.birthInfo;
		return `${b.year}-${b.month}-${b.day}-${b.timeIndex}-${b.gender}`;
	};
	/** 取首条满足条件的行；否则报错说明原因 */
	const firstWhere = (pred: (f: FixtureLine) => boolean, why: string): FixtureLine => {
		const found = parsed.find(f => !taken.has(keyOf(f)) && pred(f));
		if (!found) {
			throw new Error(
				`charts.jsonl 里找不到（未被前几条挑走的）「${why}」样本 —— 挑选规则已失效`
			);
		}
		taken.add(keyOf(found));
		return found;
	};
	/** 构造：判断行是否含指定星名 */
	const hasStar = (name: string) => (f: FixtureLine) =>
		f.chart.palaces.some(p => p.stars.some(s => s.name === name));

	return [
		// 每条对一个具体失效模式，非「多导几条保险」：
		{ why: "首条：兜底，保证产物永不为空", line: firstWhere(() => true, "首条") },
		{
			why: "闰月：is_leap_month 为 true，农历月序与常规不同",
			line: firstWhere(f => f.chart.lunarInfo.isLeapMonth, "闰月"),
		},
		{
			why: "天钺：恒无 mutagen 键的辅星，盯 hasMutagenKey 的「整键缺失」一侧",
			line: firstWhere(hasStar("天钺"), "天钺"),
		},
		{
			why: "真四化：有星曜带非空 mutagen，盯同一规则的另一侧",
			line: firstWhere(f => f.chart.palaces.some(p => p.stars.some(s => s.mutagen)), "四化"),
		},
	];
}

/**
 * 导出入口：挑代表性真实行写入 fixtures。
 * @returns 无；写出 `test/fixtures/raw-rows.json` 后关闭
 */
async function main(): Promise<void> {
	const lines = readFileSync(resolve(FIX_DIR, "charts.jsonl"), "utf8").trim().split("\n");
	const parsed = lines.map(l => JSON.parse(l) as FixtureLine);
	const picked = pickSamples(parsed);

	const conn = await openSource().catch((err: unknown) => {
		// 数据源不可用时 err.message 已是完整指引，勿以堆栈埋掉
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
			[b.year, b.month, b.day, b.timeIndex, b.gender]
		);
		const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;
		// 形状守卫：同运行时判据 —— 非 12 行即残缺，宁可现在炸
		if (rows.length !== 12) {
			throw new SourceError(
				`${b.year}-${b.month}-${b.day} 时辰${b.timeIndex}（${b.gender}）取到 ${rows.length} 行宫位，预期 12 行`
			);
		}
		// BigInt 不能被 JSON.stringify 序列化，统一归一
		out.push({ why, rows: rows.map(r => ({ ...r, sample_id: Number(r.sample_id) })) });
		console.log(`  ✓ ${why} → ${b.year}-${b.month}-${b.day} 时辰${b.timeIndex} ${b.gender}`);
	}

	writeFileSync(
		resolve(FIX_DIR, "raw-rows.json"),
		JSON.stringify(out, null, "\t") + "\n",
		"utf8"
	);
	const bytes = readFileSync(resolve(FIX_DIR, "raw-rows.json")).length;
	console.log(
		`已写出 ${out.length} 条真实样本行 → test/fixtures/raw-rows.json（${(bytes / 1024).toFixed(0)} KiB）`
	);
	console.log("现在跑 npm test：sample-source.test.ts 会拿它逐字节复现 charts.jsonl");
	closeSource();
}

// 仅直接执行才跑：Node 默认测试识别含 test/**/*，无守卫时
// `node --test test/` 会当测试执行（同 tools/ 其余脚本）。
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
