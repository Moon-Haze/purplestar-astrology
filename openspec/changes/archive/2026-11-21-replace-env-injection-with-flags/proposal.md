# Proposal

## Why

回归链路当前依赖**环境变量注入**传递两个参数：`ZIWEI_NO_CACHE=1`（绕过排盘缓存，防回归命中旧缓存假绿——由 run.ts 注入全链、selftest 入口自设、缓存模块单点读取）与 `ZIWEI_TEST_YEAR`（`npm test -- --year` 的层 1 年份过滤）。环境变量注入的问题：**不可见**（读代码看不出某条测试路径有没有被豁免）、**无差别**（整链继承，无法精确到「哪些调用点需要旁路」）、**易漏**（新增 spawn 点自动继承，掩盖漏配）。用户拍板：环境变量注入方式全部删除，改用**显式旗标/参数**。

## What Changes

- **缓存旁路旗标化**：缓存模块新增显式旁路 API（`setCacheBypassAll`，模块级单点，selftest 入口与测试进程各设一次，取代 run.ts / selftest 的两处环境变量设定与 `direct-env.ts` 常量模块）；`generateChartCached` 删除 `process.env.ZIWEI_NO_CACHE` 读取分支——旁路只剩两条**显式**通道：每调用旗标 `--no-cache`（既有 CLI 参数）与回归入口的旁路设定。子进程冒烟探针（selftest 的 runCli / cli.test 的 cliReal / CLI_SUBPROCESS 分支）在 argv 携带 `--no-cache`（仅排盘命令；synastry / knowledge 不排盘不带）。
- **年份过滤旗标化**：run.ts 删除 `ZIWEI_TEST_YEAR` 环境变量；`npm test -- --year <N>` 改为**两阶段 spawn**——非层 1 文件全量跑（语义「其余各层照常全跑」不变），层 1 文件经 node --test 的 `--test-name-pattern=<N>` 过滤（用例名首段即出生年）。层 1 文件内的 `ZIWEI_TEST_YEAR` 读取与跳过逻辑随之删除（过滤完全上移到 runner 旗标）。
- **文档与规范同步**：AGENTS「缓存」节、quality-gates 的「回归链路禁缓存」requirement（改写为「回归链路显式禁缓存」——旁路走显式旗标、环境变量通道零残留）、references/options.md 的 env 提及、test/README.md 命令示例。

### 不做什么

- **不删缓存层**——SKILL.md 承诺的缓存行为（`--no-cache` 旗标、临时目录存储、跨春节重排）原样保留；`--no-cache` 旗标语义不变。
- **不动 CACHE_VERSION 纪律**——内核改动须递增版本的既有防线保留，旗标化只是给回归链路换显式通道。
- **不删 `--year` 过滤特性**——只换传递通道；两阶段 spawn 保住「其余各层照常全跑」的诊断语义。
- **不新增能力 spec**——落 `quality-gates` 既有 requirement 的修订。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `quality-gates`：**修订** Requirement「回归链路禁缓存」——环境变量注入（`ZIWEI_NO_CACHE` / run.ts spawn env / selftest 自设）删除，改写为显式旗标方案（旁路 API + 子进程 argv 旗标），补「环境变量零残留」与「漏带旗标由直调≡子进程对拍兜底」两个 scenario。

## Impact

- **修改**：`scripts/cli/chart/chart-cache.ts`（删 env 分支 + 旁路 API）、`scripts/cli/chart/direct-env.ts`（删除）、`scripts/cli/selftest/index.ts`（env 设定 → 旁路 API + runCli 旗标）、`test/lib/run.ts`（删两处 env 设定 + --year 两阶段）、`test/cli.test.ts`（进程内旁路设定 + 子进程旗标）、`test/chart-cache.test.ts`（env 操作清理）、`test/chart.test.ts` / `test/json-contract.test.ts`（YEAR_FILTER 删除）、AGENTS.md、test/README.md、references/options.md、`openspec/specs/quality-gates/spec.md`（归档折回）。
- **不触**：排盘内核导出（kernel-contract）、`--no-cache` 旗标的 CLI 语义、依赖版本、数据链。

## 验证义务申报

**纯重构偏上**（行为面等价替换 + 验证纪律改写）：`npm run typecheck` + `selftest` + `ZIWEI_NO_CACHE=1` **不再需要**——`npm test` 裸跑全绿即交付判据本身；`npm test -- --year 1953` 冒烟验证两阶段过滤；`grep` 确认 `ZIWEI_NO_CACHE` / `ZIWEI_TEST_YEAR` 全仓零残留；`openspec validate --all` 零警告。
