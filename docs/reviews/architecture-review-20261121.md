# 架构评审 · 第七轮（2026-11-21）

走查方式：两路只读子代理（测试基建·数据链新地 / 知识内容层含 health 重建复审）+ 主线程逐条抽验关键论断。词汇口径：module / interface / depth / seam / adapter / leverage / locality / deletion test，与前六轮一致。

增量定位：第六轮收口后，测试基建与数据链经历了两组大改——`43b1776`（json-contract / mid-corpus / brightness-census 三个新 module）、`harden-baseline-data-chain` 归档（数据集指纹对账 / 基准范围正式化 1950–2026 / 普查基线）；评审期间并行会话又完成 `replace-env-injection-with-flags` 归档（env 注入退役，`setCacheBypassAll` 旁路 API 取代第六轮 N2 的机制——演进而非回退）。评审对象是这些已落新地，加上 health 重建（8e90785，本会话新写、尚无评审）的代码。与在途 change 冲突为零。

结论一览：Strong × 2（S1 数据链指引失效 / S2 引文集数精度）、Worth exploring × 6（W1-W6）、Speculative × 4（SP1-SP4，另有 SP5-SP6 在深挖中派生）。health 重建复审的核心交付物判定正确，收尾四项随批落账。

## 新地核验（先说好消息）

- **json-contract.test.ts**（317 行）：deep。13 键冻结集的存在意义自注；正向落宫逐星核对 + 反向基准标记「不多不少」；大限按盘独立复算；装配单点增删键必红并点名。
- **mid-corpus.ts**：deep。与层 1 同一比对器、零第二口径；stride 混叠的实证教训留档；SKIP 以非零退出，「跳过必须看得见」贯彻到退出码。
- **指纹对账三层闭合**：生成器导出即自报 → MANIFEST.json（血统注记诚实）→ repo 层字节哈希双向点名；只读文件字节，零 DuckDB 依赖的前提守住。
- **env 机制退役形态正确**：DIRECT_CHART_ENV / direct-env.ts 现役面零残留；旁路 API 与子进程 argv 的分工清晰。
- **health 重建复审**：十二宫逐宫与歌诀对齐；worstPalaces 判定与注释一致；歌诀守卫对接（锚点 + 引号同行）逐字验证闭环；双宫与降级形态实跑正常。

## 候选与落地核验（12 条全清，2026-11-22）

| #   | 档位            | 候选                                                                                    | 落地提交  | 验收要点                                                                                           |
| --- | --------------- | --------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| S1  | Strong          | 数据链重建指引指向已消失/失效的载体（missingDbHint / manifest「等价」/ README 三载体）  | `7ccf291` | 三处按实况改写（tar-shards 78 目录 + build-duckdb v4 谱系；体积按实测更正）；善后枚举面照单补全    |
| S2  | Strong          | health 煞星警示引语《天纪 11-12》集数归属错（原文在天纪 07 且语境不同；措辞仓内零命中） | `7ccf291` | 按真实出处改引（天纪 07 逐字「流年逢到这两颗星，身体病灾就来了」）；grades 对拍 views 盲区双处留档 |
| W1  | Worth exploring | health 头注两处过时（「一源双投影」+ slot 计数）                                        | `7ccf291` | 删过时表述、四个 slot 改列举                                                                       |
| W2  | Worth exploring | types.ts 星曜类型 JSDoc born-stale（sha/lucky vs tough/soft）                           | `7ccf291` | 对齐联合类型                                                                                       |
| W3  | Worth exploring | brightness-census 自述未随 v4 更新                                                      | `7ccf291` | 「diff=0 即同源证据、工具价值=监测文墨表未来漂移」新口径                                           |
| W4  | Worth exploring | run.ts 环境块半派生半手抄（baselineEngine 字段在手未消费）                              | `7ccf291` | 消费 manifest.baselineEngine 删两处手抄；值语义（SP5）另记档                                       |
| W5  | Worth exploring | worstPalaces「杀星」语义缺口（语料指七杀主星，实现数六煞）                              | `baedb20` | 注释补「主星杀星不计」取舍；六煞/四煞两口径并存留档                                                |
| W6  | Worth exploring | json-contract.test.ts 孤儿注释                                                          | `7ccf291` | 整行删除（新叙述已在用例组处）                                                                     |
| SP1 | Speculative     | --year 两阶段 skipped 计量真值                                                          | `baedb20` | 冒烟证伪：skipped=0，pattern 外不计入，无假 ✓；守卫用例不跑属模式内取舍，记档                      |
| SP2 | Speculative     | brightness-census 双旗标同给组合语义未定义                                              | `baedb20` | 互斥校验一行（报错文案写明「两次独立运行」的理由）                                                 |
| SP3 | Speculative     | TOPIC_SUGGESTIONS.health[0] 档案残留退役口径                                            | `baedb20` | 档案行补退役注记，与 §8.11 口径一致                                                                |
| SP4 | Speculative     | 引语纪律两档并存无声明（歌诀逐字 vs 轻清洗转述）                                        | `baedb20` | health 头注补两档声明（引文纪律优先于润色）                                                        |
| SP5 | Speculative     | 基准引擎叙事 v4 化（baselineEngine 值语义 + 多处 2.5.8 残留）                           | `baedb20` | chart.test describe 消费 manifest 字段、build-fixtures 值与 note 改本仓内核口径、AGENTS 依赖节同步 |
| SP6 | Speculative     | raw-rows 预言机外部性在 v4 后的状态未评估                                               | `0c2e722` | 注释按字段拆分落档：输入侧（农历换算）外部性保留；chart 侧同源化，降为映射一致性自检               |

## 附：第五轮 Speculative #3 解除（2026-11-22）

LAYERS 对账从软告警升级为**全量硬失败**（分层合计 ≠ 官方总计即非零退出），repo 层新增 suites ↔ describe 逐字对应断言——红演练当场抓到一处真实脱钩（topic-defs 的 suites 为截断版），已对齐。`--year` 两阶段合并后对账天然齐全（冒烟 349 项实证），手动 pattern 过滤保持告警合法。openspec `2026-11-22-reconciliation-hard-fail` 归档（skip_specs）。

suites 名脱钩（describe 标题改名而 LAYERS.suites 未跟上）**维持挂账**，否决理由留档 run.ts：静态扫描 describe 脆（describe 名已随 manifest 动态模板化）、nesting 结构信号被实测否决（reporter.ts:8「并行下部分丢失错乱」）、删 suites 字段丢最慢榜排除——后果是最慢榜混入聚合项（展示层失真），不为 cosmetic 加脆性守卫。

## 健康区（实读核验通过）

json-contract（语料级契约闸门成色完整）· mid-corpus（零第二口径 + SKIP 非零退出）· 指纹对账三层闭合（导出即自报 → MANIFEST → 双向点名）· 计数派生化落地 · env 退役形态正确（旁路 API + argv 分工）· health 十二宫歌诀对齐 + 守卫对接闭环 · 煞星口径单点 · analysis.md §8.9 口径史一致 · run.ts 环境块失败兜底 + 分层对账行 · sample-source 注释密度高。

未覆盖区（如实申报）：invariants ±63 / school ±2 / raw-rows 重导 diff 未逐行；grades 全表 60+ 条引语逐条回溯未做；两个 change 的 spec delta 工件未逐条核。

## 落地记录

- 修复批 S1/S2/W1-W6：`7ccf291`（openspec `2026-11-22-round7-review-fixes`，skip_specs，先例 dead-interface-face-cleanup）
- 第五轮 #3 解除 + SP1-SP5：`baedb20`（openspec `2026-11-22-reconciliation-hard-fail`，skip_specs）
- SP6 评估 + GLOSSARY 词条：`0c2e722`
- 评审期间并行会话完成：`harden-baseline-data-chain`、`replace-env-injection-with-flags`、`harden-key-domain-net`、`exempt-selftest-asserts-from-layering`、`align-kernel-import-discipline`、`polish-prose-with-humanizer` 六个 change（全部归档）
- 提交链截至本报告：`225cfdc` → `8e90785` → `43b1776` → … → `0c2e722`（未推送）

## 尾巴与挂账（本轮结束态）

- **内容尾巴**：ZIWU_LIUZHU 重建已在本轮完成（歌诀重写 + 通盘最差宫层 + 旧表删除）；亮度提取器重跑逐格验证仍 Deferred（上游仓不可达，见 harden-baseline-data-chain）。
- **挂账**：suites 名脱钩（否决理由留档 run.ts）、SP5 的 baselineEngine 值语义已随 v4 化解决、亮度 census 的注错演练留档（harden tasks 3.2）。
- 全部评审挂账至此清零。
