# interpretation-content Specification

## Purpose

约束解读内容（`STAR_CONTENT_MAP` 论断文案）的数据模型：性别差异作为数据属性结构化承载，
而非散文内联标记加末尾正则剥离，使内容可被类型校验、可按性别投影。

## Requirements

### Requirement: 性别内容以结构化字段承载

解读内容的性别差异 SHALL 以结构化字段承载（`common` 共享散文 + 可选 `male`/`female`/`suffix`
段），SHALL NOT 以散文内联标记（`；女命…` / `女命…。` / `（女命）…`）加成稿后正则剥离实现。
消费方 SHALL 按 `gender` 投影为 `common + (male|female) + suffix`（`suffix` 收中置性别段的后缀）。

#### Scenario: 各性别输出逐字节一致

- **WHEN** 用给定性别渲染某主题的解读文本
- **THEN** 输出与改前（正则剥离基线）逐字节一致——结构化投影必须复现正则剥离结果

#### Scenario: 新增内容无需标记约定

- **WHEN** 新增一段宫位文案且需区分性别
- **THEN** 直接写结构化字段（`common` / `male` / `female` / `suffix`），不写内联标记、不经末尾正则

#### Scenario: 无性别差异字段

- **WHEN** 某宫位文案无性别差异
- **THEN** 只填 `common`，`male`/`female`/`suffix` 缺省，消费方对两性投影结果相同
