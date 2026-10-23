# Tasks

> 实施备注：任务 1.4–1.8 是实施时全仓扫描**新发现**的同规则残留（原任务清单未穷举文件），
> 属同一需求（集合基数不写死）的范围内，一并修掉并在此登记。

## 1. CLI 文案层（写死清零）

- [x] 1.1 `scripts/cli/knowledge/oracle.ts` 的非法主题报错改为自报：数量取
  `Object.keys(TOPIC_LABEL).length`（该文件已 import，零新增依赖），键列表保持现状。
  验证：`node scripts/purple-star.ts knowledge --source oracle --topic nosuch` 的消息含派生
  出的数量且等于 `TOPIC_KEYS.length`，消息内不再出现「13 个之一」。
- [x] 1.2 `scripts/cli/args/table.ts` 的 `--topic` 描述去掉写死数字，改为指向权威清单
  （不带值时列清单）；**不得**为此引入 `@/` 依赖（该模块须保持零依赖纯数据）。
  验证：`help` 与 `astrology --help` 的 `--topic` 行不再出现任何集合计数；
  `grep "@/" scripts/cli/args/table.ts` 无命中。
- [x] 1.3 `scripts/cli/selftest/args.ts` 的注释同步（现写「`topic` 的 13 个 key」）。
  验证：注释不再含写死计数；全仓 grep 无该表述残留（排除 `docs/plans/`、`docs/reviews/`
  历史快照）。
- [x] 1.4 `scripts/cli/commands/command-meta.ts` 的 knowledge 域说明：去掉「13 主题」，
  改为「各主题 × 十四主星」（help 路径的轻模块不引重依赖，故不派生数字）。
  验证：`help` 的 knowledge 段不再出现集合计数。
- [x] 1.5 `scripts/cli/selftest/render.ts` 的断言标题与返回文案由写死「13 主题」改为
  `Object.keys(TOPIC_LABEL).length` 派生（该文件已 import `TOPIC_LABEL`）。
  验证：selftest 报告中该断言标题与文案随主题键集自动变化。
- [x] 1.6 `scripts/cli/commands/astrology.ts` 的 `--topic` 注释同步（现写「列 13 主题清单」）。
  验证：注释不再含写死计数。
- [x] 1.7 `scripts/data/stars.ts` 的注释：去掉对**外部**站点库（`STAR_DB`）的「13 主题」
  写死数（该库不在本 skill 内，数字会独立漂移）。
  验证：注释不再含写死的主题集合计数。
- [x] 1.8 `SKILL.md` 的 knowledge 域表格行、`test/README.md`、`test/tools/build-fixtures.ts`、
  `test/tools/verify-source.ts` 的「13 主题」表述：改为不写死数字（SKILL.md 属分发面、
  用户可见）。验证：全仓 grep「13 个之一 / 13 个 key / 13 主题 / 十三主题」无命中。

## 2. 断言改盯一致性

- [x] 2.1 `scripts/cli/selftest/commands.ts` 的主题报错断言由「消息含 `13 个之一`」改为
  「消息含由 `TOPIC_KEYS.length` 派生出的数量，且等于实际键集长度」。
  验证：`selftest` 全绿；**负向验证**——临时把 oracle 文案改回写死的「13 个之一」时该断言
  必须失败，还原后恢复绿。
- [x] 2.2 `test/cli.test.ts` 同处断言做同样改法，并追加一条交叉断言：`knowledge` 与
  `astrology` 两条路径的自报数量相同。验证：`npm test` 全绿；同样做一次负向验证
  （写死文案时断言失败）。

## 3. 文档口径同步

- [x] 3.1 `references/options.md` 的 `--topic` 行：去掉「13 主题」写法，改为不写死数字 +
  点明学业科名为官禄宫别名视图、清单以裸开关为准。验证：改后该行不出现集合计数。
- [x] 3.2 `references/workflow.md` 的「十三主题清单裸开关即列」改为不写死数字的表述。
  验证：改后不含「十三主题」。
- [x] 3.3 `references/output-contract.md` 的两处「十三主题」同步（`:110` 主题形态、`:140`
  主题对照）；`:147` 的「13 个板块」是 `--report` 的契约固定产品口径，**保持不动**。
  验证：`grep -rnE "十三主题|13 主题" references/` 无命中；`npm test` 的引文守卫段仍绿。

## 4. 收尾核验

- [x] 4.1 三层闸门全跑：`npm run typecheck` · `node scripts/purple-star.ts selftest` ·
  `npm test`，三者均 0 错误。
- [x] 4.2 全仓残留扫描：`grep -rnE "13 个之一|13 个 key|13 主题|十三主题" scripts/ test/
  references/ SKILL.md docs/user-guide/` 应无命中（`docs/plans/`、`docs/reviews/` 的历史
  快照按仓库口径不追改；「13 个板块」不在本项范围）。
- [x] 4.3 三处数字一致确认：`astrology --topic` 裸开关清单、`astrology --topic <非法值>`
  报错、`knowledge --source oracle --topic <非法值>` 报错，三者的数量一致且等于
  `TOPIC_KEYS.length`。
