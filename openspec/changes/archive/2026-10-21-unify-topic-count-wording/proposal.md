# Proposal

## Why

主题 key 的基数字面向用户自相矛盾：`astrology --topic` 报错自报 **14**（派生自
`Object.keys(TOPIC_LABEL).length`），而 `knowledge --source oracle --topic` 报错写死
**13** 却在同一条消息里列出 **14** 个键；`help` 里 `--topic` 的描述也写死「13 个 key
之一」。

更糟的是这个错数被断言钉死：`scripts/cli/selftest/commands.ts` 与 `test/cli.test.ts`
各有一处断言要求报错消息包含 `13 个之一`——修文案就会撞断言，而断言在替错数站岗。

仓库自己已经两次标记过它（`docs/reviews/architecture-review-20261016.md:183` 记「13 个主题」
注释漂移、`docs/plans/2026-10-12-extensibility-roadmap-plan.md:368` 写明「CLI 两处写死
「13 个主题」的字面量改为 `Object.keys(TOPIC_LABEL).length` 派生」），至今未落地。
`quality-gates` 的「计数类事实不写死」早已要求「不得在文档或代码里写死数字」，此处是
**规则已在、代码违反**。

## What Changes

- `scripts/cli/knowledge/oracle.ts` 的非法主题报错改为**自报**（`Object.keys(TOPIC_LABEL).length`，
  该文件已 import `TOPIC_LABEL`，零新增依赖）
- `scripts/cli/args/table.ts` 的 `--topic` 描述**不再给数字**（保持该模块「零依赖纯数据」的
  既有性质，详见 design.md D2）
- `scripts/cli/selftest/commands.ts` 与 `test/cli.test.ts` 的两处断言由「消息含 `13 个之一`」
  改为「消息自报的数与实际键集长度一致」——断言盯**一致性**，不再钉字面量
- `scripts/cli/selftest/args.ts` 的注释措辞同步
- `references/options.md`、`references/workflow.md`、`references/output-contract.md` 的口径
  同步：说清「13 个独立主题 + 学业科名（官禄宫别名视图）= CLI 14 个 key」这一事实
- 澄清一处语义：14 个 key 中 `study`（学业科名）是**别名视图**（复用 `career` 的官禄宫内容、
  无独立存储列），故「14 个主题」措辞不严谨，本次不推广重构，但文档口径必须写准

**明确不做**：

- **不动 `--report` 的 13 个板块**：`--report` 的板块集合与顺序是**产品口径**（财运在事业前、
  性格在感情后），与主题 key 集合不是一回事，属契约固定数，不在自报范畴
- **不动解读五节、十二宫、十四主星**等同理：契约固定的结构数
- **不重构「主题」→「key」的措辞**：只统一计数来源，不改用户认知里的名词
- **不改 `TOPIC_KEYS` 本身**：本次只修文案与断言的取数来源，不增删主题
- **不追改 `docs/plans/` 与 `docs/reviews/` 的历史快照**：按 `docs/README.md` 的口径，日期
  文件名即内容快照
- **不碰排盘内核、语料、体系口径**：本改动是 CLI 文案层 + 文档层

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `quality-gates`：「计数类事实不写死」补上两类计数的边界——**集合基数**（可增删的集合，
  如主题 key 数）必须自报派生、不得写死；**契约固定数**（解读五节、`--report` 板块数、
  十二宫等）允许写死但须是显式登记的产品口径。并把适用范围明确到面向用户的文案
  （help 描述、错误信息、文档）。

## Impact

- **代码**：`scripts/cli/knowledge/oracle.ts`（报错文案）、`scripts/cli/args/table.ts`
  （`--topic` 描述）、`scripts/cli/selftest/commands.ts` 与 `scripts/cli/selftest/args.ts`
  （断言与注释）
- **测试**：`test/cli.test.ts`（一处断言）——断言内容改动，**不新增测试文件**，故
  `test/README.md` 层表与 `test/lib/run.ts` 的 `LAYERS` 无需变动
- **文档**：`references/options.md`、`references/workflow.md`、`references/output-contract.md`
- **可见行为变化**：`knowledge --source oracle --topic <非法值>` 的报错由「13 个之一」改为
  自报数（现为 14）；`help` 中 `--topic` 描述不再给具体数字。其余输出不变
- **不涉及**：`--json` 的结构、`--report` 的板块、解读契约的章节顺序、zip 分发面
- **验证面**：属**内容/文案层**改动，不触排盘内核，但**改动了 selftest 与 npm test 的断言**，
  故三层闸门全跑：`npm run typecheck` · `selftest` · `npm test`（引用守卫扫 `references/`
  手写 md，改动仍受其约束）
