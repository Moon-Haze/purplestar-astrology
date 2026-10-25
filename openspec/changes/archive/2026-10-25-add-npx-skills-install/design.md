# Design

## Context

现状：官方安装三条路（zip / 手动拷贝 / 仓库内直跑）都要求先拿到仓库或 zip；README 与
`docs/user-guide/` 零处提及 npx。实测事实（2026-10-25，`skills@1.7.4`）：

- `skills` CLI 的发现位置列表第一项是 Root directory（若含 `SKILL.md`），本仓正中；
- 对本仓实跑 `--list`：Found 1 skill，名称与描述读自根 `SKILL.md` frontmatter；
- `.agents/skills/`、`.zcode/skills/` 下的 openspec 工作流技能被浅层遮蔽规则排除
  （shallower shadows deeper），不外溢；
- 安装落位 = 整仓工作树（git 来源不含 `node_modules`），`.git` pack 实测约
  394 MiB（`db/dataset/` 两个 parquet 为主）。

既有守卫与本通道的承重不变量：根 `SKILL.md` 存在（`test/repo.test.ts` 层 1）、
frontmatter `name` ↔ 落位目录名同源（`tools/pack.ts` 的 zip 顶层目录断言覆盖同一
不变量的 zip 侧）。动机与范围见 proposal.md，行为契约见本 change 的 distribution delta。

## Goals / Non-Goals

**Goals:**

- 给终端用户一条命令的技能安装路径，README 与 user-guide 双文档收编。
- distribution spec 固化通道兼容性（纯 ADDED，不动七条 zip requirement）。
- 明确两通道并存口径：skills CLI = 用户便捷通道（整仓、一条命令）；zip = 可校验的
  干净分发（四项、字节可复现）。两者不互斥、不互相替代。

**Non-Goals:**

- 不测 `skills` CLI 的内部行为（第三方、迭代快、网络依赖）——只钉本仓侧可守的
  不变量与一次可复现的实测口径。
- 不改 `SKILL.md` 正文、`references/`、`tools/pack.ts`、内核与 CLI（见 proposal 不做什么）。

## Decisions

### 决策 1：README「装进 AI 助手」节内，skills CLI 置于 zip 之前作为第一条

- **理由**：zip 流程（`npm run pack` → `unzip`）对终端用户是维护者视角——须先有仓库
  才能打包；skills CLI 才是「无前提一条命令」的真用户路径。该节标题是「装进 AI 助手」，
  第一条应是无前提的那条；zip 降为「可校验字节复现」的替代路径，其语义与硬承诺
  （sha256 校验、四项口径）不受损。
- **备选**：zip 保持第一、skills CLI 追加在后（diff 最小）——否决：排序按用户门槛
  才是合理信息架构，为省几行 diff 把最短路径埋在第三位不值。
- **后果两面**：收益 = 用户路径最短、与 skills.sh 生态惯例一致；代价 = zip 段落需加
  一句衔接（说明何时选 zip），diff 略大于纯追加。

### 决策 2：不加新的回归断言钉 skills CLI 兼容性

- **理由**：通道的两个承重不变量已有守卫（根 `SKILL.md` 存在、`name` 同源），剩余
  行为全是第三方 CLI 的实现细节。写「clone 本仓 + 跑 `npx skills add`」的集成断言
  是在测别人的代码：引入网络依赖与版本漂移，且无独立路径——**deletion test**：删掉
  它，兼容性由既有守卫 + spec scenario 的人工实测清单保障，没有复杂度集中。
- **备选**：`npm test` 加一层「skills 发现计数 = 1」断言——否决如上。
- **后果两面**：收益 = 回归链路不引入慢速网络测试；代价 = `skills` CLI 未来若改
  发现机制不会自动报警（接受：第三方行为本就不可钉，spec 的两个实测 scenario 提供
  升级复核清单）。

### 决策 3：三问自检（config 规则）

- **deletion test**：本变更无新增抽象，只添文档与一条 spec requirement——删掉即回到
  「没有一条命令安装路径」的现状，不存在「搬家式重构」。
- **接缝判据**：不适用（无新扩展点）；文档新增不触碰任何分发逻辑与 CLI。
- **抽象 justify**：无新常量、新模块；不新增「身兼两职」的命名。

## 不可逾越的约束

- zip 通道纪律（只收四项、字节可复现、不拍平 `scripts/`）原样保留——不碰
  `tools/pack.ts` 与 distribution spec 既有七条 requirement。
- `SKILL.md` 正文不动；其「首次使用 `npm install`」一节是本通道依赖缺口的兜底，
  属既有行为，本次只在 README/user-guide 侧把它**转述**为 caveat，不改 skill 行为规范。
- 引文纪律：新增文档内容不引入「倪师 + 引号句」形态（不触发 `grades.ts` 登记义务）。
- 计数类事实不写死：体量写「约 400 MiB」并标注测量时点与来源
  （2026-10-25，`git count-objects -vH` 的 size-pack），不作精确承诺。

## Risks / Trade-offs

- [`skills` CLI 迭代改发现机制] → spec 两个实测 scenario 固化复核口径；文档同时给
  `git@github.com:…` SSH URL 字面量形态（受 CLI 的 HTTPS→SSH 回落链保护，是最稳入口）。
- [用户装到整仓（含 `test/` `docs/` `db/`）以为装脏了] → README caveat 写明功能不受
  影响：`selftest` 的 `skipUnlessRepo` 判据是 AGENTS.md 在场与否，整仓形态下 repo 级
  断言照常运行且应全绿。
- [约 400 MiB 首次拉取劝退] → caveat 如实标注，并指向 zip 通道作为轻量替代；
  体量治理（LFS / 数据集瘦身）已列为独立议题，不在本次夹带。
- [symlink 与 copy 两种落位形态的宿主差异] → 文档不展开宿主矩阵，命令给
  `-a claude-code` 与 `-g` 两个最常用形态，机制差异链接 `skills` CLI 文档。

## Migration Plan

纯文档 + spec delta：无迁移、无回滚风险，revert 即回到原状，代码零影响。

## Open Questions

无——三个决策点均按推荐默认落定（README 排序 / 不加守卫 / 不补 user-guide 的 zip 节）。
若对决策 1 的排序有异议，apply 前改本文件即可，不影响 spec 与 tasks 结构。
