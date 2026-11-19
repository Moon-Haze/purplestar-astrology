# 候选 12 · 声明表单点化的两处半截收敛：`--view` 穷尽性 + 指路行守卫清单（2026-11-18 第五轮）

**档位**：Worth exploring ｜ **分层**：cli/args + cli/selftest（零内核行为改动）｜ **规范面**：selftest 断言形态调整，无需 openspec change ｜ **与已定决策冲突**：0（是 e417115 / 527c1ec 单点化与 e9b0b7d 方向探针的**收尾**，不是翻案）

## 涉及文件

| 位置                                     | 角色                                                           |
| ---------------------------------------- | -------------------------------------------------------------- |
| `scripts/analysis/data.ts:2842`          | `AnalysisView` 联合类型（四成员）                              |
| `scripts/cli/args/table.ts:32-37`        | `VIEW_DOMAIN` 值域（键类型单向 ⊆ `AnalysisView`）              |
| `scripts/cli/selftest/render.ts:71-79`   | 手抄 `["mingpan","daxian","liunian","liuyue"]` 数组            |
| `scripts/cli/fortune/overview.ts:36`     | 运限速览「专题深入」指路行：手抄 **9** 个旗标（含 `--report`） |
| `scripts/cli/selftest/render.ts:127-138` | 盯指路行的存在性守卫：手抄 **8** 项，**缺 `--report`**         |

## 问题 A（file:line 实据）：`--view` 类型 ↔ 声明表穷尽性无守卫

`VIEW_DOMAIN` 的键类型注解保证「声明表 ⊆ 类型」（单向）；**反向无守卫**——给 `AnalysisView` 增一个成员而不进 `VIEW_DOMAIN`，typecheck 全绿、`--view` 运行期拒收该值、selftest 手抄数组也不覆盖。「扩值域只改一处」的单点承诺在类型侧没有闭合。e417115 的五处单点化收敛了文案，这半截未入扫描。selftest `:71-79` 的手抄四 view 清单是独立预言机还是抄写，注释未表态——但它**钉不出新 view 的覆盖缺口**。

## 问题 B（file:line 实据）：指路行守卫清单已经先漂移了

`overview.ts:36` 指路行手抄 9 旗标；盯它的 selftest 存在性清单只有 8 项、**缺 `--report`**——这条断言存在的理由正是「指路行改了没人知道」，但守卫清单是手抄副本，`--report` 加入指路行时守卫没跟上。**「静默分叉」先发生在守卫自己身上**：今天若有人从指路行删掉 `--report`，没有任何断言变红。指路行旗标全集在声明表有结构化真相（`DEEP_DIVE_KEYS` + `EXCLUSIVE_BRANCHES` + `palaces`），守卫却没消费它。

## 为什么是摩擦（词汇口径）

声明表是参数面的单一真相源；单点化的完整闭环需要两个方向都被钉住——「声明表没漏」（运行期值域、help 投影）与「类型没漏」（穷尽性）。两处半截都是守卫的 adapter 放错了层：一个该在类型层表态（穷尽锚），一个该消费声明表（派生清单），却都手抄了一份会漂移的副本——而 B 已经实测漂移。

## 方案方向

1. `table.ts` 加类型层穷尽锚：`const VIEW_DOMAIN_COVERAGE: Record<AnalysisView, true> = { mingpan: true, daxian: true, liunian: true, liuyue: true }`（类型层守卫，运行期零 footprint，不破坏 leaf 零依赖方向；`satisfies` 或显式注解二选一）。
2. `selftest/render.ts:71-79` 的循环改从 `VIEW_DOMAIN` 取键——该断言意图是「每个已声明 view 都能产出」，派生更贴意图。
3. 指路行守卫（`:127-138`）的存在性清单改为从声明表派生（deep 六旗标 + 三个独占分支名 + palaces）；指路行 prose 本身保留手写（展示文案，强行派生要给每个参数加短标签字段，interface 变宽、depth 反降——deletion test 不支持）。

## deletion test

删手抄清单改派生 = 守卫与声明表同源，复杂度集中（深化）；指路行 prose 保留手写 = 刻意版式，不是双写（同一事实的**呈现**可以有一份手写，前提是守卫从真相源派生）。穷尽锚删掉后编译不红 → 守卫退化回静默，锚的 existence 本身就是保证。

## Before / After

```text
Before: 副本三份，守卫已漂                    After: 声明表派生 + 类型锚
AnalysisView ←──(单向)── VIEW_DOMAIN          AnalysisView ←─(Record<AnalysisView,true> 穷尽锚)─ VIEW_DOMAIN
selftest 手抄四 view ✗                        selftest 循环 ← VIEW_DOMAIN 键
指路行 9 旗标 / 守卫 8 项 ✗（缺 --report）      守卫清单 ← DEEP_DIVE_KEYS+EXCLUSIVE_BRANCHES 派生
                                              指路行 prose（刻意版式，保留手写）
```

## 验收

- 守卫活体证明：临时给指路行删 `--report` → selftest 当场红（修复前它不会红）；给 `AnalysisView` 加一个假成员不进 `VIEW_DOMAIN` → typecheck 当场红。
- selftest / npm test 全绿，报告输出 diff=0（守卫形态调整不触输出）。

## 落地注意

- e9b0b7d 的方向探针（`commands.ts:149-190` 相邻对锚定）与组合矩阵封闭派生（`test/report.test.ts:231-317`）已声明表化，本候选只收 `render.ts` 两处手抄清单的尾，不要扩散到别的 selftest 文件。
- 指路行若将来增删旗标，派生清单自动跟随，prose 手写仍需人改——但「忘了改」从无红灯变有红灯。
