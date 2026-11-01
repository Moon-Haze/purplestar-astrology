# code-style Specification

## Purpose

约束 `.ts` 源码中注释的「量与长度」，避免源码被长注释淹没、又保证必要的 why / 约束 / 陷阱
说明不丢失：短注释留在源码，长说明外置到 `docs/code/`。本 spec 只管注释的**放置与篇幅**，
不管注释的**技术正确性**（正确性由 review 与对应领域 spec 守）。

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
