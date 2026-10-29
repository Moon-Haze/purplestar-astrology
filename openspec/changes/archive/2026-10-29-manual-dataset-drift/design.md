# Design: 修复 export-manual 非确定性

## Decision 1 — 根因是 SQL 缺 ORDER BY，确定性靠加 ORDER BY 修复

`export-manual.ts` 的 `collectTopic` 用
`SELECT major_stars[1] AS star, <topic text> ... WHERE palace_name='…' AND len(major_stars)>0`
喂给 `byStar`（`Map<star, Map<line, section>>`）。同星的论断行按**首次出现**去重，
首现序取决于样本行返回次序。DuckDB 无 `ORDER BY` 时不保证次序 → 每次重导顺序不同 → 字节漂移。

修复：在三类查询补确定性排序键——
- `collectTopic`：`ORDER BY sample_id`（sample_id 唯一，确定全序）。
- `collectCombo`：`ORDER BY 1, 2, 3 DESC` → 计数并列时按辅星名（`2`）tiebreak，频率表顺序稳定。
- `auditGeju`：`ORDER BY sample_id LIMIT 2000`，抽样确定。

`byStar` 外层 `[...entries()].sort()` 已按星名排序；`lines` 内序由 `ORDER BY sample_id` 固化。
确定性修复后，同 parquet 两次重导 md5 一致（已验证）。

## Decision 2 — 不提交重导产物：当前 parquet 陈旧，重导会劣化内容

探查发现 parquet 文本含错字「倪海**夏**」，内核源码已是「倪海**厦**」。已提交手册正确。
若此时重导并提交，会把错字写入手册、并因非确定性修复后的新固定次序产生大面积伪 diff。

故本 change **只交付工具修复**，手册/corpus 产物回退到 HEAD。干净对齐的正确路径是：
先 `npm run build:db` 用当前内核重建 parquet（消除「倪海夏」错字），再用确定性工具重导——
但重建依赖 518k 样本构建链，本会话环境不具备，**列为阻塞项**，不在本 change 交付。

## Decision 3 — 提交范围最小化

仅 `tools/db/export-manual.ts` 一处（三处 SQL 字符串加 ORDER BY）。不碰：
- `db/dataset`（权威来源，只读；其陈旧问题留待重建）
- `docs/manual/`、`scripts/corpus/data/manual/`（回退、不退化提交）
- 内核源码与测试（导出工具不在运行链路，回归不受影响）

## 非目标

- 不重建 dataset、不修正 parquet 的「倪海夏」错字（属内核/data 源修正 + 重建，另开 change）。
- 不实装手册重导（会退化内容）。
- 不处理 `mutagen-sanfang-caliber` 的四类差异（已独立归档，且与手册无关）。
