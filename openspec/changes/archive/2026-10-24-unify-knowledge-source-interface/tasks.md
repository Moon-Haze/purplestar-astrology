# Tasks

## 1. 归一层 + 接口收窄

- [x] 1.1 cli/knowledge 入口建归一层：三态归一（boolean 裸开关报错）、位置参数回退、limit 数值校验单点（判据：`node scripts/purple-star.ts knowledge --search` 裸开关非零退出且报错走 stderr；`--limit 0` 同）
  - 实测：四例错误形态（books/stars 裸 --search、books `--limit 0`、tianji `--limit abc`）全部 exit=1 + stderr ✓
  - ⚠️ 实现期形态修订（已记入 design）：oracle 的位置参数语义异构（`args._[0]/[1]` 是 topic/star 而非检索词），「查询对象 + 签名收窄」塞不下域特定回退——归一层落成**入口前置守卫** `assertKnowledgeArgs`（三态 + limit 单点），位置参数回退留各域（域知识）；`search(args: CliArgs)` 签名不动
- [x] 1.2 `KnowledgeSource.search` 签名收窄：`CliArgs` → 归一后查询对象（检索词 string、limit number、域特定参数原样）（判据：`npm run typecheck` 零错误——四域实现按新签名改写完成）
  - ⚠️ 随 1.1 修订：签名保持 `CliArgs`（收窄方案被 oracle 位置语义否决，见 design 修订注）；typecheck 零错误达成

## 2. 四域改写 + books 挪位 + 删三壳

- [x] 2.1 books 实现挪 `cli/knowledge/books.ts`（原 `knowledge/sources/books.ts`），错误路径 return 改 throw；`--search` 缺值分支不再走 return（判据：缺值时退出码非零、报错在 stderr）
  - ⚠️ 方向反转（已记入 design 决策 4）：books 原址不动，**stars/tianji/oracle 三域渲染实现从 `cli/knowledge/` 挪进 `knowledge/sources/`**（与 books 同层、同「实现即插件」形态）——`sources/stars.ts:9` 原本就静态反向 import cli（ADR-003 灰区既存），归位后 kernel 运行时零 cli 依赖；extensibility 落地状态表格的 `sources/*.ts` 位置描述保持为真。books 的 return 分支由入口守卫接管（exit 0 → exit 1 修复）
- [x] 2.2 删三个纯转发壳 `knowledge/sources/{stars,tianji,oracle}.ts`；registry 清单项改为经 `await import` 直引 `cli/knowledge/` 各域实现（断环模式不变）（判据：`knowledge --source stars --search 紫微` 等四域各跑一例输出正常）
  - 实测：四域冒烟全通；registry **一行未改**（它引用的 sources/* 从壳变实现）；cli/knowledge/ 只剩 index.ts（入口 + 守卫）
- [x] 2.3 文件物理变动三类字符串排查：import 语句、`load<>("@/…")` 字符串字面量、`resolve(ctx.root, …)` 拼路径中凡引用旧文件路径的逐一改指新址（判据：三类 grep 各零遗漏，`node scripts/purple-star.ts selftest` 三段全绿）
  - 排查记录：`cli/knowledge/{stars,tianji,oracle}` 引用全仓零残留（仅 types.ts 注释提及，已同步）；无 `load<>("@/…")` 指向旧路径；无 resolve 拼路径引用
- [x] 2.4 selftest 断言修正：commands.ts 中 books 缺值断言从「stdout 含文案」改为「非零退出」，stars/tianji/oracle 缺值断言保持（判据：selftest 全绿且四域错误断言形态一致）
  - 实测：books 缺值断言改 try/catch 期待 throw（与 stars 同款），selftest 159/159

## 3. 生年层归位内核 + 冻结面同步

- [x] 3.1 内核 `mutagen.ts` 补 `getNativeMutagen(chart)`（chart → `lunarInfo.yearStem` → 生年四化；yearStem 红线注释随迁同址），fortune/sihua-helpers 改引内核版（判据：`--mutagen` 输出与改前逐字一致——生年四化数值零变化）
  - 实测：`--mutagen` 输出「【生年四化】年干 庚 · 化禄 太阳 → 夫妻宫(亥)…」正常；原 `nativeSiHuaOf` 删除，5 个消费点（mutagen/yearly/decadal/focus + 同星引动）改引内核
- [x] 3.2 六层可空性统一为一个结果类型，流日非法日期中文报错下沉内核（判据：`npm run typecheck` 零错误；`--daily` 给非法日期报错文案不变）
  - ⚠️ 修订：可空性已显式在各层类型签名（`| null`），强行造统一类型会改六层签名即破冻结面——不做；流日报错下沉经查 **放弃**（astrology.ts:207 对 `getDailyMutagen` 的 null 走条件跳过，「非法→null」是内核 API 的合法语义而非待修样板），fortune 侧 throw 文案原位保留
- [x] 3.3 `test/kernel-contract.test.ts` 显式同步：新增 `getNativeMutagen` 符号与返回形状断言，既有六层断言一字不动（判据：`npm test` 内核契约套件绿；提交说明引用冻结面纪律）
  - 实测：契约名单加入 getNativeMutagen + 签名断言 `(chart)`，既有断言未动；kernel-contract 5 pass

## 4. 回归 + 收尾

- [x] 4.1 四域行为回归：books 多关键词 AND / 单关键词 / 高亮位置 / 默认 limit 各跑一例与改前逐字对拍（判据：命中集合与 snippet 零变化）
  - 实测：`--search "紫微 化权"`（引号）与纯位置参数两形态均「命中 2 条」（AND 行为逐字一致）；单关键词/默认 limit 经 cli-samples 样例覆盖（63/63）
- [x] 4.2 样例文档重生成 + 五闸门：typecheck / selftest / npm test / lint / format；cli-samples 若含 books 缺值样例，期望值同步 exit 1（判据：五闸门全绿，覆盖守卫 OPTION_GROUPS ⊆ SAMPLES 通过）
  - 实测：cli-samples 63/63（样例库无裸 --search 错误样例，无需同步）；typecheck 0 错、selftest 159/159、npm test 605/605、lint 0 errors（9 条既有警告）、format 幂等
  - 附带同步：docs/code/knowledge.md（「薄包装」→「实现即插件」）、AGENTS.md 数据流树（cli/knowledge/ 单文件化）、types/registry 注释、mutagen.ts 两处旧指路（constants.ts→data/sihua、CLAUDE.md→AGENTS.md）

## Workflow follow-up

- 归档前：`openspec validate` 通过；需求「四域统一检索」折回时确认既有 scenario 无减少（本 delta 全量保留了 6 条并新增 1 条）
