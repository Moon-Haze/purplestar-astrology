# Proposal

## Why

架构评审 2026-10-24（候选 S1，运行时实证）：analysis 三张数据表的宫名键用「紧凑形 + iztro 旧口径（仆役）」，而运行时 `Palace.name` 是「展开形 + 项目口径（交友宫）」（`PALACE_NAMES_ORDER`）。消费点（`views/surround.ts`、`lookups.ts`、`views/year-stem.ts`）拿运行时宫名直查紧凑键表，11/12 miss，被 `?? ""` 与「否则走简述」分支静默吞掉——次星深度文案几乎全空、「年干四化·全局关键宫位影响」一节多数主题不输出（实测 `TOPIC_KEY_PALACES` 命中 love 1/6、friends 0/2）。`interpretation-contract` 早已规定「宫名口径一致（第 8 宫是交友宫，不是仆役宫）」——本变更是让实现追上规范。同时十四主星名集合四表（`STAR_CONTENT_MAP` / `STAR_BRIEF` / `data/stars.ts` / manual `ORACLE` 键）各管键集、无互证断言，宫名侧有 `test/invariants.test.ts` 互证而星名侧没有对应物。

## What Changes

- 归一函数上移内核：`compactPalaceKey`（现唯一住址 `tools/db/export-manual.ts`）进 `scripts/data/`（与 `PALACE_NAMES_ORDER` / `IZTRO_TO_PROJECT_PALACE` 同址），tools/db 改引内核版
- 键域统一：`MINOR_STAR_PALACE_CONTENT` / `PALACE_TO_CONTENT_KEY` / `TOPIC_DEFS.keyPalaces[].palace` 统一改用展开形键（= `PALACE_NAMES_ORDER` 域）；`TOPIC_DEFS` 内部「palace 展开形、keyPalaces[].palace 紧凑形」的双形态并存一并统一
- invariants 预言机：三张分析表的每个宫名键 ∈ `PALACE_NAMES_ORDER`（与既有宫名两表互证同款纪律）
- 星名互证：十四主星名单一真相源（`data/stars.ts`），`STAR_CONTENT_MAP` / `STAR_BRIEF` / manual `ORACLE` 键集互证断言
- manual 快照重导：`corpus/data/manual/*.ts` 按新输出重导（「在迁移：」→「在迁移宫：」时代文本分叉收拢，bc21b4d 重导先例）

## What Doesn't Change

- **7978cb3 回退决定维持**：db 散表保持上游紧凑原状；本变更改的是内核 analysis 表与取用链，不碰 db 散表抄写
- **排盘结果零变化**：排盘内核（algorithm / mutagen / patterns）输出不动，变化的只是主题论断取材的完整性；不递增 `CACHE_VERSION`（analysis 数据不进排盘缓存）
- **输出形态不变**：`--topic` / `--report` 板块结构与宫名口径（展开形、交友宫）不变，变的是缺失内容回血
- **体系立场不动**：文墨排盘 + 倪师论断、飞星禁用均不涉及
- 分层定位：analysis 表改键属「内容扩展」；`compactPalaceKey` 落 `data/` 是内核新增**纯函数**（ADR-003「内核只暴露纯函数供插件消费」允许），不改任何既有内核导出；kernel-contract 冻结面若覆盖 `data/` 新增导出，在 design 显式核实并按纪律同步

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `quality-gates`: 新增「分析数据表键域互证」需求——analysis 侧宫名键表与主星键表 SHALL 与运行时域互证（宫名键 ∈ `PALACE_NAMES_ORDER`、十四主星四表同键集）。键域漂移属 typecheck 查不到的一类，符合本能力「机器查不到才值得新增守卫」的价值观

## Impact

- 代码：`scripts/analysis/data.ts`（三表键域）、`scripts/data/`（归一函数新址）、`scripts/analysis/views/*` 与 `lookups.ts`（消费点随键域统一）、`tools/db/export-manual.ts`（改引内核版）、`test/invariants.test.ts`（新断言；已有文件，无需登记层表与 LAYERS）
- 输出：`--topic` / `--report` 次星深度文案与年干四化节从缺失到输出；样例文档重生成（`npm run cli-samples`）
- 数据：manual 快照大面积文本变化（重导）
