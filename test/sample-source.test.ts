// ── 层 5：基准数据源的纯函数 ──
//
// ⚠️ 本文件**不得触碰任何数据文件**。`npm test` 必须在「无 db/ziwei.duckdb、
//    无 DuckDB 依赖、无 jsonl 语料」的环境下跑通（见 test/README.md）。
//    所以这里只测两样东西：错误指引的文本、以及**用不存在的路径**触发的失败分支。
//    真正的映射正确性由 test/tools/verify-source.ts 拿真实语料逐字节证明。
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
	SAMPLE_DB,
	SourceError,
	assertTwelveRows,
	lockedDbHint,
	missingDbHint,
	missingDepHint,
	openSource,
	rowsToSample,
} from "./lib/sample-source.ts";
import type { PalaceRow, SampleRow } from "./lib/sample-source.ts";
import type { BaselineChart } from "./lib/compare.ts";

describe("基准数据源（纯函数与错误指引）", () => {
	it("SAMPLE_DB 指向 <skill 根>/db/ziwei.duckdb", () => {
		assert.match(SAMPLE_DB, /\/db\/ziwei\.duckdb$/);
	});

	it("库文件缺失时抛 SourceError，指引写明「不是数据丢失」与语料仍在 reference/", async () => {
		// 文本细节直接断言纯函数 missingDbHint：不触依赖，有/无依赖环境下行为一致。
		const hint = missingDbHint("/nonexistent/ziwei-does-not-exist.duckdb");
		for (const must of [
			"/nonexistent/ziwei-does-not-exist.duckdb",
			"不入版本控制",
			"reference/ziwei-samples-toolkit/samples-out",
			"不是",
			"npm test",
		]) {
			assert.ok(hint.includes(must), `指引里应含「${must}」，实际：\n${hint}`);
		}

		// openSource 只断言结构性契约：rejects + SourceError + 非空指引。
		// 有依赖时走 missingDbHint、无依赖时走 missingDepHint，两者都是可读指引，绝非 ENOENT 堆栈。
		await assert.rejects(
			() => openSource("/nonexistent/ziwei-does-not-exist.duckdb"),
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
		assert.ok(missingDbHint("/tmp/x.duckdb").includes("/tmp/x.duckdb"));
		assert.ok(missingDbHint().includes(SAMPLE_DB));
	});

	// 这条指引的存在理由是「别让人误判成语料丢了」——真实撞上时（VS Code 的 DuckDB
	// 扩展以读写模式占了库）最贵的错误就是去找根本不存在的备份。所以断言不只验
	// 「提到了锁」，还验它给出了解法（lsof / 关掉占用者）与安抚（npm test 不受影响）。
	it("库被其他进程锁住时，指引指向「关掉占用它的进程」而非数据丢失", () => {
		const hint = lockedDbHint(
			new Error(
				'IO Error: Could not set lock on file "/x/ziwei.duckdb": ' +
					"Conflicting lock is held in /usr/share/code/code (PID 462628) by user swix."
			),
			"/x/ziwei.duckdb"
		);
		for (const must of ["/x/ziwei.duckdb", "PID 462628", "锁", "lsof", "npm test"]) {
			assert.ok(hint.includes(must), `指引里应含「${must}」，实际：\n${hint}`);
		}
		assert.ok(hint.includes("不是") && hint.includes("损坏"), "必须明说这不是数据损坏");
	});

	it("lockedDbHint 默认指向样本库路径", () => {
		assert.ok(lockedDbHint(new Error("boom")).includes(SAMPLE_DB));
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
