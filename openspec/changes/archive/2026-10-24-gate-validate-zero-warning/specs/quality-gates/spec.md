# Spec Delta

## ADDED Requirements

### Requirement: OpenSpec 校验零警告

specs 主干（`openspec/specs/`）或 change 工件（`openspec/changes/`）发生任何改动后，
`openspec validate --all` SHALL 全部通过且**零警告**才算完成。出现警告时（如
requirement 文本超长）SHALL 当场修复——拆分 requirement、把例子与边界情况移进
scenario——不得以「仅警告不失败」为由带警告归档或提交。

#### Scenario: specs 主干改动后校验

- **WHEN** `openspec/specs/` 下任一 spec 文件被修改
- **THEN** `openspec validate --all` 退出码为 0 且输出不含 `WARNING`，否则该改动未完成

#### Scenario: 警告须当场修复

- **WHEN** validate 报出警告（如 requirement 文本超过 500 字符）
- **THEN** 按警告建议修复（拆分 requirement / 移内容进 scenario）直至零警告，不得放行

#### Scenario: 归档折回后复验

- **WHEN** change 归档将 delta 折回主干 specs
- **THEN** 折回后重跑 `openspec validate --all` 确认仍零警告
