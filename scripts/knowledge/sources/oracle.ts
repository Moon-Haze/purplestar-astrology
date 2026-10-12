/**
 * knowledge 的 **oracle 域**：断语手册检索（Phase 1 · KnowledgeSource 接缝）。
 *
 * 实现复用 `cli/knowledge/oracle.ts` 的 `renderOracle`。本文件只把它包成 `KnowledgeSource`，
 * 并保持**懒加载纪律**：`renderOracle` 内部 `await import("@/corpus/data/manual/index.ts")`
 * （4.4MB 分类断语）只在查询时加载，本包装模块本身不静态引重数据，CLI 主链路不吃它。
 */

import type { CliArgs } from "@/cli/args";
import type { KnowledgeSource } from "../types";

export const oracleSource: KnowledgeSource = {
	id: "oracle",
	label: "断语手册",
	async search(args: CliArgs): Promise<string> {
		return (await import("@/cli/knowledge/oracle")).renderOracle(args);
	},
};
