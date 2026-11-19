# 候选 11 · CONFIG_OPTION_GROUPS：零消费死导出，别名伪装成接缝（2026-11-18 第五轮）

**档位**：Strong（一行删除，零风险）｜ **分层**：cli/args ｜ **规范面**：无需 openspec change ｜ **与已定决策冲突**：0

## 涉及文件

| 位置                                    | 角色                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `scripts/cli/args/config-input.ts:110`  | `export const CONFIG_OPTION_GROUPS = OPTION_GROUPS;`（**全仓唯一出现处**） |
| `scripts/cli/args/config-input.ts` 主体 | `renderTemplate` / `applyConfig` 直接消费局部 import 的 `OPTION_GROUPS`    |

## 问题（file:line 实据）

`grep -rn CONFIG_OPTION_GROUPS scripts/ test/ tools/` 只命中定义行自身——零消费点。注释声称「模板与校验共用一张 OPTION_GROUPS，防两处漂移」，但两个消费方**本就在同一文件内**直接用局部 import 的 `OPTION_GROUPS`；这张导出别名不承载任何 seam：没有第二个 module 经它消费，删掉后 typecheck / selftest 全绿。

## 为什么是摩擦（词汇口径）

它是一个 interface 面上的死名目：`CONFIG_OPTION_GROUPS` 这个名字向读者承诺「存在配置输入的参数面 adapter / 独立接缝」，实际只是同一 module 内的变量改名。deletion test 一眼见底：删掉它，零行为变化、零结构变化——它不是「删掉后复杂度集中」的深化对象，是纯死面。接缝判据（加一个实现只需一文件一行注册）反过来用在死接缝上：**没有消费者的接缝不该有名字**。

## 方案方向

删除该导出连同其注释。`config-input.ts` 其余部分不动。

## deletion test

不产生搬家成本、不需要任何调用方改写——删除即湮灭（非深化、非搬家，第三种：蒸发）。

## 验收

- typecheck 0 错误、selftest 全绿、`npm test` 全绿（零消费由三件套兜底确认）。
- `git grep CONFIG_OPTION_GROUPS` 归零。

## 落地注意

与候选 5（corpus 死导出）同族：断语手册时代/配置模板时代的接口余波清理。两者可并入同一次纯减法提交。
