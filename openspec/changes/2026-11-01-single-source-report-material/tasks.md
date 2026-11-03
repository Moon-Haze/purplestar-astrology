# 任务 · 报告形态取材收单点

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
取基线必须**先于**任何代码改动；验收命令的退出码直接取命令本身（不接管道、不 `&&` 串接）。

## 1. 取材单点：material 承接「本宫主星」行

- [x] 1.1 取基线：固定样本盘（`--date 2005-05-05 --time 09:30 --city 北京 --gender male`）
      落盘 `--report` 全量输出与 `--topic` 全部主题输出到 `/tmp/`（各一份）。
      判据 `[退出码]`：两条命令退出码均为 0；两份基线文件非空且行数 > 0。
- [x] 1.2 `scripts/analysis/overview-material.ts`：在 `OverviewMaterial` 增 `mainStarLine: string`
      与 `loanTag: string`，注释写明「两形态共用单点」；`buildOverviewMaterial` 的**两个返回
      分支都要给值**（兜底分支按 `isLoan` 计算借宫注，保持该分支现有逐字形态）。
      判据 `[计数]`：`grep -rn "本宫主星：" scripts/` 命中数由 2 处降为 1 处（只在
      `overview-material.ts`）；`grep -rn "借对宫" scripts/analysis/` 命中数由 3 处降为 1 处。
- [x] 1.3 `scripts/analysis/views/overview.ts:79-85` 改消费 `m.mainStarLine`（结构化字段
      `star` / slot `main-palace` 不变）。判据 `[逐字节]`：`--topic` 全部主题输出与 1.1 基线
      `diff` 为 0 行。
- [x] 1.4 `scripts/analysis/report.ts:272-276` 改消费 `m.mainStarLine`、`:201` 的 `loanTag`
      改消费 `m.loanTag`；`report.ts` 内不再出现「借对宫」字面量与「本宫主星：」拼式。
      判据 `[逐字节]`：`--report` 输出与 1.1 基线的 diff 行数 = 该盘借宫主题数（固定样本盘 = 2），
      且每行差异仅为「借对宫」后补回星名（形态：`借对宫论事）` → `借对宫<星名>论事）`），
      其余行 diff = 0。

## 2. 两形态对拍断言（层 2）

- [x] 2.1 在 `test/report.test.ts` 新增断言：同盘同主题下，`--topic` 输出的「本宫主星：」行
      与 `--report`「命盘推演」节同一行逐字相同（剥离 Markdown 标题行与空行后比对）。
      判据 `[计数]`：`ZIWEI_NO_CACHE=1 npm test` 全绿，且层 2「`astrology --report` 全盘报告」
      套件项数 = 基线 + 1。
- [x] 2.2 反向注入：临时把 `buildOverviewMaterial` 的借宫注改回无星名版本（模拟本次修掉的
      漂移），2.1 的断言**必须失败**。判据 `[反向注入]`：注入态下 `ZIWEI_NO_CACHE=1 npm test`
      非零退出且失败信息指向该对拍断言；还原后退出码回 0。
  <!-- 人工执行（2026-11-04）：循环契约吃不下「证据即产出」型任务（正确结果=零代码变更），
       两次实现候选均无暂存被误 skip。由人完成注入实验：report.ts 退回 1.4 前内联拼式 →
       npm test exit=1，失败正指「两形态同源…逐字相同（命宫借宫）」对拍断言；还原后
       exit=0（632/632）。证据：/tmp/inject-test.log、/tmp/restore-test.log -->
- [x] 2.3 断言覆盖借宫盘与非借宫盘各一张（复用 `test/report.test.ts:69` 的女盘空宫样本 +
      一张有主星样本）。判据 `[计数]`：`ZIWEI_NO_CACHE=1 npm test` 全绿，且层 1 与内核层
      （`test/kernel-contract.test.ts` 所在层）项数与基线**完全一致**（内容层改动不得使
      内核层项数变动）。
  <!-- 人工执行（2026-11-04）：首版实现把男盘 wealth 误标借宫（实为实星贪狼）被独立评审
       拒绝 ×2。按评审 required_fixes 重做并实证纠偏：评审建议的「行内含借对宫」断言与
       事实不符（女盘 wealth 行＝天梁化科（落陷），无注），改为按实跑形态断言。终态三例：
       非借宫盘 / 命宫借宫（行带「借对宫天机论事」注）/ 非命宫借宫块（行落借入星）。
       npm test 632/632，层 1=306、内核契约层=5 与基线一致。 -->

## 3. 验证与收尾

- [x] 3.1 `npm run typecheck`。判据 `[退出码]`：退出码 0、报错 0（不用 `any` / `@ts-ignore` 绕过）。
  <!-- 人工验证（2026-11-04）：exit=0。验证型任务，循环「须有暂存产出」契约不适用。 -->
- [x] 3.2 `node scripts/purple-star.ts selftest`。判据 `[计数]`：全绿，项数以首行自报为准
      （与改动前自报数一致 —— 本次不改 selftest）。
  <!-- 人工验证（2026-11-04）：162/162 全绿；本次 change 未触碰 selftest（项数不变属必然）。 -->
- [x] 3.3 `ZIWEI_NO_CACHE=1 npm test`。判据 `[退出码]`：退出码 0；末行分层项数中，层 1 与
      内核层项数与基线一致。
  <!-- 人工验证（2026-11-04）：exit=0，632/632；层 1=306、内核契约层=5，与基线一致
       （本 change 只动层 2：+1 项对拍断言）。 -->
- [x] 3.4 `docs/code/analysis.md` 若描述了「本宫主星」行 / 借宫注的口径，同步为「两形态
      共用 overview-material 单点」的描述。判据 `[计数]`：`grep -rn "本宫主星" docs/ references/
      SKILL.md` 中指向旧两处实现的描述数 = 0。
  <!-- 人工执行（2026-11-04）：首版描述把 loanTag 也说成两形态共用被独立评审拒绝 ×2
       （loanTag 仅 report.ts 标题消费）。按评审 required_fixes 改写 analysis.md 第十节；
       docs/cli-samples.md（已退出版本控制的生成物）重导刷新旧形态样本（旧 0 处/新 2 处）。 -->
- [x] 3.5 收尾卫生：只对本次新增 / 改动的行跑 prettier（不整跑 `npm run format`）。
      判据 `[计数]`：`git diff --stat` 只含预期文件（`scripts/analysis/overview-material.ts`、
      `scripts/analysis/views/overview.ts`、`scripts/analysis/report.ts`、`test/report.test.ts`
      及可能的 `docs/code/analysis.md`），无夹带。
- [x] 3.6 `npx openspec validate --all`。判据 `[退出码]`：退出码 0 且**零警告**。
  <!-- 人工验证（2026-11-04）：exit=0，12 passed / 0 failed，零警告。 -->
