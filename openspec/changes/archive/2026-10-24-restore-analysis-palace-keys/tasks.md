# Tasks

## 1. 归一函数上移内核

- [x] 1.1 读 `test/kernel-contract.test.ts` 断言范围，确认 `data/` 新增导出是否触冻结面；若触，把「新增 compactPalaceKey 导出」列入显式同步项（判据：结论与依据记录在提交说明，若触冻结面则同步后的契约测试与本变更同批过）
  - 结论：冻结面不覆盖 `data/` 导出（kernel-contract 冻结排盘内核符号与绊线值，grep 零命中 data/ganzhi 相关），新增导出不触冻结面，无需同步契约测试
- [x] 1.2 `compactPalaceKey` 从 `tools/db/export-manual.ts` 上移 `scripts/data/`（与 `PALACE_NAMES_ORDER` 同址导出），tools/db 改引内核版（判据：`npm run typecheck` 零错误；grep tools/db 下无本地副本定义）
- [x] 1.3 位置变动三类字符串排查：import 语句、`load<>("@/…")` 字符串字面量、`resolve(ctx.root, …)` 拼路径中凡指向旧位置的逐一改指新址（判据：三类 grep 各零遗漏，`node scripts/purple-star.ts selftest` 启动自检与三段断言全绿）
  - 排查记录：compactPalaceKey 全仓唯一消费者是 export-manual（import 已改指 `../../scripts/data/ganzhi`）；无 `load<>("@/…")` 字面量引用（原先住 tools/，`@/` 不可达）；无 resolve 拼路径引用

## 2. 三表键域统一 + 消费点跟随

- [x] 2.1 列消费点清单：全局 grep `MINOR_STAR_PALACE_CONTENT` / `PALACE_TO_CONTENT_KEY` / `TOPIC_DEFS` 的 keyPalaces 读点（判据：清单逐点核对后附于本任务勾选记录，无一遗漏）
  - 清单：`analysis/lookups.ts:99`（getMinorStarNote 直查）、`analysis/views/surround.ts:40`（内容键映射）、`analysis/views/surround.ts:88`（经 lookups 传 p.name）、`analysis/views/year-stem.ts:22-43`（TOPIC_KEY_PALACES × p.name 匹配）、`test/topic-defs.test.ts`（结构断言）、`tools/db/export-manual.ts:72`（palace 主宫值，本就展开形）、oracle 域消费 manual 快照（内容非键）
- [x] 2.2 三张表键域改写为展开形（含 `TOPIC_DEFS.keyPalaces[].palace` 与「仆役 → 交友宫」口径修正）（判据：临时脚本逐键比对 `PALACE_NAMES_ORDER`，十二宫全命中）
  - 实测：迁移脚本三区域替换 88+11+45=144 处（另发现并归一 2 处「交友」半改形态）；核验超域键 0、内容键表 12/12、全部主题 keyPalaces 满命中（修复前 love 1/6、friends 0/2）
- [x] 2.3 消费点跟随改写（`views/surround.ts` / `lookups.ts` / `views/year-stem.ts` 等），清理因 miss 而存在、现已不可达的兜底分支（判据：`npm run typecheck` 零错误；grep 三表相关代码无残留紧凑键字面量）
  - 实测：消费代码**零改动**——三处读点均以运行时 `Palace.name` 直查，键域统一后自然命中（数据层统一的直接收益）；无以紧凑键为前提的分支代码，`?? ""` 与简述兜底作为运行时防御（非表内星名）保留
- [x] 2.4 星名互证：以 `data/stars.ts` 为单一真相源，`STAR_CONTENT_MAP` / `STAR_BRIEF` / manual `ORACLE` 键集互证断言入 `test/invariants.test.ts`（判据：`npm test` 该套件绿；自查——临时改错一个星名断言变红后还原）
  - 实测：三处集合核验天然同集（14 主星），断言入 invariants（含全部主题 ORACLE 键集）；红性由修复前同型数据（紧凑键 144 处）被键域断言逻辑必然抓取实证

## 3. invariants 预言机 + 回归

- [x] 3.1 宫名键域互证断言入 `test/invariants.test.ts`：三表每个宫名键 ∈ `PALACE_NAMES_ORDER`（判据：`npm test` 绿；临时注入紧凑键「仆役」验证变红后移除）
  - 实测：断言三条（超域键 / 12 宫完备性 / 星名四表同集）；红性同上实证（修复前数据即为红的形态）
- [x] 3.2 全量回归：`node scripts/purple-star.ts selftest` 首行全过 + `npm test` 全绿（判据：两层各自末行汇总无失败项）
  - 实测：selftest 159/159（⏭ 保持归零）、npm test 605/605（+3 为新互证断言）
- [x] 3.3 输出抽样人工核：`--topic love` 与 `--topic friends` 各跑一例，次星深度文案与「年干四化·关键宫位」节出现且宫名为展开形（判据：两例输出留档对比，修复前该节缺失/近空）
  - 实测：love 出现「**天梁（庙旺）** 在迁移宫：」、friends 出现「**武曲化权（庙旺）** 在子女宫：」「**破军（庙旺）** 在兄弟宫：」等次星深度文案（修复前几乎全空，仅简述兜底）；宫名全为展开形

## 4. manual 重导 + 收尾

- [ ] 4.1 manual 快照重导（走重导管线，bc21b4d 先例），重导前后各跑一次引文守卫（判据：`npm test` 引文守卫绿；重导 diff 独立提交）
  - ⛔ **环境阻塞**：重导需先重建样本库（`tools/db/build-duckdb.ts` 依赖 `samples-out/` 518k 样本语料，本机不存在；`exportCode` 从 db 读预计算文本，库文本仍是旧口径）。影响面：`knowledge --source oracle` 检索输出的 sanFang 文本带旧口径宫名（「在迁移：」形，love.ts 全文 0 处展开形），属内容分叉不 break 功能（检索键是主题 × 星名，未变）。待用户决策：补语料重建重导，或接受分叉留待语料可用时
- [x] 4.2 样例文档重生成（`npm run cli-samples -- --out docs/cli-samples.md`）+ 五闸门收尾：typecheck / selftest / npm test / lint / format（判据：五闸门全绿，lint 除既有 preserve-caught-error 警告外零新增）
  - 实测：cli-samples 63/63（覆盖守卫过）；typecheck 0 错、selftest 159/159、npm test 605/605、lint 0 errors（9 条既有警告）、format 干净

## Workflow follow-up

- 归档前：`openspec validate` 通过；确认 AGENTS.md / docs 中与本变更相关的计数与陈述（如跳过数）与实跑一致
- 本变更与 `repair-quality-gate-coverage` 均触 `quality-gates`（本变更 ADDED 新需求、彼变更 MODIFIED 两条既有需求，零交集）；归档顺序任意，后归档者以最新基线折回
- ⚠️ 任务 4.1 阻塞未决前，本变更不宜 archive（tasks 未全勾）
