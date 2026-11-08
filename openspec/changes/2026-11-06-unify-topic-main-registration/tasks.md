# Tasks

> 任务分两类：**【实现】**= 改代码 / 工件，完成判据是命令与机器可查结果；**【人工验证】**=
> 需要人读结果、下判断的项，完成判据是判读标准。全程不碰排盘内核与 CLI 分发；不动
> `views/surround.ts` / `views/mutagen.ts` 的渲染期登记。

## 1. 基线先行（改码前完成）

- [x] 1.1 【人工验证】取输出基线并留档（`/tmp/` 或评审附件，改后逐字节对账用）。固定样本盘集
      三张 + 两形态：
      ```bash
      node scripts/purple-star.ts astrology --date 1990-05-15 --time 09:30 --gender male --report
      node scripts/purple-star.ts astrology --date 2000-04-06 --time 00:15 --gender male --report
      node scripts/purple-star.ts astrology --date 2024-11-20 --time 12:00 --gender male --report
      node scripts/purple-star.ts astrology --date 2000-04-06 --time 00:15 --gender male --topic overview
      node scripts/purple-star.ts astrology --date 2000-04-06 --time 00:15 --gender male --topic wealth
      ```
      判据：5 份产物落盘且非空；2000-04-06 盘的 report 含天相主场段（`grep "论断详见「命格总览」"` 命中）。
- [x] 1.2 【人工验证】记录测试基线计数（改后对账用）：
      `ZIWEI_NO_CACHE=1 npm test` 的分层汇总末行（层 1 / 层 2 / 层 3 各层项数 + 总计），
      以及 `node scripts/purple-star.ts selftest` 首行自报项数。判据：数字已抄录留档。

## 2. 主删改：删除内联兜底登记

- [x] 2.1 【实现】`scripts/analysis/report.ts`：删除核心论断节的两处内联登记——
      `:244-247`（3 行注释 + `options.dedupe?.set(m.content, TOPIC_LABEL[topic])`）与
      `:256-259`（2 行注释 + `options.dedupe?.set(m.secondStarContent, TOPIC_LABEL[topic])`）。
      `verdictLines.push(m.content)` / `verdictLines.push(m.secondStarContent)` 两行**保留**。
      完成判据：`grep -n "dedupe" scripts/analysis/report.ts` 仅剩 3 行——`:48`（`ReportOptions`
      类型声明）、`:277` / `:283`（向 views 传参）；全文件无 `dedupe?.set`。
- [x] 2.2 【实现】JSDoc 收口：`getTopicMainContentTexts`（`report.ts:125-138`）注释升格声明
      「本板块哪些全文登记主场的**唯一实现**」；`ReportOptions.dedupe`（`:42-48`）注释复核，
      其「主场登记由装配层预扫描完成」句在删码后成立，保留。
      完成判据：`grep -n "幂等重写\|未预扫描的调用方" scripts/analysis/report.ts` 零命中；
      `npm run typecheck` 0 错误。
- [x] 2.3 【实现】风格闸门只对本次改动行跑：`npm run lint` 通过；`npm run format` 无新增差异
      （或仅本文件改动行）。判据：两命令退出码 0。
- [x] 2.4 【人工验证】逐字节对账（纯重构验收核心）：重跑 1.1 的 5 条命令产出改后产物，
      与基线逐字节 `diff`。判据：**5 份 diff 全部为 0 行**；发现任何非 0 行差异即本 change
      失败，回查删码是否动了输出路径。

## 3. 死 import 清除（独立 commit，不顺带）

- [ ] 3.1 【实现】`scripts/analysis/report.ts:23`：import 中删去 `starBadge` 名
      （`buildOverviewMaterial` 保留——`:144`、`:198` 在用）。`views/surround.ts` 的同名使用
      不受影响（它自带 import）。
      完成判据：`grep -c "starBadge" scripts/analysis/report.ts` 输出 `0`；
      `npm run typecheck` 0 错误；`npm run lint` 通过。
- [ ] 3.2 【人工验证】本 commit 单独提交（不与任务 2 混装），提交信息注明「复核发现：仅
      import 行 1 处命中」。判据：`git log` 中任务 2 与任务 3 为两个独立 commit；
      CLI 产物与 2.4 对账后基线仍逐字节一致（import 清除不影响输出）。

## 4. 对拍断言（层 2 守卫落地）

- [x] 4.1 【实现】`test/astrology-sections.test.ts` 既有 describe「全盘报告装配：大限节唯一与
      全文首现」内新增 **1 个 it**（无新文件，不触 `test/README.md` 层表与 `run.ts` LAYERS），
      含三组断言（样例盘复用本文件 `chartFor` 管线）：
      1. **取材对拍**：对 `TOPIC_KEYS` 全部主题，`getTopicMainContentTexts(chart, topic)` 逐字
         等于 `buildOverviewMaterial(makeContext(chart, topic, { view: "daxian", liunianYear: 2027, liuyueMonth: 5, daXianIndex: <任一有效下标> }))`
         的 `[content, secondStarContent]` 过滤非空集——钉「内容与 AnalysisOptions 无关」；
      2. **表键检查**：fresh `Map` 作 `dedupe` 传给 `getTopicReport(chart, topic, { dedupe })`，
         调用后该主题的预扫描全文 **不得** 出现在表键中——钉「渲染路径不登记主星全文」（
         注明结构前提：本宫被 `isMain` 跳过、sanFang 各宫 contentKey 互异、四化注是另一文本域）；
      3. **主场落点**：对 2000-04-06 盘 `buildReport`，每条预扫描全文在其语义主场板块 section
         内出现且全报告恰一次——钉端到端 0 落空。
      完成判据：`ZIWEI_NO_CACHE=1 npm test` 全绿。
- [x] 4.2 【人工验证】项数对账（内核层越界报警器）：分层汇总与 1.2 基线比对。判据：
      **层 2 恰 +1**；层 1 / 层 3 项数与基线一致；总计 = 基线 + 1。
- [x] 4.3 【人工验证】突变实验（证明断言不是恒真守卫，三态各留实跑记录）：
      1. 临时在测试内给渲染侧取材注入视角依赖（或本地临时改 `buildOverviewMaterial` 让
         `content` 随 `ctx.view` 变化）→ 断言 1 变红；
      2. 临时恢复 `report.ts` 内联 set 一处（`options.dedupe?.set(m.content, ...)`) → 断言 2
         变红（若此处出现**假红**——表键检查误伤 surround 的合法登记——则断言 2 设计失效，
         回炉 design D3，不得放宽断言迁就）；
      3. 临时把预扫描清单砍掉 `secondStarContent` 一项 → 断言 1 与断言 3 变红。
      判据：三态红、还原后全绿，红/绿输出摘要留档评审说明。

## 5. spec 与文档收口（人工验证）

- [ ] 5.1 【人工验证】`docs/code/analysis.md` 复核：十节「第二主星……在本板块核心论断首现并
      登记主场」句在删码后是否仍无歧义（登记动作已归预扫描）。判读标准：概念句仍真则**不改**
      （最小 diff）；若读起来像「渲染时登记」则微调一语，改动 ≤ 2 行。
- [ ] 5.2 【人工验证】`docs/code/cli-commands.md` 快速复核 `--report` 装配描述是否有「渲染时
      登记」表述需同步（grep 预登记 / 首现 / 主场）。判据：无表述漂移，或同步 ≤ 2 行。

## 6. 全量验收（人工验证，闸门命令退出码直取、不接管道）

- [ ] 6.1 【实现】跑齐三件套：
      `npm run typecheck`（0 错误）→ `node scripts/purple-star.ts selftest`（全绿，项数以首行
      自报为准）→ `ZIWEI_NO_CACHE=1 npm test`（全绿）。
      判据：三命令退出码均为 0。
- [ ] 6.2 【人工验证】终态对账清单（对照 1.x 基线逐项核）：CLI 产物 diff=0（5/5）；层 2 +1、
      层 1/3 不动；selftest 项数自报不因本 change 减少；提交序列 = commit A（主删改 + 断言，
      或按评审习惯再分）+ commit B（死 import）。判据：清单 6 项全勾，缺一不归档。
