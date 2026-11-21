# Tasks

## 1 互证网补网（test/invariants.test.ts，层 3）

- [x] 1.1 宫名域互证项扩面：`TOPIC_PALACE_NAME` 并入既有宫名域循环，项名改「五张分析表」；判据 `npm test` 层 3 该项绿
- [x] 1.2 新增 `PATTERN_ASIDES` 双键域互证项：外层条目键 ⊆ `PATTERN_VERDICTS` 条目键、内层星名键 ⊆ `KERNEL_STAR_TABLE.STAR_DESCRIPTIONS` 主星域（`@/corpus/data/patterns` 的既有 load 解构处补 `PATTERN_VERDICTS`）；判据 `npm test` 层 3 新项绿
- [x] 1.3 反向注入演练：① 临时把某主题主宫改紧凑键（如「仆役」）→ 宫名域项红并点名主题与键；② 临时抄错一处补注星名 → 新项红；还原后层 3 全绿

## 2 板块测试空退化修复（test/astrology-sections.test.ts）

- [x] 2.1 断言 3 改显式断红：`assert.ok(ctx !== null, 点名主题)` 后直调 `buildOverviewMaterial`，删除三目空数组退化；判据 `npm test` 板块项绿
- [x] 2.2 与 1.3 ① 同一注入下板块断言也红（两处均红），还原后全绿

## 3 文档同步与闸门

- [x] 3.1 `AGENTS.md`「键域口径」表清单补主题主宫（`TOPIC_DEFS[].palace`）
- [x] 3.2 三件套全绿：`npm run typecheck`（0 错误）、`node scripts/purple-star.ts selftest`（全绿）、`npm test`（层 3 全绿、层 3 项数 +1；层 5 唯一红属并行会话 round7 变更的编辑中状态，与本变更无接触面）；`npm run lint` 0 error、改动行过 prettier

## Workflow follow-up

- 归档走 openspec-archive-change（delta 折回 quality-gates 主干），归档后 `openspec validate --all` 零警告
- 提交按仓惯例随归档收口
