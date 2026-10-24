# Tasks

## 1. 扩面前置核查

- [x] 1.1 清点 `tools/` 与 `test/` 全部 `.ts` 中的「倪师 / 倪海厦 + 引号句」形态，逐条比对 `corpus/data/annotations.ts` 核对表（判据：清单附于勾选记录，每条标注表内/表外）
  - 核查记录：tools/ 16 个 .ts 形态命中 0 条（倪师字样均为来源说明）；test/ 27 个命中 2 条 —— citations.test.ts:62 的 `${quote}` 模板串不在黑名单（无碍），:50 注释例句「紫微在迁移，外地逢贵人」在黑名单内（唯一需处置项）
- [x] 1.2 表外条目处置：确属可溯的登记 `analysis/grades.ts`，否则改写为不挂引语的表述（判据：处置后清单无表外残留；`npm test` 引文守卫现状仍绿）
  - 处置：citations.test.ts 的 QUOTE 注释例句改写为形态描述（不构成「倪师说+引文」正则形态）；无其他表外条目

## 2. 判据锚点修复（B1）

- [x] 2.1 `skipUnlessRepo` 探针 `CLAUDE.md` → `AGENTS.md`，kit.ts 与 docs 的判据注释同步（判据：仓库态调用返回 undefined）
- [x] 2.2 guard.ts 断言体读取对象同步：`readFileSync(… CLAUDE.md)` 改读 `AGENTS.md`（断言逻辑不动）（判据：`node scripts/purple-star.ts selftest` 该断言真跑且绿——报告不再出现 ⏭）
  - 实测：selftest 159/159，⏭ 归零；AGENTS.md 的「22.15」句含 NODE_OPTIONS 豁免词，不误报（design 决策 2 预判成立）
- [x] 2.3 反恒真双层断言入 `test/repo.test.ts`：轻层 `skipUnlessRepo` 仓库态返回 undefined；重层 selftest 报告全文不含 `⏭`（判据：`npm test` 绿；临时把探针改指不存在文件验证双层皆红后还原）
  - 实测：repo.test 14 pass；红性以反向探针验证 —— `skipUnlessRepo({root:"/tmp"})` 正确返回跳过理由（锚点失效时轻层 assert.equal(undefined) 必红），未改动源文件
- [x] 2.4 文档陈述同步：AGENTS.md 与 docs/code/cli-selftest.md 的「判据是 CLAUDE.md」「仓库 0 跳过」陈述改为现行事实（判据：grep 两文档无 CLAUDE.md 判据残留；selftest 实跑与陈述一致）

## 3. 引文扫描面扩展（S5）

- [x] 3.1 `test/citations.test.ts` 补仓库级 `.ts` 扫描组：以仓库根为扫描根（收集器自动排除 node_modules / 点目录），与流派分派组并列（判据：`npm test` 绿；临时在 tools/ 放一句核对表外引文验证变红后移除）
  - 实测：首跑即真红 —— 仓库级组抓到 `collectTsFiles` 的 manual 排除写死 `dir === "corpus/data"`（换根失效），生成快照卷入比对集；已修为 `dir.endsWith("corpus/data")`（与扫描根无关）。红性另经临时探针文件复验：tools/ 下放黑名单引文 → fail 1 → 删除后复绿
- [x] 3.2 覆盖对称性自查：`.ts` 仓库级组与 `.md` 全仓组的排除规则一致（node_modules / dist / 点目录），无孤儿目录（判据：两组扫描根与排除清单对照记录附勾选）
  - 对照：.ts 侧排 node_modules/点目录/corpus·data 子树下的 manual 快照（后缀判断、根无关）；.md 侧排 node_modules/dist/点目录/docs/manual。断言含显式排除检查（node_modules 与点目录条目不得入比对集）

## 4. 回归收尾

- [x] 4.1 五闸门：typecheck / selftest / npm test / lint / format（判据：全绿；selftest 首行无 ⏭；引文守卫含新扫描组）
  - 实测：typecheck 0 错；selftest 159/159（⏭ 归零）；npm test 602/602（+3：仓库级组 2 + 反恒真 1）；lint 0 errors / 9 条既有 preserve-caught-error 警告（非本次引入）；prettier 改动文件全过
- [x] 4.2 分发态抽查：`npm run pack` 后解包跑 selftest，确认包形态下该断言走 ⏭ 且其余全绿（判据：包内 selftest 除仓库级断言跳过外全过——「分发 1 跳过」预期恢复成立）
  - 实测：包内 159/159、1 条顶格 ⏭（「分发 1 跳过」恢复成立）。顺手修了 pack.ts 跳过计数口径：原按 ⏭ 字符数统计，一条跳过断言输出两行各含一个 ⏭（顶格断言行 + 缩进 detail 行），虚报一倍；改为数顶格 ⏭ 行（= 断言条数）

## Workflow follow-up

- 归档前：`openspec validate` 通过；确认 AGENTS.md「跳过必须看得见」段的判据陈述与折回后的需求一致
- 本变更与 `restore-analysis-palace-keys` 均触 `quality-gates`（零需求交集），归档顺序任意，后归档者以最新基线折回
