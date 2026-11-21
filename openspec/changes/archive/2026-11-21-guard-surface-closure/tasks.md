# Tasks

## 1. 候选 2：MD_POINTER 扩词元 + 存量清理

- [x] 1.1 `package.json` 补 `build:db` 别名（`tsx tools/db/build-duckdb.ts`）
- [x] 1.2 repo.test.ts 加 `stringSpans` 词法器 + 三个新 it（npm run / references 字符串 / 裸 .test.ts），共用白名单与反向守卫纪律
- [x] 1.3 先红后绿：守卫用存量清单当场抓出全部断针，再逐条清理转绿（build:db ×17 / verify:db / 四域 ×5 / 392KB ×2 / manual 残留 ×3 / tests/db.test.ts ×2 / AGENTS.md notes 行 / cli-commands.md 测试路径 / citation-guard 死分支）
- [x] 1.4 两处用户可见文案（query.ts / export-manual.ts）的 build:db 随别名变真，逐字复核

## 2. 候选 3：GENERATED 生成器自报化

- [x] 2.1 `export-notes.ts` 的 `MANAGED_DIRS` / `MANAGED_METHOD_FILES` 提为 export；`export-manual.ts` 新增 `MANAGED_PATHS`；`tools/corpus/import-tianji.ts` 自报 `MANAGED_PATHS`
- [x] 2.2 `review-gate.ts` 的 `GENERATED` 改为消费上述自报 + wenmo-tables 登记常量；notes 死正则删除；README 移出误伤（matcher 支持精确路径与目录前缀两种形态）
- [x] 2.3 `docs/manual/README.md` 自述改真话（「除本 README 外全部由 … 生成」）

## 3. 候选 4：覆盖守卫随回归 + argv 单点接线

- [x] 3.1 `test/cli.test.ts` 加覆盖对拍断言（coveredParams/declaredParams 派生，与 main() 内检查同式）
- [x] 3.2 `sample.ts` 补 `DEMO_PARTS` / `DEMO_FEMALE_PARTS` 组件值单点（argv 四常量改由组件值派生）；`tools/cli-samples.ts` SAMPLES 表 DEMO 同款串收敛为单点引用（异组生辰留字面量）；头注改口
- [x] 3.3 先红后绿：临时从 SAMPLES 删一个参数样例 → npm test 红 → 还原

## 4. 验收

- [x] 4.1 三类新词元的守卫活体证明各一次（注入断针 → 红 → 还原 → 绿）
- [x] 4.2 typecheck 0 错误 / selftest 全绿 / npm test 全绿 / eslint-prettier 过
- [x] 4.3 `openspec validate --all` 通过、零警告
