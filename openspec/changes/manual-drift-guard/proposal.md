# Proposal

## Why

`docs/manual/` 与 `scripts/corpus/data/manual/` 是**生成物**（由 `tools/db/export-manual.ts` 从 `db/dataset` parquet 与内核表导出），生成链四段「内核表 → db/dataset → export-manual → 生成物」的一致性目前**全靠人工重导**，没有任何断言盯着：`npm test` 全绿 ≠ 生成物没漂。

实证两次踩坑：

- 2026-10-24 `7603c43`（宫名键域统一展开形）后，手册与 corpus 数据漂移 **3.2 万行级**，直到 `manual-dataset-drift` change（2026-10-29 归档）人工比对才现形；
- 2026-10-24 `restore-analysis-palace-keys` 曾因重导环境阻塞卡在 11/12——「重导要等环境」这件事本身没有探针提示，只有任务清单记得。

## What Changes

- **`export-manual --check` 模式**：在内存中重导（不写盘）与已提交产物逐字对拍；存在差异时**非零退出**，报出漂移文件清单与每文件前若干处差异样例；零差异时输出一行确认。
- **挂载点**：独立命令 `npm run manual:check` + review 闸门面（`tools/review-gate.ts`）调用——探针红 = review 阻断。**不进 `npm test` 日常回归**（重导对拍耗时数十秒，不该拖慢每次回归）。
- **可见降级**：本机缺 `db/dataset` 或 DuckDB 依赖不可用时**显式跳过并标注**（⏭ + 原因），不得静默绿——与「跳过必须可见」纪律同款。
- **不做什么**：不自动重导（重导是显式决策，探针只报警不代跑）；不改导出器行为与产物格式；不做 parquet 数据集层的校验（那是 `db/dataset` 作为权威来源自身的域）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `quality-gates`: 新增「生成物漂移探针」需求——生成物与当前内核表 / 导出工具的一致性 SHALL 由 `--check` 探针守住（非零退出报警），SHALL 挂独立命令与 review 面，SHALL NOT 进 `npm test` 日常回归，环境缺失 SHALL 显式跳过。

## Impact

- **代码**：`tools/db/export-manual.ts`（重导到内存的路径抽取 + `--check` 参数）、`package.json`（`manual:check` script）、`tools/review-gate.ts`（面调用）。全部在 tools 层，不触内核与 CLI 行为。
- **规范面**：`quality-gates` ADDED 一条需求（本 change）。
- **顺序约束**：apply 须排在 `manual-dataset-drift`（重导落地）之后——该 change 已于 2026-10-29 归档，前置已满足；启用时探针应直接全绿（若红，说明落地后又有漂移，属探针本职）。
- **验证义务**：tools 层改动 → `npm run typecheck` + `selftest` 必跑；探针自身行为用「人为漂移一处 → 红、恢复 → 绿、缺依赖 → ⏭」三步实测。
