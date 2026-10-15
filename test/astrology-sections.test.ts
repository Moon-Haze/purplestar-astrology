// ── 专题旗标 → section 接线（候选 3 · 可测 interface）──
//
// 架构评审候选 3：把「给定 args + 排盘上下文 → 产出 section 序列」从 cmdAstrology 的
// 内联块抽成 composeSections，让接线本身成为被测物（原接线只在子进程端到端才测得到，
// 且 --decadal / --ages 长期缺端到端覆盖）。
//
// 本文件双重锁定：
//  1. composeSections 的**顺序契约**（pattern → mutagen → yearly → decadal → ages → focus）
//     与守卫链（monthly/daily/hourly 须配 mutagen 层级）—— 接线改了这里先红；
//  2. --decadal / --ages 经 cmdAstrology 端到端可用（计划 §3 复核指出的覆盖缺口）。
//
// ⚠️ `@/` 别名只在 loader.ts 的 load() 内解析（全局未注册 loader），故本文件沿用
// kernel-contract 的 load() 范式取 `@/` 模块，不写运行时裸 `@/` import。
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { load } from "./lib/loader.ts";

const astrology = await load<typeof import("@/cli/commands/astrology")>("@/cli/commands/astrology");
const {
	composeSections,
	cmdAstrology,
	parseYearlyArg,
	parseMonthlyArg,
	parseDailyArg,
	parseHourlyArg,
} = astrology;
const { parseArgs } = await load<typeof import("@/cli/args")>("@/cli/args");
const { buildBirthInfo } =
	await load<typeof import("@/cli/birth/birth-info")>("@/cli/birth/birth-info");
const { toBasis } = await load<typeof import("@/cli/birth/birth-info-defs")>(
	"@/cli/birth/birth-info-defs"
);
const { generateChart } = await load<typeof import("@/algorithm")>("@/algorithm");

/** 用与 CLI 完全相同的管线造一份 chart + composeSections 所需上下文。 */
function ctx(extra: string[]) {
	const args = parseArgs(
		["--date", "1990-05-15", "--time", "09:30", "--no-dst", "--gender", "male", ...extra],
		"astrology"
	);
	const built = buildBirthInfo(args);
	const basis = toBasis(built, args.time);
	const chart = generateChart(built.info);
	return {
		chart,
		args,
		basis,
		info: built.info,
		liuNianYear: parseYearlyArg(args),
		liuYueMonth: parseMonthlyArg(args),
		liuRiDay: parseDailyArg(args),
		liuShiHour: parseHourlyArg(args),
	};
}

describe("专题旗标→section 接线（候选 3）", () => {
	it("composeSections 顺序契约：pattern → mutagen → yearly → decadal → ages", () => {
		// 五个互不重叠的锚点；任一顺序被改（如 decadal 落到 yearly 前）会立即变红。
		const c = ctx([
			"--pattern",
			"--mutagen",
			"--yearly",
			"2027",
			"--decadal",
			"37",
			"--ages",
			"45",
		]);
		const out = composeSections(c.chart, c.args, {
			liuNianYear: c.liuNianYear,
			liuYueMonth: c.liuYueMonth,
			liuRiDay: c.liuRiDay,
			liuShiHour: c.liuShiHour,
			basis: c.basis,
			info: c.info,
		}).join("\n");
		const iPattern = out.indexOf("【格局识别】");
		const iMutagen = out.indexOf("【生年四化】");
		const iYearly = out.indexOf("流年】");
		const iDecadal = out.indexOf("【大限 · 十年大运】");
		const iAges = out.indexOf("【小限】");
		for (const [name, i] of [
			["pattern", iPattern],
			["mutagen", iMutagen],
			["yearly", iYearly],
			["decadal", iDecadal],
			["ages", iAges],
		] as const) {
			assert.ok(i >= 0, `section 缺失：${name}`);
		}
		assert.ok(
			iPattern < iMutagen && iMutagen < iYearly && iYearly < iDecadal && iDecadal < iAges,
			"专题顺序应为 pattern → mutagen → yearly → decadal → ages"
		);
	});

	it("composeSections 含 focus 节（--focus 财帛 落到 focus 专题）", () => {
		const c = ctx(["--focus", "财帛"]);
		const out = composeSections(c.chart, c.args, {
			liuNianYear: c.liuNianYear,
			liuYueMonth: c.liuYueMonth,
			liuRiDay: c.liuRiDay,
			liuShiHour: c.liuShiHour,
			basis: c.basis,
			info: c.info,
		}).join("\n");
		assert.ok(out.includes("财帛"), "--focus 财帛 应产出财帛宫专题节");
	});

	it("无深掘旗标时带信息面板、不含任何专题节", () => {
		const c = ctx([]);
		const out = composeSections(c.chart, c.args, {
			liuNianYear: c.liuNianYear,
			liuYueMonth: c.liuYueMonth,
			liuRiDay: c.liuRiDay,
			liuShiHour: c.liuShiHour,
			basis: c.basis,
			info: c.info,
		}).join("\n");
		assert.ok(out.includes("命宫"), "无深掘应输出信息面板（含命宫）");
		assert.ok(!out.includes("【格局识别】"), "无深掘不应含格局专题");
		assert.ok(!out.includes("【生年四化】"), "无深掘不应含四化专题");
	});

	it("端到端：--decadal 经 cmdAstrology 产出大限专题", () => {
		const out = cmdAstrology(
			parseArgs(
				[
					"--date",
					"1990-05-15",
					"--time",
					"09:30",
					"--no-dst",
					"--gender",
					"male",
					"--decadal",
					"37",
				],
				"astrology"
			)
		);
		assert.ok(out.includes("【大限 · 十年大运】"), "--decadal 应产出大限专题节");
	});

	it("端到端：--ages 经 cmdAstrology 产出小限专题", () => {
		const out = cmdAstrology(
			parseArgs(
				[
					"--date",
					"1990-05-15",
					"--time",
					"09:30",
					"--no-dst",
					"--gender",
					"male",
					"--ages",
					"45",
				],
				"astrology"
			)
		);
		assert.ok(out.includes("【小限】"), "--ages 应产出小限专题节");
	});

	it("守卫链：--monthly 不带 --mutagen 必须报错指路", () => {
		assert.throws(
			() =>
				cmdAstrology(
					parseArgs(
						[
							"--date",
							"1990-05-15",
							"--time",
							"09:30",
							"--no-dst",
							"--gender",
							"male",
							"--monthly",
							"6",
						],
						"astrology"
					)
				),
			/需要 --mutagen/
		);
	});
});
