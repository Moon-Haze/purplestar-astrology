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
	missingDbHint,
	missingDepHint,
	openSource,
} from "./lib/sample-source.ts";

describe("基准数据源（纯函数与错误指引）", () => {
	it("SAMPLE_DB 指向 <skill 根>/db/ziwei.duckdb", () => {
		assert.match(SAMPLE_DB, /\/db\/ziwei\.duckdb$/);
	});

	it("库文件缺失时抛 SourceError，指引里写明「不是数据丢失」与语料仍在 reference/", async () => {
		await assert.rejects(
			() => openSource("/nonexistent/ziwei-does-not-exist.duckdb"),
			(err: unknown) => {
				assert.ok(err instanceof SourceError, "应当是 SourceError");
				for (const must of [
					"/nonexistent/ziwei-does-not-exist.duckdb",
					"不入版本控制",
					"reference/ziwei-samples-toolkit/samples-out",
					"不是",
					"npm test",
				]) {
					assert.ok(err.message.includes(must), `指引里应含「${must}」，实际：\n${err.message}`);
				}
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
});
