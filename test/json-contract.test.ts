/**
 * @file astrology JSON 产物契约的语料级回归测试。
 */
// ── 层 1（主力）：`astrology --json` 产物契约的语料级回归 ──
//
// 层 1 的排盘对标（chart.test.ts）比的是**内核直调**产物；本文件把对拍推进一层——
// 对同一份基准 fixtures，进程内直调排盘与 JSON 装配单点（buildAnalyzeJson），断言
// `--json` 顶层产物的冻结契约与 db 基准逐字段一致。把装配路径的对拍覆盖从
// cli.test.ts 的单例断言扩到语料规模（385 条全集）。
//
// 断言面四组（specs：quality-gates「JSON 契约语料级回归」）：
//   1. 顶层键集冻结 —— 多键少键即红并点名（手抄清单是冻结测试的存在意义：
//      装配单点增删键必须让这里变红、逼显式审阅，与 kernel-contract 同型）；
//   2. `.chart` 与基准盘面经 compareChart 逐字段全等（同归一化、同白名单，比对面与层 1 同源）；
//   3. `.nativeSiHua` 与基准 mutagen 标记双向一致 + stem 等于基准农历年干
//      （基准标记域 = 14 主星 + SIHUA_STARS 四辅星；域外暴露按失败可见性处理，不静默放行）；
//   4. null 语义与确定性 —— 流月/流日/流时未配置恒 null；大限层**按盘派生**而非配置项
//      （童限未起运为 null，起运后 stem 等于基准大限宫干——基准 palaces.stem 是外部真值，
//      与规划期曾误写的「大限恒 null」不同，探针实证 currentDecadalIndex=10 时非空）；
//      同 chart 双跑产物逐字节一致（装配层不随环境/随机漂移；currentAge 类时变字段
//      不做值面断言，其跨日漂移由 compareChart 的重算机制覆盖）。
//
// 边界：进程内直调，不经 CLI 子进程 / 缓存链路；「内核直调 ≡ CLI --json」的进程边界
// 由 cli.test.ts 的既有单例断言钉住，两边互补不重叠。流年/流月/流日/流时的**值面**
// 无 db 真值，归层 2/3 的既有预言机，本文件只做结构断言。
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ZiweiChart } from "@/types";
import { load, loadAlgorithm } from "./lib/loader.ts";
import {
	BRANCHES,
	compareChart,
	expectedAge,
	formatDiffs,
	type BaselineSample,
} from "./lib/compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const samples = readFileSync(resolve(HERE, "fixtures/charts.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map(line => JSON.parse(line) as BaselineSample);

const { generateChart } = await loadAlgorithm();
const { buildAnalyzeJson } = await load<typeof import("@/cli/commands/astrology")>(
	"@/cli/commands/astrology"
);
const { STEMS } = await load<typeof import("@/data/ganzhi")>("@/data/ganzhi");

/**
 * `--json` 顶层键的冻结集 —— **刻意手抄**（见文件头注释第 1 组）。
 * 契约固定数：十三键。语义逐键说明在 docs/code/cli-commands.md，此处不复述。
 */
const FROZEN_TOP_LEVEL_KEYS = [
	"chart",
	"patterns",
	"mingGongSummary",
	"nativeSiHua",
	"liuNianSiHua",
	"liuYueSiHua",
	"daXianSiHua",
	"liuRiSiHua",
	"liuShiSiHua",
	"liuNianPalace",
	"xiaoXian",
	"lateZi",
	"basis",
] as const;

/** 四化四键（Mutagen 的值域；测试面按字符串消费，逐字面量写死即契约钉点）。 */
const HUAS = ["禄", "权", "科", "忌"] as const;

/**
 * 装配入参：流年注入出生公历年（确定性），运限参数一概不传（null 语义的受测形态）。
 *
 * @param chart - 排好的盘
 * @param liuNianYear - 注入的流年年号（取出生公历年以保证确定性）
 * @returns 与 CLI `--json` 同一装配函数产出的 JSON 文本
 */
function assembleJson(chart: ZiweiChart, liuNianYear: number): string {
	return buildAnalyzeJson({
		chart,
		liuNianYear,
		liuYueMonth: null,
		basis: {
			note: "语料回归注入（公历直排）",
			notes: [],
			lateZiCandidate: false,
			isLateZi: false,
		},
	});
}

/** 产物顶层形状（测试侧消费视图，只声明真读到的键——与 synastry/chart-view 同型）。 */
interface AnalyzeJsonView {
	/** 生年四化层（恒非 null）：`stem` 为农历年干名，`transforms` 为禄/权/科/忌 → 星名，`located` 四项落宫明细 */
	nativeSiHua: {
		stem: string;
		transforms: Record<string, string>;
		located: {
			hua: string;
			star: string;
			palace: string | null;
			branch: string | null;
			isMajor: boolean;
		}[];
	};
	/** 流年四化层（恒非 null；年号取注入值，本文件恒注入出生公历年以保证确定性） */
	liuNianSiHua: { year: number; transforms: Record<string, string> };
	/** 流月四化层；本文件不配 `--monthly`，断言它**显式 `null`**（非缺键） */
	liuYueSiHua: unknown;
	/** 大限四化层：按盘派生 —— 童限未起运为 `null`，起运后 `stem` 等于基准大限宫干 */
	daXianSiHua: { stem: string; transforms: Record<string, string> } | null;
	/** 流日四化层；本文件不配置，断言恒 `null` */
	liuRiSiHua: unknown;
	/** 流时四化层；本文件不配置，断言恒 `null` */
	liuShiSiHua: unknown;
	/** 流年命宫（`year` 取注入值；本文件只断言年号，宫位面归层 2/3 预言机） */
	liuNianPalace: { year: number };
}

/** 把出生信息渲染成可读的用例名。 */
const describeBirth = (s: BaselineSample): string =>
	`${s.birthInfo.year}-${String(s.birthInfo.month).padStart(2, "0")}-${String(s.birthInfo.day).padStart(2, "0")} ` +
	`${BRANCHES[s.birthInfo.timeIndex] ?? `timeIndex${s.birthInfo.timeIndex}`}时 ${s.birthInfo.gender}`;

// ── 基准形状访问器 ──
// BaselineChart 的 palaces / decadals / lunarInfo 在接口上是可选的（外部数据不做预设），
// 但本文件的断言以它们为必经之路。缺失即基准损坏——大声失败，不用可选链静默缩水、
// 也不用 `!` 硬断（消费点不掩盖 miss 的同型纪律）。
/** 取产物里的宫列表。 */
const palacesOf = (s: BaselineSample): NonNullable<BaselineSample["chart"]["palaces"]> => {
	assert.ok(s.chart.palaces, `基准形状损坏：${describeBirth(s)} 缺 palaces`);
	return s.chart.palaces;
};
/** 取产物里的大限列表。 */
const decadalsOf = (s: BaselineSample): NonNullable<BaselineSample["chart"]["decadals"]> => {
	assert.ok(s.chart.decadals, `基准形状损坏：${describeBirth(s)} 缺 decadals`);
	return s.chart.decadals;
};
/** 取产物里的农历年干。 */
const yearStemOf = (s: BaselineSample): number => {
	assert.ok(
		s.chart.lunarInfo?.yearStem !== undefined,
		`基准形状损坏：${describeBirth(s)} 缺 lunarInfo.yearStem`
	);
	return s.chart.lunarInfo.yearStem;
};

// ── 前置守卫：基准非空 + 装配单点可加载。没有这条，fixtures 读空会让下面 0 个用例假绿 ──
test("基准数据可用且装配单点可加载", () => {
	assert.ok(samples.length > 0, "fixtures 不应为空（空基准 = 全套件假绿）");
	assert.equal(typeof buildAnalyzeJson, "function");
	assert.ok(
		Array.isArray(STEMS) && STEMS.length === 10,
		`天干表应为 10 项，实际 ${STEMS?.length}`
	);
});

// ── 主体：逐条装配并断言四组，按年份分组（与层 1 同构，失败可定位到具体样本） ──
describe("JSON 契约语料级回归", () => {
	const byYear = new Map<number, BaselineSample[]>();
	for (const s of samples) {
		if (!byYear.has(s.birthInfo.year)) {
			byYear.set(s.birthInfo.year, []);
		}
		byYear.get(s.birthInfo.year)!.push(s);
	}

	for (const [year, list] of [...byYear].sort((a, b) => a[0] - b[0])) {
		// 年份过滤由 npm test -- --year 经 node --test 的 --test-name-pattern 在 runner 层完成
		//（两阶段 spawn：非层 1 文件全量跑，本文件的用例名首段即出生年）——文件内不再读环境变量。
		describe(`${year} 年`, () => {
			for (const s of list) {
				it(describeBirth(s), () => {
					const chart = generateChart({ ...s.birthInfo });
					const json = assembleJson(chart, s.birthInfo.year);
					const parsed = JSON.parse(json) as AnalyzeJsonView & Record<string, unknown>;

					// ── 1) 顶层键集冻结：多键少键即红并点名 ──
					const missing = FROZEN_TOP_LEVEL_KEYS.filter(k => !(k in parsed));
					const extra = Object.keys(parsed).filter(
						k => !(FROZEN_TOP_LEVEL_KEYS as readonly string[]).includes(k)
					);
					assert.deepEqual(
						{ missing, extra },
						{ missing: [], extra: [] },
						`顶层键集偏离冻结契约（${FROZEN_TOP_LEVEL_KEYS.length} 键）——` +
							`缺 ${JSON.stringify(missing)} / 多 ${JSON.stringify(extra)}` +
							`（增删键须显式同步 FROZEN_TOP_LEVEL_KEYS 与 docs/code/cli-commands.md）`
					);

					// ── 2) .chart 与基准逐字段全等（同比对器、同白名单，与层 1 同源） ──
					const all = compareChart(parsed.chart as ZiweiChart, s.chart, {
						keepWhitelisted: true,
					});
					const diffs = all.filter(d => !d.whitelisted);
					assert.equal(
						diffs.length,
						0,
						`JSON 装配的 chart 面偏离基准：\n${formatDiffs(diffs)}`
					);

					// ── 3) nativeSiHua 双向核对 + stem 对基准农历年干 ──
					const nsi = parsed.nativeSiHua;
					assert.equal(
						nsi.stem,
						STEMS[yearStemOf(s)],
						`nativeSiHua.stem 应等于基准农历年干（样本农历换算列），实际 ${nsi.stem}`
					);
					for (const h of HUAS) {
						assert.ok(nsi.transforms[h], `transforms.${h} 不应为空`);
					}
					// 正向：每个化曜星确实落在基准标了同四化的那个宫（branch 为连接键；
					// isMajor 与基准星型互证——主星席命中与否两侧须一致）
					for (const e of nsi.located) {
						const bIdx = BRANCHES.indexOf(e.branch ?? "");
						const bPalace = palacesOf(s).find(p => p.branch === bIdx);
						const mark = bPalace?.stars.find(st => st.name === e.star);
						assert.ok(
							mark,
							`化曜 ${e.hua}:${e.star} 应落在基准 ${e.branch} 宫（branch=${bIdx}），基准无此星`
						);
						assert.equal(
							mark.mutagen,
							e.hua,
							`${e.branch}宫 ${e.star} 的基准四化标记应为 ${e.hua}，实际 ${mark.mutagen ?? "（无标记）"}`
						);
						assert.equal(
							e.isMajor,
							mark.type === "major",
							`${e.star} 的 isMajor=${e.isMajor} 与基准星型 ${mark.type} 不一致`
						);
					}
					// 反向：基准全部非空 mutagen 标记恰被四化覆盖（不多不少）
					const marks = palacesOf(s).flatMap(p =>
						p.stars
							.filter(st => st.mutagen)
							.map(st => ({ name: st.name, mutagen: st.mutagen! }))
					);
					assert.equal(
						marks.length,
						HUAS.length,
						`基准四化标记应为 ${HUAS.length} 个，实际 ${marks.length}：` +
							JSON.stringify(marks) +
							(marks.length !== HUAS.length
								? "——若为基准标记域覆盖不足（四化落 SIHUA_STARS 域外辅星），按失败可见性处理，不得静默放行"
								: "")
					);
					assert.deepEqual(
						[...marks.map(m => m.mutagen)].sort(),
						[...HUAS].sort(),
						`基准标记的四化值应为 ${HUAS.join("/")} 全集，实际 ${marks.map(m => m.mutagen).join("/")}`
					);
					for (const m of marks) {
						assert.equal(
							nsi.transforms[m.mutagen],
							m.name,
							`transforms.${m.mutagen} 应为基准标记的 ${m.name}`
						);
					}

					// ── 4) null 语义 + 大限层按盘派生 + 注入一致性 + 双跑逐字节一致 ──
					assert.equal(
						parsed.liuYueSiHua,
						null,
						"未配置流月时 liuYueSiHua 应为 null（显式 null，非缺键）"
					);
					assert.equal(parsed.liuRiSiHua, null, "未配置流日时 liuRiSiHua 应为 null");
					assert.equal(parsed.liuShiSiHua, null, "未配置流时时 liuShiSiHua 应为 null");
					// 大限层期望独立复算：expectedAge + 基准 decadals（外部数据），不抄内核
					// currentDecadalIndex（其与期望的一致性已由 compareChart 断言过）。
					// 本语料最新队列（2024–2026 生）虚岁 1–3 为童限，该分支实际生效；其余队列恒已起运，
					// 由 selftest 的童限用例覆盖该侧。
					const age = expectedAge(s.birthInfo);
					const expIdx = decadalsOf(s).findIndex(
						d => age >= d.startAge && age <= d.endAge
					);
					if (expIdx === -1) {
						assert.equal(
							parsed.daXianSiHua,
							null,
							"童限未起运时 daXianSiHua 应为 null"
						);
					} else {
						assert.ok(parsed.daXianSiHua, "起运后 daXianSiHua 应非 null");
						const dx = decadalsOf(s)[expIdx];
						const dxPalace = palacesOf(s).find(p => p.branch === dx.palaceBranch);
						assert.ok(dxPalace, `基准大限宫 branch=${dx.palaceBranch} 应存在`);
						assert.equal(
							parsed.daXianSiHua!.stem,
							STEMS[dxPalace.stem],
							`daXianSiHua.stem 应等于基准大限宫干（${dx.palaceBranch}宫 stem=${dxPalace.stem}），` +
								`实际 ${parsed.daXianSiHua!.stem}`
						);
						for (const h of HUAS) {
							assert.ok(
								parsed.daXianSiHua!.transforms[h],
								`daXian transforms.${h} 不应为空`
							);
						}
					}
					// 注入一致性：流年年号进产物、且流年层按注入值产出
					assert.equal(
						parsed.liuNianSiHua.year,
						s.birthInfo.year,
						"liuNianSiHua.year 应等于注入值"
					);
					assert.equal(
						parsed.liuNianPalace.year,
						s.birthInfo.year,
						"liuNianPalace.year 应等于注入值"
					);
					assert.ok(
						parsed.liuNianSiHua.transforms["禄"],
						"流年层 transforms 应非空（值面归层 3 预言机）"
					);
					// 双跑逐字节一致：同 chart 重复装配（装配层确定性；时变字段不做值面断言，见文件头）
					assert.equal(
						json,
						assembleJson(chart, s.birthInfo.year),
						"同 chart 双跑产物应逐字节一致"
					);
				});
			}
		});
	}
});
