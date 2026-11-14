# Spec Delta · quality-gates

## Purpose

登记「注释指针有效性守卫」：源码注释中对 `.md` 文档的引用必须指向仓库内实际存在的
文件。四波改名（CLAUDE.md→AGENTS.md、ziwei/ 拆平、commands/ 重组、selectGender 迁移）
各留一批断锚，现有闸门全部查不到——该守卫补的是现有闸门覆盖面之外的失效模式。

## ADDED Requirements

### Requirement: 注释指针有效性守卫

`scripts/` `test/` `tools/` 下 `.ts` 源码注释中出现的 `.md` 引用词元（根级文件名如
`AGENTS.md` / `SKILL.md`，及 `docs/…` / `references/…` 相对路径）SHALL 指向仓库内实际
存在的文件。守卫 SHALL 以文本扫描实现、纳入 `npm test` 的 repo 层；命中不存在的指针
SHALL 报出文件与行。守卫只查指针对象**存在性**，SHALL NOT 审查注释内容的技术正确性。
确属误报的引用 SHALL 在守卫内显式登记白名单并带理由（跳过必须看得见），SHALL NOT
静默豁免。

#### Scenario: 注入断锚即红灯

- **WHEN** 任一被扫描文件的注释出现指向不存在 `.md` 的引用（如临时写入
  「见 docs/code/not-exist.md」）
- **THEN** `ZIWEI_NO_CACHE=1 npm test` repo 层失败，报出文件与行；还原后恢复全绿

#### Scenario: 存量清零

- **WHEN** 守卫落地并在存量批改完成后运行
- **THEN** 扫描零命中（或命中项全部在带理由的白名单内），npm test 全绿

#### Scenario: 改名防复发

- **WHEN** 未来再次发生仓库级改名（如根级 `.md` 或 docs/ 子目录更名）
- **THEN** 遗留断锚使 npm test repo 层变红，不等人工比对发现
