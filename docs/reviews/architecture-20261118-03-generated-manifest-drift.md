# 候选 3 · review-gate GENERATED 清单漂移：一张手抄单三处偏差（2026-11-18 第五轮）

**档位**：Strong ｜ **分层**：tools/ 工具链（零内核改动）｜ **规范面**：quality-gates（review 闸门行为变化）走 openspec change ｜ **与已定决策冲突**：0（方向与「生成器自报」既有先例一致）

## 涉及文件

| 位置                                   | 角色                                          |
| -------------------------------------- | --------------------------------------------- |
| `tools/review-gate.ts:58-61`           | `GENERATED` 手抄正则单（生成文件清单）        |
| `tools/review-gate.ts:312-331`         | 机检分档（M=🔴 阻断 / A=🟡）                  |
| `tools/db/export-manual.ts:47,238-311` | `docs/manual/` 的生成器（`--check` 对拍已建） |
| `tools/notes/export-notes.ts:55-61`    | `MANAGED_DIRS`（notes 托管目录**真相源**）    |
| `docs/manual/README.md:3-4`            | 手写文件，自述却自称生成物                    |

## 问题（file:line 实据）

`GENERATED` 是一张**手抄单**，与三个真实来源各漂移一处：

1. **真误伤**：正则 `/^docs\/manual\/[^/]+\.md$/` 命中 `docs/manual/README.md`——但 README 是**手写文件**（`export-manual.ts` 只产 combo-frequency.md 与 geju-audit.md，全仓可证）。README 自述「本目录全部内容由 tools/db/export-manual.ts 生成」（`:3-4`）对 README 自身是假话。现状后果：手改 README（哪怕修错别字）会被 review 闸门按「改了已入库的生成文件」拦截，机检不分档（`mechanical()` 阻断），轻档纯文档改动也躲不开。
2. **漏 6 个分区**：notes 侧 `MANAGED_DIRS` 实为 **9 个**（`export-notes.ts:55` 从 `BOOK_DIRS` 值派生），`GENERATED` 只手抄了 70/75/85 三个分区——重导后手改其余 6 个分区不触发任何机检。
3. **漏两个仓内生成物**：AGENTS.md 点名的 `scripts/data/wenmo-tables.ts`、`scripts/corpus/data/tianji.ts`（「生成文件不手改、改生成器再重导」纪律对象）不在 `GENERATED`——该纪律对它们只有文档承诺，无机检面。

根因与 10-29 评审候选 7 同型（那是「探针缺失」，这次是「清单手抄」）：**清单的真相源不在生成器手里**。`GENERATED` / `MANAGED_DIRS` / AGENTS.md 生成物清单是三张并行手抄单，各自漂移。

## 为什么是摩擦（词汇口径）

review-gate 作为守卫 module，其 interface 里最关键的一张表（什么东西不许手改）靠人肉维护——守卫本身的正确性没有守卫。这不是把复杂度搬家能解决的：三个生成器各自知道「我管哪些文件」，让它们**自报**（export 一个 managed-paths 清单）、review-gate 只消费，清单与生成能力天然同源，「生成器加了新托管目录、review-gate 不知道」这个 miss 类从结构上消失。

## 方案方向

1. `tools/db/export-manual.ts` 与 `tools/notes/export-notes.ts` 各 export「我托管的路径清单」（export-notes 现成的 `MANAGED_DIRS` 提为 export；export-manual 新增常量）。
2. `review-gate.ts` 的 `GENERATED` 改为**消费**上述清单（保留正则兜底给 `docs/manual/*.md` 内容文件，但把 `README.md` 显式排除——或干脆把 README 纳入 export-manual 托管一并生成，二选一在 change 里拍板，前者改动更小）。
3. `GENERATED` 追加 `scripts/data/wenmo-tables.ts`、`scripts/corpus/data/tianji.ts`（新档 🟡 提示即可，与现有分档策略一致）。
4. README `:3-4` 自述改为真话（「除本 README 外全部由 …生成」）。

## deletion test

删三张手抄单中的两张（GENERATED 的 notes 段与 AGENTS.md 生成物清单可由生成器自报派生）= 复杂度集中到生成器（深化）；只把 README 移出正则 = 修表象，下一次新增托管分区还会再漂（非深化）。

## Before / After

```text
Before: 三张手抄单各自漂移                    After: 生成器自报 + 闸门只消费
review-gate GENERATED（手抄 3/9 notes）        export-manual ──managedPaths()──┐
export-notes MANAGED_DIRS（9 个，真相源）  ╳    export-notes  ──MANAGED_DIRS───┼─→ review-gate GENERATED（派生）
AGENTS.md 生成物清单（2 项，无机检）       ╳    wenmo-tables/tianji 登记常量──┘   （README 移出，档位照旧）
误伤：手写 README 被 🔴 拦                                                       miss 类结构性消失
```

## 验收

- 行为验收：改 `docs/manual/README.md` 后 `npm run review` 不再 🔴（误伤消除）；伪造手改一个 notes 未托管分区 → 闸门 🟡 提示（漏网消除）。
- 单点化验收：`grep -rn "70-课程笔记" tools/` 只剩 export-notes 一处（其余全走 import）。
- 三件套全绿；review 闸门其余检查项不变（`npm run review` 输出除目标项外逐字节一致）。

## 落地注意

- tools/ 内互引（review-gate → export-notes/export-manual）方向是「闸门消费清单」，不违反 ADR-003（插件层禁反向依赖 cli/ 是 scripts/ 内的红线，tools 不在列）。
- `MANAGED_DIRS` 从模块私有提为 export 是最小接口变更；export-notes 的调用面（npm run notes:export）不受影响。
