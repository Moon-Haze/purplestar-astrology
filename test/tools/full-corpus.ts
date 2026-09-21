#!/usr/bin/env node
// ── 全量核验：把 reference/ 下的全部 518,400 条样本跑一遍 ──
//
// 与 npm test 的分工：
//   npm test                 → test/fixtures/ 里 300 条**抽样**基准，秒级，日常回归
//   本脚本                    → reference/ 里**全量**语料，单线程约 2 小时，按需手动跑
//
// 什么时候需要它：
//   · 升级 iztro 之后，确认「差异集合没有扩大」（抽样可能刚好没抽到变化的那一宫）
//   · 重建 fixtures 抽样之前，先确认整体一致（抽样只覆盖 12 时辰 × 12 月，未必碰到边界）
//   · 排查某个特定年份/月份的问题
//
// 用法（在 skill 根执行）：
//   node test/tools/full-corpus.ts                        # 全量，约 2 小时
//   node test/tools/full-corpus.ts --year 1960            # 只跑 1960 年（8,640 条，约 2 分钟）
//   node test/tools/full-corpus.ts --year 1960 --month 6  # 只跑 1960-06（720 条，约 12 秒）
//   node test/tools/full-corpus.ts --limit 5000           # 只跑前 5,000 条
//   node test/tools/full-corpus.ts --quiet                # 不打印进度，只出报告
//
// 退出码：0 = 白名单之外零差异；1 = 有差异，或样本目录/依赖缺失。可直接用于 CI。
//
// ⚠️ 与 npm test 用**同一个比对器与同一份白名单**（test/lib/compare.ts）。
//    这里不用白名单过滤掉差异，而是用 keepWhitelisted 保留后再分类统计 ——
//    这样报告里能同时看到「放行了多少处已知差异」和「有没有出现新差异」。
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/ziwei/types";
import { loadAlgorithm } from "../lib/loader.ts";
import { compareChart, formatDiffs, BRANCHES, type BaselineSample, type ChartDiff } from "../lib/compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/tools
const SKILL_ROOT = resolve(HERE, "../..");
const SAMPLES = resolve(SKILL_ROOT, "reference/ziwei-samples-toolkit/samples-out");

const YEAR_ALL = { start: 1924, end: 1983 }; // 与 toolkit 的语料范围一致
const PROGRESS_EVERY = 10; // 每完成 N 个分片报一次进度
const MAX_DETAIL = 20; // 明细最多列这么多条

// ── 参数 ──
const argv = process.argv.slice(2);
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
const optOf = (name: string): string | null => {
	const i = argv.indexOf(`--${name}`);
	if (i < 0) return null;
	const v = argv[i + 1];
	return v && !v.startsWith("--") ? v : null;
};

const QUIET = hasFlag("quiet");
const YEAR = optOf("year") ? Number(optOf("year")) : null;
const MONTH = optOf("month") ? Number(optOf("month")) : null;
const LIMIT = optOf("limit") ? Number(optOf("limit")) : Infinity;

const years = YEAR ? [YEAR] : range(YEAR_ALL.start, YEAR_ALL.end);
const months = MONTH ? [MONTH] : range(1, 12);

function range(a: number, b: number): number[] {
	const out: number[] = [];
	for (let i = a; i <= b; i++) out.push(i);
	return out;
}

/** 分片文件路径：samples-out/year-XXXX/YYYY-MM.jsonl.gz */
function shardPath(year: number, month: number): string {
	return resolve(SAMPLES, `year-${year}`, `${year}-${String(month).padStart(2, "0")}.jsonl.gz`);
}

/** 流式逐行读取一个分片，回调每条样本（返回 false 即停止读取）。 */
async function forEachSample(file: string, fn: (raw: BaselineSample) => boolean | void): Promise<boolean> {
	const rl = createInterface({
		input: createReadStream(file).pipe(createGunzip()),
		crlfDelay: Infinity,
	});
	for await (const line of rl) {
		if (!line.trim()) continue;
		if (fn(JSON.parse(line) as BaselineSample) === false) {
			rl.close();
			return false;
		}
	}
	return true;
}

const label = (b: BirthInfo): string =>
	`${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} ${BRANCHES[b.hour] ?? b.hour}时 ${b.gender}`;

interface DiffBucket {
	count: number;
	expected: unknown;
	actual: unknown;
	sample: BirthInfo;
}

interface CorpusStats {
	checked: number;
	clean: number;
	dirty: number;
	missingShards: number;
	/** 白名单放行的差异**处**数（一处 = 一条盘上的一个字段） */
	whitelistedCells: number;
	/** 差异路径 → { count, expected, actual, sample } */
	buckets: Map<string, DiffBucket>;
	detail: Array<{ birth: BirthInfo; diffs: ChartDiff[] }>;
}

async function main(): Promise<void> {
	if (!existsSync(SAMPLES)) {
		console.error(
			`找不到样本目录：${SAMPLES}\n` +
				`  本脚本需要 reference/ziwei-samples-toolkit/ 存在（该目录不入版本控制）。\n` +
				`  日常回归不需要它 —— 跑 npm test 即可，fixtures 已入库。`
		);
		process.exit(1);
	}

	const { generateChart } = await loadAlgorithm();

	const shards = years.flatMap(y => months.map(m => ({ year: y, month: m })));
	const stats: CorpusStats = {
		checked: 0,
		clean: 0,
		dirty: 0,
		missingShards: 0,
		whitelistedCells: 0,
		buckets: new Map(),
		detail: [],
	};
	const t0 = Date.now();

	outer: for (const [i, { year, month }] of shards.entries()) {
		const file = shardPath(year, month);
		if (!existsSync(file)) {
			stats.missingShards++;
			continue;
		}

		const done = await forEachSample(file, raw => {
			stats.checked++;
			const actual = generateChart({ ...raw.birthInfo });
			const all = compareChart(actual, raw.chart, { keepWhitelisted: true });

			let real: ChartDiff[] | null = null;
			for (const d of all) {
				if (d.whitelisted) {
					stats.whitelistedCells++;
					continue;
				}
				(real ??= []).push(d);
				let b = stats.buckets.get(d.path);
				if (!b) {
					b = { count: 0, expected: d.expected, actual: d.actual, sample: raw.birthInfo };
					stats.buckets.set(d.path, b);
				}
				b.count++;
			}

			if (real) {
				stats.dirty++;
				if (stats.detail.length < MAX_DETAIL) stats.detail.push({ birth: raw.birthInfo, diffs: real });
			} else {
				stats.clean++;
			}

			return stats.checked < LIMIT; // false 即停止读取
		});

		if (!QUIET && (i + 1) % PROGRESS_EVERY === 0) {
			process.stderr.write(
				`  已检查 ${stats.checked.toLocaleString("en-US")} 条` +
					`（分片 ${i + 1}/${shards.length}，${year}-${String(month).padStart(2, "0")}）\n`
			);
		}
		if (!done || stats.checked >= LIMIT) break outer;
	}

	report(stats, shards.length, Date.now() - t0);
	process.exit(stats.dirty > 0 ? 1 : 0);
}

function report(s: CorpusStats, shardCount: number, ms: number): void {
	const line = (k: string, v: string): void => console.log(`  ${k.padEnd(12, "　")} ${v}`);
	const scope = `${years[0]}-${String(months[0]).padStart(2, "0")} ~ ${years.at(-1)}-${String(months.at(-1)).padStart(2, "0")}`;
	const limited = s.checked < shardCount * 720;

	console.log("\n══ 全量核验汇总 ══");
	line("范围", `${scope}（${shardCount} 个分片${limited ? "，受 --limit 截断" : ""}）`);
	line("检查条数", s.checked.toLocaleString("en-US"));
	line("完全一致", s.clean.toLocaleString("en-US"));
	line("有差异", s.dirty.toLocaleString("en-US"));
	line("白名单放行", `${s.whitelistedCells.toLocaleString("en-US")} 处（已知：太阳/太阴在酉宫的亮度，见 test/lib/compare.ts）`);
	line("耗时", `${(ms / 1000).toFixed(1)} 秒（${(ms / Math.max(s.checked, 1)).toFixed(1)} ms/条）`);
	if (s.missingShards) line("缺失分片", `${s.missingShards} 个`);
	console.log("");

	if (s.dirty === 0) {
		console.log("✔ 白名单之外零差异。");
		return;
	}

	console.log(`✖ 出现 ${s.buckets.size} 种白名单之外的差异：\n`);
	const sorted = [...s.buckets].sort((a, b) => b[1].count - a[1].count);
	for (const [path, b] of sorted) {
		console.log(
			`  ${path}\n` +
				`      基准=${JSON.stringify(b.expected)}  实际=${JSON.stringify(b.actual)}\n` +
				`      出现 ${b.count.toLocaleString("en-US")} 次，例：${label(b.sample)}`
		);
	}

	if (s.detail.length) {
		console.log(`\n── 前 ${s.detail.length} 条差异明细 ──`);
		for (const { birth, diffs } of s.detail) {
			console.log(`\n${label(birth)}`);
			console.log(formatDiffs(diffs, 10));
		}
	}

	console.log(
		"\n处理：先跑 npm test 定位是抽样内的变化，或 \n" +
			"      · 若是 iztro 升级带来的预期行为变化 → 审阅后更新 test/lib/compare.ts 的 KNOWN_DIVERGENCES（须写明根因）\n" +
			"      · 若不是预期变化 → 这是回归，检查 scripts/ziwei/ 下的内核改动"
	);
}

// ── 仅直接执行时跑 main ──
// Node 的默认测试文件识别模式包含 `test/**/*`，若不加这道守卫，`node --test test/`
// 可能把这个会跑两小时的脚本当成测试文件执行。
const isDirectRun =
	process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
