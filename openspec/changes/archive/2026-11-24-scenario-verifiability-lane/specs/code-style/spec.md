# Spec Delta

## MODIFIED Requirements

### Requirement: 注释少而精（why 优先）

`.ts` 文件中的注释 SHALL 只解释 why / 约束 / 陷阱，不得重述代码 what；与代码同义的冗余注释
SHALL NOT 存在。行内注释优先单行。冗余与否属编辑判断、机器不可判，本 requirement 的场景按
工作流 specs 规则的「过程纪律判定途径」通道由评审对照把关，不设机器判据。

#### Scenario: 冗余注释

- **WHEN** 一段注释只是把下一行代码用中文重说一遍
- **THEN** 删除该注释，不保留

#### Scenario: 解释 why 的短注释

- **WHEN** 注释说明某处为何要绕过常规做法（如「此处不可上溯目录层级」）
- **THEN** 保留，且优先单行内联

#### Scenario: 整段 what 复述

- **WHEN** 函数上方注释逐句复述函数体每一步
- **THEN** 删到只剩非显然的约束/陷阱
