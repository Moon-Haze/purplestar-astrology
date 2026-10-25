# knowledge —— 知识源扩展点

本篇覆盖 `scripts/knowledge/`：`types.ts`（`KnowledgeSource` 接缝）·
`registry.ts`（声明式注册表）· `sources/books.ts` / `sources/stars.ts` /
`sources/tianji.ts` / `sources/oracle.ts`（四域「实现即插件」）。

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
> `search` 收 CLI 无关的 `KnowledgeQuery`（精确字段，由 `cli/knowledge/index.ts` 的
> `decodeKnowledgeQuery` 从 `CliArgs` 解码而来）：`--search`/`--limit`/`--book`/`--topic`
> 的三态与值域校验在入口单点承担，位置参数回退是域知识、留在各域实现内
> （books/stars/tianji 回退为检索词，oracle 回退为 topic/star）。
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
> 懒加载纪律：tianji / oracle 两域的重语料（392KB / 4.4MB）在各自 `search` 体内
> `await import`，注册表静态 import 的源模块本身是轻的，不会把重数据拉进 CLI 启动。
> 四域是「实现即插件」形态：渲染逻辑直接住在 `sources/<id>.ts`，无转发壳。

⚠️ `KNOWLEDGE_SOURCES` 的**键序即概览列出与报错提示的顺序**；`KNOWLEDGE_SOURCE_IDS`
是键集合的单一真相源，CLI 报错提示与自检断言复用它，**不手抄字符串**。

---

## 三、`sources/`：四域「实现即插件」

### 3.1 `books.ts`：默认域，无懒加载顾虑

> knowledge 的 **books 域**：古籍原文检索（默认域）。
>
> books 域静态引 `@/corpus`（古籍数据已静态打包进代码，零 DB 依赖），启动无懒加载顾虑。
> `--search` 三态与 `--limit` 校验由命令入口守卫单点承担，本域只做检索渲染。

### 3.2 `stars.ts`：内核轻表，静态 import

> knowledge 的 **stars 域**：星曜释义（实现即插件：渲染逻辑与注册形态同址，无转发壳）。
>
> 数据是内核轻表（`STAR_DESCRIPTIONS`），静态 import 不影响启动。位置参数与 `--search`
> 等价（与 books 域同款回退）。

### 3.3 `tianji.ts`：懒加载 392KB 语料

> knowledge 的 **tianji 域**：天纪判语检索（实现即插件，无转发壳）。
>
> **懒加载纪律**：`corpus/data/tianji.ts`（392KB、1125 条）在 `search` 体内
> `await import("@/corpus/data/tianji")`，只在查询时加载，本模块被 registry 静态
> import 也不把语料拉进 CLI 主链路。

### 3.4 `oracle.ts`：懒加载 4.4MB 断语

> knowledge 的 **oracle 域**：断语手册检索（实现即插件，无转发壳）。
>
> **懒加载纪律**：`corpus/data/manual/`（4.4MB 分类断语）在 `search` 体内
> `await import("@/corpus/data/manual/index.ts")`，只在查询时加载，CLI 主链路不吃它。

---

## 四、新增一个域的完整步骤

1. 在 `sources/<id>.ts` 写一个 `KnowledgeSource`（重数据一律 `await import`，别静态引）；
2. 在 `registry.ts` 的 `KNOWLEDGE_SOURCES` 加一行（键 = `--source` 取值）；
3. 完事 —— `cli/knowledge/index.ts` 的分发入口、概览文案与报错提示都从注册表派生。

⚠️ Phase 3 落地时 `citations` 会从占位变成真核对表，届时 `citations.test.ts` 的
全局扫描一并重构 —— 两件事必须同批做，不要只填一半。
