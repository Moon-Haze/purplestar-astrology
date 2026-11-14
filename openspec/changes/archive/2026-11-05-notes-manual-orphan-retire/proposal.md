# notes/80-主题手册 孤儿生成物诚实下线

## Why

`notes/80-主题手册/`（15 个被 git 跟踪的 .md）的数据源——`scripts/corpus/data/manual/` 的
断语手册 TS 生成物——已随 `remove-manual-oracle`（12a3e4d）与 manual→SQLite 迁移
（82b18d2）**整体删除**，但生成器侧的三处尾巴没有跟：

1. **生成物无生成器**：抽读文件头注仍写「来源:
   purplestar-astrology/scripts/corpus/data/manual」——该路径不存在，任何人在新机器上
   都无法复现这 15 个文件，违反 `notes/README.md` 与 AGENTS.md 的「可复现」承诺。
2. **生成器会销毁它**：`tools/notes/export-notes.ts:55-59` 的 `MANAGED_DIRS` 仍含
   `80-主题手册`，`:679-681` 对每个托管目录先 `rmSync` 再重写——但全文已无任何函数再写
   该目录。下次任何人跑 `npm run notes:export`，15 个被跟踪文件被静默删掉且永不重建，
   git 留下一次无法解释的删除 diff。这是 npm test 抓不到的破坏性行为（tools/ 不在
   npm test 覆盖内）。
3. **自报撒谎**：`:724-726` 完成行宣称产出「主题手册 ${TOPIC_KEYS.length} 篇」——虚报
   产物；`:28` 的 `TOPIC_KEYS` import 全文仅剩这一处消费，为虚报活着。

架构词汇：这是 interface（MANAGED_DIRS 清单）大于 implementation（实际写出的目录集）的
残基；对 80-主题手册整体做 deletion test，复杂度湮灭——没有消费方（citation-guard 明确
排除 notes/ 扫描面），唯一引用者是 README 表格一行与生成器的虚报行。

## What Changes

1. `git rm` `notes/80-主题手册/` 全部 15 个文件（目录随之消失）。
2. `tools/notes/export-notes.ts`：
   - `MANAGED_DIRS` 删 `80-主题手册` 条目（`:55-59`）；
   - 完成行删「主题手册 N 篇」计数（`:724-726`），自报只列真实产物；
   - 删 `:28` 因此失去消费者的 `TOPIC_KEYS` import。
3. `notes/README.md`：删「80-主题手册」表格行（`:21`），托管目录表回到与生成器实态一致。

## Capabilities

- **New Capabilities**：无。notes/ 是仓库级 Obsidian vault 导出产物，不进分发件、无任何
  spec 覆盖（`grep -rn notes openspec/specs/` 零命中）→ 本 change 声明 `skip_specs`。
- **Modified Capabilities**：无。

## 不做什么

- **不动其余托管目录**（`60-方法` / `70-课程笔记` / `75-主星论断` / `85-合盘断语`）——
  它们有活的生成路径与数据源，`60-方法` 的文件级 rmSync 清理逻辑（`:683`）保持原样。
- **不从 analysis 内核重建主题手册**：被否决（见下）。若未来判断该内容仍有价值，唯一
  正路是一个新的生成决策（改从 `getTopicAnalysis` 现场口径重建），走新 openspec change，
  不以「残基」形态存在。
- **不动 `import-tianji.ts` 等其他工具的外部路径纪律**。

## 验证义务

属**纯删除 + 生成器收尾**，不涉排盘内核、不涉 iztro、不新增断言到 npm test 面。验证
义务三档归入**纯重构档的等价物**：`npm run typecheck` + 对 `export-notes.ts` 跑
`npx eslint`，再以「**改后实跑 `npm run notes:export` 一遍，`git status` 对 notes/ 零
差异**」作为生成物可复现性与「不再销毁」的联合证据（重导不产生任何新 diff = 其余托管
区逐字节可复现，且 80-主题手册不再被触碰）。

## 被否决的备选方案

- **从 analysis 内核（`getTopicAnalysis`）重建主题手册**：否决——那是一个新的生成决策
  （内容口径从「断语手册快照」变成「运行时推算投影」），需要独立的 proposal 论证内容
  价值与形态；把退役收尾和内容重建捆在一个 change 里会让删除面与新增面互相绑架。
  YAGNI：在有人提出需要它之前，先诚实下线。
- **保留 MANAGED_DIRS 条目以「清理旧机器残留」**：否决——本机就是唯一活跃工作机，
  `git rm` 已覆盖；为一次性清理在生成器里留一条永不写入的删除指令，正是本次要消掉的
  「清单大于实态」模式的复发。
- **只删 MANAGED_DIRS 条目、留 15 个文件**：否决——生成物无生成器的状态原样保留，
  「可复现」承诺继续破着。
