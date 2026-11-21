# Design

## Context

现状与动机见 proposal.md Why。落点全部在测试面：互证网住 `test/invariants.test.ts` 的 `describe("analysis 数据键域互证")`（层 3），空退化住 `test/astrology-sections.test.ts` 断言 3。网内已有可复用的两份真相源：宫名域 `domain = new Set(PALACE_NAMES_ORDER)`，主星域 `KERNEL_STAR_TABLE.STAR_DESCRIPTIONS` 键集（既有「十四主星键集」项的 truth 源）。`ANALYSIS_DATA` 已 load `@/analysis/data`（含 `TOPIC_PALACE_NAME`），`@/corpus/data/patterns` 已 load（解构处补 `PATTERN_VERDICTS` 即可）。

## Goals / Non-Goals

- Goals：把两个漏网入口纳入既有互证网；消除板块测试的空退化静默通道。
- Non-Goals：不改 `TOPIC_DEFS` / `PATTERN_ASIDES` 数据与消费点行为；不改 `makeContext` 的 null 返回契约（「无法找到 xx 相关信息。」回落是公开行为）；不动 spec 之外的帮助文案。

## Decisions

1. **扩面落点：宫名域并入既有项，PATTERN_ASIDES 独立成项。**
   主题主宫键与既有四张表同域（宫名域）、同断言形态（`domain.has` + 报键名），并入 `it("宫名键域…")` 循环（项名改「五张分析表」）避免平行 it 膨胀——deletion test：另起一项只是把同一循环搬家。`PATTERN_ASIDES` 是「条目域 + 星名域」双向检查，形态不同，独立成项。

2. **补注内层星名域取内核主星域，不取全星名域。**
   消费域即 `detectHuaLuRuMing` 的 `s.type === "major"` 判定，主星域是消费的真实域；域越宽越拦不住「抄错成另一颗星名」的漂移。未来补注若扩到次星，断言红即扩域信号（红驱动），不预设宽容域掩盖抄错。

3. **外层条目键 ⊆ `PATTERN_VERDICTS` 条目键。**
   补注经 `fillVerdict(PATTERN_VERDICTS[name], …)` 直接索引（无 `?.`），判词侧条目改名而补注未跟时，运行时是 undefined 展开的静默缺字段产出——双向网把「条目改名」类漂移一并拦住。

4. **空退化修复形态：`ctx !== null` 显式断言后直调。**
   替代方案（改 `makeContext` 对解析失败抛错）否决：null 返回是公开契约，改抛错是行为变更，超出本变更范围；在测试面显式断红已闭合静默通道。

## 不可逾越的约束

- `TOPIC_DEFS` / `PATTERN_ASIDES` 数据零改动（当前键全在域内，护栏纯增量）。
- `PATTERN_ASIDES` 按星稀疏是文档化设计（jsdoc「其余星为空」），互证守键域不守稀疏度。
- 层 3 项数 +1 属护栏扩展的预期变动，不触发「内核层项数报警器」的内容扩展越界口径。

## Risks / Trade-offs

- [未来新增星名域数据表漏登记进网] → 网内断言形态即模板（域集 + 报键名），补表成本一行；本变更在 AGENTS.md 键域口径留清单锚点。
- [补注表扩次星时主星域断言红] → 红即设计信号：域与消费判定同批扩，不静默放行。

## Open Questions

（无）
