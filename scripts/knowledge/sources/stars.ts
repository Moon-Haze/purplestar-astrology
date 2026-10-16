/**
 * knowledge 的 **stars 域**：星曜释义（Phase 1 · KnowledgeSource 接缝）。
 *
 * 实现复用 `cli/knowledge/stars.ts` 的 `renderStars`（薄包装，数据来自内核轻表
 * `STAR_DESCRIPTIONS`，静态 import 不影响启动）。本文件只把它包成 `KnowledgeSource`。
 */

import type { CliArgs } from "@/cli/args";
import type { KnowledgeSource } from "../types";
import { renderStars } from "@/cli/knowledge/stars";

export const starsSource: KnowledgeSource = {
	id: "stars",
	label: "星曜释义",
	search(args: CliArgs): string {
		return renderStars(args);
	},
};

// 四域包装的迁移史与懒加载纪律见 docs/code/knowledge.md。
