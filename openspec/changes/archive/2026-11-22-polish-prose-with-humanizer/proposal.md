# Proposal

## Why

仓库内的成段中文注释与仓库级分析文档（评审报告、外置代码说明、提案工件等）由 AI 助手撰写，
行文常带模板化表达（空泛铺垫、AI 高频词、公式化排比），评审与回读时是噪声。本机已装有
`humanizer-zh` 技能（编辑中文文本的去模板化润色，保留事实、确定程度与作者声音），但目前没有
一条规范要求成稿时过它——润不润全凭临场自觉，漏掉无人察觉。把「成段注释与分析文档成稿先经
`humanizer-zh` 润色」立为规范，行文纪律从此有单一出处。

## What Changes

- `code-style` spec 新增 requirement：成段中文注释与仓库级中文分析文档的散文正文，成稿时
  SHALL 经 `humanizer-zh` 技能润色；润色 SHALL 保留技术事实、术语口径与倪师引语（引文纪律
  优先于行文润色）；单行 why 注释、表格数据、生成文件豁免
- `openspec/config.yaml` 的 `operations.apply.guidance` 补一行 advisory 指引（apply 阶段
  必读面，指向新 requirement）
- 归档时同步两处非 requirement 文本：`code-style` 主 spec 的 Purpose 扩围（「只管放置与篇幅」
  →「放置、篇幅与中文行文」）；`AGENTS.md`「项目约束（不可动）」节补一行行文纪律——纪律的
  单一真相源在 AGENTS.md，spec 是细则
- 不加任何机器守卫（理由见「不做什么」）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `code-style`: 新增「注释与文档散文经 humanizer-zh 润色」requirement。该 spec 是本仓唯一的
  「写出来的东西怎么读」规范域，行文润色是它既有范围（放置、篇幅）的自然延伸

## Impact

- 规范面：`openspec/specs/code-style/spec.md`（ADDED requirement；Purpose 归档时扩围）、
  `openspec/config.yaml`（apply guidance 一行）、`AGENTS.md`（项目约束一行，归档时同步）
- 行为面：后续写成段注释、评审 / 提案文档时多一步润色；**不触任何代码、内核与 CLI**，属
  **内容扩展档**（不重跑内核回归），验收为 `openspec validate --all` 零警告
- 假设记录：「human 的那个技能」指用户级 `humanizer-zh`（`~/.agents/skills/humanizer-zh`，
  本机在册可用）；若用户另有所指，本 change 作废重提

## 不做什么

- **不加机器守卫**：humanizer-zh 的模式清单自我定位是「检查线索，不是词语黑名单；单词命中
  不是修改理由」——词表式 lint 断言必然高误报，也与 quality-gates「机器查不到的才值得加守卫」
  的立场相反。行文质量走流程纪律，不走闸门
- **不动引文**：倪师引语、`corpus/data/annotations.ts` 登记条目原样保留。引文守卫扫 `.md`
  全树，润色改了引语会当场红——引文纪律优先于行文润色，冲突时以引文为准
- **不覆盖所有文字面**：单行 why 注释（润色成本不成比例）、表格数据、代码块 / 命令 / 路径 /
  行内代码、生成文件（`docs/manual/` 等，生成物不手改）、`SKILL.md` 与 `references/`
  （行为规范文档，受 SKILL↔references 双向一致断言与参数面契约约束，不做文风改写）均豁免
- **不改润色技能本身**：`humanizer-zh` 是用户级技能，本仓只引用不修改

## 被否决的备选方案

1. **新建独立 capability（如 `docs-writing`）**：单 requirement 撑不起新域，deletion test
   不过——删掉这条 requirement 就剩空壳。并入 `code-style` 零新增结构
2. **放 `quality-gates`**：gates 域收机器闸门（断言 / 逐字节 diff / 计数 / 反向注入），
   本规则是不可机器验证的过程纪律，放进去名不副实
3. **词表式「AI 味」lint 守卫**：见「不做什么」第一条；误报率高，且与技能自身「非黑名单」
   设计直接冲突
