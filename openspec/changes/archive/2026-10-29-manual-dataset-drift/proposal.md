# Change: 修复 export-manual 非确定性；手册重导因 dataset 陈旧阻塞

## Why

把 `docs/manual/topics/*.md` 与 `scripts/corpus/data/manual/*.ts` 用 `tools/db/export-manual.ts`
重导时，发现**同一 parquet + 同一工具两次重导字节不同**（md5 不等）——导出器非确定性。

根因：`collectTopic` / `collectCombo` / `auditGeju` 三处 SQL 缺 `ORDER BY`，DuckDB 行序不保证，
导致「同星多样本去重首现序」每次不同，输出字节漂移。这恰好解释了手册为何「每次重导都翻天覆地」。

**进一步排查发现更深的问题**：当前 `db/dataset`（git 跟踪，09-26）相对内核源码已**陈旧**——
parquet 存储文本里是错字「倪海**夏**」，而内核 `scripts/analysis/data.ts`、`scripts/corpus/data/patterns.ts`
现在的源码都是正确「倪海**厦**」。已提交的手册（10-12）用的是正确「倪海厦」。若用当前 parquet 重导，
会向手册**植入错字、劣化内容**（这正是 `mutagen-sanfang-caliber` 重导时那 3.2 万行 diff 的实质：
非确定性重排 + parquet 陈旧，而非口径改动）。

## What Changes

仅交付工具侧修复，**不提交任何重导产物**（避免退化）：

- `tools/db/export-manual.ts`：`collectTopic` 加 `ORDER BY sample_id`；`collectCombo` 计数并列时按
  辅星名 tiebreak（`ORDER BY 1,2,3 DESC`）；`auditGeju` 抽样加 `ORDER BY sample_id`。使重导字节可复现。

## Impact

- `export-manual.ts` 变为确定性生成器：同输入同输出，后续手动重导不再产生虚假万行 diff。
- 为「重建 dataset 后干净重导手册」铺路——但那一步需先 `npm run build:db` 重建 parquet
  （依赖 518k 设计样本构建链，本会话环境不具备），列为**环境阻塞项**，不在本 change 内，建议另开 change。
- 不触碰 dataset、不改手册/corpus 产物、不改任何运行行为（分发件不含 `docs/` 与 `corpus/`）。
- 运行回归（typecheck / selftest / npm test）不受影响：导出工具不参与 CLI 运行链路。

## 阻塞项（环境）

- 手册/corpus 干净对齐：需重建 `db/dataset`（内核源码「倪海厦」已修正，但 parquet 是 09-26 旧构建）。
  重建依赖 `npm run build:db` + 518k 样本，环境不具备 → 阻塞。重建后用确定性工具重导即可，但本会话不做。
