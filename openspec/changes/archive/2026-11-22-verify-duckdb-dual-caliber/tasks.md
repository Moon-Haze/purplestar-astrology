# Tasks

## 1. 实现

- [ ] 1.1 `--calendar` 参数解析（synthetic|solar 校验 + 按样本量自动探测 + 报告头自报）与 usage 行更新
- [ ] 1.2 calendar 流入 verifyDimensions：expected CTE 双口径（solar 用 generate_series 真实日历日）+ drift/isFullBuild 按口径
- [ ] 1.3 calendar 流入 verifySampling / readSourceRecord / verifyTopicText（decode、chunk 边界含真实月末日）
- [ ] 1.4 solar 口径下抽样深度比对的语义定位（双引擎交叉审计，报告如实）

## 2. 验收

- [x] 2.1 solar 口径实跑当前 ziwei.duckdb：总量/维度覆盖（缺失=0、674,976 全空间）/四化一致性全 PASS，drift=0
- [x] 2.2 synthetic 口径回归不变（如可构造）
- [x] 2.3 抽样深度比对（--src=db/tar-shards）：双引擎差异据实报告并定位语义（50 条输入侧全一致；引擎侧 551 处对照差异据实列报）
- [x] 2.4 typecheck 0 错误 / eslint-prettier 过 / openspec validate --all 零失败

## 3. 已知限制（如实登记）

- [x] 3.1 **文本对账在 solar 口径下 OOM**（DuckDB 1.8 GiB 上限 vs topics parquet 927 MiB 的 BETWEEN 扫描）——v4 全量文本对拍需更大内存或按 topics 文件 id 分段裁剪视图（下一批实现项）；本批如实 FAIL 不粉饰。synthetic 口径不受影响。
- [x] 3.2 抽样深度比对的 chart 侧引擎级差异（551 处/50 条）属 site-repo 引擎与本仓内核的安星对照信息——数据集 chart 列为本仓内核输出（build-duckdb v4 现排），基准对拍口径不受影响。
