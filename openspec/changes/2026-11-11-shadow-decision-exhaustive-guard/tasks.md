# Tasks

> 执行纪律（来自 openspec/config.yaml operations.apply）：回归链路恒设 `ZIWEI_NO_CACHE=1`；
> 验收命令的退出码直接取命令本身，不得接管道或 `&&` 串接；format 只对本次改动文件做
> 检查，不整跑写模式。修复前基线（2026-11-11 提案会话实测）：
> `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 164/164 全绿；output-select 组
> 五个 astrology 参数（json / no-cache / view / config / template）未表态；探针
> `--info --view daxian` 与 `--palaces --view daxian` 均 exit=0 静默吞（design.md
> Context 探针表 #1/#2）。任务顺序按 TDD 红→绿设计：1.1 的红是**预期中间态**，
> 2.x 逐步收口。

## 1. 穷尽性断言（实现，先红自证）

- [x] 1.1 `scripts/cli/selftest/args.ts` 的 `runDeclarationTable`（:148 起）新增一条
      断言：遍历 `OPTION_GROUPS`，取 `role === "output-select"` 且 `cmds` 含
      `"astrology"` 的每个参数，若 `shadow` 与 `noShadow` 均未声明则 throw，消息点名
      全部未表态参数名（对齐既有 `unmarked` role 检查 :203-206 的粒度递进体例；
      断言体走本文件已有的 `table` namespace import，不新增依赖）。完成判据：
      `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 中该断言**红**，报告恰点名
      `json`、`no-cache`、`view`、`config`、`template` 五个——不含 `out` / `search` /
      `limit` / `source` / `book`（域外不误伤）；这份点名同时是断言有效性的反向注入
      自证（增方向：新参数不表态即红；删方向：撤掉任一已表态参数的标志同样红）。

## 2. 存量表态与 view 行为面（实现）

- [x] 2.1 `scripts/cli/args/table.ts` 五行标志：`view`（:320-325）加 `shadow: true`；
      `json`（:248-252）/ `no-cache`（:254-259）/ `config`（:361-368）/ `template`
      （:369-374）各加 `noShadow: true`；同步 `OptionSpec.noShadow` 的 jsdoc（:38-39
      从「专题深入组的 palaces」扩为「显式声明不在被吞检测域，两个 role 均可作表态」）。
      完成判据：`npm run typecheck` 退出码 0；`grep -n "noShadow: true"
      scripts/cli/args/table.ts` 命中 palaces / json / no-cache / config / template
      五处。注意：本步后 1.1 断言对 view 满足、但快照 S 断言红（view 入域 12→13）——
      预期中间红，由 2.3 收口。
- [x] 2.2 `scripts/cli/commands/astrology.ts` 两处：`--topic` 消费白名单（:225）
      `["yearly", "monthly"]` → `["yearly", "monthly", "view"]`，注释补「view 是
      topic 的展示口径参数（:456-464 读它）」；`--report` 分支的 bespoke view 检查
      （:488-492）整块**移到** `assertNoShadowedFeatures`（:487）之前，文案不动
      （view 入域后不移则 bespoke 变死代码，删则丢「运限视角见 --topic --view」指路）。
      完成判据（CLI 实跑、退出码直接取命令本身）：`--info --view daxian` 与
      `--palaces --view daxian`（样本 `astrology 2011-06-24 07:45 男 杭州`，虚构）
      非零退出、stderr 含「不会生效」与 `--view`；`--topic love --view daxian`
      exit=0 出「【主题论断」；`--report --view daxian` 非零退出、stderr 仍为
      「--report 为本命静态口径，不接受 --view」起头的 bespoke 文案（移序未改行为）。
- [x] 2.3 `scripts/cli/selftest/args.ts` 快照 S（:174）12 项扩为 13 项（加 view），
      注释写明推进理由（view 显式表态入域，有理由的基线推进，非漂移迁就——沿
      :170-172 体例）。完成判据：快照串恰为
      `ages,daily,decadal,focus,hourly,info,monthly,mutagen,pattern,report,topic,view,yearly`
      （13 项、字母序，topic < view < yearly）；selftest 中「语义角色派生与原字符串
      反推等价」断言绿。
- [x] 2.4 `test/report.test.ts` 既有「独占分支 × 运限层级参数」it（:222 起）的枚举
      扩 view 格：block 方向给 `--info` / `--palaces` 两分支各加
      `["--view", "daxian"]` 探针（断言含「不会生效」）；`--report × --view` 已由
      :211-212 钉住（断言含 `--report` 与 `--view` 子串，移序后仍成立），确认即可；
      allow 方向（:245 起）加 `--topic love --view daxian` 必须放行（不报「不会生效」、
      出「【主题论断」）。完成判据：`ZIWEI_NO_CACHE=1 node --test test/report.test.ts`
      全绿；反向注入——临时撤掉 view 的 `shadow: true` 再跑 selftest 应红（1.1 断言
      点名 view + 快照断言同时红），验完还原。

## 3. 文档同步（实现）

- [x] 3.1 `docs/code/cli-args.md` 语义标志节（:63 起）与 SHADOWABLE_KEYS 节（:90 起）：
      `noShadow` 语义扩义（两个 role 的表态位，output-select 组派生只读 `shadow`）；
      SHADOWABLE 成员列举按 2.3 实际输出同步（12→13、含 view）。完成判据：改后读回，
      成员列举与 `[...SHADOWABLE_KEYS].sort().join(",")` 实际输出逐项一致。
- [x] 3.2 核对 `docs/code/cli-commands.md` 独占分支与优先级链一节：若陈述了被吞成员
      集合或 `--topic` 白名单（现写 yearly/monthly）则同步补 view；若只做行为级表述
      则确认与新行为一致、不动。完成判据：该节读后与 2.2 实跑行为无出入；如改动，
      `grep -n "view" docs/code/cli-commands.md` 可见补记。

## 4. 闸门验证（人工验证项）

- [x] 4.1 `npm run typecheck` → 退出码 0、零错误。
- [x] 4.2 `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` → 全绿，首行合计
      自报（基线 164 + 新断言 1 = 预期 165，以首行自报为准，不写死核对）；三段
      （排盘 / 古籍 / 合盘）均绿。
- [x] 4.3 `ZIWEI_NO_CACHE=1 npm test` → 全绿（排盘输出零变化，300 条对拍基线不受
      本变更扰动；`test/report.test.ts` 层项数随 2.4 新增断言变化，属 CLI 层非内核层）。
- [x] 4.4 风格闸门：`npm run lint` 退出码 0；`npx prettier --check
      scripts/cli/args/table.ts scripts/cli/selftest/args.ts
      scripts/cli/commands/astrology.ts test/report.test.ts` 通过。**不整跑
      `npm run format`**（最小 diff 纪律）。
- [x] 4.5 CLI 终验（design.md Context 探针表逐条复跑，退出码直接取命令本身）：
      #1 `--info --view daxian`、#2 `--palaces --view daxian` 从静默变非零退出点名；
      #3 `--report --view daxian` 报错文案不变；#4 `--info --json` 仍报 bespoke
      （json 标 noShadow 后其逐分支守卫全数保留）；#5 `--info --no-cache`、#7
      `--topic love --view daxian`、#8 `--topic love --template` 行为不变（noShadow
      四参数派生中性，template 早退出口不在本域）。
- [x] 4.6 `git diff --stat` 核对改动面：恰为 `scripts/cli/args/table.ts` /
      `scripts/cli/selftest/args.ts` / `scripts/cli/commands/astrology.ts` /
      `test/report.test.ts` / 两份 docs（含核对性不动）/ 本变更目录——无新增测试
      文件（`test/README.md` 层表与 `test/lib/run.ts` LAYERS 零改动，内核层测试项数
      不动，AGENTS.md:311-312）。

## Workflow follow-up（归档参考，不进任务进度）

- 归档前 `openspec validate --all` 须 0 错误 0 警告。
- 一个逻辑变更一个 commit：代码 + 测试 + 文档 + `openspec/`（本变更目录与归档件）
  一并提交。
- 归档用 `openspec-archive-change` 工作流；归档后本变更的 ADDED 需求折回
  `openspec/specs/quality-gates/spec.md` 主 spec。若 2026-11-09
  `exclusive-branch-shadowable-gap` 尚未归档，两者互不阻塞（本变更未触碰其 delta）。
- 本变更不改项目约束（AGENTS.md「项目约束」节无须同步）：失败可见性 :251 的既定
  红线在本变更后对 view 同样成立，穷尽性断言是给该红线加的增长方向守卫。
