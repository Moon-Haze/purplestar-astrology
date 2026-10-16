# Proposal

## Why

`scripts/cli/selftest/commands.ts` 从结构评审时的 615 行涨到 851 行，走查
（architecture-review-20261016 候选 2）查明实质增长的大头是**文件内双写断言**：
① 旧命令名键集检查两处各查一遍（`runCommandSplit` 与 `runAstrologyShapes` 内，
4 键重叠，独有增量各 1）；② `--monthly` 守卫两条（`runCommandSurface` 直调版
含正向断言，`runAstrologyShapes` 组合层版无实质独有增量——`call` 与直调在
index.ts 是同一 `callDirect` 路径，`code===1` 的验证在 cli-samples 错误路径样例
与 test/cli.test.ts 已多重覆盖）。文件是 selftest/ 组文件的第二名 2.4 倍，
structure-review-20261011 候选 5 预留的「继续增长再二分」条件已实质触发。

## What Changes

- **去重**（先做）：`runAstrologyShapes` 内「astrology：旧命令名已删」一条删除，
  其独有键 `insight` 并入 `runCommandSplit` 的旧名清单；「组合层：守卫链 --monthly」
  一条删除（`runCommandSurface` 的直调版覆盖同守卫且多一段正向断言）。
  断言总数 160 → 158（首行自报，不写死）。
- **拆分**（后做）：`runAstrologyShapes`（377 行整块）搬入新文件
  `selftest/astrology-shapes.ts`；`commands.ts` 保留命令面杂项五组；签名收窄
  （`commandNames` 参数随该组内唯一消费者删除而移除）；`index.ts` 仅改 import
  来源，**组调用序不变**（报告顺序不变）。

## 不做什么

- 不删任何独有断言（insight / stars / oracle / classics / 正向节断言各留一处）。
- 不改断言文案与判据本体（搬移原样）。
- 不动 spec：quality-gates 九条需求无一钉死断言集或报告行数，且「计数类事实
  不写死」本就要求自报（`skip_specs: true`）。
- 不动组序与三段报告结构（古籍 / 合盘段零涉及）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——验证纪律的 spec 面未变，变的是断言集内部的重复项与文件归属）

## Impact

- `scripts/cli/selftest/commands.ts`（-377 行 + 两处去重 + import 清理）、
  新增 `scripts/cli/selftest/astrology-shapes.ts`（+约 390 行）、
  `scripts/cli/selftest/index.ts`（import 改道）。
- selftest 报告：首行合计 160→158、删 2 行断言行，其余逐字不变。
