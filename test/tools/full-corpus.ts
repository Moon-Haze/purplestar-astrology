#!/usr/bin/env node
// ── 全量核验：把 db/{samples,palaces}/ 里的全部 518,400 条样本跑一遍 ──
//
// 与 npm test 的分工：
//   npm test                 → test/fixtures/ 里 300 条**抽样**基准，秒级，日常回归
//   本脚本                    → 数据集里**全量**语料，单线程约 2 小时，按需手动跑
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
// 退出码：0 = 白名单之外零差异；1 = 有差异，或数据集/依赖缺失。可直接用于 CI。
//
// ⚠️ 与 npm test 用**同一个比对器与同一份白名单**（test/lib/compare.ts）。
//    这里不用白名单过滤掉差异，而是用 keepWhitelisted 保留后再分类统计 ——
//    这样报告里能同时看到「放行了多少处已知差异」和「有没有出现新差异」。
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/ziwei/types";
import { loadAlgorithm } from "../lib/loader.ts";
import { compareChart, formatDiffs, BRANCHES, type ChartDiff } from "../lib/compare.ts";
import { forEachSample, openSource, closeSource, SourceError, DB_DIR } from "../lib/sample-source.ts";

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
	/** 白名单放行的差异**处**数（一处 = 一条盘上的一个字段） */
	whitelistedCells: number;
	/** 差异路径 → { count, expected, actual, sample } */
	buckets: Map<string, DiffBucket>;
	detail: Array<{ birth: BirthInfo; diffs: ChartDiff[] }>;
}

/** 进度输出的间隔（条）。旧实现按分片报（每 10 个分片 ≈ 7,200 条），此处等价换算成条数。 */
const PROGRESS_EVERY = 7200;

async function main(): Promise<void> {
	try {
		await openSource();
	} catch (err) {
		if (err instanceof SourceError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	}

	const { generateChart } = await loadAlgorithm();

	const stats: CorpusStats = {
		checked: 0,
		clean: 0,
		dirty: 0,
		whitelistedCells: 0,
		buckets: new Map(),
		detail: [],
	};
	const t0 = Date.now();

	const done = await forEachSample(
		{ year: YEAR ?? undefined, month: MONTH ?? undefined, limit: LIMIT },
		raw => {
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

			if (!QUIET && stats.checked % PROGRESS_EVERY === 0) {
				process.stderr.write(
					`  已检查 ${stats.checked.toLocaleString("en-US")} 条` +
						`（用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒）\n`
				);
			}

			return true; // 停止由 filter.limit 负责
		}
	);

	report(stats, expectedTotal(), done, Date.now() - t0);
	closeSource();
	process.exit(stats.dirty > 0 ? 1 : 0);
}

/** 本次过滤条件覆盖的样本总数（用于判断报告是否被 --limit 截断）。 */
function expectedTotal(): number {
	return (YEAR ? 1 : 60) * (MONTH ? 1 : 12) * 720;
}

function report(s: CorpusStats, expected: number, completed: boolean, ms: number): void {
	const line = (k: string, v: string): void => console.log(`  ${k.padEnd(12, "　")} ${v}`);
	const scope = `${YEAR ?? 1924}-${String(MONTH ?? 1).padStart(2, "0")} ~ ${YEAR ?? 1983}-${String(MONTH ?? 12).padStart(2, "0")}`;
	// 只有「没读完」**且**「条数确实少于应有」才算截断。
	// 单看 `!completed` 会误报：--limit 恰好等于总数时 forEachSample 也返回 false。
	const limited = !completed && s.checked < expected;

	console.log("\n══ 全量核验汇总 ══");
	line("数据源", DB_DIR);
	line("范围", `${scope}（${expected.toLocaleString("en-US")} 条${limited ? "，受 --limit 截断" : ""}）`);
	line("检查条数", s.checked.toLocaleString("en-US"));
	line("完全一致", s.clean.toLocaleString("en-US"));
	line("有差异", s.dirty.toLocaleString("en-US"));
	line("白名单放行", `${s.whitelistedCells.toLocaleString("en-US")} 处（已知：太阳/太阴在酉宫的亮度，见 test/lib/compare.ts）`);
	line("耗时", `${(ms / 1000).toFixed(1)} 秒（${(ms / Math.max(s.checked, 1)).toFixed(1)} ms/条）`);
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
