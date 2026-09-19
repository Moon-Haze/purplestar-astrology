// ── 层 1（主力）：排盘对标 ──
//
// 拿本项目 generateChart() 的输出去比 toolkit 样本里的 chart，逐字段全等比对。
// 基准是 iztro 2.5.8 的行为快照，本项目用 2.6.1 —— 已知差异（太阳/太阴在酉宫的亮度）
// 登记在 test/lib/compare.mjs 的 KNOWN_DIVERGENCES，白名单**之外**的任何差异都会失败。
//
// ⚠️ 这套测试是**回归锁定 / 跨版本差分**，不是独立正确性证明：样本与本项目内核同源
//    （都调 iztro 的 bySolar），两边一起错的地方测不出来。详见 test/README.md。
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAlgorithm, ROOT } from "./lib/loader.mjs";
import { compareChart, formatDiffs, BRANCHES } from "./lib/compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const manifest = JSON.parse(readFileSync(resolve(HERE, "fixtures/manifest.json"), "utf8"));
const samples = readFileSync(resolve(HERE, "fixtures/charts.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map(JSON.parse);

const { generateChart } = await loadAlgorithm();

const describeBirth = b =>
	`${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} ` +
	`${BRANCHES[b.hour] ?? `timeIndex${b.hour}`}时 ${b.gender}`;

// ── 先确认基准数据真的加载进来了 ──
// 没有这条，fixtures 读空会让下面 0 个用例、「全绿」通过 —— 那是最危险的假阳性。
test("基准数据可用", () => {
	assert.equal(samples.length, manifest.count, "fixtures 行数应与 manifest 记录一致");
	assert.equal(samples.length, 300, "基准应为 300 条（60 年 × 5 条）");
	assert.ok(
		samples.every(s => s.birthInfo && s.chart?.palaces?.length === 12),
		"每条基准都应含 birthInfo 与完整十二宫"
	);
});

test("排盘内核可加载", () => {
	assert.equal(typeof generateChart, "function");
	assert.ok(ROOT.endsWith("scripts"), `内核根应指向 scripts/，实际为 ${ROOT}`);
});

// ── 主体：逐条比对，按年份分组，用例名带完整出生信息便于定位 ──
describe("排盘对标（基准：iztro 2.5.8 样本）", () => {
	const byYear = new Map();
	for (const s of samples) {
		if (!byYear.has(s.birthInfo.year)) byYear.set(s.birthInfo.year, []);
		byYear.get(s.birthInfo.year).push(s);
	}

	for (const [year, list] of [...byYear].sort((a, b) => a[0] - b[0])) {
		describe(`${year} 年`, () => {
			for (const s of list) {
				it(describeBirth(s.birthInfo), () => {
					const actual = generateChart({ ...s.birthInfo });
					const diffs = compareChart(actual, s.chart);
					assert.equal(diffs.length, 0, `\n${formatDiffs(diffs)}`);
				});
			}
		});
	}
});

// ── 随运行年份漂移的字段 ──
// algorithm.ts: `currentAge = new Date().getFullYear() - year`（无 +1），连带
// currentDaXianIndex / palace.isCurrentDaXian。样本是 2026 年拍的快照，
// **若测试照抄样本的 currentAge，2027 年 1 月 1 日本套测试会全线变红**。
// 故比对器按「注入的当前时间」重算期望值。下面这条断言证明重算确实在生效。
describe("随年份漂移的字段", () => {
	it("currentAge 期望值按注入时间重算，而非照抄样本快照", () => {
		const s = samples[0];
		const actual = generateChart({ ...s.birthInfo });

		// 真实当前时间下不应有差异（actual 与样本同源，用同一个年份算）
		const sameYear = compareChart(actual, s.chart).filter(d => d.path === "currentAge");
		assert.equal(sameYear.length, 0, "真实时间下 currentAge 不应有差异");

		// 把「当前时间」推到明年：期望值随之 +1，而 actual 是用真实时间排的，故必然报出差异。
		// 这证明比对器没有照抄样本 —— 否则这套测试活不过一个跨年。
		const nextYear = new Date().getFullYear() + 1;
		const drift = compareChart(actual, s.chart, { now: new Date(`${nextYear}-06-01`) });
		assert.ok(
			drift.some(d => d.path === "currentAge"),
			`注入 ${nextYear} 年时间后应报出 currentAge 漂移；未报出说明期望值是照抄样本的`
		);
	});
});

// ── 报告已知差异的存在性 ──
// 白名单里的两条差异应当**确实发生**（酉宫有太阳或太阴时）。
// 若某天它不再发生（比如 iztro 回退了亮度表），说明白名单该清理了 —— 提示而非失败。
describe("已知差异白名单", () => {
	it("白名单条目在基准中确有体现", () => {
		const hits = new Set();
		for (const s of samples) {
			const you = s.chart.palaces.find(p => p.branch === 9);
			for (const st of you?.stars ?? []) {
				if (st.name === "太阳" || st.name === "太阴") hits.add(st.name);
			}
		}
		// 样本量足够大，酉宫必然出现过日月之一
		assert.ok(hits.size > 0, "300 条基准中酉宫应至少出现过太阳或太阴");
	});
});
