# Design

## Context

现状与动机见 proposal.md 的 Why。设计面的关键现状：

- `scripts/cli/args/table.ts` 是参数声明表：`OPTION_GROUPS`（零依赖纯数据）+ 四套
  派生（shadow / birth / intent / deep）+ `SHADOWABLE_KEYS`（table.ts:433-443）+
  `EXCLUSIVE_PRIORITY_LABEL`（table.ts:472，纯文案字符串）。
- `scripts/cli/commands/astrology.ts` 持判定链的另三半：内联消费白名单（:225）、
  分支分发顺序（:356/395/428/481）、--info 上级三元梯（:365-371）、bespoke `--view`
  检查及其移序注释（:487-495）。
- 守卫现状：`selftest/args.ts:200-204` 把 `EXCLUSIVE_PRIORITY_LABEL` 与冻结字符串
  对拍；`selftest/args.ts:211-236` 穷尽性守卫只管 shadow/noShadow 表态、不管顺序；
  `test/report.test.ts:211-212` includes 双条件、`selftest/commands.ts:189-191`
  只查非空——本会话实跑探针证实这四面对移序回退全部放绿。

## Goals / Non-Goals

**Goals**

- 判定链（被吞域 / 放行集合 / 优先级 / bespoke 拒收）单点表态于 `table.ts`，命令侧
  与测试面全部改派生；行为逐字节不变。
- 移序前提从注释变成结构：bespoke 检查成为统一检测入口的前置段，不存在可对调的
  调用点先后。
- 跨字段不变量（放行 ⊆ 被吞域、分支名已声明、派生文案与冻结镜像一致）有 selftest
  断言守卫。

**Non-Goals**

- 不改任何对外行为（文案、退出码、放行判定、分发顺序）；
- 不动排盘内核与 `CACHE_VERSION`；
- 不动 `--json` 逐分支互斥与 `--template` 出口顺序（既定决策，见 proposal 不做什么）；
- 不生成分支体代码。

## 不可逾越的约束

- **失败可见性**（AGENTS.md:251-252）：判定链输入一律显式表态，不引入兜底默认、
  不静默忽略——本变更的守卫设计直接服务于此条。
- **参数面单点声明**（AGENTS.md「SKILL.md 与 CLI 的耦合」节）：`table.ts` 的
  `OPTION_GROUPS` 是「有哪些参数」的唯一来源——本变更新增的分支清单不得变成第二份
  参数清单，它声明的只能是**分支级关系**（谁消费谁、谁优先、谁 bespoke 拒收），
  参数本身的存在性仍以 `OPTION_GROUPS` 为准（由「分支名 SHALL 已声明」不变量钉住）。
- **最小 diff**（AGENTS.md:299-301）：行为零变化的验收 = 与基线逐字节 diff=0；
  不夹带无关格式改动。
- **轻路径纪律**：`table.ts` 保持零依赖纯数据（help / 未知命令路径不经此处）。
- **验证闸门**：不新增 test 文件，层表与 LAYERS 不动，内核层测试项数不动。

## Decisions

### D1：独立小表，不挂进 `OptionSpec`

新增 `EXCLUSIVE_BRANCHES`（名字在实现时可调）：按优先序排列的条目数组，每项

```text
{ name: "palaces" | "topic" | "report" | "info",
  consumes: string[],          // 放行集合（kebab 原名，与 SHADOWABLE_KEYS 同域）
  rejectsWithNote?: { keys, note }  // bespoke 拒收：--report 对 --view 的指路文案
}
```

**为什么独立小表而非 `OptionSpec` 第五格**：声明表身兼「有哪些参数」一职已足够重，
分支消费关系是分支级语义、主语是分支不是参数（`--topic` 决定它读什么）。独立小表
deletion test 通过：删掉它 = 判定链散回命令侧 5 处（复杂度集中回去）；挂 `OptionSpec`
则删除后声明表结构变化却收不拢优先级链（优先级没有参数侧归属）。

**代价**：声明表里出现第二张表，「参数在哪声明」多一个答案。缓解：小表只声明关系、
不声明参数存在性，且不变量断言钉死「条目分支名必须是已声明参数名」——两表不许漂移。

### D2：`rejectsWithNote` 用数据模板而非函数，`table.ts` 保持纯数据

bespoke 文案以 `{ keys: ["view"], note: "…不接受 {flag}…" }` 形态声明（占位符替换
由检测入口做），不放函数进 `table.ts`——它与 `OPTION_GROUPS` 同受「零依赖纯数据」
纪律约束（help 轻路径不经函数表）。

**备选已否决**：函数表（`() => string`）表达力更强，但打破纯数据定位、把文案组装
逻辑带进声明层。代价：模板形态只能表达「点名 + 固定指路」这一种 bespoke 形态——
当前唯一的 bespoke（`--report × --view`）恰好就是这一形态；未来出现分支逻辑更复杂的
bespoke（需要读 args 才能定文案），那时再显式升级机制并修订本 spec，不预设。

### D3：bespoke 前置并入统一检测入口，消灭移序前提

`assertNoShadowedFeatures`（astrology.ts:218-238）扩展为两段：前置段按清单条目的
`rejectsWithNote` 逐个检查（命中即抛 bespoke 文案），后置段是既有通用检测（consumed
从清单派生）。`--report` 分支删掉独立的 bespoke 调用点，只调一次统一入口。

**后果两面**：收益——「bespoke 必须在通用检测之前」从注释变成调用结构里不可表达的
错误（没有第二个调用点可挪）；代价——统一入口多一个职责段，函数从 20 行涨到约
35 行。deletion test：删掉前置段 = `--report × --view` 落回通用文案、bespoke 指路
消失且 report.test 子串钉点当场红——它是被测试钉住的行为段，不是可有可无的包装。

### D4：`--info` 上级梯与优先级文案从清单序派生

- 上级梯：`EXCLUSIVE_BRANCHES` 中排在 `info` 之前、第一个在场的分支 =
  现 `astrology.ts:365-371` 的三元梯结果；
- `EXCLUSIVE_PRIORITY_LABEL`：由清单序派生（`info` 条目带 `chainLabel: "其他功能参数"`
  显示段，其余为 `--<name>`），导出名与字符串值逐字节不变，selftest 既有冻结镜像
  对拍（`selftest/args.ts:200-204`）原样保留——它从「文案快照」升格为「清单顺序
  快照」，改清单序即红。

**为什么保留导出常量**：消费点（astrology.ts:235/375 报错文案、selftest 对拍）不动，
diff 最小；常量单一角色（优先级链的对外表述），派生不改变角色。

### D5：分发顺序保持手写，行为零变化

分支体（info → palaces → topic → report 的分发）是行为主体不是声明，不改不生成。
优先级语义今天由「分发顺序（palaces > topic > report）+ info 内部梯」共同实现，
本变更后梯与文案从清单派生、分发顺序不变——清单序与分发序的关系写进
`astrology.ts` 头注释与 `docs/code/cli-commands.md`，行为钉点已有
（`report.test.ts:215-220` 的互斥断言 + 枚举矩阵）。

**代价**：清单序（优先级）与分发序（代码位置）仍是两个序。接受理由：生成分发是
复杂度搬家（proposal 否决备选 3）；两序只在「info 被提前分发、内部让路」一处交叉，
且被不变量 + 行为钉点双向看住。

### D6：report.test 组合矩阵跳过条件从清单派生

枚举循环的 `continue` 条件改为「flag ∈ consumes ∪ rejectsWithNote.keys」（从 table.ts
派生）——`--report × --monthly` 格自动解禁（它既不被消费也不被 bespoke 拒收，探针
证实通用断言在该格成立），`--topic × {monthly, view}`、`--report × view` 保持跳过
（各有 allow 方向 / bespoke 断言分管）。bespoke 断言补钉子串「不接受」。

## 三问自检（config.yaml rules）

- **deletion test**：删掉 `EXCLUSIVE_BRANCHES` 小表 → consumed / 上级梯 / 文案 /
  跳过矩阵 / bespoke 前置五处全部散回手写，正是本变更收拢前的现状——复杂度集中，
  非搬家。
- **接缝判据**：落地后新增/退役独占分支或 shadowable 参数、调优先级、加 bespoke
  拒收 = `table.ts` 一处表态（+ 快照镜像显式推进），命令侧与测试面零协同；满足
  「一个文件 + 一行（项）」。
- **抽象 justify**：删掉小表会多写约五处手写副本与一段移序注释——答得出，立得住。

## Risks / Trade-offs

- [文案派生出错（拼接与原字符串不一致）] → 验收含 selftest 冻结镜像对拍 +
  基线逐字节 diff=0（含报错文案全文），双重看住；
- [统一入口两段化让 `--report` 分支少一次显式 bespoke 调用，读者困惑] →
  astrology.ts 头注释写明「bespoke 由清单前置段驱动」，docs 同步；
- [`rejectsWithNote` 模板形态表达力上限] → 见 D2，超出「点名 + 固定指路」形态时
  显式升级机制并修订 spec，不预设；
- [在途 hunk 冲突] → 工作区有未提交改动（git status 显示 docs/notes 在途），实现时
  只含本变更 hunk、不夹带（沿用 d6827fc/da4a449 的在途纪律）。

## Migration Plan

单仓单步落地，无部署面：先取基线（探针矩阵全文 + selftest/npm test 首行），再改
table.ts → astrology.ts → selftest/args.ts → report.test.ts → docs，每步跑
typecheck；回滚 = 还原单 commit（建议实现按仓库惯例一个逻辑变更一个 commit）。

## Open Questions

无——数据形态（D1/D2）、派生面（D3/D4/D6）、行为边界（D5）均已定；条目字段命名
（`consumes` / `rejectsWithNote` / `chainLabel`）在实现时可微调，不影响 spec 与
任务分解。
