# Tasks

## 1. 工件与校验

- [x] 1.1 写 `code-style` spec delta：MODIFIED「注释占比上限」requirement，口径改为定义 A（注释纯文字 / (纯文字+代码)，去标记去空白），四场景同步、纪律不变。完成判据：`npx --no-install openspec validate '2026-11-22-comment-ratio-content-metric' --type change --strict` 通过。
- [x] 1.2 度量脚本按定义 A 实跑确认口径可复现：用 scanner 识别注释区间、去标记去空白，对同一文件两次运行输出一致；当前超标数应为 56/159（行数口径 89 不再引用）。完成判据：两次运行一致，数字与 proposal / design 对齐。

## 2. 三处规范同步

- [x] 2.1 归档折回后修正 `openspec/specs/code-style/spec.md`「注释占比上限」requirement，其余 10 条 requirement 与 Purpose 逐字不动。完成判据：`openspec validate --all --strict` 全过零警告。
- [x] 2.2 `AGENTS.md`「注释形态」节的「注释占比上限」段口径表述改为内容字符比。完成判据：段存在、口径表述为定义 A、指针仍指向 spec。
- [x] 2.3 `openspec/config.yaml` apply guidance 的注释占比指针口径表述改为内容字符比。完成判据：yaml 结构完整，validate 全过。

## 3. 归档与提交

- [x] 3.1 归档 `2026-11-22-comment-ratio-content-metric` 到 `openspec/changes/archive/`。完成判据：活动变更归零，归档目录完整。
- [x] 3.2 按仓库提交惯例把三处规范同步与归档一并提交（一个逻辑变更一个 commit）。完成判据：`git status` 干净，提交信息含口径纠正说明与验收结果。

## Workflow follow-up

- 按定义 A 实测的 56 个超标文件降比实施另立变更，逐批跑剥注释 token 对拍（代码 token 零变更）与 typecheck / selftest / npm test 三件套；契约文档密集、精简后仍超标的如实列报。
