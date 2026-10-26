# Spec Delta

## ADDED Requirements

### Requirement: 结构化投影句读完整

条件分支结构化条目（`BranchedContent`）的投影输出 SHALL 句读完整：`common` 段 SHALL NOT 以孤立分号收尾（原散文中分隔条件分支的分号随分支拆走后，残余分号 SHALL 清洗为句号）。未迁移条目（含显式豁免清单条目）的原文 SHALL 保持逐字不变，不受此约束影响。

#### Scenario: 拆分残留分号消失

- **WHEN** 渲染已迁移且原散文为「X；化忌则Y。」形态的条目（如兄弟宫天机、迁移宫破军）
- **THEN** 投影输出以「X。」收尾，不存在「X；」形态（对 `--report` 与 `--topic` 输出做行尾分号扫描计数为 0）

#### Scenario: 未迁移条目逐字不变

- **WHEN** 渲染显式豁免清单条目或纯散文条目
- **THEN** 输出与改前基线逐字节一致（清洗只作用于已迁移条目的投影路径）
