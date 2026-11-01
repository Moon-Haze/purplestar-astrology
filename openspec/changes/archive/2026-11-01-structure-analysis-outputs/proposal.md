# Proposal: structure-analysis-outputs

## Why

断语手册库（`oracle.db`，migrate-manual-to-sqlite 落地）的数据链是「内核渲染文本 → 反向解析
（`staticLines` 节过滤 + `classifyOracle` 文本分类）→ 入库」——**文本只是内核结构化数据的投影**，
反向解析是二次工程，且已两度漏网（盘面动态节、「##」块头泄漏）后才被黑名单补住。行内语义
（星名 / 亮度 / 化曜 / 落宫 / 书证出处）内嵌在整句字符串里：13,476 条入库文本中约 29% 是
「同一句话只差亮度/化曜注记」的变体，无法字段级查询、无法彻底去重。

内核 `analysis` 层本身**已经是结构化的**（`views/` 的渲染器从 `ctx` / `STAR_BRIEF` /
`BranchedContent` / `ReportCitation` 产文本行），缺的只是一层显式的**结构化输出面**。

## What Changes

- **内核一源双投影**：`views/` 的各 `renderXxx` 重构为「产出结构化条目流」，现有文本行降级为
  条目的格式化投影——`getTopicAnalysis` / `getTopicReport` 的**文本输出逐字节不变**（硬约束）；
  新增 `getTopicAnalysisStructured(chart, topic): TopicAnalysisStructured` 结构化 API。
- **直出链升级**：`generate-shards` 式内核直出从「文本 jsonl」扩展为「结构化条目 jsonl」
  （样本盘 → 内核直出，不再经外部 tar 的文本消费）。
- **库 schema v2**：`oracle.db` 行表升级语义列（slot / 星 / 亮度 / 化曜 / 落宫 / 书证出处 /
  正文引用），`topics` 表的 13 列渲染文本退役；`export-manual` 建库端直接消费结构化条目，
  **`classifyOracle` / `staticLines` 文本解析整体退役**。
- **消费端简化**：`corpus/data/manual/index.ts` 的组装层从「section 字符串协议 + 文本重建」
  换为语义列直读；`knowledge/sources/oracle.ts` 渲染端输出保持不变（数据从结构化条目拼装）。

## Capabilities

### New Capabilities

- `analysis-structured`: 内核 analysis 层的结构化输出契约——条目模型（节槽 / 星 / 亮度 /
  化曜 / 落宫 / 书证字段）、一源双投影纪律（文本投影逐字节不变）、结构化 API 的形状与
  直出链的消费契约。

### Modified Capabilities

- `manual-store`: 库 schema v2——行表从「section 字符串协议」升级为语义列；「动态节不入库」
  的过滤位置从文本黑名单前移为「结构化条目天然不含」；字节可复现与 study 别名视图契约不变。
- `quality-gates`: 生成物漂移探针的数据源描述随直出链更新（对拍机制不变）。

## Impact

- **代码**：`scripts/analysis/views/`（717 行渲染器重构为条目流 + 格式化函数）、
  `analysis/index.ts` / `report.ts`（编排层出双投影）、`tools/db/generate-shards.ts` /
  `build-duckdb.ts`（直出结构化 + schema v2）、`tools/db/export-manual.ts`
  （建库端换消费面，`classifyOracle`/`staticLines` 删除）、`corpus/data/manual/index.ts`
  （组装层换语义列）、`test/`（基准与断言面）。
- **数据链**：`npm run build:db` 重跑（内核直出全样本空间，参照 v3 直出先例，排盘 ~2h 量级）；
  样本空间为**本仓设计样本**（518,400 设计样本枚举）——v4 的 674,976 真实公历口径依赖外部
  数据源仓提供出生信息，不追（见不做什么）。
- **验证义务**：内核或依赖级改动——`typecheck` + `selftest` + `npm test` 三件套，另加
  `manual:check`、`pack`、以及 `--topic` / `--report` 文本输出的抽样逐字节 diff=0 锚定。

## 不做什么

- **不追 v4 真实公历口径**：组合矩阵、「针对你的命盘」等节的数据在外部数据源仓（本仓知识源
  之外），结构化直出的库不含它们——与现状（黑名单过滤后）内容面一致，无回退。
- **不动文本输出形态**：`--topic` / `--report` / `astrology` 报告的文本逐字节不变；
  本 change 不做任何文案修订。
- **不动排盘内核**（`algorithm` / `mutagen` / `patterns`）：`CACHE_VERSION` 无需递增，
  排盘回归基线不受影响——分析层是排盘结果的下游纯函数。
- **不做渲染器重写**：`views/` 重构是「产出形态」改造（行数组 → 条目流 + 格式化函数），
  判定逻辑与内容源（`ctx` / 数据表）逐字保留。

## 被否决的备选方案

- **库层行内解析拆列（方案 b）**：8 种行前缀各需解析规则 + 解析失败兜底列，且 oracle 渲染端
  「行原文照排」契约必破——把渲染器逆向工程进建库端是复杂度增量最大的路。否决。
- **双实现（结构化 API 独立于 renderXxx 另写一份）**：同一内容两处渲染必然漂移，违反接缝
  判据（加一节内容改两处）。一源双投影是唯一不漂移的形态。
- **维持现状**：29% 变体无法去重、无字段级查询，且每次内核节形态演进都要黑名单补丁追着
  文本形态跑（已两度漏网）。用户拍板治本。否决。
