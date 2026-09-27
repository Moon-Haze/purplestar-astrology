// ── 层 5：基准数据源的纯函数 ──
//
// ⚠️ 本文件**不得触碰任何数据文件**。`npm test` 必须在「无 db/ 数据集、
//    无 DuckDB 依赖、无 jsonl 语料」的环境下跑通（见 test/README.md）。
//    所以这里测三样东西，没有一样需要 db/：
//      1. 错误指引的文本、以及**用不存在的路径**触发的失败分支
//      2. `rowsToSample` 用**合成行**逐条覆盖映射规则
//      3. `rowsToSample` 用 `fixtures/raw-rows.json` 里的**真实行**逐字节复现 charts.jsonl
//
// 第 3 条是 2026-09-27 补上的，补的是一条真实的缝：第 2 条的合成行编码的是
// 「**我以为**真实行长什么样」—— 列名、类型、数组形状一变，合成行照旧全绿。
// 更隐晦的是 `hasSiHuaKey`（键的存在性 vs 值为 `""`），sample-source.ts 的文件头自己
// 就写着「搞错了 npm test 也不会红」。真实行固化进 fixtures 后这条才第一次可测。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
	DB_DIR,
	SourceError,
	assertTwelveRows,
	missingDbHint,
	missingDepHint,
	openSource,
	rowsToSample,
} from "./lib/sample-source.ts";
import type { PalaceRow, SampleRow } from "./lib/sample-source.ts";
import type { BaselineChart } from "./lib/compare.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test
const FIXTURES = resolve(HERE, "fixtures");

describe("基准数据源（纯函数与错误指引）", () => {
	it("DB_DIR 指向 <skill 根>/db/dataset", () => {
		assert.match(DB_DIR, /\/db\/dataset$/);
	});

	it("数据集缺失时抛 SourceError，指引写明缺失的表与语料仍在 reference/", async () => {
		// 文本细节直接断言纯函数 missingDbHint：不触依赖，有/无依赖环境下行为一致。
		const hint = missingDbHint("/nonexistent/ziwei-does-not-exist");
		for (const must of [
			"/nonexistent/ziwei-does-not-exist",
			"samples.parquet",
			"palaces.parquet",
			"reference/ziwei-samples-toolkit/samples-out",
			"不是",
			"npm test",
		]) {
			assert.ok(hint.includes(must), `指引里应含「${must}」，实际：\n${hint}`);
		}

		// 缺哪张要指名道姓。文件名规则（<表>.parquet）是产出方与消费方之间唯一的契约，
		// 一旦两边漂移，「数据集不完整」会被读成「数据集不存在」——正是两种不同的处理。
		const partial = missingDbHint("/nonexistent", ["palaces"]);
		assert.ok(partial.includes("缺少的表：palaces"), `应点名缺失的表，实际：\n${partial}`);

		// openSource 只断言结构性契约：rejects + SourceError + 非空指引。
		// 有依赖时走 missingDbHint、无依赖时走 missingDepHint，两者都是可读指引，绝非 ENOENT 堆栈。
		await assert.rejects(
			() => openSource("/nonexistent/ziwei-does-not-exist"),
			(err: unknown) => {
				assert.ok(err instanceof SourceError, "应当是 SourceError");
				assert.ok(err.message.length > 0, "message 应为非空指引");
				return true;
			}
		);
	});

	it("依赖缺失的指引指向 npm install", () => {
		const msg = missingDepHint(new Error("Cannot find package '@duckdb/node-api'"));
		assert.ok(msg.includes("@duckdb/node-api"));
		assert.ok(msg.includes("npm install"));
		assert.ok(msg.includes("Cannot find package '@duckdb/node-api'"), "应回显底层错误信息");
	});

	it("missingDbHint 可接受自定义路径（供 openSource 复用）", () => {
		assert.ok(missingDbHint("/tmp/x").includes("/tmp/x"));
		assert.ok(missingDbHint().includes(DB_DIR));
	});
});

/** 造一行 `samples`（只写测试关心的列，其余给 0 —— 映射是逐列的，不会串）。 */
function sampleRow(over: Partial<SampleRow> = {}): SampleRow {
	return {
		year: 1924, month: 1, day: 1, hour: 0, gender: "male", longitude: 120,
		lunar_year: 1923, lunar_month: 12, lunar_day: 25,
		year_stem: 0, year_branch: 0, is_leap_month: false,
		ming_gong_branch: 2, shen_gong_branch: 6, wuxing_ju: 4, wuxing_ju_name: "金四局",
		ziwei_pos: 9, current_age: 102, current_daxian_index: 9,
		...over,
	};
}

/** 造一行 `palaces`。 */
function palaceRow(over: Partial<PalaceRow> = {}): PalaceRow {
	return {
		branch: 2, stem: 0, palace_name: "福德",
		major_stars: [], lucky_stars: [], sha_stars: [], minor_stars: [],
		major_brightness: [], sihua_stars: [],
		is_ming_gong: false, is_shen_gong: false, is_current_daxian: false,
		daxian_start: 104, daxian_end: 113,
		...over,
	};
}

/** 造齐 12 个宫（大限区间连续：2 岁起，每宫十年）。 */
function twelvePalaces(): PalaceRow[] {
	return Array.from({ length: 12 }, (_, i) =>
		palaceRow({
			branch: (i + 2) % 12,
			palace_name: ["命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","仆役","官禄","田宅","福德","父母"][i],
			daxian_start: 2 + i * 10,
			daxian_end: 11 + i * 10,
		})
	);
}

/** `rowsToSample` 产出 `chart` 的真实形状：`BaselineChart` 之外，jsonl 还带三个多余字段。 */
type ReconstructedChart = BaselineChart & {
	birthInfo: unknown;
	currentAge: number;
	currentDaXianIndex: number;
};

describe("重建映射 rowsToSample（合成行，不碰数据文件）", () => {
	it("盘级标量与农历六字段逐列对应", () => {
		const s = rowsToSample(sampleRow(), twelvePalaces());
		assert.equal(s.birthInfo.year, 1924);
		assert.equal(s.birthInfo.gender, "male");
		assert.equal(s.birthInfo.longitude, 120);
		assert.deepEqual(s.chart.lunarInfo, {
			lunarYear: 1923, lunarMonth: 12, lunarDay: 25,
			yearStem: 0, yearBranch: 0, isLeapMonth: false,
		});
		assert.equal(s.chart.mingGongBranch, 2);
		assert.equal(s.chart.wuxingJuName, "金四局");
		const chart = s.chart as ReconstructedChart;
		assert.equal(chart.currentAge, 102);
		assert.equal(chart.currentDaXianIndex, 9);
	});

	it("chart.birthInfo 存在且与顶层 birthInfo 同内容", () => {
		const s = rowsToSample(sampleRow(), twelvePalaces());
		assert.deepEqual((s.chart as ReconstructedChart).birthInfo, s.birthInfo);
	});

	it("顶层与 chart 的键序与 jsonl 一致（逐字节比对的前提）", () => {
		const s = rowsToSample(sampleRow(), twelvePalaces());
		assert.deepEqual(Object.keys(s), ["birthInfo", "chart"]);
		assert.deepEqual(Object.keys(s.birthInfo), ["year", "month", "day", "hour", "gender", "longitude"]);
		assert.deepEqual(Object.keys(s.chart), [
			"birthInfo", "lunarInfo", "mingGongBranch", "shenGongBranch", "wuxingJu",
			"wuxingJuName", "ziweiPos", "palaces", "daXians", "currentAge", "currentDaXianIndex",
		]);
		assert.deepEqual(Object.keys(s.chart.lunarInfo ?? {}), [
			"lunarYear", "lunarMonth", "lunarDay", "yearStem", "yearBranch", "isLeapMonth",
		]);
	});

	it("宫位键序与 jsonl 一致，daXianAge 取自 daxian_start/end", () => {
		const p = rowsToSample(sampleRow(), twelvePalaces()).chart.palaces![0];
		assert.deepEqual(Object.keys(p), [
			"branch", "stem", "name", "stars", "daXianAge",
			"isMingGong", "isShenGong", "isCurrentDaXian",
		]);
		assert.deepEqual(p.daXianAge, [2, 11]);
	});

	it("星曜四段拼接：major → lucky → sha → minor", () => {
		const palaces = twelvePalaces();
		palaces[0].major_stars = ["太阳", "巨门"];
		palaces[0].major_brightness = ["bright", "dim"];
		palaces[0].lucky_stars = ["左辅"];
		palaces[0].sha_stars = ["擎羊"];
		palaces[0].minor_stars = ["三台", "封诰"];
		const stars = rowsToSample(sampleRow(), palaces).chart.palaces![0].stars;
		assert.deepEqual(stars.map(x => x.type), ["major", "major", "lucky", "sha", "minor", "minor"]);
		assert.deepEqual(stars[0], { name: "太阳", type: "major", brightness: "bright", siHua: "" });
	});

	it("siHua 键的存在性：18 颗有键（主星 + 四辅星），其余整键缺失", () => {
		const palaces = twelvePalaces();
		palaces[0].major_stars = ["天府"]; // 终生不参与四化的主星 —— 有键、值为 ""
		palaces[0].major_brightness = ["normal"];
		palaces[0].lucky_stars = ["左辅", "天钺"]; // 左辅有键，天钺无键
		palaces[0].minor_stars = ["三台"];
		palaces[0].sha_stars = ["擎羊"];
		palaces[0].sihua_stars = ["左辅:科"]; // 天府 无四化 → 不在数组内
		const stars = rowsToSample(sampleRow(), palaces).chart.palaces![0].stars;
		const byName = new Map(stars.map(s => [s.name, s]));

		assert.ok("siHua" in byName.get("天府")!, "主星恒有 siHua 键");
		assert.equal(byName.get("天府")!.siHua, "", "无四化时值为空串，不是 undefined");
		assert.equal(byName.get("左辅")!.siHua, "科");
		assert.ok(!("siHua" in byName.get("天钺")!), "天钺 必须整键缺失");
		assert.ok(!("siHua" in byName.get("三台")!));
		assert.ok(!("siHua" in byName.get("擎羊")!));

		// 逐字节：键缺失与值为 "" 是两种不同的 JSON
		const json = JSON.stringify(byName.get("天府"));
		assert.equal(json, '{"name":"天府","type":"major","brightness":"normal","siHua":""}');
		assert.equal(JSON.stringify(byName.get("天钺")), '{"name":"天钺","type":"lucky"}');
	});

	it("daXians 按 startAge 升序，字段序与 jsonl 一致", () => {
		const palaces = twelvePalaces();
		palaces.reverse(); // 故意打乱输入顺序
		const dx = rowsToSample(sampleRow(), palaces).chart.daXians!;
		assert.equal(dx.length, 12);
		assert.deepEqual(dx.map(d => d.startAge), [2, 12, 22, 32, 42, 52, 62, 72, 82, 92, 102, 112]);
		assert.deepEqual(Object.keys(dx[0]), ["startAge", "endAge", "palaceBranch", "palaceName"]);
	});

	it("不就地改动传入的 palaces 数组", () => {
		const palaces = twelvePalaces();
		palaces.reverse(); // ⚠️ 必须先打乱：上面的 daXians 测试已证明 twelvePalaces() 天然有序，
		                   //    有序输入会让 rowsToSample 的 sort 退化成 no-op，断言恒真
		const before = palaces.map(p => p.branch);
		rowsToSample(sampleRow(), palaces);
		assert.deepEqual(palaces.map(p => p.branch), before);
	});

	it("assertTwelveRows：11 行宫位抛 SourceError，12 行放行", () => {
		const palaces = twelvePalaces();
		assert.doesNotThrow(() => assertTwelveRows(palaces, sampleRow()));
		assert.throws(
			() => assertTwelveRows(palaces.slice(0, 11), sampleRow()),
			(err: unknown) => err instanceof SourceError && /预期 12 行，实际 11 行/.test((err as Error).message)
		);
	});
});

/** 产物 `raw-rows.json` 的一个条目：挑选理由 + 12 行真实 JOIN 行。 */
interface RawEntry {
	why: string;
	rows: Array<Record<string, unknown>>;
}

/**
 * 出生五元组 —— 库中唯一确定一条样本，也是与 charts.jsonl 对表的键。
 *
 * ⚠️ 比的是**五元组字符串**而非 JSON 片段：`JSON.parse` 出来的对象键序与原文无关，
 *    拿它拼字符串会引入原文根本没写过的键序假设。
 */
const keyOf = (r: { year: number; month: number; day: number; hour: number; gender: string }): string =>
	`${r.year}-${r.month}-${r.day}-${r.hour}-${r.gender}`;

describe("真实行 → fixtures：逐字节复现（输入取自 fixtures/raw-rows.json）", () => {
	it("每条真实行都逐字节重现 charts.jsonl 里那一条的原文", () => {
		// ## 这条断言为什么不是「自己验自己」
		//
		// charts.jsonl 是 **toolkit 用 iztro 2.5.8 + toolkit 自己的行→样本映射**写出来的；
		// `rowsToSample` 是本项目**重新实现**的同一映射。两者**不同源**，所以这是外部预言机
		// —— 验的是「我们的映射 ≡ 上游的映射」，不是「我们等于我们」。
		// （而同源的比对器在 compare.ts，那里同源同错的风险另由层 3 的外部预言机堵。）
		//
		// 真实行由 test/tools/export-raw-rows.ts 一次性导出并提交；`npm test` 不碰 db/。
		const raw = JSON.parse(readFileSync(resolve(FIXTURES, "raw-rows.json"), "utf8")) as RawEntry[];
		// 产物为空时下面的循环一次都不跑 —— 那是标准的假绿，先挡住。
		assert.ok(raw.length > 0, "raw-rows.json 为空，跑 node test/tools/export-raw-rows.ts 重建");

		// 答案侧**保留原文行**，不做 JSON.parse 再 stringify：要验的就是「逐字节相同」，
		// 中间过一道序列化会把键序差异抹平，等于把要验的性质消掉。
		const answers = new Map<string, string>();
		for (const line of readFileSync(resolve(FIXTURES, "charts.jsonl"), "utf8").trim().split("\n")) {
			const { birthInfo } = JSON.parse(line) as { birthInfo: Parameters<typeof keyOf>[0] };
			answers.set(keyOf(birthInfo), line);
		}
		assert.ok(answers.size > 0, "charts.jsonl 解析出 0 条 —— 路径或格式已变");

		for (const entry of raw) {
			assert.equal(entry.rows.length, 12, `${entry.why}：宫位行数应为 12`);
			// 类型断言：JSON.parse 的产物是 unknown 边界，接口在 sample-source.ts 里。
			// 断言什么列名、什么形状，正是这条断言要验的东西 —— 它若不成立，下面的比对会红。
			const [first] = entry.rows;
			const key = keyOf(first as unknown as SampleRow);
			const answer = answers.get(key);
			assert.ok(answer !== undefined, `${entry.why}：charts.jsonl 里没有 ${key} —— 产物与基准不同源`);

			const rebuilt = JSON.stringify(
				rowsToSample(first as unknown as SampleRow, entry.rows as unknown as PalaceRow[])
			);
			if (rebuilt !== answer) {
				// 逐字节比对失败时给**首处差异的位置与上下文**，而不是两坨 5 KB 的 JSON
				const at = [...rebuilt].findIndex((c, i) => c !== answer[i]);
				assert.fail(
					`${entry.why}（${key}）重建结果与基准不逐字节相同：首处差异在第 ${at} 个字符\n` +
						`  基准：…${answer.slice(Math.max(0, at - 40), at + 40)}…\n` +
						`  重建：…${rebuilt.slice(Math.max(0, at - 40), at + 40)}…`
				);
			}
		}
	});
});
