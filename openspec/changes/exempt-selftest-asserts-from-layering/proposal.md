# Proposal

## Why

ADR-003 的「插件层禁止反向依赖 `cli/`」与磁盘事实存在一处已知冲突：corpus / synastry 两个 selftest 断言组是主 selftest 汇总的**测试件**，必须引用 `cli/` 的共用 harness（kit），并以动态 import 打断「commands → selftest → 断言组」静态环（`scripts/corpus/selftest-asserts.ts:24,40-41`；`scripts/synastry/selftest-asserts.ts:28,158-160`，动态边代码注释已自证意图）。而 `openspec/specs/extensibility/spec.md` 的「插件反向依赖」场景措辞绝对（无豁免分支），docs/reviews 与 openspec 归档均查无豁免拍板（2026-10-25 的 decouple 变更甚至把 type-only 依赖都物理摘除，标准从严）——规范与实况脱节，违规面无界且无守卫，未来任何插件文件都可能以「测试需要」名义扩散同类依赖。

2026-11-21 架构评审裁决：物理拆分判为不必要（动态边拆不掉，搬家不算重构），应改 spec 加**有界豁免**并加扫描守卫把边界钉死。

## What Changes

- `extensibility`「内核与内容严格分层（ADR-003）」需求 MODIFIED：写入**唯一豁免边界**——corpus / synastry 的 `selftest-asserts.ts` 允许引用 `cli/selftest/kit`（静态）与 `cli/commands` / `cli/args` / `cli/args/scope`（动态）；「插件反向依赖」场景判定域收窄到豁免文件之外；新增「断言组豁免边界」场景。
- 层 6 扫描守卫（`test/repo.test.ts`「仓库自洽」describe 内新增一项）：扫描 `scripts/corpus/**` 与 `scripts/synastry/**` 全树 `.ts` 的 cli 引用边（静态 `from` + 动态 `import()` 双形态），与豁免白名单逐边比对——多边、少边、白名单文件消失均红。
- `AGENTS.md` 分层红线（ADR-003 节）补豁免说明一行。

**不做什么**：

- 不物理拆分 kit 或断言组——动态边拆不掉，字面合规做不到，且属「搬家不算重构」。
- 不放宽 ADR-003 本体——豁免按文件具名 + 按模块集具名，本体措辞照旧。
- 不动断言组代码与 selftest 接线。

**被否决的备选**（留档）：

- kit 搬出 `cli/` 成跨层共享模块：只能消静态边，动态边仍在，字面合规依旧做不到，还多一层目录——否决。
- 引入依赖图工具（madge 等）做全图扫描：否决——新依赖违背 ADR-001「不引外部包」精神；本仓 import 形态受格式闸门约束，文本扫描静态 `from` 与动态 `import()` 双形态已覆盖全部现实形态。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `extensibility`: 「内核与内容严格分层（ADR-003）」需求 MODIFIED——断言组豁免入 spec、反向依赖判定域收窄、新增豁免边界扫描场景。

## Impact

- `test/repo.test.ts` +1 项（层 6；项数 +1 属护栏扩展的预期变动）；`AGENTS.md` 一行；spec 归档时折回主干。
- 验证义务申报：护栏扩展（非内容扩展型），跑三件套 `typecheck` + `selftest` + `npm test`。
