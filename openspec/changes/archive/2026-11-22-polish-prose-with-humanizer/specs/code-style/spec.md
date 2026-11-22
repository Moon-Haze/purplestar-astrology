# Spec Delta

## ADDED Requirements

### Requirement: 注释与文档散文经 humanizer-zh 润色

成段中文注释（`.ts` 源码内的多行说明注释）与仓库级中文分析文档的散文正文 SHALL 在成稿时经
`humanizer-zh` 技能润色，去除模板化表达。适用文档面：外置 `docs/code/` 的说明文档、
`docs/reviews/`、`docs/plans/`、openspec 工件（proposal / design）的散文正文。润色 SHALL
保留技术事实与仓库口径：代码块、行内代码、命令、路径、数据、标题层级（锚点）原样不动；倪师
引语与引文登记条目 SHALL NOT 改写——引文纪律优先于行文润色。单行 why 注释、表格数据、生成
文件（如 `docs/manual/`）、`SKILL.md` 与 `references/` 豁免。

#### Scenario: 成段注释成稿润色

- **WHEN** 写出多行中文说明注释（含将外置 `docs/code/` 的长注释初稿）
- **THEN** 落盘前经 `humanizer-zh` 润色；润色只动散文行文，代码引用、路径与术语口径原样，
  不新增、不遗漏技术事实（评审对照可验）

#### Scenario: 分析文档成稿润色

- **WHEN** 写 `docs/reviews/`、`docs/plans/` 或 openspec 工件（proposal / design）的散文正文
- **THEN** 交付前经 `humanizer-zh` 润色；表格数据、命令与标题层级保持原样

#### Scenario: 引文保护

- **WHEN** 润色的文本含倪师引语或引文登记条目
- **THEN** 引语文字原样保留；润色后 `npm test` 引文守卫（层 7，扫 `.md` 全树）保持绿——
  润色不得以「去痕迹」为由触碰引文

#### Scenario: 豁免面

- **WHEN** 内容是单行 why 注释、表格数据、生成文件（如 `docs/manual/`）或 `SKILL.md` /
  `references/` 行为规范文本
- **THEN** 不强制走润色；生成物照旧走「改生成器重导」，不手改不顺带润色
