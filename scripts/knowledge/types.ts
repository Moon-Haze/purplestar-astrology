/**
 * 知识源插件接口（Phase 1 · KnowledgeSource 接缝）
 *
 * 架构文档 §4.1：把 `knowledge` 命令的四域（books/stars/tianji/oracle）从
 * `cli/knowledge/index.ts` 的硬编码 `switch` 抽成自包含、可注册的插件。新增一个域
 * = 写一个 `KnowledgeSource` 文件 + 在 registry 加一行，不必改 CLI 分发入口
 * （ADR-002：清单注册而非文件系统自动发现）。
 *
 * `search` 签名刻意保持与现有 `renderBooks`/`renderStars`/`renderTianji`/`renderOracle`
 * 一致（`(args: CliArgs) => string | Promise<string>`），让迁移零改行为。
 *
 * `citations` 是引文核对表的扩展点占位：Phase 3（SchoolAdapter + 按流派引文守卫）落地时，
 * 把 `corpus/annotations.ts` 的全局核对表收进各源，并按流派分派。Phase 1 不填充它，
 * 以免破坏 `citations.test.ts` 的全局扫描（该测试在 Phase 3 重构）。
 */

import type { CliArgs } from "@/cli/args";

/** 一条引文核对项（占位形状；Phase 3 落地时与 annotations.ts 对齐）。 */
export interface CitationRef {
	/** 被核对的引用标识（如「倪师说 / 天纪 §x」） */
	ref: string;
	/** 核对说明（口径 / 出处 / 风险等级） */
	description: string;
}

/** 一个知识源插件：自包含、可注册、自带渲染与（未来的）引文核对表。 */
export interface KnowledgeSource {
	/** 源 id（`--source` 的取值；也是注册表键） */
	id: string;
	/** 人类可读名（概览/报错用） */
	label: string;
	/** 流派归属（可选；Phase 3 SchoolAdapter 落地后填充） */
	school?: string;
	/** 渲染该域的检索输出；返回已渲染文本。 */
	search(args: CliArgs): string | Promise<string>;
	/** 该源自带的引文核对表（可选；Phase 3 填充） */
	citations?: readonly CitationRef[];
}
