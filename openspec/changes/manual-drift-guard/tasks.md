# Tasks

## 1. 重导到内存的路径抽取（D1）

- [ ] 1.1 `tools/db/export-manual.ts` 把「产出文本」与「落盘」分离：产出函数返回每文件内容（内存形态），写盘路径消费它；判据：现有重导产物与抽取前逐字节一致（`--check` 开发前的自证）
- [ ] 1.2 新增 `--check` 模式：内存重导后与磁盘上已提交产物逐字对拍；差异时非零退出，输出漂移文件清单 + 每文件前 5 处差异行；零差异输出一行确认；判据：`npm run typecheck` 0 错误

## 2. 环境降级与挂载（D2 + D3）

- [ ] 2.1 缺 `db/dataset` 或 DuckDB 依赖不可用时显式 ⏭ 跳过（输出原因、零退出），不得静默绿；判据：临时改名 `db/dataset` 目录实测跳过可见
- [ ] 2.2 `package.json` 增 `manual:check` script（`tsx tools/db/export-manual.ts --check` 类形态）
- [ ] 2.3 `tools/review-gate.ts` 对拍场景面追加 `npm run manual:check` 调用，探针红 = review 阻断、⏭ 原因可见；判据：review 输出含探针行

## 3. 实测与验证

- [ ] 3.1 三步实测：人为漂移一处（改一个生成物字节）→ `manual:check` 红并报出该文件；恢复 → 绿；缺依赖 → ⏭ 可见；判据：三态输出留档
- [ ] 3.2 `npm run typecheck` 0 + `node scripts/purple-star.ts selftest` 全绿 + `npm test` 不受影响（探针不在其中）；判据：三件套输出留档
- [ ] 3.3 `openspec validate --all` 零警告（含本 change）

## 4. 归档

- [ ] 4.1 实现完成后 `ADDED` 需求折回 `openspec/specs/quality-gates/spec.md`（追加于「分析数据表键域互证」之后），archive 本 change
