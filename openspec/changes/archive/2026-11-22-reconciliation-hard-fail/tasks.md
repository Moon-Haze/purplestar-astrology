# Tasks

## 1. 实现

- [ ] 1.1 `test/lib/run.ts` 对账段：全量回归（无手动 name-pattern 过滤）下分层合计 ≠ 官方总计 → `process.exitCode = 1` + ✖ 报错（两类脱钩排查指向）；过滤跑保持 ⚠ 告警并标注合法
- [ ] 1.2 同段 v3 叙事修正：最慢榜「白名单命中（太阳/太阴@酉）」文案改 KNOWN_DIVERGENCES 中性表述

## 2. 验收

- [ ] 2.1 红演练：临时改 LAYERS suites 名 → 全量 npm test 非零退出且报对账失败；还原后全绿
- [ ] 2.2 `--year 1953` 冒烟：两阶段合并后对账天然齐（349 项无警告），过滤告警语义不变
- [ ] 2.3 typecheck 0 错误 / npm test 全绿 / selftest 全绿 / openspec validate --all 零失败
