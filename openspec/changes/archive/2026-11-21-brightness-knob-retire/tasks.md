# Tasks

## 1. 实现

- [x] 1.1 `wenmo-brightness.ts`：删除 `currentSchool` / `setBrightnessSchool` / `getBrightnessSchool` 三件套与退役说明注释；`wenmoStarBrightness` 缺省参数 `currentSchool` → 字面量 `"XD2"`；模块 docstring 同步
- [x] 1.2 `test/kernel-contract.test.ts`：亮度查询组移除旋钮存在性与签名断言（`wenmoStarBrightness` 断言原样保留），留退役说明注释
- [x] 1.3 `test/invariants.test.ts`：移除旋钮 import 与「默认流派归一」用例（层 4 项数 -1 显式说明）；学理锚点 it 补「缺省流派 ≡ XD2」断言
- [x] 1.4 文档同步：`docs/code/chart-kernel.md`（:41 契约面清单 + §5.6 状态位置节改写）与 `docs/code/school.md`（引用而非迁移段）

## 2. 验收

- [x] 2.1 `grep -rn "currentSchool|setBrightnessSchool|getBrightnessSchool" scripts/ test/ tools/ docs/` 归零（`docs/plans/` 历史档除外——档案不改）
- [x] 2.2 全输出与基线逐字节 diff = 0（DEMO 盘默认概览 / `--palaces` / `--topic` / help）
- [x] 2.3 `typecheck` 0 错误 / `selftest` 全绿 / `npm test` 全绿（项数变动 = +2 键域网（N4）+1 laiYin 绊线（N6）-1 旋钮用例 = 净 +2，已在各处显式说明）
- [x] 2.4 `openspec validate --all` 通过、零警告
