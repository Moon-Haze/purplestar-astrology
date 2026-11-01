# 断语手册（docs/manual）

从样本库（`db/ziwei.duckdb` / `db/dataset/`，设计样本全集 × 本仓 analysis 内核的
预计算产物）导出的资料集。**本目录全部内容由 `tools/db/export-manual.ts` 生成，
不要手改**——修订断语请改内核 `scripts/analysis/`，重建库（`npm run build:db`）后重导。

```bash
npx tsx tools/db/export-manual.ts all    # 全量重导（topics / combo / geju / db）
```

## 内容与数据血缘

| 产物                       | 内容                                                                             | 源                                                            |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `topics/<key>.md`（13 份） | 13 主题 × 十四主星的静态断语全集（盘面定制动态节不进册），每节标注主星样本盘数   | topics 表（样本全集 × 13 主题文本），按主题主宫主星分组去重   |
| `combo-frequency.md`       | 主星 × 辅煞同宫频率全表（14 × 14 = 196 组合），组合断语矩阵的口径与完备性基线    | palaces 表（样本全集 × 12 宫宫次）                            |
| `geju-audit.md`            | 格局名目对拍：patterns 现库实测名目 vs db 实际渲染过的名目，差集即补判词候选清单 | patterns 现库（抽样 2,000 盘实测）+ topics ⭐ 行              |

## db 模式：同一份内容物化为断语手册库

`npx tsx tools/db/export-manual.ts db` 把手册内容整理物化为 **SQLite 只读库**
`scripts/corpus/data/manual/oracle.db`（行级规范化 + 行文本字典去重，字节可复现，
`npm run manual:check` 对拍）。运行时经 `corpus/data/manual/index.ts` 的
`loadTopicOracle(topic)` 按需查询（`node:sqlite` 只读 + 参数绑定，CLI 主链路零开销）：

```ts
import { loadTopicOracle } from "@/corpus/data/manual/index.ts";
const oracle = await loadTopicOracle("career"); // 主星 → 分类断语集（OracleStar）
```

`types.ts`（`OracleStar` 等组装契约）与 `index.ts`（查询入口）是**手写契约文件**，
不在生成面；断语修订链 = 改内核 → `build:db` → 重导（md 与库同链）。

## 程序消费：knowledge --source oracle

手册数据由 **`knowledge` 命令的 oracle 域**消费（CLI 主链路不静态 import，命令内按需开库，零启动开销）：

```bash
node scripts/purple-star.ts knowledge --source oracle                            # 列 13 主题与用法
node scripts/purple-star.ts knowledge --source oracle --topic career             # 事业主题 14 主星概览
node scripts/purple-star.ts knowledge --source oracle --topic career --star 七杀  # 七杀的分类断语全展开
```

（命令原名 classics，四域合并时改名；旧独立命令 `oracle` 已并入 `--source oracle`，原命令名不再保留。）

## 已知口径与版本注意

- **宫名口径**：库内列值与 `analysis/data.ts` 散表同为紧凑口径（不带「宫」字、「仆役」）；
  内核 `Palace.name` 为项目口径（带「宫」字）。导出工具内的 `compactPalaceKey`
  负责这一处归一——**不要**在导出物里混用两套口径。
- **盘面定制动态节不进册**：第二人称/按盘枚举的节（「针对你的命盘」「四化路径 · 你这盘」
  「四化路径分析 · 落到你这盘」「⚠️ 风险提醒」）与 html 专属块的泄漏（`## ⚙ 主辅煞组合
  精细论断` 等 `##` 族标题块）由导出工具的节黑名单过滤——真实排盘时由内核按当前盘现场生成。
- **只读纪律**：导出工具对库只读（spec §6），SQL 全部固定字面量；运行时查询全参数绑定。
