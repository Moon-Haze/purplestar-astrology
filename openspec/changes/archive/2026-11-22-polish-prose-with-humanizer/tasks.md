# Tasks

## 1 规范落地（apply，纯文档面）

- [x] 1.1 `openspec/config.yaml` 的 `operations.apply.guidance` 追加一行 advisory：成段中文
      注释与仓库级分析文档（外置 `docs/code/` / `docs/reviews/` / `docs/plans/` /
      proposal / design 散文）成稿先经 `humanizer-zh` 技能润色，引语、代码块、术语口径
      原样；判据 `openspec validate --all` 零警告
- [x] 1.2 三层落点口径自查：config guidance 行是 delta requirement 的指针不是复制，
      适用面 / 豁免面逐条对照无出入

## 2 闸门（内容扩展档：不触代码与内核，不重跑内核回归）

- [x] 2.1 `openspec validate --all`：本变更 delta 校验通过、零**新增**警告（基线既有
      2 条主 spec 长文本警告——extensibility「内核与内容严格分层」/ quality-gates
      「分析数据表键域互证」，属前次归档折回遗留，另开 change 处理，不在本变更面内）

## Workflow follow-up

- 归档走 openspec-archive-change：delta 折回 code-style 主干；折回时同步两处非 requirement
  文本——① code-style 主 spec 的 Purpose 扩围（「只管注释的放置与篇幅」→「放置、篇幅与
  中文行文」，「不管技术正确性」口径保留）② `AGENTS.md`「项目约束（不可动）」补一行
  行文纪律（纪律单一真相源收口，spec 为细则）
- 归档后 `openspec validate --all` 零警告
- 提交按仓惯例随归档收口（一个逻辑变更一个 commit）
