// ── 层 3：排盘结构不变量 ──
//
// 这些断言**不依赖基准样本的字段值**，而是排盘本身必须满足的结构约束 ——
// 无论 iztro 怎么升级、亮度表怎么改，它们都应当成立。因此这是本套测试里
// 最独立、最能抓住「排出一张坏盘」的一层。
//
// 约束来源：紫微斗数的排盘规则（十四主星必然各安一宫、十二宫必齐、大限十二步等），
// 与 toolkit 的 scripts/audit-samples.ts 所校验的项目一致。
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

const MAJOR_STARS = [
	"紫微", "天机", "太阳", "武曲", "天同", "廉贞",
	"天府", "太阴", "贪狼", "巨门", "天相", "天梁",
	"七杀", "破军",
];
const LUCKY6 = ["文昌", "文曲", "左辅", "右弼", "天魁", "天钺"];
const SHA6 = ["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"];

const label = b => `${b.year}-${b.month}-${b.day}/${b.hour}/${b.gender}`;

/** 对每条基准跑一次内核，供下列各 describe 复用。 */
const charts = samples.map(s => ({ birth: s.birthInfo, chart: generateChart({ ...s.birthInfo }) }));

describe("排盘结构不变量", () => {
	it(`样本量充足（${charts.length} 条）`, () => {
		assert.equal(charts.length, 300);
	});

	describe("十二宫", () => {
		it("恒为 12 宫，且地支 0-11 各出现一次", () => {
			for (const { birth, chart } of charts) {
				assert.equal(chart.palaces.length, 12, label(birth));
				const branches = chart.palaces.map(p => p.branch).sort((a, b) => a - b);
				assert.deepEqual(branches, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], label(birth));
			}
		});

		it("宫名两两不同（十二宫名不重复）", () => {
			for (const { birth, chart } of charts) {
				const names = chart.palaces.map(p => p.name);
				assert.equal(new Set(names).size, 12, label(birth));
			}
		});

		it("命宫与身宫标记与实际宫支一致", () => {
			for (const { birth, chart } of charts) {
				const ming = chart.palaces.filter(p => p.isMingGong);
				const shen = chart.palaces.filter(p => p.isShenGong);
				assert.equal(ming.length, 1, label(birth));
				assert.equal(shen.length, 1, label(birth));
				assert.equal(ming[0].branch, chart.mingGongBranch, label(birth));
				assert.equal(shen[0].branch, chart.shenGongBranch, label(birth));
				assert.equal(ming[0].name, "命宫", label(birth));
			}
		});
	});

	describe("星曜", () => {
		it("十四主星每颗恰好出现一次", () => {
			for (const { birth, chart } of charts) {
				const names = chart.palaces.flatMap(p => p.stars).map(s => s.name);
				for (const star of MAJOR_STARS) {
					assert.equal(
						names.filter(n => n === star).length,
						1,
						`${label(birth)}：${star} 应恰好出现 1 次`
					);
				}
			}
		});

		it("六吉星（昌曲辅弼魁钺）各恰好出现一次", () => {
			for (const { birth, chart } of charts) {
				const names = chart.palaces.flatMap(p => p.stars).map(s => s.name);
				for (const star of LUCKY6) {
					assert.equal(names.filter(n => n === star).length, 1, `${label(birth)}：${star}`);
				}
			}
		});

		it("六煞星（羊陀火铃空劫）各恰好出现一次", () => {
			for (const { birth, chart } of charts) {
				const names = chart.palaces.flatMap(p => p.stars).map(s => s.name);
				for (const star of SHA6) {
					assert.equal(names.filter(n => n === star).length, 1, `${label(birth)}：${star}`);
				}
			}
		});

		it("禄存与天马各恰好出现一次", () => {
			for (const { birth, chart } of charts) {
				const names = chart.palaces.flatMap(p => p.stars).map(s => s.name);
				assert.equal(names.filter(n => n === "禄存").length, 1, label(birth));
				assert.equal(names.filter(n => n === "天马").length, 1, label(birth));
			}
		});

		it("星曜 type 与 brightness 取值合法", () => {
			const TYPES = new Set(["major", "minor", "lucky", "sha"]);
			const BRIGHT = new Set(["bright", "normal", "dim"]);
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					for (const s of p.stars) {
						assert.ok(TYPES.has(s.type), `${label(birth)}：${s.name} 的 type=${s.type} 非法`);
						if (s.brightness !== undefined && s.brightness !== "") {
							assert.ok(
								BRIGHT.has(s.brightness),
								`${label(birth)}：${s.name} 的 brightness=${s.brightness} 非法`
							);
						}
					}
				}
			}
		});

		it("主星必有 type=major，且主星带庙旺利陷", () => {
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					for (const s of p.stars) {
						if (MAJOR_STARS.includes(s.name)) {
							assert.equal(s.type, "major", `${label(birth)}：${s.name}`);
							assert.ok(
								s.brightness === "bright" || s.brightness === "normal" || s.brightness === "dim",
								`${label(birth)}：${s.name} 缺庙旺利陷`
							);
						}
					}
				}
			}
		});
	});

	describe("五行局与紫微位", () => {
		it("五行局取值在 2-6 之间且名称与数字对应", () => {
			const NAMES = { 2: "水二局", 3: "木三局", 4: "金四局", 5: "土五局", 6: "火六局" };
			for (const { birth, chart } of charts) {
				assert.ok(
					[2, 3, 4, 5, 6].includes(chart.wuxingJu),
					`${label(birth)}：wuxingJu=${chart.wuxingJu}`
				);
				assert.equal(chart.wuxingJuName, NAMES[chart.wuxingJu], label(birth));
			}
		});

		it("紫微位落在合法宫支内", () => {
			for (const { birth, chart } of charts) {
				assert.ok(
					chart.ziweiPos >= 0 && chart.ziweiPos <= 11,
					`${label(birth)}：ziweiPos=${chart.ziweiPos}`
				);
			}
		});
	});

	describe("大限", () => {
		it("恒为 12 步，覆盖 12 个不同宫支", () => {
			for (const { birth, chart } of charts) {
				assert.equal(chart.daXians.length, 12, label(birth));
				assert.equal(new Set(chart.daXians.map(d => d.palaceBranch)).size, 12, label(birth));
			}
		});

		it("年龄区间连续：每步 10 年且首尾相接", () => {
			for (const { birth, chart } of charts) {
				const dx = [...chart.daXians].sort((a, b) => a.startAge - b.startAge);
				for (let i = 0; i < dx.length - 1; i++) {
					assert.equal(
						dx[i].endAge - dx[i].startAge,
						9,
						`${label(birth)}：第 ${i} 步跨度应为 10 年（含首尾）`
					);
					assert.equal(
						dx[i + 1].startAge,
						dx[i].endAge + 1,
						`${label(birth)}：第 ${i} 步与第 ${i + 1} 步应相接`
					);
				}
			}
		});

		it("宫位的 daXianAge 与该宫大限区间一致", () => {
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					const dx = chart.daXians.find(d => d.palaceBranch === p.branch);
					if (!dx || !p.daXianAge) continue;
					assert.deepEqual(
						p.daXianAge,
						[dx.startAge, dx.endAge],
						`${label(birth)}：${p.name} 的 daXianAge`
					);
				}
			}
		});
	});

	// ── 本项目**独有**于上游样本的结构字段（样本无这些字段，故无基准可比）──
	// 只能做自洽断言：它们必须与已有的宫位信息互相印证。
	describe("借宫结构字段（本项目独有）", () => {
		it("oppositeBranch 恒为对宫地支", () => {
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					assert.equal(p.oppositeBranch, (p.branch + 6) % 12, `${label(birth)}：${p.name}`);
				}
			}
		});

		it("isEmpty 当且仅当该宫无主星", () => {
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					const hasMajor = p.stars.some(s => s.type === "major");
					assert.equal(!!p.isEmpty, !hasMajor, `${label(birth)}：${p.name}`);
				}
			}
		});

		it("空宫必然借对宫主星（borrowedStars 非空且来源为对宫）", () => {
			let emptyCount = 0;
			for (const { birth, chart } of charts) {
				for (const p of chart.palaces) {
					if (!p.isEmpty) continue;
					emptyCount++;
					assert.ok(Array.isArray(p.borrowedStars), `${label(birth)}：${p.name} 缺 borrowedStars`);
					assert.ok(p.borrowedStars.length > 0, `${label(birth)}：${p.name} 的 borrowedStars 为空`);
					assert.equal(
						p.borrowedFromBranch,
						(p.branch + 6) % 12,
						`${label(birth)}：${p.name} 的借宫来源应为对宫`
					);
				}
			}
			assert.ok(emptyCount > 0, "300 条基准中应存在空宫（否则该断言从未真正生效）");
		});
	});
});
