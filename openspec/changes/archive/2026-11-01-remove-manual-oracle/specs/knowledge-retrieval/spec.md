# Spec Delta

## MODIFIED Requirements

### Requirement: 四域统一检索

系统 SHALL 由一条 `knowledge` 命令覆盖三个知识域，`--source` 取值：

| 域 | 内容 | 专有参数 |
| --- | --- | --- |
| `books`（默认） | 三部古籍原文 | `--search`（空白分词多关键词 AND）/ `--limit` |
| `stars` | 星曜释义 | `--search` |
| `tianji` | 天纪判语（可溯源到册） | `--book` 限册 |

未注册或拼错的 `--source` SHALL 报错并指向最接近的合法取值，不静默落回默认域。
命令输出本身即已校验形态，可直接引用。（断语手册 `oracle` 域已随 remove-manual-oracle
下线，取值不再合法。）

#### Scenario: 默认域

- **WHEN** 用户检索古籍原文但不指定 `--source`
- **THEN** 按 `books` 域检索

#### Scenario: 非法 source

- **WHEN** 用户传入未注册的 `--source` 取值（含已下线的 `oracle`）
- **THEN** 报错并指向最接近的合法域名

### Requirement: 重数据懒加载

系统 SHALL 保持知识源实现的懒加载纪律：重数据（天纪语料）在 `search` 内 `await import`
加载，注册表只静态 import 轻量包装模块。静态引入实现会把大体积数据拖进 CLI 启动。

#### Scenario: 启动开销

- **WHEN** 用户执行与知识检索无关的命令（如 `help`）
- **THEN** 不加载天纪语料

#### Scenario: oracle 按需查询

- **WHEN** 用户执行 `knowledge --source oracle` 检索（断语手册域已下线）
- **THEN** 以非零退出报「未注册 / 最接近合法值」错误，不静默落回默认域；
  `--source` 合法取值清单由注册表派生（三域）

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

- **WHEN** 需要某主题在某星上的论断材料
- **THEN** 用 `astrology <出生信息> --topic <key>` 现场推算（断语手册快照检索已下线，
  论断由 analysis 内核按盘生成）
