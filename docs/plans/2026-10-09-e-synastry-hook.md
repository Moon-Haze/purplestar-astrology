# 批次 E：事业合作合盘挂点（D4）实施计划

> **For agentic workers:** 本计划按任务逐步执行，步骤用 checkbox 跟踪。实现 spec：`docs/specs/2026-10-09-review-fixes.md` 批次 E。

**Goal:** synastry-guide 第八节「事业合作合盘判断」补启用条件与输出形态，消除「agent 读了判定表却不知何时启用、按什么模板输出」的行为标准缺口。

**Architecture:** 轻修法——在 guide 第八节顶部加启用条件与输出形态说明（指向 output-contract 的聚焦形态），不在 output-contract 新增第七形态（评审给出两个方向，取改动小且闭环的一个：用户明确问事业/合作时启用，按聚焦形态输出）。

**Tech Stack:** Markdown（references/synastry-guide.md）。

**Spec:** `docs/specs/2026-10-09-review-fixes.md`

## Global Constraints

- 措辞与 SKILL.md「本技能不做的事」节口径一致（方法论在 guide、命令输出不背方法论）。
- 不新增旗标名。

## Review Focus

- 启用条件要能被 agent 判定（「用户明确问事业/合作」是可判定的触发词面）。
- 输出形态指向必须真实存在（output-contract 的聚焦形态 300-600 字）。

---

### Task 1：guide 第八节补启用条件与输出形态

**Files:**
- Modify: `references/synastry-guide.md:162`（第八节标题下）

**Steps:**

- [ ] 在 `### 八、事业合作合盘判断` 标题之后、原判定表之前插入：

```markdown
> **何时启用**：仅当用户**明确**问事业合作 / 合伙 / 创业搭档类话题时（如「我们俩适合一起开店吗」）；默认合盘问的是婚姻配对，不要主动套用本节。
> **输出形态**：按 output-contract 的**聚焦形态**（300–600 字）组织，不新开第七形态；重点宫位：官禄宫（事业本体）、兄弟宫（合伙关系）、交友宫（合作对象），佐以双方命宫四化互落对方三方的引动。评分纪律与本指南第一节一致：CLI 不输出分数，星级是解读裁量，须注明。
```

- [ ] 通读第八节其余内容，确认与新加说明无口径冲突（吉象/凶象判定表保持不变）。

### Task 2：回归与提交

- [ ] `node scripts/purple-star.ts selftest` 全绿（文档改动不涉旗标）。
- [ ] 提交：`git add references/synastry-guide.md && git commit -m "docs(synastry): 事业合作合盘判定补启用条件与输出形态挂点(D4)"`
- [ ] 更新 `docs/doubao/skill-docs-review.md` D4 状态 ✅。
