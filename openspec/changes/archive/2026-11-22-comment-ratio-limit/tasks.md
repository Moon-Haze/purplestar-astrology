# Tasks

## 1. 规范工件与校验

- [x] 1.1 写 `code-style` spec delta：新增「注释占比上限」requirement（阈值 30、注释行/非空行口径、无豁免、存量随改动收敛、阈值调整只改 spec）。完成判据：`npx --no-install openspec validate '2026-11-22-comment-ratio-limit' --type change --strict` 通过。
- [x] 1.2 建立度量脚本口径原型（临时，不入仓）：对当前 159 个手写 `.ts` 实跑，确认阈值从 spec 读取且两次运行输出一致。完成判据：输出注释行、非空行、占比三列，超 30% 文件数与 proposal 中 89 一致（口径不符时先修脚本，不改源码）。

## 2. 三处规范同步

- [x] 2.1 归档折回后把 requirement 合入 `openspec/specs/code-style/spec.md`，保持已有 10 条 requirement 与 Purpose 逐字不动。完成判据：`npx --no-install openspec validate --all --strict` 全过零警告，`openspec show code-style --type spec` 可查到第 11 条。
- [x] 2.2 `AGENTS.md`「项目约束（不可动）」补「注释占比上限」节（单一真相源 + 指针回 spec）。完成判据：节存在、不写死文件数、指针指向 code-style spec。
- [x] 2.3 `openspec/config.yaml` 的 apply guidance 补一条指针（apply 必读面可见，细则不复制）。完成判据：yaml 结构完整，`openspec validate --all --strict` 仍全过。

## 3. 归档与提交

- [x] 3.1 归档 `2026-11-22-comment-ratio-limit` 到 `openspec/changes/archive/`，含 `.openspec.yaml`。完成判据：活动变更归零，归档目录完整。
- [x] 3.2 按仓库提交惯例把规范三处同步与归档一并提交（一个逻辑变更一个 commit）。完成判据：`git status` 干净，提交信息含 spec / AGENTS / config 三处说明与验收结果。

## Workflow follow-up

- 存量 89 个超标文件的降比实施另立变更，不在本变更内批量删改注释。
- 实施批次须跑保真校验（代码 token 零变更）与 typecheck / selftest / npm test 三件套。
