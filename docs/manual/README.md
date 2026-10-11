# 断语手册（docs/manual）

从样本库（`db/ziwei.duckdb` / `db/dataset/`，518,400 设计样本 × 本仓 analysis 内核的
预计算产物）导出的资料集。**全部内容由 `tools/db/export-manual.ts` 生成，不要手改**——
修订断语请改内核 `scripts/ziwei/analysis/`，重建库（`npm run build:db`）后重导。

```bash
npx tsx tools/db/export-manual.ts all    # 全量重导（topics / combo / geju / code）
```

## 内容与数据血缘

| 产物                       | 内容                                                                             | 源                                                            |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `topics/<key>.md`（13 份） | 13 主题 × 十四主星的静态断语全集（动态节不进册），每节标注主星样本盘数           | topics 表（51.84 万盘 × 13 主题文本），按主题主宫主星分组去重 |
| `combo-frequency.md`       | 主星 × 辅煞同宫频率全表（14 × 14 = 196 组合），组合断语矩阵的口径与完备性基线    | palaces 表（622 万宫次）                                      |
| `geju-audit.md`            | 格局名目对拍：patterns 现库实测名目 vs db 实际渲染过的名目，差集即补判词候选清单 | patterns 现库（抽样 2,000 盘实测）+ topics ⭐ 行              |

## code 模式：同一份内容合并进代码

`npx tsx tools/db/export-manual.ts code` 把手册内容整理成 **TS 数据文件**，落到
`scripts/ziwei/analysis/manual/`（与 md 版同源同生成链；**生成快照**，不在
`analysis/index.ts` 公开面上，引文守卫对其语义化排除）：

- `<topic>.ts` × 13：`ORACLE: Record<主星, OracleStar>`（每主题一份，避免单文件数 MB）
- `types.ts`：`OracleStar` / `SanFangEntry` / `SihuaEntry` 结构定义
- `combo-frequency.ts`：`COMBO_FREQUENCY: { star, aux, count }[]`（196 组合）
- `index.ts`：`loadTopicOracle(topic)` 按主题**懒加载**入口

CLI 主链路不 import 这些文件（零启动开销），需要消费时动态引入：

```ts
import { loadTopicOracle, COMBO_FREQUENCY } from "@/ziwei/analysis/manual/index.ts";
const oracle = await loadTopicOracle("career"); // 主星 → 分类断语集
```

生成物带 DO-NOT-EDIT 头，**不要手改**；改内核断语 → `npm run build:db` → 重导。

## 程序消费：oracle 命令

手册数据由 **`oracle` 命令**消费（CLI 主链路不静态 import，命令内动态加载，零启动开销）：

```bash
node scripts/purple-star.ts oracle              # 列 13 主题与用法
node scripts/purple-star.ts oracle career       # 事业主题 14 主星概览（格局数/断语数）
node scripts/purple-star.ts oracle career 七杀   # 七杀的分类断语全展开
```

代码内消费走 `loadTopicOracle(topic)`（同目录 `index.ts`，按主题懒加载）。

## 已知口径与版本注意

- **宫名口径**：库内列值与 `analysis/data.ts` 散表同为紧凑口径（不带「宫」字、「仆役」）；
  内核 `Palace.name` 为项目口径（带「宫」字）。导出工具内的 `compactPalaceKey`
  负责这一处归一——**不要**在导出物里混用两套口径。
- **版本落后**：现库建于 2026-09-26，早于三合标签修复（407bc06）。导出时已过滤
  `▍` 结构行规避错位标签。**重建库后重导**，其余文本随之刷新。
- **只读纪律**：导出工具对库只读（spec §6），SQL 全部固定字面量，无用户输入拼接。
