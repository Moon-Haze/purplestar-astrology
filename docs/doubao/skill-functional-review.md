# Skill 形态的功能实现分析（打包 · 依赖 · 运行引导）

> 日期：2026-10-09
> 范围：purplestar-astrology 作为**可分发的豆包 skill**（而非单纯代码库）的功能实现：包结构、依赖、运行环境、文档-运行衔接
> 方法：实测仓库结构 / node_modules / db / git 跟踪 / boot-hooks 引导层 / README 与 SKILL.md 安装指引对照
> 总评：**skill 引导层（boot-hooks）是教科书级设计**，但从「可分发给他人使用」的功能性看，有 1 个重量级包袱（392M 遗留 db 进 git）和 3 个轻量缺口（安装指引不进 SKILL.md、运行依赖 vs 开发依赖未分离、Node 版本约束仅藏在排查文档）。
> 状态标记：✅ 已解决 ｜ ⏳ 未解决（保留）

---

## 一、实测现状（数字先行）

| 项 | 实测值 | 说明 |
|---|---|---|
| `.git` 体积 | **398M** | 其中 392M 是 db/ 的 parquet |
| git 跟踪的 db 文件 | 13 个 parquet（392M） | palaces 12M + samples 0.8M + topics×11 ≈ 379M |
| 运行时代码对 duckdb 的引用 | **0** | `scripts/` 全仓零 duckdb import；data.ts 仅注释提及 |
| node_modules | 126M | 全量（含 devDeps）；运行时依赖 iztro 5.9M + lunar 1.6M ≈ **7.5M** |
| Node 硬约束 | **≥ 22.18** | `module.registerHooks` + 原生 TS 类型擦除，README:49 声明 |
| 安装指引 | README ✅ / troubleshooting ✅ / **SKILL.md ❌** | agent 首次必读的是 SKILL.md，正文没有 |

---

## 二、可优化点（按影响排序）

### F1 【最重】392M 遗留 db/ 被 git 跟踪 —— 仓库被撑到 398M

**证据链**：
- `git ls-files db/` → 13 个 parquet 全部被跟踪；`.gitignore` 只忽略 `db/dataset.staging/` 与 `db/ziwei.duckdb*`，**漏了 `db/dataset/*.parquet`**
- 运行时零依赖：`scripts/` 无 duckdb import；`data.ts` 里唯一提及是注释（说明 TOPIC_KEYS 与 `tools/db/db.ts` 的转出关系）
- 该数据路线已被代码路线取代（此前分析：topics 三表占 90%，运行时不读）——用户打包时也早已说过"可以去除 db 文件夹"
- 入 git 起点：`d9db043 feat(db): topics 分片入库`

**影响**：每次 clone 拉 398M（其中 97% 是没人读的 parquet）；分发 zip 若含 git 目录会同样膨胀；仓库协作时 diff/status 都变慢。

**建议**：
1. `git rm -r --cached db/` + `.gitignore` 补 `db/dataset/*.parquet`（保留 tools/db 建库脚本与文档，仅去数据）
2. 彻底瘦身需 `git filter-repo` 改写历史（仅当要公开分发、在意 clone 体验时做；历史已在远端，改写会动所有 clone）

### F2 SKILL.md 缺「首次使用」指引 —— agent 首次运行的成功路径没有预防

**证据**：README.md:38（`cd … && npm install`）与 references/troubleshooting.md:11-12（失败排查）都有，但 **SKILL.md 正文没有**。豆包运行时 agent 只读 SKILL.md；依赖未装时第一次跑 `node scripts/purple-star.ts` 必失败，只能靠 boot-hooks 的报错兜底（"Cannot find module 'iztro' → 在 skill 根 npm install"），是**失败后补救**而非**事前预防**。

**建议**：SKILL.md「路径约定」节补一行：
```
首次使用：在 skill 根执行 npm install（Node ≥ 22.18，依赖清单见 package.json）。
```
一行改动，agent 首次运行的成功率显著提升。注意：SKILL.md 有 selftest 文档-代码断言盯着，但该行不涉及旗标名，不会触发。**✅ 2026-10-09 已落地（a12f245）**。

### F3 运行依赖与开发依赖未分离 —— 打包体积 126M vs 7.5M

**证据**：`node_modules` 126M，其中运行时只需 iztro + lunar-typescript ≈ 7.5M；devDependencies（tsx / typescript / @duckdb/node-api）是 test / build:db 等开发脚本用的。

**建议**（二选一）：
- 分发 zip 用 `npm install --omit=dev` 后再打包 → 约 7.5M，zip 直接可用；
- 或 zip 不带 node_modules，只带 package.json + package-lock.json，用户 `npm install`（F2 的指引就位后这条路也通）。
- 数据路线彻底下线后，devDeps 里可移除 @duckdb/node-api（连带 tools/db 若保留则为开发专用）。

### F4 Node ≥ 22.18 是环境硬约束 —— 外部风险，代码无法改

**证据**：`boot-hooks.ts` 依赖 `module.registerHooks`（Node 22.18+），脚本靠原生类型擦除直接加载 `.ts`——这是整套"零构建直接跑"设计的地基。

**建议**：代码层面无优化空间（这是设计取舍：零构建换 Node 版本下限）。文档层面：F2 指引里显式声明即可。若豆包运行时 Node 版本不满足，需在宿主环境升级 Node——这是分发前必须确认的环境项。

### F5 【正面确认】boot-hooks.ts 引导层无需优化

核对结论：内核根定位（候选序 + probe 判定）、`@/` 别名与相对导入的 `.ts`/`index.ts` 双分支候选序一致、裸包名重定向到内核根 node_modules、失败双分支指引（依赖未装 / Node 过低）——**从任意 cwd 可跑**，不依赖豆包特殊环境（除 Node 版本）。这是 skill 形态最难做对的部分，已做对，不动。

### F6 小项：package.json 残留数据路线脚本

`build:db` / `verify:db` / `query` 三个 npm scripts 属数据路线，运行时用不到。数据路线下线后可删（保留则不影响）。`name: purplestar-astrology-skill` 已正确反映 skill 形态。**✅ 2026-10-09 已删（9318a80）；tools/db 脚本保留在仓内（typecheck 依赖其类型，devDep @duckdb/node-api 相应保留）**。

---

## 三、推荐路线

| 优先级 | 动作 | 影响 |
|---|---|---|
| **P0** | `git rm -r --cached db/` + `.gitignore` 补 `db/dataset/*.parquet` | 仓库 398M → 约 6M（新 clone 快 ~60 倍）；不动代码与工具脚本 |
| **P1** | SKILL.md 补一行首次安装指引（Node ≥ 22.18 + npm install） | agent 首次使用成功路径闭环 |
| **P2** | 分发 zip 按 `--omit=dev` 打包（≈7.5M）；或带安装指引不带 node_modules | zip 体积 126M → 7.5M |
| P3 | （可选）git filter-repo 改写历史彻底移除 db | 公开分发时 clone 体验最佳；动历史需团队共识 |
| P4 | 数据路线下线后清理 devDeps 与 scripts | 维护噪音 |

---

## 四、验证方式

- F1：`git rm -r --cached db/` 后 `git status` 确认 13 文件变为 deleted；`.gitignore` 补条目后 `git check-ignore db/dataset/topics-000001.parquet` 命中；新 clone 用 `git clone --depth 1` 实测体积
- F2：改 SKILL.md 后跑 `selftest`（文档-代码断言不受影响）+ 删 node_modules 后按新指引 `npm install` 实跑一次排盘
- F3：`npm install --omit=dev` 后 `du -sh node_modules` ≈ 7.5M；zip 后实测解压可跑
