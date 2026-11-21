# Design

## Context

- `ZIWEI_NO_CACHE` 现有四个触点：缓存模块单点读取（chart-cache.ts:235）→ run.ts 全链注入 → selftest 入口自设（经 direct-env.ts 常量）→ chart-cache.test 反复摘戴。它防的是「内核改了、CACHE_VERSION 忘递增、回归命中旧缓存」的假绿。
- `ZIWEI_TEST_YEAR` 现有四触点：run.ts 从 `--year` 设定 → chart.test / json-contract 读取过滤层 1 年份组。
- 关键结构事实：`cli.test.ts` 的 `cli()` 默认**进程内直调**（`CLI_SUBPROCESS=1` 才走真子进程）；真子进程仅 `cliReal` 冒烟与 CLI_SUBPROCESS 分支；selftest 的子进程仅文末冒烟（runCli）。**synastry / knowledge 不排盘**，不识别 `--no-cache`（未知参数会报错）——旗标只能精确加在排盘命令的 spawn 上。

## Goals / Non-Goals

**Goals:**

- 回归链路零环境变量注入；旁路与过滤全部走显式旗标 / 参数。
- 缓存的 SKILL.md 行为与 `--no-cache` 语义不变；CACHE_VERSION 纪律保留。

**Non-Goals:**

- 不删缓存层、不动内核导出（kernel-contract）、不改 `--no-cache` 的 CLI 语义。
- 不为 `--year` 引入文件 IPC 或名称匹配的全局语义替换。

## 不可逾越的约束

- 失败可见性：旁路的漏配不得静默——「直调 ≡ 子进程」对拍断言是兜底红灯。
- kernel-contract 冻结面零协同（chart-cache 的旁路 API 是 cli/ 层新增导出，不在冻结面）。
- 生成物纪律：cli-samples 产物含 `--no-cache` 描述（NO_CACHE_DESC 引用声明表），旗标语义不变则产物不重导。

## Decisions

### D1 缓存旁路 = 显式 API + 子进程 argv 旗标（弃环境变量）

- **决策**：`chart-cache.ts` 新增 `setCacheBypassAll(v)`（模块级单点，`generateChartCached` 的禁缓存判定改为 `opts.noCache || bypassAll`），删除 `process.env.ZIWEI_NO_CACHE` 分支与 `direct-env.ts`。设定点两处：selftest 入口（`cmdSelftest` 开头）与 `cli.test.ts` 模块加载期。子进程面：selftest 的 `runCli` 在 argv 首段为 `astrology` 时追加 `--no-cache`；`cli.test.ts` 的 `cliReal` / `CLI_SUBPROCESS` 分支同理（均为排盘命令）。
- **备选否决**：往每个测试 argv 全局追加 `--no-cache`——否决，测试的 argv 是被测对象本身，全局注入改变被测面；synastry / knowledge 会对未知旗标报错。保留 env 但只改设定点——否决，env 的「不可见、无差别、自动继承」正是要删的东西。
- **后果两面**：收益 = 旁路可见（读设定点即知谁被豁免）、精确（进程内一次设定 + 子进程旗标各自显式）、env 通道消灭；代价 = 新增 spawn / 直调点需记得带旗标——由「直调 ≡ 子进程」对拍断言兜底（spec scenario 3），且该断言在 cli.test.ts 已存在（内核直调 ≡ CLI --json 子进程输出）。
- **deletion test**：删掉旁路 API 换回 env = 回到不可见注入；删掉旁路 API 又不设旗标 = 回归假绿。API 是两个消费者（selftest / 测试进程）的最小公共面。

### D2 `--year` 过滤 = 两阶段 spawn（弃环境变量）

- **决策**：run.ts 在 `--year` 给定时跑两段 `node --test`：非层 1 文件全量（文件清单从 LAYERS 派生——label 以「层 1」开头者出局）+ 层 1 两文件带 `--test-name-pattern=<year>`（层 1 用例名首段即出生年，describe「1953 年」与 it「1953-01-01 …」皆命中）。事件流各自落 agg 文件，聚合时合并 records——分层对账逻辑不变。默认（无 --year）保持单次 spawn 现状。
- **备选否决**：`--test-name-pattern` 打在全量文件上——否决，非匹配用例被跳过会破坏「其余各层照常全跑」的诊断语义（层 2/3 是层 1 红时的鉴别器）；文件 IPC 传递年份——否决，与 env 同类的隐性通道，违背本次宗旨。层 1 文件内删除 `YEAR_FILTER` 读取与跳过逻辑——过滤完全上移 runner 旗标，文件面更薄。
- **后果两面**：收益 = 零 env、过滤是 node --test 原生旗标、诊断语义保留；代价 = run.ts 多一段 spawn 编排与 records 合并（有 --year 时才走第二段，默认路径零变化）；`--year` 过滤跑时「漂移/五行局」等非年份用例也会被名称匹配跳过（属预期缩窄，README 注明）。
- **边界**：`--year` 取值匹配的是**用例名首段年份**（1953），同名撞库风险由两阶段的文件限定消除（1924–2100 等年份域断言在 invariants.test.ts，不属层 1 文件集）。

### D3 测试文件面瘦身

- chart.test.ts / json-contract.test.ts：删 `YEAR_FILTER` 与 `if (YEAR_FILTER !== null) continue`——过滤上移 runner。
- chart-cache.test.ts：删 env 摘戴（beforeEach/afterEach 的 `delete process.env.ZIWEI_NO_CACHE`）与「env 同样禁缓存」用例；缓存行为测试（命中/失效/原子写/时钟）全保留——旁路 API 下它们直接测 `opts.noCache` 与（若需要）`setCacheBypassAll(false)` 的默认态。
- 接缝判据自检：旁路 API 是「一个函数 + 两个设定点」；两阶段是 run.ts 内部编排；无新模块（direct-env.ts 反而删除）。

## Risks / Trade-offs

- [新增 spawn / 直调点漏带旗标 → 假绿回归] → 兜底红灯已存在（内核直调 ≡ 子进程输出对拍，cli.test.ts）；spec scenario 3 钉住该形态
- [两阶段 spawn 的聚合对账失真] → records 合并后走同一分层对账；任务含 `--year 1953` 冒烟验证（对账行 + 分层汇总人工核对）
- [旁路 API 被测试外代码误用（生产路径设 true）] → API 仅 selftest 与测试进程调用；生产 CLI 不 import 该函数（astrology 走 `--no-cache` 旗标路径）——design 声明消费面，code review 盯
- [--year 语义微变（非年份用例也跳过）] → README 注明，属预期缩窄

## Migration Plan

顺序：缓存旁路 API 化（1.x）→ run.ts 两阶段（2.x）→ 文档/spec 同步（3.x）→ 验收（4.x）。回滚 = revert 单 commit；无数据迁移、无产物重导。
