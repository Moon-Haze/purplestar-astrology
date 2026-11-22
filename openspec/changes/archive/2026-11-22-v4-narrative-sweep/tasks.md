# Tasks

## 1. S1：export-manual 计数修正与产物重导

- [x] 1.1 生成器两处计数：518,400 → 674,976；6,220,800 → 8,099,712 宫次
- [x] 1.2 `npm run manual:export` 重导 docs/manual 产物；diff 检查变化范围符合预期
- [x] 1.3 `npm run manual:check` 对拍绿

## 2. S2：fixtures/manifest 重导

- [x] 2.1 跑 `build-fixtures`：新 baselineEngine / source 落产物；charts.jsonl / raw-rows.json 逐字节不变
- [x] 2.2 run.ts 环境块与 suites 名随 manifest 新值自动跟上（模板化已就位）

## 3. S3：现行事实陈述修正

- [x] 3.1 school/guard.ts、data/wuxing.ts（含独立性表述修正）、test/lib/compare.ts 的「300 条」→ 385
- [x] 3.2 test/README.md 两处 2.5.8 叙事 v4 化（亮度节开头、fixtures 锁死节）
- [x] 3.3 run.ts 补 suites 名脱钩否决理由留档 + 挂账表述更正（单向检测已被 repo 层断言覆盖）

## 4. 验收

- [x] 4.1 typecheck 0 错误 / selftest 全绿 / npm test 全绿 / eslint-prettier 过
- [x] 4.2 `npm run manual:check` 绿；全仓 grep「518,400 / 300 条基准」现行陈述归零（历史沿革叙述除外）
- [x] 4.3 `openspec validate --all` 通过、零警告

## 5. 扫尾派生（记档，本批不实现）

- [x] 5.1 **SP7（实现级，下一批）**：`tools/db/verify-duckdb.ts` 的 verifyDimensions 维度覆盖检查仍按 v3 合成历构造期望全集（`1924 + y` / `range(30)` / `FULL_BUILD_SAMPLES = 518_400`）——对 v4 真实日历数据集（1950–2026 / solar / day 容器 31）该检查失义。修法方向：复用 `sample-id.ts` 的 CALIBER 双口径机制按 MANIFEST.calendar 构造期望全集（solar 需按真实月天数生成）。`tools/db/db.ts` 的 topic_lines 行数注释已随本批修正，verify-duckdb 的实现级残留单独立项。
