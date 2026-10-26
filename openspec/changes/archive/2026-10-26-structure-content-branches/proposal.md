# Proposal

## Why

`analysis/data.ts` 的宫位语境语料是词典式全枚举：四化分支（「化禄则…化权则…化科则…化忌时…」，如 `data.ts:326` 武曲·财帛）与亮度分支（「入庙则…落陷则…」，如 `data.ts:238` 太阳·子女 suffix）嵌在整段散文里、无结构标记，渲染层（`overview-material` 的 `content`、`views/surround.ts` 的 `fullContent`）整段照搬——武曲只化权却四条全讲、太阳落陷却先讲入庙，报告与终端解读把与命主无关的分支一并输出。仓库已有同类问题的先例解法：性别差异由内联标记结构化为 `GenderField` + `selectGender` 投影（2026-10-24）；四化 / 亮度分支是同一性质的问题，用同一思路根治。

## What Changes

- **语料结构化**：`StarContent` 宫位语境文案中的**四化条件句**（化禄 / 化权 / 化科 / 化忌四分支）与**亮度条件句**（庙旺 / 落陷两分支）从整段散文拆为结构字段；分支文本逐字保留、只改承载结构，不改任何措辞。
- **渲染投影**：`overview-material` 与 `surround` 取 content 时按本盘实际（该星 `mutagen` 与 `brightness`）只拼接命中分支，未命中分支不再输出；徽标、`brightNote`、`mutagenNote` 等既有条件化通道不变。
- **渐进迁移**：渲染层同时兼容旧散文形态与新结构字段（旧形态照原样输出、新形态走投影），语料分批迁移——不要求一次改完全部 14 星 × 13 语境组合；迁移批次与完成判据由 design 裁决。
- **范围限定**：只结构化「化X则…」与「庙旺（入庙）/落陷则…」两类**可机器判定**的条件句（判定信号是该星的 `mutagen` / `brightness` 字段）；煞星会照、逢火铃等**无现成判定信号或判定复杂的自由条件**散文维持原状，不由本 change 处理。
- **不做什么**：不动排盘内核与六层四化口径；不动 `--topic` / `--report` 的章节结构（去重属 change `refine-report-dedup-citations`）；不改任何分支文案措辞（引文守卫盯住：不新增「倪师 / 倪海厦 + 引号句」形态，迁移时若遇须先在 `analysis/grades.ts` 登记）；不做与 `selectGender` 语义重叠的重复机制（投影在性别投影之后组合）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `interpretation-content`: 新增「条件分支以结构化字段承载」需求——四化 / 亮度条件句 SHALL 以结构字段承载、消费方按本盘实际投影为「命中分支 + 其余散文」，未命中分支 SHALL NOT 出现在交付文本中；与既有「性别内容结构化」需求同一数据模型精神（结构化承载 + 消费方投影）。

## Impact

- **代码**：`scripts/analysis/data.ts`（语料结构迁移，分批）、`scripts/analysis/overview-material.ts` 与 `scripts/analysis/views/surround.ts`（投影读取）、`scripts/analysis/data.ts` 类型定义（新分支字段类型）。
- **输出行为**：交付文本中未命中的四化 / 亮度分支消失——这是**内容行为变化**（非重构），终端 `--topic` 与 `--report` 同受影响（这正是本 change 的目的）；命中分支文本逐字不变。
- **测试**：键域漂移守卫（`test/invariants.test.ts`）可能需随新字段增补；「命中分支逐字保留」「未命中分支不出现」两类断言新增。
- **验证义务**：内容层改动，不触排盘内核——`npm run typecheck` + `node scripts/purple-star.ts selftest` 必跑；`npm test` 基准不比语料文本、不受影响，但引文守卫（`test/citations.test.ts`）扫描 `scripts/` 全树，迁移时新增引语形态会变红，tasks 里逐批核对。
