# extensibility Specification

## Purpose

让**新增知识内容**（古籍、主题断语、新流派）不触碰排盘内核与 CLI 分发。
增长预期 90% 来自内容而非新排盘领域，因此扩展性投资优先押在内容层。
四条架构决策（ADR-001 ~ ADR-004）全部 Accepted，是本仓不可自行推翻的取舍。

## Requirements

### Requirement: 单 skill 形态，不引外部包（ADR-001）

插件 SHALL 以**仓库内目录 + 注册表**形式存在，不拆 npm 子包、不引插件市场。
目标是守住「拷贝 + `npm install`」的分发形态与 typecheck 的静态可验证性。

代价已知并接受：插件不能与主仓独立版本化、独立发布（当前不需要）。

#### Scenario: 新增内容

- **WHEN** 需要加一部古籍或一个新流派的判语
- **THEN** 在仓库内加文件 + 注册表加一行，不引入外部依赖包，不改变分发形态

### Requirement: 清单注册而非文件系统发现（ADR-002）

每个插件层 SHALL 用一个 `registry.ts` **显式 import** 各插件模块，不用 glob / 文件系统自动发现。
理由：本仓无构建步骤、`@/` 在运行时解析，且已有「磁盘推导」（`ALL_SKILLS`）与
「静态注册」（`COMMAND_TABLE`）两套先例，选择与之一致的哲学。

代价已知并接受：比自动发现多一行样板。漏注册由 typecheck 兜底。

#### Scenario: 注册表漏项

- **WHEN** 实现了插件但忘记在注册表登记
- **THEN** typecheck 报错（注册表键与源标识的类型不一致），而非运行时才暴露

### Requirement: 内核与内容严格分层（ADR-003）

排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` / `wenmo-brightness.ts` /
`types.ts`）与知识内容（`analysis/` / `corpus/` / `synastry/`）SHALL 严格分层。

插件层 SHALL **禁止反向依赖 `cli/`**，SHALL **禁止修改内核模块状态**。
内核只暴露纯函数供插件消费。跨流派共享的底座数据（干支 / 四化 / 亮度）留在 `data/`，
**流派特有**内容归插件。

#### Scenario: 加内容不重跑内核回归

- **WHEN** 新增一个知识源或主题断语
- **THEN** 排盘内核回归（`selftest` 排盘段 / `npm test`）不必重跑

#### Scenario: 插件反向依赖

- **WHEN** 插件层 import 了 `cli/` 下的模块
- **THEN** 视为破坏分层，须改由内核暴露纯函数

### Requirement: 流派作为一等扩展点，引文守卫随流派（ADR-004）

`SchoolAdapter` SHALL 自带 `citationRoots`，声明该流派的扫描根与权威语料核对表。
引文守卫按流派分别扫描各自插件目录，核对表随插件走，**不再有全局单一核对表**。

多流派隔离的含义：每个流派只对自己声明的核对表负责，不拿别人的核对表审自己的内容。
绊线语义从「硬编码字段」升级为「适配器声明」——`forbiddenFeatures` 取代散落的禁用判断。

#### Scenario: 加新流派

- **WHEN** 需要支持第二种流派口径
- **THEN** 写 `schools/<id>.ts` + 注册表加一行，**不改排盘内核**，也不污染既有流派的引文纪律

#### Scenario: 核对表错配

- **WHEN** 两个流派各自的内容被对方核对表审到
- **THEN** 不允许——各流派只扫自己的 `scanRoot`、只用自己声明的核对表

### Requirement: 插件引用而非迁移

插件 SHALL **引用**内核数据（亮度表、四化表、引文核对表），SHALL NOT 持有副本。
副本必然随内核演进而漂移。

落地方式：`SchoolAdapter.citationRoots[].checklist` 直接引用内核的全局唯一 `ANNOTATIONS`；
`defaultBrightnessSchool` 只**记录**冻结内核的默认流派，不在适配器里改内核状态。

#### Scenario: 适配器持有副本

- **WHEN** 适配器自行复制一份亮度表或核对表
- **THEN** 违反 ADR-004；应改为引用，否则副本与内核漂移

### Requirement: 体系立场随适配器声明

当前唯一流派 `wenmo-nishi` 承载现行混合口径：排盘与运限四化以**文墨天机**为准，
论断框架严格按**倪海厦《天纪》三合派**（命宫为本、三方为用）。
飞星派特征（宫干自化 `self-mutagen`、来因宫 `lai-yin`）SHALL 列入 `forbiddenFeatures`。

#### Scenario: 禁用特征被实现

- **WHEN** 有人实现宫干自化或来因宫
- **THEN** 与 `forbiddenFeatures` 声明冲突；绊线断言仍盯字段不被填回

### Requirement: 渐进披露不变

`SKILL.md` SHALL 保持为骨架，`references/` 为其延伸细则。新增内容插件的细则
SHALL 只在被读到时进上下文，不进 `SKILL.md`。

#### Scenario: 内容插件的细则

- **WHEN** 新增知识源并需要写使用说明
- **THEN** 说明进 `references/`（由 `SKILL.md` 写明何时读它），不塞进骨架

### Requirement: 扩展点落地状态如实记录

三个扩展点的落地程度不同，对外描述时 SHALL 与磁盘一致，不得把设计当成已实现：

| 扩展点 | 状态 | 位置 |
| --- | --- | --- |
| KnowledgeSource | 已落地 | `scripts/knowledge/`（`types.ts` / `registry.ts` / `sources/*.ts`） |
| SchoolAdapter | 已落地 | `scripts/school/`（`types.ts` / `registry.ts` / `schools/wenmo-nishi.ts` / `guard.ts`） |
| TopicProvider | 部分落地 | 主题定义已收编为单一真相源 `TOPIC_DEFS`（`analysis/data.ts`），编排层已拆到 `analysis/index.ts` + `analysis/views/`；接口与注册表**尚未落地** |

`getTopicAnalysis` SHALL 按**编排层**描述，不得说成注册表分发器。

#### Scenario: TopicProvider 的实际形态

- **WHEN** 阅读 `getTopicAnalysis` 实现
- **THEN** 它按固定小节序把 `views/` 下各 `renderXxx` 首尾相接，最后整体过一遍性别过滤
  （过滤作用在拼接后的整篇文本上，逐节过滤会漏掉跨节边界的句子）；
  与设计文档 §4.2 假设的方向一致——确实没有 `switch(key)`，但注册表本身尚未建立

#### Scenario: 描述落地状态

- **WHEN** 向他人说明扩展点现状
- **THEN** 按上表回答，不把 TopicProvider 注册表说成已完成

#### Scenario: 文档与磁盘不符

- **WHEN** 发现架构文档或项目文档把未落地的设计画成已实现
- **THEN** 以 `ls` 实测为准并修正文档（本仓已发生一次：`CLAUDE.md` 数据流图把
  `cli/knowledge/` 画在 `cli/commands/` 之下，实际两者平级）
