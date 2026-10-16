# Proposal

## Why

「总览段取什么材」的规则被两个编排器各写一遍：`views/overview.ts`（`--topic` 版式）
与 `analysis/report.ts`（`--report` 版式），**7 个决策点同构重复**（核心主题判定 /
topic_mods 双键注入 / 格局主题清单 / summary 段条件 / contentKey 全文选择 / 亮度
补充 / 第二主星），且漂移已实测发生：空宫兜底句一份「命格整体」一份「整体」、
星曜徽标两式并存（views/palace-query 带全角括号，report 的 `starBadge` 不带）。
无任何断言盯两侧一致——改一处漏一处，机器不叫
（architecture-review-20261016 候选 1，Strong）。

## What Changes

- 新建 `scripts/analysis/overview-material.ts`：
  - `starBadge(star)`——星曜徽标**单点**（带全角括号 `（庙旺）/（落陷）`，即
    views/palace-query 现行多数形态）；`views/overview.ts` 的内联与
    `palace-query.ts` 的 `descPalaceStars` 内联（同式）改引它，零输出变化；
  - `buildOverviewMaterial(ctx)`——总览取材纯函数，返回结构化段落
    （mods / geju / summary / mainBadge / loanNote / content / brightNote /
    secondStar / emptyFallback），7 个决策点只此一份。
- 两个编排器改为消费 material 各装版式：views 出【】头、report 出 ### 头。
- **文案统一**（两处漂移收敛，方向取多数形态）：
  - report 侧空宫兜底句「整体」→「**命格整体**」（对齐 views）；
  - report 侧徽标（节标题 badge 与第二主星行）「庙旺」→「**（庙旺）**」（对齐带括号）；
  - views 侧第二主星行现无亮度标注 → 统一后带「（庙旺/落陷）」（信息补齐，
    与主徽标同式）。
- 取材规则首次可独立单测（不经整篇输出）。

## 不做什么

- 不改任何取材**规则**本身（7 决策点语义原样，只集中不重写）。
- 不动其他 view 小节（surround/decadal/health 等零涉及）。
- spec 零涉及：interpretation-contract 不钉这三处文案（已 grep 核实），
  `skip_specs: true`。
- 不动 `--json` 通道（buildAnalyzeJson 零涉及）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无）

## Impact

- `scripts/analysis/overview-material.ts`（新）、`views/overview.ts`、`report.ts`、
  `palace-query.ts`（徽标改引单点）。
- 输出变化（预期内、逐项对拍验收）：`--report` 三处（兜底句 + 节标题徽标 +
  第二主星徽标）；`--topic` 一处（第二主星行加亮度括号）。
- `docs/cli-samples.md` 需再生成（含 --report/--topic 样例）；
  selftest 158 条零涉及（render 断言不盯这些句子）。
