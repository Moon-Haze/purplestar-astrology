// ── 层 3：综合建议按盘推算（dynamic-topic-suggestions）──
//
// buildTopicSuggestions 是确定性纯函数：同盘同参数逐字节一致、异盘不同、
// 信号全未命中时显式降级（basis =「无命中信号」，渲染层同句可见）。
// 两端同源：--topic（renderSuggestions）与 --report（getTopicReport）的建议行一致。
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { load } from "./lib/loader.ts";

const { makeContext } = await load<typeof import("@/analysis/context")>("@/analysis/context");
const { buildTopicSuggestions } =
	await load<typeof import("@/analysis/suggestions")>("@/analysis/suggestions");
const { getTopicReport, TOPIC_KEYS } = await load<typeof import("@/analysis")>("@/analysis");
const { renderSuggestions } = await load<typeof import("@/analysis/views/suggestions")>(
	"@/analysis/views/suggestions"
);
const { generateChart } = await load<typeof import("@/algorithm")>("@/algorithm");
const bi = await load<typeof import("@/cli/birth/birth-info")>("@/cli/birth/birth-info");
const argsMod = await load<typeof import("@/cli/args")>("@/cli/args");

type TopicKey = (typeof TOPIC_KEYS)[number];

/** 造盘 + 建主题上下文（args 与 buildBirthInfo 同管线）。 */
function chartCtx(args: string[], topic: TopicKey) {
	const built = bi.buildBirthInfo(argsMod.parseArgs(args, "astrology"));
	const chart = generateChart(built.info);
	return makeContext(chart, topic, {});
}

/** 男盘（help 示例同款）：命宫七杀庙旺。 */
const MALE = ["--date", "2011-06-24", "--time", "07:45", "--gender", "male"];
/** 实测场景盘：命宫紫微落陷。 */
const B = ["--date", "2000-04-06", "--time", "00:15", "--gender", "male"];
/** 未起运盘（土五局、虚岁 3）：currentDx undefined，信号最稀薄。 */
const CHILD = ["--date", "2024-11-20", "--time", "10:00", "--gender", "male"];

describe("综合建议按盘推算", () => {
	it("确定性：同盘同主题两次推算逐字节一致", () => {
		const ctx = chartCtx(MALE, "wealth");
		assert.ok(ctx, "上下文应可建立");
		const a = JSON.stringify(buildTopicSuggestions(ctx));
		const b = JSON.stringify(buildTopicSuggestions(ctx));
		assert.equal(a, b, "同盘同参数必须逐字节一致（确定性是硬约束）");
	});

	it("异盘不同：两张盘的财富建议至少一处不同，且提及各自主星（可指回盘面）", () => {
		const a = buildTopicSuggestions(chartCtx(MALE, "wealth")!);
		const b = buildTopicSuggestions(chartCtx(B, "wealth")!);
		assert.notEqual(JSON.stringify(a), JSON.stringify(b), "异盘建议不应相同");
		assert.ok(
			a.some(l => l.text.includes("贪狼")),
			"甲盘建议应提及甲盘财帛主星贪狼"
		);
		assert.ok(
			b.some(l => l.text.includes("武曲")),
			"乙盘建议应提及乙盘财帛主星武曲"
		);
	});

	it("降级显式可见：无信号组合给通用收束句并标注「无命中信号」", () => {
		// 2024-11-20 未起运盘：田宅宫主星亮度 normal 且主题三方无本命禄忌 → 无信号（探针实测）
		const ctx = chartCtx(CHILD, "home");
		assert.ok(ctx, "上下文应可建立");
		const lines = buildTopicSuggestions(ctx);
		assert.equal(lines.length, 1, "降级时恰一条通用收束句");
		assert.equal(lines[0].basis, "无命中信号", "降级条目必须显式标注");
		assert.ok(lines[0].text.includes("田宅宫主星"), "降级句仍带主题主宫槽位（可指回）");
	});

	it("两端同源：--topic 与 --report 的建议行集合一致", () => {
		const chart = generateChart(bi.buildBirthInfo(argsMod.parseArgs(MALE, "astrology")).info);
		const report = getTopicReport(chart, "wealth", { omitDecadal: true });
		const reportLines = (report.match(/^→ .+$/gm) ?? []).map(l =>
			l.replace(/（本盘无此主题的直接信号，此为通用收束）$/, "")
		);
		const ctx = makeContext(chart, "wealth", {});
		assert.ok(ctx);
		const viewLines = renderSuggestions(ctx)
			.filter(l => l.startsWith("→ "))
			.map(l => l.replace(/（本盘无此主题的直接信号，此为通用收束）$/, ""));
		assert.deepEqual(reportLines, viewLines, "两端建议行应一致（仅版式差异）");
	});

	it("槽位无残留：渲染输出不含未填充的模板槽", () => {
		for (const topic of TOPIC_KEYS) {
			const ctx = chartCtx(MALE, topic);
			assert.ok(ctx);
			const text = renderSuggestions(ctx).join("\n");
			assert.ok(
				!/\{(star|palace|dxPalace|huaStar|huaPalace)\}/.test(text),
				`${topic} 存在未填充槽位`
			);
		}
	});
});
