// ── Phase 4 端到端验证：第 14 主题「study」作为纯插件新增 ──
//
// 本文件是 Phase 4 的「插件自身断言」：证明加一个主题只需在 `TOPIC_DEFS` 加一个条目，
// 内核 / CLI 分发零改动，且该主题经 `getTopicAnalysis` 可用、产出非空文本。
// 内核层（层 3 排盘结构不变量 + 内核契约）项数与 Phase 0 基线 117 一致 —— 本文件不污染它。
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./lib/loader.ts";

const { generateChart } = await load<typeof import("@/algorithm")>("@/algorithm");
const { getTopicAnalysis, TOPIC_DEFS, TOPIC_KEYS } =
	await load<typeof import("@/analysis")>("@/analysis");

const SAMPLE = { year: 2011, month: 6, day: 24, timeIndex: 4, gender: "male" } as const;

test("Phase 4 验证：第 14 主题 study 经 getTopicAnalysis 可用且产出非空文本", () => {
	assert.ok((TOPIC_KEYS as readonly string[]).includes("study"), "study 应已登记进 TOPIC_KEYS");
	assert.ok(TOPIC_DEFS.study?.label === "学业科名", "TOPIC_DEFS.study 应已定义");
	const chart = generateChart({ ...SAMPLE });
	const text = getTopicAnalysis(chart, "study");
	assert.ok(text.length > 0, "study 主题应产出非空论断");
	assert.ok(text.includes("学业科名") || text.length > 50, "study 主题产出应包含其论述");
});
