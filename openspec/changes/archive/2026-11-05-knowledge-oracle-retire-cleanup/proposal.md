# knowledge 的 oracle 退役收尾：interface 面与三域注册表实态重新一致

## Why

oracle 断语手册域随 `remove-manual-oracle`（12a3e4d）下线时，只删了源与注册表行，**接缝的
interface 面没跟着缩**。现状三层各讲一个故事：

| 层 | 现状 | 对错 |
| --- | --- | --- |
| `SKILL.md:147` | 三域，且写明 oracle 已下线 | 对 |
| `command-meta.ts:82-83`（COMMAND_DESC） | 「--source 三域」 | 对 |
| `command-meta.ts:48,55-56`（COMMAND_HELP） | 「四域合一」+ 整段 oracle 文案（含 `--topic <key> [--star <星名>]` 用法示例） | **错** |
| `knowledge/types.ts:37-40`（KnowledgeQuery） | 仍声明 `topic` / `star` 字段 | **错**（三源零消费，逐源核验） |
| `cli/knowledge/index.ts:47-57`（decodeKnowledgeQuery） | 仍守卫并解码 `--topic` / `--star` | **错** |
| `cli/args/table.ts:310` | `--topic` 的 `cmds` 含 `knowledge` | **错** |

实跑后果：`knowledge --help` 整段宣传一个不存在的域；`knowledge --topic career` **exit 0
静默吞参**（参数被收下、解码进 `query.topic`、三个源无人读）——违反「失败可见性」铁律；
`--star` 甚至不在声明表里，decode 的 star 分支不可达。同文件 `command-meta.ts` 一边写
「四域合一」（:48）一边写「三域」（:82-93），自相矛盾。

这不是新能力也不是口径变更，是**退役没做完**：interface 面比实现之和多出一个死域。

## What Changes

1. `knowledge/types.ts`：`KnowledgeQuery` 删 `topic` / `star` 两字段；头注 docstring 的
   「四域（books/stars/tianji/oracle）」与「oracle 回退为 topic/star」改为三域口径。
2. `cli/knowledge/index.ts`：`decodeKnowledgeQuery` 删 topic/star 解码分支；`--topic`
   出现时（无论带值与否）SHALL 报错并指路（`--topic` 是 astrology 的主题参数，检索用
   `--search` 或位置参数）——静默吞参变显式报错。
3. `cli/args/table.ts`：`--topic` 的 `cmds` 由 `["astrology", "knowledge"]` 收为
   `["astrology"]`（knowledge 的 help OPTIONS 节不再列出它）。
4. `cli/commands/command-meta.ts`：COMMAND_HELP.knowledge 删 oracle 段、「四域合一」改
   三域；:57-58 迁移注「旧命令 stars / oracle 已并入」改为与实态一致（stars 已并入、
   oracle 已下线并指路 `astrology --topic`）。
5. `cli/selftest/commands.ts`：「（四域）」措辞改三域；新增两条退役钉子——knowledge help
   不含 `oracle` 字样、不含 `--topic`。
6. spec 同步（knowledge-retrieval）：「知识源可插拔」requirement 的 KnowledgeQuery 精确
   字段清单删 `topic` / `star`；新增「help 面是注册表实态的投影」requirement（help
   SHALL NOT 宣传未注册的域或参数）。

## Capabilities

- **Modified Capabilities**：`knowledge-retrieval`（KnowledgeQuery 字段面收窄 + help 投影
  requirement 新增；「四域统一检索」「参数报错四域一致」「重数据懒加载」等 requirement
  行为不变，scenario 措辞随域数核实）。
- **New Capabilities**：无。

## 不做什么

- **不删 `dispatch.ts:62-64` 的 oracle 迁移提示**——旧命令名 `oracle` 的指路是退役正路，
  保留（spec「oracle 按需查询」scenario 仍有效）。
- **不动 astrology 侧的 `--topic`**——它对 astrology 是活参数（含 shadow / optionalValue
  语义），只收 knowledge 归属。
- **不引入「参数按命令硬校验」的通用机制**——`--topic` 的显式报错是 knowledge 入口单点的
  靶向守卫；把归属投影升级为全命令硬校验与「作用域 skill 级、投影只管 help 展示」的既定
  决策冲突，为单一死参数不值得（否决理由见下）。
- **不触碰排盘内核与 `test/kernel-contract.test.ts`**——本 change 不进内核导出面。

## 验证义务

属**行为修正 + 文案批改**，不涉排盘内核与依赖变更；但 CLI 输出契约有意变化（help 变短、
新增报错路径），按三件套申报：`npm run typecheck` + `node scripts/purple-star.ts selftest`
+ `ZIWEI_NO_CACHE=1 npm test` 全绿。预期输出变化（非回归）：

- `knowledge --help`：NAME 行「四域合一」→「三域合一」；oracle 段整段消失；OPTIONS 节
  不再列 `--topic`。
- `knowledge --topic career`：exit 0 静默 → 非零退出 + stderr 指路。
- books / stars / tianji 三域的正常检索输出**逐字节不变**。

## 被否决的备选方案

- **把 `--topic`/`--star` 解码留着但让三源消费**（恢复半截 oracle）：否决——oracle 域退役
  是已定决策（remove-manual-oracle），为消残基而复活死域是反向操作。
- **把归属投影升级为按命令硬校验**（knowledge 收到任何非本命令参数一律报错）：否决——与
  「作用域 skill 级」既定决策冲突，牵动全部命令的解析语义；本次只靶向 `--topic`（唯一
  已声明但语义已死的参数）。若未来第三类同类残基出现，再评估通用机制。
- **只改 help 文案、不动 KnowledgeQuery 与解码**：否决——那会让 interface 面继续背着零
  消费字段，静默吞参不消，deletion test 不过（「删字段复杂度湮灭」实测：三源零消费）。
