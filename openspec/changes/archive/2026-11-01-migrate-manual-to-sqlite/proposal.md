# Proposal: migrate-manual-to-sqlite

## Why

`scripts/corpus/data/manual/`（断语手册）在 v4 重导后从 4.7 MB 膨胀到 198 MB（42 倍）：v4 样本文本新增「针对你的命盘」等**盘面定制动态节**（168 主辅煞组合矩阵按盘枚举，占各文件 90–94% 行数），节名不匹配 `DYNAMIC_SECTION_RE` 黑名单，被 `classifyOracle` 当静态内容全量收进 TS 生成物——违反导出工具自我声明的「动态节不进数据」设计。直接后果：git pack 膨胀至 394 MiB、下次 `npm run pack` 将产出约 15–20 MB 的 zip、`knowledge --source oracle` 单星展开向用户倒出约 5,300 条盘面枚举噪声行。

根治方向（用户拍板）：**数据形态从「生成 TS 文件」改为「建库期过滤整理后物化的专用 SQLite 只读库，运行时参数化查询」**，规范化拆表承载断语。

## What Changes

- **建库管线**：`tools/db/export-manual.ts` 以 `db` 子命令新增「读样本库 → 节黑名单过滤（补入盘面定制节）→ `classifyOracle` 分类 → 规范化写 SQLite（`node:sqlite`）」管线，产物 `scripts/corpus/data/manual/oracle.db`；`code` 模式（TS 生成）废止。
- **过滤纪律修复**：逐主题甄别 extras 节名，第二人称/按盘枚举节（「针对你的命盘」「四化路径 · 你这盘」等）入 `DYNAMIC_SECTION_RE` 黑名单——此为公共前缀，任何数据形态都必须修。
- **库契约**：规范化拆表（`topics`/`stars`/`texts` 维表 + `lines` 行表 + `patterns`/`sihua` 结构表），行文本字典化去重，字节可复现（同输入两次构建 sha256 相同）。
- **运行时通道**：`corpus/data/manual/index.ts` 的 `loadTopicOracle` 改为 `node:sqlite` 只读打开 + 参数绑定查询 + 行流组装 `OracleStar`；渲染端 `knowledge/sources/oracle.ts` 零改动。
- **BREAKING（仓库内部）**：删除 13 个主题 TS 生成文件（198 MB）；`manual:check` 对拍对象改为「重建库 vs 已提交库 sha256」；引文守卫扫描源从 `.ts` 扩至「从 oracle.db 抽取的行文本」。
- **文档同步**：`AGENTS.md`（zip 体积、`db/` 表格行）、`pack.ts` / oracle 源头漂移注释、`SKILL.md`/`references/` 涉 manual 数据形态处。

## Capabilities

### New Capabilities

- `manual-store`: 断语手册库的物化契约——建库期过滤整理管线、规范化表结构、字节可复现、`study` 别名视图、库缺失报错指路、SQL 参数绑定纪律。承载「手册数据是库不是生成 TS」这一形态决策的全部行为要求。

### Modified Capabilities

- `knowledge-retrieval`: 「重数据懒加载」requirement 的 oracle 通道从 `await import` 生成 TS 改为按需打开 SQLite 查询（懒加载纪律本身不变，加载机制换）。
- `quality-gates`: 「生成物漂移探针」对拍对象从 TS 生成物改为 oracle.db（sha256 对拍）；「引文守卫」扫描面覆盖从库中抽取的行文本（守卫逻辑与台账不变）。

## Impact

- **代码**：`tools/db/export-manual.ts`（管线改造）、`scripts/corpus/data/manual/`（TS 删除、`index.ts`/`types.ts` 改造为查询通道）、`scripts/knowledge/sources/oracle.ts`（加载通道注释与数据来源，渲染逻辑不动）、`test/invariants.test.ts` / `test/citations.test.ts` / `test/cli.test.ts` / `scripts/cli/selftest/*`（断言面迁移重锚）。
- **依赖**：零新增 npm 依赖（`node:sqlite` 为 Node 内置，≥ 22.13 免 flag，本仓门槛 ≥ 22.18）。
- **分发**：`oracle.db` 位于 `scripts/` 内自动进包；zip 实测 1.3 MB → 2.3 MB（库终态 5.9 MB——动态节全量过滤 + `##` 块头泄漏修复后；规划期 5–10 MB 预估按实况修正）；「四项分发」机制不变。
- **验证义务申报**：不触排盘内核（`algorithm`/`mutagen`/`patterns`/`data` 零改动），断语内容修订路径不变（改内核 → `build:db` → 重导）；但删数据文件 + 断言面重构，按最高档执行：`typecheck` + `selftest` + `npm test` 三件套全绿，另跑 `manual:check` 与 `pack`（含解压自检）。

## 不做什么

- **不动排盘内核与 `analysis/` 内容源**：断语修订一律改内核后重导，本 change 只改「整理后的数据住哪、怎么查」。
- **不改 `KnowledgeSource` 接口与四域分发结构**：oracle 域三形态（裸列 / 主题概览 / 单星展开）的输出契约不变。
- **不做 git 历史清理**（filter-repo / LFS）：394 MiB pack 中历史 blob 的处置是独立决策，另行评估。
- **不改 `docs/manual/` md 归档形态**：保留为人读副本与引文抽验面。
- **`combo-frequency.ts` 不入库**：10 KB 保留 TS 形态，迁移收益为零。
- **不改 iztro / lunar-typescript 依赖与 `CACHE_VERSION`**：排盘链路零接触。

## 被否决的备选方案

- **修黑名单后重导 TS（最小方案）**：能回 5–8 MB，但数据形态仍是「库内容导出成 TS 文件」，用户判定此路线本身不合适；且重导即产生 200 MB 级 git blob 的历史债。否决。
- **压缩 JSON / gzip 文件**：体积达标但查询能力为零、git diff 不可读、消费端与对拍全改，收益被 SQLite 全面覆盖。否决。
- **运行时直查现有 DuckDB（641 MB）**：`db/` 不进分发包（skill 自包含破坏）、`@duckdb/node-api` 为平台敏感 native 依赖、库内是未过滤的原始盘文本（噪声本体）。否决。
- **整星 JSON payload（每星 × 主题一行）**：实现最省，但失去行级 SQL 查询能力（跨主题全文检索、按宫/按格局查），用户明确拍板规范化拆表。否决。
