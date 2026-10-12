/**
 * knowledge 的 **tianji 域**：天纪判语检索（Phase 1 · KnowledgeSource 接缝）。
 *
 * 实现复用 `cli/knowledge/tianji.ts` 的 `renderTianji`。本文件只把它包成 `KnowledgeSource`，
 * 并保持**懒加载纪律**：`renderTianji` 内部 `await import("@/corpus/data/tianji")`（392KB
 * 语料）只在查询时加载，本包装模块本身不静态引重数据，CLI 主链路不吃它。
 */

import type { CliArgs } from "@/cli/args";
import type { KnowledgeSource } from "../types";

export const tianjiSource: KnowledgeSource = {
	id: "tianji",
	label: "天纪判语",
	async search(args: CliArgs): Promise<string> {
		return (await import("@/cli/knowledge/tianji")).renderTianji(args);
	},
};
