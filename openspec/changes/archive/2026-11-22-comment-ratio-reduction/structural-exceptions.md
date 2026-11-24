# 结构性例外列报：注释占比超 30% 文件全量清单

> 本清单由定义 A（字符级 lexer，`analyze-lib.cjs` 的 `analyze()`）实测生成，
> 是 `2026-11-22-comment-ratio-reduction` 变更的持久化列报产物（替代早期 gitignored 的 `.script_test/conflicts.txt`）。
> 生成命令：`node .script_test/plan.cjs`（脚本 `.script_test/gen-exceptions.cjs` 解析其输出）。

## 结论（技能步 7 用户拍板）

保留已合规降比的 `tools/db/query.ts`（44.5% → 18.1%），其余全部超标文件
**逐文件如实列报为结构性例外**，不做批量外置或精简。原因：块级证据（技能步 7）表明
这些文件的注释几乎全部是「字段文档」（紧邻字段的 `/** 取值/单位/口径 */`）与
「防错 why 注释」（解释为何这样断言/校验），按用户 m00830 决策**必留**；
早期「31 个可外置散文达标」分类是假达标，已作废。

对照定义 A 硬阈值：注释纯文字占比 ≤ 30%（去标记、去空白、无豁免）。
`下限 floor% = 契约字/(契约字+代码字)` 表示即使外置全部「散文」后的理论最低占比；
floor > 30% 属数学死结（字段文档必留），floor ≤ 30% 的假达标已被块级证据推翻（那些「散文」实为防错 why / 字段文档）。

当前实测：手写 .ts 159 个，超 30% **86** 个；全部列报为结构性例外。

## 分类与机制（块级证据摘要）

- **字段文档**：紧邻字段的 JSDoc（`取值/单位/口径/范围`），AGENTS.md「结构体须有字段注释」要求必留；例 `tools/db/shard-format.ts`（24 块几乎全是字段说明）、`scripts/data/stars.ts`、`scripts/cli/args/table.ts`（41 块）。
- **防错 why 注释**：解释「为何这样写、否则会怎样」，用户 m00830 明令不删；例 `tools/db/build-duckdb.ts`（54 组 / 7155 字，含「少退一层就 ENOENT」「非法值必须报错」「事务 aborted 次级异常」）、`tools/review-gate.ts`、`scripts/cli/selftest/args.ts`（拼错旗标静默错盘 3 时辰）、`test/lib/compare.ts`（同源同错边界）。
- **契约/类型定义密集**：`scripts/*/types.ts`、`patterns/index.ts`、`knowledge/types.ts` 等，注释即接口契约，删之破坏契约冻结。
- **纯用法散文极少**：全库扫描得 21 组、仅 6 组标为纯用法，且均为 28–189 字碎片并混有 spec 指针/why，无一是 `query.ts` 那样的连续用法头。

逐块肉眼证据可用 `.script_test/dump-groups.cjs <file>` 复现（行号区间 + 完整正文）；
`.script_test/find-usage-prose.cjs` 为全库用法/why 标注扫描。两者均为 gitignored 证据脚本，非度量真相源。

## ★最终执行结果（用户 m01192「都修改」后，覆盖上表）

> 上表（86 个列报）是 m01036 拍板「列报不改」时的快照。用户随后 m01192/m01193 明确要求全部实际精简改写降比，
> 经全量执行后：**87 个超标文件中 75 个降到 ≤30%，仅 12 个为最终例外**（本节为准，上表作历史留档）。
> 最终数字以真相源 `node .script_test/measure-comment.cjs <file>` 与 `verify.cjs check` 为准（plan.cjs 口径略高，卡线文件显示 30.1–30.3% 但 verify 判 PASS）。

| 类别                                               | 占比  | 文件                                   | 数学/语义依据                                                  |
| -------------------------------------------------- | ----- | -------------------------------------- | -------------------------------------------------------------- |
| protected-floor>30%（数学无解）                    | 80.6% | `scripts/patterns/types.ts`            | floor35.2% >30%                                                |
| protected-floor>30%                                | 80.4% | `scripts/cli/args/scope.ts`            | floor51.5% >30%                                                |
| protected-floor>30%                                | 79.1% | `scripts/knowledge/types.ts`           | floor37.3% >30%                                                |
| protected-floor>30%                                | 68.7% | `scripts/data/wuxing.ts`               | floor37.1% >30%                                                |
| // 行注锁定（编辑被禁）                            | 53.5% | `test/lib/loader.ts`                   | // 975字>target599，删光 /** */ 仍 minTotal1142(45.0%)         |
| // 行注锁定                                        | 50.5% | `test/lib/compare.ts`                  | // 2687字>target2611，删光 /** */ 仍 minTotal3189(34.4%)       |
| // 行注锁定（内核冻结）                            | 43.4% | `scripts/algorithm.ts`                 | //locked1680 + block floor796 = minTotal2476(30.7%)>target2394 |
| 保语义下限                                         | 56.9% | `scripts/cli/chart/late-zi.ts`         | 全语义+protected 下限≈42.7%>30%                                |
| 字段文档密集存量超标（best-effort 落盘 65.9→48.6） | 48.6% | `scripts/corpus/types.ts`              | degenerate 1-char 版仍 m183>target180；spec.md:243             |
| 字段文档密集（best-effort 66.7→54.0）              | 54.0% | `scripts/cli/birth/birth-info-defs.ts` | 字段文档密集，精简后仍超标；spec.md:243                        |
| 字段文档密集（best-effort 68.5→57.1）              | 57.1% | `scripts/palace-relations.ts`          | 字段文档密集；spec.md:243                                      |
| 字段文档密集（best-effort 65.3→52.3）              | 52.3% | `scripts/corpus/citation-core.ts`      | absolute-floor 版仍37.1%，再压删必留引文；spec.md:243          |

全部 12 个例外：`verify.cjs check` 0 integrity-fail（受保护 token 全保真 / 代码零变更）。
8 个为实质精简落盘（非保持 HEAD）：protected-floor 组（patterns/types、args/scope、
knowledge/types、data/wuxing）亦经 best-effort 精简但 floor>30% 仍超标，与字段文档密集
4 个同类；真正保持 HEAD 原样的仅 //行注锁定 3 个（loader、compare、algorithm）与
late-zi。依据 openspec/specs/code-style/spec.md「存量超标文件」条款：字段文档密集、精简后仍无法达标者如实列报，
不删必需文档、不设逐文件豁免。

## 全量清单（按当前占比降序）

| 梯队     | 占比  | 下限floor | 注释字 | 代码字 | 散文字 | 契约字 | 块  | 最大块 | 文件                                        |
| -------- | ----- | --------- | ------ | ------ | ------ | ------ | --- | ------ | ------------------------------------------- |
| C 55%+   | 83.4% | 72.5%     | 1148   | 229    | 544    | 604    | 8   | 317    | `scripts/cli/args/scope.ts`                 |
| C 55%+   | 83.3% | 75.4%     | 982    | 197    | 377    | 605    | 10  | 605    | `scripts/knowledge/types.ts`                |
| C 55%+   | 81.3% | 77.5%     | 2763   | 637    | 571    | 2192   | 30  | 638    | `scripts/patterns/types.ts`                 |
| C 55%+   | 79.6% | 52.4%     | 5577   | 1433   | 3998   | 1579   | 75  | 487    | `scripts/types.ts`                          |
| C 55%+   | 75.3% | 66.7%     | 1111   | 364    | 383    | 728    | 11  | 578    | `scripts/school/types.ts`                   |
| C 55%+   | 74.9% | 56.1%     | 907    | 304    | 518    | 389    | 4   | 320    | `scripts/data/wuxing.ts`                    |
| C 55%+   | 72.5% | 68.7%     | 2333   | 886    | 389    | 1944   | 15  | 1056   | `scripts/patterns/index.ts`                 |
| C 55%+   | 68.6% | 66.8%     | 2152   | 987    | 163    | 1989   | 11  | 495    | `scripts/palace-relations.ts`               |
| C 55%+   | 68.1% | 60.7%     | 1362   | 638    | 378    | 984    | 16  | 440    | `scripts/analysis/items.ts`                 |
| C 55%+   | 66.8% | 51.3%     | 2804   | 1393   | 1337   | 1467   | 43  | 287    | `scripts/cli/birth/birth-info-defs.ts`      |
| C 55%+   | 66.3% | 62.6%     | 1287   | 654    | 192    | 1095   | 8   | 502    | `scripts/cli/commands/index.ts`             |
| C 55%+   | 66.0% | 52.1%     | 814    | 420    | 358    | 456    | 28  | 172    | `scripts/corpus/types.ts`                   |
| C 55%+   | 65.4% | 63.5%     | 1313   | 695    | 104    | 1209   | 8   | 394    | `scripts/corpus/citation-core.ts`           |
| C 55%+   | 63.8% | 59.9%     | 4433   | 2520   | 665    | 3768   | 25  | 1595   | `test/lib/citation-guard.ts`                |
| C 55%+   | 63.2% | 40.9%     | 1107   | 644    | 662    | 445    | 47  | 264    | `scripts/data/sihua.ts`                     |
| C 55%+   | 63.2% | 61.7%     | 5197   | 3026   | 330    | 4867   | 29  | 378    | `scripts/patterns/helpers.ts`               |
| C 55%+   | 63.1% | 60.0%     | 623    | 365    | 76     | 547    | 3   | 547    | `scripts/knowledge/registry.ts`             |
| C 55%+   | 61.4% | 46.5%     | 1869   | 1177   | 846    | 1023   | 8   | 361    | `scripts/data/ganzhi.ts`                    |
| C 55%+   | 60.4% | 52.0%     | 3848   | 2523   | 1114   | 2734   | 43  | 657    | `scripts/boot-hooks.ts`                     |
| C 55%+   | 59.9% | 54.0%     | 4054   | 2712   | 875    | 3179   | 32  | 511    | `scripts/cli/chart/chart-cache.ts`          |
| C 55%+   | 59.8% | 51.6%     | 2422   | 1627   | 684    | 1738   | 22  | 570    | `scripts/cli/selftest/kit.ts`               |
| C 55%+   | 59.7% | 53.5%     | 463    | 313    | 103    | 360    | 4   | 360    | `scripts/school/registry.ts`                |
| C 55%+   | 59.6% | 59.6%     | 871    | 590    | 0      | 871    | 4   | 351    | `scripts/cli/fortune/primitives.ts`         |
| C 55%+   | 59.4% | 53.3%     | 666    | 456    | 145    | 521    | 5   | 521    | `scripts/school/schools/wenmo-nishi.ts`     |
| C 55%+   | 58.4% | 55.9%     | 1660   | 1182   | 163    | 1497   | 7   | 687    | `scripts/cli/knowledge/index.ts`            |
| C 55%+   | 57.4% | 52.5%     | 5978   | 4441   | 1065   | 4913   | 56  | 374    | `scripts/mutagen.ts`                        |
| C 55%+   | 57.0% | 57.0%     | 563    | 425    | 0      | 563    | 2   | 342    | `scripts/cli/chart/late-zi.ts`              |
| C 55%+   | 56.9% | 52.3%     | 1400   | 1060   | 240    | 1160   | 6   | 820    | `scripts/analysis/soul-summary.ts`          |
| C 55%+   | 56.6% | 51.4%     | 857    | 658    | 161    | 696    | 8   | 439    | `scripts/school/guard.ts`                   |
| B 40–55% | 54.5% | 51.6%     | 2815   | 2352   | 310    | 2505   | 18  | 594    | `scripts/analysis/lookups.ts`               |
| B 40–55% | 53.5% | 20.7%     | 1610   | 1398   | 1246   | 364    | 43  | 189    | `test/lib/loader.ts`                        |
| B 40–55% | 52.5% | 47.4%     | 202    | 183    | 37     | 165    | 2   | 165    | `scripts/corpus/data/tianji-books.ts`       |
| B 40–55% | 52.4% | 39.9%     | 477    | 433    | 189    | 288    | 6   | 288    | `tools/db/managed-paths.ts`                 |
| B 40–55% | 50.5% | 30.4%     | 2462   | 2415   | 1405   | 1057   | 33  | 303    | `scripts/cli/commands/astrology-context.ts` |
| B 40–55% | 50.5% | 21.3%     | 6219   | 6093   | 4572   | 1647   | 141 | 513    | `test/lib/compare.ts`                       |
| B 40–55% | 49.9% | 39.0%     | 4266   | 4281   | 1528   | 2738   | 47  | 507    | `scripts/purple-star.ts`                    |
| B 40–55% | 49.9% | 41.0%     | 987    | 989    | 299    | 688    | 9   | 267    | `scripts/wenmo-brightness.ts`               |
| B 40–55% | 48.4% | 44.5%     | 1611   | 1718   | 233    | 1378   | 11  | 425    | `scripts/analysis/suggestions.ts`           |
| B 40–55% | 47.8% | 43.0%     | 1417   | 1547   | 252    | 1165   | 13  | 561    | `scripts/corpus/index.ts`                   |
| B 40–55% | 47.2% | 33.6%     | 3870   | 4328   | 1679   | 2191   | 45  | 491    | `scripts/cli/args/parse.ts`                 |
| B 40–55% | 46.3% | 39.9%     | 1709   | 1986   | 389    | 1320   | 18  | 365    | `scripts/cli/host/dispatch.ts`              |
| B 40–55% | 45.1% | 33.5%     | 623    | 757    | 242    | 381    | 8   | 381    | `scripts/cli/selftest/sample.ts`            |
| B 40–55% | 45.0% | 45.0%     | 391    | 477    | 0      | 391    | 1   | 391    | `scripts/cli/commands/fortune.ts`           |
| B 40–55% | 44.7% | 44.7%     | 616    | 761    | 0      | 616    | 3   | 232    | `scripts/analysis/views/personality.ts`     |
| B 40–55% | 44.5% | 33.2%     | 2454   | 3059   | 931    | 1523   | 46  | 369    | `scripts/synastry/chart-view.ts`            |
| B 40–55% | 44.4% | 28.2%     | 1272   | 1596   | 644    | 628    | 25  | 326    | `scripts/analysis/index.ts`                 |
| B 40–55% | 44.2% | 27.9%     | 1019   | 1284   | 523    | 496    | 17  | 232    | `tools/db/sample-id.ts`                     |
| B 40–55% | 43.5% | 31.9%     | 4295   | 5586   | 1680   | 2615   | 53  | 597    | `scripts/algorithm.ts`                      |
| B 40–55% | 42.4% | 41.1%     | 1216   | 1650   | 66     | 1150   | 12  | 230    | `scripts/analysis/palace-query.ts`          |
| B 40–55% | 42.1% | 42.1%     | 338    | 465    | 0      | 338    | 1   | 338    | `scripts/data/index.ts`                     |
| B 40–55% | 41.6% | 41.6%     | 786    | 1105   | 0      | 786    | 3   | 353    | `scripts/analysis/views/mutagen.ts`         |
| B 40–55% | 40.6% | 30.4%     | 1407   | 2056   | 509    | 898    | 30  | 335    | `scripts/analysis/context.ts`               |
| B 40–55% | 40.4% | 40.4%     | 630    | 931    | 0      | 630    | 3   | 300    | `scripts/analysis/views/suggestions.ts`     |
| A 30–40% | 39.6% | 31.6%     | 3661   | 5592   | 1077   | 2584   | 38  | 606    | `scripts/analysis/report.ts`                |
| A 30–40% | 39.5% | 36.9%     | 939    | 1439   | 97     | 842    | 5   | 325    | `scripts/cli/fortune/sihua-helpers.ts`      |
| A 30–40% | 38.9% | 32.6%     | 1333   | 2094   | 319    | 1014   | 9   | 1014   | `tools/db/generate-shards.ts`               |
| A 30–40% | 38.2% | 19.7%     | 923    | 1496   | 557    | 366    | 26  | 202    | `tools/db/shard-format.ts`                  |
| A 30–40% | 37.8% | 19.5%     | 5208   | 8585   | 3132   | 2076   | 65  | 323    | `scripts/cli/args/table.ts`                 |
| A 30–40% | 37.6% | 36.1%     | 2644   | 4381   | 174    | 2470   | 22  | 528    | `scripts/cli/chart/render.ts`               |
| A 30–40% | 37.3% | 28.2%     | 338    | 568    | 115    | 223    | 5   | 223    | `scripts/knowledge/sources/stars.ts`        |
| A 30–40% | 37.0% | 14.6%     | 4919   | 8359   | 3486   | 1433   | 108 | 145    | `tools/db/db.ts`                            |
| A 30–40% | 36.9% | 36.9%     | 120    | 205    | 0      | 120    | 2   | 78     | `scripts/cli/host/out.ts`                   |
| A 30–40% | 36.4% | 10.2%     | 1713   | 2990   | 1372   | 341    | 49  | 230    | `test/tools/export-raw-rows.ts`             |
| A 30–40% | 36.3% | 13.3%     | 932    | 1634   | 682    | 250    | 6   | 328    | `scripts/data/stars.ts`                     |
| A 30–40% | 35.8% | 32.3%     | 1696   | 3045   | 240    | 1456   | 11  | 692    | `scripts/analysis/views/health.ts`          |
| A 30–40% | 35.4% | 26.5%     | 5195   | 9472   | 1787   | 3408   | 60  | 622    | `scripts/cli/birth/birth-info.ts`           |
| A 30–40% | 35.2% | 35.2%     | 741    | 1367   | 0      | 741    | 3   | 334    | `scripts/analysis/views/patron.ts`          |
| A 30–40% | 35.0% | 9.4%      | 2311   | 4288   | 1865   | 446    | 60  | 237    | `scripts/analysis/grades.ts`                |
| A 30–40% | 34.2% | 22.1%     | 1643   | 3155   | 750    | 893    | 22  | 333    | `scripts/analysis/overview-material.ts`     |
| A 30–40% | 34.2% | 0.8%      | 1717   | 3310   | 1690   | 27     | 46  | 66     | `test/chart.test.ts`                        |
| A 30–40% | 34.1% | 13.8%     | 627    | 1214   | 432    | 195    | 22  | 89     | `tools/db/render.ts`                        |
| A 30–40% | 33.8% | 20.5%     | 1065   | 2083   | 528    | 537    | 17  | 225    | `scripts/cli/fortune/mutagen.ts`            |
| A 30–40% | 33.8% | 18.7%     | 1831   | 3586   | 1008   | 823    | 27  | 488    | `scripts/cli/selftest/index.ts`             |
| A 30–40% | 33.6% | 20.0%     | 4692   | 9259   | 2376   | 2316   | 64  | 531    | `scripts/cli/commands/astrology.ts`         |
| A 30–40% | 33.6% | 12.9%     | 4042   | 7972   | 2864   | 1178   | 80  | 284    | `scripts/cli/selftest/args.ts`              |
| A 30–40% | 33.5% | 28.4%     | 445    | 882    | 95     | 350    | 4   | 259    | `scripts/cli/fortune/overview.ts`           |
| A 30–40% | 33.0% | 21.7%     | 3184   | 6477   | 1392   | 1792   | 40  | 385    | `scripts/cli/selftest/guard.ts`             |
| A 30–40% | 32.3% | 23.3%     | 887    | 1857   | 323    | 564    | 10  | 347    | `scripts/cli/fortune/info.ts`               |
| A 30–40% | 31.7% | 8.0%      | 9813   | 21098  | 7966   | 1847   | 225 | 255    | `tools/db/build-duckdb.ts`                  |
| A 30–40% | 31.4% | 29.9%     | 757    | 1651   | 52     | 705    | 6   | 316    | `scripts/analysis/views/year-stem.ts`       |
| A 30–40% | 31.4% | 16.4%     | 818    | 1784   | 469    | 349    | 17  | 119    | `tools/db/format.ts`                        |
| A 30–40% | 31.2% | 19.2%     | 1108   | 2444   | 528    | 580    | 21  | 185    | `tools/code-style/long-comment-check.ts`    |
| A 30–40% | 30.8% | 25.1%     | 1062   | 2387   | 263    | 799    | 10  | 378    | `scripts/analysis/views/yearly.ts`          |
| A 30–40% | 30.6% | 9.1%      | 2593   | 5886   | 2004   | 589    | 66  | 305    | `tools/bench/startup.ts`                    |
| A 30–40% | 30.5% | 11.4%     | 6846   | 15584  | 4834   | 2012   | 149 | 309    | `tools/review-gate.ts`                      |
| A 30–40% | 30.2% | 25.8%     | 884    | 2044   | 174    | 710    | 11  | 318    | `scripts/analysis/views/overview.ts`        |

## 处置

以上文件维持原样，不静默删 `@tag` / 引文 / docs 指针，不设豁免、不压行。
未来若要进一步降比，须逐文件重新取证并单独取得用户拍板（不得沿用已作废的「31 外置」清单，不得自设阈值）。
