# 批次 A：文档实锤修复（D1/D2/D3/D5+F2）实施计划

> **For agentic workers:** 本计划按任务逐步执行，步骤用 checkbox 跟踪。实现 spec：`docs/specs/2026-10-09-review-fixes.md` 批次 A。

**Goal:** 修复合盘排障文档与实现的矛盾、自检项数漂移、「飞化」术语冲突，并在 SKILL.md 补首次安装指引。

**Architecture:** 纯文档改动，四处一行级到一段级修改；唯一耦合是 SKILL.md 有 selftest 文档-代码旗标断言盯着，措辞避开旗标名即可。

**Tech Stack:** Markdown（SKILL.md + references/）。

**Spec:** `docs/specs/2026-10-09-review-fixes.md`

## Global Constraints

- 全部中文措辞；不引入新旗标名（`--xxx` 形态的词若不是既有声明表旗标不得出现在 SKILL.md）。
- 文档改动后 `node scripts/purple-star.ts selftest` 必须全绿（文档-代码断言兜底）。

## Review Focus

- D1 修完两篇排障文档口径必须一致（`troubleshooting.md` 也写 ZIWEI_ROOT 优先）。
- D5 补的指引不得写成会被旗标断言扫描命中的新旗标。

---

### Task 1：修 D1——synastry-troubleshooting 内核来源表述

**Files:**
- Modify: `references/synastry-troubleshooting.md:63-65`

**Steps:**

- [ ] 把「确认跑的是哪一份内核」节的正文从「只有一份——内核按脚本自身位置（`import.meta.url`）定位，不依赖 cwd，也没有环境变量可覆盖。」改为：

```markdown
内核按脚本自身位置（`import.meta.url`）定位，不依赖 cwd；`ZIWEI_ROOT` 环境变量优先（想把内核指到别处时用），未设则用技能自带内核（即本仓库根的 `scripts/`）。`node scripts/purple-star.ts selftest` 输出的**第二行**（形如 `内核根：<路径>`，来源标注「ZIWEI_ROOT 环境变量」或「技能自带内核」）就是当前生效的那一份，交付解读前据此核对。
```

- [ ] 与 `references/troubleshooting.md` 的 ZIWEI_ROOT 表述逐字对拍，确认两篇口径一致（都写「ZIWEI_ROOT 优先，未设则技能自带」）。

### Task 2：修 D2——自检项数漂移

**Files:**
- Modify: `references/synastry-troubleshooting.md:70`

**Steps:**

- [ ] 把代码块注释里的「（排盘 / 古籍 / 合盘三段，末行自报项数；实测 120/120）」改为「（排盘 / 古籍 / 合盘三段，**项数以输出末行自报为准**，勿以文档数字为验收标准；2026-10-09 实测 128/128）」。

### Task 3：修 D3——「四化飞化互参」改名「四化互参」

**Files:**
- Modify: `references/synastry-guide.md:82-89`（第四步节）

**Steps:**

- [ ] 标题 `#### 第四步：四化飞化互参（高级技法）` → `#### 第四步：四化互参（高级技法）`。
- [ ] 该节正文中「飞化」字样逐个替换为「四化互参」或删除（保留对生年四化互落对方宫位的实质描述）；顶部第 8 行的 ⚠️ 段**保留不动**（防误用飞星工具，仍有效）。
- [ ] 全文 `grep -n "飞化" references/synastry-guide.md` 复核：除顶部 ⚠️ 警示段（「读到『飞化』不要…」是引用用户侧措辞，保留）外，正文不再出现。

### Task 4：修 D5/F2——SKILL.md 补首次安装指引

**Files:**
- Modify: `SKILL.md:10-20`（「路径约定」节）

**Steps:**

- [ ] 在「路径约定」节末尾（第 20 行「脚本本身可从任意 cwd 运行…」段后）追加：

```markdown
**首次使用**：在 skill 根执行 `npm install`（需 Node ≥ 22.18——本 CLI 靠 `module.registerHooks` 与原生 TS 类型擦除直接加载 `.ts`，不注册解析钩子；依赖清单见 `package.json`）。依赖未装或 Node 过低时的报错对照，见 [references/troubleshooting.md](references/troubleshooting.md)。
```

- [ ] 跑 selftest 验证文档-代码旗标断言不受影响：`node scripts/purple-star.ts selftest` 全绿。

### Task 5：回归与提交

- [ ] `node scripts/purple-star.ts selftest` 全绿。
- [ ] `npm test` 全绿。
- [ ] 提交：`git add SKILL.md references/synastry-troubleshooting.md references/synastry-guide.md && git commit -m "docs: 修评审实锤项——排障文档内核口径矛盾(D1)、自检项数漂移(D2)、四化互参改名(D3)、SKILL.md 首次安装指引(D5/F2)"`
- [ ] 更新 `docs/doubao/skill-docs-review.md` 与 `docs/doubao/skill-functional-review.md` 中 D1/D2/D3/D5/F2 的状态标记为 ✅（含一行「2026-10-09 修复」注记）。
