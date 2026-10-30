# Design

## Context

生成链四段：内核表（`analysis/data.ts`、`data/ganzhi.ts` 等）→ `db/dataset`（518k 样本 parquet，权威来源，git 跟踪）→ `tools/db/export-manual.ts`（读 parquet + 内核表，依赖方向正确：引用不复制）→ 生成物（`docs/manual/` ×14 + `scripts/corpus/data/manual/` ×15）。`invariants` 守着键域互证，但没有内容级漂移探针——2026-10-29 的 `manual-dataset-drift` 归档刚清掉 3.2 万行级欠账，这笔账之所以能欠下，就是因为「内核改了、生成物没人重导」不会让任何闸门变红。

前置已满足：`manual-dataset-drift` 已归档。但归档时其**重导被阻塞**，本轮（2026-10-30）核实并推进：`ziwei-samples-toolkit/samples-out`（5.5GB）就在本机，「本机无语料」不成立；本仓 build 管线的字段漂移已修复（源侧字段名对齐 db-slim 基准：`hour`/`mingGongBranch`/`siHua`/`daXianAge`…，含 idx_birth 索引列名），重建实测跑通（720 分片 8.6 分钟，git 跟踪的 samples+palaces parquet 逐字节未变）。**但语料本身是 2026-04-24 的内容快照**——topics 文本含「倪海夏」错字 861 处/百行（内核已修；当前手册 24 文件零错字），从它重导即内容回退。真正的解阻点在**上游**：toolkit 用当前内核再生成 samples-out。在此之前探针已知红（wealth.ts + 重建库与手册的内容代差），属本职捕获；修复路径与 review 面挂载共用该解阻点。另：duckdb 中间物（`ziwei.duckdb`）的表**外挂引用** dataset parquet——dataset 移走时 open 仍成功、首个查询才报 IO 错，降级判定必须覆盖「生成阶段失败」而不仅是「打开前检测」。

## Goals / Non-Goals

**Goals:**

- 「生成物漂移」从人工发现变成非零退出报警；探针复用导出器自身逻辑，不引入第二套对拍实现。

**Non-Goals:**

- 不自动重导（重导是显式决策，探针只报警）；不改导出器行为与产物格式；不校验 `db/dataset` 自身（权威来源域）；不做抽样近似。

## Decisions

### D1 探针形态：`--check` 内存对拍，而非 test 内抽样对拍

对拍「同工具 + 同输入」才守得住「工具或内核变了」两类漂移：抽样对拍要自己实现一套对拍逻辑，本身就是新的漂移面。代价是耗时（全量重导约数十秒）——因此**不进 `npm test`**，挂独立命令 + review 面。重导路径需从导出器内部抽出「产出到内存」的形态（不写盘），这是本 change 的主要代码工作。

### D2 挂载点：`npm run manual:check` 先行，review 面挂载随 dataset 重建解阻

实测全量重导对拍约 **5 分钟**（423s user / 175% CPU，设计时预估「数十秒」错误）——独立 script 供随时手跑不受影响；review 闸门面追加调用会使每次 review +5 分钟，且当前探针已知红（见 Context），**立即挂载会让 review 永久阻断**。故分两步：本 change 交付 script 与探针本体；review 面挂载（探针红 = review 阻断）作为**阻塞任务**随 dataset 重建 + 重导清账后接线。未来若有 CI 再挂 CI，本期不做。

### D3 降级：环境不可用时显式 ⏭，且「生成阶段失败」同样按环境处理

与 `skipUnlessRepo` 同纪律：跳过必须可见、不得静默绿。两处判定：打开前（`resolveQueryTarget` 为 none、`@duckdb/node-api` 不可 import）与**生成阶段任何抛错**（如 duckdb 中间物外挂的 parquet 缺失）——后者输出「⏭ … 探针未执行，这不是绿」并零退出；环境缺失不是缺陷，但 review / 日志里必须能看到这一行。只有 `compareArtifacts` 的对拍结论才有权报红。

### D4 差异输出：文件清单 + 每文件前 5 处差异行

足够定位（该去重导还是该查工具），不刷屏。零差异输出一行确认。

### D5 探针不替代重导纪律

「生成文件不手改、改生成器再重导」的既有纪律不变；探针把「忘了重导」从潜伏期风险变成即时红灯。

## Risks / Trade-offs

- **耗时**：全量对拍约 5 分钟——独立命令无碍；review 面挂载因此顺延到 dataset 解阻后（D2）。
- **内存对拍路径与写盘路径分叉**：抽取时导出器保持「同一产出函数、两种落点（内存 / 磁盘）」，避免两条实现。
- **parquet 与内核表**谁漂移谁：探针报差异不归因（归因看 diff 内容），不引入归因逻辑。

## Migration Plan

纯新增（tools 层 + 一条 script + review 面一行调用），无迁移。apply 顺序：先 `manual-dataset-drift`（已归档 ✓）→ 本 change。

## Open Questions

（无——Q10 已裁定形态与挂载点）
