# 断语手册（docs/manual）

从样本库（`db/ziwei.duckdb` / `db/dataset/`，518,400 设计样本 × 本仓 analysis 内核的
预计算产物）导出的资料集。**全部内容由 `tools/db/export-manual.ts` 生成，不要手改**——
修订断语请改内核 `scripts/ziwei/analysis/`，重建库（`npm run build:db`）后重导。

```bash
npx tsx tools/db/export-manual.ts all    # 全量重导（topics / combo / geju）
```

## 内容与数据血缘

| 产物 | 内容 | 源 |
| --- | --- | --- |
| `topics/<key>.md`（13 份） | 13 主题 × 十四主星的静态断语全集（动态节不进册），每节标注主星样本盘数 | topics 表（51.84 万盘 × 13 主题文本），按主题主宫主星分组去重 |
| `combo-frequency.md` | 主星 × 辅煞同宫频率全表（14 × 14 = 196 组合），组合断语矩阵的口径与完备性基线 | palaces 表（622 万宫次） |
| `geju-audit.md` | 格局名目对拍：patterns 现库实测名目 vs db 实际渲染过的名目，差集即补判词候选清单 | patterns 现库（抽样 2,000 盘实测）+ topics ⭐ 行 |

## 已知口径与版本注意

- **宫名口径**：库内列值与 `analysis/data.ts` 散表同为紧凑口径（不带「宫」字、「仆役」）；
  内核 `Palace.name` 为项目口径（带「宫」字）。两侧经 `compactPalaceKey` 归一
  （`analysis/lookups.ts`）——**不要**在导出物里混用两套口径。
- **版本落后**：现库建于 2026-09-26，早于三合标签修复（407bc06）与散表宫名口径修复
  （compactPalaceKey）。导出时已过滤 `▍` 结构行规避错位标签；但库内文本仍是修复前的
  渲染形态（非命宫主星详解当时未渲染，只落简述行）。**重建库后重导**，非命宫段落会
  丰富为完整详解。
- **只读纪律**：导出工具对库只读（spec §6），SQL 全部固定字面量，无用户输入拼接。
