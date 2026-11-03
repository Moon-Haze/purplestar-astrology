# analysis-structured Specification

## Purpose
内核 analysis 层的结构化输出契约：`views/` 渲染器产出**结构化条目流**（节槽 / 星 / 亮度 /
化曜 / 落宫 / 书证字段），文本行降级为条目的格式化投影——一源双投影，渲染文本与结构化数据
不再存在「生成 → 反向解析」的二次关系。

## Requirements

### Requirement: 一源双投影

analysis 层 SHALL 以结构化条目为唯一产出形态，文本行 SHALL 是条目的格式化投影；两种输出
形态 SHALL 共用同一取材单点（见「双形态取材单点」）：`getTopicAnalysis` 与 `getTopicReport`
的文本输出 SHALL 与重构前逐字节一致（同盘同参数），**唯一例外**是本 change 显式登记的
口径修复——`getTopicReport` 的「本宫主星」行补回借宫主星名（与 `getTopicAnalysis` 对齐），
差异行数 SHALL 等于该盘借宫主题数。除此之外 SHALL NOT 存在「文本已渲染、再由文本反推
结构」的第二实现。

#### Scenario: 文本输出逐字节锚定

- **WHEN** 对固定样本盘集分别以重构前基线与重构后代码执行 `--topic` 单主题与 `--report`
  全盘输出
- **THEN** `--topic` 侧逐字节 diff=0；`--report` 侧 diff 行数等于该盘借宫主题数，且每行差异
  仅为借宫注补回星名

#### Scenario: 结构化与文本同源

- **WHEN** 同一盘同一主题分别取结构化条目流与文本输出
- **THEN** 文本中每行都能对应到结构化条目（含前缀徽标），无「仅存在于文本」的行

#### Scenario: 语义字段不从成文反解

- **WHEN** 结构化条目消费单点的整行字段（如 `mainStarLine`）
- **THEN** 条目的语义字段（star / slot / 亮度 / 化曜）仍由 material 与 ctx 独立透出，
  不由行文本反解

### Requirement: 条目模型

结构化条目 SHALL 携带语义字段：节槽（总览 / 三方四正 / 四化 / 年干 / 贵人 / 主题专属）、
主星、亮度、化曜、落宫、辅煞星名、书证出处（书名·章节 + 条文原文分离）、正文；
每条 SHALL 可独立定位（主题 × 星 × 节槽 × 序）。字段值域 SHALL 与内核既有真相源互证
（星名 = 内核星表、宫名 = `PALACE_NAMES_ORDER` 展开形、亮度 = 文墨 SB 口径）。

#### Scenario: 字段级查询

- **WHEN** 以「某亮度」或「某书证」为条件检索结构化条目
- **THEN** 命中集合可由语义列直接得出，无需文本子串匹配

#### Scenario: 字段值域互证

- **WHEN** 结构化条目流中的星名 / 宫名键与内核星表、运行时宫名域比对
- **THEN** 键集一致，无超域键

### Requirement: 确定性标记与直出契约

每条结构化条目 SHALL 携带确定性标记：**纯命盘函数**的条目（同盘同参恒定）与**依赖运行时
时钟**的条目（当前大限 / 流年 / 流月，随系统日期漂移）SHALL 可区分；直出链 SHALL 只取
纯命盘条目，动态条目 SHALL NOT 进入断语手册库（依赖时钟的预计算不可复现）。

#### Scenario: 时钟依赖不可入库

- **WHEN** 直出链对样本全集执行结构化导出
- **THEN** 产物中无当前大限 / 流年 / 流月条目；两次导出（间隔一日）的条目集与字节逐字一致

### Requirement: 建库端退役文本解析

建库管线 SHALL 消费结构化条目直接写库，SHALL NOT 保留对渲染文本的节过滤 / 行分类逻辑
（`staticLines` / `classifyOracle` 一类）。渲染文本 SHALL NOT 再作为断语手册的数据源。

#### Scenario: 文本解析代码退役

- **WHEN** 审查建库工具的数据路径
- **THEN** 无文本节过滤与行分类代码；渲染文本不入 `topics` 表（schema v2）

### Requirement: 双形态取材单点

「本宫主星」行与「借对宫」徽标 SHALL 由 `overview-material` 的 `buildOverviewMaterial`
单点产出（`mainStarLine` / `loanTag` 字段），两种输出形态（`getTopicAnalysis` 的【】版式与
`getTopicReport` 的 ### 版式）SHALL 消费同一字段，SHALL NOT 在任何编排器内重写该行的拼式
（借宫注、主星徽标、`overview` 主题的五行局尾）。该单点的**全部返回分支**（含主宫与对宫俱
无主星的兜底分支）SHALL 给出这两个字段。

#### Scenario: 两形态同一行同源

- **WHEN** 同一盘同一主题分别取 `--topic` 单主题输出与 `--report` 全盘输出的「本宫主星」行
- **THEN** 两者在剥离各自版式头后逐字相同（含借宫时借来的主星名）

#### Scenario: 借宫文案不再分叉

- **WHEN** 某主题主宫空宫（借对宫主星论事）
- **THEN** 两种形态的借宫注均形如 `（<宫名>空宫，借对宫<主星名>论事）`，无「只写借对宫、
  不带星名」的第二形态

#### Scenario: 单点被绕过即红灯

- **WHEN** 任一编排器重新内联拼接「本宫主星」行或「借对宫」徽标，使其与 `mainStarLine` /
  `loanTag` 不一致
- **THEN** 两形态对拍断言失败（非零退出），不静默产出口径不同的论断文本
