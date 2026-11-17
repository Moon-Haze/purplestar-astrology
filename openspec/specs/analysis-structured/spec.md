# analysis-structured Specification

## Purpose

analysis 层的输出契约：公开面 = 两种文本输出形态（`getTopicAnalysis` 的【】版式与
`getTopicReport` 的 ### 版式），共用同一取材单点、逐字节锚定；结构化条目是 views 的
**内部实现形态**（文本行由其格式化投影产出），不构成公开 interface。断语手册建库消费方
已退役，直出/建库条款随之折回。

## Requirements

### Requirement: 一源双投影

analysis 层公开面 SHALL 是两种文本输出形态：`getTopicAnalysis` 与 `getTopicReport` 共用
同一取材单点（见「双形态取材单点」）。结构化条目形态 SHALL 仅为 views 的内部实现——
SHALL NOT 以 `renderXxxItems` 等形式出现在 `@/analysis` 或 views 的公开导出面。
SHALL NOT 存在「文本已渲染、再由文本反推结构」的第二实现（禁止 `classifyOracle` 式
节过滤 / 行分类逻辑回归）。同盘同参数下文本输出 SHALL 与既有基线逐字节一致。

#### Scenario: 文本输出逐字节锚定

- **WHEN** 对固定样本盘集分别以基线与当前代码执行 `--topic` 单主题与 `--report` 全盘输出
- **THEN** 两种形态逐字节 diff=0（口径修复仅限本 spec 显式登记的例外）

#### Scenario: 公开导出面收敛

- **WHEN** 审视 `@/analysis` 与 `scripts/analysis/views/` 的导出面
- **THEN** 无任何 `renderXxxItems` 形态的公开导出（`grep -rn "export function render.*Items"
  scripts/analysis/` 零命中）；条目构造与格式化（`formatItems`）为 views 内部消费

#### Scenario: 结构化与文本同源

- **WHEN** 审视任一 view 的实现（同盘同主题）
- **THEN** 文本行由条目流经 `formatItems` 投影产出（`renderXxx` 内部先产条目再投影），
  无「绕过条目直接拼文本行」的行；条目形态是 views 的内部实现细节，不构成公开 interface

#### Scenario: 语义字段不从成文反解

- **WHEN** 任一消费点需要条目级语义信息（星 / 节槽 / 亮度 / 化曜）
- **THEN** 由 material 与 ctx 独立透出，SHALL NOT 由行文本反解

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
