/**
 * 知识源插件接口（KnowledgeSource 接缝）。
 * 把 `knowledge` 三域（books/stars/tianji）从 `cli/knowledge/index.ts` 的硬编码 `switch`
 * 抽成可注册插件：新增域 = 写 `KnowledgeSource` 文件 + registry 加一行，不改 CLI 分发
 * （ADR-002 清单注册）。
 * `search` 收 CLI 无关的 `KnowledgeQuery`（`decodeKnowledgeQuery` 从 `CliArgs` 解码）：
 * `--search`/`--limit`/`--book` 校验在入口单点，位置参数回退留在各域（回退为检索词）。
 * 引文核对表不在此接缝（走 `SchoolAdapter.citationRoots`，见 `school/types.ts` /
 * `citations.test.ts`）；知识源只管检索渲染。「新增一个域」步骤见 docs/code/knowledge.md。
 * @file 知识源插件接口
 */

/**
 * 查询参数（CLI 无关）。由 `decodeKnowledgeQuery` 从 `CliArgs` 解码：裸开关已在入口
 * throw，取值收窄为 `string | undefined`，各源无需 `typeof` 防御。位置参数回退是域知识，
 * 留在各源，`positional` 原样透传。
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
