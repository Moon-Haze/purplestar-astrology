# Proposal

## Why

四条独占分支（`--info` / `--palaces` / `--topic` / `--report`）会把 `--daily` / `--hourly`
**静默吞掉**：本会话实跑（2026-11-09，`node scripts/purple-star.ts astrology --date 1990-05-15
--time 09:30 --gender male`）`--topic love --daily 10`、`--report --daily 10`、
`--topic wealth --hourly 3`、`--info --daily 10` 四条全部 exit=0、stderr 空、输出零点名；
对照组 `--palaces --monthly 5` 则正确报错「以下功能参数不会生效：--monthly」。这与
AGENTS.md「项目约束（不可动）」失败可见性第一条（AGENTS.md:251-252，静默吞参数「已全数」
改为报错+指路、不得静默忽略无效输入）直接相悖——该条对 daily/hourly 当下不成立。

根因是「会不会被吞」这一事实分裂在两套守卫域，并集有缺口、交集恰是 daily/hourly：

1. **声明表侧**：`--monthly` 标了 `shadow: true`（`scripts/cli/args/table.ts:280`），同属
   运限四化层级族的 daily/hourly 没标（`table.ts:286-298`）；`SHADOWABLE_KEYS` 按该标志派生
   （`table.ts:425-435`，output-select 组只取 `shadow === true`），两参数结构性落域外。
2. **命令侧**：daily/hourly 的「需要上级参数」层级守卫只住 `composeSections`
   （`scripts/cli/commands/astrology.ts:291-308`），而四条独占分支全部先于它 return
   （`--info` assert 于 `astrology.ts:380`、`--palaces` :396、`--topic` :436、`--report` :487，
   `composeSections` 在 :512 才被调用），层级守卫不可达；独占分支调用的
   `assertNoShadowedFeatures`（`astrology.ts:218-238`）只认 SHADOWABLE 域。

测试面同样空白：全 `test/` 树没有任何「独占分支 × daily/hourly」钉点（grep「不会生效」零命中；
`test/report.test.ts:206-213` 既有独占用例只钉 `--pattern` / `--json` / `--view`）；
`docs/code/cli-args.md:90-94` 把 SHADOWABLE 派生写成完备口径（「标了 shadow 的五项」），
与实跑行为语义脱节。allow 方向（`--topic` 自身消费 `--yearly` / `--monthly`，白名单在
`astrology.ts:225`）今天实跑确认正常放行（exit=0 出主题论断），修复不得误伤它。

## What Changes

- **声明表单点修复**：`scripts/cli/args/table.ts` 给 daily / hourly 补 `shadow: true`
  （各一行），运限四化层级族（monthly / daily / hourly）全员进入 SHADOWABLE 派生域，
  四条独占分支的被吞检测覆盖到全族。
- **selftest 快照显式同步**：`scripts/cli/selftest/args.ts:171` 的 SHADOWABLE_KEYS
  等价快照从 10 项扩到 12 项，注释写明扩项理由（修守卫域缺口，非漂移）。
- **测试钉点补齐**：`test/report.test.ts` 既有「独占分支」describe 内新增 it——
  四条独占分支 × {monthly, daily, hourly} 全组合必须点名（block 方向，顺带补上
  monthly 独占对照在 test 树的无钉点空白）；并钉 allow 方向：`--topic` 同给
  `--yearly` / `--monthly` 必须放行（消费白名单是承重墙，防 SHADOWABLE 扩容后反向误伤）。
- **文档同步**：`docs/code/cli-args.md:90-94`「五项」改「七项」并列出 daily/hourly；
  核对 `docs/code/cli-commands.md` §4.6 是否需要补一句层级族归属。
- **不做什么**：
  - 不动排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` /
    `wenmo-brightness.ts`）与知识内容——排盘输出零变化，**不递增 `CACHE_VERSION`**；
  - 不改 `composeSections` 的「缺上级」层级守卫职责（`--daily` 需要 `--monthly` 等报错
    继续管默认路径，语义是「缺上级」不是「不会生效」）；
  - 不给 `--view` 等未标 shadow 的参数扩入 SHADOWABLE（`--view` 被 `--topic` 合法消费，
    见被否决方案 3）；
  - 不改 `SKILL.md` / `references/`——它们的表述（「与其余功能参数同给会报错指路」）本就是
    正确契约，本变更让现实追上规范，规范无须倒退迁就 bug；
  - 无 AGENTS.md 改动（:251 的「已全数」在修复后重新成立）。

## Capabilities

### New Capabilities

（无——守卫行为归属既有 chart-casting 能力的输入校验面。）

### Modified Capabilities

- `chart-casting`：新增「独占分支不静默吞功能参数」需求——被吞检测域 SHALL 由参数声明表
  单一派生（`shadow` 标志 + `noShadow` 排除 + 独占参数自身），运限四化层级族全员受四条
  独占分支守卫覆盖，`--topic` SHALL 放行其自身消费的 `--yearly` / `--monthly`。

## Impact

- **代码**（3 个文件、约 4 行实质改动）：
  - `scripts/cli/args/table.ts`：daily / hourly 各补一行 `shadow: true`（该字段已存在，
    无类型改动）；
  - `scripts/cli/selftest/args.ts`：快照字符串 10→12 项（显式同步，非顺手迁就——
    该断言与派生同源，不是独立路径，行为钉点由 report.test.ts 的新断言承担）；
  - `test/report.test.ts`：既有 describe 内加 it，**无新增测试文件**，不触发
    `test/README.md` 层表与 `test/lib/run.ts` LAYERS 登记义务，内核层测试项数不动
    （AGENTS.md:312 越界报警器无感）。
- **文档**：`docs/code/cli-args.md`（必改）、`docs/code/cli-commands.md` §4.6（核对）。
- **行为变化方向**：四条独占分支 × daily/hourly 从「静默吞」变「非零退出 + 点名 + 指路」
  ——恰是失败可见性红线要求的方向；`--topic` 消费白名单不受影响（daily/hourly 本就不被
  它消费，报错正是正确形态，本会话实跑确认无误伤）。
- **验证义务申报**（按 config.yaml 三档）：不触排盘内核与依赖、不属内容扩展，且是
  CLI 行为变化（非纯重构，不适用 diff=0 档）——**从严按「内核或依赖改动」档跑三件套**：
  `npm run typecheck` + `node scripts/purple-star.ts selftest` + `npm test`（回归链路恒设
  `ZIWEI_NO_CACHE=1`）。预期全绿：`npm test` 的 300 条对拍基线只依赖排盘输出（零变化），
  selftest 变化点仅在 args 快照一行（随本变更显式更新）。

## 被否决的备选方案

1. **在四条独占分支逐分支硬编码检查 daily/hourly，或扩 `assertNoShadowedFeatures`
   调用侧清单**——把「会不会被吞」的事实从声明表搬到命令侧的第二份手抄清单，新增运限
   参数还要再改命令侧，接缝判据不过（AGENTS.md:307）；搬位移不缺位。
2. **把 `composeSections` 的层级守卫前置到所有独占分支之前**——语义错位且不完备：
   「缺上级」（--daily 需要 --monthly）不是「不会生效」，用户补了上级参数后参数仍被吞、
   照样静默；且 `--topic love --daily 10` 会得到误导性的「需要 --monthly」报错。
3. **改 SHADOWABLE 派生规则让 output-select 组全量入集合（不看 shadow 标志）**——
   `--view` 会被误标为可吞，而它是 `--topic` 的合法消费参数（`astrology.ts:456` 读 view），
   被迫同步扩 consumed 白名单——把耦合从声明表挪进命令侧，问题换位置不解决。
   显式 `shadow` 标志正是「逐参数声明消费语义」的精确机制。
4. **让 `--topic` 把 daily/hourly 加进消费白名单**——语义错误：主题论断不消费运限四化
   层级参数，白名单兜住它们等于把 bug 合法化；报错+指路才是该组合的正确形态。
