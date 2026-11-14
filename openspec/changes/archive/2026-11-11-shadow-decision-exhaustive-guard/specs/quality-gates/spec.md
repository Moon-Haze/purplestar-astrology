# Spec Delta

## ADDED Requirements

### Requirement: 参数面 shadow 决策穷尽性

声明表 output-select 组中 `cmds` 含 `astrology` 的每个参数 SHALL 显式声明
`shadow: true` 或 `noShadow: true` 之一（「在不在被吞检测域」是必须表态的封闭决策），
selftest SHALL 以断言守**增长方向**：任一该域参数未表态时断言变红并点名参数名，
不依赖人工对拍或快照推进。`topic-deep` 组不设此义务——其默认方向是入域，漏标的
表现是过度检测（当场红），不是静默吞。

#### Scenario: 域内参数未表态当场红

- **WHEN** output-select 组任一 `cmds` 含 `astrology` 的参数（新增参数、或存量参数的
  shadow / noShadow 标志被删除）处于未表态状态
- **THEN** selftest 的穷尽性断言非绿，报告点名该参数——快照对拍与行为钉点保持原状，
  不得成为该缺口的唯一发现途径

#### Scenario: 存量表态齐且 noShadow 对派生中性

- **WHEN** 本变更落地后对声明表跑穷尽性断言与 SHADOWABLE_KEYS 派生
- **THEN** view 标 `shadow`、json / no-cache / config / template 标 `noShadow`，
  五个决策全部显式在册、断言绿；检测域恰为原 12 项加 view（13 项），
  四个 `noShadow` 参数不在检测域内（output-select 组派生只读 `shadow` 标志）

#### Scenario: 表态的后果端到端可见

- **WHEN** `--view` 以 `shadow: true` 表态并由 `--topic` 消费白名单放行
- **THEN** `--info` / `--palaces` / `--report` 与 `--view` 同给时非零退出并点名
  （不再静默吞），`--topic love --view daxian` 正常产出主题论断——与
  「独占分支不静默吞功能参数」需求对运限层级参数的要求同构
