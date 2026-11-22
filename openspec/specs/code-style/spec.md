# code-style Specification

## Purpose

约束 `.ts` 源码中注释的「量与长度」，避免源码被长注释淹没、又保证必要的 why / 约束 / 陷阱
说明不丢失：短注释留在源码，长说明外置到 `docs/code/`。本 spec 管注释的**放置与篇幅**，以及
注释与仓库级文档的**中文行文**（成段散文成稿经 `humanizer-zh` 润色）；不管注释的**技术正确性**
（正确性由 review 与对应领域 spec 守）。

## Requirements

### Requirement: 注释少而精（why 优先）

`.ts` 文件中的注释 SHALL 只解释 why / 约束 / 陷阱，不得重述代码 what；与代码同义的冗余注释
SHALL NOT 存在。行内注释优先单行。

#### Scenario: 冗余注释

- **WHEN** 一段注释只是把下一行代码用中文重说一遍
- **THEN** 删除该注释，不保留

#### Scenario: 解释 why 的短注释

- **WHEN** 注释说明某处为何要绕过常规做法（如「此处不可上溯目录层级」）
- **THEN** 保留，且优先单行内联

#### Scenario: 整段 what 复述

- **WHEN** 函数上方注释逐句复述函数体每一步
- **THEN** 删到只剩非显然的约束/陷阱

### Requirement: 长注释外置 docs

单个连续注释块的行长 > **10 行** SHALL 抽出到 `docs/code/<topic>.md`，源码处仅留一行指向
该文档的引用（如 `// 详见 docs/code/foo.md`）。`10` 为单一登记阈值，调整须改本 spec，
不得各文件各自为政。

#### Scenario: 超长注释块

- **WHEN** 某 `.ts` 文件出现连续注释 > 10 行
- **THEN** 其内容转写进 `docs/code/<topic>.md`，源码原处替换为单行引用

#### Scenario: 引用格式

- **WHEN** 长注释被外置
- **THEN** 源码留存的一行明确指向 `docs/code/` 下的具体文件（必要时带锚点），不复述内容

#### Scenario: 阈值调整

- **WHEN** 需要把「长」的判定从 10 行改为别的数
- **THEN** 只改本 spec 的登记阈值，并同步受影响文件，不出现多套口径

### Requirement: 外置文档入 docs/code

被抽出的注释 SHALL 落在 `docs/code/` 下（与 `docs/` 既有 user-guide / manual / plans /
reviews 分区一致），不得散落为源码旁的 `.md` 或写进 `references/`（references 是 skill 运行时
延伸，不收项目级代码说明）。

#### Scenario: 外置落点

- **WHEN** 把长注释移出源码
- **THEN** 落点固定在 `docs/code/`，不新建与源码同名的散落 .md

#### Scenario: 不污染 references

- **WHEN** 外置代码说明文档
- **THEN** 不写进 `references/`（那是 skill 行为规范的延伸，非项目代码注释仓库）

### Requirement: 注释与文档散文经 humanizer-zh 润色

成段中文注释（`.ts` 源码内的多行说明注释）与仓库级中文分析文档的散文正文 SHALL 在成稿时经
`humanizer-zh` 技能润色，去除模板化表达。适用文档面：外置 `docs/code/` 的说明文档、
`docs/reviews/`、`docs/plans/`、openspec 工件（proposal / design）的散文正文。润色 SHALL
保留技术事实与仓库口径：代码块、行内代码、命令、路径、数据、标题层级（锚点）原样不动；倪师
引语与引文登记条目 SHALL NOT 改写——引文纪律优先于行文润色。单行 why 注释、表格数据、生成
文件（如 `docs/manual/`）、`SKILL.md` 与 `references/` 豁免。

#### Scenario: 成段注释成稿润色

- **WHEN** 写出多行中文说明注释（含将外置 `docs/code/` 的长注释初稿）
- **THEN** 落盘前经 `humanizer-zh` 润色；润色只动散文行文，代码引用、路径与术语口径原样，
  不新增、不遗漏技术事实（评审对照可验）

#### Scenario: 分析文档成稿润色

- **WHEN** 写 `docs/reviews/`、`docs/plans/` 或 openspec 工件（proposal / design）的散文正文
- **THEN** 交付前经 `humanizer-zh` 润色；表格数据、命令与标题层级保持原样

#### Scenario: 引文保护

- **WHEN** 润色的文本含倪师引语或引文登记条目
- **THEN** 引语文字原样保留；润色后 `npm test` 引文守卫（层 7，扫 `.md` 全树）保持绿——
  润色不得以「去痕迹」为由触碰引文

#### Scenario: 豁免面

- **WHEN** 内容是单行 why 注释、表格数据、生成文件（如 `docs/manual/`）或 `SKILL.md` /
  `references/` 行为规范文本
- **THEN** 不强制走润色；生成物照旧走「改生成器重导」，不手改不顺带润色
