# Design

## Context

见 proposal.md（B1 与 S5 的实锤链）。现状三处写死已删的 `CLAUDE.md`：探针（kit.ts:161）、断言体读取（guard.ts:167）、文档陈述（AGENTS.md / docs/code/cli-selftest.md）；引文守卫 `.ts` 面只有流派分派组（scanRoot = scripts/）。

## Goals / Non-Goals

**Goals:**

- 「文档一致性」断言在仓库态恢复运行（⏭ 消失），且锚点再失效时当场变红
- 引文守卫 `.ts` 覆盖面与代码真实分布对齐（含 tools/ test/）

**Non-Goals:**

- 不改「文档一致性」断言的检查内容（Node 下限 / 独占分支 / 升级警告三项原样恢复运行）
- 不动跳过机制与流派分派组
- 不清理 tools/ test/ 之外的陈旧 CLAUDE.md 注释指路（那是 S4 前半免提案批的活，边界不混）

## Decisions

1. **判据锚点选 `AGENTS.md` 而非 `test/` 目录。** 锚点要满足：仓库必有、分发必无、语义直白。`AGENTS.md` 是仓库级文档的现行代表（5afe256 后唯一来源），与被守断言读的文档同源；`test/` 语义上是测试目录不是文档，用它判「仓库形态」隐晦。备选「README.md」被否：README 面向访客，存在被移出门面文件的理论可能，AGENTS.md 是协作者契约更稳。
2. **断言体读取对象随锚点走：CLAUDE.md 那份「22.15 下限」检查改读 AGENTS.md。** 断言逻辑是 `includes("22.15") && !includes("NODE_OPTIONS")` 才报错——AGENTS.md 现文含「22.15–22.17 需 NODE_OPTIONS」句，带豁免词不误报（apply 时实跑确认）。
3. **反恒真断言双层：** 轻层——`skipUnlessRepo(ctx, …)` 在仓库态必须返回 `undefined`（直接调用，锚点失效即红）；重层——selftest 报告全文不含 `⏭`（端到端，防未来新增跳过滥用）。重层放 repo.test.ts（仓库级回归的家）。
4. **扩面前置核查而非先扩面再救火。** `tools/` 与 `test/` 的「倪师 / 倪海厦」形态先逐条比对核对表：表内放行；表外按引文纪律二选一——内容确属可溯的登记 `analysis/grades.ts`，否则改写为不挂引语的表述。核查结论落任务勾选记录后，才加仓库级扫描组。
5. **仓库级 `.ts` 组与流派分派组并列**（理由同 `.md` 侧先例：仓库级对象不属于任何单一流派），不把 tools/ test/ 塞进 wenmo-nishi 的 `scanRoot`——那会污染「流派只扫自己内容」的隔离语义。

## Risks / Trade-offs

- [扩面后发现存量违规比预期多] → 前置核查先行给出清单；若登记量大，登记与改写的取舍问用户，不自行批量挂档位
- [AGENTS.md 将来再改名 / 删除] → 重层反恒真断言当场红——这正是要的效果（锚点变化必须连带审视守卫）
- [反恒真断言误伤合法跳过] → 分发态跑 repo.test.ts 不存在（test/ 不进包），仓库态按纪律本就零跳过；若未来真出现仓库态合法跳过，须先改需求再改断言

## Migration Plan

1. 前置核查（引文清单） → 2. 判据锚点 + 断言体读取对象替换 → 3. 反恒真双层断言 → 4. 仓库级 .ts 扫描组 → 5. 文档陈述同步 + 五闸门。回滚：单提交 revert。

## Open Questions

（无）
