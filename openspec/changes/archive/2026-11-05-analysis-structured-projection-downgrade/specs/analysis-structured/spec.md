# Spec Delta · analysis-structured

## Purpose

analysis 层的输出契约：公开面 = 两种文本输出形态（`getTopicAnalysis` 的【】版式与
`getTopicReport` 的 ### 版式），共用同一取材单点、逐字节锚定；结构化条目是 views 的
**内部实现形态**（文本行由其格式化投影产出），不构成公开 interface。断语手册建库消费方
已退役，直出/建库条款随之折回。

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: 条目模型

**移除理由**：条目语义字段（星 / 亮度 / 化曜 / 落宫 / 书证 / 确定性标记）的唯一库外
消费方是已退役的断语手册建库管线；作为 views 内部实现，其字段值域纪律由消费点不用
`?? ""` 掩盖的代码纪律与 typecheck 承载，不再构成可验证的 spec requirement。存活的
反解禁令与逐字节锚定已并入 MODIFIED「一源双投影」。

### Requirement: 确定性标记与直出契约

**移除理由**：「直出链」（结构化条目的库外导出链）随断语手册库退役而不存在；时钟依赖
条目的排除规则约束的是已删除的建库行为。views 内部若保留 `clockDependent` 标记，属
实现细节，不入 spec。

### Requirement: 建库端退役文本解析

**移除理由**：建库管线已随 `remove-manual-oracle` 整体退役，本 requirement 的约束对象
不存在。「渲染文本 SHALL NOT 作为断语手册数据源」的防回归价值由「SHALL NOT 从成文反解
结构」禁令（MODIFIED「一源双投影」）承接；518k 基准数据集分片消费文本视图属基准语料
生成，与断语手册库无关，不在本 spec 管辖。
