# Proposal

## Why

架构评审 2026-10-25（候选 3）：`scripts/school/types.ts` 的 `ForbiddenFeature` 仍是
`"self-mutagen" | "lai-yin" | (string & {})` —— 保留了 `(string & {})` 逃生舱，而
`checkForbiddenFeatures` 只硬编码两个分支（`self-mutagen` 真查、`lai-yin` 空分支 defer 到
`test/school.test.ts` 绊线断言）。声明第三个禁用特征会静默什么都不做：接口承诺了它兑现不了的
执行能力。

2026-10-24 的 `settle-school-seam` 已把 `SchoolId` 的 `(string & {})` 逃生舱删掉（理由：不设
逃生舱，它让「忘了在类型层声明」变得合法而不可见），但**漏掉了 `ForbiddenFeature` 同款逃生舱**。
本变更是对称收尾，不推翻任何体系立场。

## What Changes

- `ForbiddenFeature` 收窄为闭集 `"self-mutagen" | "lai-yin"`（删 `(string & {})` 逃生舱），
  与 `SchoolId` 的既有决策对齐——新禁用特征走「types 联合加分支 + `guard.ts` 补真检查」两处显式
- `school/types.ts` 顶部注释同步：`ForbiddenFeature` 不再声称可放任意特征，guard 只兑现已声明的特征

## What Doesn't Change

- **体系立场不动（C3 红线）**：`forbiddenFeatures` 仍列 `self-mutagen` 与 `lai-yin`；
  绊线字段（`Palace.selfMutagen`）与 `test/school.test.ts` 断言一字不动
- **guard 检查逻辑不变**：`checkForbiddenFeatures` 的两个分支保持原样（`lai-yin` 空分支的
  「由绊线断言承担」注释已由 settle-school-seam 如实化，不再改动）
- **清单注册不动**（ADR-002）：`SchoolId` 与 `registry.ts` 不涉及本变更

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `extensibility`: 「体系立场随适配器声明」需求补一句——`forbiddenFeatures` 的类型是闭集
  （`self-mutagen` | `lai-yin`），不设 `(string & {})` 逃生舱；新禁用特征走显式两处声明

## Impact

- 代码：`scripts/school/types.ts`（`ForbiddenFeature` 收窄 + 注释同步）
- 验证义务：**纯重构档**（类型收窄，无运行时行为变化）——`npm run typecheck` 零错；
  `selftest` 全绿；`test/school.test.ts` 绊线断言一字未动且通过
