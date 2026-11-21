# Tasks

## 1. 缓存旁路旗标化

- [x] 1.1 `chart-cache.ts`：新增 `setCacheBypassAll(v)` 显式旁路 API（模块级单点），`generateChartCached` 的禁缓存判定改为 `opts.noCache || bypassAll`，删除 `process.env.ZIWEI_NO_CACHE` 读取分支。完成判据：`npm run typecheck` 过；`grep ZIWEI_NO_CACHE scripts/cli/chart/chart-cache.ts` 零命中。
- [x] 1.2 `direct-env.ts` 删除；`scripts/cli/selftest/index.ts` 的 env 设定改为 `setCacheBypassAll(true)`（import 改自 chart-cache），`runCli` 子进程在 argv 首段为排盘命令时追加 `--no-cache`。完成判据：`grep -rn "direct-env\|ZIWEI_NO_CACHE" scripts/` 零命中；selftest 跑一遍全绿（`node scripts/purple-star.ts selftest`）。
- [x] 1.3 `test/cli.test.ts`：模块加载期对缓存模块设旁路（进程内直调面）；`cliReal` 与 `CLI_SUBPROCESS` 分支的排盘命令 spawn 在 argv 追加 `--no-cache`。完成判据：`grep -n ZIWEI_NO_CACHE test/cli.test.ts` 零命中；`ZIWEI_NO_CACHE=1 npm test` 摘掉 env 后裸跑 `npm test` 全绿（层 2 全过）。

## 2. run.ts 两阶段 --year

- [x] 2.1 run.ts：删 `ZIWEI_TEST_YEAR` 设定与 DIRECT_CHART_ENV 引入；`--year` 给定时两阶段 spawn——非层 1 文件全量（文件清单从 LAYERS 派生）+ 层 1 文件带 `--test-name-pattern=<year>`，agg records 合并后走同一分层对账。完成判据：`grep ZIWEI_TEST_YEAR test/` 零命中；`npm test -- --year 1953` 冒烟——分层汇总含全部层、层 1 仅 1953 条目、对账行一致。
- [x] 2.2 层 1 文件瘦身：`chart.test.ts` / `json-contract.test.ts` 删 `YEAR_FILTER` 读取与跳过逻辑（过滤上移 runner）。完成判据：`grep -n YEAR_FILTER test/` 零命中；裸 `npm test` 全绿。

## 3. 缓存测试与文档 / spec 同步

- [x] 3.1 `chart-cache.test.ts`：删 env 摘戴与「env 同样禁缓存」用例；`--no-cache` 旗标路径的缓存行为测试全保留。完成判据：`grep -n ZIWEI_NO_CACHE test/chart-cache.test.ts` 零命中；裸 `npm test` 层 2 缓存套件全绿。 （env 摘戴删除；env 用例改整链旁路 API 用例——断言「无新增文件」修正为与旁路前目录对比）
- [x] 3.2 文档同步：AGENTS「缓存」节（env 注入 → 显式旗标）、quality-gates delta 折回面的「回归链路禁缓存」requirement 改写（归档时折回，本任务先改 change 内 delta）、references/options.md 的 env 提及、test/README.md 命令示例（`ZIWEI_NO_CACHE=1 npm test` → `npm test`）与两阶段 `--year` 语义注明。完成判据：`grep -rn "ZIWEI_NO_CACHE" AGENTS.md test/README.md references/ docs/` 零命中（归档目录与 change 工件除外）。

## 4. 集成验收

- [x] 4.1 三件套裸跑（无任何 env 前缀）：`npm run typecheck` 0 错误；`node scripts/purple-star.ts selftest` 全绿；`npm test` 全绿。完成判据：三条命令均无 env 前缀执行且退出码 0。
- [x] 4.2 残留清点：`grep -rn "ZIWEI_NO_CACHE\|ZIWEI_TEST_YEAR\|DIRECT_CHART_ENV" scripts/ test/ tools/ AGENTS.md` 仅剩 change 工件与归档（或零命中）。完成判据：活性面零命中。
- [x] 4.3 规范校验：`openspec validate --all` 普通与 --strict 零警告。完成判据：退出码 0、无 WARNING。 （validate --strict 13/13 零警告）
