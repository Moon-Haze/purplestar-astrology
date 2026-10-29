# 架构评审 · 候选清单（第四轮，2026-10-29）

走查方式：CLI 链路由子代理全量走查 + 主线程逐条抽验关键论断，内核与知识内容层（analysis / corpus / knowledge / school / 生成器）由主线程直查。全部论断附 `file:line` 实据。词汇口径：module / interface / depth / seam / locality / leverage / deletion test。

本轮为**增量评审**：2026-10-11 / 10-12 / 10-16 / 10-24 三轮候选大多已落地归档，本轮聚焦 10-24 之后的漂移与遗留（report 装配四 change 落地、analysis 目录化、manual 数据集）。在途 change `manual-dataset-drift`（纯重导生成物）与本清单零冲突。**与已定决策（ADR-002 / ADR-003 / 冻结契约 / 参数面单点）冲突：0。**

结论一览：Strong × 5（候选 1–5），Worth exploring × 2（候选 6–7），Speculative 观察 × 3（文末）。**Top 推荐 = 候选 1，连带候选 2 同文件收尾。**

---

## 候选 1（Strong）：render 的引擎边 —— lateZiSection 在渲染体内排对照盘

- **文件**：`scripts/cli/chart/render.ts:325-362`（:337 / :347 两次 `generateChartCached`，可触发 `chart-cache.ts:245` 落盘）；调用方 `astrology.ts:395`、`astrology.ts:558`、`report.ts:168`
- **问题**：定位「结构化数据 → 文本」的渲染 module，interface 是 `(chart, info, basis) => string[]`，却在函数体内排第二张对照盘并可能写缓存文件。render 对 `./chart-cache`（进而 algorithm / iztro）的运行时传递依赖**独为此存在**（文件头自称「唯一例外」）。三个调用方在「拼输出行」时隐式触发取数 + IO。直调 `composeSections` / `buildReport` 且样例落在 23:00–23:59 的测试会触磁盘，全靠 `test/lib/run.ts:136` 注入 `ZIWEI_NO_CACHE=1` 兜底——**环境保证而非 interface 保证**，单独跑某个测试文件时这层保护不存在。
- **方案方向**：对照盘上提为参数（caller 已持有 `info` 与 `basis`），render 卸掉 `./chart-cache` import。
- **收益**：deletion test 通过（删依赖复杂度消失不转移）；render 恢复无 IO、无引擎的不变量，seam 位置回到正确层；测试不再依赖环境变量。验收 = 输出与基线逐字节 diff = 0。

## 候选 2（Strong）：查宫 interface 三对并存，守卫在盯替身

- **文件**：内核 `palace-relations.ts:67/87`（by-branch 一对）；`render.ts:74`（`palaceAtBranch` **死导出**，全仓零调用）、`render.ts:91`（`mustPalace`，唯一消费者 `test/invariants.test.ts:54`）；`synastry/chart-view.ts:153/177`（自备一对，错误文案不同）；cli/ 裸 `.palaces.find` 约 20 处；注释锚点腐烂：`invariants.test.ts:555/559/590`、`render.ts:95`（仍指已不存在的 constants.ts）
- **问题**：「按项目口径取宫，取不到即抛」契约 3 份实现各自演化；`invariants.test.ts:559` 守卫 describe 名叫「合盘取宫入口（mustPalace）」，注释称 cmdsynastry 一律经它——但 `synastry.ts:13` import 的是 **chart-view 的同名另一份**。**守卫钉的不是生产在用的那份**：chart-view 侧口径漂移时该断言依然全绿。
- **方案方向**：by-name 取宫收进内核 `palace-relations`（`mustPalaceByName`）；删 render 两个孤儿导出；invariants 改指真入口；chart-view 改消费内核或注释明确为 synastry 专有并修指路腐烂。裸 `.find` 20 处不必全收，先收 must 语义处。
- **落地注意**：动内核 export 面 = 动冻结契约，须同步 `test/kernel-contract.test.ts`；「内核层测试项数」是越界报警器。

## 候选 3（Strong）：六层四化取数链 —— 两份活实现、三种生年入口、一块死推导

- **文件**：`astrology.ts:196-210`（`buildAnalyzeJson` 全链）；`fortune/mutagen.ts:51-102`（`mutagenSection` 再实现一遍，含童限判空）；`report.ts:145`（第三处生年取数）；死块 `astrology.ts:486-503`
- **问题**：同一条取数链（逐级依赖、童限特判、「生年四化年干必须取农历年干」口径）活在两个文件里，**无任何断言对拍 JSON 侧与文本节取数一致**——分叉不会红。生年层入口已现三种形态：`getNativeMutagen(chart)`（mutagen.ts:51）vs `getMutagenByStem(chart.lunarInfo.yearStem)`（astrology.ts:197）vs `getMutagenByStem(yearStem)`（report.ts:145）。**死代码实锤**：`cmdAstrology:490-503` 的 `yearStem/native/liuNian/liuYue/liuRi/liuShi` 推导在本函数体内零使用（真消费在 `buildAnalyzeJson` 自己的作用域），而 :486-489 关键的农历年干口径注释（含 1990-01-15 反例）仍守着死变量——注释与执行点脱钩；tsconfig 未开 `noUnusedLocals`，typecheck 照样绿。
- **方案方向**：取数链收成单点纯函数（`mutagen.ts` 纯函数层已有六层 getter，补「链组装」一层），三个消费方共用；死块删除、口径注释迁到执行点；可加「JSON ≡ 文本节取数」对拍断言。

## 候选 4（Strong）：装配管线没有 interface —— composeSections 的 opts 袋（W1 遗留）

- **文件**：`astrology.ts:380-391`（6 字段 opts 袋）；派生管线 `astrology.ts:479-503`（cmdAstrology 体内）；测试三份复刻 `test/astrology-sections.test.ts:37-55`（ctx）/ `:201-209`（chartFor）/ `:404-408`（caliberChart），互相不一致（一个带 `--no-dst`）
- **问题**：`composeSections` 要求 caller 交出 6 个**派生好的**值；「怎么派生」（applyConfig → buildBirthInfo → toBasis → generateChartCached → parse*Arg 的顺序与前提、`--config` 覆盖时机）只在 cmdAstrology 体内，不是任何 module 的 interface。测试把整条管线复刻三份。「纯函数为了可测试被抽出来，但真 bug 藏在调用方式里」——**interface 不是测试面**。
- **方案方向**：「args 进、派生在内」——收一个 `prepareAstrologyContext` module，composeSections 消费其产物；测试 19 行复刻整删，装配顺序本身变成可直测 interface。
- **deletion test**：删 `composeSections` 测试复刻不消失——它换来的可测性只覆盖接线序，没覆盖装配。

## 候选 5（Strong）：cli-samples 绕过 dispatch seam，手写第七份分发协议

- **文件**：`tools/cli-samples.ts:1054-1097`（44 行内联协议）vs `cli/host/dispatch.ts:102-133`（seam 本体，自称「唯一真相源，此前已收敛 6 份」）；`selftest/kit.ts:70`（错误前缀第三份）；等价断言仅 2 条（`report.test.ts:145`、`cli.test.ts:1161`）
- **问题**：2026-10-17 新写的 cli-samples 又造一份：help 拦截 → 查表 → parseArgs → 执行 → 错误前缀（`错误：${msg}` 内联两份）→ 未知命令；selftest 特判（:1067-1076）与通用分支（:1083-1096）逐字等价。「直调 ≡ 子进程」承诺只有 2 条断言钉住，其余几十条样例全靠注释。seam 已建、最新消费者不走——漂移只会让生成的文档悄悄失真，没有红灯。
- **方案方向**：cli-samples 改消费 `dispatch()`（注入输出缓冲口），44 行内联协议湮灭；等价断言扩全样例。deletion test：复杂度不是转移而是湮灭。

## 候选 6（Worth exploring）：虚构样本五处为家，单点模块零消费（W4 遗留）

- **文件**：`test/lib/sample.ts`（自称唯一来源，**全仓零 import —— 死 module**）；`test/report.test.ts:68-70`（本地 MALE/FEMALE 重写）；`selftest/sample.ts`（仅 BirthInfo 形态；argv 串在 selftest 8 文件手写 33 处、test/ 日期字面量 69 处）；`astrology.ts:302`（零输入演示 SAMPLE_BIRTH）；`tools/review-gate.ts:412`（又一份）
- **问题**：单点建了没接线——「换样本组改一处」只对 BirthInfo 形态成立，消费最多的 argv / 字符串形态无单点；换样本组要人工扫 13+ 文件，漏改不红、只悄悄测旧盘。
- **方案方向**：argv 形态导出并真正接线，或诚实删死模块——两者都比僵尸单点好。

## 候选 7（Worth exploring）：manual 生成物漂移无守卫

- **文件**：`tools/db/export-manual.ts`（读 db/dataset parquet + 内核表，依赖方向正确——引用不复制）；生成物 `scripts/corpus/data/manual/` ×15 + `docs/manual/`；实证：在途 change `manual-dataset-drift` 记录 **3.2 万行级漂移直到人工发现**
- **问题**：生成链四段（内核表 → db/dataset → export-manual → 生成物）无内容级漂移探针；`invariants` 只有键域互证。npm test 全绿 ≠ 生成物没漂。历史两次踩坑：10-24 `restore-analysis-palace-keys` 因重导环境阻塞卡在 11/12；7603c43 后手册漂移 3.2 万行直到人工比对现形。
- **方案方向**：轻量漂移探针（`export-manual --check` 重导内存对拍、脏则非零退出；或 npm test 抽样对拍），探针须容忍「本机无 518k 语料」降级。
- **落地注意**：触及 quality-gates 规范面 → 需 openspec change，不能免提案直接加。

---

## Speculative 观察（记录不动）

1. **data.ts 2907 行五职混居**：类型 + STAR_CONTENT_MAP 主表（约 1470 行）+ TOPIC_DEFS 注册表 + 建议模板三表 + BRANCH_MIGRATION_EXEMPT（10-26 一次性迁移豁免残留）+ 工具函数。TOPIC_DEFS 单点化已做、views/ 目录化刚完成，暂无行为级摩擦证据；唯一留心处是 BRANCH_MIGRATION_EXEMPT 的退役路径（迁移完成后是纯负债）。
2. **运限参数五函数分家**：parseYearlyArg / MonthlyArg / DailyArg / HourlyArg（astrology.ts:88-155）与 parseAgesArg（fortune/primitives.ts:61-74）同一纪律分住两层，注释互相引用。
3. **fmtDate 落点**：birth-info → render 值边（3 行函数拖进 362 行渲染 module）+ chart → birth 类型边，读码往返；chart-view 持有拷贝（见候选 2）。

## Top 推荐

**候选 1（连带候选 2 同文件收尾）。** 理由：它是 10-24 评审 S3「render grab-bag」悬案的最后一角（iztro 传递依赖已修、副作用边还在），切口最小（对照盘上提参数、三个调用方各加一行），却同时消掉三类隐性成本：render 对 chart-cache 的传递依赖、「测试安全靠环境变量兜底」的脆弱契约、晚子时逻辑「一半在渲染层一半在 caller」的 locality 缺失。验收干净（逐字节 diff = 0）。做完后 render.ts 两个孤儿导出（候选 2 的死导出部分）顺手同文件清理。若更看重测试杠杆，候选 4（装配 module 化）是「interface 即测试面」的正典案例，适合紧随其后。

## 附：2026-10-24 遗留线索核验表

| 线索 | 当前状态 | 对应候选 |
| --- | --- | --- |
| S3a lateZiSection 渲染体内排盘 | 仍在 | 候选 1 |
| S3b fmtDate 拖 iztro 进 render | 已修（birth-info 只剩 import type） | — |
| S3c 查宫多套并行 | 仍在且变形（孤儿导出 + 守卫盯替身 + 裸 find 12→20 处） | 候选 2 |
| W1 composeSections 测试复刻装配 | 仍在（三份复刻互相不一致） | 候选 4 |
| W4 测试样本双写 | 部分在（单点已建但零消费） | 候选 6 |
| W5 直调≡子进程等价断言 | 部分在（断言 2 条已有；cli-samples 仍旁路 dispatch） | 候选 5 |
| astrology.ts 547→671 行 | 主体真实内聚（--report / 六层四化 / 缓存），残留死推导块 | 候选 3 |
