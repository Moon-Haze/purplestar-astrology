# Tasks

## 1 基线采集（动手前）

- [x] 1.1 取 CLI 输出基线：`--report` 全报告 + `--pattern --mutagen --decadal` 组合各一条落盘；判据基线文件在手、可复跑

## 2 内核 import 归位 + lint 守卫

- [x] 2.1 6 处 `@/data/*` 改相对路径（`algorithm.ts` / `mutagen.ts` / `palace-relations.ts` 用 `./data/…`，`patterns/medium.ts` 用 `../data/ganzhi`）；判据 `grep -rn "@/data" scripts/algorithm.ts scripts/mutagen.ts scripts/palace-relations.ts scripts/patterns/` 零命中
- [x] 2.2 `eslint.config.mjs` 加 no-restricted-imports 规则块（`scripts/*.ts` + `scripts/patterns/**` + `scripts/data/**` 禁 `@/*`）；判据 `npm run lint` 0 error 且 `purple-star.ts` / `cli/` / 插件层零误伤
- [x] 2.3 反向注入：内核文件临时写 `@/data/ganzhi` → lint 红并点名；还原全绿
- [x] 2.4 基线复跑：两条样例输出与基线逐字节 diff=0

## 3 starBadge 挪家（W4，消类型级环）

- [x] 3.1 `starBadge` 从 `overview-material.ts` 挪入 `lookups.ts`，overview-material 与 palace-query 改 import 源；判据 `grep -n "starBadge" scripts/analysis/*.ts` 仅 lookups 定义 + 两消费方自 lookups 引入
- [x] 3.2 基线复跑：diff=0；`npm run typecheck` 0 错误

## 4 天纪册名表单点化（W5）

- [x] 4.1 新增 `corpus/data/tianji-books.ts`：`Record<TianjiBook, string>`（type 引自生成物导出的 `TianjiBook`）；`sources/tianji.ts` 删本地 `TIANJI_BOOK_NAMES` 改引伴生模块，已类型化查表的 `?? b` / `?? e.book` 兜底删除（用户输入侧 `?? bookStr` 保留）；判据 `npm run typecheck` 0 错误、`knowledge --source tianji` 概览与检索输出正常
- [x] 4.2 反向注入：临时从 Record 删一键 → `typecheck` 红（穷尽性守卫）；还原全绿
- [x] 4.3 `knowledge --source tianji` 输出与改动前基线逐字节 diff=0（含概览、限册检索、未命中三形态）

## 5 闸门

- [x] 5.1 三件套全绿：`npm run typecheck`、`node scripts/purple-star.ts selftest`、`npm test`；`npm run lint` 0 error、改动行过 prettier

## Workflow follow-up

- 归档走 openspec-archive-change（ADDED requirement 折回 quality-gates 主干），归档后 `openspec validate --all` 零警告
- 提交按仓惯例随归档收口
