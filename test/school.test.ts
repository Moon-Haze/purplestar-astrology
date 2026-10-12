// ── 层 4：三合派体系约束 ──
//
// 本项目严格遵循倪海厦《天纪》三合派。飞星派的**宫干自化**、**大限四化取宫干**、
// **来因宫**均已主动下线 —— algorithm.ts 不再填充这些字段；types.ts 仍保留其类型定义，
// 那是**刻意留下的绊线**（断言盯的是「有没有被填回」，字段删了就无从盯起）。
// 会生产它们的那些函数（detectSelfSihua / findIncomingPalaces / getDecadalMutagen 等）
// 已从 sihua.ts 删除，全仓零调用点。本文件盯住这些字段**不被重新填回**。
//
// ⚠️ 这条约束在 CLI 的 selftest 里也有断言。两处并不重复：selftest 用固定样例，
//    本文件用 300 条真实基准盘，覆盖面大得多（尤其大限字段在 12 步 × 300 盘上逐一检查）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAlgorithm, load } from "./lib/loader.ts";
import type { BaselineSample } from "./lib/compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const samples = readFileSync(resolve(HERE, "fixtures/charts.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map(line => JSON.parse(line) as BaselineSample);

const { generateChart } = await loadAlgorithm();
// Phase 3：绊线改为声明式 —— 禁忌项读 SchoolAdapter，不在本文件硬编码。
const { checkForbiddenFeatures } = await load<typeof import("@/school/guard")>("@/school/guard");
const { SCHOOLS, DEFAULT_SCHOOL_ID } = await load<typeof import("@/school/registry")>(
	"@/school/registry"
);
const charts = samples.map(s => ({ birth: s.birthInfo, chart: generateChart({ ...s.birthInfo }) }));
const label = (b: {
	year: number;
	month: number;
	day: number;
	timeIndex: number;
	gender: string;
}): string => `${b.year}-${b.month}-${b.day}/${b.timeIndex}/${b.gender}`;

const DAXIAN_ALLOWED = ["startAge", "endAge", "palaceBranch", "palaceName"];

describe("三合派体系约束", () => {
	it("宫干自化（Palace.selfMutagen）不被填充", () => {
		const school = SCHOOLS[DEFAULT_SCHOOL_ID];
		// 先确认适配器**声明了**该禁忌 —— 否则下面的空结果可能只是「没人查」造成的假绿。
		assert.ok(
			school.forbiddenFeatures?.includes("self-mutagen"),
			"默认流派适配器应声明 self-mutagen 禁忌"
		);
		for (const { birth, chart } of charts) {
			const v = checkForbiddenFeatures(chart, school);
			assert.deepEqual(
				v,
				[],
				`${label(birth)}：体系禁用特征被触发 ${v.map(x => x.detail).join("；")}`
			);
		}
	});

	it("空壳流派（无 self-mutagen 禁忌）不报宫干自化违例 —— 多流派隔离的最小证据", () => {
		// 反向对照：同一批盘，只因该流派没声明 self-mutagen，守卫即不触发。
		// 这证明检查是**按声明分派**的，而非无条件扫字段。
		for (const { chart } of charts) {
			assert.deepEqual(checkForbiddenFeatures(chart, { forbiddenFeatures: [] }), []);
		}
	});

	it("大限不含飞星派字段（stemIndex / stemName / mutagen）", () => {
		for (const { birth, chart } of charts) {
			for (const [i, dx] of chart.decadals.entries()) {
				for (const banned of ["stemIndex", "stemName", "mutagen"] as const) {
					assert.ok(
						!(banned in dx),
						`${label(birth)}：第 ${i} 步大限出现了 ${banned} —— 飞星派大限四化，本项目已下线`
					);
				}
			}
		}
	});

	it("大限的键集合严格等于四个三合派字段", () => {
		for (const { birth, chart } of charts) {
			for (const dx of chart.decadals) {
				assert.deepEqual(
					Object.keys(dx).sort(),
					[...DAXIAN_ALLOWED].sort(),
					`${label(birth)}：大限字段集合被改动`
				);
			}
		}
	});

	it("星曜不含 incomingSihua（飞星派飞入标记）", () => {
		for (const { birth, chart } of charts) {
			for (const p of chart.palaces) {
				for (const s of p.stars) {
					assert.ok(
						!("incomingSihua" in s),
						`${label(birth)}：${s.name} 带 incomingSihua —— 飞星派字段，不应存在`
					);
				}
			}
		}
	});

	// ── 正向约束：生年四化是三合派解读的着力点，必须完整 ──
	describe("生年四化", () => {
		it("每盘恰好四颗星带四化，且禄权科忌各一", () => {
			for (const { birth, chart } of charts) {
				const marks = chart.palaces
					.flatMap(p => p.stars)
					.filter(
						s =>
							s.mutagen === "禄" ||
							s.mutagen === "权" ||
							s.mutagen === "科" ||
							s.mutagen === "忌"
					)
					.map(s => s.mutagen);
				assert.equal(
					marks.length,
					4,
					`${label(birth)}：生年四化应恰好 4 颗，实际 ${marks.length}`
				);
				assert.deepEqual(
					[...marks].sort(),
					["忌", "权", "禄", "科"].sort(),
					`${label(birth)}：四化应为禄权科忌各一`
				);
			}
		});

		it("四化标记取值合法（只有禄权科忌，空值不算）", () => {
			const VALID = new Set<string | undefined>(["禄", "权", "科", "忌", "", undefined]);
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					for (const s of p.stars) {
						assert.ok(
							VALID.has(s.mutagen),
							`${label(birth)}：${s.name} 的 mutagen=${JSON.stringify(s.mutagen)} 非法`
						);
					}
				}
			}
		});
	});
});
