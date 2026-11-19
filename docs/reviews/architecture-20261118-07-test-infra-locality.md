# 候选 7 · 测试基建两处 locality 缺口：直调 harness 双写 + 缓存环境保证靠入口约定（2026-11-18 第五轮）

**档位**：Worth exploring ｜ **分层**：test/（零内核改动）｜ **规范面**：无需 openspec change（测试基建，不触 quality-gates spec 面）｜ **与已定决策冲突**：0（ZIWEI_NO_CACHE=1 纪律本身不动，动的是「谁负责保证」）

## 涉及文件

| 位置                                   | 角色                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `test/cli.test.ts:111-129`             | `cliCmdInProcess`（带 `sub` 参数、`asCliFailure` 包装、未知命令指路）                        |
| `test/report.test.ts:47-59`            | `cliCmdInProcess` 第二份（写死 astrology、普通 Error 包装），注释自称「与 cli.test.ts 同款」 |
| `test/lib/run.ts:136`                  | `ZIWEI_NO_CACHE=1` 的唯一设置点（npm test 全链注入）                                         |
| `scripts/cli/chart/chart-cache.ts:235` | 缓存绕过判定（`opts.noCache                                                                  |     | process.env.ZIWEI_NO_CACHE`） |
| `test/chart-cache.test.ts:92-100`      | 唯一给自己摘变量的测试文件（自防先例）                                                       |

## 问题 A（file:line 实据）：进程内直调 harness 抄了两份，误差包装已分叉

「进程内直调 COMMANDS（省冷启动税）」这一装配方式在两个测试文件各写一份：`cli.test.ts` 版走 `load` 惰性加载 + 未知命令 `unknownCommandMessage` 指路 + 失败包装成 `asCliFailure`（带 `.message`）；`report.test.ts` 版写死 `astrology`、失败包装成普通 `Error.message`、注释承认「同款」。两份的**错误包装形态已经微差**——改 dispatch 装配形态要双改，漏一处则该文件的错误形态断言悄悄失真。这正是 `test/lib/loader.ts` 头注释记过案的那类「同形副本各自演化」。

## 问题 B（file:line 实据）：缓存环境保证是「入口约定」而非「文件自保证」

`ZIWEI_NO_CACHE=1` 只在 `test/lib/run.ts:136`（npm test 入口）设置；从 run.ts 进入的一切（含子进程）继承。但绕过入口直跑单文件（`node --test test/cli.test.ts`）时无人设置 → `cliCmdInProcess` 直调 `cmdAstrology` → `generateChartCached` 会**读/写** `.cache` 或系统临时目录的缓存盘：改动内核后直跑测试可能命中旧内核缓存**假绿**，还会把新盘写进缓存。目前只有 `chart-cache.test.ts` 给自己摘了变量（它测的就是缓存本身）；cli/report/invariants 等全部依赖「从 run.ts 进入」这一隐式契约，没有断言盯着。「回归链路恒设 ZIWEI_NO_CACHE=1」的纪律里，「回归链路」的边界现在是口口相传。

## 为什么是摩擦（词汇口径）

两处的共性是：**保证住在错误的层**。harness 的保证（直调语义 ≡ 子进程语义的装配）应该有一个共享 implementation；环境保证应该跟随**需要它的文件**而不是**碰巧的入口**——任何新测试文件都要记得「我从 run.ts 进来所以缓存安全」，这条隐式 interface 不可见、不可测。

## 方案方向

1. **抽 `test/lib/cli-driver.ts`**：一个函数（入参：命令名、args、失败包装策略——`asCliFailure` 形态 / 普通 message 形态），两文件各留一行薄调用。`test/lib` 已有 loader / citation-guard / sample-source 等「机制共用」先例，落同一 seam。
2. **环境自保证下沉**：`cli.test.ts` / `report.test.ts` / `invariants.test.ts` 等直调排盘的测试文件模块顶层加 `process.env.ZIWEI_NO_CACHE ||= "1"`（与 chart-cache.test 的显式摘除互不冲突——它后设即覆盖）；`run.ts:136` 的注入保留（子进程仍靠它）。此后「直跑单文件」天然安全。

## deletion test

抽 driver：删 report.test 那份 → 装配知识只此一份（深化）；不做 → 双份继续演化（正是 loader 记案的事故形状）。环境自保证：把 `run.ts:136` 那行删掉，npm test 仍安全（文件自保证兜住）——保证不再依赖单一入口（深化）；维持入口约定 = 每个新文件一条隐性义务（locality 差）。

## Before / After

```text
Before: 副本 × 2 + 入口约定 × 1                After: driver × 1 + 文件自保证
cli.test.ts    cliCmdInProcess（asCliFailure）   test/lib/cli-driver.ts ── 装配 + 包装策略入参
report.test.ts cliCmdInProcess（普通 Error）      cli.test.ts    ── 一行薄调用
ZIWEI_NO_CACHE ── 只在 run.ts 入口               report.test.ts ── 一行薄调用
  （单文件直跑裸奔 → 缓存假绿风险）                各测试文件顶 ── ||= "1" 自保证（run.ts 注入保留）
```

## 验收

- 直调行为逐字节不变：`npm test` 输出与改前一致（driver 是等值抽取）。
- 活体证明：不带 run.ts 直跑 `node --test test/report.test.ts`，改前会读写缓存目录（可先观察 `.cache`/临时目录 mtime），改后零读写。
- 三件套全绿。

## 落地注意

- 新增 `test/lib/cli-driver.ts` 不动层表（lib 不算测试项）；若要在 `test/README.md` 层表加注一句机制说明更好。
- `invariants.test.ts` 若也直调排盘，一并加自保证；逐文件 grep `generateChartCached\|cmdAstrology` 圈定范围。
- driver 的失败包装策略入参保持两种形态都可用（cli.test 的错误形态断言依赖 `asCliFailure` 形态，report.test 依赖 message 形态——抽走装配不改变各自断言看到的错误形状）。
