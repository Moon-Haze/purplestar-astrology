# 设计 · 报告形态取材收单点

## 一、三问

### 1. Deletion test（删掉是复杂度集中，还是只是搬家？）

- 删掉拟新增的 `mainStarLine` / `loanTag`：**三个消费点各自重建拼式** —— `views/overview.ts`
  重拼「本宫主星：」+ 借宫注（含星名）+ 徽标 + `topic === "overview"` 的五行局尾；
  `report.ts` 重拼命盘推演行与 `loanTag`。复杂度从一处回到三处，且**分叉无红灯**（这正是
  本次实测到的漂移）。→ 答案是「集中」，信号为正。
- 反向验证：删掉 `report.ts:272-276` 现在那段内联拼接，复杂度**消失**（单点已存在，无需
  任何调用方补写）。→ 它本就不该存在，属「该抽没抽」而非「抽错了」。
- 对照反例：`report.ts` 的「定调」行（`STAR_BRIEF`）只有 1 个消费点，删掉它只多写 0 行 →
  **不为它建同类字段**。

### 2. 接缝判据（加一个实现只需一个文件 + 一行注册？）

不新增模块。**复用既有接缝** `scripts/analysis/overview-material.ts` —— 它已经是被两个编排器
共用的取材 seam，本次只是把「本宫主星行」并入它。落地形态是：0 个新文件、0 行注册、3 个
消费点各改一行取值方式；没有新增分发逻辑、没有新增参数、没有新增配置项。比「一个文件 +
一行注册」更严。

### 3. 抽象 justify（删掉它会多写几行？）

会，且不只是行数：

- 三处各多写 1~3 行（借宫注的星名、`topic === "overview"` 分支的五行局尾、`借对宫` 字面量）；
- 更要紧的是**这些行分叉时没有任何断言会红** —— 本次已实证（两种形态同一行逐字不同，
  `npm test` 全绿）。抽象的价值在「分叉不可能」，不在省行数。

## 二、不可逾越的约束

- **冻结面六文件只引用、不改**：`scripts/types.ts`、`scripts/algorithm.ts`、`scripts/mutagen.ts`、
  `scripts/wenmo-brightness.ts`、`scripts/palace-relations.ts`、`scripts/corpus/data/annotations.ts`。
  本次全部不涉及。
- **真相源不另立判据**：`scripts/analysis/data.ts`（文案与主题注册表）、`scripts/cli/args/table.ts`
  （参数面）、`scripts/analysis/grades.ts`（引文档位）。本次不新增任何星名 / 宫名 / 档位表，
  只搬运行既有的拼式。
- **分层红线（ADR-003）**：analysis 属内容层，不得 import `cli/`、不得反向依赖命令层；
  改动只在内容层内。
- **失败可见性**：不引入兜底默认值；借宫注缺星名即视为漂移（不是「取不到就空着」）。
- **最小 diff**：只对本次真正新增 / 改动的行跑 prettier，不整跑 `npm run format`；
  不夹带无关文件的格式改动。
- **计数类事实不写死**：测试项数、selftest 项数一律以实跑末行自报为准，不写进文档与断言。
- **文本输出类改动必须有逐字节判据**：`--topic` 全主题输出与基线 diff=0；`--report` 的差异
  行数与形态可枚举。
- **引文纪律**：本次只搬运行，不新增 / 不改写倪师引语，引文守卫扫描面不受影响。
- **生成物不手改**：已核实 `tools/` 侧零消费 `renderOverviewItems` 与 `main-palace` 槽，
  故不触发 `manual:check` 与重导；若实施期发现另有消费点，停工另开 change。

## 三、决策与后果（两面）

### 决策

1. 新增字段名为 `mainStarLine`（整行，含 `本宫主星：` 前缀）而非 `loanNote` + 片段。
2. `loanTag` 一并收进 material，消灭「借对宫」字面量的第三形态。
3. 五行局尾（`topic === "overview"` 时追加 `，<五行局>`）随行收进 —— 它是同一 derivation
   的第二处复写（`views/overview.ts:81` 与 `report.ts:275`）。
4. material 的**兜底分支**（主宫与对宫俱无主星）也必须产出这两个字段，且逐字保持
   `report.ts` 该分支的现有形态（`本宫主星：` + 借宫注（无星名）+ `空宫`）—— 该分支
   `primaryStar` 为 `undefined`，`loanNote` 需按 `isLoan` 单独计算，否则会静默改掉
   这一罕见分支的输出。
5. 结构化侧不变：`views/overview.ts` 仍以 `contentItem(m.mainStarLine, "main-palace", { star })`
   产出，语义字段独立透出、不从成文反解 —— 满足 `analysis-structured` 的「结构化与文本同源」。

### 收益

- **locality**：一条口径一处实现，三种形态不可能再分叉。
- **leverage**：一个字段服务 3 个消费点 + 1 条对拍断言。
- **接口即测试面**：两形态同一行的同源性变成可断言的事实，漂移必红（反向注入已验证）。

### 代价

- `OverviewMaterial` 的 interface 增 2 个字段：接口变宽。但它们是「取值」不是「配置项」，
  调用方不需要为它们做决策 —— 深度是增加的（多行为 / 少决策），不是浅化。
- `--report` 有一处**有意**的行为变更（借宫行补回星名）：任何记录了该行的期望值
  （测试、文档示例）都要同步；实施第一步就是取基线并枚举差异行。
- material module 越过纯取材边界，持有一点版式前缀（`本宫主星：`）。取舍理由：两个形态共用
  同一前缀，若只暴露片段，前缀会在两处各写一遍 —— 回到原点。代价可控（前缀是常量，不是
  可变的版式策略）。

## 四、本轮候选清单与选题理由

扫描窗口：最近 40 次提交（排除 `scripts/corpus/data/manual/**` 与 lock 文件）；
热点 = `tools/db/export-manual.ts`、`scripts/cli/selftest/commands.ts`、`test/invariants.test.ts`、
`test/astrology-sections.test.ts`、`scripts/cli/commands/astrology.ts`、`tools/db/generate-shards.ts`、
`scripts/analysis/index.ts`。候选由两个子代理分区走查 + 主线程逐条抽验（结论附 `file:line`）。

| # | 候选                                                                          | 强度           | 处置与理由                                                                                                                     |
| - | ----------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **报告编排器绕过取材单点**（本 change）                                       | Strong         | **选定**。唯一带**实测漂移证据**的一处（同一盘同一行两形态逐字不同且全绿）；deletion test、接缝判据、抽象 justify 三问全过；切口最小、验收干净。 |
| 2 | `tools/` 入口协议 9 份手抄（main guard / 错误文案 / 退出码）+ 路径 `..` 判据 15 处各写一遍 | Strong         | 否。真实且安全相关，但属开发工具面（不进分发件）；验证链依赖本机 `db/` 数据集与 DuckDB，无人值守下「跑过」与「可见跳过」难分辨。另开 change。 |
| 3 | `selftest/kit.ts:70` 复制 `dispatch.ts` 的 `错误：` 前缀（断言的是副本，缺 `String(err)` 兜底） | Worth exploring | 否。单行级修复，收益真实但与本 change 不同接缝；并进来会稀释选题，单独做更干净。                                                 |
| 4 | `school/guard.ts` 的 `lai-yin` 分支是空实现 —— 自检与测试对它恒真             | Worth exploring | 否。另一能力域（school）的承诺 / 实现对齐问题，与本次接缝无关；单独立项。                                                       |
| 5 | `corpus/index.ts` 的 `getChapter` / `getParagraphById` 死导出；`knowledge` 的 `citations` 空接缝 | Speculative    | 否。删死导出虽过 deletion test，但属 corpus 域清理，无行为级摩擦证据（未被测但也未误导生产路径）。                                |
| 6 | 删 `analysis/items` 结构化平面（10 个 `renderXxxItems` 各 1 个 caller）       | Speculative    | 否（**且与 spec 冲突**）：`analysis-structured` 刚把结构化条目定为唯一产出形态（一源双投影）。删它是规范回退，除非先重开规范。      |

选题一句话：**在无人值守的批次里，优先选「证据已实测、验收可逐字节判定、且不依赖本机
环境」的那一个** —— 候选 1 三者齐备，其余候选或依赖数据链（2）、或跨能力域（3/4/5）、
或与现行规范冲突（6）。
