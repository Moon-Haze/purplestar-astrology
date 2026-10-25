# Spec Delta

## MODIFIED Requirements

### Requirement: 知识源可插拔

系统 SHALL 以 `KnowledgeSource` 接口承载各知识域，并由注册表**清单注册**
（`knowledge/registry.ts` 显式 import 各 `sources/<id>.ts`），不使用文件系统自动发现。
新增一个域 = 写一个 `sources/<id>.ts` + 注册表加一行，**不必改 CLI 分发入口**。

`search` 签名 SHALL 取 CLI 无关的 `KnowledgeQuery`（精确字段 `term` / `limit` / `book` /
`topic` / `star` / `positional`），SHALL NOT 引用 `CliArgs` —— 插件层 SHALL NOT 依赖
`cli/args` 类型；位置参数回退留各域（域知识），由 `positional` 原样透传，不做公共解码。
漏注册由 typecheck 兜底。

#### Scenario: 新增知识域

- **WHEN** 需要新增一个知识域
- **THEN** 写 `sources/<id>.ts` 并在注册表加一行，CLI 分发入口不变

#### Scenario: 漏注册

- **WHEN** 实现了源文件但忘记加入注册表
- **THEN** typecheck 报错（注册表键与源 id 的类型不一致）

#### Scenario: 插件层类型自足

- **WHEN** 阅读 `knowledge/types.ts` 与各 `sources/*.ts` 的 import
- **THEN** 无 `@/cli/args` 引用，`search` 参数为 `KnowledgeQuery`（typecheck 可证）
