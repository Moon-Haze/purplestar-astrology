# Proposal

## Why

SP7（v4-narrative-sweep 扫尾派生）：`tools/db/verify-duckdb.ts` 全文硬编码 **synthetic（v3 合成历）** 口径——expected 全集 CTE（`1924 + y` / `range(30)` / `FULL_BUILD_SAMPLES = 518_400`）、drift 重算（`sqlSampleIdExpr(…, "synthetic")`）、`decodeSampleId(id, "synthetic")`、chunk 边界 `sampleId(…, 30, …, "synthetic")` 共 7 处。对 v4 数据集（solar 真实日历 1950–2026 / day 容器 31 / sample_id 按 solar 编码）跑该工具：维度覆盖的期望全集失义、drift 检查全行误报——**实现级 v4 化遗漏**（v4-narrative-sweep 仅修了文案层）。

build 侧已就位：`sample-id.ts` 的 CALIBER 双口径机制 + build-duckdb 按 MANIFEST.calendar 传入。verify 侧缺同款支持。

## What Changes

- `--calendar=synthetic|solar` 参数（usage 行同步）；未提供时按样本量自动探测（518,400 → synthetic / 674,976 → solar，探测结果在报告头自报），两量之外 → 报错要求显式给出（失败可见性）。
- calendar 流入四个 verify 函数：`verifyDimensions`（expected CTE 双口径——solar 用 DuckDB `generate_series(DATE…)` 生成真实日历日 × 12 时辰 × 2 性别，全空间恰为 674,976；drift 重算与 isFullBuild 按口径派生）、`verifySampling`（readSourceRecord 的 decodeSampleId 按口径）、`verifyTopicText`（chunk 边界 sampleId 与 sqlSampleIdExpr 按口径；solar 的 chunk hi 边界用真实月末日）。
- 抽样深度比对在 solar 口径下的语义如实定位：db（本仓内核排盘）vs 源分片（site-repo 引擎排盘）为**双引擎交叉审计**——农历字段是真实外部对拍，星曜/宫名结构差异数据实报告。

## What Doesn't Change

- synthetic 口径行为逐字节不变（v3 库的验证能力保留——CALIBER 双口径机制的原样复用）。
- build-duckdb、sample-id.ts、dataset 内容零改动。
- verify-duckdb 不进任何闸门面（信息级工具定位不变）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——verify-duckdb 无 spec requirement 覆盖，skip_specs。）
