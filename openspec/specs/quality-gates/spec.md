# quality-gates Specification

## Purpose

用互不替代的闸门守住改动质量，并保证「跑过了」与「没跑」永远可区分。
本仓守卫密度很高，因此一条新断言的价值取决于它守的东西是否**机器查不到**——
能被现有闸门覆盖的规则，不再新增守卫。

## Requirements

### Requirement: 三层验证互不替代

系统 SHALL 提供三层验证，任一层都不能替代其余两层：

| 闸门     | 命令                                   | 守什么                                   |
| -------- | -------------------------------------- | ---------------------------------------- |
| 类型自洽 | `npm run typecheck`                    | 类型**自洽**（不检查类型标得对不对）     |
| 逻辑自洽 | `node scripts/purple-star.ts selftest` | 代码逻辑自洽（三段：排盘 / 古籍 / 合盘） |
| 外部基准 | `npm test`                             | 与基准样本逐字段对标                     |

风格另有 `npm run lint` / `npm run format` 两条独立闸门。

#### Scenario: 只跑一层

- **WHEN** 改动排盘内核后只跑 `typecheck`
- **THEN** 不足以交付；内核或 iztro 变更后 `selftest` 与 `npm test` 都要跑

#### Scenario: 不用 any 绕过

- **WHEN** `typecheck` 报错
- **THEN** 修类型标注，不把类型改成 `any` 让它全绿

### Requirement: 基准回归的分层与登记

`npm test` SHALL 覆盖 7 层、14 个测试文件（排盘对标 / CLI 端到端 / 排盘结构不变量 /
内核契约 / 主题注册表 / 三合派约束 / 数据源纯函数 / 仓库自洽 / 引文守卫）。

新增 `test/*.test.ts` SHALL 同时登记两处：`test/README.md` 的层表，与 `test/lib/run.ts` 的
`LAYERS` 数组。`LAYERS` 的 `suites` SHALL 与测试内的 describe 名逐字对应。
未登记的文件会被显式报出，不静默少计。

#### Scenario: 新增测试文件

- **WHEN** 新增 `test/foo.test.ts`
- **THEN** 同时登记层表与 LAYERS，否则被报为未登记

#### Scenario: suites 名字不符

- **WHEN** LAYERS 的 `suites` 与实际 describe 名不一致
- **THEN** 断言失败，不静默跳过该套件

### Requirement: 冻结内核契约

`test/kernel-contract.test.ts` SHALL 冻结内核对外形状。改动内核导出即破坏契约，
须显式说明并同步该测试，**不得**顺手改断言迁就实现。

#### Scenario: 契约被破坏

- **WHEN** 内核导出形状变化
- **THEN** 契约测试失败，要求显式决策而非默默改断言

### Requirement: 计数类事实不写死

计数 SHALL 分两类，不得混用：

**集合基数**（可增删的集合的大小，如主题 key 数、命盘条目数）SHALL「能自报就自报、
能派生就派生」，**不得**在代码、错误信息、help 描述或文档里写死数字。面向用户的文案若要
给出基数，SHALL 从该集合本身派生；断言 SHALL 盯「自报数与实际集合一致」，**不得**钉死
字面量。

**契约固定数**（解读五节、`--report` 板块数、十二宫、十四主星等结构约定）MAY 写死，
但 SHALL 是显式登记的产品口径，且不得与集合基数混算。

其余计数（断言数、测试项数、分发条目数等）SHALL 同「能自报就自报、能派生的派生」，
不得在文档或代码里写死数字；其余由断言盯双向一致。

#### Scenario: 集合基数写死

- **WHEN** 文案要给出某集合的大小（如可选主题 key 的个数）
- **THEN** 该数字由集合本身派生，不写死；集合增减时文案随之变化，无需改文案

#### Scenario: 断言钉死字面量

- **WHEN** 断言校验面向用户的计数文案
- **THEN** 断言比对「文案自报的数」与「集合实际长度」，不比对写死的字面量

#### Scenario: 契约固定数

- **WHEN** 引用结构约定数（解读五节 / `--report` 板块数）
- **THEN** 该数是显式登记的产品口径，不与集合基数混算、不因集合增减而漂移

#### Scenario: 断言数变化

- **WHEN** 增删断言
- **THEN** 报告首行自报项数随之变化，文档中不残留旧数字

#### Scenario: 分发条目数

- **WHEN** 需要引用分发包条目数
- **THEN** 现读 zip 清单得出，不抄录文档中的数字

### Requirement: 跳过必须可见

跳过断言 SHALL 只走 `kit.skipUnlessRepo`，判据取「包根有没有 `AGENTS.md`」
（分发件只含四项，仓库级文档一律不带——`AGENTS.md` 与 README / test/ 同进退，
是「我在不在仓库里」的现存探针）。跳过 SHALL 记 pass 但 `skipped: true`，
报告渲染时**前置 `⏭`**。

**不得给不需要的断言加跳过**：若断言读的文件都在 `scripts/` 或 `references/` 内，
它会被打包带上，跳过只是白白丢覆盖。

**仓库态 SHALL 零跳过**：判据锚点必须是现存文件——锚点失效（探针指向已删除文件）
会使守卫在仓库态恒真降级，比没有守卫更坏；仓库级回归 SHALL 有断言钉住
「selftest 报告不出现 ⏭」，锚点再失效时当场变红。

#### Scenario: 恒真守卫

- **WHEN** 断言被跳过
- **THEN** 报告上看得见 `⏭`，不与「跑过了」不可区分

#### Scenario: 多余的跳过

- **WHEN** 给一条只读 `scripts/` 内文件的断言加跳过
- **THEN** 视为白白丢覆盖，应移除

#### Scenario: 仓库态零跳过

- **WHEN** 在仓库形态（非分发包）跑 selftest
- **THEN** 报告全文不出现 `⏭`；判据锚点被删或改名时，钉住此事实的断言变红，而非静默恒真

### Requirement: 回归链路禁缓存

回归链路（`cmdSelftest` 入口、`test/lib/run.ts` 的 spawn env）SHALL 恒设 `ZIWEI_NO_CACHE=1`，
否则会拿旧缓存产生**假绿**。缓存层自身的测试临时摘掉该变量。

#### Scenario: 缓存未失效

- **WHEN** 改了排盘内核但回归时命中旧缓存
- **THEN** 假绿；恒设 `ZIWEI_NO_CACHE=1` 排除此路径

### Requirement: 引文守卫

`test/citations.test.ts` SHALL 扫描**仓库 `.ts` 全树**（流派分派组之外另有仓库级组，
与 `.md` 侧的全仓扫描对称），比对 `corpus/data/annotations.ts` 的引文核对表，
拦截冒充倪师原话的文案。比对基准是权威语料，不是文案之间的相互一致性。
扫描面 SHALL 覆盖带引文代码的真实分布（含 `tools/` 与 `test/`），不因「属某流派声明的根」
而留盲区；`node_modules` / 点目录由收集器排除。

（断语手册库已随 remove-manual-oracle 下线：库抽取扫描组与建库期校验随之移除，
比对核心 `corpus/citation-core.ts` 保留供 `.ts` / `.md` 两侧扫描共用。）

#### Scenario: 冒充原话

- **WHEN** 文案出现「倪师说 + 引号句」但核对表无此项
- **THEN** 守卫失败

#### Scenario: 声明根之外的引文

- **WHEN** `tools/` 或 `test/` 下的 `.ts` 文件出现核对表外的「倪师 / 倪海厦 + 引号句」形态
- **THEN** 仓库级扫描组失败——不因该目录不在任何流派的 `scanRoot` 内而静默放行

#### Scenario: 库内断语行受守卫

- **WHEN** 断语手册库删除后运行引文守卫
- **THEN** 扫描组为 `.ts` 全树 + `.md` 全仓两组（库抽取组不存在），守卫覆盖面回退为
  纯文本面且不因库下线出现空转（`checked` 非空）

### Requirement: 基准差异须显式登记

基准样本是 iztro 2.5.8 拍的快照，当前依赖为 2.6.1，两者有且仅有已登记的已知差异
（太阳/太阴在酉宫的亮度）。已知差异 SHALL 以白名单形式显式登记在比较层。

#### Scenario: 出现未登记差异

- **WHEN** 排盘结果与基准不符且不在白名单内
- **THEN** 对标失败，须查明原因，不得加入白名单了事

### Requirement: 依赖版本锁定

`package-lock.json` SHALL 提交以锁定精确版本（iztro 2.6.1 / lunar-typescript 1.8.6），
避免排盘结果因环境分叉。升级 iztro 会改变排盘结果，属高风险变更。

#### Scenario: 升级 iztro

- **WHEN** 升级 iztro 版本
- **THEN** 递增排盘缓存的 `CACHE_VERSION`，并跑 `selftest` 与 `npm test` 再交付

### Requirement: 分析数据表键域互证

analysis 侧按宫名 / 主星键索引的数据表 SHALL 与运行时键域互证：宫名键以运行时宫名域
（展开形、带「宫」字、交友宫口径，即 `PALACE_NAMES_ORDER`）为唯一域——次星宫位文案表、
宫位内容键映射、主题关键宫位、魁钺贵人倾向表的每个宫名键 SHALL 能在该域内解析；
十四主星名 SHALL 以内核星表为单一真相源，星曜内容、星曜简述两表的主星键集 SHALL 与
之互证同集。

键域漂移（数据表键与运行时键不一致导致的静默 miss）属 typecheck 查不到的缺陷类，
SHALL 由 invariants 互证断言拦截；断言 SHALL 报出超域或不一致的键，消费点 SHALL NOT
以 `??` 空串兜底掩盖 miss。语义上覆盖全十二宫的表（魁钺贵人倾向表）SHALL 另有完备性
断言钉住键数——缺宫或超域即红，不得依赖消费点可选链静默缩水。

#### Scenario: 宫名键超域

- **WHEN** analysis 数据表（含魁钺贵人倾向表）新增或改动一个宫名键，而它不在运行时
  宫名域内（如紧凑形「仆役」、漏「宫」字的「兄弟」）
- **THEN** invariants 互证断言失败，`npm test` 变红并报出该键；不得静默 miss 后以
  空串兜底

#### Scenario: 星名键集分叉

- **WHEN** 星曜内容表或星曜简述表键集中出现内核星表没有的主星名，或缺其一
- **THEN** 互证断言失败，报出不一致的键集差异

#### Scenario: 全域表缺宫

- **WHEN** 魁钺贵人倾向表的键数少于十二宫，或任一键不在运行时宫名域内
- **THEN** 完备性断言失败，报出缺失或超域的键；「天魁 / 天钺在哪宫 → 断语」直查链
  不因缺键静默缩水

#### Scenario: 运行时直查全命中

- **WHEN** 消费点以运行时 `Palace.name` 直查 analysis 数据表
- **THEN** 十二宫全部命中，无一落入「简述兜底」或空串分支

### Requirement: 生成物漂移探针

`docs/manual/`（`combo-frequency.md` / `geju-audit.md`——主星 × 辅煞同宫频率表与格局
名目对拍，格局完备性基线）是生成物（由 `tools/db/export-manual.ts` 从 `db/dataset` 与
内核表导出），其与当前内核表 / 导出工具的一致性 SHALL 由漂移探针守住，不得只依赖人工
重导：`export-manual --check` SHALL 在内存中重导并与已提交产物逐字对拍，存在差异时以
非零退出并报出漂移产物清单与差异样例。探针 SHALL 挂载为独立命令（`npm run manual:check`）
并纳入 review 闸门面，SHALL NOT 进入 `npm test` 日常回归（重导对拍耗时，日常回归时长
不受其拖累）。本机缺 `db/dataset` 或 DuckDB 依赖时 SHALL 显式跳过并标注原因
（跳过必须可见），不得静默绿。

review 闸门的生成物清单（GENERATED）SHALL 由各生成器**自报**的托管面派生：
`export-manual` / `tools/notes/export-notes.ts` / `tools/corpus/import-tianji.ts` 各
export 自己托管的路径；无本地生成器的生成物（如 `data/wenmo-tables.ts`，提取脚本在
上游仓）以带理由的登记常量入册。清单 SHALL NOT 手抄第二份；手写文件（如
`docs/manual/README.md`）SHALL NOT 被当成生成物拦截。

#### Scenario: 内核表改了、生成物未重导

- **WHEN** 内核数据表或导出工具改动后，`docs/manual/` 生成物未重导
- **THEN** `npm run manual:check` 非零退出，报出漂移产物清单与差异样例

#### Scenario: 环境缺失时可见跳过

- **WHEN** 本机无 `db/dataset` 或 DuckDB 依赖不可用
- **THEN** 探针输出显式的跳过标注与原因，不以全绿掩盖未检查

#### Scenario: 不进日常回归

- **WHEN** 运行 `npm test`
- **THEN** 不触发重导对拍（探针只在独立命令与 review 面执行），日常回归时长不受影响

#### Scenario: 生成物与内核一致

- **WHEN** 生成物刚按当前内核表与导出工具重导提交
- **THEN** `npm run manual:check` 零退出，输出一行确认（无差异）

#### Scenario: 库漂移以哈希报出

- **WHEN** 盘上残留 `scripts/corpus/data/manual/oracle.db` 或 `docs/manual/topics/`
  （下线产物未清理）
- **THEN** 探针报盘上孤儿（重导不再生成，应删除），非零退出

#### Scenario: 手写文件不再被误伤

- **WHEN** 手改 `docs/manual/README.md`（自述文件，非生成物）
- **THEN** review 闸门不再按「改了已入库的生成文件」拦截

#### Scenario: 新增托管面即入册

- **WHEN** 某生成器新增托管路径或托管分区
- **THEN** 其自报清单随之演化，review 闸门自动覆盖——「生成器加了托管面、闸门不知道」
  的 miss 类从结构上消失

### Requirement: OpenSpec 校验零警告

specs 主干（`openspec/specs/`）或 change 工件（`openspec/changes/`）发生任何改动后，
`openspec validate --all` SHALL 全部通过且**零警告**才算完成。出现警告时（如
requirement 文本超长）SHALL 当场修复——拆分 requirement、把例子与边界情况移进
scenario——不得以「仅警告不失败」为由带警告归档或提交。

#### Scenario: specs 主干改动后校验

- **WHEN** `openspec/specs/` 下任一 spec 文件被修改
- **THEN** `openspec validate --all` 退出码为 0 且输出不含 `WARNING`，否则该改动未完成

#### Scenario: 警告须当场修复

- **WHEN** validate 报出警告（如 requirement 文本超过 500 字符）
- **THEN** 按警告建议修复（拆分 requirement / 移内容进 scenario）直至零警告，不得放行

#### Scenario: 归档折回后复验

- **WHEN** change 归档将 delta 折回主干 specs
- **THEN** 折回后重跑 `openspec validate --all` 确认仍零警告

### Requirement: 参数面 shadow 决策穷尽性

声明表 output-select 组中 `cmds` 含 `astrology` 的每个参数 SHALL 显式声明
`shadow: true` 或 `noShadow: true` 之一（「在不在被吞检测域」是必须表态的封闭决策），
selftest SHALL 以断言守**增长方向**：任一该域参数未表态时断言变红并点名参数名，
不依赖人工对拍或快照推进。`topic-deep` 组不设此义务——其默认方向是入域，漏标的
表现是过度检测（当场红），不是静默吞。

#### Scenario: 域内参数未表态当场红

- **WHEN** output-select 组任一 `cmds` 含 `astrology` 的参数（新增参数、或存量参数的
  shadow / noShadow 标志被删除）处于未表态状态
- **THEN** selftest 的穷尽性断言非绿，报告点名该参数——快照对拍与行为钉点保持原状，
  不得成为该缺口的唯一发现途径

#### Scenario: 存量表态齐且 noShadow 对派生中性

- **WHEN** 本变更落地后对声明表跑穷尽性断言与 SHADOWABLE_KEYS 派生
- **THEN** view 标 `shadow`、json / no-cache / config / template 标 `noShadow`，
  五个决策全部显式在册、断言绿；检测域恰为原 12 项加 view（13 项），
  四个 `noShadow` 参数不在检测域内（output-select 组派生只读 `shadow` 标志）

#### Scenario: 表态的后果端到端可见

- **WHEN** `--view` 以 `shadow: true` 表态并由 `--topic` 消费白名单放行
- **THEN** `--info` / `--palaces` / `--report` 与 `--view` 同给时非零退出并点名
  （不再静默吞），`--topic love --view daxian` 正常产出主题论断——与
  「独占分支不静默吞功能参数」需求对运限层级参数的要求同构

### Requirement: 注释指针有效性守卫

`scripts/` `test/` `tools/` 下 `.ts` 源码**注释**中出现的 `.md` 引用词元（根级文件名如
`AGENTS.md` / `SKILL.md`，及 `docs/…` / `references/…` 相对路径）SHALL 指向仓库内实际
存在的文件。注释与字符串字面量中出现的 `npm run <name>` SHALL 指向 `package.json`
scripts 里真实存在的命令；字符串字面量中 `references/…​.md` 形态的路径 SHALL 指向仓库
内实际存在的文件；注释中出现的裸 `*.test.ts` 文件名 SHALL 指向 `test/` 下实际存在的
文件。守卫 SHALL 以文本扫描实现、纳入 `npm test` 的 repo 层；命中不存在的指针 SHALL
报出文件与行。守卫只查指针对象**存在性**，SHALL NOT 审查内容的技术正确性。确属误报
的引用 SHALL 在守卫内显式登记白名单并带理由（跳过必须看得见），SHALL NOT 静默豁免。

#### Scenario: 注入断锚即红灯

- **WHEN** 任一被扫描文件的注释出现指向不存在 `.md` 的引用（如临时写入
  「见 docs/code/not-exist.md」）
- **THEN** `ZIWEI_NO_CACHE=1 npm test` repo 层失败，报出文件与行；还原后恢复全绿

#### Scenario: npm run 断针红灯

- **WHEN** 注释或用户可见字符串写入 `npm run <不存在>`（如历史 `build:db` 腐烂）
- **THEN** repo 层失败，报出文件、行与缺失的 script 名；补别名或改指向后恢复全绿

#### Scenario: 字符串路径断针红灯

- **WHEN** 字符串字面量（如运行时提示「已移至 references/x.md」）指向不存在的文件
- **THEN** repo 层失败——指针写在哪种语法里不再决定受不受保护

#### Scenario: 断言覆盖者断针红灯

- **WHEN** 注释承诺某覆盖由某 `xxx.test.ts` 承担而该文件不存在
- **THEN** repo 层失败，报出断针位置

#### Scenario: 存量清零

- **WHEN** 守卫落地并在存量批改完成后运行
- **THEN** 扫描零命中（或命中项全部在带理由的白名单内），npm test 全绿

#### Scenario: 改名防复发

- **WHEN** 未来再次发生仓库级改名（如根级 `.md` 或 docs/ 子目录更名）
- **THEN** 遗留断锚使 npm test repo 层变红，不等人工比对发现

### Requirement: 独占分支判定链声明完整性

声明表的独占分支清单（按优先序排列的分支条目，含放行集合与分支 bespoke 拒收表态）
SHALL 满足跨字段不变量，并由 selftest 断言守卫：每个条目放行集合的成员 SHALL 是
声明表中标 `shadow` 的参数名（放行只是把参数从吞掉名单里豁免，豁免一个域外参数是
无意义的声明）；条目分支名 SHALL 是声明表已声明的参数名；由清单派生的优先级指路
文案 SHALL 与 selftest 冻结镜像一致。任一不变量被破坏时断言当场红并点名，不依赖
人工对拍。与「参数面 shadow 决策穷尽性」需求分工：彼守 block 半边的表态义务，
此守 allow 半边与优先级链的声明完整性。

#### Scenario: 放行集合越域当场红

- **WHEN** 清单任一条目的放行集合加入未标 `shadow` 的参数名，或被放行参数的
  `shadow` 标志被移除
- **THEN** selftest 的声明完整性断言非绿并点名该参数——「放行 ⊆ 被吞域」不被
  快照或行为测试的沉默掩盖（断言形态；本变更落地时 yearly / monthly / view 三项
  均标 `shadow`，不变量成立为绿）

#### Scenario: 分支名漂移当场红

- **WHEN** 清单条目的分支名不再是声明表已声明的参数名（参数退役或改名而清单未同步）
- **THEN** selftest 断言非绿并点名该条目（断言形态）

#### Scenario: 优先级文案与清单序一致

- **WHEN** 清单顺序被调整，或文案改回手写字符串而与清单脱钩
- **THEN** 派生文案与 selftest 冻结镜像比对失败、断言当场红（反向注入）——清单
  顺序与对外指路文案之间不存在第三份手写编码

### Requirement: 独占分支组合矩阵封闭派生

report.test 的独占分支 × 功能参数组合矩阵 SHALL 由声明表单一派生并构成封闭枚举：
分支轴 SHALL 遍历独占分支清单（`EXCLUSIVE_BRANCHES`）、被吞旗标轴 SHALL 遍历
`SHADOWABLE_KEYS` 域、allow 方向 SHALL 遍历条目放行集合，测试面 SHALL NOT 留有
这三者的任何手抄副本。探针 argv 夹具映射 SHALL 覆盖派生轴全集，缺席条目 SHALL
当场红并点名。跳过条件 SHALL 全部由声明表派生（自指 / 放行 / bespoke 三类）且
各有指名的分管断言。覆盖格数 SHALL 自报、SHALL NOT 写死。与「独占分支判定链
声明完整性」需求分工：彼守声明表内部一致性，此守测试面对声明表的跟随——新增 /
退役分支或旗标、调整放行，测试面 SHALL 零协同。

#### Scenario: 新增独占分支自动入矩阵

- **WHEN** 声明表新增第 5 条独占分支而探针映射尚未登记其取值
- **THEN** 测试断言当场红并点名该分支（缺名守卫）——登记探针取值后，该分支与
  全部被吞旗标的组合格自动进入封闭枚举并走通用断言，测试面无需第二处协同改动

#### Scenario: 扩被吞旗标自动入矩阵

- **WHEN** `SHADOWABLE_KEYS` 域新增旗标（同 2026-11-11 view 入域的扩展类型）
- **THEN** 矩阵自动获得该旗标与全部分支的组合格并走通用「不会生效」断言，
  无手工补格步骤；若新格断言不成立，属新发现的次序缺陷，按失败可见性处理为
  修复项而非静默跳过格

#### Scenario: allow 方向跟清单走

- **WHEN** 清单任一条目的放行集合增删成员，或新增 `consumes` 非空的新分支
- **THEN** allow 断言循环自动跟随派生结果，消费白名单在测试面不存在第二份
  手抄副本（放行成员的探针值由旗标值映射覆盖，缺登记当场红）

#### Scenario: 覆盖面封闭且自报

- **WHEN** 矩阵测试运行
- **THEN** 其覆盖格数由派生轴计算并自报（本变更落地时为 45 格通用断言 + 3 格
  allow 断言，格数随声明表增删自动变化、不写死）；矩阵内不存在清单外理由的
  手写跳过格——自指格（旗标即分支自身）归 parse 层参数判重语义分管、放行格归
  allow 断言分管、bespoke 格（旗标 ∈ 条目 bespoke 拒收集合）归 bespoke 子串
  钉点分管

### Requirement: 样例表参数覆盖随回归守卫

cli-samples 的样例表（SAMPLES）对参数面（`OPTION_GROUPS`）的覆盖 SHALL 由 `npm test`
的派生断言守住（样例覆盖的参数 ⊇ 声明表全部参数），SHALL NOT 只依赖生成文档时的低频
自检——`main()` 内的覆盖检查 SHALL 保留（双保险同源）。样例表的演示出生串 SHALL 消费
`scripts/cli/selftest/sample.ts` 的单点常量（组件值或 argv 形态派生），SHALL NOT 手抄
同款串（确属其他样例组的生辰除外，须可数）。

#### Scenario: 新增参数忘补样例

- **WHEN** `OPTION_GROUPS` 新增参数而 SAMPLES 未补样例
- **THEN** `npm test` 当场失败，报出缺样例的参数清单；补样例后恢复全绿

#### Scenario: 换样例组只动一处

- **WHEN** 演示出生信息更换（如换生辰）
- **THEN** `sample.ts` 单点一处修改，SAMPLES 经引用自动跟上；漏改的散落字面量由
  存在性对拍暴露
