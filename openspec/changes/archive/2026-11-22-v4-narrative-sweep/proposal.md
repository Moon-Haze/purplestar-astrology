# Proposal

## Why

第七轮评审 SP5 扫尾后做了一轮全仓失真扫描，发现「基准引擎叙事 v4 化」尚有一批漏网：数据集已为 1950–2026 / 674,976 条（v4 管线本仓内核直生成），但仓库内的叙事仍多处停留在 v3 时代（iztro 2.5.8 快照 / 518,400 条 / 300 条抽样 / 60 个年份目录）。逐处核验后区分两类：**现行事实陈述失真**（须改）与**历史沿革叙述**（保留——「曾用」「实测确认过」等表述记录的是真实历史）。

另核实两处前批遗留：① SP 批提交信息声称「suites 名脱钩否决理由留档 run.ts」但实际未落——本批补齐；② fixtures/manifest.json 产物仍是生成器旧值（baselineEngine "iztro 2.5.8"）——生成器已改而产物未重导。

## What Changes

- **S1**：`tools/db/export-manual.ts` 两处计数修正（518,400 → 674,976；6,220,800 → 8,099,712 宫次）+ `npm run manual:export` 重导 docs/manual 产物 + `manual:check` 对拍绿。
- **S2**：`build-fixtures` 重跑——新 baselineEngine / source 落进 fixtures/manifest.json（charts.jsonl / raw-rows.json 应逐字节不变，同抽样同内核）。
- **S3**：现行事实陈述的「300 条」→ 385（school/guard.ts、data/wuxing.ts、test/lib/compare.ts 三处）；`test/README.md` 的 2.5.8 叙事两处 v4 化（亮度节开头、fixtures 锁死节标题与升级流程）。
- **S4**：run.ts 补 suites 名脱钩的否决理由留档（静态扫描脆 / nesting 实测不可靠〔引用 reporter.ts:274〕/ 删字段丢最慢榜排除），并把挂账表述更正为「单向脱钩检测已由 repo 层断言覆盖，describe 自由分组不要求全登记为设计边界」。

## What Doesn't Change

- 不动排盘内核、数据集内容、指纹登记（db/dataset 的 sha256 与 MANIFEST.json 零改动）。
- 历史沿革叙述保留（compare.ts 白名单沿革、README 历史案例、reviews/plans 历史档）。
- 亮度提取器重跑逐格验证维持 Deferred（上游 `reference/ziwei-samples-toolkit` 仍不在盘上，恢复条件不变——本轮已复核）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——纯文案、指引与生成物重导，无 spec delta；skip_specs。）
