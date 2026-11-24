# test-infra.md —— 测试基础设施

`test/lib/` 下支撑 `npm test` 的基础设施模块。本篇收 B / C 类长注释；A 类契约（`@param` /
`@returns` / `@throws`）与 D 类口径锁留在源码。

## 一、`test/lib/reporter.ts`：node:test 事件流的结构化聚合 reporter

> 由 `test/lib/reporter.ts` 注释原文外置（搬运不是改写，措辞与源码原注释一致）。

### 1.1 挂载方式与目的

`npm test` 的聚合 reporter。由 `test/lib/run.ts` 以 `--test-reporter <本文件绝对路径>` 挂载
（相对路径会 `ERR_MODULE_NOT_FOUND`，勿改回相对），与 spec reporter 并行：spec 照常输出到
stdout（人看），本 reporter 把事件流过滤成「一行一条 JSON」落到临时文件。

### 1.2 只依赖单事件自带的可靠字段

⚠️ 只依赖**单事件自带**的可靠字段（`file` / `name` / `details.duration_ms` / `message`）。
实测（node 26）多文件并行下 `classname` / `nesting` / `parentId` 会部分丢失或错乱，
任何依赖「测试树形状」的聚合在这里都不可靠 —— 分层用 `file`（四个测试文件天然对应层 1-4），
项数与耗时用每个文件的 `test:summary`（官方口径）。
