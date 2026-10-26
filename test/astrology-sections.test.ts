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

// ── 全盘报告装配（report-assembly · refine-report-dedup-citations）──
//
// 三条装配行为锁定：大限节唯一、论断全文首现（复现降级指引）、单主题路径零影响；
// 以及经典出处的双通道相关性过滤（主题星判定 / 语境词共现，专章免滤）。
const reportCmd = await load<typeof import("@/cli/commands/report")>("@/cli/commands/report");
const { getTopicReport } = await load<typeof import("@/analysis")>("@/analysis");
const { buildReport, topicCitations } = reportCmd;
const lookups = await load<typeof import("@/analysis/lookups")>("@/analysis/lookups");
const dataModule = await load<typeof import("@/analysis/data")>("@/analysis/data");

/** 造一份指定日期时辰的盘 + buildReport 所需口径（与 ctx() 同管线）。 */
function chartFor(date: string, time = "09:30") {
	const args = parseArgs(
		["--date", date, "--time", time, "--no-dst", "--gender", "male"],
		"astrology"
	);
	const built = buildBirthInfo(args);
	const basis = toBasis(built, args.time);
	return { chart: generateChart(built.info), info: built.info, basis };
}

describe("全盘报告装配：大限节唯一与全文首现", () => {
	it("已起运盘：大限独立节恰一处，板块内无大限小节，倪师口径句全报告仅一次", () => {
		const { chart, info, basis } = chartFor("1990-05-15");
		const report = buildReport(chart, info, basis);
		assert.equal(
			report.split("\n## 当前大限").length - 1,
			1,
			"文档头区应恰有一个「## 当前大限」独立节"
		);
		assert.ok(!report.includes("\n### 当前大限\n"), "板块内不应再有「### 当前大限」小节");
		assert.equal(
			report.split("倪师《天纪 03》明示").length - 1,
			1,
			"大限口径句随大限节唯一化，从 13 次收敛为 1 次"
		);
	});

	it("未起运盘：独立节给童限提示，不硬套大限", () => {
		// 2024-11-20 男：土五局、虚岁 3 < 5 → currentDecadalIndex === -1（探针实测）
		const { chart, info, basis } = chartFor("2024-11-20");
		assert.equal(chart.currentDecadalIndex, -1, "样例日期应未起运（样例失效时换日期重探）");
		const report = buildReport(chart, info, basis);
		assert.ok(
			report.includes("（尚未起运 —— 虚岁小于五行局数时不入大限，按命宫论"),
			"独立大限节应给童限提示"
		);
	});

	it("论断全文首现：无重复长正文段，复现处降级为指引行", () => {
		const { chart, info, basis } = chartFor("1990-05-15");
		const report = buildReport(chart, info, basis);
		// 长正文段（≥60 字）排除引用块 / 清单 / 标题 / 格局行 —— ⭐ 格局行与总览注入
		// 在 overview 与 personality 双板块各出一次也是既有行为（--report 的性格板块
		// 总览注入已随 polish-report-residuals 去重，格局行仍两出：--topic 形态保留）
		const longLines = report.split("\n").filter(l => l.length >= 60 && !/^[>#⭐-]/.test(l));
		const counts = new Map<string, number>();
		for (const l of longLines) {
			counts.set(l, (counts.get(l) ?? 0) + 1);
		}
		const dups = [...counts.entries()].filter(([, c]) => c > 1);
		assert.deepEqual(dups, [], "星曜×宫位论断全文不应跨板块重复");
		const guides = report.match(/（论断详见「.+?」板块）/g) ?? [];
		assert.ok(guides.length > 0, "三方联动的复引应降级为指引行");
	});

	it("双主星主场展开：第二主星全文在主场板块首现，指引指回主场（不再漂移）", () => {
		// 2000-04-06 子时男：命宫辰 紫微+天相 双主星（基线里天相全文漂移在财富板块）
		const { chart, info, basis } = chartFor("2000-04-06", "00:15");
		const report = buildReport(chart, info, basis);
		const overviewSec = report.split("## 财富运势")[0];
		assert.ok(
			overviewSec.includes("天相印星守命"),
			"天相（第二主星）的命宫全文应在命格总览板块核心论断展开"
		);
		const drift = report.split("## 财富运势")[1] ?? "";
		assert.ok(
			!drift.includes("天相印星守命"),
			"天相全文不应再出现在财富板块的三方联动（应降级为指引）"
		);
		assert.ok(
			report.includes("**天相（庙旺）**（论断详见「命格总览」板块）"),
			"天相的指引应指回命格总览（基线指「财富运势」）"
		);
	});

	it("四化注首现：注句全报告一次，落点行恒出", () => {
		const { chart, info, basis } = chartFor("2000-04-06", "00:15");
		const report = buildReport(chart, info, basis);
		// 武曲化权落财帛宫被五个板块的三方覆盖（基线注 ×5）；天同化忌注基线 ×4
		assert.equal(report.split("掌财有道").length - 1, 1, "化权语义注全报告恰一次");
		assert.equal(report.split("福德受损，感情多波折").length - 1, 1, "化忌语义注全报告恰一次");
		const landing = report.match(/🔵 \*\*武曲化权\*\*（落财帛宫）/g) ?? [];
		assert.equal(landing.length, 5, "化权落点行五个板块恒出，不隐藏四化事实");
	});

	it("句读完整：报告正文无以孤立分号收尾的行（分支拆分残留清洗）", () => {
		const { chart, info, basis } = chartFor("2000-04-06", "00:15");
		const report = buildReport(chart, info, basis);
		const trailing = report.split("\n").filter(l => l.endsWith("；"));
		assert.deepEqual(
			trailing,
			[],
			`正文不应有「；」收尾的行（基线 3 处）：\n${trailing.slice(0, 3).join("\n")}`
		);
	});

	it("性格板块去重：无总览注入与性格深描小节", () => {
		const { chart, info, basis } = chartFor("2000-04-06", "00:15");
		const report = buildReport(chart, info, basis);
		const persSec = report.split("## 性格特质")[1]?.split("\n## ")[0] ?? "";
		assert.ok(!persSec.includes("### 性格深描"), "性格深描与核心论断同文，应省略");
		assert.ok(!persSec.includes("### 总览"), "总览注入与命格总览板块逐字重复，应省略");
		assert.ok(persSec.includes("### 核心论断"), "核心论断保留");
	});

	it("单主题路径零影响：getTopicReport 缺省仍含板块内大限小节", () => {
		const { chart } = chartFor("1990-05-15");
		const single = getTopicReport(chart, "wealth", {});
		assert.ok(single.includes("### 当前大限"), "缺省（--topic）行为不变");
	});
});

describe("经典出处双通道相关性过滤", () => {
	it("罗列段不收录：疾厄宫+天同 不召回机月同梁格段（天同仅被罗列）", () => {
		const hits = topicCitations({ palaceName: "疾厄宫", primaryStarName: "天同" });
		for (const h of hits) {
			assert.ok(!h.text.includes("机月同梁"), "机月同梁格句的天同是被罗列，不是主题星");
		}
	});

	it("主题星段收录：子女宫+太阳 召回太阳星论段，且每条均过双通道", () => {
		const hits = topicCitations({ palaceName: "子女宫", primaryStarName: "太阳" });
		assert.ok(hits.length > 0, "太阳星论段（星名多次出现）应被主题星通道保留");
		for (const h of hits) {
			const isThemeStar = h.text.split("太阳").length - 1 >= 2;
			const hasContext = /子女|子息|儿孙|后嗣/.test(h.text);
			assert.ok(isThemeStar || hasContext, `召回未过双通道：《${h.loc}》`);
			assert.ok(!h.text.includes("巨门属水"), "巨门论段（太阳仅罗列）不应收录");
		}
	});

	it("专章免滤：财帛宫+武曲 召回《全书·十二宫论·财帛宫》专章段", () => {
		const hits = topicCitations({ palaceName: "财帛宫", primaryStarName: "武曲" });
		assert.ok(
			hits.some(h => h.loc.includes("十二宫论·财帛宫")),
			"宫位专章段落不受双通道过滤约束"
		);
	});

	it("查不到即省略：无候选时返回空数组（报告侧整节省略）", () => {
		// 天同在库内多与机月同梁并列、无独立星论段 → 疾厄宫+天同 双通道零候选
		const hits = topicCitations({ palaceName: "疾厄宫", primaryStarName: "天同" });
		assert.equal(hits.length, 0, "不凑数：零候选即空数组");
	});
});

// ── 条件分支投影（structure-content-branches）──
//
// 真实消费路径的四连全枚举条目（武曲·财帛）：命中分支逐字出现、未命中分支消失。
describe("条件分支投影（武曲·财帛四连全枚举）", () => {
	const { selectBranches } = lookups;
	const { STAR_CONTENT_MAP } = dataModule;

	it("化权命盘：只出化权分支，禄/科/忌未命中分支消失", () => {
		const out = selectBranches(
			STAR_CONTENT_MAP["武曲"].caiBo,
			{ mutagen: "权", brightness: "bright" },
			"male"
		);
		assert.ok(out.includes("化权则凭自身能力累积大财"), "命中化权子句应逐字出现");
		assert.ok(!out.includes("化禄则大富"), "未命中化禄分支不应出现");
		assert.ok(!out.includes("化科则以专业技术换财"), "未命中化科分支不应出现");
		assert.ok(!out.includes("化忌时要防意外支出"), "未命中化忌分支不应出现");
	});

	it("未化武曲盘：common 散文保留、四条分支全部消失", () => {
		const out = selectBranches(
			STAR_CONTENT_MAP["武曲"].caiBo,
			{ mutagen: "", brightness: "bright" },
			"male"
		);
		assert.ok(out.includes("财帛宫武曲，财星本位"), "common 散文应保留");
		assert.ok(!out.includes("化权则凭自身能力累积大财"), "无四化时全部分支消失");
	});
});
