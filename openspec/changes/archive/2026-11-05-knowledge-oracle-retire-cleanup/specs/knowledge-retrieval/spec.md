# Spec Delta · knowledge-retrieval

## Purpose

oracle 断语手册域退役（remove-manual-oracle）的 interface 面收尾：`KnowledgeQuery`
字段面收窄到三源真实消费面，help 文案回到注册表实态的投影，退役参数显式报错。

## ADDED Requirements

### Requirement: help 面是注册表实态的投影

`knowledge` 命令的 help 面（命令说明与 OPTIONS 归属投影）SHALL 与注册表及参数声明表实态
一致：SHALL 只描述已注册的知识域，SHALL NOT 宣传已下线的域；对 `knowledge` 无语义的参数
SHALL NOT 出现在其 help 的 OPTIONS 节；各处文案对域数的陈述 SHALL 一致且等于注册表键数
（当前三域）。

#### Scenario: help 不含已下线域

- **WHEN** 执行 `knowledge --help`
- **THEN** 输出不含 oracle 域的说明段，也不含 `--topic`（已收归 astrology）

#### Scenario: 退役参数显式报错

- **WHEN** 用户对 `knowledge` 传 `--topic`（astrology 的主题论断参数，无论带值与否）
- **THEN** 非零退出并在 stderr 指路（`--search` 或位置参数检索），SHALL NOT 静默吞参后
  exit 0

#### Scenario: 域数措辞一致

- **WHEN** 阅读 `knowledge` 的命令说明与 help 正文
- **THEN** 无任何一处残留「四域」措辞，域数陈述与注册表键数（三域）一致

## MODIFIED Requirements

### Requirement: 知识源可插拔

系统 SHALL 以 `KnowledgeSource` 接口承载各知识域，并由注册表**清单注册**
（`knowledge/registry.ts` 显式 import 各 `sources/<id>.ts`），不使用文件系统自动发现。
新增一个域 = 写一个 `sources/<id>.ts` + 注册表加一行，**不必改 CLI 分发入口**。

`search` 签名 SHALL 取 CLI 无关的 `KnowledgeQuery`（精确字段 `term` / `limit` / `book` /
`positional`），SHALL NOT 引用 `CliArgs` —— 插件层 SHALL NOT 依赖 `cli/args` 类型；
位置参数回退留各域（域知识），由 `positional` 原样透传，不做公共解码。interface 面 SHALL
与消费面一致：`KnowledgeQuery` SHALL NOT 声明任何注册源都不读取的字段。漏注册由
typecheck 兜底。

#### Scenario: 新增知识域

- **WHEN** 需要新增一个知识域
- **THEN** 写 `sources/<id>.ts` 并在注册表加一行，CLI 分发入口不变

#### Scenario: 漏注册

- **WHEN** 实现了源文件但忘记加入注册表
- **THEN** typecheck 报错（注册表键与源 id 的类型不一致）

#### Scenario: 插件层类型自足

- **WHEN** 阅读 `knowledge/types.ts` 与各 `sources/*.ts` 的 import
- **THEN** 无 `@/cli/args` 引用，`search` 参数为 `KnowledgeQuery`（typecheck 可证）

#### Scenario: 字段皆有消费者

- **WHEN** 审视 `KnowledgeQuery` 的任一字段
- **THEN** 至少一个注册源在读它（当前三域：`term` / `positional` / `limit` / `book`
  均有消费；`topic` / `star` 已随 oracle 退役删除）
