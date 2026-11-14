# Design

## Context

被吞检测域由 `SHADOWABLE_KEYS` 从声明表单一派生（`scripts/cli/args/table.ts:427-437`），
两个 role 默认方向相反：`topic-deep` 默认入域（`:429-431`，`noShadow !== true` 收），
`output-select` 默认域外（`:432-434`，`shadow === true` 才收）。命令侧
`assertNoShadowedFeatures`（`scripts/cli/commands/astrology.ts:218-238`）只遍历该派生域
（`:226-231`），`--topic` 的消费白名单硬编码在 `:225`。守卫现状两道，均只守收缩方向：
selftest 快照 S（`scripts/cli/selftest/args.ts:173-177`，手抄冻结镜像）、行为钉点
（`test/report.test.ts:229-244`，封闭枚举 `{monthly, daily, hourly}`）。

本会话（2026-11-11）实跑探针，全部 `ZIWEI_NO_CACHE=1`，样本 `astrology 2011-06-24 07:45
男 杭州`（虚构）：

| # | 命令追加参数 | 现状行为 | 定性 |
| - | ------------ | -------- | ---- |
| 1 | `--info --view daxian` | exit=0 出面板，view 零提示 | **静默吞**（待修） |
| 2 | `--palaces --view daxian` | exit=0 出详表，view 零提示 | **静默吞**（待修） |
| 3 | `--report --view daxian` | bespoke 报错「--report 为本命静态口径，不接受 --view…」 | 已守卫（`:488-492`） |
| 4 | `--info --json` | bespoke 报错「--info 是独占分支，与 --json 不可同给…」 | 已守卫（json 各分支 bespoke） |
| 5 | `--info --no-cache` | 正常出面板 | 过程开关，不在被吐域（定性 noShadow） |
| 6 | `--info --template` | 打印配置模板，info 被吞 | template 是早退出口，「吞别人」非「被吞」（不在本域） |
| 7 | `--topic love --view daxian` | 正常出主题论断 | topic 消费 view（`:456-464`），白名单须放行 |
| 8 | `--topic love --template` | 打印配置模板 | 同 #6 |

基线：`ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` 164/164 全绿——五个未表态
决策（json / no-cache / view / config / template）在现行守卫下零红灯。

## Goals / Non-Goals

**Goals:**

- 「output-select 组 astrology 参数漏表态」从结构性沉默变为 selftest 红灯并点名参数；
- 存量五个未表态决策全部显式在册（view → shadow，四个 → noShadow）；
- view 入域的端到端行为面闭合：吞则点名、消费则放行、拒绝则指路。

**Non-Goals**（设计级边界，proposal「不做什么」之外的落地细节）：

- 不改 `SHADOWABLE_KEYS` 派生规则本身（output-select 组仍只读 `shadow === true`）；
- 不处理 `--template` 早退出口吞掉其他参数的顺序问题（探针 #6/#8，方向相反、另行立项）；
- 不给 `--topic` 裸开关（列清单路径）下被放行且忽略的 view / yearly / monthly 立新规
  ——既有 yearly/monthly 同款行为，一致性优先。

## Decisions

1. **断言域 = `role === "output-select"` 且 `cmds` 含 `"astrology"`**。该域是
   SHADOWABLE 潜在成员的精确超集：`--out`（`global`、无 cmds）与
   `search`/`limit`/`source`/`book`（knowledge 专属）不在被吞检测语义域，不加义务。
   备选「全组表态」会把 knowledge 参数也拖进 astrology 的守卫域——域错了，红得没有意义。
2. **断言住 `runDeclarationTable`（selftest/args.ts），不进 test/ 树**。与快照断言
   同居声明表断言组（注册 `scripts/cli/selftest/index.ts:120`）；进 test/ 树则触发
   新增文件双登记闸门并给「内核层项数」报警器添噪声（AGENTS.md:311-312）。断言体
   消费 `table.OPTION_GROUPS` 纯数据，与既有 `unmarked` role 检查（args.ts:203-206）
   同构——那是「组必须标 role」，本断言是「参数必须表态 shadow 决策」，粒度递进。
3. **`noShadow` 在 output-select 组是纯表态位**：派生不看它（`table.ts:432-434`），
   标注零行为效果。后果两面——收益：存量补标对 S 快照与所有现有行为**中性**，红灯
   机制与行为面解耦（评委复核确认 noShadow 唯一消费点在 topic-deep 分支
   `table.ts:430`）；代价：`noShadow` 字段从此有两个 role 的用法，`OptionSpec` jsdoc
   （`table.ts:38-39` 现写「专题深入组的 palaces」）与 `docs/code/cli-args.md` 必须同步
   扩义，否则读者会误以为它参与 output-select 派生。
4. **view 走 `shadow: true` + 白名单扩容，而非 `noShadow` + 逐分支 bespoke**。这是
   2026-11-09 被否决方案 3 的正面应用：那边否决的是「改派生规则全量入集合」，
   并在末句指出「显式 shadow 标志正是逐参数声明消费语义的精确机制」——view 正是
   该机制的下一个使用者。消费白名单 `["yearly","monthly"]` → `["yearly","monthly",
   "view"]`（`astrology.ts:225`）保住探针 #7 的合法用法。
5. **report 分支的 bespoke view 检查移序而非删除**（`:488-492` 移到 `:487`
   `assertNoShadowedFeatures` 之前）。view 入域后统一检测会先抛通用「不会生效」文案，
   bespoke 原位变死代码；删除则丢「运限视角见 `--topic <key> --view …`」的出路指路。
   移序保文案、除死代码；`test/report.test.ts:206-212` 只断言报错含 `--report` 与
   `--view` 子串、未钉全文，移序不破既有断言。
6. **快照 S 12→13 项是「有理由的基线推进」**，沿 2026-11-09 先例（args.ts:170-172
   注释体例）：推进理由 = view 显式表态入域，与声明变化一一对应。穷尽性断言落地后，
   任何未来的快照推进都必然伴随显式表态——「顺手迁就实现」的路径被声明义务堵死。

**三问（config.yaml rules）**：

- *deletion test*：删掉本断言 = 回到现状——下一个 output-select 新参数漏标时，派生
  集合与快照串都不含它（恒绿）、行为钉点枚举不含它、命令侧只遍历派生域——三道守卫
  全绿而参数被静默吞，daily/hourly（第一次）与 view（第二次，探针 #1/#2）的失败形态
  重演。断言是唯一守增长方向的闸门，且零代码挪动（非搬家）。
- *接缝判据*：此后新增 output-select astrology 参数 = 声明表一处加参数 + 一行表态；
  忘写表态不是「静默漏」而是「当场红 + 点名」。对比现状：加被吐域参数要人肉同步
  标志 + 快照串 + 行为钉点三处，漏任一处零红灯——接缝判据（AGENTS.md:307）此前
  不过，此后过。
- *抽象 justify*：断言约 10 行；删掉它要多写的是「每个新参数三处手工同步」的纪律
  与无限次的静默缺口风险——不是几行代码能换的。

**不可逾越的约束**（既有决策，不可动项）：

- 分层红线 ADR-003：断言与表态全部落在 CLI 层（`table.ts` / `selftest/args.ts` /
  `astrology.ts` / `test/report.test.ts`），不触排盘内核与知识内容；
- 失败可见性（AGENTS.md:251-252）：本变更只把静默变报错，不引入任何兜底默认；
- 参数面单点声明：`table.ts` 的 `OPTION_GROUPS` 仍是唯一来源，断言读它、不复制它；
- 验证闸门（AGENTS.md:311-312）：改现有 test 文件、不新增文件，内核层项数不动；
- 最小 diff：format 只对本次新增/改动行跑；
- 计数不写死：selftest 项数变化以首行自报为准，文档不写死数字。

## Risks / Trade-offs

- [`noShadow` 双 role 用法造成误读] → 决策 3 的 jsdoc / docs 同步列为交付项，缺它
  不算完成；
- [快照推进被当作迁就先例] → 推进注释写明联动理由（view 表态），且穷尽性断言保证
  未来推进必有显式声明可溯；
- [白名单扩容后读者以为 topic 消费语义扩大] → `:225` 白名单注释同步补一句
  「view 是 topic 的展示口径参数」；
- [`--topic` 裸开关下列清单路径仍放行并忽略 view / yearly / monthly] → 既有行为，
  Non-Goal 已声明；若未来要管，属列清单路径自身的守卫，不属被吞检测域；
- [探针 #6/#8（template 吞别人）留在域外] → 显式记录于本设计与 proposal「不做什么」，
  防止下次评审误判为遗漏。

## Migration Plan

单 commit 落地（声明 + 断言 + 行为面 + 钉点 + 文档一体，不可拆——拆开会出现
「断言红而表态未补」或「view 入域而白名单未扩」的中间红态）。无数据迁移、无缓存
失效（不递增 `CACHE_VERSION`，排盘输出零变化）。回滚 = revert 该 commit，无善后。

## Open Questions

（无。）
