# Tasks

- [x] T1: 往 `openspec/specs/quality-gates/spec.md` 追加「OpenSpec 校验零警告」requirement
  - 内容取本 change 的 `specs/quality-gates/spec.md` delta 全文，追加在既有 requirement 清单末尾
  - 完成判据：`grep -c "^### Requirement" openspec/specs/quality-gates/spec.md` 较改前计数 +1
    （改前计数以实跑为准，不写死）；新 requirement 正文 ≤ 500 字符——本提案的动机正是
    超长警告，自身不得重蹈
- [x] T2: 验证零警告
  - `openspec validate --all`
  - 完成判据：退出码为 0 且输出不含 `WARNING`（退出码直取本命令本身，不接管道、不接 `&&`）
- [x] T3: 归档本 change
  - `openspec archive --change gate-validate-zero-warning`
  - 完成判据：归档后 `openspec validate --all` 仍零警告；`openspec list` 不再列出本 change

> rules.tasks 其余条目核对结果：本变更无文件物理位置变动（import / `load<>("@/…")` /
> `resolve(ctx.root, …)` 三类字符串排查不适用）、不涉及生成文件（改生成器条目不适用）、
> 不属行为不变重构（基线逐字节 diff 条目不适用，替代判据是 T2 的零警告）。
