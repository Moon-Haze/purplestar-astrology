# quality-gates Specification

## Purpose

用互不替代的闸门守住改动质量，并保证「跑过了」与「没跑」永远可区分。
本仓守卫密度很高，因此一条新断言的价值取决于它守的东西是否**机器查不到**——
能被现有闸门覆盖的规则，不再新增守卫。

## Requirements

### Requirement: 三层验证互不替代

系统 SHALL 提供三层验证，任一层都不能替代其余两层：

| 闸门 | 命令 | 守什么 |
| --- | --- | --- |
| 类型自洽 | `npm run typecheck` | 类型**自洽**（不检查类型标得对不对） |
| 逻辑自洽 | `node scripts/purple-star.ts selftest` | 代码逻辑自洽（三段：排盘 / 古籍 / 合盘） |
| 外部基准 | `npm test` | 与基准样本逐字段对标 |

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

#### Scenario: 冒充原话

- **WHEN** 文案出现「倪师说 + 引号句」但核对表无此项
- **THEN** 守卫失败

#### Scenario: 声明根之外的引文

- **WHEN** `tools/` 或 `test/` 下的 `.ts` 文件出现核对表外的「倪师 / 倪海厦 + 引号句」形态
- **THEN** 仓库级扫描组失败——不因该目录不在任何流派的 `scanRoot` 内而静默放行

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
宫位内容键映射、主题关键宫位的每个宫名键 SHALL 能在该域内解析；十四主星名 SHALL 以
内核星表为单一真相源，星曜内容、星曜简述、主题断语手册的主星键集 SHALL 与之互证同集。

键域漂移（数据表键与运行时键不一致导致的静默 miss）属 typecheck 查不到的缺陷类，
SHALL 由 invariants 互证断言拦截；断言 SHALL 报出超域或不一致的键，消费点 SHALL NOT
以 `??` 空串兜底掩盖 miss。

#### Scenario: 宫名键超域

- **WHEN** analysis 数据表新增或改动一个宫名键，而它不在运行时宫名域内（如紧凑形「仆役」、漏「宫」字的「兄弟」）
- **THEN** invariants 互证断言失败，`npm test` 变红并报出该键；不得静默 miss 后以空串兜底

#### Scenario: 星名键集分叉

- **WHEN** 星曜内容表、星曜简述表或主题断语手册键集中出现内核星表没有的主星名，或缺其一
- **THEN** 互证断言失败，报出不一致的键集差异

#### Scenario: 运行时直查全命中

- **WHEN** 消费点以运行时 `Palace.name` 直查 analysis 数据表
- **THEN** 十二宫全部命中，无一落入「简述兜底」或空串分支

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
