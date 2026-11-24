# Design

## Context

`openspec/config.yaml` 的 `rules.specs` 首条是单通道措辞（只认四形态机器判据）；`code-style`
spec 有两条过程性纪律 requirement（「注释少而精」「humanizer-zh 润色」）落不进四形态。见
proposal.md — Why。

## Goals / Non-Goals

- **Goals**：规则与被管对象自洽——机器可验的走机器通道，过程纪律显式走评审通道且不留
  不可判定的空场景。
- **Non-Goals**：不改四形态定义；不引入机器化的编辑判断（词表法等）；不动 context 指针
  纪律与 proposal / design / tasks / apply / archive 各节规则。

## Decisions

1. **双通道措辞落在 config.yaml，通道判定写进 requirement 正文而非 scenario**。
   - 理由：通道归属是 requirement 级属性（整条纪律是过程性还是机器可验），逐场景标注会
     产生大量重复括号注记；requirement 正文一句话声明通道，场景保持 WHEN/THEN 干净。
   - 备选（否决）：给每个过程性场景加「（评审对照）」后缀——重复、易漏、diff 噪声大。
2. **过程纪律的判定途径枚举为「评审对照 / 既有守卫 / 登记面」三态，且 SHALL 写明**。
   - 理由：只说「必须可验证」不解决任何事（正是现状）；枚举三态把「谁判定」钉死——评审
     对照（人按判据核）、既有守卫（仓库已有断言/扫描器）、登记面（列报清单如
     structural-exceptions.md），三者之外的「可验证」都是空话。
3. **「humanizer-zh 润色」requirement 不改**。
   - 理由：其场景已自带「评审对照可验」标记，在新规则下已合规；改了是零收益 diff。

## Risks / Trade-offs

- [双通道被滥用：什么都往「评审对照」塞] → 规则要求「写明判定途径」且枚举封闭（三态）；
  apply 时的评审对照即闸门，空话场景在评审时被点名。
- [config.yaml 与 spec 措辞漂移] → 本变更同时改两处并在 proposal 写明对应关系；归档折回后
  「注释少而精」正文与规则同批生效，不产生中间态。

## Migration Plan

apply 顺序：config.yaml 一条措辞 → code-style spec delta 折回（archive 时）→ validate
`--all --strict` 全过。零代码，无回滚面（git revert 即回滚）。

## Open Questions

（无）
