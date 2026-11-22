# Proposal

## Why

第五轮 Speculative #3（LAYERS suites 名与 describe 标题脱钩无断言）经本轮深挖后**部分解除**：

- 文件级脱钩（新增测试文件未登记 LAYERS）的对账现状是**软告警**（console 打印 ⚠，退出码不受影响）——新增测试文件忘登记时回归全绿照常，聚合漏计靠人眼发现。
- suites 名脱钩（describe 标题改名而 LAYERS.suites 未跟上）维持挂账：其后果是最慢榜混入聚合项（cosmetic），三修法各有实质缺陷并留档否决——静态扫描 describe 脆（chart.test describe 名已随 manifest 动态模板化）、nesting 结构信号被实测否决（reporter.ts:8「多文件并行下部分丢失或错乱」）、删 suites 字段丢最慢榜排除。挂账判断成立，否决理由移入 run.ts 注释留档。

本 change 把**文件级对账**从软告警升级为硬失败：全量回归下聚合漏计当场非零退出（与「升级 iztro 的流程」「登记一致性」两条纪律的闸门级地位对齐）；手动透传 `--test-name-pattern` 的过滤跑保持告警（未映射属合法形态——`--year` 两阶段合并后对账天然齐全，已冒烟实证 349 项无警告）。

## What Changes

- `test/lib/run.ts` 对账段：全量回归（无手动 name-pattern 过滤）下「分层合计 ≠ 官方总计」改为 `process.exitCode = 1` + ✖ 明确报错（含两类脱钩的排查指向）；过滤跑保持 ⚠ 告警并标注「合法差异」。
- 顺手修正同段同族的 v3 叙事：最慢榜「白名单命中（太阳/太阴@酉）」文案改为 KNOWN_DIVERGENCES 中性表述（白名单现清单为空，@酉 差异已随数据集 v4 化消失）。

## What Doesn't Change

- suites 名脱钩维持挂账（否决理由留档 run.ts，不立新守卫）。
- `--year` 两阶段模式与手动过滤跑的行为语义不变（前者对账天然齐、后者告警）。
- 排盘内核、 fixtures、旁路 API 零改动。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `quality-gates`：「基准回归的分层与登记」requirement 补对账硬失败 scenario（全量回归脱钩即非零退出；过滤跑告警合法）。
