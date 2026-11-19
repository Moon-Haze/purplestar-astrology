# 候选 2 · 指针类承诺的守卫面缺口：.md 之外全面无守卫 + 一批存量腐烂（2026-11-18 第五轮）

**档位**：Strong（守卫面扩展 + 存量清理一体）｜ **分层**：跨层（注释/文案/工具，零内核行为改动）｜ **规范面**：守卫变化触及 quality-gates，走 openspec change；存量清理是纯文案随手修 ｜ **与已定决策冲突**：0（MD_POINTER 守卫本来就是 e3d2958 刚建的机制，扩词元是同构延伸）

## 涉及文件

| 位置                        | 角色                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/repo.test.ts:392-486` | MD_POINTER 守卫本体（正则 `:397-398` 只提「裸 `X.md`」与「`docs\|references\|notes\|test\|scripts\|tools/` 前缀路径」；`commentSpans :421-446` 手写注释词法器——**只扫注释**） |
| `package.json:7-23`         | scripts 真相源（**无 `build:db`**）                                                                                                                                           |
| 存量清单见下两节            | 全部逐条实读核验                                                                                                                                                              |

## 问题 A（file:line 实据）：`npm run build:db` 指针大面积腐烂

`package.json` scripts 里**没有** `build:db`（实际命令是 `npx tsx tools/db/build-duckdb.ts`），但 `npm run build:db` 在仓内出现 **14 处**，其中两处是**用户可见报错文案**，照抄必失败：

- **用户可见**：`tools/db/query.ts:34`（`请先 npm run build:db -- --out=… --mode=dataset`）、`tools/db/export-manual.ts:317`（`先 npm run build:db`）
- 内核注释：`scripts/analysis/data.ts:1638`、`:2458`（「要改必须同时重建数据集（`npm run build:db`）」）
- 工具注释：`tools/db/build-duckdb.ts:1`（自己的用法行）、`:142`；`tools/db/verify-duckdb.ts:3`、`:431`、`:765`；`tools/db/generate-shards.ts:2`、`:13`、`:35`；`tools/db/tar-source.ts:3`

命令指针（`npm run X`）在现有守卫面**完全不可见**——MD_POINTER 只认路径词元。

## 问题 B（file:line 实据）：字符串字面量里的路径指针无守卫

MD_POINTER 经 `commentSpans` 只扫**注释**；字符串字面量不扫。已有实例：

- `scripts/cli/commands/synastry.ts:241`——运行时输出「评分标准与方法论已移至 references/synastry-guide.md…」，这是**打给用户看的话**，改名后指向死路径无人拦；
- `scripts/cli/commands/command-meta.ts:62`——help 文案「…见 references/synastry-guide.md」同上。

同文件 `synastry.ts:26/128/237` 的**注释**实例反而受守卫保护——同一指针一半受保护一半裸奔，防线位置纯属「写在哪种语法里」的偶然。

## 问题 C（file:line 实据）：`.ts` 注释指针存量腐烂一批（断语手册下线 + 三域收敛的余波）

以下全部实读核对：

| 位置                                                                                                                       | 腐烂内容                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/analysis/data.ts:1665-1666`                                                                                       | 「断语内容仍走 `corpus/data/manual/` 生成管线 + `LOADERS` 注册表」——目录已删，`LOADERS` 全仓零存在                                                     |
| `tools/pack.ts:136-137`                                                                                                    | 「本仓最大条目是 `scripts/corpus/data/manual/oracle.db`（约 5.9 MB）」——文件已不存在                                                                   |
| `scripts/corpus/citation-core.ts:44`                                                                                       | 「所有扫描面（.ts / .md / 断语手册库）共用这一个构造」——手册库扫描面已随手册退役                                                                       |
| `scripts/knowledge/registry.ts:4,11`、`scripts/knowledge/sources/books.ts:12,48`、`scripts/knowledge/sources/tianji.ts:98` | 五处「四域」——现役三域（books/stars/tianji），`cli/knowledge/index.ts:2-3` 与 `test/knowledge-registry.test.ts:21` 都已改口                            |
| `scripts/cli/knowledge/index.ts:72`                                                                                        | 「tianji / oracle 域的重语料在各自 search 内动态 import」——oracle 已无 search 体，同文件 `:3` 与 `:67` 均明说 oracle 下线，`:72` 与之自相矛盾          |
| `scripts/synastry/synastry-knowledge.ts:12-13`                                                                             | 「消费者：`commands.ts`…、`selftest.ts`…」——三 skill 合一前的旧布局，现址 `scripts/cli/commands/synastry.ts` 与 `scripts/synastry/selftest-asserts.ts` |
| `scripts/knowledge/registry.ts:9`、`scripts/knowledge/sources/tianji.ts:4`                                                 | 「392KB、1125 条」——实文件 337,294 字节（≈330KB），计数写死已漂移（违背「计数类事实一律不写死」纪律）                                                  |
| `tools/review-gate.ts:42`                                                                                                  | 「基线值由 **tests/db.test.ts** 之外的评审流程守护」——`test/db.test.ts` 不存在，指涉一个不存在的文件                                                   |
| `tools/db/verify-duckdb.ts:435`                                                                                            | 「（**tests/db.test.ts** 覆盖）」——承诺的覆盖者不存在                                                                                                  |
| `test/lib/citation-guard.ts:115`                                                                                           | `corpus/data/manual` 排除分支——目录已删，分支休眠，注释仍按现役目录描述（若目录重现会被静默豁免）                                                      |

这些全都在 MD_POINTER 的**提取口径之外**：`corpus/data/manual/` 不带白名单前缀、`commands.ts`/`selftest.ts` 是裸文件名、`392KB` 是数字——即使扫注释也抓不到。

## 为什么是摩擦（词汇口径）

MD_POINTER 是 e3d2958 刚立起来的守卫 module，但它现在的 interface 只覆盖「`.ts` 注释里带白名单前缀的路径」这一窄域；仓内「承诺某物在某处」的形态至少有三种——注释路径、字符串路径、`npm run` 命令名——**后两种完全不在 interface 里**。缺口不是理论风险：14 处命令腐烂、2 处用户可见断指针、1 处对不存在文件的覆盖承诺，全是存量实伤。这一层修复的 locality 收益极高：一个守卫位收口全部三类，此后「改了 X 没改指向 X 的 12 处注释」从人眼活变成当场红。

## 方案方向

1. **存量清理**（纯文案，先做）：按上表逐条修；`citation-guard.ts` 的 manual 排除分支删除或留一行「已随断语手册下线退休」注明。
2. **守卫扩展**（与存量同一 change）：
    - 词元一：`npm run <name>` / `npm run <name> --`——断言 `<name>` 在 `package.json` scripts 里（`build-duckdb.ts` 自身用法行改 `npx tsx …` 或给 scripts 补 `build:db` 别名，二选一拍板，后者让 14 处引用全部变真，改动更小）；
    - 词元二：字符串字面量中 `references/` 前缀路径——最小动作为对 `synastry.ts:241` / `command-meta.ts:62` 两处现有字面量加存在性断言；完整动作为 `commentSpans` 旁加 `stringSpans`（照抄词法器形态）；
    - 词元三（可选）：`.ts` 注释中 `test/*.test.ts` 裸文件名——断言文件存在（抓 `tests/db.test.ts` 这类断针）；
    - 白名单机制照旧：带理由 + 反向守卫（从未命中条目必须删除）。
3. `registry.ts` / `tianji.ts` 的「392KB、1125 条」计数改为不带具体数字的表述（或由重导工具在生成头里自报），遵守「计数类事实一律不写死」。

## deletion test

加守卫是把「指针有效性」的复杂度从散布 20+ 处的注释里**集中**到 repo.test 一处（深化）；只清存量不动守卫 = 腐烂继续无红灯地重新长出来（非深化）。两个动作必须绑在同一个 change 里。

## Before / After

```text
Before: 三类指针 × 0 守卫                     After: 一处守卫 × 三类词元
注释路径 ── MD_POINTER（窄口径，白名单外不抓）   注释路径 ──┐
字符串路径 ── 无守卫（synastry.ts:241 裸奔）      字符串路径 ──┼─ repo.test MD_POINTER 扩口径
npm run X ── 无守卫（build:db ×14 腐烂）         npm run X ──┘   （白名单 + 反向守卫照旧）
test/db.test.ts 断针 ×2 ── 无守卫               裸 .test.ts 文件名 ── 存在性断言
```

## 验收

- 守卫先红后绿：扩完词元用存量清单验证守卫当场抓出全部 14+ 处（说明词元口径真的命中），清完存量转绿。
- 反向守卫不误伤：文档里合法提及的 `npm run test` 等全部在 scripts 里。
- 三件套全绿 + `openspec validate --all` 零警告。

## 落地注意

- `commentSpans` 词法器扩展前先跑层 6 现有断言（候选序桩、MD_POINTER 非空扫描面），确保新增 span 类别不破坏反向守卫的「未命中即删」。
- 字符串字面量扫描可能撞上测试夹具里的假路径（样例 argv 等）——扫描面先限 `references/` 前缀这一窄类，够用且零误伤。
