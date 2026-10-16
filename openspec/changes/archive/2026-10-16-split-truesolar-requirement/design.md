# Design

## Context

主 spec `openspec/specs/chart-casting/spec.md` 的「真太阳时校正与跨午夜改期」需求
（见 proposal 的 Why）超长且四关注点混装；openspec 的归档机制约束了拆分形态：
MODIFIED 是**整块替换**，验证器拒绝丢失现行场景（现行 9 个场景必须全数保留在
MODIFIED 块内）。本变更是纯规范重组，零代码改动。

## Goals / Non-Goals

**Goals:**

- 单条需求正文 ≤500 字符，`openspec validate --all` 零警告；
- 现行 9 个 scenario 在 MODIFIED 块全数保留，两条 ADDED 需求各带行为场景，
  拆分后规范内无语义丢失；
- 每个 SHALL 条款语义原样保留，仅重组归属。

**Non-Goals:**

- 不改排盘实现与任何输出行为；
- 不新增/删除行为需求（拆分与搬运，不是收紧或放宽）；
- 不动其他六个 capability 的 spec。

## Decisions

1. **拆分机制走 MODIFIED + 2×ADDED，标题保留原名。**
   规程要求 MODIFIED「keep its header」——归档折回按需求标题匹配主 spec，改名会失配。
   代价是标题仍叫「真太阳时校正与跨午夜改期」而正文只剩校正口径；以需求内一行
   拆分说明指路。备选 RENAMED + MODIFIED 组合因归档行为未验证而放弃。

2. **六年 DST 起止表从需求正文移除，真相源声明保留。**
   正文只留「1986–1991 六年，起止表以 IANA tzdata `Asia/Shanghai` 为准」；逐年日期
   不再转录进 spec——表格是对 tzdata 的转录，属第二真相源（本仓红线：引用而非复制）。
   行为锚点不缺：scenario 已有 `1988-07-01`（区内）与 `1990-01-07`（区外）钉区间边界，
   实现侧 `birth-info.ts` 的 DST 表另有测试盯。备选「单行列举六年日期」仍属转录，弃。

3. **scenario 采用「MODIFIED 超集 + ADDED 自带」的官方拆分形态。**
   验证器裁决：MODIFIED 整块替换，**不得**少于现行 9 个场景——即使场景已搬进
   ADDED 也不行。因此 MODIFIED 保留全部 9 个场景（收窄的只是正文），两条 ADDED
   需求按行为归属自带场景：DST 五个（区间内默认回拨 / 区间外不受影响 / 边界时刻 /
   关闭自动回拨 / branch 路径不判定）、跨午夜一个（跨午夜回退）。
   归档后主 spec 存在 6 处场景复述（同文出现在 MODIFIED 超集与 ADDED 需求下）。

4. **边界口径（02:00 起/止、01:00–01:59 保守按拨回前）压进 DST 需求正文，不另立需求。**
   它是回拨行为的判定规则而非独立行为；「边界时刻」scenario 与之互证。

## Risks / Trade-offs

- [标题与收窄后的正文名不副实，误导后来者] → 正文内一句拆分说明显式指路；
  若未来规范工具支持 RENAMED 与 MODIFIED 组合再顺手改名。
- [6 处场景复述是漂移伏笔（改一处忘另一处）] → 场景文字以主 spec 现行为准逐字复述，
  本变更零改写；后续改场景措辞时须同改 MODIFIED 超集与对应 ADDED 需求两处。
- [正文重述边界口径仍可能被未来改动改宽] → 「边界时刻」scenario 的 01:59/02:00
  逐时刻钉是硬锚，评审时以场景为准。

## Migration Plan

归档时 `openspec archive` 以 delta 折回主 spec：MODIFIED 整块替换原需求（9 场景
保留、正文收窄）、两条 ADDED 追加在其后。折回后重跑 `openspec validate --all`
确认 7 项全过、零警告，并抽查两条新需求及其场景已在主 spec 内。回滚 = git revert。
