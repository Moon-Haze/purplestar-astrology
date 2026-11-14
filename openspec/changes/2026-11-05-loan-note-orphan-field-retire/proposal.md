# loanNote 写不读：interface 面收敛到「字段皆有消费者」

## Why

刚归档的取材收单点 change（single-source-report-material）把「本宫主星行」收进
`buildOverviewMaterial` 单点并加了三盘对拍断言——**修复本身是成功的深化**，接缝成了
测试面。但 interface 上留下了被单点取代的旧部件：

- `overview-material.ts:55` 的 `loanNote: string` 字段：两分支照常产出（`:96,:105-106,
  :151-152,:192`），但拼 `mainStarLine` 用的是**局部变量**，字段导出**零外部消费者**
  （grep 全仓：`views/overview.ts:80-82` 与 `report.ts:271` 均消费 `mainStarLine`，
  标题消费 `loanTag`+`mainBadge`，无人读 `loanNote`）。
- **「部件重建」引力仍在**：`mainStarLine` 与其部件（`loanNote`+`mainBadge`+五行局尾）
  同时在 interface 上透出。对拍断言只钉住现存两形态，钉不住第三份——下一个消费者完全
  可能像 change 之前的 `report.ts:272-276` 那样用部件重建拼式（`views/overview.ts:80`
  的「不得在此重建拼式」只是注释约束，非断言）。

deletion test：删 `loanNote` 字段零调用方破坏，复杂度湮灭。

## What Changes

1. `scripts/analysis/overview-material.ts`：`loanNote` 降为函数内局部量，`OverviewMaterial`
   删该字段；`OverviewMaterial` 注释写明「`mainStarLine` 是唯一成文形态，`mainBadge` /
   `loanTag` 仅供标题徽标与借宫标记」。
2. 无消费方改动（本来就没人读它）；无测试改动（对拍断言比对的是输出行不是字段）。

## Capabilities

- **New / Modified Capabilities**：无。`analysis-structured` 的「双形态取材单点」
  requirement 只声明 `mainStarLine` / `loanTag`，不涉及 `loanNote` → `skip_specs`。

## 不做什么

- **不动 `mainBadge` / `loanTag`**——两者有真实消费者（`report.ts:201` 标题）。
- **不把「禁止部件重建」升级为类型机制**（如 Opaque 类型）——注释 + interface 收敛
  已消除当前引力；为假想第三份实现上类型机制不成比例。

## 验证义务

**纯重构档**：先取基线（`--topic` 全主题 + `--report` 全量输出），改后**逐字节 diff=0**；
`npm run typecheck` + `npx eslint scripts/analysis/overview-material.ts`；
`ZIWEI_NO_CACHE=1 npm test` 全绿且分层项数与基线一致。

## 被否决的备选方案

- **字段保留、加「loanNote ≡ mainStarLine 去前缀」对拍断言**：否决——给 write-only
  字段加断言是为无人消费的导出面付持续测试成本；单点的既有三盘对拍已覆盖成文形态。
- **顺带把 `mainBadge`/`loanTag` 也内联**：否决——它们有消费者；deletion test 只对
  `loanNote` 通过。
