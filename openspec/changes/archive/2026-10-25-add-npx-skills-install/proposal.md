# Proposal

## Why

本仓现有三条官方安装方式（zip 分发 / 手动拷贝 / 仓库内直跑）都要求用户先拿到仓库或
zip 包，技能安装没有「一条命令」路径。2026-10-25 实测确认：本仓「仓库根 = skill 根」
的结构与 vercel-labs `skills` CLI（`npx skills add`，Agent Skills 生态标准安装器，
支持 Claude Code 等 70+ 宿主）**天然兼容**——根 `SKILL.md` 命中其发现位置列表第一项
（Root directory），对本仓实跑 `--list` 恰发现 1 个技能（名称与描述正确读自
frontmatter），`.agents/skills/` 与 `.zcode/skills/` 下的 6 个 openspec 工作流技能被
其浅层遮蔽规则正确排除、不会被误分发。收编这条通道是零代码变更，只扩文档与规范。

## What Changes

- **新增第四条官方安装方式**：`npx skills add Moon-Haze/purplestar-astrology`
  （支持 SSH URL 字面量、`-g` 全局、`-a claude-code` 指定宿主）。
  - README「装进 AI 助手」节收编该方式，写明两条已知代价：
    ① 安装走 git clone，需拉约 400 MiB git 数据（大头是 `db/dataset/` 两个 parquet）；
    ② 装完不含 `node_modules`，首次使用需在技能根 `npm install`——该缺口已由
    `SKILL.md`「首次使用」节兜底（AI 助手读技能后自行补装），无需新机制。
  - `docs/user-guide/getting-started.md`「装起来」节同步收编。
- **distribution spec 增补两条 requirement（纯 ADDED）**：①skills CLI 发现兼容性
  （根 `SKILL.md` 即技能根、frontmatter `name` 与安装落位目录名同源、内嵌技能目录被
  遮蔽不外溢）；②通道的文档与依赖兜底（README / user-guide 收编并写明两条已知代价，
  依赖缺口由 `SKILL.md`「首次使用」节兜底）。不动现有七条 zip requirement 的任何
  scenario。
- 零代码变更：不改打包器（`tools/pack.ts`）、不改内核与 CLI、不改依赖、不改
  `SKILL.md` 正文与 `references/`。

### 不做什么

- **不发 npm 包、不加 `bin` 字段**——`npx skills` 走的是 git 来源 + SKILL.md 发现，
  与「npm registry 包 + bin 可执行」是两条路；后者在本仓已论证过形态错位
  （skill 需常驻宿主技能目录被按名发现，不是一次性执行的命令）。
- **不改打包器与 zip 通道**——zip 的字节可复现校验价值独立存在，两通道并存不互斥；
  skills CLI 通道装的是整仓工作树，不能替代「只收四项」的干净分发口径。
- **不改 `SKILL.md` 正文与 `references/`**——安装指引面向人，落 README 与
  user-guide；`SKILL.md` 的「首次使用 `npm install`」一节已天然兜住本通道的依赖缺口。
- **不做 skills.sh 索引登记**——外部服务、非仓内可控；`npx skills find` 搜不到属
  预期，`add owner/repo` 形态不受影响。
- **不动 `db/` 数据集体量**——约 400 MiB git 数据是该通道的已知代价，瘦身 / LFS
  属独立议题，不在本次收编范围。
- **不补 user-guide 的 zip 安装节**——`getting-started.md` 定位是仓库内 CLI 使用，
  README 已覆盖 zip 口径；补齐两文档的安装口径对齐属另一独立议题（留档，不在本次夹带）。

### 验证义务申报

**内容扩展档**（文档 + spec delta）：不重跑内核回归。改动面会被既有守卫自然覆盖——
引文守卫扫描 `.md`（README / user-guide 在扫描面内，本次不新增任何「倪师 + 引号句」
形态内容）；`repo.test.ts` 层 1 钉住根 `SKILL.md` 存在（本通道的发现前提）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `distribution`: 增补两条 requirement（skills CLI 发现兼容性；通道的文档与依赖
  兜底），纯 ADDED，现有七条 requirement 及其 scenario 原样保留。

## Impact

- **文档**：`README.md`（「装进 AI 助手」节）、`docs/user-guide/getting-started.md`
  （「装起来」节）。
- **spec**：`openspec/specs/distribution/spec.md`（归档时折回，纯增量）。
- **代码 / 依赖 / 内核契约**：零改动，不触碰冻结内核契约，不需要 `typecheck` 三件套。
- **被否决的备选方案**（留档）：
  1. *npm 发包 + `bin`，`npx purplestar-astrology`*——形态错位：skill 要常驻宿主
     技能目录被按名发现，npx 装的是一次性执行的命令；且 `private: true` 语义是刻意
     不发布。
  2. *GitHub release 直链 zip + `skills add <直链 URL>`*——可行（zip 1.2 MB 远低于
     直链 10 MiB 上限）但要求每次发版维护 release 流程；`add owner/repo` 直接从 git
     拿、零额外流程，直链方式收益为零，否决。
  3. *自写 installer 脚本 / `npm create` 形态*——多维护一个安装器，而 skills CLI
     已是生态标准件且实测兼容，自建属重复造轮子。
