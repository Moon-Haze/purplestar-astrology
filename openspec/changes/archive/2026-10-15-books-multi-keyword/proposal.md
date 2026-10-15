# Proposal: books 古籍检索支持多关键词 AND 匹配

## Why

古籍检索（`knowledge --search`，books 域）目前是**单串子串匹配**：查「紫微 化权」
会拿整串去做 `indexOf`，几乎必然零命中。而解读时常见的查证需求恰恰是跨概念的——
「七杀 + 化权同段怎么说」「紫微 + 火星怎么论」——单关键词要么命中过泛（「紫微」满盘皆准），
要么因组合整串不存在而零命中。多关键词 AND 是最小且无歧义的增强：所有词出现在同一段
才算命中，既收窄又可组合。

## What Changes

- `scripts/corpus/index.ts` 的 `searchClassics`：检索词按空白分词，**全部词命中同一段**
  才算 hit；单词检索行为**逐字不变**（分词后长度为 1 即原路径）。
- snippet 高亮取**最早出现**的那个关键词做上下文窗口（原来是整串）。
- 帮助文案（`scripts/cli/commands/command-meta.ts`）与样例表（`tools/cli-samples.ts`）
  同步说明多关键词用法。
- selftest 古籍段新增一条多关键词断言（既有单关键词断言不动）。

### 定性：内容扩展，非内核改动

改动全部落在 `corpus/`（知识内容层）与 CLI 文案层，**不触碰排盘内核**
（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` / `wenmo-brightness.ts`），
不涉及内核导出形状，无需同步 `kernel-contract.test.ts`，也不必重跑内核回归。
闸门按内容扩展口径跑：selftest（古籍段在列）+ `npm test`（仓库自洽层盯样例表）。

### 不做什么

- **不动 stars / tianji / oracle 三域**——它们的 `--search` 语义各自不同
  （星名精确查、判语子串），多关键词 AND 对它们没有等价价值，本变更不碰。
- **不引入 OR / 否定 / 引号短语等检索语法**——只做空白分词 + AND，语法复杂化
  会连坐帮助文案、样例表与 selftest 断言，收益不成立。
- **不改排序与 limit 语义**——命中顺序仍是按书 → 章节 → 段落遍历序，limit 仍是硬上限。
- **不碰 `--limit` 默认值与输出板块形态**。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `knowledge-retrieval`: 「四域统一检索」中的 books 行为从单串子串匹配扩展为
  空白分词多关键词 AND（单词行为不变）。

## Impact

- 代码：`scripts/corpus/index.ts`（`searchClassics`）、
  `scripts/corpus/selftest-asserts.ts`（新增断言）、
  `scripts/cli/commands/command-meta.ts`（帮助一行）、`tools/cli-samples.ts`（新增样例）。
- 兼容性：单关键词调用方（含既有样例、selftest 既有断言）行为不变；
  唯一行为变化是「含空白检索词」从几乎必然零命中变为分词 AND——该形态此前
  无任何合法用法依赖。
- 生成物：`docs/cli-samples.md` 由样例表再生。
