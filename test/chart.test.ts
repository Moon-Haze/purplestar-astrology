/**
 * @file 内核排盘结果与抽样基准盘的逐字段对标测试。
 */
// ── 层 1（主力）：排盘对标 ──
//
// 本项目 generateChart() 输出比 toolkit 样本，逐字段全等。
// 基准由 db/dataset 经本仓内核直生成（v4 同源）——以此固化内核行为。
//
// ⚠️ **亮度不对拍**（2026-10 切换）：亮度已由文墨 SB 表覆写
//    （XD2 默认，见 scripts/wenmo-brightness.ts），与 iztro 快照不可比；
//    正确性由 test/invariants.test.ts「文墨亮度表」组保障。其余字段
//    （星名/type/mutagen/宫位/大限/借宫）全量比对，白名单外任何
//    差异即失败（白名单保留、清单现空，见 test/lib/compare.ts）。
//
// ⚠️ 本测试是**回归锁定/跨版本差分**，非独立正确性证明：样本同源
//    （都调 iztro bySolar），同错处测不出。详见 test/README.md。
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/types";
import { loadAlgorithm, ROOT } from "./lib/loader.ts";
import {
	BRANCHES,
	compareChart,
	expectedAge,
	formatDiffs,
	type BaselineSample,
} from "./lib/compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const manifest = JSON.parse(readFileSync(resolve(HERE, "fixtures/manifest.json"), "utf8")) as {
	count: number;
	yearRange: [number, number];
	baselineEngine: string;
};
const samples = readFileSync(resolve(HERE, "fixtures/charts.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map(line => JSON.parse(line) as BaselineSample);

const { generateChart, parseWuxingJu } = await loadAlgorithm();

/** 出生信息渲染成可读用例名。 */
const describeBirth = (b: BirthInfo): string =>
	`${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} ` +
	`${BRANCHES[b.timeIndex] ?? `timeIndex${b.timeIndex}`}时 ${b.gender}`;

// ── 确认基准数据已加载 ──
// 没有这条，fixtures 读空会让 0 用例「全绿」通过——最危险假阳性。
// 条数与年份范围从 manifest 派生（不写死字面量——旧断言曾钉死
// 「300 条（60 年 × 5 条）」，范围 1950–2026 按 manifest 互证）。
test("基准数据可用", () => {
	assert.equal(samples.length, manifest.count, "fixtures 行数应与 manifest 记录一致");
	assert.ok(samples.length > 0, "fixtures 不应为空（空基准 = 全套件假绿）");
	assert.ok(
		samples.every(s => s.birthInfo && s.chart?.palaces?.length === 12),
		"每条基准都应含 birthInfo 与完整十二宫"
	);
	assert.ok(
		samples.every(
			s =>
				s.birthInfo.year >= manifest.yearRange[0] &&
				s.birthInfo.year <= manifest.yearRange[1]
		),
		`每条基准的出生年都应落在 manifest 自报范围 ${manifest.yearRange[0]}–${manifest.yearRange[1]} 内`
	);
});

test("排盘内核可加载", () => {
	assert.equal(typeof generateChart, "function");
	assert.ok(ROOT.endsWith("scripts"), `内核根应指向 scripts/，实际为 ${ROOT}`);
});

// ── 主体：逐条比对，按年份分组 ──
describe(`排盘对标（基准：${manifest.baselineEngine} 样本）`, () => {
	const byYear = new Map<number, BaselineSample[]>();
	for (const s of samples) {
		if (!byYear.has(s.birthInfo.year)) {
			byYear.set(s.birthInfo.year, []);
		}
		byYear.get(s.birthInfo.year)!.push(s);
	}

	for (const [year, list] of [...byYear].sort((a, b) => a[0] - b[0])) {
		// 年份过滤由 npm test -- --year 经 --test-name-pattern 在 runner 完成
		//（两阶段 spawn：非层 1 全量跑，用例名首段即出生年）——文件内不读环境变量。
		describe(`${year} 年`, () => {
			for (const s of list) {
				it(describeBirth(s.birthInfo), t => {
					const actual = generateChart({ ...s.birthInfo });
					// keepWhitelisted 保留白名单差异打标（供诊断行），
					// 断言只看非白名单部分——与原先「compareChart 默认丢弃白名单差异后
					// length === 0」**严格等价**（判的仍是「白名单之外零差异」，未放宽；
					// 注入实验验证：白名单外新差异照样红）。
					const all = compareChart(actual, s.chart, { keepWhitelisted: true });
					const diffs = all.filter(d => !d.whitelisted);
					assert.equal(diffs.length, 0, `\n${formatDiffs(diffs)}`);
					// 每条基准执行情况（只报动态量：虚岁、白名单命中、其余字段结果）
					const wl = all.filter(d => d.whitelisted);
					const hits = wl
						.map(d => {
							const star = d.path.match(/stars\[(.+?)\]/)?.[1] ?? "?";
							const branch = d.path.match(/\[(.+?)宫/)?.[1] ?? "?";
							return `${star}@${branch}`;
						})
						.join("、");
					t.diagnostic(
						`虚岁${expectedAge(s.birthInfo)} · 白名单${wl.length}${hits ? `(${hits})` : ""} · ${diffs.length ? "有差异" : "其他字段全等"}`
					);
				});
			}
		});
	}
});

// ── 随年份漂移的字段 ──
// currentAge 是**虚岁**（农历年差+1，正月初一为界），连带
// currentDecadalIndex / palace.isCurrentDecadal。样本是 2026 年快照，
// **若照抄样本 currentAge，过下一正月初一本套测试即全线变红**。
// 比对器按「注入的当前时间」独立重算期望值。下条断言证明生效。
describe("随年份漂移的字段", () => {
	it("currentAge 期望值按注入时间重算，而非照抄样本快照", () => {
		const s = samples[0];
		const actual = generateChart({ ...s.birthInfo });

		// 真实当前时间下应无差异（actual 与样本同源，同一年份算）
		const sameYear = compareChart(actual, s.chart).filter(d => d.path === "currentAge");
		assert.equal(sameYear.length, 0, "真实时间下 currentAge 不应有差异");

		// 把「当前时间」推到明年 6 月 1 日（已过正月初一）：期望值 +1，
		// actual 用真实时间排，故必然报差异。
		// 这证明比对器没照抄样本——否则活不过一个跨年。
		// 用 (年,月,日) 构造而非日期串：后者按 UTC 解析，与本地时区口径不一。
		const nextYear = new Date().getFullYear() + 1;
		const drift = compareChart(actual, s.chart, { now: new Date(nextYear, 5, 1) });
		assert.ok(
			drift.some(d => d.path === "currentAge"),
			`注入 ${nextYear} 年时间后应报出 currentAge 漂移；未报出说明期望值是照抄样本的`
		);
	});
});

// ── 五行局名 → 局数 的解析 ──
// `chart.fiveElementsClass` 唯一来源，且**从局名字符串反推数字**，口径需单独锁。
// 「排盘对标」只覆盖 iztro 中文数字写法（385 条样本都是「水二局」类），
// 覆盖不到口径变更后形态——那正是这里要盯的。
describe("五行局名解析", () => {
	it("五个标准局名各解析出对应局数", () => {
		assert.equal(parseWuxingJu("水二局"), 2);
		assert.equal(parseWuxingJu("木三局"), 3);
		assert.equal(parseWuxingJu("金四局"), 4);
		assert.equal(parseWuxingJu("土五局"), 5);
		assert.equal(parseWuxingJu("火六局"), 6);
	});

	it("阿拉伯数字变体同样解析成功", () => {
		// iztro 若把 fiveElementsClass 改成「水2局」，纯中文数字匹配会整片落兜底 3。
		// 局数不参与安星，却让两字段矛盾——局名说「水二局」、
		// 局数说 3，而 invariants「名称与数字对应」不变量正盯此一致性。
		assert.equal(parseWuxingJu("水2局"), 2);
		assert.equal(parseWuxingJu("火6局"), 6);
	});

	it("无法识别的局名兜底为 3 且不抛错", () => {
		// 与 projectPalaceName 相反：局数不参与安星，猜错代价低于中断排盘。
		// 本条锁**取舍本身**（types.ts 注释同理），非锁 3 这个值。
		assert.equal(parseWuxingJu("未知局"), 3);
		assert.equal(parseWuxingJu(""), 3);
	});
});
