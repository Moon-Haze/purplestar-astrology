# scripts/ 架构评审（2026-10-16）

> 评审范围：`scripts/` + `tools/` + 相关 `test/`，聚焦 2026-10-12 扩展性评审之后的热点区
> （近 40 次提交触达频次：patterns 42 · cli/selftest 36 · tools/db 34 · analysis+views 61）。
> 方法：两个只读子代理分路走查（内核论断面 / CLI 自检与工具链面），全部结论附 file:line 证据。
> 与既有五份评审的关系：增量评审——cli 结构（20261011）、架构 8 候选（20261011）、扩展性
> （20261012）、代码评审标准（20261012）、skill 审计（20261013）已实施或已闭环的结论不重提。
> 词汇口径：module / depth / seam / locality / leverage / deletion test（删掉它是让复杂度**集中**
> 还是只是**搬家**？前者才是深化信号）。

---

## 总评

**分层与接缝健康，冻结面零瑕疵；摩擦集中在「同一规则写了两遍」形态的 locality 缺陷。**
两个 Strong 候选同属此形态：论断面的总览取材规则被两个编排器各写一遍（漂移已实测发生），
selftest/commands.ts 的增长实质是文件内双写断言。其余候选均为 Worth exploring / Speculative。
无运行时环、无失控文件、无必须立即修的问题；`analysis/data.ts` 零依赖属实、
`mutagen.ts` 六层四化边界清晰、KnowledgeSource 接缝干净。

---

## 候选 1 · 总览取材规则在 report 与 views/overview 双写 【Strong】

**涉及文件** `scripts/analysis/report.ts:177-258` · `scripts/analysis/views/overview.ts:32-138`

**Problem**　两条公开出口（`getTopicAnalysis` → views、`getTopicReport` → Markdown）各自实现
了一遍「总览段取什么材」，**7 个决策点同构重复**（report.ts:178-181 注释自己承认「素材与
views/overview.ts 同源」）：核心主题判定、格局展示主题清单、`topic_mods` 取键与双键注入、
summary 段条件、contentKey 全文选择、亮度补充、第二主星摘要——全表见走查附录。

漂移**已经发生**：空宫兜底文案一份写「命格整体」（overview.ts:138）、一份写「整体」
（report.ts:221）；星曜徽标格式三处并存——overview.ts:97-103 内联、report.ts:102-106
`starBadge`、`palace-query.ts:55-66` `descPalaceStars`（后两者注释自认「同一口径」）。
`selftest/render.ts:62-76` 对两篇整文各断各的，**无任何断言盯两侧一致**——改一处漏一处，机器不叫。

**深化方向**　抽一个返回结构化段落（mods / geju / summary / verdict / brightNote / secondStar）
的取材纯函数，两个编排器各消费它做自己的版式（`【】` 头 vs `###` 头）。

**Deletion test**　两份编排器都删不得（各服务一条公开出口）；抽共享函数后规则只写一遍、
版式各留约 10 行装配——复杂度**集中**而非搬家。收益加分：「personality 不出 summary 段」
这类规则第一次可绕过整篇输出直接单测。

**Before / After**

```text
Before: 规则 × 2（已漂移）              After: 规则 × 1 + 版式 × 2
+--------------------+  +---------------------+     +----------------------------+
| views/overview.ts  |  | report.ts           |     | overview-material() 纯函数 |
| 7 个取材决策点     |  | 7 个取材决策点(漂移)|     |   mods/geju/summary/...    |
+---------+----------+  +----------+----------+     +------------+---------------+
          |                        |                             | 消费
          v                        v                  +----------+----------+
   【】版式输出              ### 版式输出              v                     v
   (selftest 各断各的,                              【】版式输出        ### 版式输出
    一致性无人盯)                                   (+ 一致性可直测)
```

---

## 候选 2 · selftest/commands.ts 文件内重复断言（851 行增长的实质）【Strong】

**涉及文件** `scripts/cli/selftest/commands.ts`（851 行，31 断言；第二名 render.ts 仅 360 行）

**Problem**　structure-review-20261011 候选 5 挂的条件（「615 行若继续增长再二分」）形式上触发，
但增长成色需要修正解读：7a63313 prettier 对该文件净 +159 行纯排版噪声；实质增长约 50 行，
**其中约 2/3 是双写**：

1. 旧命令名键集检查双写：`runCommandSplit:353-377` 查 7 个旧名、`runAstrologyShapes:596-603`
   又查 5 个——4 键重叠（analyze/chart/topic/cities），独有增量只有 `stars/oracle/classics` 与 `insight`；
2. `--monthly` 守卫双写：`runCommandSurface:104-122`（直调抓文案）与 `runAstrologyShapes:756-763`
   （`deps.call` 抓 code/err）断言同一条守卫同一文案，后者无独有增量（`call` 与直调在
   index.ts:88-99 是同一 `callDirect` 路径）。

**深化方向**　先把被覆盖的同义条目收敛掉（独有断言各留一处），再执行原评审预留的二分——
二分缝与现有函数边界完全重合：`runAstrologyShapes`（377 行整块）搬入
`selftest/astrology-shapes.ts`，其余五组约 437 行留原地；各组只依赖 `SelftestDeps` 注入，
index.ts 改一行 import。「报告输出 diff=0」硬契约由组序不变保证。

**Deletion test**　删重复侧覆盖不变、是消复杂度而非搬家——**完全成立**；拆分本身只是搬家，
且若不先去重就拆，等于把双写一起搬进新文件。**去重优先，拆分其次。**

---

## 候选 3 · 空宫借星字段双轨——结构化字段已建，views 层没接 【Worth exploring】

**涉及文件** `scripts/algorithm.ts:347-361` · `scripts/analysis/views/surround.ts:73-83` ·
`scripts/analysis/views/decadal.ts:40-51` · `scripts/analysis/palace-query.ts:32-33`

**Problem**　`algorithm.ts` 专门填了 `borrowedFromName` / `borrowedStars`（注释：codex P0，
避免文案层从自然语言反查借宫信息），cli 侧 4 处消费方全接上了；但 views 两处**绕过字段内联
重算**同一信息（`oppositeBranch` + `palaces.find` + `filter(major)`——恰好就是 `borrowedStars:
string[]` 的形状，连「借无可借」空数组语义都对齐）。若借宫口径调整，algorithm 单点改不动
views，topic 输出与 cli/focus 输出会静默分叉。另 palace-query 的对宫查找可用现成的
`palaceAtBranch`（palace-relations）而未用。

**深化方向**　surround / decadal 逐字等价替换为读字段；palace-query 换 `palaceAtBranch`。

**Deletion test**　删内联 = 行为不变的纯收敛（复杂度归零）；字段是正主（4 处消费方），
内联是没接上的分叉——方向无歧义。

**Before / After**

```text
Before: 借星信息两条路                After: 单点字段
algorithm.ts --填--> borrowedStars    algorithm.ts --填--> borrowedStars
     |                |                    |                    |
   cli 4 处消费      views 2 处绕过      cli 4 处消费      views 2 处读字段
   (render/focus/    (内联重算,          (不变)            (等价替换)
    synastry)         口径漂移风险)
```

---

## 候选 4 · `patterns/soul-summary.ts` 错层居住 + 关键词平行真相源 【Worth exploring】

**涉及文件** `scripts/patterns/soul-summary.ts:61-93` · `scripts/data/stars.ts:121-146`

**Problem**　两层。① 错层：soul-summary 自述「与格局判定零耦合，纯文案层」（:4-9）却住在
82 个格局识别器的判定目录里——知识内容住判定层，与「排盘内核与知识内容严格分层」的
红线方向相悖（docs/code/patterns.md:142 记载了「签名不得改」的兼容理由，但位置仍是错层）。
② 平行真相源：`keywordMap`（紫微→`["尊贵","独立","领导"]`）与 `STAR_DESCRIPTIONS.keywords`
（紫微→`"帝王·尊贵·独立"`）是同一事实两处维护；`natureMap`（星曜别称「帝王星」）与
`STAR_DESCRIPTIONS.nature`（吉凶属性「中性偏吉」）是**一个键名、两种语义**，靠命名相近
极易误用，且两表关系无任何文档声明。

**深化方向**　文件迁出 `patterns/`（签名不动，消费者改 import，`REQUIRED_EXPORTS` 同步）
——纯搬家零行为变化；关键词是否合并进 `STAR_DESCRIPTIONS` 单独议（合并改 analyze 输出
文案，需语料回归把关，收益存疑）。

**Deletion test**　删不得（`astrology.ts:214` 的 `mingGongSummary` 依赖）；「搬家」收益确定，
「合表」存疑——只推搬家。

---

## 候选 5 · cli-samples 样例表的覆盖承诺零守卫 【Worth exploring】

**涉及文件** `tools/cli-samples.ts:29-30,68`（SAMPLES 表 70-881 约 810 行纯数据）·
`scripts/cli/args/table.ts`（OPTION_GROUPS）

**Problem**　文件头承诺「覆盖 help 的 OPTIONS 段全部参数」，同时自认「样例表是手动维护的」。
参数唯一真相源 `OPTION_GROUPS` 已有两个下游守卫先例（help 归属投影、selftest 的
`runSkillArgsAudit` 对拍 SKILL.md），唯独 cli-samples 这第三个消费者零守卫——新增参数忘补
样例，文档静默缺节，无红灯。SAMPLES 只被自身 main 消费，全仓无断言盯它的覆盖面。

**深化方向**　在 cli-samples 的 main 启动段（已有样例输入文件自检旁）加一条派生自检：遍历
`OPTION_GROUPS` 扁平化参数名，断言每个至少出现在一条 SAMPLES 的 args 里。守卫放工具自身
而非 selftest——tools/ 不进分发件，分发包内的 selftest 读不到它。

**Deletion test**　不适用（缺失的守卫而非冗余模块）；SAMPLES 表本身是纯数据声明，形态健康。

---

## 候选 6 · 四煞名单 `SHA_HARD` 逐字内联副本 【Speculative】

**涉及文件** 单点 `scripts/corpus/data/patterns.ts:162-166`；内联副本
`scripts/analysis/views/health.ts:62-64` · `scripts/patterns/medium.ts:91`

**Problem / 方向**　`SHA_HARD = ["擎羊","陀罗","火星","铃星"]` 已是单点，但两处各内联了一份
逐字相同的数组（patterns/ 自己有「判词一律取表」纪律，煞星名单没有同等纪律）。两处内联
换成 `SHA_HARD` 即可（health.ts 引数据表不违反分层）。影响面小：煞星口径极稳。
**Deletion test**：删内联 = 行为不变；`SHA_HARD` 本身删不得（识别器重度消费）。

---

## 候选 7 · tools/db 读侧/写侧边界注释失真 【Speculative】

**涉及文件** `test/lib/sample-source.ts` 文件头 · `tools/db/db.ts`

**Problem / 方向**　sample-source.ts 自称「全项目**唯一**懂 DuckDB 与表结构的地方」，但
tools/db/db.ts 同样懂（createDb/detectLayout/路径解析）；:109 又承认「唯一定义处是
tools/db/db.ts」——两处注释互相矛盾。实际边界是「读侧（test 采样）vs 写侧（tools 构建）」，
seam 方向全部正确（tools/db import 内核数据、verify-duckdb 有读回闭环），问题仅限注释失真
会误导后来者把写侧逻辑错误收敛进读侧模块。改注释一行成本。

---

## 不占候选的小漂移（注释级，随手修）

| 位置 | 问题 |
| --- | --- |
| `patterns/types.ts:5,138` · `helpers.ts:320,325` | 「见 `data.ts`」是陈旧指针——判词表已迁 `corpus/data/patterns.ts`，patterns/ 下并无 data.ts |
| `analysis/index.ts:52` · `analysis/report.ts:134` | 「13 个主题」注释漂移——TOPIC_KEYS 实为 14（study 是 Phase 4 加的别名视图） |
| `cli/commands/report.ts:20` | 「parquet 列序」注释在 TOPIC_DEFS Phase 2 后失真（列清单角色已归 `STORAGE_TOPIC_KEYS`）；`REPORT_TOPICS` 手抄 13 板块与 14 主题注册表的集合关系靠人肉维持 |

## 健康区（一句话带过）

冻结内核五文件全部干净（单点纪律、失败策略取舍有据、绊线原样）；`analysis/context.ts`
「一次算好」+ views 纯函数纪律；`knowledge/` 接缝；`test/cli.test.ts` 与 selftest 是互补双轨
非重复（--monthly 守卫仅 selftest 有，--liunian/--late-zi 校验仅 cli.test.ts 有）；
`build-duckdb.ts` 线性管道可接受；`query-args` 不与 cli/args 共享解析是正确的语义差异非重复。

---

## 建议落地顺序

1. **候选 2 去重**（selftest 双写断言收敛）：零风险删复杂度，半天内，selftest diff 可控；
2. **候选 1**（总览取材抽纯函数）：价值最高的一刀，需 `--topic` 与 `--report` 输出逐字节
   对拍护航（除兜底文案两处已知漂移需拍板统一口径外，其余应零差异）；
3. **候选 3**（借星字段接上）：逐字等价替换 + cli-samples 全绿即可；
4. 候选 5（cli-samples 覆盖守卫）可独立随手做；候选 4 搬家、候选 6/7 与小漂移清单随手清。

**Top recommendation：候选 1。** 它同时命中三个信号——locality 缺失（7 决策点改一须改二）、
重复真相源已产生实测漂移（兜底文案、徽标格式三处）、测试可达性缺口（规则级行为只能经
两篇整文间接观测）。修复不碰冻结面、不重演 TOPIC_DEFS 已完成的重构，是当前最热区里
收益/风险比最好的一刀。若求先易后难，候选 2 是零风险热身，可先行。

---

## 落地记录（2026-10-17，七个候选全部闭环）

| 候选 | 落地 | openspec 归档 |
| --- | --- | --- |
| 1 总览取材双写 | `overview-material.ts` 单点（starBadge + buildOverviewMaterial），两编排器改版式装配；文案统一（兜底句「命格整体」、徽标带括号） | `2026-10-17-extract-overview-material` |
| 2 selftest 双写 | 去重 2 条（insight 并入 CommandSplit；组合层 monthly 删）+ `runAstrologyShapes` 拆至 `astrology-shapes.ts`（commands.ts 851→480 行） | `2026-10-17-selftest-commands-dedup-split` |
| 3 借星字段没接 | surround/decadal 改读 `borrowedStars`/`borrowedFromName`；palace-query 换 `palaceAtBranch` | 批量（无独立变更，等价收敛） |
| 4 soul-summary 错层 | 迁 `analysis/soul-summary.ts`（签名不动，astrology.ts 改 import，patterns 公开面收窄） | 批量（等价收敛） |
| 5 cli-samples 守卫 | main 加派生自检（OPTION_GROUPS ⊆ SAMPLES），**当场抓到 3 个现存静默缺口**（--no-cache/--out/--book）并补齐 | `2026-10-17-cli-samples-coverage-guard` |
| 6 SHA_HARD 内联 | health/medium 两处换单点 | 批量（等价收敛） |
| 7 读侧/写侧注释 | sample-source.ts 头注释改边界描述；小漂移三处（patterns 指针 / 14 主题计数 / STORAGE_TOPIC_KEYS 归属）一并清 | 批量（注释级） |

验证总账：typecheck 0 错误、selftest 160→158（去重预期）、npm test 599/599、
cli-samples 63/63、prettier 全过；`--topic` 输出逐字零变化、`--report` 变化
全部为预期内的徽标括号统一。
