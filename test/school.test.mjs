// ── 层 4：三合派体系约束 ──
//
// 本项目严格遵循倪海夏《天纪》三合派。飞星派的**宫干自化**、**大限四化取宫干**、
// **来因宫**均已主动下线 —— algorithm.ts 不再填充这些字段，但 types.ts 仍保留其类型定义、
// sihua.ts 仍导出 detectSelfSihua / findIncomingPalaces / getDaXianSiHua 等函数（历史遗留）。
// 「存在不等于该用」：本文件盯住这些字段**不被重新填回**。
//
// ⚠️ 这条约束在 CLI 的 selftest 里也有断言。两处并不重复：selftest 用固定样例，
//    本文件用 300 条真实基准盘，覆盖面大得多（尤其大限字段在 12 步 × 300 盘上逐一检查）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAlgorithm } from "./lib/loader.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const samples = readFileSync(resolve(HERE, "fixtures/charts.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map(JSON.parse);

const { generateChart } = await loadAlgorithm();
const charts = samples.map(s => ({ birth: s.birthInfo, chart: generateChart({ ...s.birthInfo }) }));
const label = b => `${b.year}-${b.month}-${b.day}/${b.hour}/${b.gender}`;

const DAXIAN_ALLOWED = ["startAge", "endAge", "palaceBranch", "palaceName"];

describe("三合派体系约束", () => {
	it("宫干自化（Palace.selfSihua）不被填充", () => {
		for (const { birth, chart } of charts) {
			for (const p of chart.palaces) {
				assert.equal(
					p.selfSihua,
					undefined,
					`${label(birth)}：${p.name} 填了 selfSihua —— 飞星派宫干自化，本项目已下线`
				);
			}
		}
	});

	it("大限不含飞星派字段（stemIndex / stemName / siHua）", () => {
		for (const { birth, chart } of charts) {
			for (const [i, dx] of chart.daXians.entries()) {
				for (const banned of ["stemIndex", "stemName", "siHua"]) {
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
			for (const dx of chart.daXians) {
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
					.filter(s => s.siHua === "禄" || s.siHua === "权" || s.siHua === "科" || s.siHua === "忌")
					.map(s => s.siHua);
				assert.equal(marks.length, 4, `${label(birth)}：生年四化应恰好 4 颗，实际 ${marks.length}`);
				assert.deepEqual(
					[...marks].sort(),
					["忌", "权", "禄", "科"].sort(),
					`${label(birth)}：四化应为禄权科忌各一`
				);
			}
		});

		it("四化标记取值合法（只有禄权科忌，空值不算）", () => {
			const VALID = new Set(["禄", "权", "科", "忌", "", undefined]);
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					for (const s of p.stars) {
						assert.ok(
							VALID.has(s.siHua),
							`${label(birth)}：${s.name} 的 siHua=${JSON.stringify(s.siHua)} 非法`
						);
					}
				}
			}
		});
	});
});
