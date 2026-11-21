# Proposal

## Why

键域互证网（quality-gates「分析数据表键域互证」，`test/invariants.test.ts` 现守四张表）存在两个已定位的漏网入口（2026-11-21 架构评审 S1，证据已人工核验）：

1. 主题**主宫**键 `TOPIC_DEFS[k].palace`（派生表 `TOPIC_PALACE_NAME`）不在网内——网只守 `keyPalaces[].palace`。主宫键写错时全链静默：`makeContext` 返回 null（`scripts/analysis/context.ts:118-121`），而 `test/astrology-sections.test.ts:326-328` 的断言在 ctx 为 null 时把 texts 退化为空数组、板块头断言照样通过——新主题写紧凑宫名（如「仆役」）不红。
2. corpus 格局判词侧 `PATTERN_ASIDES`（`scripts/corpus/data/patterns.ts:208`）的内层星名键无互证——抄错星名时补注句静默消失，消费点 `scripts/patterns/enhancing.ts:192` 以 `?? ""` 收口。

键域漂移是 typecheck 查不到的缺陷类，网外入口正是该缺陷类的活口。

## What Changes

- `test/invariants.test.ts` 键域互证补两个入口：
  - 主题主宫键（`TOPIC_PALACE_NAME` 派生表）并入既有宫名域互证循环；
  - 新增 `PATTERN_ASIDES` 双键域互证：外层条目键 ⊆ `PATTERN_VERDICTS` 条目键（补注挂在判词表没有的条目上是死数据），内层星名键 ⊆ 内核主星域（消费域即 `detectHuaLuRuMing` 的 `s.type === "major"` 主星）。
- 修复 `test/astrology-sections.test.ts` 断言 3 的空退化：ctx 为 null 从「空数组静默通过」改为显式断红——测试面不再掩盖主宫解析失败。
- `AGENTS.md`「键域口径」的表清单同步（补主题主宫）。

**不做什么**：

- 不改 `PATTERN_ASIDES` 的按星稀疏语义——「其余星为空」是该表 jsdoc 明言的文档化设计，消费点 `?? ""` 按星落空串保留（互证守键域，不守稀疏度）。
- 不动 `TOPIC_DEFS` / `PATTERN_ASIDES` 数据本身——当前键全在域内，纯护栏增量，CLI 产出零变化。
- 不扩及杂曜键域——现有互证面各表均不涉杂曜键，无现状缺口。

**被否决的备选**（留档）：

- 把主宫键改成类型安全的键域联合类型、靠 typecheck 拦截：否决——本仓对数据表键域的既定钉法是运行时互证（宫名/主星域来自运行时表，类型面写不出这个域），改类型方案是另一套机制且解不了 PATTERN_ASIDES 侧。
- 消费点 `enhancing.ts` 改为对 miss 抛错：否决——miss 是稀疏表的预期语义，抛错会把设计当缺陷。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `quality-gates`: 「分析数据表键域互证」需求 MODIFIED——互证面扩至主题主宫键与 corpus 格局补注表双键域，并新增「断言空退化」场景钉住测试面不静默；其余场景同步收进枚举细节。

## Impact

- 测试：`test/invariants.test.ts`（层 3：既有宫名域互证项扩面 + 新增 1 项）、`test/astrology-sections.test.ts`（断言 3 收紧，项数不变）。
- 数据与内核零改动；`scripts/` 侧仅 AGENTS.md 清单一行同步。
- 验证义务申报：护栏扩展（非内容扩展型），跑三件套 `typecheck` + `selftest` + `npm test`；层 3 项数 +1 属预期变动（该项数报警器盯的是内容扩展型越界，护栏扩展不在其列）。
