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

import { astro } from "iztro";

import type { BirthInfo, Palace, ZiweiChart } from "@/ziwei/types";
import { load, loadAlgorithm, loadConstants, loadPatterns, loadRender, loadSihua } from "./lib/loader.ts";
import { BRANCHES, type BaselineSample } from "./lib/compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const samples = readFileSync(resolve(HERE, "fixtures/charts.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map(line => JSON.parse(line) as BaselineSample);

const { generateChart } = await loadAlgorithm();
const { PALACE_NAMES_ORDER, IZTRO_TO_PROJECT_PALACE, SI_HUA_TABLE, STEMS } = await loadConstants();
const { detectPatterns, GEJU_NAME_ALIASES } = await loadPatterns();
const { ALL_BOOKS } = await load<typeof import("@/classics/index")>("@/classics/index");
const { getSiHuaByStem, getYearStemIndex, getLiuNianSiHua, getLiuYueStemIndex } = await loadSihua();
const { mustPalace, locateSihua } = await loadRender();

const MAJOR_STARS = [
	"紫微", "天机", "太阳", "武曲", "天同", "廉贞",
	"天府", "太阴", "贪狼", "巨门", "天相", "天梁",
	"七杀", "破军",
];
const LUCKY6 = ["文昌", "文曲", "左辅", "右弼", "天魁", "天钺"];
const SHA6 = ["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"];

type LabeledBirth = Pick<BirthInfo, "year" | "month" | "day" | "hour" | "gender">;
const label = (b: LabeledBirth): string => `${b.year}-${b.month}-${b.day}/${b.hour}/${b.gender}`;

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

		// ── 宫名口径：两条**不读映射表**的独立预言机 ──
		//
		// 背景：algorithm.ts 把 iztro 的宫名翻成项目口径（倪师《天纪》体系，见
		// constants.ts 的 IZTRO_TO_PROJECT_PALACE）。同一张表也被 test/lib/compare.ts
		// 用来翻译基准样本 —— 于是「表被写错」会让两边**一起**错、层 1 照旧全绿。
		// 这与 test/README.md 记录的 02 号历史事故（比对器与内核同源同错、341 项全绿）
		// 是同一个形状，必须用另一条计算路径堵上。
		//
		// 下面两条各走一条路径，且都不读那张映射表：一条连 iztro（外部词源），
		// 一条只做位置算术（不依赖 iztro，换代后仍有效）。
		describe("宫名口径（独立预言机）", () => {
			it("映射表的值集合与 PALACE_NAMES_ORDER 同集合", () => {
				const values = Object.values(IZTRO_TO_PROJECT_PALACE);
				assert.equal(new Set(values).size, 12, "映射表的值有重复（两宫会被翻成同一个名字）");
				assert.deepEqual(
					[...values].sort(),
					[...PALACE_NAMES_ORDER].sort(),
					"映射表与 PALACE_NAMES_ORDER 不是同集合"
				);
			});

			it("宫名 = iztro 原始名按独立规则改写（iztro 直连，不读映射表）", () => {
				// 期望值由 **iztro 自己返回的字符串** + 这里独立写出的改写规则算出，
				// 既不看 IZTRO_TO_PROJECT_PALACE，也不看 PALACE_NAMES_ORDER。
				// 映射表里任何一处置换（如「仆役」↔「夫妻」）都会在这里变红。
				// 宫名映射与具体盘无关，故抽样即可（每 20 条取 1）。
				const rewrite = (n: string): string => (n === "仆役" ? "交友宫" : n === "命宫" ? "命宫" : `${n}宫`);
				const pad2 = (n: number): string => String(n).padStart(2, "0");
				const seen = new Set<string>();

				for (const { birth, chart } of charts.filter((_, i) => i % 20 === 0)) {
					const astrolabe = astro.bySolar(
						`${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}`,
						birth.hour,
						birth.gender === "male" ? "男" : "女",
						true,
						"zh-CN"
					);
					for (const ip of astrolabe.palaces) {
						const b = BRANCHES.indexOf(ip.earthlyBranch);
						const ours = chart.palaces.find(p => p.branch === b);
						assert.ok(ours, `${label(birth)}：找不到地支 ${ip.earthlyBranch} 的宫`);
						assert.equal(
							ours.name,
							rewrite(ip.name),
							`${label(birth)}：iztro 的「${ip.name}」应改写为「${rewrite(ip.name)}」`
						);
						seen.add(ip.name);
					}
				}
				assert.equal(seen.size, 12, `只覆盖到 ${seen.size} 种 iztro 宫名，应覆盖全 12 种`);
			});

			it("宫名与「相对命宫的逆行偏移」一致（位置算术，不依赖 iztro）", () => {
				// 十二宫由命宫**逆行**排布：兄弟宫在命宫地支 −1，夫妻 −2，…，父母 +1。
				// （方向已用基准样本实测确认，别想当然写成顺行。）
				// 期望序列取自 PALACE_NAMES_ORDER —— **有序数组**，与映射表那张**无序词典**
				// 是两种不同形式的表示，改错一个不会连带另一个。
				for (const { birth, chart } of charts) {
					for (const p of chart.palaces) {
						const k = (chart.mingGongBranch - p.branch + 12) % 12;
						assert.equal(
							p.name,
							PALACE_NAMES_ORDER[k],
							`${label(birth)}：${BRANCHES[p.branch]}宫在偏移 ${k}，应为 ${PALACE_NAMES_ORDER[k]}`
						);
					}
				}
			});
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
						// brightness 是内核 mapBrightness 归并过的三档（类型上无 ""——空串形态
						// 只存在于基准样本一侧，见 lib/compare.ts 的归一化），此处无须再防。
						if (s.brightness !== undefined) {
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
			const NAMES: Record<number, string> = { 2: "水二局", 3: "木三局", 4: "金四局", 5: "土五局", 6: "火六局" };
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

		// ── 唯一一条用**外部预言机**核对「当前走哪一步大限」的断言 ──
		//
		// 上面三条只证明大限表**结构**自洽（12 步、首尾相接、宫位对得上），
		// 完全没有回答「此刻该走哪一步」—— 这正是曾经出错的地方：
		//
		//   algorithm.ts 曾写 `currentAge = new Date().getFullYear() - year`（**周岁**），
		//   而 daXianAge / daXians[].startAge 是**虚岁**（iztro 的 decadal.range，
		//   以正月初一为界）。两者域不同、公式却同形，于是 currentAge 恒偏 1~2 岁。
		//   更糟的是当时的比对器（lib/compare.ts 的 expectedAge）照抄了同一个公式，
		//   内核算错、测试跟着错，341 项全绿 —— 同源同错，bug 因此长期潜伏。
		//
		// 所以这条断言刻意**不复用内核与比对器的任何公式**，改用 iztro 自己的
		// `horoscope()`：用第三方实现的 `age.nominalAge` 与各宫 `decadal.range` 作真值。
		// 内核若再退回周岁、或换了别的口径，这里立刻变红。
		it("currentAge 与大限宫位对齐 iztro 的 horoscope()（外部预言机）", () => {
			const now = new Date();
			const pad2 = (n: number): string => String(n).padStart(2, "0");
			let decadal = 0;
			let childhood = 0;

			/**
			 * 用 iztro 独立核对一张盘，返回它落在「已起运」还是「童限」。
			 *
			 * `ready` 供调用方传入**已经排好的盘**：主循环那 60 条样本在模块加载时
			 * 就由 `charts`（第 45 行）排过一次，这里再排一遍纯属重复，约占本用例一半
			 * 耗时。省略 `ready` 则照常现排 —— `recent` 那 12 条盘不在 `charts` 里，走这条。
			 *
			 * 复用不改变断言语义：`generateChart` 对同一 `birthInfo` 是确定性的，
			 * `charts` 与本用例用的是同一份 `birthInfo`。唯一理论差异是 `currentAge`
			 * 依赖「此刻」，若模块加载与用例执行跨了**年份**边界会不一致 ——
			 * 两者相隔仅数秒，跨年概率可忽略。
			 */
			const check = (birth: LabeledBirth, ready?: ZiweiChart): "decadal" | "childhood" => {
				const chart = ready ?? generateChart({ ...birth });
				const tag = label(birth);
				const astrolabe = astro.bySolar(
					`${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}`,
					birth.hour,
					birth.gender === "male" ? "男" : "女",
					true,
					"zh-CN"
				);
				const h = astrolabe.horoscope(now);

				// 真值 1：虚岁
				assert.equal(chart.currentAge, h.age.nominalAge, `${tag}：currentAge 应为 iztro 的虚岁`);

				// 真值 2：哪个宫的大限区间含此虚岁（一个都找不到 = 尚未起运）
				const truth = astrolabe.palaces.find(
					p =>
						p.decadal &&
						h.age.nominalAge >= p.decadal.range[0] &&
						h.age.nominalAge <= p.decadal.range[1]
				);
				const marked = chart.palaces.filter(p => p.isCurrentDaXian);

				if (!truth) {
					assert.equal(chart.currentDaXianIndex, -1, `${tag}：未起运时 currentDaXianIndex 应为 -1`);
					assert.equal(marked.length, 0, `${tag}：未起运时不应标记 isCurrentDaXian`);
					return "childhood";
				}

				const dx = chart.daXians[chart.currentDaXianIndex];
				assert.ok(dx, `${tag}：currentDaXianIndex=${chart.currentDaXianIndex} 越界或为 -1`);
				assert.deepEqual([dx.startAge, dx.endAge], truth.decadal!.range, `${tag}：当前大限的年龄区间`);
				assert.equal(BRANCHES[dx.palaceBranch], truth.earthlyBranch, `${tag}：当前大限所在宫支`);
				assert.equal(marked.length, 1, `${tag}：应恰好标记 1 个 isCurrentDaXian`);
				assert.equal(marked[0].branch, dx.palaceBranch, `${tag}：isCurrentDaXian 标在了别的宫`);
				return "decadal";
			};

			// 基准样本：出生年 1924-1983，全部早已起运。horoscope() 较重，
			// 故每 5 条抽 1（60 条）以控制日常回归耗时。
			// 这 60 张盘 `charts` 已排好，直接复用，见上方 `check` 的 `ready` 参数。
			const sampled = charts.filter((_, i) => i % 5 === 0);
			let baseDecadal = 0;
			for (const { birth, chart } of sampled) {
				if (check(birth, chart) === "childhood") childhood++;
				else baseDecadal++;
			}
			decadal += baseDecadal;
			// 末尾那两条 `> 0` 是弱断言：只证明「至少分到了一条」，不证明**分对了**。
			// 基准样本最老的 1924 年生、最小的 1983 年生（今也已 40 余岁），必然条条已起运，
			// 所以这里钉死「全部落在 decadal」。计数若被写反，decadal 会塌成 recent 里
			// 的零星几条 —— 仍然 > 0，那两条弱断言照样全绿，只有这条会报出来。
			assert.equal(baseDecadal, sampled.length, "基准样本应全部已起运（计数写反会在此暴露）");

			// 童限分支：样本里永远走不到（最小的样本也已 43 岁），故另行构造近年出生的盘。
			// 「今天出生」必然虚岁 1，而五行局起运最早也要 2 岁（水二局），故必定落在童限 ——
			// 这样无论测试在哪一天跑，童限分支都保证被覆盖。
			const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
			const recent = [
				today,
				{ year: now.getFullYear() - 1, month: 1, day: 1 },
				{ year: now.getFullYear() - 1, month: 6, day: 15 },
				{ year: now.getFullYear() - 3, month: 3, day: 15 },
			];
			for (const base of recent) {
				for (const hour of [0, 6, 9]) {
					if (check({ ...base, hour, gender: "male" }) === "childhood") childhood++;
					else decadal++;
				}
			}

			assert.ok(decadal > 0, "应覆盖到已起运的盘（否则大限断言从未生效）");
			assert.ok(childhood > 0, "应覆盖到未起运的童限盘（否则童限分支从未生效）");
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
					assert.ok(p.borrowedStars!.length > 0, `${label(birth)}：${p.name} 的 borrowedStars 为空`);
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

	// ── 合盘的取宫入口 ──
	//
	// cmdHeming 取夫妻宫 / 福德宫一律经 mustPalace，它是按**项目口径宫名**精确查找的，
	// 取不到当场抛错 —— 与项目「宁可启动失败，也不静默产出错盘」的立场一致。
	// 上面「十二宫」块的偏移恒等式保证了 `chart.palaces` 的宫名与位置自洽；
	// 这里守的是**入口本身**的契约：只认全名，认不出就抛，不返回 undefined、也不退化匹配。
	describe("合盘取宫入口（mustPalace）", () => {
		it("12 个项目口径宫名都能取到，且落在偏移恒等式要求的位置", () => {
			for (const { birth, chart } of charts) {
				for (let k = 0; k < 12; k++) {
					const p = mustPalace(chart, PALACE_NAMES_ORDER[k]);
					assert.equal(
						p.branch,
						(chart.mingGongBranch - k + 12) % 12,
						`${label(birth)}：「${PALACE_NAMES_ORDER[k]}」应落在命宫地支 −${k}`
					);
				}
			}
		});

		it("iztro 旧口径与去宫字简写一律抛错（不静默退化）", () => {
			// `--focus` 确实接受「仆役」「夫妻」这类别名，但那是**参数解析层**的宽容
			// （见 cli/birth-info.ts 的归一化）。宽容若渗进取宫层，写错的名字就不会当场失败，
			// 而是悄悄取到「最像的那个宫」—— 正是本项目反复防的那种静默错盘。
			const chart = charts[0].chart;
			for (const bad of ["仆役", "仆役宫", "夫妻", "福德", "财帛", "兄弟", "命", ""])
				assert.throws(() => mustPalace(chart, bad), /找不到/, `「${bad}」不是项目口径全名，应当抛错`);
		});
	});

	// ── 生年四化落宫：合盘「四化入夫妻宫」的上游 ──
	//
	// cli/commands.ts 的 cmdHeming 按 `x.palace === fuqi.name` 判断四化是否落进夫妻宫，
	// 而 `x` 来自 cli/render.ts 的 locateSihua。这条链路上有两个**静默失效**口：
	//   1. 四化表（constants.ts 的 SI_HUA_TABLE）里某个星名写错 / 混进杂曜 ——
	//      locateSihua 找不到该星，返回 `palace: null` 而**不抛错**；
	//   2. locateSihua 的落宫口径漂移。
	// 两者都不报错，只是让合盘永远不命中，输出照旧是一句「双方夫妻宫均无生年四化落入」，
	// 读起来完全像正常结论。下面三条一律**不读 locateSihua 的实现**：期望值只来自
	// 「四化表给出的星名」与「那颗星在这张盘上的哪个宫」。
	describe("生年四化落宫（独立预言机）", () => {
		const HUA = ["禄", "权", "科", "忌"] as const;

		it("四化表涉及的星名都能在真实盘上找到", () => {
			// 一张盘即可：十四主星与六吉各恰好出现一次，是上面「星曜」块已断言的不变量。
			const onChart = new Set(charts[0].chart.palaces.flatMap(p => p.stars.map(s => s.name)));
			const missing = new Set<string>();
			for (const arr of Object.values(SI_HUA_TABLE))
				for (const star of arr) if (!onChart.has(star)) missing.add(star);
			assert.deepEqual([...missing], [], `四化表里这些星名在盘上找不到：${[...missing].join("、")}`);
		});

		it("四化只落在主星与文昌文曲左辅右弼上", () => {
			// 紫微斗数的知识约束：生年四化不化杂曜。表里混进杂曜（如「红鸾」）同样造成静默
			// 不命中，且比错字更难看出来 —— 它是个真实存在的星名，只是不参与四化。
			const allowed = new Set([...MAJOR_STARS, "文昌", "文曲", "左辅", "右弼"]);
			const bad = new Set<string>();
			for (const arr of Object.values(SI_HUA_TABLE))
				for (const star of arr) if (!allowed.has(star)) bad.add(star);
			assert.deepEqual([...bad], [], `四化表里出现了不该化的星：${[...bad].join("、")}`);
		});

		it("locateSihua 的落宫 = 按四化星名直接定位（逐盘）", () => {
			// 独立定位：拿星名到十二宫里逐个找。实现里另有一条「优先匹配主星席位」的
			// 分支（isMajor），也一并核对 —— 它决定了化曜是否被算作该宫的主星四化。
			for (const { birth, chart } of charts) {
				const transforms = getSiHuaByStem(getYearStemIndex(chart.birthInfo.year));
				const got = locateSihua(chart, transforms);
				assert.equal(got.length, HUA.length, `${label(birth)}：应返回四条四化`);
				for (const [i, hua] of HUA.entries()) {
					const x = got[i];
					assert.equal(x.hua, hua, `${label(birth)}：第 ${i} 条应是化${hua}`);
					assert.equal(x.star, transforms[hua], `${label(birth)}：化${hua}的星名与四化表不符`);
					const p = chart.palaces.find(pp => pp.stars.some(s => s.name === x.star));
					assert.equal(x.palace, p ? p.name : null, `${label(birth)}：${x.star} 的落宫不对`);
					assert.equal(x.branch, p ? BRANCHES[p.branch] : null, `${label(birth)}：${x.star} 的落宫地支不对`);
					assert.equal(
						x.isMajor,
						!!(p && p.stars.some(s => s.name === x.star && s.type === "major")),
						`${label(birth)}：${x.star} 的 isMajor 与星席位不符`
					);
				}
			}
		});
	});

	// ── 格局识别：两个「静默失效」点 ──
	//
	// patterns.ts 的 detectHuaLuRuCai / detectHuaQuanRuGuan 按**宫名**查找
	// （原先写 `p.name === "财帛"`）。宫名口径改为项目本位后，若不跟着改，这类失效
	// **不报错** —— 两个函数都带 `if (!cai) return` 守卫，格局只是从此永不触发，
	// 输出里静悄悄地少两条判词。
	//
	// 期望值刻意**不走宫名**，改走安星法给出的偏移算术：财帛宫 = 命宫偏移 4，
	// 官禄宫 = 偏移 8（十二宫由命宫逆行排布，见上面的偏移恒等式）。
	// 实现按宫名找、断言按偏移算 —— 两条路径不同，才不是复读机。
	describe("流年/流月四化（独立预言机）", () => {
		// 生年四化（上一组）之外，三合派三层四化还有「流年 / 流月」两动态层：
		// `getLiuNianSiHua`（公历年 → 年干，刻意**不**切农历年界）与
		// `getLiuYueSiHua`（五虎遁：流年干 + 农历月序 → 月干）。
		// 此前测试只有「--liunian 非数字报错」一条边角断言，两函数的**算术**零覆盖。
		// 期望值若照抄实现公式就只是复读机，这里全部换第三条路径：
		//   · 五虎遁 ← 口诀独立表（120 格逐格写死，与实现的 startStemOfYin 零共享）
		//   · 流年年干 ← lunar-typescript 年柱 + 万年历固定向量（两条互不相干的路径）

		it("五虎遁月干：全 120 格（10 年干 × 12 农历月）与口诀独立表一致", () => {
			// 口诀：甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，
			//       丁壬壬位顺行流，戊癸何方发，甲寅之上好追求。
			// 正月（寅月）天干由此起，逐月顺推一位。
			const firstStemOfYinByChant: Record<number, number> = {
				0: 2, 5: 2, // 甲己 → 丙
				1: 4, 6: 4, // 乙庚 → 戊
				2: 6, 7: 6, // 丙辛 → 庚
				3: 8, 8: 8, // 丁壬 → 壬
				4: 0, 9: 0, // 戊癸 → 甲
			};
			for (let s = 0; s < 10; s++) {
				for (let m = 1; m <= 12; m++) {
					const expected = (firstStemOfYinByChant[s]! + m - 1) % 10;
					assert.equal(
						getLiuYueStemIndex(s, m),
						expected,
						`${STEMS[s]}年农历${m}月的月干应为${STEMS[expected]}，口诀表与实现分叉`
					);
				}
			}
		});

		it("流年年干与 lunar-typescript 年柱逐年一致（1924–2100）", async () => {
			// 取**年中**（公历 6 月 15 日）取年柱：远离立春（约 2 月）与正月初一
			// （1–2 月）两个切年边界，年干无歧义。lunar-typescript 的 getYearInGanZhi()
			// 按正月初一切年（与本项目同口径），getYearInGanZhiByLiChun() 才是立春界 ——
			// 年中日期两种切法结果相同，故此断言对切年口径不敏感。
			const { Solar } = await import("lunar-typescript");
			for (let y = 1924; y <= 2100; y++) {
				const ganZhi = Solar.fromYmd(y, 6, 15).getLunar().getYearInGanZhi();
				const expected = STEMS.indexOf(ganZhi[0]!);
				assert.ok(expected >= 0, `lunar 年柱「${ganZhi}」的天干不在 STEMS 里`);
				assert.equal(
					getLiuNianSiHua(y).stemIndex,
					expected,
					`${y} 年流年干应为${ganZhi[0]}，实现与 lunar-typescript 年柱分叉`
				);
			}
		});

		it("流年年干的万年历固定向量（第三条路径，防 lunar 与实现同错）", () => {
			// 纸面常识写死的已知年份（干支纪年与公历的通行对应），不依赖任何库。
			// 上一条验的是「实现与 lunar 一致」，这条验「两者**共同**的答案没一起错」。
			const known: Array<[number, string]> = [
				[1900, "庚"], [1984, "甲"], [1996, "丙"], [2000, "庚"], [2024, "甲"], [2026, "丙"],
			];
			for (const [y, stem] of known) {
				assert.equal(getLiuNianSiHua(y).stemName, stem, `${y} 年流年干的通行口径为${stem}`);
			}
		});
	});

	describe("格局识别：化禄入财 / 化权入官（按偏移算术核对）", () => {
		const OFFSET_CAI = 4; // 财帛宫
		const OFFSET_GUAN = 8; // 官禄宫
		const palaceAt = (chart: ZiweiChart, offset: number): Palace | undefined =>
			chart.palaces.find(p => p.branch === (chart.mingGongBranch - offset + 12) % 12);

		for (const { name, offset, siHua } of [
			{ name: "化禄入财", offset: OFFSET_CAI, siHua: "禄" },
			{ name: "化权入官", offset: OFFSET_GUAN, siHua: "权" },
		] as const) {
			it(`${name}：当且仅当偏移 ${offset} 之宫的主星带化${siHua}`, () => {
				let yes = 0;
				let no = 0;
				for (const { birth, chart } of charts) {
					const p = palaceAt(chart, offset);
					assert.ok(p, `${label(birth)}：偏移 ${offset} 处没有宫位`);
					const should = p!.stars.some(s => s.type === "major" && s.siHua === siHua);
					const got = detectPatterns(chart).some(x => x.name === name);
					assert.equal(
						got,
						should,
						`${label(birth)}：${p!.name}（偏移 ${offset}）主星化${siHua}=${should}，但格局识别=${got}`
					);
					if (should) yes++;
					else no++;
				}
				// 两侧都要有样本，否则断言可能在「全 false」上空转全绿
				assert.ok(yes > 0, `300 条样本里没有一条化${siHua}入该宫，正例侧未生效`);
				assert.ok(no > 0, `300 条样本里全部化${siHua}入该宫，反例侧未生效`);
			});
		}

		// ── 格局识别：82 个格局名的独立预言机 ──
		//
		// patterns.ts（51 个 detect 函数）产出 **82 个**格局名，此前零基准。
		// （2026-09-26 起「机月同梁三星会」并入「机月同梁」，故比原先少 1 名、少 1 个识别器；
		//   2026-09-27 起 db-analysis 侧的 12 个格局判定也收敛进来，故比原先多 13 名、多 11 个识别器
		//   —— 「文昌守命 / 文曲守命」由同一个识别器产出。）
		//
		// 【独立性从哪来】
		// 实现定位三方四正 / 夹宫走的是**地支算术**（getSanFangPalaces 的 `[m,(m+4),(m+8),(m+6)]`、
		// getJiaPalaces 的 `(b±1)`）；下面一律走**宫名**（"财帛宫"、"兄弟宫"…），同宫类则走
		// 「找共同容器」而实现是「分别定位再比地支」。两条路径在「怎么从 chart 找到那几个宫」
		// 这一步分岔，任一侧写错都会对不上。宫名本身的正确性由上面「十二宫」块的两条偏移恒等式
		// 独立保证 —— 分层验证，不是同源复读。
		//
		// 【效力边界 · 别高估】
		// · 只核对「格局**是否触发**」。level（90/75/…）不覆盖 —— 它由 bonus/breaking
		//   决定，属判词分级；description / conditions 的文案同理不覆盖
		// · 「昌曲夹命」「火铃夹命」在 300 条基准里触发 **0** 次，其断言是**空转**的，已显式登记
		// · 预言机复刻的是**实现当前的口径**，不是照命理理想口径重写。两处口径曾与实现分歧
		//   （火贪/铃贪的会照范围、紫府同宫是否限命/迁），2026-09-26 已按「与 topic 侧统一」定案，
		//   见 tanWithSha 与紫府同宫两处的说明 —— 现在是**照定案口径**复刻
		// · 「羊陀夹命」与「禄存守命」在 300 条基准上**判定完全相同**（安星法使然，实测 0/300
		//   差异）。两条预言机都在，但它们是同一条命理事实的两面，不是两条独立证据
		describe("格局识别", () => {
			// ══ 定位基础设施：一律走宫名 ══
			const SANFANG_NAMES = ["命宫", "财帛宫", "官禄宫", "迁移宫"];
			const JIA_NAMES = ["兄弟宫", "父母宫"];

			// 参数 n 放宽为 string | undefined：身宫按地支定位时可能取不到宫名（palaceNameOfBranch），
			// 此时 find 不命中、?. 兜底空集，与运行时行为一致。
			const palaceNamed = (chart: ZiweiChart, n: string | undefined): Palace | undefined =>
				chart.palaces.find(p => p.name === n);
			const starsNamed = (chart: ZiweiChart, n: string | undefined) => palaceNamed(chart, n)?.stars ?? [];
			const namesNamed = (chart: ZiweiChart, n: string | undefined): string[] =>
				starsNamed(chart, n).map(s => s.name);
			const majorOf = (chart: ZiweiChart, n: string | undefined) => starsNamed(chart, n).filter(s => s.type === "major");
			const siHuaStarsIn = (chart: ZiweiChart, n: string | undefined, hua: string) =>
				starsNamed(chart, n).filter(s => s.siHua === hua);
			const siHuaMajorNames = (chart: ZiweiChart, n: string | undefined, hua: string): string[] =>
				majorOf(chart, n).filter(s => s.siHua === hua).map(s => s.name);
			const sanFangNames = (chart: ZiweiChart): string[] => SANFANG_NAMES.flatMap(n => namesNamed(chart, n));
			const palaceOfStar = (chart: ZiweiChart, s: string): Palace | undefined =>
				chart.palaces.find(p => p.stars.some(x => x.name === s));
			const hasAll = (arr: string[], ...xs: string[]): boolean => xs.every(x => arr.includes(x));
			const offsetBetween = (from: number, to: number): number => (to - from + 12) % 12;

			/** 三方四正里是否有星带某四化（不限 major）—— 三奇加会 / 双禄朝垣用。 */
			function hasSiHuaInSanFang(chart: ZiweiChart, hua: string): boolean {
				return SANFANG_NAMES.some(n => siHuaStarsIn(chart, n, hua).length > 0);
			}
			/** 三方四正里是否有**主星**带某四化 —— 科权双会用（实现限定 type === "major"）。 */
			function hasMajorSiHuaInSanFang(chart: ZiweiChart, hua: string): boolean {
				return SANFANG_NAMES.some(n => majorOf(chart, n).some(s => s.siHua === hua));
			}
			/** 地支 → 该支上的宫名（身宫按地支定位，宫名表里没有「身宫」这一宫）。 */
			function palaceNameOfBranch(chart: ZiweiChart, branch: number): string | undefined {
				return chart.palaces.find(p => p.branch === branch)?.name;
			}

			/** 夹命：一颗星在兄弟宫、另一颗在父母宫（两宫＝命宫地支 −1 / +1）。 */
			const jiaPair = (chart: ZiweiChart, a: string, b: string): boolean =>
				(namesNamed(chart, "兄弟宫").includes(a) && namesNamed(chart, "父母宫").includes(b)) ||
				(namesNamed(chart, "兄弟宫").includes(b) && namesNamed(chart, "父母宫").includes(a));

			/** 同宫：两星落在同一个宫（实现是「分别定位再比坐标」，这里是「找共同容器」）。 */
			const sharePalace = (chart: ZiweiChart, a: string, b: string): boolean => {
				const x = palaceOfStar(chart, a);
				const y = palaceOfStar(chart, b);
				return !!x && !!y && x.name === y.name;
			};

			/** 紫微落在命宫或迁移宫（紫府同宫的附加域限制，实现走地支 `(命宫+6)%12`，这里走宫名）。 */
			const ziFuInMingOrQianYi = (chart: ZiweiChart): boolean => {
				const p = palaceOfStar(chart, "紫微");
				return !!p && (p.name === "命宫" || p.name === "迁移宫");
			};

			/** 某星是否入庙（bright）。亮度是排盘产出的事实，两侧无第二条独立路径可走。 */
			const brightStar = (chart: ZiweiChart, s: string): boolean => {
				const p = palaceOfStar(chart, s);
				return p?.stars.find(x => x.name === s)?.brightness === "bright";
			};

			/** 某星是否带指定四化（不限宫、不限主星）。 */
			const starHasHua = (chart: ZiweiChart, s: string, hua: string): boolean => {
				const p = palaceOfStar(chart, s);
				return !!p && p.stars.some(x => x.name === s && x.siHua === hua);
			};

			/** 火贪 / 铃贪：煞星与贪狼**同宫**（不含会照，也不引用命宫）。
			 *
			 *  ⚠️ **本口径于 2026-09-26 由「两套引擎对齐」定案，取 topic 侧（`db-analysis.ts` 的
			 *  `detectGeJu`）为准**，不是照命理理想口径重写。此前两侧各有一套：
			 *  analyze 侧要求「贪狼在命宫三方四正 + 煞星与贪狼互为三方四正」（且因三方四正不可传递，
			 *  实测 32 次命中里有 12 次的煞星其实照不到命宫）；topic 侧只要求同宫。
			 *  合并后 analyze 侧改为同宫，**代价是格局不再锚定命宫** —— 贪狼在田宅宫逢火铃也会计入。
			 *
			 *  同宫时火铃并存只出「火贪格」（沿用 topic 的 `else if`），故铃贪的预言机要排除火贪。 */
			const tanWithSha = (chart: ZiweiChart, shaName: string): boolean => {
				const tan = palaceOfStar(chart, "贪狼");
				const sha = palaceOfStar(chart, shaName);
				return !!tan && !!sha && tan.name === sha.name;
			};

			// ══ 预言机表：格局名 → 「是否应当触发」 ══
			// 非空断言（palaceNamed(c, "命宫")! 等）：十二宫名两两不同且必齐是上面已断言的
			// 不变量，取「命宫」必然命中；实现原样依赖这一点（any 时代取不到即 TypeError），
			// 迁移时用 ! 保持同一失败形态，不悄悄改成静默兜底。
			const ORACLE: Record<string, (c: ZiweiChart) => boolean> = {
				// ── 三方四正包含类 ──
				杀破狼: c => hasAll(sanFangNames(c), "七杀", "破军", "贪狼"),
				// 机月同梁：命宫**三方四正**会齐四星中任意 ≥3 颗。四星齐 level 90，只齐三星 level 60
				// 并在 conditions.breaking 记「不全格」—— 但**触发与否只看 ≥3**，分级不进预言机。
				//
				// 2026-09-26 前这里是「四星齐才触发」，恰好三星的盘另有一个独立格局名
				// 「机月同梁三星会」（level 60）；现合并为单一「机月同梁」，故本行的阈值从 `=== 4`
				// 放宽到 `>= 3`（口径即「两个旧格局的并集」，26 + 55 = 81 盘）。
				//
				// ⚠️ 别再把它收窄成「命宫**三方**（不含迁移宫）」—— 实测那样只剩 26 盘、
				// 55 盘的三星盘一盘不中（四星在命宫三方的个数恒为 0/1/2/4，**永不为 3**），
				// 等于把 analyze 独有的降级覆盖整段删掉，而 topic 侧本来就不报这 55 盘（无矛盾可消）。
				机月同梁: c =>
					["天机", "太阴", "天同", "天梁"].filter(s => sanFangNames(c).includes(s)).length >= 3,
				三奇加会: c => ["禄", "权", "科"].every(h => hasSiHuaInSanFang(c, h)),
				双禄朝垣: c => hasSiHuaInSanFang(c, "禄") && sanFangNames(c).includes("禄存"),
				廉杀羊: c => hasAll(sanFangNames(c), "廉贞", "七杀", "擎羊"),
				巨火羊: c => hasAll(sanFangNames(c), "巨门", "火星", "擎羊"),
				铃昌陀武: c => hasAll(sanFangNames(c), "铃星", "文昌", "陀罗", "武曲"),
				昌曲同会: c =>
					hasAll(sanFangNames(c), "文昌", "文曲") &&
					!(namesNamed(c, "命宫").includes("文昌") && namesNamed(c, "命宫").includes("文曲")),
				昌曲坐命: c =>
					hasAll(sanFangNames(c), "文昌", "文曲") &&
					namesNamed(c, "命宫").includes("文昌") &&
					namesNamed(c, "命宫").includes("文曲"),
				辅弼同会: c => hasAll(sanFangNames(c), "左辅", "右弼"),
				魁钺同会: c => hasAll(sanFangNames(c), "天魁", "天钺"),
				科权双会: c => hasMajorSiHuaInSanFang(c, "科") && hasMajorSiHuaInSanFang(c, "权"),
				君臣庆会: c =>
					namesNamed(c, "命宫").includes("紫微") && hasAll(sanFangNames(c), "左辅", "右弼"),
				阳梁昌禄: c => hasAll(sanFangNames(c), "太阳", "天梁", "文昌", "禄存"),

				// ── 同宫 / 对宫类 ──
				// 紫府同宫：紫微天府同宫，且该宫是命宫或迁移宫（2026-09-26 由「任一同宫」收窄，
				// 取 topic 侧 detectGeJu 的口径 —— 它只认 `hasStar('命宫'|'迁移', ...)`）。
				紫府同宫: c => sharePalace(c, "紫微", "天府") && ziFuInMingOrQianYi(c),

				// 名取古籍简称「廉相格」（全集·卷四「廉贞与天相同宫为『廉相格』」），
				// 见 patterns.ts 的 GEJU_NAME_ALIASES。
				廉相格: c => sharePalace(c, "廉贞", "天相"),
				武曲七杀: c => sharePalace(c, "武曲", "七杀"),
				天同天梁格: c => sharePalace(c, "天同", "天梁"),
				武贪格: c => {
					const w = palaceOfStar(c, "武曲");
					const t = palaceOfStar(c, "贪狼");
					if (!w || !t) return false;
					const d = offsetBetween(w.branch, t.branch);
					if (d !== 0 && d !== 6) return false;
					return SANFANG_NAMES.includes(w.name) || SANFANG_NAMES.includes(t.name);
				},
				日月同宫: c => {
					const s = palaceOfStar(c, "太阳");
					const m = palaceOfStar(c, "太阴");
					return !!s && !!m && s.name === m.name && (s.branch === 1 || s.branch === 7);
				},
				巨日同宫: c => {
					const j = palaceOfStar(c, "巨门");
					const s = palaceOfStar(c, "太阳");
					return !!j && !!s && j.name === s.name && (j.branch === 2 || j.branch === 8);
				},
				府相朝垣: c => {
					const f = palaceOfStar(c, "天府");
					const x = palaceOfStar(c, "天相");
					if (!f || !x || f.name === x.name) return false;
					return SANFANG_NAMES.includes(f.name) && SANFANG_NAMES.includes(x.name);
				},
				火贪格: c => tanWithSha(c, "火星"),
				铃贪格: c => !tanWithSha(c, "火星") && tanWithSha(c, "铃星"),

				// ── 夹宫类 ──
				日月夹命: c => jiaPair(c, "太阳", "太阴"),
				辅弼夹命: c => jiaPair(c, "左辅", "右弼"),
				昌曲夹命: c => jiaPair(c, "文昌", "文曲"),
				魁钺夹命: c => jiaPair(c, "天魁", "天钺"),
				火铃夹命: c => jiaPair(c, "火星", "铃星"),
				空劫夹命: c => jiaPair(c, "地空", "地劫"),
				羊陀夹忌: c => siHuaStarsIn(c, "命宫", "忌").length > 0 && jiaPair(c, "擎羊", "陀罗"),

				// ── 单星坐宫类 ──
				石中隐玉: c => {
					const m = palaceNamed(c, "命宫")!;
					return namesNamed(c, "命宫").includes("巨门") && (m.branch === 0 || m.branch === 6);
				},
				马头带箭: c => palaceNamed(c, "命宫")!.branch === 6 && namesNamed(c, "命宫").includes("擎羊"),
				明珠出海: c =>
					palaceNamed(c, "命宫")!.branch === 7 &&
					majorOf(c, "命宫").length === 0 &&
					hasAll(namesNamed(c, "迁移宫"), "太阳", "太阴"),
				紫微入命: c =>
					namesNamed(c, "命宫").includes("紫微") && !namesNamed(c, "命宫").includes("天府"),
				禄存守命: c => namesNamed(c, "命宫").includes("禄存"),
				禄存守身: c => {
					const p = palaceOfStar(c, "禄存");
					return !!p && p.branch === c.shenGongBranch && p.branch !== c.mingGongBranch;
				},
				天马入命: c => namesNamed(c, "命宫").includes("天马"),
				天马在迁: c => palaceOfStar(c, "天马")?.name === "迁移宫",

				// ── 四化入宫类（固定名） ──
				化禄入财: c => siHuaMajorNames(c, "财帛宫", "禄").length > 0,
				化权入官: c => siHuaMajorNames(c, "官禄宫", "权").length > 0,
				化科入命: c => siHuaMajorNames(c, "命宫", "科").length > 0,
				化科入身: c =>
					siHuaMajorNames(c, "命宫", "科").length === 0 &&
					palaceNamed(c, "命宫")!.branch !== c.shenGongBranch &&
					siHuaMajorNames(c, palaceNameOfBranch(c, c.shenGongBranch), "科").length > 0,

				// ── 2026-09-27 由 db-analysis 收敛进来的 12 个格局名 ──
				// 这些名字此前只在 `detectGeJu` 里手写判定（topic 命令的展示判词）。
				// 现在判定搬进 patterns.ts，本组预言机按**同样口径**复刻 —— 复刻的是迁过来的口径本身，
				// 不是照命理理想口径重写；有分歧要改的是实现与预言机两边，不是只改一边。
				七杀朝斗格: c => {
					const p = palaceOfStar(c, "七杀");
					if (!p) return false;
					// 寅=2 / 申=8：这里走地支**名**，实现走地支**索引**，两条路径在「寅申是哪两支」上分岔
					if (BRANCHES[p.branch] !== "寅" && BRANCHES[p.branch] !== "申") return false;
					return p.name === "命宫" || p.name === "迁移宫";
				},
				// 日月并明：太阳、太阴**同时**入庙（不限宫位，也不要求同宫 —— 后者是「日月同宫」）
				日月并明格: c => brightStar(c, "太阳") && brightStar(c, "太阴"),
				英星入庙格: c => {
					const m = palaceNamed(c, "命宫")!;
					return (
						namesNamed(c, "命宫").includes("破军") &&
						(BRANCHES[m.branch] === "子" || BRANCHES[m.branch] === "午")
					);
				},
				日丽中天格: c =>
					BRANCHES[palaceNamed(c, "命宫")!.branch] === "午" && namesNamed(c, "命宫").includes("太阳"),

				// 昌曲守命：两者同在命宫时只出「文昌守命」（实现取了文昌优先，故文曲那行要排除文昌）
				文昌守命: c => namesNamed(c, "命宫").includes("文昌"),
				文曲守命: c => !namesNamed(c, "命宫").includes("文昌") && namesNamed(c, "命宫").includes("文曲"),
				擎羊入命: c => namesNamed(c, "命宫").includes("擎羊"),

				禄马交驰格: c => {
					const lu = palaceOfStar(c, "禄存");
					const ma = palaceOfStar(c, "天马");
					if (!lu || !ma) return false;
					return lu.name === ma.name || (SANFANG_NAMES.includes(lu.name) && SANFANG_NAMES.includes(ma.name));
				},
				// 羊陀夹命：擎羊陀罗分居命宫两侧。
				// ⚠️ 实测它与「禄存守命」在 300 条基准上**判定完全相同（0/300 差异）**——
				// 这是安星法的必然：擎羊恒在禄存前一位、陀罗恒在后一位，故羊陀夹的永远是禄存所在宫。
				// 保留为两个名字是照 topic 侧的展示口径（那边两个都报），不是判定分歧。
				羊陀夹命: c => jiaPair(c, "擎羊", "陀罗"),
				紫府朝垣格: c =>
					hasAll(sanFangNames(c), "紫微", "天府") &&
					!namesNamed(c, "命宫").includes("紫微") &&
					!namesNamed(c, "命宫").includes("天府"),
				天马落空: c => {
					const p = palaceOfStar(c, "天马");
					return !!p && p.stars.some(s => ["地空", "地劫", "旬空", "截路"].includes(s.name));
				},
				文昌化忌: c => starHasHua(c, "文昌", "忌"),
				文曲化忌: c => starHasHua(c, "文曲", "忌"),
			};

			// 名字由星名派生的格局：逐个穷举不现实，改断「后缀匹配到的名字集合」
			const DERIVED = [
				{ suffix: "化禄入命", palace: "命宫", hua: "禄" },
				{ suffix: "化忌入命", palace: "命宫", hua: "忌" },
				{ suffix: "化忌冲命", palace: "迁移宫", hua: "忌" },
			] as const;
			const DERIVED_SUFFIXES = DERIVED.map(d => d.suffix);

			// 一次算完供下列各 it 复用（否则 70 × 300 次 detectPatterns 太浪费）
			const detected = charts.map(({ chart }) => new Set(detectPatterns(chart).map(p => p.name)));

			// 300 条基准里触发 **0** 次的格局：断言会退化成空转，显式登记而非静默通过。
			// 将来样本能触发它们时下面会失败，提醒把名字从这里删掉、让它回归真断言。
			const NO_HIT_IN_FIXTURES = new Set(["昌曲夹命", "火铃夹命"]);

			for (const [name, shouldFire] of Object.entries(ORACLE)) {
				it(`${name}：逐盘与独立预言机一致`, () => {
					let yes = 0;
					let no = 0;
					for (const [i, { birth, chart }] of charts.entries()) {
						const should = shouldFire(chart);
						const got = detected[i].has(name);
						assert.equal(
							got,
							should,
							`${label(birth)}：预言机=${should}，实现=${got}（命宫在${BRANCHES[chart.mingGongBranch]}）`
						);
						if (should) yes++;
						else no++;
					}
					// 两侧都要有样本，否则断言可能在「全 false / 全 true」上空转全绿
					if (NO_HIT_IN_FIXTURES.has(name)) {
						assert.equal(yes, 0, `${name} 已被触发 ${yes} 次，请从 NO_HIT_IN_FIXTURES 移除`);
					} else {
						assert.ok(yes > 0, `${name} 在 300 条基准里一次都没触发，正例侧未生效`);
					}
					assert.ok(no > 0, `${name} 在 300 条基准里全部触发，反例侧未生效`);
				});
			}

			describe("派生名格局（按星名展开）", () => {
				for (const { suffix, palace, hua } of DERIVED) {
					it(`*${suffix}：与「${palace}主星带化${hua}」一一对应`, () => {
						let hits = 0;
						for (const [i, { birth, chart }] of charts.entries()) {
							const want = siHuaMajorNames(chart, palace, hua)
								.map(s => `${s}${suffix}`)
								.sort();
							const got = [...detected[i]].filter(n => n.endsWith(suffix)).sort();
							assert.deepEqual(got, want, `${label(birth)}：*${suffix} 的名字集合不符`);
							hits += want.length;
						}
						assert.ok(hits > 0, `300 条基准里没有任何 *${suffix}，断言是空转的`);
					});
				}
			});

			// ── 输出结构不变量：与判定逻辑无关，管的是「产出的东西是不是良构」 ──
			describe("输出结构", () => {
				const LEVELS = new Set([90, 75, 60, 40]);
				const LEGAL_PALACES = new Set([...PALACE_NAMES_ORDER, "身宫"]);

				it("每条 Pattern 的字段完整且取值合法", () => {
					let total = 0;
					for (const { birth, chart } of charts) {
						for (const p of detectPatterns(chart)) {
							total++;
							const at = `${label(birth)} 的「${p.name}」`;
							assert.ok(p.name && typeof p.name === "string", `${at}：name 缺失`);
							assert.ok(LEVELS.has(p.level), `${at}：level 非法（${p.level}）`);
							assert.ok(p.description?.length! > 0, `${at}：description 为空`);
							assert.ok(Array.isArray(p.palaces) && p.palaces.length > 0, `${at}：palaces 为空`);
							for (const pn of p.palaces) {
								assert.ok(LEGAL_PALACES.has(pn), `${at}：palaces 含非法宫名「${pn}」`);
							}
							assert.ok(p.conditions?.required?.length! > 0, `${at}：conditions.required 为空`);
							assert.ok(p.source?.length! > 0, `${at}：source 缺失`);
						}
					}
					assert.ok(total > 1000, `300 条盘只产出 ${total} 条格局，明显偏少`);
				});

				it("同一张盘不返回重名格局", () => {
					for (const { birth, chart } of charts) {
						const names = detectPatterns(chart).map(p => p.name);
						assert.equal(new Set(names).size, names.length, `${label(birth)}：出现重名格局`);
					}
				});

				it("没有未被预言机覆盖的格局名（新增格局须同步补预言机）", () => {
					const covered = new Set(Object.keys(ORACLE));
					const uncovered = new Set<string>();
					for (const set of detected) {
						for (const n of set) {
							if (covered.has(n)) continue;
							if (DERIVED_SUFFIXES.some(sfx => n.endsWith(sfx))) continue;
							uncovered.add(n);
						}
					}
					assert.deepEqual(
						[...uncovered].sort(),
						[],
						`以下格局名没有任何预言机覆盖：${[...uncovered].join("、")}`
					);
				});
			});
		});
	});
});

// ── 层 3（续）：格局名的「同现象异名」裁决 ──
//
// 判定早已收敛到一处，但历史上 analyze 与 topic 各叫各的（实测星名集合 0/300
// 不一致，纯命名差异）。2026-09-27 统一显示名，裁决结果记在 patterns.ts 的
// GEJU_NAME_ALIASES。
//
// 裁决依据分两种，**本组按 basis 分别设防**：
// - `corpus`：显示名取**本仓古籍库词频最高者**。期望值来自古籍库**重算**，
//   不是复述常量表——表里的数字是人工实测的，语料一改就作废，变红时该
//   **重新裁决**，不是把表里的数字改大。
// - `convention`：古籍不足以裁决（双零，或两种写法并用且样本仅个位数），
//   改按书写约定统一。这类条目**允许平手甚至落败**，但必须写明理由。
describe("格局名裁决（同现象异名）", () => {
	const paragraphs = ALL_BOOKS.flatMap(b =>
		b.chapters.flatMap(ch => ch.paragraphs.map(p => ({ text: p.text })))
	);
	/** 原文子串计数（与裁决时的口径一致：不区分语境，只比大小） */
	const freq = (name: string): number =>
		paragraphs.reduce((n, p) => n + (p.text.split(name).length - 1), 0);

	it("裁决表结构完整：每条都有异名可对照、有出处、basis 合法、counts 覆盖全部名字", () => {
		assert.ok(GEJU_NAME_ALIASES.length > 0, "裁决表为空");
		for (const a of GEJU_NAME_ALIASES) {
			assert.ok(a.aliases.length > 0, `「${a.canonical}」没有异名，不该进裁决表`);
			assert.ok(a.sources.trim().length > 0, `「${a.canonical}」缺少古籍出处`);
			assert.ok(
				a.basis === "corpus" || a.basis === "convention",
				`「${a.canonical}」的 basis 非法：${String(a.basis)}`
			);
			for (const n of [a.canonical, ...a.aliases])
				assert.ok(n in a.counts, `「${a.canonical}」的 counts 缺名字「${n}」`);
		}
	});

	it("basis=convention 的条目必须写明为何不走词频", () => {
		// 「书写统一」与「古籍词频裁决」是两种依据，不能混为一谈。词频裁不了的条目
		// 若连理由都不写，后人只会看到一堆平手的数字，无从判断当初是怎么定的。
		for (const a of GEJU_NAME_ALIASES.filter(x => x.basis === "convention"))
			assert.ok(
				(a.note ?? "").trim().length > 0,
				`「${a.canonical}」basis=convention 却没写 note —— 必须说明为何古籍不足以裁决`
			);
	});

	it("表里记的词频与古籍库重算结果逐一对得上", () => {
		for (const a of GEJU_NAME_ALIASES)
			for (const [name, recorded] of Object.entries(a.counts))
				assert.equal(
					freq(name),
					recorded,
					`「${name}」表记 ${recorded} 次，古籍库实为 ${freq(name)} 次 —— 语料变了，该重新裁决`
				);
	});

	it("basis=corpus 的条目：现用名词频严格高于它的每一个异名", () => {
		// 只看 corpus —— convention 类本就是「古籍裁不了」才走约定的，允许平手或落败。
		// 这条断言若因语料更新而变红，说明裁决结论该重审。
		for (const a of GEJU_NAME_ALIASES.filter(x => x.basis === "corpus"))
			for (const alias of a.aliases)
				assert.ok(
					a.counts[a.canonical] > a.counts[alias],
					`「${a.canonical}」(${a.counts[a.canonical]}) 未高于异名「${alias}」(${a.counts[alias]}) —— 该重新裁决，而不是改数字`
				);
	});

	it("落选的异名不再出现在任何排盘产出里（300 条基准逐盘扫）", () => {
		for (const [i, { birth, chart }] of charts.entries()) {
			const where = `${birth.year}-${birth.month}-${birth.day}`;
			for (const p of detectPatterns(chart))
				for (const a of GEJU_NAME_ALIASES)
					for (const alias of a.aliases)
						assert.ok(
							!p.name.endsWith(alias),
							`第 ${i} 张盘（${where}）产出旧名「${p.name}」—— 应已统一为「${a.canonical}」`
						);
		}
	});
});

// ── 层 3（续）：topic 侧长判词的守卫 ──
//
// topic 的 `overview` / `personality` 展示 `Pattern.topicDescription`（倪师口吻长判词）。
// 这层长期**零测试覆盖**：判词写错、漏写、或旧的展示标记回流进名字，都不会有断言变红
// —— 2026-09-27 把 25 段判词从 db-analysis.ts 搬进各识别器时，一并补上这组守卫。
//
// 口径是**名册双向匹配**：代码里有判词的名字必须都在名册上，名册上的每一条也必须
// 都能在基准里找到对应 —— 「新增格局忘了写判词」与「写了判词没登记」都会红。
describe("topic 长判词（Pattern.topicDescription）", () => {
	/**
	 * 名册：当前**应该**带长判词的格局名。星名派生的用 `*` 通配前缀
	 * （`*化禄入命` 覆盖「太阳化禄入命」「武曲化禄入命」…）。
	 *
	 * 增删判词时同步这张表 —— 它是「哪些格局在 topic 侧展示」的唯一书面记录。
	 */
	const ROSTER = [
		"七杀朝斗格", "双禄朝垣", "天马落空", "廉相格", "擎羊入命",
		"文昌化忌", "文昌守命", "文曲化忌", "文曲守命",
		"日丽中天格", "日月同宫", "日月夹命", "日月并明格",
		"机月同梁", "杀破狼", "武曲七杀", "火贪格", "禄存守命",
		"禄马交驰格", "紫府同宫", "紫府朝垣格", "羊陀夹命",
		"英星入庙格", "辅弼夹命", "铃贪格", "魁钺夹命",
		"*化禄入命", "*化忌入命", "*化忌冲命",
	];
	/** 名册项与格局名的匹配：含 `*` 的按前后缀，否则全等。 */
	const matches = (pat: string, name: string): boolean => {
		const i = pat.indexOf("*");
		return i < 0 ? pat === name : name.startsWith(pat.slice(0, i)) && name.endsWith(pat.slice(i + 1));
	};

	const withTopic = new Set<string>();
	const allNames = new Set<string>();
	for (const { chart } of charts)
		for (const p of detectPatterns(chart)) {
			allNames.add(p.name);
			if (p.topicDescription) withTopic.add(p.name);
		}

	it("判词名册双向匹配：代码里有判词的都在册，在册的都有实现", () => {
		const unlisted = [...withTopic].filter(n => !ROSTER.some(pat => matches(pat, n)));
		assert.deepEqual(
			unlisted,
			[],
			`以下格局有长判词却不在名册里（新增格局请同步 ROSTER）：${unlisted.join("、")}`
		);
		const unimpl = ROSTER.filter(pat => ![...withTopic].some(n => matches(pat, n)));
		assert.deepEqual(
			unimpl,
			[],
			`名册里这些项在 300 条基准上找不到对应判词（判词被删？识别器忘填 topicDescription？）：${unimpl.join("、")}`
		);
	});

	it("每条长判词都成句（长度 > 20）", () => {
		for (const [i, { birth, chart }] of charts.entries())
			for (const p of detectPatterns(chart))
				if (p.topicDescription !== undefined)
					assert.ok(
						p.topicDescription.length > 20,
						`第 ${i} 张盘（${birth.year}-${birth.month}-${birth.day}）的「${p.name}」长判词过短（${p.topicDescription.length} 字）：${p.topicDescription}`
					);
	});

	it("格局名不含展示标记（如「（煞格）」）", () => {
		// 警示后缀属于**展示层**，应写进判词而非挂在 name 上 —— name 是查找键，
		// 带上括号标注后，所有按名字比对的地方都会失配。
		for (const name of allNames)
			assert.ok(
				!name.includes("（") && !name.includes("("),
				`格局名「${name}」带上了展示标记 —— 应剥离并写入判词`
			);
	});
});
