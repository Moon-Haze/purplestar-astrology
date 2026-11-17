# 任务 · manual 退役波 interface 尘埃

判据形态标记：`[退出码]` / `[计数]` / `[逐字节]` / `[反向注入]`。
本 change 零行为变化（生成物不动、探针不动），验收重点是 interface ≡ implementation。

## 1. 取证

- [x] 1.1 记录 `npm run manual:check` 现状（退出码；若因缺 `db/dataset` 或 DuckDB 跳过，
      记录跳过标注原文）。
      判据 `[退出码]`：命令可执行并给出明确退出码或可见跳过。
- [x] 1.2 取 `docs/manual/` 两个生成物（combo-frequency.md / geju-audit.md）的 sha256
      基线。
      判据 `[计数]`：基线清单非空。

## 2. export-manual interface 收敛

- [x] 2.1 头注（`:4-10`）重写：只列 `combo` / `geju` / `all` 与 `--check`，删除
      `topics` / `db` 两段及其产物路径描述。
      判据 `[计数]`：`grep -n "topics\|oracle.db" tools/db/export-manual.ts` 头注区间
      零命中（代码内 SQL/变量名中的合法 topic 字样不计）。
- [x] 2.2 删死符号：`findViolations` import（`:37`）、`TOPIC_CONTENT_SOURCE` import
      （`:41`）、`TOPIC_PALACE_COMPACT` 表（`:83-85`）及其「单一真相源」注释。
      判据 `[计数]`：三符号在 `tools/db/export-manual.ts` 内零命中；删除前先全仓 grep
      确认零外部引用（若发现引用方，停下补 design 记录再评估）。
- [x] 2.3 `npx eslint tools/db/export-manual.ts`。判据 `[退出码]`：0。

## 3. review-gate 守卫面重列

- [x] 3.1 `tools/review-gate.ts`：GENERATED 重列为现役生成物正则——`^docs/manual/[^/]+\.md$`
      与 notes/ 纯脚本生成托管目录（以 `notes/README.md` 目录表实态为准：
      `70-课程笔记` / `75-主星论断` / `85-合盘断语`；手写区与混合区不纳入）；`:318` why
      文案改指 `npm run manual:export` / `npm run notes:export`。
      判据 `[计数]`：`grep -n "corpus/data/manual" tools/review-gate.ts` 零命中；
      新正则对 `docs/manual/combo-frequency.md` 命中、对 `notes/90-模板/` 下文件不命中
      （可用 node -e 单行验证）。
- [x] 3.2 `npx eslint tools/review-gate.ts`。判据 `[退出码]`：0。

## 4. 零行为证明

- [x] 4.1 `npm run typecheck`。判据 `[退出码]`：0 错误。
- [x] 4.2 `npm run manual:check`。判据 `[退出码]`：与 1.1 记录一致（0 或同一可见跳过）；
      `docs/manual/` 两文件 sha256 与 1.2 基线一致（`[逐字节]`）。
- [ ] 4.3 `npm run review`（review-gate 自跑）。判据 `[退出码]`：0 且输出不误报手写区
      文件（若 review 需要参数，按其 usage 以最小参数实跑并记录命令行）。
      ⚠️ 环境阻塞（2026-11-05，用户确认「照常推进 + 显式标注」）：实跑退出码 1，唯一
      阻断为「触及冻结面 scripts/algorithm.ts」，源自工作树 101 个未提交改动中 #3 的注释
      批改，与本 change 两个 touched 文件无关。闸门四项全绿、手写区与生成物零误报，
      4.4 以 `npm run review -- --no-run` 证明新 GENERATED 生效。不为凑退出码提交 /
      stash / 回退他人改动；归档时按「1 项未完成」标注。
- [x] 4.4 反向注入：临时手改 `docs/manual/combo-frequency.md` 一个字节 → review-gate
      的生成物守卫应把它指认为 GENERATED（警告或拦截，按 review-gate 现行行为）；
      `npm run manual:check` 应非零退出（内容级对拍兜底）；还原后两者恢复。
      判据 `[反向注入]`：注入态至少 manual:check 非零退出；还原后 sha256 回基线。
