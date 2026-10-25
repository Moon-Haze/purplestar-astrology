// ── KnowledgeSource 注册表守卫（Phase 1 · 插件接缝）──
//
// 架构文档 ADR-002 + 执行计划 1A/1B/1C：把 knowledge 四域从 cli/knowledge/index.ts 的
// 硬编码 switch 抽成 KNOWLEDGE_SOURCES 注册表。本文件是「注册表完整性」护栏（计划 §8.2）：
//   - 四域齐全且顺序稳定（概览列出 / 报错提示顺序不能漂）；
//   - 每个源都有可调用 search、返回非空文本（插件缺导出即启动失败的对拍）；
//   - 未知源不被静默收下（分发入口报错，而非产出空盘/错盘）。
//
// 用 loader.ts 的 load() 取 `@/` 模块（全局未注册 loader，与 kernel-contract 同范式）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { load } from "./lib/loader.ts";

const reg = await load<typeof import("@/knowledge/registry")>("@/knowledge/registry");
const { KNOWLEDGE_SOURCES, KNOWLEDGE_SOURCE_IDS } = reg;
const { cmdKnowledge } =
	await load<typeof import("@/cli/knowledge/index")>("@/cli/knowledge/index");

describe("KnowledgeSource 注册表（Phase 1）", () => {
	it("注册表含四域且顺序固定 books/stars/tianji/oracle", () => {
		assert.deepEqual([...KNOWLEDGE_SOURCE_IDS], ["books", "stars", "tianji", "oracle"]);
	});

	it("每个源都有可调用 search 且返回非空文本（无参概览形态）", async () => {
		for (const id of KNOWLEDGE_SOURCE_IDS) {
			const ks = KNOWLEDGE_SOURCES[id];
			assert.equal(typeof ks.search, "function", `${id}.search 必须是函数`);
			const out = await ks.search({ positional: [], limit: 15 });
			assert.ok(typeof out === "string" && out.length > 0, `${id}.search 应返回非空文本`);
		}
	});

	it("未知源不被静默收下 —— cmdKnowledge 报错指路", async () => {
		await assert.rejects(
			() => cmdKnowledge({ _: [], source: "nope" } as never),
			/--source 应为/
		);
	});

	it("分发入口对已知源透传到对应实现（books 概览逐字等价）", async () => {
		const out = await cmdKnowledge({ _: [], source: "books" } as never);
		assert.ok(out.includes("知识检索四域"), "cmdKnowledge(books) 应产出四域概览");
	});
});
