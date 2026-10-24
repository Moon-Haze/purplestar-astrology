# Spec Delta

## MODIFIED Requirements

### Requirement: 四域统一检索

系统 SHALL 由一条 `knowledge` 命令覆盖四个知识域，`--source` 取值：

| 域 | 内容 | 专有参数 |
| --- | --- | --- |
| `books`（默认） | 三部古籍原文 | `--search`（空白分词多关键词 AND）/ `--limit` |
| `stars` | 星曜释义 | `--search` |
| `tianji` | 天纪判语（可溯源到册） | `--book` 限册 |
| `oracle` | 主题断语手册（主题 × 十四主星） | `--topic` / `--star` |

未注册或拼错的 `--source` SHALL 报错并指向最接近的合法取值，不静默落回默认域。
命令输出本身即已校验形态，可直接引用。

参数缺值或非法时（如 `--search` 未给值、`--limit` 非正整数），四域 SHALL 一致报错：
非零退出码、错误信息走 stderr，不把报错当正常输出打 stdout——报错行为不存在域间差异，
机器路径（退出码）可感知。

books 域的 `--search`（或位置参数）SHALL 按空白分词：检索词拆出多个关键词时，
**全部关键词出现在同一段**才算命中；只有单个关键词时行为与单串子串匹配
**逐字一致**。snippet 高亮 SHALL 落在最早出现的关键词上。

#### Scenario: 默认域

- **WHEN** 用户检索古籍原文但不指定 `--source`
- **THEN** 按 `books` 域检索

#### Scenario: 非法 source

- **WHEN** 用户传入未注册的 `--source` 取值
- **THEN** 报错并指向最接近的合法域名

#### Scenario: 未给 limit

- **WHEN** 用户未给 `--limit`
- **THEN** 按内置默认值返回结果，不因参数缺省报错

#### Scenario: 缺值报错四域一致

- **WHEN** 任一域的取值参数缺值或非法（如 `--search` 裸开关、`--limit 0`）
- **THEN** 以非零退出码报错至 stderr；四域行为一致，无一域把报错打 stdout 后 exit 0

#### Scenario: 多关键词 AND

- **WHEN** 检索词含空白（如 `--search 紫微 化权` 或位置参数 `紫微 化权`）
- **THEN** 拆分为多关键词，同一段落全部包含才命中；任一关键词缺席即不命中

#### Scenario: 单关键词行为不变

- **WHEN** 检索词不含空白
- **THEN** 命中集合、顺序、snippet 均与单串子串匹配完全一致

#### Scenario: 高亮位置

- **WHEN** 多关键词命中同一段
- **THEN** snippet 的 `<mark>` 高亮落在最早出现的关键词上，窗口取其前后各 40 字
