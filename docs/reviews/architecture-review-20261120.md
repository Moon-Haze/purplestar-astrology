# 架构评审 · 第六轮（2026-11-20）

走查方式：两路只读子代理全量走查（CLI·测试基建层 / 内核·知识内容层）+ 主线程逐条抽验关键论断——全部 Strong 与承重论断经实读或实跑复核，含一次 CLI 实跑复现（`--palaces` 缺名抬头三空格）。词汇口径：module / interface / depth / seam / adapter / leverage / locality / deletion test，与前五轮一致。

增量定位：第五轮（2026-11-18）13 候选已落 5（1 / 5 / 8 / 11 / 12 之 --view 半边），自评审归档以来 `scripts/` 零改动——本轮不重走守卫面/死面视角，聚焦**新轴线**：命令层的分支级复刻、验证基建的 seam 位置、内核侧的假想 seam。与已定决策冲突 2 处（N3 触冻结契约、N6 触 extensibility spec），均显式标注流程要求后执行。

结论一览：**Strong × 3**（N1-N3）、**Worth exploring × 4**（N4-N7）、**Speculative × 4**（S1-S4）。Top 推荐 = N1 热身 → N2（byte-diff 假绿点）；N3 为唯一须契约变更的结构项。截至 2026-11-21，**两批全部落地并提交**（核验表见下）。

## 候选与落地核验（8/8 全清）

| #   | 档位            | 候选                                                                                     | 落地提交   | 验收要点                                                                                     |
| --- | --------------- | ---------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| N1  | Strong          | `--palaces` 抬头绕开 chartHeader（缺名残留三空格，实跑复现；断言名与现实相反）           | `225cfdc`  | 命名盘逐字节 diff=0、缺名盘恰 1 行；selftest 断言改名并扩 --palaces 形态                      |
| N2  | Strong          | byte-diff 验收工具（review-gate 快照 spawn）无缓存豁免 +「必须直排」五处手抄             | `56a0c1e`  | `DIRECT_CHART_ENV` 常量单点（cli/chart/direct-env.ts），五 spawn 点 spread 收编，手抄归零     |
| N3  | Strong          | wenmo-brightness 旋钮三件套：冻结契约背书的零消费可变内核状态（假想 seam 的机制半边）    | `ef5903d`  | 契约变更流程走完（change 归档折回）；四输出逐字节 diff=0；四流派数据表与防线保留              |
| N4  | Worth exploring | 煞星键域：SHA 三表 partition 只有注释没有断言（键域守卫网第三盲区）                      | `56a0c1e`  | partition 派生验证 + 六煞基准盘 tough 派生；先红后绿演练「重叠：地空」当场红                  |
| N5  | Worth exploring | 疾厄 view 同字段双标签（子午流注映射 / 经络旺时 内容逐字重复）                           | `225cfdc`  | 留「子午流注映射」一行，《天纪》术语口径；输出 diff 恰 −1 行                                  |
| N6  | Worth exploring | `ForbiddenFeature.lai-yin` 声明无检查、guard 注释指向不存在的绊线                        | `56a0c1e`  | 拍板 N6(b)：school.test 补 laiYin 字段缺席绊线（300 盘逐宫），注释变真；C3 声明保留不翻案     |
| N7  | Worth exploring | 专题菜单两处手抄（指路行 + help DESCRIPTION），DEEP_DIVE_KEYS leverage 承诺泄漏           | `56a0c1e`  | `DEEP_DIVE_MENU` 入声明表，指路行全派生、DESCRIPTION 插值拼装；help/overview 逐字节一致       |
| S1  | Speculative     | buildAnalyzeJson JSDoc 手抄键清单漏三键                                                  | `e83628e`  | 清单改「以序列化对象为准」；docs 契约清单补齐（实跑 13 键锚定）                                |
| S2  | Speculative     | knowledge `--topic` per-flag 硬拒收双标                                                  | `e83628e`  | 拍板维持：如实标注为**迁移礼遇**（曾属 oracle 域的旗标退役后指路，非归属校验双标）             |
| S3  | Speculative     | mutagen 六层函数族同形 return 样板 ×6                                                    | `e83628e`  | 私有 `mutagenOf` 收拢单点；契约签名不变、六层四化实跑对拍正常                                  |
| S4  | Speculative     | MARRIAGE_STARS_BRIEF 杂曜键无互证 + data.ts 尾部错层                                     | `56a0c1e`  | 杂曜基准盘派生随候选 9 同网落地；data.ts 尾部记档不动（拆文件=搬家，不采纳）                   |

## 附一：第五轮挂账核验与收口（2026-11-21）

第五轮未实现的 8 项在本轮全部收口：

| 第五轮候选 | 核验结论（本轮）                                   | 落地提交   |
| ---------- | -------------------------------------------------- | ---------- |
| 2 指针守卫面 | 机制面成立 + 新增实例（AGENTS.md notes 行 / cli-commands.md 测试路径） | `c2df450` |
| 3 GENERATED 漂移 | 变形：README 误伤 / wenmo-tianji 缺位 / notes 死规则 | `c2df450` |
| 4 cli-samples 覆盖休眠 | 成立 + help 与 cli-samples 日期分叉 | `c2df450` |
| 6 建议行投影双写 | 成立                                             | `0124032` |
| 7 测试基建 locality | 成立且扩大（直调 seam 五处）                    | `56a0c1e`（直排豁免半边）|
| 9 星曜键集 | 成立（soul-summary 两表 / STAR_IN_FUQI_GU）        | `56a0c1e` |
| 10 --no-cache 腐烂 | 部分失效（残留两处）                            | `2829a2e` + `c2df450` |
| 13 --topic 重解析 | 成立（actx 先建、:469 重解析）                    | `0124032` |

Speculative #1 ZIWU_LIUZHU 退役（`c4bcb3a`，重建等发起）；#2 三键表清淤、#5 bench 注释、#6 注释腐烂批、#7 意图标注、#8 import 统一（`2829a2e`）；#4 config 措辞（`279521d`）；#3 LAYERS 脱钩断言**拍板继续挂账**（reporter 刻意不依赖树形状）。候选 6 / 13 仍挂账（本轮未拍板）。

## 健康区（两路子代理一致判健康）

`boot-hooks`（教科书级 deep module）· `args/table + parse`（声明表单点兑现）· `host/dispatch`（唯一真相源三方消费）· knowledge 三域接缝（懒加载纪律真实落地）· `chart-cache`（正确性优先纪律完整）· `birth-info`（真太阳时链高内聚）· `astrology-context + sections.test`（装配升 interface 后复刻已消）· `report.test`（矩阵封闭派生范本）· `analysis/context + overview-material`（深 module 样板）· patterns 四分（判词住语料层是文档化刻意切分）· `corpus/index` 深纯函数 · `synastry/chart-view` 消费方契约样板 · school 接缝本体（ADR-004）· grades 派生链 · `analysis/data.ts`（2910 行内部可导航，拆文件=搬家不采纳）。

对「astrology.ts 接缝 strain」的总答：三次 interface 化后主体健康；残余 strain 集中在**分支级小复刻**（第五轮候选 13 + 本轮 N1 + S1），本轮已全部落地，无一处需要重启决策。

## openspec 与提交

- `2026-11-21-brightness-knob-retire`（N3）：已归档折回，extensibility 主 spec 新增 requirement「内核无运行时流派旋钮」。
- `2026-11-21-guard-surface-closure`（候选 2/3/4）：已归档折回，quality-gates 指针守卫扩词元（+3 scenario）/ 漂移探针补生成器自报（+2）/ 新增样例表参数覆盖随回归守卫。
- 提交链：`225cfdc` → `56a0c1e` → `ef5903d` → `2829a2e` → `c4bcb3a` → `c2df450` → `279521d` → `e83628e`（截至本报告未推送）。

## 尾巴与挂账（本轮结束态）

- **内容尾巴**：ZIWU_LIUZHU 方法论重建（退役已落、表保留待重建，等发起）。
- **挂账**：第五轮 Speculative #3（LAYERS 脱钩断言，拍板保留）。候选 6 / 13 已于 2026-11-21 收口（`0124032`）——本节初稿写于收口前，同步于此。
