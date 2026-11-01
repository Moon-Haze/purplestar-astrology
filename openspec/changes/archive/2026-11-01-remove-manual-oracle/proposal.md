# Proposal: remove-manual-oracle

## Why

断语手册（manual / oracle 域）经三轮数据形态迭代（v1 外部文本 TS → v2 SQLite 物化 → v3 内核直出语义列）仍未达到可用状态：v1 措辞源头在外部数据源仓（修订链断裂）、v2/v3 的直出与建库链路重（518k 盘直出 2.4h 级）而检索价值有限（knowledge 已有 books 古籍 / stars 星曜 / tianji 天纪三域承载引证）。用户拍板：**断语手册全线删除**，knowledge 收敛为三域。

## What Changes

- **BREAKING**：`knowledge --source oracle` 检索域整体下线（四域 → 三域：books / stars / tianji）。
- 删除断语手册全部载体：`scripts/corpus/data/manual/`（oracle.db / index.ts / types.ts）、
  `scripts/knowledge/sources/oracle.ts` 及注册行、`docs/manual/topics/` md 归档、
  `tools/db/export-manual.ts` 的 `topics` / `db` 子命令（保留 `combo` / `geju` 格局完备性基线）、
  `generate-shards` 的 `items` 结构化字段（断语直出失去消费方）、`samples-out/` 直出产物。
- 删除随库断言：citations 库抽取扫描组、invariants san-fang 宫名域断言与键集互证的 manual 项、
  cli.test / selftest 的 oracle 断言。
- 同步文档：SKILL.md（四域→三域）、references、AGENTS.md、docs/code/knowledge.md、docs/manual/README。
- specs 折回：`knowledge-retrieval` 四域改三域、`manual-store` 整体 REMOVED、
  `quality-gates` 引文守卫回退纯文本扫描面、漂移探针去除库通道。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `knowledge-retrieval`: 「四域统一检索」改三域——`--source` 取值域删 `oracle`；「重数据懒加载」
  去除 oracle 通道描述；「命令优先于读源码」的主题断语 scenario 移除。
- `quality-gates`: 「引文守卫」回退纯文本扫描面（删库抽取段）；「生成物漂移探针」产物范围
  回退为 docs/manual 的 md（combo / geju），库 sha256 通道移除。
- `manual-store`: 整体 REMOVED（断语手册库能力下线）。

## Impact

- **代码**：`scripts/knowledge/`（registry + oracle.ts）、`scripts/corpus/data/manual/`（整目录）、
  `tools/db/export-manual.ts`（topics/db 子命令）、`tools/db/generate-shards.ts`（items 字段）、
  `test/citations.test.ts` / `test/invariants.test.ts` / `test/cli.test.ts`、`scripts/cli/selftest/`。
- **数据**：`scripts/corpus/data/manual/oracle.db`、`docs/manual/topics/`、`samples-out/`（直出产物，
  磁盘约 1GB）。
- **验证义务**：内核或依赖级改动——`typecheck` + `selftest` + `npm test` 三件套；`manual:check`
  （回退后仅 md 通道）与 `pack` 终验。

## 不做什么

- **不动古籍 / 星曜 / 天纪三域**：`citation-core` 保留（引文守卫的比对核心，test 与 `.md` 扫描仍用）；
  `combo-frequency.md` / `geju-audit.md` 保留（格局完备性基线，非断语手册）。
- **不动排盘内核**：`analysis/` 的内容表（STAR_BRIEF、BranchedContent 等）继续服务 `--topic`
  运行时论断——删除的只是「预计算断语手册」这条快照检索线，运行时论断能力不受影响。
- **不做 git 历史清理**：independent decision，另行评估。

## 被否决的备选方案

- **仅删运行时检索域、保留 md 归档**：md 是断语手册的文档形态，能力下线后成孤儿资料，留则
  误导（README 描述的 db 模式已不存在）。用户拍板全线删。否决。
- **保留直出 items 字段备将来**：无消费方的字段是死重，且直出成本 2.4h 级；将来需要时从
  git 历史可恢复。否决。
