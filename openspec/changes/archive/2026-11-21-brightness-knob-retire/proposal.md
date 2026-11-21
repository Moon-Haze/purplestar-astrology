# Proposal

## Why

架构评审 2026-11-20（候选 N3）：`wenmo-brightness.ts` 的 `currentSchool` / `setBrightnessSchool` / `getBrightnessSchool` 三件套是**冻结契约面内的零消费可变内核状态**。全仓 grep 证实：set/get 的全部调用点是测试自己（契约测试钉存在性、invariants 自设自恢复）；唯一合法调用者类（插件层）被 extensibility spec 明文禁止修改内核模块状态（wenmo-nishi.ts:9 注释自证「不调用」）；生产消费（algorithm.ts 三处）全部不带 school 实参。运行时 `currentSchool` 恒为 `"XD2"`——**没有任何一方能合法跨越这个 seam**，它是假想 seam 的机制半边。spec 自己写着「适配器接口出现镜像字段 → 字段应删除而非继续零消费地保留」（extensibility「适配器镜像内核默认值」scenario）；同一原则作用到内核侧，落点就是这组旋钮。测试经 interface 测的是生产面不可达的状态迁移——测试面 ≠ 真实 seam。

## What Changes

- 退役三件套：`currentSchool` 模块级状态与 `setBrightnessSchool` / `getBrightnessSchool` 从 `wenmo-brightness.ts` 删除
- `wenmoStarBrightness` 的可选 `school` 入参**保留**，缺省值由 `currentSchool` 改为字面量 `"XD2"`（契约签名断言 `length === 2` 原样成立；运行时行为逐字节不变）
- 四流派数据表（`SB_BY_SCHOOL` 等）与 `validateWenmoBrightness` 启动期防线**原样保留**——多流派语义经数据 + 显式入参表达，不随旋钮退役
- 契约测试同步：`kernel-contract.test.ts` 移除旋钮存在性与签名断言（显式变更，非顺手改断言）；`invariants.test.ts` 移除旋钮自设自恢复用例（层 4 项数 -1），学理锚点断言补一行「缺省流派 ≡ XD2」
- 文档同步：`docs/code/chart-kernel.md`（契约面清单 + §5.6 状态位置节）、`docs/code/school.md`（引用而非迁移段）

## What Doesn't Change

- **排盘行为不动**：状态恒为 XD2 的证明即「全输出与基线逐字节 diff = 0」
- **多流派能力不动**：QS / XD1 / ZZ / XD2 四表与显式 `school` 入参保留（invariants 学理锚点本就传显式实参）
- **spec 的体系立场与既有 scenario 不动**：本变更在 extensibility **新增**「内核无运行时流派旋钮」requirement，是对「适配器镜像内核默认值」scenario 原则（零消费即删）在内核侧的落地，不改既有 requirement
- **冻结契约程序不动**：本 change 即 AGENTS「改内核导出须显式说明并同步该测试」的显式说明载体

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `extensibility`：新增 requirement「内核无运行时流派旋钮」（含退役程序与行为不变两个 scenario）
