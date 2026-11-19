# 候选 13 · `--topic` 分支重复解析流年/流月：context 现成的值被弃用（2026-11-18 第五轮）

**档位**：Worth exploring（纯删两行）｜ **分层**：cli/commands（零行为改动）｜ **规范面**：无需 openspec change ｜ **与已定决策冲突**：0

## 涉及文件

| 位置                                                | 角色                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `scripts/cli/commands/astrology.ts:469-470`         | `--topic` 分支：`liunianYear: parseYearlyArg(args)`、`liuyueMonth: parseMonthlyArg(args) ?? undefined` 重复解析 |
| `scripts/cli/commands/astrology-context.ts:160-162` | `prepareAstrologyContext` 已算好 `liuNianYear` / `liuYueMonth`（装配单点）                                      |
| `scripts/cli/commands/astrology.ts:358`             | `cmdAstrology` 已解构 context 的同名变量（`--info` 分支在 `:392` 消费的正是 context 那份）                      |

## 问题（file:line 实据）

`--topic` 分支绕过装配单点，把 `parseYearlyArg` / `parseMonthlyArg` 在同一次请求里**再跑一遍**——`prepareAstrologyContext` 已算好同名值并已在 `cmdAstrology` 作用域解构可用。因为调的是同一函数，暂无漂移风险；但取数口出现两个：将来流年取数语义若有调整（如裸开关口径、缺省当年规则），`--topic` 路径与 `--json`/`--mutagen` 路径的一致性靠「记得是同一个函数」维持，而非结构保证——10-29 候选 3（生年层入口三种形态）正是这种「多入口」形态的实际发生过的事故。

## 为什么是摩擦（词汇口径）

`prepareAstrologyContext` 是「args 进、派生在内」的装配 module，其 interface 的意义就是「派生只发生一次、处处同源」。`--topic` 分支绕开它等于在 seam 旁边又开了一个小口——每多一个绕行口，装配顺序从 interface 事实退化成口头约定。

## 方案方向

`--topic` 分支改用 `actx.liuNianYear` / `actx.liuYueMonth`（两行替换，删两次 parse）。注意 context 侧 `liuYueMonth` 的可空语义与分支侧 `?? undefined` 的对齐（`getTopicAnalysis` 入参形态照旧）。

## deletion test

删两行重复 parse，复杂度集中回已存在的装配单点——**纯删代码**，深化成立且零新增。

## Before / After

```text
Before: 取数口 × 2                        After: 取数口 × 1
prepareAstrologyContext ── liuNianYear ──→ --info / --json / --mutagen 路径
parseYearlyArg(args)（--topic 再跑一遍）─→ --topic 路径
                                          --topic 改消费 actx.liuNianYear ──→ 同源
```

## 验收

- `--topic` 输出**逐字节 diff = 0**（同一函数同一入参，等值替换）。
- 三件套全绿；`npm test` 对拍不受影响。

## 落地注意

- 顺手核对 `--topic` 分支是否还有其他绕过 context 的派生（同函数族 `parseDailyArg` / `parseHourlyArg` 在该分支无消费，不涉及）。
- 与 10-29 候选 4（装配 module 化）同一条纪律的收尾，不新增机制。
