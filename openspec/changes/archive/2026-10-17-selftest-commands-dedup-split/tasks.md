# Tasks

## 1. 去重

- [x] 1.1 `runCommandSplit` 旧名清单并入 `insight`（if 条件与错误文案）；
  删 `runAstrologyShapes` 内「astrology：旧命令名已删」与「组合层：守卫链 --monthly」
  两条。完成判据：`node scripts/purple-star.ts selftest` 全绿且首行合计 = 158。

## 2. 拆分

- [x] 2.1 `runAstrologyShapes` 整块搬入新建 `selftest/astrology-shapes.ts`
  （断言体原样；imports 只带实际依赖：node:fs / node:path / node:os / eq /
  SelftestDeps；签名收窄去 `commandNames`）；`commands.ts` 删该函数与
  仅其使用的 import（`eq`）；头注释同步两文件职责描述。
- [x] 2.2 `index.ts` import 改道（`./astrology-shapes`），**调用序不动**。
  完成判据：selftest 全绿、报告与 1.1 后基线**逐字一致**（除函数归属外零变化）、
  `npm run typecheck` 0 错误、`npm test` 全绿、`npx prettier --check` 两文件过、
  `npm run lint` 过。

## Workflow follow-up

- 归档 `openspec archive selftest-commands-dedup-split`；docs/code/cli-selftest.md
  若记载组文件清单则同步（已同步：cli-selftest.md 组清单拆出 astrology-shapes.ts 条目。）提交等用户指示。
