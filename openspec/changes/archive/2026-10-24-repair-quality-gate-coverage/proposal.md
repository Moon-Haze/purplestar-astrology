# Proposal

## Why

架构评审 2026-10-24（候选 B1 + S5，两处运行时实锤）：`skipUnlessRepo` 的判据是「包根有没有 `CLAUDE.md`」，但该文件已在 5afe256 删除——仓库态与分发态在守卫眼里不可区分，「文档一致性」断言自删除之日起从不运行（仓库态 selftest 恒显 ⏭ 且记 pass），`quality-gates` 承诺的「仓库 0 跳过」失真；且探针（kit.ts:161）与断言体读取对象（guard.ts:167）是两处独立写死的同一已删文件，只改判据会当场 ENOENT。另：引文守卫 `.ts` 扫描面写死 `scripts/` 全树，而带引文的代码已长到声明根之外——`tools/corpus/import-tianji.ts`（引文密度最高的工具）不在任何扫描根内，`.md` 侧扫全仓而 `.ts` 侧只扫 scripts/，同一守卫两侧覆盖不对称。

## What Changes

- 判据锚点替换：`skipUnlessRepo` 探针从 `CLAUDE.md` 换为 `AGENTS.md`（与 README / test/ 等仓库级文档同进退的现存锚点）；guard.ts 断言体读取对象同步换现行文档
- 反恒真断言：`test/repo.test.ts` 补「仓库态 selftest 报告不允许出现 ⏭」——把「仓库 0 跳过」从口号钉回事实
- 文档陈述同步：AGENTS.md 与 docs/code/cli-selftest.md 中「判据是 CLAUDE.md」的三处陈述改写
- 引文守卫 `.ts` 扫描面扩展：`test/citations.test.ts` 补一组以仓库根为扫描根的 `.ts` 扫描（与流派分派组并列，收集器自动排除 node_modules / 点目录；与 `.md` 侧全仓扫描对称）
- 扩面前置核查：tools/ 与 test/ 现存「倪师 / 倪海厦」形态逐条比对核对表——表内者放行，表外者先登记 `analysis/grades.ts` 或改写文案，再扩面

## What Doesn't Change

- **三层验证结构与 selftest 三段设计不动**；跳过机制本身不动（`skipUnlessRepo` 单点、⏭ 可见、不给随包分发的断言加跳过——三条纪律原样保留，只换判据锚点）
- **.md 侧扫描不动**；流派分派组（`citationRoots` 按流派扫描）不动——仓库级 `.ts` 组是并列新增，不取代流派维度
- **「文档一致性」断言的检查内容不趁机扩权**——读取对象换现行文档，断言逻辑（Node 下限 / 独占分支 / 升级警告）原样恢复运行
- 引文纪律本体（挂倪师引语须登记核对表）不动；扩面只让既有纪律覆盖到真实分布

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `quality-gates`: 「跳过必须可见」需求判据句从 `CLAUDE.md` 改为 `AGENTS.md`（并补「仓库态不得出现跳过」的反恒真 scenario）；「引文守卫」需求扫描面从「`scripts/` 全树」扩为「仓库 `.ts` 全树（流派分派组之外另有仓库级组）」

## Impact

- 代码：`scripts/cli/selftest/kit.ts`（判据）、`scripts/cli/selftest/guard.ts`（断言体读取对象）、`test/repo.test.ts`（反恒真断言）、`test/citations.test.ts`（仓库级 .ts 组）、`analysis/grades.ts` 或 tools 文案（扩面前置核查的产出）
- 文档：AGENTS.md、docs/code/cli-selftest.md（判据陈述同步）
- 行为：仓库态 selftest 的「文档一致性」断言恢复运行（⏭ 消失）；tools/ test/ 的未登记引文（若有）变红
