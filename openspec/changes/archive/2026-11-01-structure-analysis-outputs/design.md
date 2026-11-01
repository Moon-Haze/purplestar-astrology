# Design

## Context

探索结论（proposal「Why」的展开）：

- 内核 `views/` 的 10 个渲染器（717 行）从 `makeContext` 的结构化上下文（宫位结构、
  `STAR_BRIEF`、`BranchedContent`、`ReportCitation`、`topic_mods`）产文本行——**文本的
  原料在内核里就是结构化的**，行字符串只是最后一层拼接。
- v3 数据链（`generate-shards.ts`）就是本仓内核直出：`generateChart + getTopicAnalysis`
  产 13 列文本写 jsonl.gz。v4 切外部 tar 后，topics 文本改由数据源仓的同源渲染器产出
  （含本仓没有的组合矩阵、「针对你的命盘」节数据），本仓转为消费文本——`classifyOracle`
  因此诞生，并已两度漏网。
- 动态节（当前大限 / 流年 / 流月）依赖运行时时钟（`context.ts`：流年/流月取系统当前），
  预计算它们不可复现——这正是 v4 文本黑名单的动机之一。

## Goals / Non-Goals

**Goals:**

- 文本与结构化一源：内核单次判定，两种投影，永不漂移。
- 建库数据链回归内核直出（结构化），`classifyOracle` / `staticLines` 退役。
- 库 schema v2 语义列：亮度/化曜/宫/书证可字段级查询，变体正文共享（≈29% 去重）。

**Non-Goals:**

- 不追 v4 674,976 真实公历口径（外部数据源仓未提供出生信息，另行协作）。
- 不动排盘内核与 `CACHE_VERSION`；不做任何文案修订。
- 不重构 `--topic` / `--report` 的文本形态（逐字节不变是硬约束）。

## Decisions

### D1: 条目模型——扁平条目流，字段可选

```ts
/** 一条结构化论断条目：文本行的语义分解（前缀徽标与括号注记全部入列）。 */
interface AnalysisItem {
  slot: "overview" | "sanFang" | "mutagen" | "yearStem" | "kuiYue"
      | "brief" | "core" | "basis" | "citation" | "mods" | "summary"
      | "pattern" | "mainPalace" | "extra";   // 节槽（report 节体系，开放集走 extra:<名>）
  star?: string;        // 主星（条目主语；内核星表键域）
  aux?: string;         // 辅煞/次星名（✦ 行主语）
  palace?: string;      // 落宫（PALACE_NAMES_ORDER 展开形）
  brightness?: string;  // 亮度（庙旺/得失陷…，文墨 SB 口径）
  mutagen?: string;     // 化禄/权/科/忌
  book?: { loc: string; text: string };  // 书证（书名·章节 与 条文分离）
  kind: "essay" | "brief" | "badge" | "quote" | "citation" | "notice";
  clockDependent?: true; // 依赖运行时时钟的条目（大限/流年/流月）——直出链排除
  text: string;          // 正文（不含前缀徽标与括号注记）
}
```

扁平流 + 可选字段，而非每槽一个接口：组装层按 slot 分派（与现有渲染端 `OracleStar` 的
消费形态同构），新槽零 DDL。`renderXxx` 改为返回 `AnalysisItem[]`，编排层持两个投影：
`formatItem(item) → string`（文本行，含前缀徽标与注记）与条目本身。

### D2: 文本逐字一致的锚定——先基线、后重构、逐 view 验收

重构顺序按 view 逐个进行（不一次全翻）：每个 view 重构前先以固定样本集取「文本行基线」
（`getTopicAnalysis` + `getTopicReport` 双形态 × 全 13 主题 × 抽样盘），重构后 diff=0 才进
下一个。格式化函数是保真关键——前缀徽标（`✦`/`·`/emoji/`◇`）、括号注记、`---` 分隔、
空行策略全部搬进 `formatItem`，与现有拼接逻辑逐字对齐。性别过滤仍作用在整篇文本投影上
（跨行内子句，逐条目会漏跨节句子——现状注释已论证）。

### D3: 直出链——generate-shards 扩展结构化 jsonl

`generate-shards.ts` 既有直出骨架（五维键空间枚举 → `generateChart` → 分析）扩展第二产出：
`getTopicAnalysisStructured(chart, topic)`（`ctx` 一次构建，双投影同源）产条目流，写
`structured-YYYY.jsonl.gz`（每行 `{birthInfo 摘要, chart 摘要, items}`）。样本空间 = 本仓
设计样本（518,400 枚举，v3 同款）；v4 tar 链退役（tar-source 的文本消费随之下线）。排盘
时长 ~2h 量级（v4 切换同款工程，有先例）。

### D4: 库 schema v2——语义列 + 正文共享

```sql
CREATE TABLE items (
  topic_id INTEGER NOT NULL, star_id INTEGER NOT NULL, ord INTEGER NOT NULL,
  slot_id  INTEGER NOT NULL,             -- 节槽字典（含 extra:<名> 开放集）
  palace_id INTEGER, brightness_id INTEGER, mutagen_id INTEGER, aux_id INTEGER,
  kind TEXT NOT NULL,
  book_loc_id INTEGER,                   -- 书证出处字典（书名·章节）
  text_id  INTEGER NOT NULL,             -- 正文（无前缀无注记）
  PRIMARY KEY (topic_id, star_id, ord)
);
```

行文本列存**渲染原行**（组装等价与检索输出逐字一致的硬约束优先）；语义列（主语星 /
亮度 / 化曜 / 落宫 / 格局名）是附加索引，供字段级查询——正文级拆分共享（预估再降 ~29%）
需要渲染端重构配合，不在本 change（文本输出逐字节不变的约束下做不到），留待后续。
实施修正：数据源为 `generate-shards` 的结构化 jsonl（`items` 字段），归属星按行内
chart 的主题主宫首颗主星推导（与 v1 collectTopic 同口径）；DuckDB `topics` 文本表保留
（继续服务 md 归档与 verify 链，不强行退役——最小 diff）。引文校验前移到**条目级**
（行文本入库前过 `citation-core`，判据与测试期抽取扫描同一份）。

### D5: 消费端与契约保持

`corpus/data/manual/index.ts` 组装层改读语义列（JOIN 链更直接，section 字符串协议退役）；
`OracleStar` 契约与 `oracle.ts` 渲染端**零改动**——结构化条目拼回 `OracleStar` 后，渲染
输出与 v1 库形态逐字相同（静态节内容面对齐）。`manual:check` 双通道对拍机制不变。

## 不可逾越的约束

- 文本输出逐字节不变（`--topic` / `--report` / `astrology` 报告）——投影重构不许改格式。
- 排盘内核零接触；分层红线（插件层不依赖 `cli/`）照旧。
- 报错不兜底、SQL 参数绑定、生成物不手改、「跳过必须可见」等既有纪律全部沿用。
- 三合派体系口径零接触（本 change 是产出形态改造，不碰任何论断内容）。

## Risks / Trade-offs

- **[views 重构的逐字保真风险（10 个渲染器 717 行）]** → D2 的逐 view 基线 diff 流水线；
  任一 view diff≠0 即停，不带着漂移前进。
- **[直出库内容与 v1 库存在盘集差异（518,400 设计样本 vs v4 674,976 真实公历）]** →
  变体覆盖随盘集差异——数据源口径的显式切换而非回归。
- **[实施期证伪：v1 行文本措辞来自外部仓渲染器]** → 「v4 文本与本仓内核同源」的假设只对
  节体系成立；行文本是两套实现（如 v1 星曜简述 vs 本仓 `STAR_BRIEF` 措辞不同）。v1 措辞
  的源头不在本仓内核，其修订链本就断裂——v2 切换为本仓内核措辞是**内容真相源收回主仓**的
  显式决策，语义面同构、措辞基准切换（spec scenario 已留档）。
- **[排盘 ~2h 的直出重跑]** → v4 切换同款工程（nohup/后台 + 分段内存护栏先例齐备）。
- **[条目模型字段不全的槽]** → `extra` 开放槽 + `kind` 粗分类兜底；模型随首个消费场景
  迭代，不为想象中的查询预建字段（抽象判据）。

## Migration Plan

1. 取文本基线（固定样本集 × 双形态 × 13 主题）。
2. 条目模型 + `formatItem` 落地（不动任何 view）。
3. views 逐个重构（每 view：条目流 + formatter + diff=0）。
4. `getTopicAnalysisStructured` API + 直出链扩展 + 全量直出。
5. 库 schema v2 + 建库端换消费面（`classifyOracle`/`staticLines` 退役）。
6. 消费端切换 + 守卫断言迁移。
7. 文档同步 + 三件套 + `manual:check` + `pack` 终验。

回滚：直出产物与库是独立文件，v1 → v2 的切换 commit 可整体 revert；views 重构按 view
粒度回退（基线 diff 是回退判据）。

## Open Questions

- v4 真实公历口径是否由外部数据源仓补 birthInfo 重新直出——外部协作决策，不阻塞本 change
  （设计样本口径先落地，口径切换是数据集替换而非架构变动）。
- `report.ts` 的跨节去重状态（`dedupe` Map）在结构化面如何承载——条目级标记 vs 装配层
  投影时计算，实施第一步以「文本 diff=0」为准绳定案。
