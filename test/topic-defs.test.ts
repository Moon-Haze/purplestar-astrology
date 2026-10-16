import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./lib/loader.ts";

const data = await load<typeof import("@/analysis/data")>("@/analysis/data");
const {
	TOPIC_KEYS,
	TOPIC_DEFS,
	TOPIC_PALACE_NAME,
	TOPIC_LABEL,
	TOPIC_SANFANG_LABELS,
	TOPIC_CONTENT_KEY,
	TOPIC_SUMMARY_KEY,
	TOPIC_KEY_PALACES,
	TOPIC_SUGGESTIONS,
	SUMMARY_TOPICS,
} = data;

test("主题注册表：覆盖与 TOPIC_KEYS 完全一致", () => {
	const defKeys = Object.keys(TOPIC_DEFS).sort();
	const keyKeys = [...TOPIC_KEYS].sort();
	assert.deepStrictEqual(
		defKeys,
		keyKeys,
		"TOPIC_DEFS 必须恰好覆盖 TOPIC_KEYS（加主题只改这一处）"
	);
});

test("主题注册表：每个主题字段齐备且类型合理", () => {
	for (const k of TOPIC_KEYS) {
		const d = TOPIC_DEFS[k];
		assert.ok(typeof d.palace === "string" && d.palace.length > 0, `${k}.palace 非空`);
		assert.ok(typeof d.label === "string" && d.label.length > 0, `${k}.label 非空`);
		assert.ok(
			Array.isArray(d.sanFangLabels) && d.sanFangLabels.length === 3,
			`${k}.sanFangLabels 为三元组`
		);
		assert.ok(typeof d.contentKey === "string", `${k}.contentKey 为 StarContent 键`);
		assert.ok(typeof d.summaryKey === "string", `${k}.summaryKey 为 StarSummaryGender 键`);
		assert.ok(typeof d.isSummaryTopic === "boolean", `${k}.isSummaryTopic 为布尔`);
		assert.ok(
			Array.isArray(d.keyPalaces) && d.keyPalaces.length > 0,
			`${k}.keyPalaces 非空数组`
		);
		for (const kp of d.keyPalaces) {
			assert.ok(typeof kp.palace === "string", `${k}.keyPalaces[].palace 非空`);
			assert.ok(typeof kp.ji === "string", `${k}.keyPalaces[].ji 必填（忌为恒定语义）`);
		}
		assert.ok(
			Array.isArray(d.suggestions) && d.suggestions.length === 3,
			`${k}.suggestions 恰三条`
		);
	}
});

test("主题注册表：派生具名表与 TOPIC_DEFS 同步（防止重加发散字面量表）", () => {
	for (const k of TOPIC_KEYS) {
		const d = TOPIC_DEFS[k];
		assert.strictEqual(TOPIC_PALACE_NAME[k], d.palace, `${k} palace 派生同步`);
		assert.strictEqual(TOPIC_LABEL[k], d.label, `${k} label 派生同步`);
		assert.deepStrictEqual(TOPIC_SANFANG_LABELS[k], d.sanFangLabels, `${k} sanFang 派生同步`);
		assert.strictEqual(TOPIC_CONTENT_KEY[k], d.contentKey, `${k} contentKey 派生同步`);
		assert.strictEqual(TOPIC_SUMMARY_KEY[k], d.summaryKey, `${k} summaryKey 派生同步`);
		assert.deepStrictEqual(TOPIC_KEY_PALACES[k], d.keyPalaces, `${k} keyPalaces 派生同步`);
		assert.deepStrictEqual(TOPIC_SUGGESTIONS[k], d.suggestions, `${k} suggestions 派生同步`);
		assert.strictEqual(
			SUMMARY_TOPICS.has(k),
			d.isSummaryTopic,
			`${k} SUMMARY_TOPICS 与 isSummaryTopic 一致`
		);
	}
});
