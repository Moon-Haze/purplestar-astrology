# Tasks

## 1. 取材单点落地

- [x] 1.1 新建 `analysis/overview-material.ts`：`starBadge`（带括号）+
  `OverviewMaterial` 接口 + `buildOverviewMaterial(ctx)`，7 决策点语义逐字对齐
  views/overview.ts 现行版（它是统一基准）。验证：`npm run typecheck` 0 错误。
- [x] 1.2 `views/overview.ts` 改为消费 material（【】版式装配；mainStarDesc 与
  第二主星行改用 `starBadge`）。验证：`--topic wealth` 输出与基线 diff **仅**
  第二主星行的亮度括号差异。
- [x] 1.3 `report.ts` 删本地 `starBadge` 与内联取材，改为消费 material
  （### 版式装配）。验证：`--report` 输出与基线 diff 仅三处预期变化
  （兜底句 ×1、徽标括号 ×2）。
- [x] 1.4 `palace-query.ts` 的 `descPalaceStars` 内联徽标改引 `starBadge`。
  验证：该函数输出零变化（同式收敛）。

## 2. 回归与文档

- [x] 2.1 全量闸门：`node scripts/purple-star.ts selftest` 158/158、
  `ZIWEI_NO_CACHE=1 npm test` 全绿、`npm run typecheck` 0 错误、
  `npx prettier --check` 改动文件过。
- [x] 2.2 `npx tsx tools/cli-samples.ts --out docs/cli-samples.md` 再生成，
  63/63 样例符合预期；`git diff docs/cli-samples.md` 仅为上述文案变化。
- [x] 2.3 docs/code/analysis.md 登记 `overview-material.ts` 条目（取材单点 +
  徽标单点，两编排器消费）。

## Workflow follow-up

- 归档 `openspec archive extract-overview-material`；提交等用户指示。
