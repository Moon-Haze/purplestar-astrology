# Design

## Context

生成链四段：内核表（`analysis/data.ts`、`data/ganzhi.ts` 等）→ `db/dataset`（518k 样本 parquet，权威来源，git 跟踪）→ `tools/db/export-manual.ts`（读 parquet + 内核表，依赖方向正确：引用不复制）→ 生成物（`docs/manual/` ×14 + `scripts/corpus/data/manual/` ×15）。`invariants` 守着键域互证，但没有内容级漂移探针——2026-10-29 的 `manual-dataset-drift` 归档刚清掉 3.2 万行级欠账，这笔账之所以能欠下，就是因为「内核改了、生成物没人重导」不会让任何闸门变红。

前置已满足：`manual-dataset-drift` 已归档（重导已落地提交），探针启用时应直接全绿。

## Goals / Non-Goals

**Goals:**

- 「生成物漂移」从人工发现变成非零退出报警；探针复用导出器自身逻辑，不引入第二套对拍实现。

**Non-Goals:**

- 不自动重导（重导是显式决策，探针只报警）；不改导出器行为与产物格式；不校验 `db/dataset` 自身（权威来源域）；不做抽样近似。

## Decisions

### D1 探针形态：`--check` 内存对拍，而非 test 内抽样对拍

对拍「同工具 + 同输入」才守得住「工具或内核变了」两类漂移：抽样对拍要自己实现一套对拍逻辑，本身就是新的漂移面。代价是耗时（全量重导约数十秒）——因此**不进 `npm test`**，挂独立命令 + review 面。重导路径需从导出器内部抽出「产出到内存」的形态（不写盘），这是本 change 的主要代码工作。

### D2 挂载点：`npm run manual:check` + review-gate 面

独立 script 供随时手跑；`tools/review-gate.ts` 的对拍场景面追加调用（探针红 = review 阻断）。未来若有 CI 再挂 CI，本期不做。

### D3 降级：缺 `db/dataset` 或 DuckDB 时显式 ⏭

与 `skipUnlessRepo` 同纪律：跳过必须可见、不得静默绿。判据：目录不存在或 `@duckdb/node-api` 不可 import → 输出「⏭ 跳过：<原因>」并**零退出**（环境缺失不是缺陷），但 review 面输出里必须能看到这一行。

### D4 差异输出：文件清单 + 每文件前 5 处差异行

足够定位（该去重导还是该查工具），不刷屏。零差异输出一行确认。

### D5 探针不替代重导纪律

「生成文件不手改、改生成器再重导」的既有纪律不变；探针把「忘了重导」从潜伏期风险变成即时红灯。

## Risks / Trade-offs

- **耗时**：review 面每次多数十秒（可接受：review 本就是提交流程的慢闸门）。
- **内存对拍路径与写盘路径分叉**：抽取时导出器保持「同一产出函数、两种落点（内存 / 磁盘）」，避免两条实现。
- **parquet 与内核表**谁漂移谁：探针报差异不归因（归因看 diff 内容），不引入归因逻辑。

## Migration Plan

纯新增（tools 层 + 一条 script + review 面一行调用），无迁移。apply 顺序：先 `manual-dataset-drift`（已归档 ✓）→ 本 change。

## Open Questions

（无——Q10 已裁定形态与挂载点）
