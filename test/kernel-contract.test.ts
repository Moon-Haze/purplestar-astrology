// ── 内核对外契约冻结守卫（Phase 0 · 0C）──
//
// 本文件把「内核对外纯函数面」钉成可断言事实（架构文档 ADR-003 + 执行计划 0C）。
// 插件化（Phase 1–4）只许消费此面、不得修改它；本测试是「插件越界改内核」的报警红线：
// 一旦内核签名被改 / 符号被删 / 绊线被回填，这里先红。
//
// 编辑本文件的情形只有两种：内核对外契约**被正式变更**（需先回架构评审），或新增冻结符号。
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { load, loadAlgorithm } from "./lib/loader.ts";

const algorithm = await loadAlgorithm();
const palaceRelations = await load<typeof import("@/palace-relations")>("@/palace-relations");
const sihua = await load<typeof import("@/mutagen")>("@/mutagen");
const wenmo = await load<typeof import("@/wenmo-brightness")>("@/wenmo-brightness");

const isFn = (v: unknown): v is (...a: never[]) => unknown => typeof v === "function";

describe("内核对外契约（冻结 @ 2026-10-12）", () => {
	it("generateChart 在契约面且为单参函数", () => {
		assert.ok(isFn(algorithm.generateChart), "generateChart 必须是对外函数");
		assert.equal(algorithm.generateChart.length, 1, "generateChart 签名应为 (birthInfo)");
	});

	it("宫位关系查询在契约面", () => {
		assert.ok(
			isFn(palaceRelations.oppositeBranch),
			"palace-relations.oppositeBranch 必须在契约面"
		);
		assert.ok(
			isFn(palaceRelations.surroundBranches),
			"palace-relations.surroundBranches 必须在契约面"
		);
		assert.ok(
			isFn(palaceRelations.palaceAtBranch),
			"palace-relations.palaceAtBranch 必须在契约面"
		);
		assert.ok(
			isFn(palaceRelations.mustPalaceAtBranch),
			"palace-relations.mustPalaceAtBranch 必须在契约面"
		);
		assert.equal(palaceRelations.oppositeBranch.length, 1, "oppositeBranch 签名应为 (branch)");
	});

	it("四化查询在契约面", () => {
		for (const name of [
			"getYearStemIndex",
			"getMutagenByStem",
			"getNativeMutagen",
			"getYearlyMutagen",
			"getMonthlyMutagen",
			"getDaXianMutagen",
			"getDailyMutagen",
			"getHourlyMutagen",
		] as const) {
			assert.ok(isFn(sihua[name]), `mutagen.${name} 必须在契约面`);
		}
		assert.equal(sihua.getMutagenByStem.length, 1, "getMutagenByStem 签名应为 (stemIndex)");
		assert.equal(sihua.getYearStemIndex.length, 1, "getYearStemIndex 签名应为 (year)");
		// 生年层的 chart 适配收进内核（原 cli/fortune 的 nativeSiHuaOf）：签名 (chart)、
		// 返回与六层同形（stemIndex / stemName / transforms）—— 年干取 lunarInfo.yearStem。
		assert.equal(sihua.getNativeMutagen.length, 1, "getNativeMutagen 签名应为 (chart)");
	});

	it("亮度查询在契约面", () => {
		assert.ok(
			isFn(wenmo.wenmoStarBrightness),
			"wenmo-brightness.wenmoStarBrightness 必须在契约面"
		);
		assert.ok(
			isFn(wenmo.getBrightnessSchool),
			"wenmo-brightness.getBrightnessSchool 必须在契约面"
		);
		assert.ok(
			isFn(wenmo.setBrightnessSchool),
			"wenmo-brightness.setBrightnessSchool 必须在契约面"
		);
		assert.equal(
			wenmo.wenmoStarBrightness.length,
			2,
			"wenmoStarBrightness 签名应为 (starName, branchIdx)"
		);
		assert.equal(wenmo.setBrightnessSchool.length, 1, "setBrightnessSchool 签名应为 (school)");
		assert.equal(wenmo.getBrightnessSchool.length, 0, "getBrightnessSchool 签名应为 ()");
	});

	it("绊线字段运行时恒为空 —— 体系立场（倪师三合派）不可回填", () => {
		const { generateChart } = algorithm;
		const chart = generateChart({
			year: 2011,
			month: 6,
			day: 24,
			timeIndex: 7,
			gender: "male",
		});
		for (const p of chart.palaces) {
			assert.equal(
				p.selfMutagen,
				undefined,
				`${p.name} 填了 selfMutagen —— 飞星派宫干自化，合约禁止回填`
			);
		}
		for (const dx of chart.decadals) {
			assert.ok(!("mutagen" in dx), "大限出现 mutagen —— 飞星派大限四化，合约禁止回填");
		}
	});
});
