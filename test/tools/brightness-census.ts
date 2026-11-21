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
// ——孤例或成簇，随该星落该宫的频次而定——供人工审计，不自动拦截：
//
//   npm run brightness:census
//
// 各计数自报，不写死。对拍面与层 1 同源（fixtures 300 条 + generateChart 直调），
// 双侧亮度均为三档词汇（bright/normal/dim），逐值比对。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BaselineSample } from "../lib/compare.ts";
import { loadAlgorithm } from "../lib/loader.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)); // <仓库根>/test/tools

/** 三档亮度中文标签（与 tools/db/format.ts 同一张映射的语义：庙/旺→庙旺、利/平→利平、不利/陷→陷）。 */
const BRIGHTNESS_LABEL: Record<string, string> = { bright: "庙旺", normal: "利平", dim: "陷" };

async function main(): Promise<void> {
	const { generateChart } = await loadAlgorithm();
	const samples: BaselineSample[] = readFileSync(
		resolve(HERE, "../fixtures/charts.jsonl"),
		"utf8"
	)
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line) as BaselineSample);

	console.log(
		"亮度分歧普查 —— 信息级审计（分歧是 2026-10 文墨口径切换的预期结果，不作对错判据）"
	);
	console.log(
		`基准：fixtures ${samples.length} 条（db/dataset 抽样）；双侧亮度均为三档词汇，逐值比对\n`
	);

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

	console.log(
		`总比对 ${total} 次（${samples.length} 盘双侧均有档位的星），分歧 ${diff} 处（${((diff / total) * 100).toFixed(1)}%）`
	);
	console.log(
		`有分歧的盘：${chartsWithDiff}/${samples.length}（${((chartsWithDiff / samples.length) * 100).toFixed(1)}%）`
	);
	console.log(`\n分歧组合分布（星: 基准档 → 本项目档 × 命中盘数，按命中盘数降序）：`);
	const sorted = [...combos.entries()].sort(
		(a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh")
	);
	for (const [key, count] of sorted) {
		console.log(`  ${String(count).padStart(5)}  ${key}`);
	}
	console.log(
		`\n共 ${sorted.length} 种分歧组合。抄写笔误的识别形态：基准侧不该变的组合出现异常离散的` +
			`新增行（孤例或成簇，随该星落该宫频次而定）；文墨表修订后重跑本工具可看变化范围。`
	);
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
