# Spec Delta

## MODIFIED Requirements

### Requirement: 体系立场随适配器声明

当前唯一流派 `wenmo-nishi` 承载现行混合口径：排盘与运限四化以**文墨天机**为准，
论断框架严格按**倪海厦《天纪》三合派**（命宫为本、三方为用）。
飞星派特征（宫干自化 `self-mutagen`、来因宫 `lai-yin`）SHALL 列入 `forbiddenFeatures`。

`forbiddenFeatures` 的类型 SHALL 是闭集（`self-mutagen` | `lai-yin`），SHALL NOT 设
`(string & {})` 逃生舱；新禁用特征走「types 联合加分支 + `guard.ts` 补真检查」两处显式声明。

#### Scenario: 禁用特征被实现

- **WHEN** 有人实现宫干自化或来因宫
- **THEN** 与 `forbiddenFeatures` 声明冲突；绊线断言仍盯字段不被填回

#### Scenario: 声明未实现的禁用特征

- **WHEN** 在 `forbiddenFeatures` 里声明一个 guard 没有真检查的特征
- **THEN** typecheck 报错（闭集外取值的类型不一致），而非运行时静默不查
