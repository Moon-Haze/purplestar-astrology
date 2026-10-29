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
		// 2026-03-10 未起运盘：命宫主星亮度非庙旺、三方四正虽有四化但不是禄 / 忌、
		// 大限未起 → 三个槽位全空 → 降级（探针实测）。
		// ⚠️ 原用例用 2024-11-20 home（田宅宫）：修好「本命四化」槽后，该盘三方四正里的
		//    本命禄 / 忌开始命中，不再降级 —— 换盘是修槽的直接连带，不是放宽判据。
		const ctx = chartCtx(
			["--date", "2026-03-10", "--time", "09:00", "--gender", "male", "--no-dst"],
			"overview"
		);
		assert.ok(ctx, "上下文应可建立");
		const lines = buildTopicSuggestions(ctx);
		assert.equal(lines.length, 1, "降级时恰一条通用收束句");
		assert.equal(lines[0].basis, "无命中信号", "降级条目必须显式标注");
		assert.ok(lines[0].text.includes("命宫"), "降级句仍带主题主宫槽位（可指回）");
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

	it("反向注入：三方内唯一的本命四化由辅星承载时，按「本命四化」出句而不降级", () => {
		// 1949-06-15（己干，文曲化忌落财帛宫）：财帛主题的三方四正内**只有**这一条四化，
		// 且它由辅星承载 —— 口径若收紧到只主星，这里会静默降级成「无命中信号」。
		const ctx = chartCtx(["--date", "1949-06-15", "--time", "10:00", "--gender", "male"], "wealth");
		assert.ok(ctx, "上下文应可建立");
		const softOnly = ctx.mutagenInSanFang.every(
			m =>
				ctx.sanFang.flatMap(p => p.stars).find(s => s.name === m.starName)?.type !== "major"
		);
		assert.ok(
			ctx.mutagenInSanFang.length > 0 && softOnly,
			"空转防护：本盘财帛三方四正的四化应全为辅星承载"
		);
		const lines = buildTopicSuggestions(ctx);
		const hua = lines.filter(l => l.basis === "本命四化");
		assert.ok(hua.length > 0, "辅星四化是唯一信号时，仍须按「本命四化」出句");
		assert.ok(
			hua.some(l => l.text.includes("文曲")),
			`建议句应提及该辅星，实得：${hua.map(l => l.text).join(" / ")}`
		);
		assert.ok(
			!lines.some(l => l.basis === "无命中信号"),
			"有信号时不得降级为通用收束句"
		);
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
