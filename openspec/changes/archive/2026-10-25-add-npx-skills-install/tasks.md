# Tasks

## 1. README 收编 skills CLI 安装方式

- [x] 1.1 改 `README.md`「装进 AI 助手」节：按 design 决策 1 把 skills CLI 小节置于
      zip 之前——命令给两种形态（`npx skills add Moon-Haze/purplestar-astrology` 与
      `npx skills add git@github.com:Moon-Haze/purplestar-astrology.git`）、示例带
      `-g -a claude-code`，并写明两条已知代价：①安装走 git clone、约 400 MiB git 数据
      （标注实测口径：2026-10-25，`git count-objects -vH` size-pack，不写死精确值）；
      ②装完不含 `node_modules`，首次使用须在技能根 `npm install`（注明 `SKILL.md`
      「首次使用」节已兜底，AI 助手读到会自行补装）。
      完成判据：distribution delta 的「安装文档完整性」scenario 三要素在 README 齐备。
- [x] 1.2 zip 小节补一句衔接语（何时选 zip：需要校验 sha256 字节复现、或要四项干净
      分发件时），zip 各硬承诺原文不动。完成判据：README zip 段的 sha256 校验、四项
      口径表述与改动前逐字一致（`git diff README.md` 仅新增/衔接行）。
- [x] 1.3 跑 `node scripts/purple-star.ts selftest`（约 2 秒）确认零意外。
      完成判据：退出码 0、首行合计全绿（直接取命令退出码，不接管道）。

## 2. user-guide 同步

- [x] 2.1 改 `docs/user-guide/getting-started.md`「装起来」节：新增 skills CLI 通道
      小节（与 README 同口径——同一 `owner/repo` 命令字面、同两条 caveat、
      `skills find` 搜不到属预期一句），git clone 直跑通道原样保留。
      完成判据：「安装文档完整性」scenario 三要素在 getting-started 齐备，且命令
      字面与 README 一致（`grep -c "npx skills add Moon-Haze/purplestar-astrology" README.md docs/user-guide/getting-started.md` 两处均 ≥ 1）。
- [x] 2.2 全文复查新增内容：不引入「倪师 / 倪海厦 + 引号句」形态（不触发
      `grades.ts` 登记义务）。完成判据：`npm test` 的引文守卫层绿（由 3.1 统一跑）。

## 3. 通道实测与闸门收口

- [x] 3.1 对本仓实跑 `npx skills@1.7.4 add <仓库绝对路径> --list`，复核 distribution
      delta 的「技能发现计数」与「内嵌协作用件不外溢」两个 scenario。
      完成判据：输出恰含 1 个技能 `purplestar-astrology`，退出码 0。
- [x] 3.2 跑 `npm test`（内容扩展档申报：不改内核，跑全量顺带确认内核层项数与改动前
      一致——项数变动即越界，先查越界而不是改基线）。完成判据：退出码 0、全绿，
      内核层项数与基线一致。
- [x] 3.3 跑 `openspec validate --all`。完成判据：退出码 0、零警告。

## Workflow follow-up

（不跟踪进度，apply 完成后参考）

- 归档时把 `openspec/specs/distribution/spec.md` 折回主 spec（纯 ADDED 合并），
  跑 `openspec validate --all` 确认零警告。
- 归档 commit 一并收入：文档改动、主 spec、归档的 change 目录（一个逻辑变更一个
  commit）。本次不改项目约束，`AGENTS.md` 无需同步；若 apply 中出现口径变化
  （如决策 1 排序被推翻），先改 design 再动文档。
