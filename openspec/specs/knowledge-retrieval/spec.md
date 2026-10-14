# knowledge-retrieval Specification

## Purpose

为解读提供**可溯源**的知识材料：古籍原文、星曜释义、天纪判语、主题断语手册。
统一由一条 `knowledge` 命令按 `--source` 四域分发。本能力的核心要求是——
能查到的优先用命令查，命令查不到才读源码，且引用的每一条都能指回权威语料。

## Requirements

### Requirement: 四域统一检索

系统 SHALL 由一条 `knowledge` 命令覆盖四个知识域，`--source` 取值：

| 域 | 内容 | 专有参数 |
| --- | --- | --- |
| `books`（默认） | 三部古籍原文 | `--search` / `--limit` |
| `stars` | 星曜释义 | `--search` |
| `tianji` | 天纪判语（可溯源到册） | `--book` 限册 |
| `oracle` | 主题断语手册（主题 × 十四主星） | `--topic` / `--star` |

未注册或拼错的 `--source` SHALL 报错并指向最接近的合法取值，不静默落回默认域。
命令输出本身即已校验形态，可直接引用。

#### Scenario: 默认域

- **WHEN** 用户检索古籍原文但不指定 `--source`
- **THEN** 按 `books` 域检索

#### Scenario: 非法 source

- **WHEN** 用户传入未注册的 `--source` 取值
- **THEN** 报错并指向最接近的合法域名

#### Scenario: 未给 limit

- **WHEN** 用户未给 `--limit`
- **THEN** 按内置默认值返回结果，不因参数缺省报错

### Requirement: 命令优先于读源码

系统 SHALL 在需要展开论证时优先用 `knowledge` 命令查证，而不是读 `scripts/` 下的源码。
命令输出已带校验形态，可直接作为断语依据。

只有命令查不到、或确需读源码语义时，才读 `scripts/` 下的权威文件
（`patterns/` 格局库与四化、`corpus/` 古籍、`synastry/` 合盘断语）。

#### Scenario: 引证古籍

- **WHEN** 解读需要引古籍原文佐证
- **THEN** 调 `knowledge --search` 取原文，不凭记忆背诵

#### Scenario: 星曜性质

- **WHEN** 解读需要星曜释义
- **THEN** 调 `knowledge --source stars`，不凭记忆补星曜性质

#### Scenario: 主题断语

- **WHEN** 需要某主题在某星上的断语
- **THEN** 调 `knowledge --source oracle --topic <key> --star <星名>`

### Requirement: 引文分级与登记

系统 SHALL 对知识库中的倪师引语标注来源分级（verified / traditional / methodology / suspect 四级）。
引用断语时须注明口径，并说明「倪师说」部分可能是传统口诀的**风格化转述**，
不一定是《天纪》逐字原话。

**不得生成《天纪》里不存在的引语。** 任何「倪师 / 倪海厦 + 引号句」形态的文案
都必须在 `analysis/grades.ts` 登记档位，否则引文守卫失败。

#### Scenario: 占位内容

- **WHEN** 撰写新文案且内容为自撰或占位
- **THEN** 不挂倪师引语；写「倪师体系重……」会同时触发未登记与引文纪律问题，应改为自述式说明

#### Scenario: 引用风格化转述

- **WHEN** 引用库中「倪师说」类断语
- **THEN** 注明是风格化转述还是可溯原话

#### Scenario: 冒充原话

- **WHEN** 拟引用一句《天纪》原文
- **THEN** 先在权威语料中核对，不存在则不引用

### Requirement: 知识源可插拔

系统 SHALL 以 `KnowledgeSource` 接口承载各知识域，并由注册表**清单注册**
（`knowledge/registry.ts` 显式 import 各 `sources/<id>.ts`），不使用文件系统自动发现。
新增一个域 = 写一个 `sources/<id>.ts` + 注册表加一行，**不必改 CLI 分发入口**。

`search` 签名 SHALL 与既有各域渲染函数保持一致，使迁移零改行为。
漏注册由 typecheck 兜底。

#### Scenario: 新增知识域

- **WHEN** 需要新增一个知识域
- **THEN** 写 `sources/<id>.ts` 并在注册表加一行，CLI 分发入口不变

#### Scenario: 漏注册

- **WHEN** 实现了源文件但忘记加入注册表
- **THEN** typecheck 报错（注册表键与源 id 的类型不一致）

### Requirement: 重数据懒加载

系统 SHALL 保持知识源实现的懒加载纪律：重数据（天纪语料、oracle 断语手册）在 `search` 内
`await import` 加载，注册表只静态 import 轻量包装模块。静态引入实现会把大体积数据拖进 CLI 启动。

#### Scenario: 启动开销

- **WHEN** 用户执行与知识检索无关的命令（如 `help`）
- **THEN** 不加载天纪与 oracle 的重数据
