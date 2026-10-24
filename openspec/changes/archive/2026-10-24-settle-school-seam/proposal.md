# Proposal

## Why

架构评审 2026-10-24（候选 W3）：SchoolAdapter 接缝目前只有一个实现（wenmo-nishi），是 hypothetical seam——「一个 adapter 意味着假想接缝，两个才是真的」。适配器声明的一半字段（`defaultBrightnessSchool` / `assertionFramework`）全仓零消费；`guard.ts` 的 lai-yin 分支为空（`forbiddenFeatures` 声明两个特征，guard 实际只检查 self-mutagen——lai-yin 的守护由 `test/school.test.ts` 绊线断言承担）。半兑现的接缝比没有接缝更误导：后来人会以为接缝要件齐备。

## What Changes

（路线 B「诚实收窄」——捕获时按评审推荐默认执行，apply 前可推翻改路线 A「补第二实现」）

- 删两个零消费字段：`defaultBrightnessSchool` 与 `assertionFramework` 从 `SchoolAdapter` 接口与 wenmo-nishi 实现中移除（前者在 extensibility「插件引用而非迁移」需求文本中被提及，随 delta 同步改写）
- `SchoolId` 收窄：去掉 `(string & {})` 逃生舱——新流派 id 走「types 联合 + registry 加一行」两处显式（与清单注册哲学一致，typecheck 兜底漏注册）
- guard 空分支如实化：lai-yin 的守护如实描述为「绊线断言承担（`test/school.test.ts`），guard 不做运行时检查」——`forbiddenFeatures` 两特征声明保留（体系立场 C3 不动）
- 顺手单点化：`DEFAULT_SCHOOL_ID` 与 registry 键名的手写重复收拢

## What Doesn't Change

- **体系立场不动**：`forbiddenFeatures` 仍列 `self-mutagen` 与 `lai-yin`（C3 红线）；绊线字段与 `test/school.test.ts` 断言一字不动
- **引用而非迁移不动**（ADR-004）：`citationRoots` 引用全局唯一 `ANNOTATIONS` 的现状已是干净引用，无复制残留
- **清单注册不动**（ADR-002）：registry.ts 显式 import，不用自动发现
- **不新增第二流派实现**（路线 A 备选）：若未来真要第二流派，按 extensibility 需求「写 `schools/<id>.ts` + 注册表加一行」扩展——收窄后的接口对新流派同样够用（新流派按需补自己的字段）
- 多流派隔离语义（ADR-004 的 citationRoots 按流派扫描）不动：本变更只收字段，不改扫描行为

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `extensibility`: 「插件引用而非迁移」需求文本随 `defaultBrightnessSchool` 字段删除而改写（「该字段只记录冻结内核的默认流派」句改为内核侧事实表述）。（「扩展点落地状态如实记录」经核实不含被删字段名，无需 delta）

## Impact

- 代码：`scripts/school/types.ts`（接口收窄、SchoolId 去逃生舱）、`schools/wenmo-nishi.ts`（删两字段）、`guard.ts`（空分支注释如实化）、`registry.ts`（DEFAULT_SCHOOL_ID 单点化）
- 测试：`test/school.test.ts` 现消费点核对（实测只消费 citationRoots 与 checkForbiddenFeatures，不消费被删字段——预期零改动，apply 时验证）
