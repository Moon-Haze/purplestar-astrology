# Design

## Context

`scripts/school/types.ts` 的 `ForbiddenFeature = "self-mutagen" | "lai-yin" | (string & {})`，
`checkForbiddenFeatures` 只硬编码两分支（`self-mutagen` 真查、`lai-yin` 空分支 defer 到
`test/school.test.ts` 绊线断言）。2026-10-24 `settle-school-seam` 已把 `SchoolId` 的 `(string & {})`
逃生舱删掉，但漏了 `ForbiddenFeature` 同款。动机见 proposal.md。

不可逾越约束：体系立场 C3（`forbiddenFeatures` 仍列两特征）；绊线字段与 `test/school.test.ts`
断言一字不动；ADR-002 清单注册不动。

## Goals / Non-Goals

**Goals:**

- `ForbiddenFeature` 收成与 `SchoolId` 同款闭集，guard 只兑现已声明的特征

**Non-Goals:**

- 不动 guard 检查逻辑、不动绊线字段、不新增第二流派

## Decisions

1. **`ForbiddenFeature` 去 `(string & {})` 逃生舱，收成 `"self-mutagen" | "lai-yin"`。**
   与 `SchoolId` 既有决策对齐：新禁用特征走「types 联合加分支 + `guard.ts` 补真检查」两处显式。
   备选「保留逃生舱」被否——同一理由（「让忘了在类型层声明变得合法而不可见」）已在 settle-school-seam
   用于 SchoolId，`ForbiddenFeature` 无理由区别对待。

**三问：**

- deletion test：删掉逃生舱 = 复杂度集中到「显式两处声明」，不是搬家（当前仅 2 特征，无损失）。
- 接缝判据：新禁用特征 = types 联合 + guard 分支（两处显式，typecheck 兜底漏声明）。
- 抽象 justify：逃生舱是「承诺任意特征可声明」却兑现不了，删掉不损失能力。

## Risks / Trade-offs

- [闭集后新增禁用特征需改两处] → 这正是「显式声明」的代价，typecheck 兜底，与 SchoolId 同款
- [guard 只真查 1 个特征（lai-yin 空分支）的既有不对称仍在] → 已由 settle-school-seam 如实化注释，
  本变更不扩大范围，只收类型

## Migration Plan

1. `ForbiddenFeature` 收窄 + 注释同步 → 2. typecheck + selftest + `test/school.test.ts` 全绿。
回滚：单提交 revert。
