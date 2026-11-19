# 候选 9 · 星曜键集守卫补网：soul-summary 两张表与 synastry 表外键（2026-11-18 第五轮）

**档位**：Worth exploring ｜ **分层**：analysis / synastry 知识内容层 + invariants 守卫（不碰排盘内核）｜ **规范面**：invariants 断言增加需核对层表归属（同候选 1 注意事项）｜ **与已定决策冲突**：0（键域口径的既有纪律补网）

## 涉及文件

| 位置                                            | 角色                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `scripts/analysis/soul-summary.ts:60-95`        | `keywordMap` / `natureMap` 两张**函数局部** 14 主星硬编码表                                           |
| `scripts/analysis/soul-summary.ts:44-45,97-98`  | 自述与实现：「未收录的星名（表外键）不会报错：`keywordMap[n] ?? []` 跳过，`nature` 兜底为空串」       |
| `test/invariants.test.ts:1677-1690`             | 「十四主星键集：星曜内容 / 简述 / 内核星表 三处同键集」守卫——只对拍 `STAR_CONTENT_MAP` / `STAR_BRIEF` |
| `scripts/synastry/synastry-knowledge.ts:38-40+` | `STAR_IN_FUQI_GU: Record<string, …>`（夫妻宫主星断语表）                                              |
| `scripts/cli/commands/synastry.ts:160-166`      | 消费点：查不到输出「（无收录断语）」——降级**可见**                                                    |

## 问题（file:line 实据）

键域守卫网（invariants:1677 的「三处同键集」对拍）有两张表漏在网外：

1. **soul-summary 两表**：`keywordMap` / `natureMap` 是 `getMingGongSummary` 函数**局部**常量，各自硬编码 14 主星名；miss 被 `?? []` / `?? ""` 显式吞掉（docstring 自认「表外键不会报错」）。主星名单若有变动（历史上发生过口径改名），这两张表静默降级——命宫主星的关键词与星别称悄悄消失，无红灯。守卫网当前的覆盖面（`STAR_CONTENT_MAP` / `STAR_BRIEF` / 内核星表）不含它们。
2. **STAR_IN_FUQI_GU**：synastry 侧同一键域形状（`Record<string, …>` 主星键），`test/` 下零互证断言（grep 证实）。与前者不同的是 miss 降级**可见**（显式「（无收录断语）」文案），所以风险是慢性的：不是静默缩水，而是 docstring 承诺与键集实态之间没有机器对拍。

## 为什么是摩擦（词汇口径）

「14 主星键集」这一语义在内核星表（真相源）、analysis 三张表、soul-summary 两张表、synastry 一张表共七处出现，守卫网只钉了三处。键域口径的价值正在于「数据表键与运行时键不一致 → 当场红」；漏网表让这个保证局部失效。修复不发明新东西：把既有守卫的 bySrc 数组延长即可，deletion test 是「漂移不可见」这个状态本身被消灭。

## 方案方向

1. `soul-summary.ts` 两表提为**模块级导出**（或并入 `analysis/data.ts` 星表族，与 `STAR_BRIEF` 同居），`getMingGongSummary` 改读导出——运行时行为零变化。
2. invariants `:1681` 的 `bySrc` 数组追加两表（一行 push）；测试名从「三处同键集」改「六处同键集」或改为派生表述（计数不写死）。
3. synastry 侧：`selftest-asserts` 或 `test/` 补一条 `STAR_IN_FUQI_GU` 键集 ⊆ 内核星表键集的互证（弱方向：表允许是星表子集——「部分主星有断语」是合法语义，docstring `:40` 自述可选缺省；互证方向是「没有星表外的野键」）。

## deletion test

提表 + 进守卫**不是搬家**：函数局部常量提为模块导出后消费方式更直接；守卫条目增加消灭的是「漂移无红灯」状态本身，运行时行为零变化。不加守卫而只改注释 = 承诺继续裸奔（非深化）。

## Before / After

```text
Before: 七处键集，守卫钉三处                    After: 守卫网全覆盖
内核星表 ── 真相源                              内核星表 ── 真相源
STAR_CONTENT_MAP / STAR_BRIEF ── ✓ 已钉         三张 analysis 表 ── ✓ 已钉
soul-summary keywordMap/natureMap ── ✗ 局部表    两表提导出 ── ✓ 进 bySrc（miss 即红）
STAR_IN_FUQI_GU ── ✗ 无互证                     synastry 断言组 ── ✓ 野键即红（弱方向）
（`?? []` / `?? ""` 吞 miss，漂移静默）
```

## 验收

- 守卫活体证明：临时给 `keywordMap` 加一个野键（如 `文昌`）→ npm test 当场红；还原全绿。
- soul-summary 输出逐字节不变（表位置迁移，消费逻辑等值）。
- 三件套全绿；`npm test` 对拍不受影响。

## 落地注意

- 「内核层测试项数」报警器：invariants 属层表哪一层先查 `test/README.md`；键集互证是内容键域守卫，若动内核层项数须在 change 里显式说明（与候选 1 同一条注意事项）。
- `soul-summary.ts` 文件头已有错层居住的理由说明（:4-6），本候选不动其归属，只动表的位置与守卫面。
- STAR_IN_FUQI_GU 若补互证，放 `scripts/synastry/selftest-asserts.ts`（与既有契约闭环断言同组）比放 test/ 更贴消费面——二选一在实现时定，不双写。
