#!/usr/bin/env node
// ── 亮度分歧普查：本项目输出（文墨 SB 表）vs db 基准亮度（iztro 2.5.8 三档归并）──
//
// **信息级审计工具：不设 pass/fail、不进任何闸门面**（npm test / selftest / CI 必经面）。
// 分歧是 2026-10 文墨口径切换的**预期结果**——db 基准的亮度是 iztro 引擎按它自己的
// 亮度表打的三档（bright/normal/dim），本项目亮度已整体改由文墨 SB 表覆写
// （XD2 默认，见 scripts/wenmo-brightness.ts）；两个学派的打分表本来就不同，闸门化只会
// 产出无信号的红灯。层 1 对拍因此**跳过 brightness 字段**（compare.ts），亮度的学理
// 锚点由 invariants 的「文墨亮度表」组保障。
//
// 本工具补的是锚点管不到的空档：**个别单元格抄错**。产出分歧分布表
// （星 × 基准档 → 本项目档 × 命中盘数），抄写笔误会在表中呈**可识别的异常组合行**
// ——孤例或成簇，随该星落该宫的频次而定——供人工审计，不自动拦截。
//
//   npm run brightness:census                        # 当下分布表
//   npm run brightness:census -- --save-baseline     # 当前分布表存为入库基线
//   npm run brightness:census -- --check-baseline    # 与基线逐行对拍（变化逐条点名）
//
// 基线是**审计参照**：对基线发现差异也只是报告事实（不红不绿、退出码恒 0），
// 变化为预期（文墨表修订/换版）时重存基线即可。各计数自报，不写死。
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BaselineSample } from "../lib/compare.ts";
import { loadAlgorithm } from "../lib/loader.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)); // <仓库根>/test/tools
const BASELINE_PATH = resolve(HERE, "../fixtures/brightness-census-baseline.json");

/** 三档亮度中文标签（与 tools/db/format.ts 同一张映射的语义：庙/旺→庙旺、利/平→利平、不利/陷→陷）。 */
const BRIGHTNESS_LABEL: Record<string, string> = { bright: "庙旺", normal: "利平", dim: "陷" };

/** 普查统计（控制台报告与基线 JSON 共用一份形状）。 */
interface CensusStats {
	total: number;
	diff: number;
	chartsWithDiff: number;
	chartCount: number;
	combos: { key: string; count: number }[];
}

async function compute(): Promise<CensusStats> {
	const { generateChart } = await loadAlgorithm();
	const samples: BaselineSample[] = readFileSync(
		resolve(HERE, "../fixtures/charts.jsonl"),
		"utf8"
	)
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line) as BaselineSample);

	let total = 0;
	let diff = 0;
	let chartsWithDiff = 0;
	const combos = new Map<string, number>();

	for (const s of samples) {
		const mine = generateChart({ ...s.birthInfo });
		const baseByBranch = new Map(s.chart.palaces?.map(p => [p.branch, p]) ?? []);
		let chartDiff = 0;
		for (const p of mine.palaces) {
			const bp = baseByBranch.get(p.branch);
			if (!bp) {
				continue;
			}
			for (const st of p.stars) {
				const bs = bp.stars.find(x => x.name === st.name);
				// 只比双侧都有亮度值的星：基准缺档（bs.brightness 缺失）或本项目缺档
				//（文墨表未收录的辅杂曜）不入总比对数——口径与层 1 的跳过规则同向。
				if (!bs || !st.brightness || !bs.brightness) {
					continue;
				}
				total++;
				if (String(st.brightness) !== String(bs.brightness)) {
					diff++;
					chartDiff++;
					const key =
						`${st.name}: ${BRIGHTNESS_LABEL[String(bs.brightness)] ?? bs.brightness}` +
						` → ${BRIGHTNESS_LABEL[String(st.brightness)] ?? st.brightness}`;
					combos.set(key, (combos.get(key) ?? 0) + 1);
				}
			}
		}
		if (chartDiff > 0) {
			chartsWithDiff++;
		}
	}
	return {
		total,
		diff,
		chartsWithDiff,
		chartCount: samples.length,
		combos: [...combos.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
			.map(([key, count]) => ({ key, count })),
	};
}

function printReport(s: CensusStats): void {
	console.log(
		`总比对 ${s.total} 次（${s.chartCount} 盘双侧均有档位的星），分歧 ${s.diff} 处（${((s.diff / s.total) * 100).toFixed(1)}%）`
	);
	console.log(
		`有分歧的盘：${s.chartsWithDiff}/${s.chartCount}（${((s.chartsWithDiff / s.chartCount) * 100).toFixed(1)}%）`
	);
	console.log(`\n分歧组合分布（星: 基准档 → 本项目档 × 命中盘数，按命中盘数降序）：`);
	for (const { key, count } of s.combos) {
		console.log(`  ${String(count).padStart(5)}  ${key}`);
	}
	console.log(
		`\n共 ${s.combos.length} 种分歧组合。抄写笔误的识别形态：基准侧不该变的组合出现异常离散的` +
			`新增行（孤例或成簇，随该星落该宫频次而定）；文墨表修订后重跑本工具可看变化范围。`
	);
}

async function saveBaseline(s: CensusStats): Promise<void> {
	const payload = {
		description:
			"亮度分歧普查基线——信息级审计参照（非闸门）；重跑 brightness:census --check-baseline 与此对拍",
		savedAt: new Date().toISOString().slice(0, 10),
		...s,
	};
	writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, "\t") + "\n", "utf8");
	console.log(
		`\n基线已写入 ${BASELINE_PATH}（${s.combos.length} 种组合，savedAt=${payload.savedAt}）`
	);
}

function checkBaseline(s: CensusStats): void {
	if (!existsSync(BASELINE_PATH)) {
		console.error(`基线不存在：${BASELINE_PATH}——先以 --save-baseline 存一份`);
		process.exit(1);
	}
	const base = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as CensusStats & {
		savedAt?: string;
	};
	const baseMap = new Map(base.combos.map(c => [c.key, c.count]));
	const curMap = new Map(s.combos.map(c => [c.key, c.count]));
	const added = s.combos.filter(c => !baseMap.has(c.key));
	const removed = base.combos.filter(c => !curMap.has(c.key));
	const changed = s.combos.filter(c => baseMap.has(c.key) && baseMap.get(c.key) !== c.count);

	console.log(`\n对基线（savedAt=${base.savedAt ?? "?"}）逐行对拍：`);
	for (const c of added) {
		console.log(`  + 新增 ${c.key} × ${c.count}`);
	}
	for (const c of removed) {
		console.log(`  - 消失 ${c.key} × ${c.count}`);
	}
	for (const c of changed) {
		console.log(`  ~ 变化 ${c.key}: ${baseMap.get(c.key)} → ${c.count}`);
	}
	if (added.length + removed.length + changed.length === 0) {
		console.log("  零变化——当前分布与基线一致");
	} else {
		console.log(
			`\n共 ${added.length} 增 / ${removed.length} 消 / ${changed.length} 变。` +
				"基线是审计参照不是闸门：变化为预期（文墨表修订/换版）时以 --save-baseline 重存，" +
				"否则按分布表排查（孤例/成簇形态见文件头）。"
		);
	}
}

async function main(): Promise<void> {
	const s = await compute();
	console.log(
		"亮度分歧普查 —— 信息级审计（分歧是 2026-10 文墨口径切换的预期结果，不作对错判据）"
	);
	console.log(
		`基准：fixtures ${s.chartCount} 条（db/dataset 抽样）；双侧亮度均为三档词汇，逐值比对\n`
	);
	printReport(s);
	const flags = process.argv.slice(2);
	if (flags.includes("--save-baseline")) {
		await saveBaseline(s);
	}
	if (flags.includes("--check-baseline")) {
		checkBaseline(s);
	}
}

// ── 仅直接执行才跑 main ──
// 与 build-fixtures.ts 同款守卫：防 `node --test test/` 把本工具当测试文件执行。
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
