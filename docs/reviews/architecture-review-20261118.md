# 架构评审 · 第五轮（2026-11-18）

走查方式：三路只读子代理全量走查（知识内容层 / 基建·测试·工具层 / CLI 层）+ 主线程逐条抽验关键论断（全部 file:line 实据均经实读或 codegraph 复核；两轮子代理报告的关键论断 100% 抽验）。CLI 层子代理因并发限额两次重试后完成，其报告亦经主线程抽验。词汇口径：module / interface / depth / seam / adapter / leverage / locality / deletion test。

本轮为**增量评审**：2026-10-29 第四轮的七候选**全部已落地**（核验表见下），本轮聚焦其后新产生的摩擦。在途 change 与本清单零冲突。**与已定决策（ADR-002 / ADR-003 / 冻结契约 / 参数面单点 / 键域口径）冲突：0——候选 1、9、12 是键域口径与声明表单点的归位/收尾，候选 2 是 e3d2958 守卫机制的同构延伸。**

结论一览：**Strong × 7**（候选 1–5、10–11），**Worth exploring × 6**（候选 6–9、12–13），Speculative 观察 × 8（文末）。**Top 推荐 = 候选 1**（真实用户可见缺陷 + 守卫补网）；候选 5 / 11 是零风险热身可先行；候选 10 是用户可见指引腐烂，随手可修。

每个候选的深入分析（问题实据 / 词汇口径论证 / 方案方向 / deletion test / Before-After / 验收 / 落地注意）**一候选一文件**：

| #   | 档位            | 候选                                                                     | 深入文件                                                                                                                     |
| --- | --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Strong          | 魁钺贵人表键域漂移（十二键十一键运行时死键）                             | [architecture-20261118-01-kuiyue-palace-keys.md](architecture-20261118-01-kuiyue-palace-keys.md)                             |
| 2   | Strong          | 指针类承诺守卫面缺口（.md 之外全面无守卫 + 20+ 处存量腐烂）              | [architecture-20261118-02-pointer-guard-blindspots.md](architecture-20261118-02-pointer-guard-blindspots.md)                 |
| 3   | Strong          | review-gate GENERATED 清单漂移（README 误伤 + notes 3/9 + 生成物缺位）   | [architecture-20261118-03-generated-manifest-drift.md](architecture-20261118-03-generated-manifest-drift.md)                 |
| 4   | Strong          | cli-samples 覆盖守卫休眠 + 样例 argv 绕开单点                            | [architecture-20261118-04-cli-samples-coverage-dormant.md](architecture-20261118-04-cli-samples-coverage-dormant.md)         |
| 5   | Strong          | corpus 公开面三个零消费导出                                              | [architecture-20261118-05-corpus-dead-exports.md](architecture-20261118-05-corpus-dead-exports.md)                           |
| 6   | Worth exploring | 建议行投影规则双写（basis→括注 + 童限句）                                | [architecture-20261118-06-suggestion-line-projection.md](architecture-20261118-06-suggestion-line-projection.md)             |
| 7   | Worth exploring | 测试基建两处 locality 缺口（直调 harness 双写 + 缓存环境保证靠入口约定） | [architecture-20261118-07-test-infra-locality.md](architecture-20261118-07-test-infra-locality.md)                           |
| 8   | Worth exploring | KnowledgeSource.citations 僵尸扩展点                                     | [architecture-20261118-08-citations-zombie-seam.md](architecture-20261118-08-citations-zombie-seam.md)                       |
| 9   | Worth exploring | 星曜键集守卫补网（soul-summary 两表 + synastry 表外键）                  | [architecture-20261118-09-star-key-guard-net.md](architecture-20261118-09-star-key-guard-net.md)                             |
| 10  | Strong          | `--no-cache` 指引腐烂（help 指向不存在的 `.cache/charts`，同句手抄三份） | [architecture-20261118-10-no-cache-pointer-rot.md](architecture-20261118-10-no-cache-pointer-rot.md)                         |
| 11  | Strong          | `CONFIG_OPTION_GROUPS` 零消费死导出（别名伪装成接缝）                    | [architecture-20261118-11-config-option-groups-dead-export.md](architecture-20261118-11-config-option-groups-dead-export.md) |
| 12  | Worth exploring | 声明表单点化两处半截收敛（`--view` 穷尽性 + 指路行守卫清单已先漂移）     | [architecture-20261118-12-declaration-table-halfway.md](architecture-20261118-12-declaration-table-halfway.md)               |
| 13  | Worth exploring | `--topic` 分支重复解析流年/流月（context 现成值被弃用）                  | [architecture-20261118-13-topic-branch-reparse.md](architecture-20261118-13-topic-branch-reparse.md)                         |

---

## 附一：2026-10-29 第四轮候选落地核验表（7/7 全部落地）

| 候选                                              | 状态     | 实据（主线程实读）                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 lateZi 引擎边（渲染体内排对照盘）               | **已修** | 对照盘上提为参数：`render.ts:284-288` `lateZiSection(chart, basis, alt)` 收 `alt: ZiweiChart \| null`；排对照盘收进独立 module `cli/chart/late-zi.ts:26`，调用方 `astrology.ts:282`（composeSections）传入。`generateChartCached` 的 caller 清单（codegraph）已无 render.ts                                                        |
| 2 查宫 interface 三对并存、守卫盯替身             | **已修** | `palace-relations.ts:91`（`mustPalaceAtBranch`）/ `:125`（`mustPalaceByName`）内核单点，docstring 自证「两份实现已收编到本单点」；`synastry/chart-view.ts:140-142` 显式弃权（「不再持有自己的查宫实现，命令层经 `@/` 直接消费」）；blast radius：两 must 函数 caller 在 `cli/commands/synastry.ts`；render.ts 两个孤儿导出已不存在 |
| 3 六层四化取数链双写 + 死推导块                   | **已修** | `mutagen.ts:413` `buildMutagenChain` 链单点（docstring 自证「生年层入口曾现三种形态，收编后口径改动只动本函数」）；`fortune/mutagen.ts:44-49` 只渲染不派生，注明与 `--json` 同源「对拍断言钉在 astrology-sections 测试」                                                                                                           |
| 4 装配管线无 interface（composeSections opts 袋） | **已修** | 派生管线收进 `cli/commands/astrology-context.ts`（composeSections 收 `AstrologyContext` 单参 `astrology.ts:278`；`generateChartCached` caller 含 astrology-context.ts）；深掘判据从声明派生（`astrology.ts:283-284`「deep: true 六旗标，与 cmdAstrology 同源」）                                                                   |
| 5 cli-samples 绕过 dispatch seam                  | **已修** | `tools/cli-samples.ts:4-6` 头注自证「执行走 dispatch seam（评审候选 5）……44 行内联分发协议已删」；`test/cli.test.ts:25` import SAMPLES 跑等价断言（基建层子代理核验 4 条实断言）                                                                                                                                                   |
| 6 测试样本单点零消费                              | **已修** | `test/lib/sample.ts` 僵尸 module 删除（91e423d）；单点重建 `scripts/cli/selftest/sample.ts:16-46` 四形态，selftest 三断言组 + report.test + review-gate 均已接线                                                                                                                                                                   |
| 7 manual 生成物漂移无守卫                         | **已修** | `tools/db/export-manual.ts:47,275-311` `--check` 内存重导对拍 + 孤儿检测；`package.json` 挂 `manual:check`；review-gate 闸门面挂载——但 GENERATED 清单本身漂移（本轮候选 3）                                                                                                                                                        |

**判读**：第四轮五 Strong 两 Worth 全部真落地（单点 + 守卫 + 对拍断言，不是搬家式假修）——CLI 层子代理的独立走查亦交叉证实五项，并补了三条主线程证据：`test/astrology-sections.test.ts:501-568` 存在「六层四化取数链对拍」断言；原「死推导块」已消（`report.ts:147-148` 的 `native/yearStem` 在 `:159/:161` 有真实消费）；`test/invariants.test.ts:561` 合盘取宫守卫现与生产消费同一份（不再盯替身）。本轮新候选全部是**新暴露的摩擦**，无一条是第四轮的重提。

## 附二：Speculative 观察（记录不动）

1. **ZIWU_LIUZHU 语义悬置**（`analysis/data.ts:2565-2569` 头注 Deprecated、`views/health.ts:17,64` 当现役第②层、`corpus/data/annotations.ts:188` 核对 note 记「需要重建」——三处说法不一）：方法论重建属内容决策，超出结构评审权限，等拍板。数据键域本身健康。
2. **cli.test.ts 三键 CLI 表与 skill 分叉残留**（`test/cli.test.ts:36-45` 三键同值表、`:139-158` cliCmd 的 `skill` 参数强制子进程分支，论证是三 skill 时代的）：单 skill 形态下概念清淤，行为无差，随手可做。
3. **LAYERS suites 名与 describe 标题脱钩无断言**（`test/lib/run.ts:158-160` 注释自认）：reporter 刻意不依赖树形状，加断言需权衡，先挂账。
4. **openspec/config.yaml 的 context「最小兜底」三行**与 AGENTS.md「只做指针不复制」措辞有出入（有意冗余还是违规没有裁决记录）：补一行白名单措辞或删兜底，两可。
5. **`tools/bench/startup.ts:33-34` 注释失真**（称 test/lib/loader.ts 是「既定副本且有漂移断言盯着」——副本关系已随 boot-hooks 收编消灭）：一行注释修正，可并入候选 2 的存量清单顺手清。
6. **注释符号名/文件名腐烂一批**（改名潮残留，MD_POINTER 罩不到）：`cli/commands/fortune.ts:4-5`（`commands.ts`/`selftest.ts`/`cmdAnalyze` 旧名）、`selftest/kit.ts:79` 与 `astrology-shapes.ts:9`（仍写 `cli/commands.ts`）、`selftest/guard.ts:99,129`（断言名提 commands.ts）、`host/dispatch.ts:13`（同）、`fortune/yearly.ts:14`、`age.ts:13`、`decadal.ts:14`（JSDoc 以拼音别名为「主参数名」，主名早已英文化）：批量小修一次清，可并入候选 2 存量清单。
7. **「生年 × 流年同星引动」块渲染双写**（判定已共用 `sihua-helpers.ts:76-97` `sameStarPairs`，仅文案层两份：`fortune/yearly.ts:59-68` 行内标题 vs `fortune/mutagen.ts:106-116` 节标题，连标题空格数都不同）：两处排版差异可能是刻意风格（节内行 vs 专题节【】头），先确认意图再动手——确认为刻意则只加一条文案对拍断言。
8. **import 风格混用**：`cli/commands/astrology.ts:56` 与 `report.ts:21` 引 `analysis/grades` 用长相对路径，同文件其余内核引用全走 `@/`：统一为 `@/analysis/grades`，纯一致性卫生。

## 健康区（一句话带过）

10-29 后新立的四条守卫机制质量过硬：组合矩阵封闭派生闭环（`test/report.test.ts:231-317`，缺名守卫当场红，45+3 算术复核吻合）、MD_POINTER 反向守卫（白名单未命中即删，`test/repo.test.ts:476-480`）、manual `--check`（与真重导同一份产出代码）、等价断言 4 条（直调 ≡ 子进程）。`analysis/context.ts` / `overview-material.ts` / `citation-core.ts` / `chart-view.ts` 仍是本轮读到的深 module 样板。cli/ 体量健康（最大三文件 cities.ts 745 / args/table.ts 602 均为纯数据/声明表）。

## Top 推荐

**候选 1（魁钺贵人表键域漂移）先做，候选 2（指针守卫面）紧随。**

理由：候选 1 是本轮唯一的**真实用户可见功能缺陷**——「魁钺贵人倾向细分」在十二分之十一的分支空间静默不出内容，且正是键域口径点名的缺陷类在守卫网外的复发；切口小（改 12 个键 + 守卫登记一条），收益直（功能面恢复）且顺带把「键域互证网」的先例补全（候选 9 是它的姊妹篇，可同 change 或紧随）。候选 2 的存量腐烂量最大（14 处 build:db + 2 处用户可见断指针 + 1 处对不存在文件的覆盖承诺 + 候选 10 的 `.cache/charts` 同族），守卫扩展是 e3d2958 机制的同构延伸，做完后「指针类腐烂」这一整类问题从人眼活变成当场红。候选 10 是用户可见指引腐烂（help 让用户扑空），半天内可清；候选 5 / 11 零风险纯减法可作热身；候选 3 / 4 / 12 属守卫面收口，各半天内。

建议落地顺序：**5 + 11（热身纯减法）→ 1（+9 同网）→ 10 → 2 → 3 → 4 → 12 → 13 → 6 → 7 → 8**。Strong 七项若走 openspec：候选 1/2/3/4 触及 quality-gates 或键域守卫面需提案，候选 10/11 纯文案与死面不必；Worth exploring 六项中 7/8 涉及测试基建与接缝收敛，逐项判断。
