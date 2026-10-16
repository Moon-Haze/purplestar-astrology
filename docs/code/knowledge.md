# knowledge —— 知识源扩展点

本篇覆盖 `scripts/knowledge/`：`types.ts`（`KnowledgeSource` 接缝）·
`registry.ts`（声明式注册表）· `sources/books.ts` / `sources/stars.ts` /
`sources/tianji.ts` / `sources/oracle.ts`（四域包装）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`types.ts`：知识源插件接口

> 知识源插件接口（Phase 1 · KnowledgeSource 接缝）
>
> 架构文档 §4.1：把 `knowledge` 命令的四域（books/stars/tianji/oracle）从
> `cli/knowledge/index.ts` 的硬编码 `switch` 抽成自包含、可注册的插件。新增一个域
> = 写一个 `KnowledgeSource` 文件 + 在 registry 加一行，不必改 CLI 分发入口
> （ADR-002：清单注册而非文件系统自动发现）。
>
> `search` 签名刻意保持与现有 `renderBooks`/`renderStars`/`renderTianji`/`renderOracle`
> 一致（`(args: CliArgs) => string | Promise<string>`），让迁移零改行为。
>
> `citations` 是引文核对表的扩展点占位：Phase 3（SchoolAdapter + 按流派引文守卫）落地时，
> 把 `corpus/annotations.ts` 的全局核对表收进各源，并按流派分派。Phase 1 不填充它，
> 以免破坏 `citations.test.ts` 的全局扫描（该测试在 Phase 3 重构）。

---

## 二、`registry.ts`：清单注册与懒加载纪律

> 知识源注册表（Phase 1 · KnowledgeSource 接缝）
>
> 把 `knowledge` 命令的四域收成一张声明式注册表。CLI 分发入口只查这张表，不再写
> `switch`（ADR-002：清单注册而非文件系统自动发现——typecheck 兜底、与现有
> `COMMAND_TABLE` 哲学一致）。新增一个域 = 写一个 `sources/<id>.ts` + 下面加一行，
> 不必改 `cli/knowledge/index.ts`。
>
> 懒加载纪律：tianji / oracle 两域的实现在 `search` 内 `await import` 重数据，注册表
> 静态 import 这些包装模块（轻量）不会把 392KB / 4.4MB 数据拉进 CLI 启动。

⚠️ `KNOWLEDGE_SOURCES` 的**键序即概览列出与报错提示的顺序**；`KNOWLEDGE_SOURCE_IDS`
是键集合的单一真相源，CLI 报错提示与自检断言复用它，**不手抄字符串**。

---

## 三、`sources/`：四域包装

### 3.1 `books.ts`：默认域，无懒加载顾虑

> knowledge 的 **books 域**：古籍原文检索（默认域）。
>
> 从 `cli/knowledge/index.ts` 的 `renderBooks` 迁来（Phase 1 · KnowledgeSource 接缝），
> 逻辑逐字不变，仅改为 `KnowledgeSource` 形态。books 域静态引 `@/corpus`（古籍数据
> 已静态打包进代码，零 DB 依赖），启动无懒加载顾虑。

### 3.2 `stars.ts`：薄包装，数据来自内核轻表

> knowledge 的 **stars 域**：星曜释义（Phase 1 · KnowledgeSource 接缝）。
>
> 实现复用 `cli/knowledge/stars.ts` 的 `renderStars`（薄包装，数据来自内核轻表
> `STAR_DESCRIPTIONS`，静态 import 不影响启动）。本文件只把它包成 `KnowledgeSource`。

### 3.3 `tianji.ts`：懒加载 392KB 语料

> knowledge 的 **tianji 域**：天纪判语检索（Phase 1 · KnowledgeSource 接缝）。
>
> 实现复用 `cli/knowledge/tianji.ts` 的 `renderTianji`。本文件只把它包成 `KnowledgeSource`，
> 并保持**懒加载纪律**：`renderTianji` 内部 `await import("@/corpus/data/tianji")`（392KB
> 语料）只在查询时加载，本包装模块本身不静态引重数据，CLI 主链路不吃它。

### 3.4 `oracle.ts`：懒加载 4.4MB 断语

> knowledge 的 **oracle 域**：断语手册检索（Phase 1 · KnowledgeSource 接缝）。
>
> 实现复用 `cli/knowledge/oracle.ts` 的 `renderOracle`。本文件只把它包成 `KnowledgeSource`，
> 并保持**懒加载纪律**：`renderOracle` 内部 `await import("@/corpus/data/manual/index.ts")`
> （4.4MB 分类断语）只在查询时加载，本包装模块本身不静态引重数据，CLI 主链路不吃它。

---

## 四、新增一个域的完整步骤

1. 在 `sources/<id>.ts` 写一个 `KnowledgeSource`（重数据一律 `await import`，别静态引）；
2. 在 `registry.ts` 的 `KNOWLEDGE_SOURCES` 加一行（键 = `--source` 取值）；
3. 完事 —— `cli/knowledge/index.ts` 的分发入口、概览文案与报错提示都从注册表派生。

⚠️ Phase 3 落地时 `citations` 会从占位变成真核对表，届时 `citations.test.ts` 的
全局扫描一并重构 —— 两件事必须同批做，不要只填一半。
