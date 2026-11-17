# Proposal

## Why

独占分支判定链「谁被吞 / 谁被消费 / 谁优先」没有单点。**block 半边**（谁被吞）已按
chart-casting spec:250-253 的 SHALL 单一派生（`scripts/cli/args/table.ts:37,40` 的
shadow / noShadow 标志 → `table.ts:433-443` 的 `SHADOWABLE_KEYS`，穷尽性守卫在
`scripts/cli/selftest/args.ts:211-236`）；但同一条链的另三半仍是手写副本：

1. **消费白名单内联在命令侧**：`scripts/cli/commands/astrology.ts:225` 手写三元
   `exclusive === "--topic" ? ["yearly", "monthly", "view"] : []`——allow 半边（谁被放行）
   不在声明表，spec 对它只有行为级 scenario（chart-casting:262-266），没有「单一派生」条款。
2. **优先级链有三份编码**：cmdAstrology 的分支顺序本身（`astrology.ts:356/395/428/481`）、
   --info 分支手搓的三元梯（`astrology.ts:365-371`）、`table.ts:472` 的
   `EXCLUSIVE_PRIORITY_LABEL` 字符串（只当文案用，零逻辑派生——grep 证实其消费点全是
   报错文案与 selftest 快照比对）。
3. **移序前提只活在注释里**：2026-11-11 引入的「bespoke --view 检查必须在通用独占检测
   之前」（`astrology.ts:487-495`）没有任何闸门兜底。本会话实跑探针证实：
   `--report --view daxian` 得 bespoke 文案「--report 为本命静态口径，不接受 --view…」，
   而通用文案模板（`--palaces --view daxian` 实跑得「--palaces 是独占分支，以下功能参数
   不会生效：--view…」）包含 `report.test.ts:211-212` 所查的全部子串——移序一旦被改回，
   `report.test.ts:211-212`（includes 双条件）、`selftest/commands.ts:189-191`（只查
   `!msg` 非空）、selftest 快照与穷尽性守卫（只管标志不管顺序）**四条测试面全部保持全绿**，
   bespoke 变死代码、放行侧后门静默重开——直接顶在失败可见性（AGENTS.md:251-252
   「绝不静默忽略无效输入」）这条不可动约束上。

摩擦不是预测而是已发生的账：d6827fc 补 daily/hourly 动了 table.ts + selftest 快照 +
report.test + docs 四处；da4a449 补 view 动了六处（table.ts 五个表态 + astrology.ts
白名单与移序 + selftest 快照 + report.test 枚举 + 两份 docs）。同一根因数日内两次
change，正是 AGENTS.md:307 接缝判据「改三处以上分发逻辑＝不是接缝」的实锤形态。
另有 `report.test.ts:238-243` 的跳过矩阵是白名单的又一份手抄：`--report × --monthly`
也被跳过，但本会话实跑证实其行为是通用「不会生效：--monthly」，通用断言本可覆盖而
注释只解释了 `--topic × --monthly` 与 `--report × --view` 两格。

## What Changes

- **声明表新增按优先序的独占分支清单（核心）**：`table.ts` 加一张独立小表
  （`OptionSpec` 四格不动），每项 = 分支名 + `consumes` 集合 + 可选的 bespoke 拒收
  表态（`--report` 对 `--view` 的拒收与指路文案以数据声明，table.ts 保持零依赖纯数据）。
  「谁被吞 / 谁被消费 / 谁优先」自此在一个文件、一个决策点表态。
- **命令侧五处散抄全部改为派生**：
  - `assertNoShadowedFeatures` 的 `consumed` 内联三元（`astrology.ts:225`）→ 从清单
    该分支条目派生；
  - `--info` 的上级三元梯（`astrology.ts:365-371`）→ 从清单派生「排在本分支之前的、
    第一个在场的分支」；
  - `EXCLUSIVE_PRIORITY_LABEL`（`table.ts:472`）→ 从清单按序派生，字符串逐字节不变；
  - bespoke `--view` 检查（`astrology.ts:491-495`）→ 并入统一检测入口的前置段，由清单
    数据驱动——顺序前提从注释变成结构，不再存在可对调的调用点先后；
  - `report.test.ts:238-243` 的手写跳过条件 → 从清单派生（`consumed` ∪ bespoke 拒收
    集合之外的全部组合走通用断言）。
- **声明完整性守卫（selftest/args.ts）**：新增断言钉跨字段不变量——每项 `consumes`
  的成员 SHALL 是声明表中标 `shadow` 的参数名（消费方 ⊆ 被吞域，本会话核实 yearly /
  monthly / view 三项均 `shadow: true`，不变量今日成立）；清单分支名 SHALL 是已声明的
  参数名；派生出的优先级文案与 selftest 既有冻结镜像一致（清单顺序被改即红）。
- **测试面收口**：`report.test.ts:211-212` 的 bespoke 断言补钉 bespoke 特有子串
  （「不接受」），删除 bespoke 表态时红灯可见——四条测试面里最后一条「只查非空 /
  includes 双条件」的兜不住面收口；`--report × --monthly` 格从跳过矩阵移出，改由
  通用枚举覆盖（探针证实通用断言在该格成立，覆盖净增一格）。
- **文档同步**：`docs/code/cli-commands.md`（优先级链完整表述与消费白名单节）与
  `docs/code/cli-args.md`（独占分支清单的声明位置与派生关系）。
- **不做什么**：
  - 不动排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` /
    `wenmo-brightness.ts`）与知识内容，不递增 `CACHE_VERSION`；
  - **行为零变化**：不改各分支分发顺序、不改任何报错文案、不改放行/吞掉判定结果——
    chart-casting spec:255-273 的 block/allow 两向 scenario 原样成立，selftest 快照 S
    （SHADOWABLE 域不变，零标志增删）照旧；
  - 不动 `--json` 的逐分支 bespoke 互斥检查（json 已标 noShadow、不在检测域，其互斥是
    分支特定组合规则、bespoke 信息量更高——沿用 2026-11-11 变更的既定决策）；
  - 不动 `--template` 的早退出口顺序（config-input 层出口顺序问题，不在本提案域）；
  - 不给 `OptionSpec` 加字段（分支清单是独立小表，不与「有哪些参数」的声明混装——
    常量单一角色）；
  - 不把手写分支体改为生成代码（分支体是行为主体不是声明，生成化是复杂度搬家，见
    否决备选 3）；
  - 不触碰在途未归档变更（已核实 5 个 2026-11-05 变更均不含独占分支域内容，互不干扰）。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `chart-casting`：「独占分支不静默吞功能参数」需求的单一派生 SHALL 从 block 半边
  扩展到 allow 半边与优先级链——消费白名单、优先级链（含 --info 上级判定与指路文案）、
  分支 bespoke 拒收 SHALL 由声明表同一份按优先序的独占分支清单单一派生，移序前提
  SHALL 由结构保证而非注释。三个既有 scenario 原样保留，新增三个 scenario。
- `quality-gates`：新增「独占分支判定链声明完整性」需求——selftest SHALL 以断言守
  跨字段不变量（消费方 ⊆ 被吞域、分支名已声明、派生文案与冻结镜像一致），声明表
  漂移当场红。与既有「参数面 shadow 决策穷尽性」需求同构分工：它守 block 半边的
  表态义务，本需求守 allow 半边与优先级链的声明完整性。

## Impact

- **代码**（4 个文件 + 1 个测试文件 + 2 份文档）：
  - `scripts/cli/args/table.ts`：新增独占分支清单小表 + `EXCLUSIVE_PRIORITY_LABEL`
    改派生（对外导出名与值不变）；
  - `scripts/cli/commands/astrology.ts`：consumed / 上级梯 / bespoke 三处改派生，
    零新增分支逻辑；
  - `scripts/cli/selftest/args.ts`：新增声明完整性断言（项数以 selftest 首行自报为准，
    不写死）；
  - `test/report.test.ts`：既有 describe 内改派生跳过条件 + 补一个子串钉点 +
    `--report × --monthly` 格解禁，**无新增测试文件**，不触发 `test/README.md` 层表与
    `test/lib/run.ts` LAYERS 登记义务，内核层测试项数不动（AGENTS.md:311-312 越界
    报警器无感）；
  - `docs/code/cli-commands.md` / `docs/code/cli-args.md`：同步表述。
- **行为变化方向**：无。全部报错文案、退出行为、放行判定逐字节不变；唯一测试面变化是
  `--report × --monthly` 组合从「跳过」变「被通用断言覆盖」（实跑证实断言在该格成立）。
- **验证义务申报**（按 config.yaml 三档）：**纯重构档**（CLI 行为零变化），验收必含
  「与改动前基线逐字节 diff=0」——动手前先取探针矩阵基线（含 `--report --view daxian`、
  `--palaces --view daxian`、`--report --monthly 5` 等独占分支组合的 stdout/stderr 全文），
  落地后逐字节比对；另因重排了分发判定代码，从严加跑三件套：`npm run typecheck` +
  `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` + `npm test`，新增行跑
  `npm run lint`。预期全绿：排盘输出零变化，`npm test` 300 条对拍不受影响。

## 被否决的备选方案

1. **把消费关系挂在被消费参数侧**（给 yearly / monthly / view 各加 `consumedBy` 字段）
   ——判定链被拆散到三个参数条目里，优先级链仍需另一处表态，散抄从 5 处变 4 处不是
   收拢；且「消费语义的主语是分支不是参数」（`--topic` 决定它读什么，不是 yearly 决定
   谁读它）。本提案的分支条目方案吸收其全部信息量。
2. **`OptionSpec` 加第五格 `consumes`**——声明表身兼两职：「有哪些参数」（全集声明）与
   「分支消费关系」（分支级语义），违反常量单一角色（AGENTS.md:306 的 TOPIC_KEYS
   一名两用教训同构）；独立小表让删掉它时认知半径清晰（deletion test：删掉小表 =
   判定链散回 5 处，复杂度集中；删掉第五格 = 声明表结构变化却收不拢优先级链）。
3. **分支分发改生成代码**（按清单生成 if 链）——分支体是几十行的行为主体不是声明，
   生成化把「读代码」变「读生成器」，复杂度只是搬家不是集中；deletion test 不过。
   本提案只把「顺序前提」（bespoke 前置）收进检测入口结构，分发顺序保持手写且行为不变。
4. **最小补丁：只加闸门钉住移序**（report.test 钉 bespoke 全文 + selftest 钉调用顺序）
   ——注释要消灭的东西被断言替代后，5 处散抄与 4-6 处协同的账原封不动（d6827fc /
   da4a449 的摩擦照常复发），且「断言钉调用点顺序」是给结构缺陷上拐杖。本提案让移序
   在结构上不可能发生，断言只留一层（bespoke 子串钉点）防声明被删。
5. **给 `--report × --monthly` 跳过格补注释合理化**——实跑证实该格行为是通用
   「不会生效：--monthly」，通用断言完全可覆盖；跳过是无理由手抄，补注释是给漂移背书。
   正确方向是从清单派生跳过条件，让该格回到覆盖下。
