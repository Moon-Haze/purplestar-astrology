# Tasks

## 1 层 6 扫描守卫（test/repo.test.ts「仓库自洽」describe）

- [x] 1.1 新增豁免边界扫描项：白名单常量（两文件 × { 静态集, 动态集 }）+ 双形态正则扫描 `scripts/corpus/**` 与 `scripts/synastry/**` 的 cli 引用边 + 白名单文件存在性校验；判据 `npm test` 层 6 新项绿
- [x] 1.2 反向注入演练：① 在 corpus 任一非豁免文件临时加一条 cli 引用 → 红并点名；② 白名单临时删一条既有边 → 红；③ 白名单文件路径临时改错 → 红（锚点失效反恒真）；还原后层 6 全绿

## 2 文档同步与闸门

- [x] 2.1 `AGENTS.md` 分层红线（ADR-003 节）补豁免说明一行（具名文件 + 具名模块集 + 守卫指路）
- [x] 2.2 三件套全绿：`npm run typecheck`（0 错误）、`node scripts/purple-star.ts selftest`（全绿）、`npm test`（全绿，层 6 项数 +1）；`npm run lint` 0 error、改动行过 prettier

## Workflow follow-up

- 归档走 openspec-archive-change（delta 折回 extensibility 主干），归档后 `openspec validate --all` 零警告
- 提交按仓惯例随归档收口
