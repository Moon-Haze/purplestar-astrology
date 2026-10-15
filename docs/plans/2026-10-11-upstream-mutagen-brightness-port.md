# 移植上游「运限四化扩展 + 文墨亮度流派」到 purplestar-astrology

## 已拍板的口径

- **体系立场**：SKILL.md「体系硬约束」改写为上游混合口径——排盘与运限四化以文墨天机为准（含大限宫干层），论断框架仍按倪师三合派（命宫为本、三方为用）。禁列收缩为：宫干自化、来因宫（这两条继续禁，mutagen.ts 不引入 detectSelfSihua/findIncomingPalaces）。
- **亮度**：SB 表 4 流派全量引入，default=XD2，主辅杂曜同表，9 档细档 + 3 档粗档塌缩，300 盘对拍基准以覆写后行为重建。
- **绊线测试处置**：selftest/chart.ts 与 school.test.ts 盯 `Palace.selfMutagen`/`Decadal.mutagen`/大限键集合的断言**原样保留**（走纯函数路线，Decadal 不加字段，结构回流依然非法），新增大限宫干四化的**正向断言**；只改写立场文本（SKILL.md、mutagen.ts 文件头、types.ts 注释、CLAUDE.md 两份）。

## 第一批：运限四化扩展（mutagen.ts 纯函数层，不塞 chart 结构）

1. **`scripts/ziwei/mutagen.ts` 新增 5 个函数**（移植上游 sihua.ts，命名与 skill 惯例对齐）：
   - `getDaXianSiHua(chart, dxIndex)`：大限宫干四化——`decadals[dxIndex].palaceBranch` → `Palace.stem` → `SI_HUA_TABLE`；童限期（currentDecadalIndex === -1）返回 null 由调用方标注「童限未起运」。
   - `getDailyStemIndex(lunarYear, lunarMonth, lunarDay, isLeapMonth)` + `getDailyMutagen(...)`：流日干四化，lunar-JavaScript 现算日柱（package.json 显式声明该依赖，iztro 传递依赖不可直接 import）。
   - `getHourlyStemIndex(dayStemIndex, hourBranch)` + `getHourlyMutagen(...)`：五鼠遁流时干四化（上游 `ziStemByDayStem` 表：甲己丙子起…）；晚子时（hourBranch=12）按次日０点的日干处理，实施时对齐上游源码行为。
   - 流月补齐闰月口径：对齐上游 2026-09-05 定的 `split` 规则（农历日 ≤15 取本月干、>15 取下月干；闰十二月后半跨次年干），`getMonthlyStemIndex` 加闰月参数并在标题行注明。
   - 文件头与「体系基准」节改写：四化层次从三层扩为六层（生年/大限宫干/流年/流月/流日/流时），注明大限层是文墨排盘展示口径、论断框架仍按倪师；mutagen.ts:42-50 的上游口径引文同步更新。
2. **CLI 层**（`fortune.ts` + `astrology.ts` + `args.ts` + `help.ts`）：
   - `--daily <农历日 1-30>` / `--hourly <时支 0-12>`：与 `--monthly` 完全同模式——强制配 `--mutagen`（缺即报错指路）、取值链逐级缺省（年=`--yearly` 缺省当年 → 月=`--monthly` 缺省当前农历月 → 日 → 时）、标题行注明推法（「流日干由 lunar-JavaScript 日柱」「流时干五鼠遁，由日干 X 推」）。
   - `--mutagen` 追加「当前大限宫干四化」区块（宫干 Y 化 Z 星落某宫；童限期一行标注）；`--decadal` 专题同样追加该区块（大限四化属大限视图）。
   - `--json` 顶层新增 `daXianSiHua` / `liuRiSiHua` / `liuShiSiHua`。
3. **测试**：invariants.test.ts 加五鼠遁全 60 格独立预言机表、流日干与 lunar-JavaScript 对拍（抽样 1924–2100）、大限宫干四化独立复算；cli.test.ts 用现有 `assertRows` 复用器加 `--mutagen --daily/--hourly` 端到端与 `--json` 新键断言；selftest 加正向样例。

## 第二批：文墨亮度流派（全量 XD2）

1. **数据引入**（`scripts/ziwei/wenmo-brightness.ts`，从上游 wenmo-data.ts + wenmo-tables.generated.ts 裁剪）：
   - 只取 SB_QS/SB_XD1/SB_ZZ/SB_XD2 四表（85 星 × 12 宫）+ 85 星 ID/名称映射；文件头如实标注「来源：文墨天机 v2.5.8 反编译，索引子起一（col = branchIdx(子0)+1）」。
   - `BrightnessSchool = 'QS'|'XD1'|'ZZ'|'XD2'`；映射：7 档制（QS/XD1）1庙2旺3得4利5平6不7陷，5 档制（ZZ/XD2）1庙2旺3平4闲5陷；表值 0/空 → undefined 留白。
   - `setBrightnessSchool()` 导出供测试，模块默认 `'XD2'`；`validateWenmoData` 维度自检。
2. **types.ts**：新增 `Star.brightnessRaw?: string`（文墨细档中文）；`brightness` 三档塌缩规则改为「庙/旺→bright，陷/不/闲→dim，其余 normal」，填充范围从仅主星扩为 SB 表能查到的所有星（主辅煞杂曜同表）。
3. **algorithm.ts 装配覆写**：星曜循环（algorithm.ts:256-273）每颗星查 `wenmoStarBrightness(name, branch, currentBrightSchool)`——命中则覆写 brightness + 写 brightnessRaw；`mapBrightness` 塌缩注释同步。CLI 文本输出形态**零变化**（三档照旧显示），细档只进 `--json`。
4. **连锁校准**：
   - 先产出「XD2 vs iztro 默认逐星逐宫差异清单」，据此评估 patterns 格局命中（isBright/isDim）与 analysis/data.ts 论断文案（bright/dim topic_mods）的脱节条目，按 XD2 口径修订并注明口径。
   - 300 盘基准重建：覆写落地前先确认旧基准全绿；落地后以覆写后行为重新生成 baseline 快照（对比器机制不变），`KNOWN_DIVERGENCES` 清空并在 test/README.md 记录本次口径切换；invariants 的 brightness 取值断言扩入 brightnessRaw。
5. **测试**：wenmo-brightness 单测（四表维度、双向映射方向、XD2/QS 抽样锚点、setBrightnessSchool 归一）；cli.test.ts 补 `--json` brightnessRaw。

## 第三批：文档与口径文件收尾

- **SKILL.md**：体系硬约束节改写（保留「宫干自化」字样——repo.test.ts 哨兵句探针依赖它）；亮度口径节改写（XD2/9 档/新塌缩）；命令速查与参数行补 `--daily`/`--hourly`；知识来源分级声明照旧。
- **CLAUDE.md / .claude/CLAUDE.md** 同步硬约束节；**references/**：options.md（新参数行）、workflow.md（第 2 步知识源表 mutagen.ts 行）、output-contract.md（四化着力点与单问四化变体补大限宫干/流日/流时的引用规则）；**test/README.md**（基准重建记录、school.test 职责描述）。
- cli-samples.ts 补 2–3 条新参数样例，重跑生成器。

## 执行顺序与验证

1 → 2 → 3 串行（都动 algorithm.ts 与测试基建）。每批完成即跑 `npx prettier --check`（新代码匹配 prettier 形态）+ `node scripts/purple-star.ts selftest` + `npm test`（520 项基线，基准重建批预期先红后绿）。全程不提交 git，完成后汇总改动清单。

## 明确不做

- 宫干自化（detectSelfSihua/buildAllSelfSihua）、来因宫（findIncomingPalaces）——禁列保留。
- 童限大命偏移表（上游 yunxian-context）——skill 维持「未起运按命宫论」口径，童限期大限四化只标注不输出。
- 上游 wenmo-config.ts 的 localStorage/URL 分享/10 类流派配置——skill 无消费面。
- 亮度流派切换的 CLI 参数——默认 XD2 写死，函数导出仅供测试。
