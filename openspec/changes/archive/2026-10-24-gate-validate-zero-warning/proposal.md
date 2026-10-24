# Proposal

## Why

AGENTS.md 早已要求「改完 specs 跑 `openspec validate --all`，须全部通过、零警告」，但这条纪律只存在于人读文档，quality-gates 能力域的规范没有覆盖它——2026-10-24 实际发生了归档后的 spec 带着 requirement 超长警告进库（knowledge-retrieval，事后发现并修复），证明缺口真实：归档流程没有被任何规范面闸门卡住。

## What Changes

- quality-gates 新增一条 requirement：**OpenSpec 校验零警告**——specs 主干或 change 工件发生任何改动后，`openspec validate --all` 必须全部通过且零警告才算完成；出现警告（如 requirement 文本超长）必须当场修掉（拆分 requirement、把例子移进 scenario），不得带警告归档。
- 不改任何 `.ts` 代码、不改 CLI、不碰排盘内核。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `quality-gates`：新增「OpenSpec 校验零警告」requirement（ADDED delta）。

## 不做什么

- 不把 `openspec validate` 挂进 `npm test` / selftest：validate 管的是规范工件质量，与代码回归分属不同层；且测试层不引入 openspec CLI 依赖（与 tools/ 不进分发件同源考量）。
- 不设「警告数阈值」之类的弹性口径：零警告是硬口径，无分档、无豁免。

## 验证档位申报

本变更属**内容扩展档**（纯规范文档新增）：不触碰排盘内核与 CLI，不重跑内核回归。验证义务为 `openspec validate --all` 全过且零警告（改后不得引入新警告）；不涉及任何 `.ts`，typecheck / selftest / npm test 无义务跑。

## 被否决的备选

- **维持 AGENTS.md 人读纪律、不进 spec**：人读纪律只约束读到它的助手，规范面缺口已被 2026-10-24 的实例击穿（归档流程没被它卡住）；升格为 requirement 后，validate 与 archive 流程都有据可依。
- **新建 `spec-governance` 能力域**：单条 requirement 不值得开新域；quality-gates 本就是验证闸门的聚合域，语义归属正确，避免 broad catch-all。
