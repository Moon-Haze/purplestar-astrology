# Design

## Context

「参数会不会被独占分支吞掉」的事实分散在两处：声明表的 `shadow` 标志
（`scripts/cli/args/table.ts`，经 `SHADOWABLE_KEYS` 派生，table.ts:425-435）与命令侧
`composeSections` 的「缺上级」层级守卫（`scripts/cli/commands/astrology.ts:291-308`）。
四条独占分支（`astrology.ts:380` / :396 / :436 / :487）全部先于 `composeSections`
（:512）return，只经 `assertNoShadowedFeatures`（:218-238）——该函数只认 SHADOWABLE 域。
monthly 标了 shadow、daily/hourly 没标，缺口由此而成。动机与实跑证据见 proposal.md Why。

既有相关机制（本设计不复原样，直接引用）：`--topic` 的消费白名单
`consumed = ["yearly", "monthly"]`（astrology.ts:225）；selftest 对四套派生的
字符串快照等价断言（`scripts/cli/selftest/args.ts:163-194`，SHADOWABLE 快照在 :171）。

## Goals / Non-Goals

**Goals:**

- 守卫域收敛回声明表单一派生：运限四化层级族（monthly / daily / hourly）全员可被
  四条独占分支的被吞检测覆盖。
- block 与 allow 双向钉死：被吞必点名，`--topic` 消费 `--yearly` / `--monthly` 必放行
  （与复核发现下标 8 是同一道缝 `assertNoShadowedFeatures` 的两个方向，一次收缝双向完备）。

**Non-Goals:**

- 不改「缺上级」层级守卫的语义与位置（默认路径仍由 `composeSections` 管）。
- 不触碰排盘内核、四化派生、缓存与 `CACHE_VERSION`。
- 不把 `--view` 等未标 shadow 的参数扩入检测域（否决理由见 proposal.md 备选方案 3）。

## Decisions

**D1：修在声明表（daily/hourly 补 `shadow: true`），不在命令侧加检查。**

- *deletion test*：删掉的不是机制也不是实现——删掉的是「daily/hourly 落在守卫域外」
  这个缺口本身；「会不会被吞」的事实从两域并集收敛回 table.ts 这个自命的
  「有哪些参数」唯一来源（AGENTS.md「参数面单点声明」节），复杂度集中而非位移。
- *接缝判据*：此后新增运限/强化参数，声明表加一行（按需标 shadow）即全链覆盖，
  新增独占分支也只需保持「先调 `assertNoShadowedFeatures` 再 return」的既有形态，
  无须逐分支核对命令侧清单。
- *抽象 justify*：零新增抽象、零新常量，净增两行声明。

**D2：selftest 快照（args.ts:171）显式同步为 12 项，行为钉点交给独立路径断言。**

该快照与派生**同源**（都是同一派生的产物 vs 迁移基线反推），不是独立路径——它钉的是
「派生与迁移基线等价」，本变更是有理由的基线推进，同步时注释写明理由（修守卫域缺口）。
行为正确性由 `test/report.test.ts` 新断言承担，其期望值来自 CLI 实跑行为（独立路径），
两断言分工不同、缺一不可。预期快照串（12 项，字母序）：
`ages,daily,decadal,focus,hourly,info,monthly,mutagen,pattern,report,topic,yearly`。

**D3：block 断言覆盖四分支 × {monthly, daily, hourly}，allow 断言钉 `--topic` 放行。**

- 覆盖全部四条分支而非只钉 `--report`：缺口的历史成因是分支优先级链演进
  （`--report` / `--info` 均为近期加入）——只有 per-branch 覆盖才能抓住「未来新分支
  忘调 assert 就 return」；进程内实跑 12 组合，成本可忽略。
- monthly 一并纳入：复核确认其独占对照在 test 树同样无钉点，顺带补齐（一行循环的
  边际成本为零）。
- allow 方向（`--topic love --yearly 2027` / `--topic love --monthly 5` 必须 exit=0）
  与 block 同 it 钉住：`consumed` 白名单是承重墙，SHADOWABLE 未来扩容时防止反向误伤。

**D4：不递增 `CACHE_VERSION`。**

缓存键 = 出生信息哈希，与功能参数标志无关；本变更零触碰排盘输出结构（`--json` 顶层键、
文本渲染、运限四化派生均不动），不满足 AGENTS.md 递增条件。收益是 `npm test` 300 条
对拍基线零扰动；代价是若未来误判「参数校验也算输出结构」会漏递增——但校验层在
排盘完成之前，缓存读回路径根本到不了校验差异，风险不成立。

## 不可逾越的约束

- **分层红线（ADR-003）**：不触排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` /
  `data/` / `wenmo-brightness.ts`）与知识内容；本变更全部落在 `cli/args`、`cli/commands`
  的消费端与测试/文档。
- **冻结内核契约**：已核实 `test/kernel-contract.test.ts` 与 `test/invariants.test.ts`
  不引用 `SHADOWABLE` / `shadow`（grep 零命中），`cli/args/table.ts` 不在契约面内，
  本变更不破坏契约。
- **失败可见性（AGENTS.md:251-252）**：本变更正是它的修复，新报错文案沿用既有
  「点名 + 指路」形态（`assertNoShadowedFeatures` 现有文案不动）。
- **最小 diff**：`table.ts` 两行、快照一行、断言一个 it、文档两处；不整跑 format。

## Risks / Trade-offs

- [行为变化打断既有组合用法（如 `--report --daily 10` 开始报错）] → 这正是红线要求的
  方向；报错点名被吞参数并给独占分支指路，用户去除参数即可。该组合本来就不产生任何
  daily 四化输出，报错零信息损失。
- [selftest 快照手工同步拼错] → 纯字符串比对，selftest 即刻红；任务清单给出预期串
  （D2），且 `npm run typecheck` 兜不住的部分由断言本身兜住。
- [`--topic` 消费白名单与扩容后的 SHADOWABLE 交互] → daily/hourly 不在白名单、本就不被
  `--topic` 消费，报错是正确形态（本会话实跑确认 allow 方向两条合法组合 exit=0，
  修复不影响）；allow 断言（D3）防未来回归。

## Migration Plan

无部署步骤。单 commit 交付（代码 + 测试 + 文档 + 本变更工件），回滚 = revert 该 commit。
apply 完成后按 config.yaml 顺序跑三件套（`ZIWEI_NO_CACHE=1`）。

## Open Questions

无。
