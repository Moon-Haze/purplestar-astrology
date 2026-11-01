# 格局基线（docs/manual）

从样本库（`db/ziwei.duckdb` / `db/dataset/`）导出的**格局完备性基线**。**本目录全部内容由
`tools/db/export-manual.ts` 生成，不要手改**——修订断语请改内核 `scripts/analysis/`，
重建库（`npm run build:db`）后重导。

```bash
npx tsx tools/db/export-manual.ts all    # 全量重导（combo / geju）
```

## 内容与数据血缘

| 产物                | 内容                                                                             | 源                                                            |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `combo-frequency.md`| 主星 × 辅煞同宫频率全表（14 × 14 = 196 组合），组合断语矩阵的口径与完备性基线    | palaces 表（样本全集 × 12 宫宫次）                            |
| `geju-audit.md`     | 格局名目对拍：patterns 现库实测名目 vs db 实际渲染过的名目，差集即补判词候选清单 | patterns 现库（抽样 2,000 盘实测）+ topics ⭐ 行              |

（断语手册已随 remove-manual-oracle 下线：主题论断由 `astrology <出生信息> --topic <key>`
运行时推算承载，不再有预计算快照。）

## 已知口径

- **宫名口径**：库内列值为紧凑口径（不带「宫」字、「仆役」）；内核 `Palace.name` 为
  项目口径（带「宫」字）。导出工具内的 `compactPalaceKey` 负责归一。
- **只读纪律**：导出工具对库只读（spec §6），SQL 全部固定字面量。
