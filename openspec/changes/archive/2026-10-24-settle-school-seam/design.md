# Design

## Context

见 proposal.md（W3：单实现的 hypothetical seam，两字段全仓零消费，guard 的 lai-yin 分支为空）。约束：体系立场（C3）与 ADR-002/004 的注册与引用纪律一字不动；`test/school.test.ts` 绊线断言是 lai-yin 守护的真实现状。

## Goals / Non-Goals

**Goals:**

- SchoolAdapter 接口只剩有真实消费者的字段——接缝声明与实际接线一致
- 新流派扩展路径显式化：types 联合 + registry 加一行，typecheck 兜底
- guard 的空分支如实化，不再暗示「运行时检查 lai-yin」

**Non-Goals:**

- 不新增第二流派（路线 A 备选；真需要时按 extensibility 既有需求扩展即可）
- 不改 citationRoots 扫描行为与引文守卫
- 不动 `forbiddenFeatures` 两特征声明（体系立场）与绊线断言

## Decisions

1. **路线 B「诚实收窄」而非路线 A「补第二实现」。** 「一个 adapter = 假想接缝，两个才是真的」——为验证接缝形状而造一个用不上的第二流派，是给假想变体付维护成本（违背 YAGNI）；收窄后的接口对未来的第二流派同样够用（新流派按需补自己的字段）。若未来真加流派，届时再扩接口，扩展点语义（清单注册 + 引用内核）不变。
2. **删 `defaultBrightnessSchool` 与 `assertionFramework`。** 两者全仓零消费（wenmo-brightness 不 import school）。前者的语义（记录内核默认流派）由本变更的 specs delta 显式改写为「内核默认值不进适配器接口」；后者的「断语框架」描述是无接线的设计残留。
3. **`SchoolId` 去 `(string & {})` 逃生舱。** 清单注册哲学下新流派本来就要动 registry（加一行）与 types（加 id）——两处显式比类型逃生舱更符合「漏注册由 typecheck 兜底」的既定纪律；逃生舱恰恰让「忘了在 types 声明」变得合法而不可见。
4. **guard 空分支如实化而非补运行时检查。** lai-yin 的守护者是 `test/school.test.ts` 绊线断言（字段不被填回），guard 的运行时检查无从做起（内核根本没有该字段的产生路径）——把注释改为如实描述，避免「声明了两个特征、检查了一个」的误导。
5. **`DEFAULT_SCHOOL_ID` 与键名的手写重复顺手单点化**（从 SCHOOLS 键集派生或收敛为单处字面量），消除同值双写。

## Risks / Trade-offs

- [删字段后若有隐性消费者] → 全仓 grep 两字段名的引用，预期零命中（评审已核）；typecheck 兜底
- [`(string & {})` 去除后第三方类型扩展受限] → 本仓无第三方插件（ADR-001 单仓形态），不构成现实约束；改动写进 delta 便于将来回看
- [收窄被误读为「放弃多流派」] → specs delta 的 scenario「适配器镜像内核默认值」把取舍理由写成规范——删的是冗余声明，不是扩展点

## Migration Plan

1. 删两字段 + 接口收窄 → 2. SchoolId 去逃生舱 → 3. guard 注释如实化 + DEFAULT_SCHOOL_ID 单点化 → 4. 五闸门。回滚：单提交 revert。

## Open Questions

（无）
