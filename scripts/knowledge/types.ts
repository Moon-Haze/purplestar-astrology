/**
 * 知识源插件接口（Phase 1 · KnowledgeSource 接缝）
 *
 * 架构文档 §4.1：把 `knowledge` 命令的三域（books/stars/tianji）从
 * `cli/knowledge/index.ts` 的硬编码 `switch` 抽成自包含、可注册的插件。新增一个域
 * = 写一个 `KnowledgeSource` 文件 + 在 registry 加一行，不必改 CLI 分发入口
 * （ADR-002：清单注册而非文件系统自动发现）。
 *
 * `search` 收 CLI 无关的 `KnowledgeQuery`（精确字段，由 `cli/knowledge/index.ts` 的
 * `decodeKnowledgeQuery` 从 `CliArgs` 解码而来）：`--search`/`--limit`/`--book`
 * 的三态与值域校验在入口单点承担，位置参数回退是域知识、留在各域实现内
 * （books/stars/tianji 回退为检索词）。
 *
 * 引文核对表不在此接缝：按流派收编走 `SchoolAdapter.citationRoots`（引用内核核对表，
 * 见 `school/types.ts` 与 `citations.test.ts`）——知识源只管检索渲染，不带流派与
 * 核对表字段。
 *
 * 接缝由来（架构文档 §4.1）与「新增一个域」的完整步骤，见 docs/code/knowledge.md。
 *
 * @file 知识源插件接口（Phase 1 · KnowledgeSource 接缝）
 */

/**
 * 知识源的查询参数（CLI 无关）。
 *
 * 由命令入口 `decodeKnowledgeQuery` 从 `CliArgs` 解码而来：裸开关（boolean）已在入口
 * throw，取值参数已收窄为 `string`（或 `undefined`），各源不再需要 `typeof x === "boolean"`
 * + `String(x)` 防御收窄。位置参数回退是域知识、留在各源，故 `positional` 原样透传。
 */
export interface KnowledgeQuery {
	/** `--search` 的字符串值；未给为 `undefined` */
	term?: string;
	/** 位置参数（原样透传，供各源做自己的回退） */
	positional: string[];
	/** `--limit` 的数值；未给为默认 15 */
	limit: number;
	/** `--book` 的字符串值（限册代号或中文名）；未给为 `undefined` */
	book?: string;
}

/** 一个知识源插件：自包含、可注册、自带检索渲染。 */
export interface KnowledgeSource {
	/** 源 id（`--source` 的取值；也是注册表键） */
	id: string;
	/** 人类可读名（概览/报错用） */
	label: string;
	/** 渲染该域的检索输出；返回已渲染文本。 */
	search(query: KnowledgeQuery): string | Promise<string>;
}
