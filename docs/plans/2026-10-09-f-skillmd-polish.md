# 批次 F：SKILL.md 打磨（R1/R2/R3）实施计划

> **For agentic workers:** 本计划按任务逐步执行，步骤用 checkbox 跟踪。实现 spec：`docs/specs/2026-10-09-review-fixes.md` 批次 F。

**Goal:** 「其他已知事实」按主题拆小标题、拼音别名收敛到 options.md 单一清单、知识源指引优先 CLI 命令。

**Architecture:** 纯 SKILL.md 正文重组（内容不改写只重新组织）+ 两处一句话增改。R4（触发词精简）明确不做。

**Tech Stack:** Markdown（SKILL.md）。

**Spec:** `docs/specs/2026-10-09-review-fixes.md`

## Global Constraints

- selftest 有「SKILL.md 提到的旗标都在声明表里」的文档-代码断言：改动后跑 selftest 必须全绿；不新增旗标词。
- 內容密度重组不删事实（SEO 论断库、亮度口径、虚岁、童限、宫序、月份、数据面七条全保留）。

## Review Focus

- R2 删别名列举后正文须留「拼音别名仍被识别」一句（否则 agent 会以为别名失效）。
- R1 小标题命名要让 agent 按需跳读（「我要查亮度口径」能直接定位）。

---

### Task 1：R1——「其他已知事实」拆小标题

**Files:**
- Modify: `SKILL.md:104-112`

**Steps:**

- [ ] 把 8 条混排列表重组为四个小标题（条目内容原样保留，仅移动位置）：

```markdown
## 其他已知事实

### 知识库来源

- **上游 SEO 版论断库不可用、也不作解读依据**：（原 SEO 段全文照搬）
- **分析数据库 v3 的输出分级**：⚠️ 其输出末尾带知识来源分级提示——库中「倪师说」引号句部分为传统口诀的**风格化转述**，不一定是《天纪》逐字原话，引用下断语须注明口径。（从原 SEO 条目尾部拆出的独立短条）

### 亮度与星曜口径

- **庙旺利陷口径**：（原条全文照搬）

### 年龄与运限口径

- **年龄一律是虚岁**：（原条全文照搬）
- **童限**：（原条全文照搬）

### 数据面布局

- **十二宫顺序**：（原条全文照搬）
- **流年 / 流月的月份**：（原条全文照搬）
- **运限数据面**：（原条全文照搬）
```

- [ ] 复核：8 条事实一条不少、文字未改（diff 逐词核对）。

### Task 2：R2——别名收敛到 options.md

**Files:**
- Modify: `SKILL.md:124`（高频参数段）

**Steps:**

- [ ] 把「（`--info` / `--palaces` / `--topic` 是独占分支；拼音别名 `--geju`/`--sihua`/`--liunian`/`--daxian`/`--xiaoxian` 仍被识别）」改为「（`--info` / `--palaces` / `--topic` 是独占分支；拼音别名仍被识别，全表见 options.md）」。

### Task 3：R3——知识源指引优先 CLI 命令

**Files:**
- Modify: `SKILL.md:71`（工作流第 2 步）

**Steps:**

- [ ] 把「需要展开论证时，**直接读 `scripts/` 下的权威文件**」一句扩为：「需要展开论证时，**能用 CLI 命令查的优先用命令**（如古籍原文用 `classics`、星曜释义用 `stars`——命令输出即已校验形态）；命令查不到或需读源码语义时，再读 `scripts/` 下的权威文件」。

### Task 4：回归与提交

- [ ] `node scripts/purple-star.ts selftest` 全绿（旗标断言重点盯）。
- [ ] `node scripts/purple-star.ts help` 输出与 SKILL.md 命令速查对拍一致。
- [ ] 提交：`git add SKILL.md && git commit -m "docs(skill): 其他已知事实拆四小标题(R1)、拼音别名收敛 options.md(R2)、知识源优先 CLI 命令(R3)"`
- [ ] 更新 `docs/doubao/skillmd-review.md` R1/R2/R3 状态 ✅（R4 保持「不做」并注明理由）。
