# Tasks

> 执行纪律（来自 openspec/config.yaml operations.apply）：回归链路恒设 `ZIWEI_NO_CACHE=1`；
> 验收命令的退出码直接取命令本身，不得接管道或 `&&` 串接；format 只对本次改动文件做
> 检查，不整跑写模式。修复前基线（2026-11-09 提案会话实测）：`test/report.test.ts`
> 单文件 10 tests 全绿；四条独占分支 × daily/hourly 实跑 exit=0 静默吞。

## 1. 声明表单点修复（实现）

- [x] 1.1 `scripts/cli/args/table.ts` 给 daily（:286-291）与 hourly（:293-298）各补一行
      `shadow: true`（对齐同组 monthly :280 的写法，不动其他字段）。完成判据：
      `grep -n "shadow" scripts/cli/args/table.ts` 在 daily / hourly 两声明块内各命中一行；
      CLI 实跑 `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts astrology --date 1990-05-15
      --time 09:30 --gender male --topic love --daily 10` 退出码非 0，stderr 点名
      `--daily` 并含「独占分支」指路文案。
- [x] 1.2 `scripts/cli/selftest/args.ts:171` 的 SHADOWABLE 快照串 10 项扩为 12 项，注释
      写明扩项理由（修独占守卫域缺口，运限层级族全员入域；非漂移迁就）。完成判据：
      快照串恰为 `ages,daily,decadal,focus,hourly,info,monthly,mutagen,pattern,report,topic,yearly`
      （12 项、字母序，daily < decadal）；`ZIWEI_NO_CACHE=1 node scripts/purple-star.ts
      selftest` 中「语义角色派生与原字符串反推等价」断言绿。

## 2. 测试钉点（实现）

- [x] 2.1 `test/report.test.ts` 既有「独占分支」describe（:104 起）内新增一个 it：
      **block 方向**——四条独占分支（`--info` / `--palaces` / `--topic` / `--report`）×
      {`--monthly`, `--daily`, `--hourly`} 共 12 组合逐一 `cmdFails`，断言报错文本点名
      对应参数（复用既有 `MALE` 夹具与 `cmdFails` 助手）；**allow 方向**——
      `--topic love --yearly 2027` 与 `--topic love --monthly 5` 走 `cliCmdInProcess`
      必须正常出「【主题论断」输出、不报「不会生效」。完成判据：
      `ZIWEI_NO_CACHE=1 node --test test/report.test.ts` 全绿（11 tests，原 10 + 新 1）；
      故意临时撤掉 daily 的 shadow 标志再跑一次应红（反向注入验证断言有效），验完还原。
- [x] 2.2 确认无新增测试文件、`test/README.md` 层表与 `test/lib/run.ts` LAYERS 零改动
      （内核层测试项数不动，AGENTS.md:312）。完成判据：`git diff --stat` 仅含
      table.ts / args.ts(selftest) / report.test.ts / 两份 docs 与本变更目录。

## 3. 文档同步（实现）

- [x] 3.1 `docs/code/cli-args.md:90-94`：SHADOWABLE_KEYS 描述「标了 `shadow` 的五项」
      改「七项」，明列 daily / hourly 加入（yearly / monthly / daily / hourly / focus /
      topic / report）。完成判据：改后读回，五→七、成员列举与
      `[...(SHADOWABLE_KEYS)].sort()` 实际输出一致。
- [x] 3.2 核对 `docs/code/cli-commands.md` §4.6（独占分支与优先级链，:145-159）：若其
      陈述了被吞参数的成员集合则同步补 daily/hourly；若只做行为级表述（「其余功能参数
      不会生效……报错指路」）则确认与新行为一致、不动。完成判据：该节读后与实跑行为
      无出入；如改动，`grep -n "daily" docs/code/cli-commands.md` 可见补记。

## 4. 闸门验证（人工验证项）

- [x] 4.1 `npm run typecheck` → 退出码 0、零错误（本变更未动类型标注，属例行闸门）。
- [x] 4.2 `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` → 全绿，首行合计与
      分段自报正常；args 快照断言（1.2）与排盘 / 古籍 / 合盘三段均绿。
- [x] 4.3 `ZIWEI_NO_CACHE=1 npm test` → 300 条对拍全绿（排盘输出零变化，基线不受
      本变更扰动）。
- [x] 4.4 风格闸门：`npm run lint` 退出码 0；`npx prettier --check
      scripts/cli/args/table.ts scripts/cli/selftest/args.ts test/report.test.ts`
      通过。**不整跑 `npm run format`**（最小 diff 纪律）。
- [x] 4.5 CLI 终验（退出码直接取命令本身）：block 四条
      （`--topic love --daily 10` / `--report --daily 10` / `--topic wealth --hourly 3` /
      `--info --daily 10`）全部非零退出且 stderr 点名；对照组
      `--palaces --monthly 5` 仍正确报错（守卫未退化）；allow 两条
      （`--topic love --yearly 2027` / `--topic love --monthly 5`）exit=0 出主题论断
      （无误伤）。

## Workflow follow-up（归档参考，不进任务进度）

- 归档前 `openspec validate --all` 须 0 错误 0 警告。
- 一个逻辑变更一个 commit：代码 + 测试 + 文档 + `openspec/`（本变更目录与归档件）一并提交。
- 归档用 `openspec-archive-change` 工作流；归档后本变更的 ADDED 需求折回
  `openspec/specs/chart-casting/spec.md` 主 spec。
- 本变更不改项目约束——AGENTS.md:251「已全数改为报错+指路」在修复后重新成立，
  无须同步该节。
