# Design

## Context

主题键有两套数，来源不同：

- `scripts/analysis/data.ts` 的 `TOPIC_KEYS` = **14 个运行时 key**（含 `study`）
- `study`（学业科名）是**别名视图**：复用 `career` 的官禄宫内容、无独立存储列
  （`STORAGE_TOPIC_KEYS` 因此不含它）——故独立主题是 **13** 个，也正是 `--report` 的
  13 个板块数

CLI 现状：`astrology` 的裸开关清单与非法主题报错都从 `Object.keys(TOPIC_LABEL).length`
自报（= 14）；`knowledge --source oracle` 的报错与 `help` 的 `--topic` 描述写死「13」。
`TOPIC_LABEL` 由 `TOPIC_KEYS` 投影而来，故两数同源、必有一处漂移。

仓库既有裁决：`docs/plans/2026-10-12-extensibility-roadmap-plan.md:368` 已写明
「CLI 两处写死「13 个主题」的字面量改为 `Object.keys(TOPIC_LABEL).length` 派生」。

## Goals / Non-Goals

**Goals:**

- 面向用户的计数一律同源派生，写死之处清零
- 断言从「钉字面量」改为「盯自报数与实际集合一致」
- 文档口径写准：13 独立主题 / 14 个 CLI key / 13 个报告板块，三者分清

**Non-Goals:**

- 不增删主题，不改 `TOPIC_KEYS`
- 不把「主题」一词全局改成「key」（用户认知成本大于措辞精确性的边际收益）
- 不动 `--report` 板块数、解读五节等契约固定数
- 不追改历史快照（`docs/plans/`、`docs/reviews/`）
- 不动排盘内核、语料、体系口径

## Decisions

### D1 计数来源唯一：`Object.keys(TOPIC_LABEL).length`

`TOPIC_LABEL` 由 `TOPIC_KEYS` 投影（`projectTopicField`），故 `Object.keys(TOPIC_LABEL).length`
恒等于运行时 key 数，且与 `astrology` 侧已用的表达式**逐字同源**——两条路径不可能再各说各话。
`cli/knowledge/oracle.ts` 已 import `TOPIC_LABEL`，本改动零新增依赖。

### D2 `cli/args/table.ts` 的描述不派生数字，只去掉数字

该模块是**零依赖纯数据**（参数声明表的唯一来源，每个命令都加载它）。要让 desc 自报就得
import `@/analysis` 的主题数据集——那是重数据，会给所有命令的参数解析拖进整份数据集。
备选与否决理由：

- (a) 引入依赖派生数字 → 否决：破坏「零依赖纯数据」，拖重依赖
- (b) 保留写死数字 → 否决：仍是写死，漂移风险原样
- (c) **desc 不给数字，指向权威清单**（裸开关运行时报清单，自报）→ 采用

用户并未因此失去信息：`astrology --topic` 裸开关会列出全部 key 并报总数，非法值报错也自报数。

### D3 断言盯「自报数 == 集合实际长度」，不钉字面量

`scripts/cli/selftest/commands.ts` 与 `test/cli.test.ts` 两处改法一致：断言消息中出现的
数量（由 `TOPIC_KEYS.length` 派生出的串）存在且等于实际集合长度。

这比原断言**不弱**：oracle 若退回写死「13 个之一」，派生出的「14 个」不出现，断言失败；
若消息干脆不给数，同样失败。追加一条交叉断言：oracle 与 astrology 两条路径的自报数相同。

### D4 文档口径写成「13 独立主题 + 学业科名别名视图 = 14 个 key」

`references/` 三处把「13 主题 / 十三主题」这类模糊表述改为**不写死数字 + 点明别名视图**，
读者按 `--topic` 裸开关清单看即可。`--report` 的「13 个板块」是契约固定的产品口径，保留
不动（`output-contract.md` 里「财运在事业前、性格在感情后是产品口径」同段不动）。

### D5 术语不动，只在文档点明

astrology 报错仍写「N 个主题」（N 自报）。「14 个主题」严格说不准（其中一个是别名视图），
但全局改词牵动用户认知与解读契约，收益不抵成本——只在 `references/` 把事实说准。

## Risks / Trade-offs

- **R1 断言强度** → 改后仍能捕获三类回归（数字写错、漏数字、两路径不一致），并在 D3 的
  交叉断言加持下不弱于原断言
- **R2 `references/` 改动进入引文守卫扫描面** → 本次只改计数表述、不含引文；仍按纪律跑
  `npm test`（层 7 引文守卫）确认
- **R3 help 里不再给数量，用户少一个参照** → 裸开关清单与报错自报数承接，权威清单本就在
  运行时
- **R4 术语不统一的遗留**（astrology 仍称「主题」而实际含别名视图 key）→ 接受；`references/`
  已把事实写准，术语统一另起 change 再议
- **R5 未来加主题时 `references/` 的「不写死数字」表述是否仍准确** → 表述不含数字，天然不漂移
