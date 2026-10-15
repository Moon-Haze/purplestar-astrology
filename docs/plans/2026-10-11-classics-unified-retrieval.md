## 目标

`classics` 合并为**统一知识检索命令**，四域合一；删除独立命令 `stars`、`oracle`（tianji 半成品撤回），旧命令名不保留别名（用户已拍板）。

## CLI 契约

```
classics                                        # 四域概览 + 用法
classics --search <词> [--limit N]              # books 域：古籍检索（默认域，行为一字不变，向后兼容）
classics --source stars [--search <星名>]       # 星曜释义（缺省列全部星曜）
classics --source tianji [--search <词>] [--book <册>] [--limit N]   # 天纪判语（带秒级回放链接）
classics --source oracle [--topic <key>] [--star <星名>]             # 断语手册（裸 = 列 13 主题）
```

- `--source` 新增声明（books|stars|tianji|oracle，非法值报错）；位置参数继续作检索词/主题回退
- 未知命令提示加指引：「stars / oracle 已并入 classics --source …」

## 变更清单

**1. 命令实现**

- 重写 `scripts/cli/classics.ts`：`cmdClassics` 改 async，按 `--source` 分发四域；stars/oracle/tianji 的渲染逻辑从三个旧文件搬入（域函数内动态 import 懒加载手册与语料数据）
- 删除 `scripts/cli/stars.ts`、`scripts/cli/oracle.ts`、`scripts/cli/tianji.ts`

**2. 注册与参数面**

- `args-table.ts`：新增 `source` / `book` / `star` 三个参数声明；`search` 的 desc 更新（去掉 stars 字样）
- `command-meta.ts`：`COMMAND_NAMES` 收回 `["astrology","classics","synastry","selftest"]`；删 stars/oracle/tianji 的 HELP/DESC 条目；`classics` 条目改写为四域说明
- `commands.ts`：删 cmdStars/cmdOracle import 与表项（tianji 未挂过表）
- `help.ts`：`OPTION_OWNERSHIP.classics` 扩为 `["search","limit","source","book","star","topic"]`；删 stars/oracle 的 ownership/示例条目；classics 示例补四域；SYNOPSIS 分支与注释更新；未知命令指引

**3. 修复半成品红错**

- `scripts/ziwei/tianji/entries.ts` 的 **TS2590**（1125 条字面量数组 union 爆栈）：改生成器产出形态（显式断言/函数构建），`npx tsx tools/corpus/import-tianji.ts` 重导验证

**4. selftest（6 处探针改写）**

- `selftest/commands.ts`：stars 两探针 → `classics --source stars`；oracle 探针 → `--source oracle`（async）；help 裁剪循环 `["stars","classics"]` → `["classics"]`；cities 探针 L301 改 classics 形态；help 归属参数探针（L598-601）改 classics 含 `--source`；classics books 探针保留
- `selftest-kit.ts` L37 注释、`args.ts` L296 与 `option-scope.ts` L16 注释同步

**5. 测试（登记不动，均为 cli.test.ts 嵌套 describe）**

- oracle 的 4 用例改为 `classics --source oracle` 路径；新增 `--source stars` 与 `--source tianji` 用例；books 域 3 条 CLI 用例不动；`tools/cli-samples.ts` 的 SAMPLES 表检查 stars/oracle 样例条目并更新

**6. 文档**

- SKILL.md：命令速查表（stars/oracle 行收回、classics 行改四域描述）、工作流第 2 步知识源清单
- references/options.md L20、references/workflow.md L70（stars 提及改 classics --source stars）
- docs/manual/README.md「程序消费」节改为 classics --source oracle 形态

**7. 回归与提交**

- typecheck + npm test（预计 533±）+ selftest + cli-samples 全绿
- 单独 commit：`refactor(cli): classics 四域合一（stars/oracle/tianji 并入）`
