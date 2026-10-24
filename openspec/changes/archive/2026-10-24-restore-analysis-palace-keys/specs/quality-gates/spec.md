# Spec Delta

## ADDED Requirements

### Requirement: 分析数据表键域互证

analysis 侧按宫名 / 主星键索引的数据表 SHALL 与运行时键域互证：宫名键以运行时宫名域
（展开形、带「宫」字、交友宫口径，即 `PALACE_NAMES_ORDER`）为唯一域——次星宫位文案表、
宫位内容键映射、主题关键宫位的每个宫名键 SHALL 能在该域内解析；十四主星名 SHALL 以
内核星表为单一真相源，星曜内容、星曜简述、主题断语手册的主星键集 SHALL 与之互证同集。

键域漂移（数据表键与运行时键不一致导致的静默 miss）属 typecheck 查不到的缺陷类，
SHALL 由 invariants 互证断言拦截；断言 SHALL 报出超域或不一致的键，消费点 SHALL NOT
以 `??` 空串兜底掩盖 miss。

#### Scenario: 宫名键超域

- **WHEN** analysis 数据表新增或改动一个宫名键，而它不在运行时宫名域内（如紧凑形「仆役」、漏「宫」字的「兄弟」）
- **THEN** invariants 互证断言失败，`npm test` 变红并报出该键；不得静默 miss 后以空串兜底

#### Scenario: 星名键集分叉

- **WHEN** 星曜内容表、星曜简述表或主题断语手册键集中出现内核星表没有的主星名，或缺其一
- **THEN** 互证断言失败，报出不一致的键集差异

#### Scenario: 运行时直查全命中

- **WHEN** 消费点以运行时 `Palace.name` 直查 analysis 数据表
- **THEN** 十二宫全部命中，无一落入「简述兜底」或空串分支
