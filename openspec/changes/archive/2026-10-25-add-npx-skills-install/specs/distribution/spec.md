# Spec Delta

## ADDED Requirements

### Requirement: skills CLI 发现兼容性

仓库 SHALL 保持「仓库根目录含 `SKILL.md` 即技能根」的布局，使 vercel-labs `skills`
CLI（`npx skills add <owner>/<repo>`，Agent Skills 生态标准安装器）能按其发现机制
（发现位置列表第一项：Root directory）识别本技能。`SKILL.md` frontmatter 的 `name`
SHALL 与安装落位目录名同源（`purplestar-astrology`，与「zip 顶层目录名须与
frontmatter 一致」为同一不变量），宿主按目录名发现技能。

#### Scenario: 技能发现计数

- **WHEN** 对本仓（本地路径或 `owner/repo` 来源）运行 `npx skills add <来源> --list`
- **THEN** 发现且仅发现 1 个技能，名称为 `purplestar-astrology`，描述读自根 `SKILL.md` frontmatter

#### Scenario: 内嵌协作用件不外溢

- **WHEN** 仓库内 `.agents/skills/`、`.zcode/skills/` 存有 openspec 工作流技能的 `SKILL.md`
- **THEN** 发现结果仍只有根技能——浅层 `SKILL.md` 遮蔽深层嵌套，仓内协作用件不作为可安装技能分发

### Requirement: skills CLI 通道的文档与依赖兜底

该通道装出的是**整仓工作树**：不含 `node_modules`，且含仓库级内容
（`test/` / `docs/` / `openspec/` / `db/`）。依赖缺口由 `SKILL.md`「首次使用」节
兜底（首次使用在技能根 `npm install`），本通道不引入新的依赖安装机制、不改打包器。

README 与 `docs/user-guide/` SHALL 收编该通道，并 MUST 写明两条已知代价：
①安装走 git clone，需拉取约 400 MiB git 数据（`db/dataset/` 数据集为主）；
②装完首次使用需在技能根 `npm install`。

#### Scenario: 安装文档完整性

- **WHEN** 检查 README「装进 AI 助手」与 `docs/user-guide/getting-started.md`「装起来」两节
- **THEN** 两处均记载 `npx skills add Moon-Haze/purplestar-astrology` 命令形态，且写明两条已知代价（约 400 MiB git 数据；首次使用需在技能根 `npm install`）
