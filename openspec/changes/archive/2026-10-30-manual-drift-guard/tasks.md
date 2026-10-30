# Tasks

## 1. 重导到内存的路径抽取（D1）

- [x] 1.1 `tools/db/export-manual.ts` 把「产出文本」与「落盘」分离：`emit`/`ensureDir` 双落点（写盘 / 收进 `collected`），产出函数只调它们；判据：check 模式重导 31 个产物中 30 个与盘上逐字节一致（唯一差异 wealth.ts 是真实漂移，见 3.1）——「同一份产出代码」成立
- [x] 1.2 新增 `--check` 模式：内存重导后与盘上产物逐字对拍；差异时非零退出，输出漂移文件清单 + 每文件前 5 处差异行（含「盘上缺失」与「盘上孤儿」两种漂移形态）；零差异输出一行确认；判据：`npm run typecheck` 0 错误

## 2. 环境降级与挂载（D2 + D3）

- [x] 2.1 环境不可用显式 ⏭ 且零退出，覆盖两类判定：打开前（无库无 dataset / DuckDB 不可 import）与**生成阶段任何抛错**（输出「探针未执行，这不是绿」）；判据：临时移走 `db/dataset` 实测——duckdb 中间物外挂 parquet 缺失场景命中生成阶段判定，⏭ 可见、exit 0（已实测）
- [x] 2.2 `package.json` 增 `manual:check` script（`tsx tools/db/export-manual.ts --check`）
- [x] 2.3 `tools/review-gate.ts` 闸门面追加 `npm run manual:check` 调用（探针红 = review 阻断、⏭ 原因可见；「轻」档跳过——全量对拍约 5 分钟）——2026-10-30 随解阻链落地：toolkit 语料 4 月快照问题由主仓自建 `tools/db/generate-shards.ts` 根治（当前内核直出 518k 分片，5 路并行 33 分钟，错字零），dataset 重建于 `--out db` 正位、全量重导后探针 33 文件逐字一致

## 3. 实测与验证

- [x] 3.1 三态实测：**红**——首跑捕获 wealth.ts 真实漂移（差异样例 5 行，exit 1）；**⏭**——移走 dataset 后可见跳过、exit 0；**绿**——2026-10-30 主仓生成器重产语料 + `build:db --out db` 重建 + 全量重导后，`manual:check` 输出「✔ 33 个文件逐字对拍」零退出
- [x] 3.2 `npm run typecheck` 0 + `node scripts/purple-star.ts selftest` 全绿 + `npm test` 不受影响（探针不在其中）——已执行：typecheck 0 错误、selftest 162/162 报告 diff=0、lint 0 error（9 条既有 warning 持平）、探针未接线 npm test（结构性不触及）
- [x] 3.3 `openspec validate --all` 零警告（含本 change）——已执行：10/10 passed

## 4. 归档

- [x] 4.1 2.3 已接线、红/⏭/绿三态实测齐；`ADDED` 需求折回 `openspec/specs/quality-gates/spec.md`（「分析数据表键域互证」之后），archive 本 change（2026-10-30）
