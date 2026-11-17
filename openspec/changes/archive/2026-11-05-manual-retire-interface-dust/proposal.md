# manual 退役波的 interface 尘埃：工具 usage 收三态、死符号删除、守卫面重列现役生成物

## Why

manual 退役改了 `tools/db/export-manual.ts` 633 行（删 topics/db 通道）但三类 interface
面没跟上：

1. **工具 usage ≠ main 实收**：头注（`:4-10`）仍列 `topics`（13 主题断语全集 md）与
   `db`（手册物化为 SQLite 只读库）两个子命令，`main()`（`:343-353`）实收
   `combo / geju / all`——工具的 usage 是它的 interface，现在宣称 5 收 3。
2. **死符号**：`:37` `findViolations` 与 `:41` `TOPIC_CONTENT_SOURCE` 两个死 import
   （全文件唯一出现）；`:83-85` `TOPIC_PALACE_COMPACT` 死表（构建后零使用），且其上
   一段「单一真相源纪律」注释守着死表——注释比代码活得久。实跑 eslint 全绿。
3. **守卫盯幽灵**：`tools/review-gate.ts:58` 的 GENERATED 正则
   `/^scripts\/corpus\/data\/manual\/.+\.ts$/` 只匹配 12a3e4d 已删除的文件——永不命中
   的死守卫；命中文案（`:318`）还指向已删除的「code 产出」模式。而现役两个生成面
   （`docs/manual/*.md`、notes/ 托管产物）反而没有任何「手改报警」层——这是能力缺口，
   不是冗余。

这是上一轮「守卫盯替身」（invariants 盯 chart-view 替身）的同型病新变体：守卫盯**幽灵**。

## What Changes

1. `tools/db/export-manual.ts`：头注重写为现役三态（`combo` / `geju` / `all`）+
   `--check` 探针用法；删 `findViolations` / `TOPIC_CONTENT_SOURCE` 死 import 与
   `TOPIC_PALACE_COMPACT` 死表及其纪律注释。
2. `tools/review-gate.ts`：GENERATED 正则重列现役生成物面——`docs/manual/` 下生成 md
   （combo-frequency / geju-audit）与 notes/ 纯脚本生成托管目录（`70-课程笔记` /
   `75-主星论断` / `85-合盘断语`，以 notes/README 实态为准）；why 文案改指现役生成命令
   （`npm run manual:export` / `npm run notes:export`）。
3. 附带核验：`manual:check` 探针本体不动（quality-gates spec「生成物漂移探针」
   requirement 的三态与孤儿报出行为不受影响）。

## Capabilities

- **New Capabilities**：无。review-gate 的手改守卫与 export-manual 的 usage 头注均为
  工具内部面，quality-gates spec 只约束漂移探针（`--check` 三态 + review 闸门挂载 +
  孤儿报出），本 change 不触碰这些 requirement 行为 → `skip_specs`。
- **Modified Capabilities**：无。

## 不做什么

- **不动 `export-manual --check` 的探针逻辑**（`:288-322` 三态降级与孤儿报出）——
  spec 面，行为不变。
- **不动 `corpus/citation-core.ts` 头注**（「建库侧共用」理由已过时）——归候选 5 的
  注释锚点批改，避免两个 change 触碰同一文件。
- **不重导生成物**——本 change 零行为变化，`docs/manual/` 产物应与基线逐字节一致。

## 验证义务

**纯重构档**：`npm run typecheck` + `npx eslint`（两个 touched 文件）+ `npm run
manual:check`（退出码 0 或可见跳过）+ `npm run review`（review-gate 自跑一遍确认
新 GENERATED 列表不误报）。

## 被否决的备选方案

- **诚实删掉 GENERATED 死正则、不加新覆盖**：否决——deletion test 虽通过（正则已永不
  命中），但那是把「守卫空气」从盯幽灵改成没守卫；docs/manual 与 notes/ 两个生成面的
  「勿手改」承诺（README 自称）只剩内容级对拍兜底（notes:export 连对拍都没有），
  能力缺口应补上而不是合理化。
- **把 notes/ 全目录纳入 GENERATED**：否决——notes/ 有手写区（`90-模板`、`60-方法`
  部分），正则按纯脚本生成目录白名单列举，误报面最小；全目录纳入会把「手改报警」
  变成狼来了。
- **顺手更新 usage 之外的 README/AGENTS 提及**：否决——文档批改归候选 5 统一做，
  本 change 只收工具自身的 interface 面。
