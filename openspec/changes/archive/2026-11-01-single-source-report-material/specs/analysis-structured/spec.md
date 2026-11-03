# Spec Delta

## Purpose

内核 analysis 层的结构化输出契约：`views/` 渲染器产出**结构化条目流**（节槽 / 星 / 亮度 /
化曜 / 落宫 / 书证字段），文本行降级为条目的格式化投影——一源双投影，渲染文本与结构化数据
不再存在「生成 → 反向解析」的二次关系。

## ADDED Requirements

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

## MODIFIED Requirements

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
