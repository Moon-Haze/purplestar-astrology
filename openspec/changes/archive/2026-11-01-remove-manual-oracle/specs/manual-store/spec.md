# Spec Delta

## REMOVED Requirements

### Requirement: 动态节不入库
**Reason**: 断语手册库整体下线（remove-manual-oracle）——预计算快照检索线经三轮数据形态
迭代（外部文本 TS → SQLite 物化 → 内核直出语义列）后判定价值不抵维护成本，knowledge
收敛为古籍 / 星曜 / 天纪三域；主题论断由 `astrology --topic` 运行时推算承载。
**Migration**: 断语材料改用 `astrology <出生信息> --topic <key>` 现场推算；古籍引证走
`knowledge --search`，天纪判语走 `knowledge --source tianji`。

### Requirement: 断语行级规范化承载
**Reason**: 同上——断语手册库下线，规范化 schema 无承载对象。
**Migration**: 同上。

### Requirement: 库字节可复现
**Reason**: 同上——库产物不复存在。
**Migration**: 无（构建产物已从仓库与分发面移除）。

### Requirement: study 别名视图
**Reason**: 同上——库查询通道下线。
**Migration**: `study` 主题的论断走 `astrology --topic study`（运行时别名视图仍在内核）。

### Requirement: 库缺失报错指路
**Reason**: 同上——库通道下线，无缺失态。
**Migration**: 无。

### Requirement: 库查询参数绑定
**Reason**: 同上——运行时无库查询。
**Migration**: SQL 参数绑定纪律在 `tools/db` 的 DuckDB 工具链继续适用（spec §6 既有约束）。
