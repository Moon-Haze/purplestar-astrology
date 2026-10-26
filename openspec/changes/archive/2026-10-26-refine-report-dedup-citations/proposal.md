# Proposal

## Why

`--report` 全盘报告（实测样本 74 KB）存在两类质量缺陷。**冗余**：「当前大限」节在 13 个板块逐字相同（`renderDecadal(ctx)` 只依赖 `chart.currentDx`、与主题无关），同一段主星论断经「三方四正联动」的 `fullContent` 全文复引最多出现 4–5 次。**错关联**：经典出处按主星名纯子串全局检索（`topicCitations` 的 `p.text.includes(star)`），召回与该宫论断无关的引文——实测健康节（疾厄宫天同）挂着职业适配「机月同梁格」引文，本盘并不成此格；子女节首条引文是巨门开头的段落。报告是交付物形态：冗余稀释信息密度，错关联引文构成事实层误导。

## What Changes

- **大限节唯一**：`--report` 装配层把「当前大限」从 13 个板块各渲染一遍改为全报告只出一处（具体落位——文档头后独立节或首板块内——由 design 裁决），各主题节内不再重复。
- **跨节全文去重**：星曜 × 宫位论断全文在报告内**首现给全文，复现处降级**为「星曜徽标 + 一行指引（指回首现板块）」。`--topic` 单主题输出不受影响（词典式全文在单主题查询场景是特性）。
- **引文语境过滤**：`topicCitations` 的全局检索加语境条件——候选段落须同时命中主星名与该宫语境词（宫名或宫位主管领域词），不满足则少给；维持既有纪律「查不到就省略、不凑数」，宫位专章优先策略不变。
- **不做什么**：不动 `scripts/analysis/data.ts` 语料文本与 `--topic` 单主题输出形态（全分支罗列的语料级根治由 change `structure-content-branches` 承接）；不动 13 板块顺序、文档头字段、尾注三行（产品口径，冻结不动）；不动排盘内核（`algorithm/` / `mutagen/` / `patterns/` / `data/` / `wenmo-brightness.ts`）。

## Capabilities

### New Capabilities

- `report-assembly`: `--report` 产物的**文档级装配行为**——13 板块顺序与文档头骨架、跨节去重（大限节唯一 / 论断全文首现原则）、经典出处的检索策略与相关性约束、知识来源分级尾注。这些行为此前散落在 `references/output-contract.md` 的描述与实现里、无规范承载；本 change 将其收编为显式需求并新增去重与相关性两条行为约束。

### Modified Capabilities

（无——`interpretation-contract` 的「报告形态原样转发、篇幅不限」约束不变，本 change 只改 CLI 产物的装配行为，不改模型交付行为的任何需求。）

## Impact

- **代码**：`scripts/cli/commands/report.ts`（`buildReport` 跨节去重编排、`topicCitations` 语境过滤）；`scripts/analysis/report.ts`（`getTopicReport` 增装配层可选参数以支持去重模式，`--topic` 路径默认行为不变）。
- **文档**：`references/output-contract.md` 报告形态的「每节小节流」描述同步——`SKILL.md` ↔ `references/` 双向一致守卫盯住此处。
- **测试与生成物**：报告相关断言（`test/astrology-sections.test.ts` 等）更新；`docs/cli-samples.md` 与 `tools/samples/` 生成物按生成器重导（生成文件不手改）。
- **验证义务**：装配层改动，不触排盘内核、不触语料数据——`npm run typecheck` + `node scripts/purple-star.ts selftest` 必跑；报告文本变化不改排盘行为，`npm test` 基准不受影响，但 selftest 的 `SKILL.md` ↔ `references/` 一致性断言与 cli-samples 产物守卫会被牵动，tasks 逐项列明。
