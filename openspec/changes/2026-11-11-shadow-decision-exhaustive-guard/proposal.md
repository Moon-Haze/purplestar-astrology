# Proposal

## Why

被吞检测域 `SHADOWABLE_KEYS` 的成员资格在两个 role 里**默认方向相反**：`topic-deep`
组默认入域、`noShadow: true` 才退出（`scripts/cli/args/table.ts:429-431`，现仅 palaces
用）；`output-select` 组默认域外、`shadow: true` 才加入（`table.ts:432-434`）。因此落在
output-select 组的 astrology 参数**漏标 shadow = 结构性静默落域外**。这个失败形态已发生
两次：daily/hourly 是第一次（2026-11-09 `exclusive-branch-shadowable-gap` 修复，其
proposal Why 节自述缺口由人工实跑发现、当时全 test/ 树零钉点）；`--view` 是第二次（本会话
2026-11-11 实跑：`--info --view daxian` 与 `--palaces --view daxian` 均 exit=0、输出零点名
——view 被静默吞，探针记录见 design.md）。

现行两道守卫都只守**收缩方向**、对**增长方向**（新增/漏标参数）结构性沉默：

1. **selftest 快照 S 是手抄冻结镜像**（`scripts/cli/selftest/args.ts:173-177`）：新参数
   不标 shadow，则派生集合与快照串都不含它、对拍恒绿；只守「误删已有标志」（且该基线
   已随 2026-11-09 手工推进过一次，注释自认「有理由的基线推进」）。
2. **行为钉点是封闭枚举** `{monthly, daily, hourly}`（`test/report.test.ts:229-244`）：
   下一个漏标参数不在清单内。
3. 命令侧 `assertNoShadowedFeatures` 只遍历派生域（`scripts/cli/commands/astrology.ts:226-231`）
   ——域外参数它看不见，报错文案不可能点名。

增长方向沉默有活体证据：本会话实跑 `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts
selftest` 164/164 全绿，而 output-select 组 cmds 含 astrology 的参数中恰有
**json / no-cache / view / config / template 五个未表态**（对照 `table.ts:246-375` 逐项
核实）——五个「在不在被吞域」的决策在现行守卫下零红灯。这与失败可见性约束
（AGENTS.md:251-252「不得静默忽略无效输入」）的死敌「沉默」同构：下一个 output-select
新参数漏标时，没有任何红灯会亮。

## What Changes

- **穷尽性断言（核心，约 10 行）**：`scripts/cli/selftest/args.ts` 的
  `runDeclarationTable`（注册于 `scripts/cli/selftest/index.ts:120`）新增一条断言——
  role 为 `output-select` 且 `cmds` 含 `"astrology"` 的每个参数必须显式声明
  `shadow: true` 或 `noShadow: true` **之一**，未标当场红并点名参数。「隐式默认域外」
  的开放枚举收敛为封闭声明义务，决策单点回 `table.ts`（「有哪些参数」的唯一来源，与
  2026-10-13 归属投影去手抄表同一方向）。
- **存量补标（table.ts，5 行标志）**：`view` → `shadow: true`（它是真静默吞，见 Why）；
  `json` / `no-cache` / `config` / `template` → `noShadow: true`（把「有意不在被吞域」
  从沉默写成声明；`noShadow` 在 output-select 组派生中性——该组只读 `shadow === true`，
  `table.ts:432-434` 不看 noShadow，零行为效果，纯为穷尽性断言的显式表态）。
- **view 入域的连带行为面（消化第二次静默吞）**：
  - `--topic` 消费白名单 `["yearly","monthly"]` → `["yearly","monthly","view"]`
    （`astrology.ts:225`；topic 分支在 `astrology.ts:456-464` 读 view 决定展示口径，
    合法用法 `--topic love --view daxian` 本会话实跑确认正常，不得误伤）；
  - `--report` 分支的 bespoke view 检查（`astrology.ts:488-492`）**移到**
    `assertNoShadowedFeatures`（:487）**之前**：view 入域后统一独占检测会先抛通用文案，
    使 bespoke 变死代码；移序保住「运限视角见 `--topic <key> --view …`」的指路价值
    （`test/report.test.ts:206-212` 只断言报错含 `--report` 与 `--view` 子串、未钉全文，
    移序不破测试）。
- **快照与钉点显式同步**：selftest 快照 S 12→13 项（加 view，注释写明基线推进理由）；
  `test/report.test.ts` 独占分支 describe 的枚举扩 view 格（`--info` / `--palaces` /
  `--report` × `--view` 必点名 + `--topic` × `--view` 必放行）。
- **文档同步**：`table.ts` 的 `OptionSpec.noShadow` jsdoc（语义从「专题深入组的 palaces」
  扩为「显式声明不在被吞检测域」，两个 role 均可用）与 `docs/code/cli-args.md` 相应行。
- **不做什么**：
  - 不动排盘内核（`algorithm.ts` / `mutagen.ts` / `patterns/` / `data/` /
    `wenmo-brightness.ts`）与知识内容，不递增 `CACHE_VERSION`；
  - 不改派生规则本身——output-select 组仍只认 `shadow === true`，本变更只加「必须二选一
    表态」的义务，不改「表态后如何派生」；
  - 不给 `--out`（global、无 cmds）与 `search` / `limit` / `source` / `book`（knowledge
    专属）加义务——它们不在断言域；
  - 不删 json 的逐分支 bespoke 报错（`--info × --json` 等本会话实跑确认在报错，
    json 标 noShadow 后全数保留——它的互斥是分支特定组合规则，bespoke 信息量高于通用点名）；
  - 不动 `--template` 的早退出口顺序（`--info --template` 打印模板吞掉 info 属
    config-input 层出口顺序问题，方向是「template 吞别人」而非「template 被吞」，
    不在本提案域）；
  - 不触碰 2026-11-09 未归档变更的 delta 文件（并行变更互不干扰）。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `quality-gates`：新增「参数面 shadow 决策穷尽性」需求——output-select 组 astrology
  参数的 shadow/noShadow 决策 SHALL 显式声明并由 selftest 断言守增长方向，未表态
  当场红。view 的端到端行为面（独占分支点名 `--view`）不另立需求：2026-11-09 未归档
  delta 的「独占分支不静默吞功能参数」已是通用措辞（检测域由 shadow 标志单一派生），
  view 入域后自动受其管辖，重复立规反而制造归档时的 requirement 重叠。

## Impact

- **代码**（4 个文件）：
  - `scripts/cli/args/table.ts`：5 行标志 + jsdoc 措辞（无类型改动）；
  - `scripts/cli/selftest/args.ts`：穷尽性断言 + 快照 S 串 12→13 项；
  - `scripts/cli/commands/astrology.ts`：consumed 白名单加一项 + bespoke 检查块移序
    （零新增逻辑）；
  - `test/report.test.ts`：既有 describe 内扩枚举，**无新增测试文件**，不触发
    `test/README.md` 层表与 `test/lib/run.ts` LAYERS 登记义务，内核层测试项数不动
    （AGENTS.md:311-312 越界报警器无感）。
- **行为变化方向**：`--info × --view`、`--palaces × --view` 从静默吞变「非零退出 +
  点名 + 指路」（失败可见性要求的方向）；`--topic × --view` 照常放行；`--report ×
  --view` 报错文案不变（bespoke 先行）。noShadow 四参数派生中性、行为零变化。
- **selftest 项数**：加一条断言，项数 164→165（以 selftest 首行自报为准，不写死）。
- **验证义务申报**（按 config.yaml 三档）：非内容扩展、非纯重构（有 CLI 行为变化），
  **从严按「内核或依赖改动」档跑三件套**：`npm run typecheck` +
  `ZIWEI_NO_CACHE=1 node scripts/purple-star.ts selftest` + `npm test`，另对新增行跑
  `npm run lint`。预期全绿：排盘输出零变化，`npm test` 300 条对拍不受影响。

## 被否决的备选方案

1. **治标补丁：给 `--info` / `--palaces` 各加 view 的 bespoke 检查（约 4 行）**——
   只修 view 这一个参数，第三个漏标参数还会来；且把 view 的消费语义散进命令侧。
   本提案的 view 修复吸收其全部行为面，红灯机制另立。
2. **output-select 组全量入集合（不看 shadow 标志）**——2026-11-09 已否决（其方案 3），
   理由沿用：json / no-cache / config / template 语义各异（早退出口、过程开关、参数
   来源、逐分支互斥规则），全量入域被迫为四参数各扩白名单或 bespoke，把耦合从声明表
   挪进命令侧。显式二选一正是其末句「逐参数声明消费语义的精确机制」的落实。
3. **topic-deep 组也要求显式声明**——两个 role 的默认方向不对称是**有理由的设计**：
   topic-deep 默认入域，漏标的表现是过度检测（误报、当场红），不是静默吞；失败可见性
   只惩罚静默方向。给安全方向也加义务是无收益的负担。
4. **穷尽性断言放 test/ 树（新 test 文件）**——触发新增测试文件登记闸门（层表 +
   LAYERS 双登记）且使「内核层测试项数」报警器多一个噪声源；断言消费的是 table.ts
   纯数据，与快照断言同住 `runDeclarationTable`（selftest 的声明表断言组）分工最贴。
5. **view 标 noShadow + 保留静默，另案处理**——即变相维持现状：静默吞是已确认的
   失败可见性违例（本会话实跑证据），标 noShadow 等于把 bug 写成声明。
