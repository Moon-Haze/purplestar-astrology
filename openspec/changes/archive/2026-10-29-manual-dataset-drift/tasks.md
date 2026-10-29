# Tasks: 修复 export-manual 非确定性（手册重导阻塞于 dataset 重建）

## 1. 漂移刻画

- [x] 1.1 定量：重导 `docs/manual/topics` 相对已提交手册 ~3.2 万行级替换；但两次重导 md5 不等
      → 工具非确定性，非口径改动（与 `mutagen-sanfang-caliber` 无关，其四类差异均被导出器动态节排除）。
- [x] 1.2 一致性核对：parquet（09-26）存储文本为错字「倪海**夏**」，内核源码
      `scripts/analysis/data.ts` / `scripts/corpus/data/patterns.ts` 现为正确「倪海**厦**」；
      已提交手册正确。重导会向手册植入错字 → 不可提交重导产物。

## 2. 修复导出器非确定性

- [x] 2.1 `tools/db/export-manual.ts` 三处 SQL 加 `ORDER BY`：`collectTopic`→`sample_id`；
      `collectCombo`→`1,2,3 DESC`（辅星名 tiebreak）；`auditGeju`→`sample_id`。
      判据：改动仅 SQL 字符串，类型检查 0 错误。

## 3. 验证闸门

- [x] 3.1 确定性：修复后连跑两次 `all`，抽样 `docs/manual/topics/overview.md` 与
      `scripts/corpus/data/manual/overview.ts` 的 md5 **两次一致** → 非确定性已消除。
- [x] 3.2 三件套：`npm run typecheck`=0 / `node scripts/purple-star.ts selftest`=162/162 /
      `npm test`（恒 `ZIWEI_NO_CACHE=1`）=631 项 630 通过 / 1（既有引文守卫，与本 change 无关）。
- [x] 3.3 内容保全：重导产物与已提交版逐类计数相等（⭐格局 517/517、✦次星 448/448、四化 787/787），
      但发现实质文本差=「倪海厦」vs「倪海夏」错字 → 判定**重导产物劣化，不提交**，工作树回退 HEAD。

## 4. 提交（范围最小化）

- [ ] 4.1 `git commit`：仅 `tools/db/export-manual.ts`（确定性修复）。
      排除：手册/corpus 重导产物（已回退）、`package.json` 既有改动、`books/ notes/ tools/notes/` 等未跟踪目录。
      中文 Conventional Commits、scope `tools`。
      ⚠️ 手册/corpus 干净对齐为**环境阻塞项**（需 `npm run build:db` 重建 dataset，依赖 518k 样本，本会话不具备），
      不在本 commit；归档时显式标注「Archived with 1 blocked task」。

## Workflow follow-up

- 归档后把 `export-manual.ts` 修复 + 归档的 change 目录一并提交（一个逻辑变更一个 commit）。
- 另开 change 处理「重建 dataset 并干净重导手册/corpus」：先修正内核 data 源（倪海厦）、
  `npm run build:db` 重建 parquet、再用本 change 修复后的确定性工具重导。
