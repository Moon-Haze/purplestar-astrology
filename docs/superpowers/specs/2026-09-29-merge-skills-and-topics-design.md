# 设计：三 skill 合一 + astrology 命令融合（参数英文化）+ 配置文件输入

- 日期：2026-09-29
- 状态：待评审
- 前置：2026-09-28 的「analyze 专题参数族」已交付（d4c1194 / dfd37d8）

## 0. 背景与目标

用户对 2026-09-28 交付的专题参数族不完全满意，并决定放弃「三 skill 集合」形态：

1. `--info` 的内容应默认可见，不该每次加参数；
2. `--focus` 不够详细；
3. 命令入口收敛：四条直接调 iztro 的命令融合为一条 `astrology`（参数融合，专题参数换英文）；
4. 十二宫详表入口收敛为 `astrology --palaces`（原 `chart` 命令废）；
5. **三个 skill 合并成一个**：仓库根即 skill 根，一条 CLI 承载排盘 / 古籍 / 合盘；
6. 参数支持**JSON 配置文件**输入，并能生成配置模板。

## 1. `astrology` 命令：四条排盘命令融合 + 参数英文化

analyze / insight / chart / topic 四条直接调 iztro 的命令（含规划中的 insight）融合为一条
**`astrology`**（参数融合模式，用户指定）：不带功能参数 = 概览；功能由参数组合表达。
专题参数名**全部换英文**（用户指定），大限 / 小限 / 四化锚定 iztro 原生术语：

| 功能                            | 旧参数 / 命令                   | 新参数                                                                             |
| ------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| 基本信息（并入默认 + 只出面板） | `--info`                        | `--info`（不变）                                                                   |
| 格局专题                        | `--geju`                        | `--pattern`                                                                        |
| 四化专题                        | `--sihua`                       | `--mutagen`（iztro 术语）                                                          |
| 流年专题                        | `--liunian [年]`                | `--yearly [年]`（对齐 iztro `horoscope.yearly`；与 `--year` 的混淆由拼错建议兜底） |
| 流月（配四化 / 流年视角）       | `--liuyue 1-12`                 | `--monthly 1-12`                                                                   |
| 大限专题                        | `--daxian [虚岁]`               | `--decadal [虚岁]`（iztro 术语）                                                   |
| 小限专题                        | `--xiaoxian [虚岁]`             | `--ages [虚岁]`（iztro 术语）                                                      |
| 宫盘聚焦                        | `--focus <宫>`                  | `--focus`（不变）                                                                  |
| 十二宫逐宫详表                  | `chart` 命令                    | `--palaces`                                                                        |
| 主题论断 + 视角                 | `topic` 命令 `--topic`/`--view` | `--topic <key>` / `--view`（不变）                                                 |
| 结构化输出                      | `--json`                        | `--json`（不变）                                                                   |

- **默认输出**（无功能参数）：`【命盘总览】`三行 → `【基本信息】`12 行面板（无条件）→ 口径提示 → `【运限速览】` → 功能参数指路。
- **`--info`**：只输出信息面板这一节。
- **`--focus` 深化**（四项全加）：三方四正逐宫全星曜（主星含亮度四化 + 吉煞杂曜）、对宫完整详表、涉及此宫的格局全列、小限岁数段 + 大限十年内引动年份 + 命主/身主星标记。
- 其余功能参数行为同 2026-09-28 交付的各专题（渲染函数复用 `cli/yun.ts`，仅改名）。
- `--topic` 给了 `--view` 才有意义；不带 `--topic` 时列 13 主题清单（原 topic 命令行为）。
- 出生信息 15 个参数不变（已英文）。

### 1.1 拼音别名（英文主名 + 中文拼音双识别）

英文为主名（help / SKILL.md / 文档一律用主名）；**拼音别名同时被识别**（解析层归一到主名）：
`geju→pattern`、`sihua→mutagen`、`liunian→yearly`、`liuyue→monthly`、`daxian→decadal`、`xiaoxian→ages`。

- 实现单点：`OPTION_ALIASES` 表（args.ts），`checkOptionName` 与归一层各查一次；cac 只注册主名，help 在参数描述尾注「别名：--geju」。
- 与「宁可报错不静默」不冲突：别名是**显式声明**的映射，不是拼错容错——`--patern` 仍然报错，`suggestOption` 建议主名 `--pattern`。

### 1.2 出生信息输入简化（删三连 + 位置参数快捷形态）

- **删 `--year` / `--month` / `--day` 三连**：`--date 1990-5-15` 已完全覆盖（格式宽松，月日不补零），
  日期从此二选一（`--date` / `--lunar`）。`buildBirthInfo` 的三连回退链删除。
- **位置参数快捷形态**（零参数）：`astrology 1990-5-15 9:30 男 北京`——按**形态归类**、顺序无关：
  日期 `\d{4}-\d{1,2}-\d{1,2}` → 公历日期；时刻 `\d{1,2}:\d{2}` → 钟表时间；性别
  `男|女|male|female|m|f`；剩余中文 token → 城市名（`findLongitude` 查，查不到**报错不静默**）。
  - 农历生日只能走 `--lunar`（与公历同形，无法按形态区分）。
  - **城市 token 三条边界**（实测锚定）：省+市**连写**（`山东青岛` / `内蒙古鄂尔多斯`，
    含「省」「自治区」全称简称）由 `findLongitude` 容错剥前缀原生解析；**裸省名**
    （`山东` / `内蒙古`）自动按省会计（复用 `--province` 同一实现，输出注明「按省会计」）；
    **带空格**（`山东 青岛` 两个 token）视为同类重复，报错并提示「省+市请连写，或用
    `--city` / `--province`」。
  - **参数优先**：位置参数只填空，参数已给的项不被覆盖；同类 token 出现两个（两个日期）报错。
  - `classics` / `stars` 的位置参数仍是检索词（各自命令自行解析）；`astrology` 的位置参数语义
    独立，互不干扰。
  - 实现住 `cli/birth-info.ts`（归类 + 与参数合并），不加新文件。
- 附带红利：`--year` 删除后，误敲 `--year` 会被「拼错建议」引向 `--yearly`（编辑距离 2），
  原「`--liunian` 勿写成 `--year`」的警告文案随之退役。

### 1.3 术语重命名：「旗标」→「参数」（全文与代码）

中文术语统一为「参数」；代码标识符 `FLAG_*` / `Flag*` 随之改 `OPTION_*` / `Option*`
（CLI 标准英文 option，与解析引擎 cac 的 `parsed.options` 同名）。现有代码的标识符与
注释在实施笔统一改，映射：`FLAG_GROUPS→OPTION_GROUPS`、`FlagSpec/FlagGroup→OptionSpec/
OptionGroup`、`FLAG_SCOPE/flag-scope.ts→OPTION_SCOPE/option-scope.ts`、`FLAG_ALIASES→
OPTION_ALIASES`、`FLAG_NAMES→OPTION_NAMES`、`checkFlagName→checkOptionName`、`suggestFlag→suggestOption`。
`SIDE_PREFIXES` / `prefixedCommands`（出生方前缀概念）保留原名。

## 2. 仓库重组：整个仓库 = 一个 skill

### 2.1 形态

- **仓库根 = skill 根**：根 `SKILL.md` + 根 `scripts/` + 根 `references/` + 根 `package.json`。
- `skills/` 目录整体废弃删除；两个派生 skill 的 `package.json` 一并废弃（根级已有，它们零 npm 依赖）。
- 装进 `~/.claude/skills/` 时拷整个仓库。

### 2.2 目标目录树（根 `scripts/`）

```text
scripts/
├── purple-star.ts            引导层（不变：钩子 + 自检 + 分发）
├── boot-hooks.ts             引导机制（不变）
├── classics/                 古籍内核：data/（三部古籍）+ 检索逻辑（import 风格改为源钩子风格）
├── synastry/                 合盘内核：synastry-knowledge.ts + chart-view.ts + 合盘逻辑
├── ziwei/                    排盘内核（原样平移）
└── cli/
    ├── args.ts               参数面（OPTION_GROUPS + 解析）
    ├── option-scope.ts         参数作用域（前缀机制保留空表——--charts 单参数后 a-/b- 前缀不再需要）
    ├── config.ts             新增：--config / --template 的读取与合并
    ├── birth-info.ts / birth-info-defs.ts / render.ts / yun.ts
    ├── astrology.ts           cmdAstrology（排盘分析一条命令：概览默认 + 功能参数分发）
    ├── classics.ts / synastry.ts / stars.ts   各命令拆分文件
    ├── help.ts                总览 help 与每命令 --help（命令 → 参数归属表 + COMMAND_HELP）
    ├── commands.ts           只留 COMMAND_TABLE + COMMAND_DESC（注册薄层）
    └── selftest.ts           汇总执行；排盘 / 古籍 / 合盘断言分段报告
```

**cli/ 按命令一文件**：原本挤在 commands.ts 的各 `cmdXxx` 拆到各自文件，commands.ts 只做注册。

### 2.3 synastry 命令

- **输入改单参数**：`synastry --charts /tmp/a.json,/tmp/b.json`（逗号分隔恰好两份，**甲先乙后**；
  吃 `astrology --json` 产物）。`--a-chart` / `--b-chart` 删除——合并本就是 breaking 版本，不保留旧名。
  校验：不是恰好两份、文件不可读、JSON 不符消费契约即报错；两路径相同**允许**（自盘对照有意义）。
- **连锁简化**：`a-` / `b-` 前缀体系整个不需要——`option-scope.ts` 的 `sidePrefixes` /
  `prefixedCommands` 维持空表（原「正式启用」作废），前缀分支与 `LEGAL_KEYS` 的前缀展开
  继续不可达；原合盘 selftest 的「`selftest --a-chart` 必须报错」断言改为「`--a-chart`
  是未知参数」。
- `synastry-guide.md` 从合盘 skill 的 references/ 搬到根 `references/`。

### 2.4 classics 命令

- `--search`（已有）/ `--limit` 进源作用域。
- data/ 三部古籍与检索逻辑整体平移进 `scripts/classics/`。

### 2.5 selftest 合并

- classics / synastry 的自检断言分别住 `scripts/classics/`、`scripts/synastry/`（导出断言数组），`cli/selftest.ts` 汇总执行，报告分三段（排盘 / 古籍 / 合盘），首行「通过 N/N」合计。
- 原「两份自有内核的断言只能在各自 skill 里跑」的作用域描述作废——现在只有一个 skill。

### 2.6 import 风格统一

搬入的 classics / synastry 代码从「全扩展名 import（无钩子）」改为源的风格（`@/` 别名 + 省扩展名）。仓库回到**一种**加载方式；「另两个 skill 怎么加载 .ts」一节与相关散文删除。

### 2.7 拼音文件名英文化（随迁移一并 `git mv`）

译名按文件实际语义定（非音译）；格局分组按成格难度分级、views 小节与参数名对齐：

| 拼音文件                        | 语义                          | 新名                                                       |
| ------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| `ziwei/sihua.ts`                | 四化                          | `mutagen.ts`（与 iztro `Star.mutagen` / `--mutagen` 一致） |
| `cli/yun.ts`                    | 运限专题                      | `fortune.ts`                                               |
| `patterns/ji-chu-ge.ts`         | 基础格局（常见轻量判定）      | `basic.ts`                                                 |
| `patterns/shang-ge.ts`          | 上格（条件最严）              | `superior.ts`                                              |
| `patterns/zhong-ge.ts`          | 中格（古书明列、条件稍宽）    | `medium.ts`                                                |
| `patterns/shou-lian-ge.ts`      | 收敛组（自 db-analysis 归入） | `converged.ts`                                             |
| `patterns/zhu-li-ge.ts`         | 助力格（吉星夹拱锦上添花）    | `enhancing.ts`                                             |
| `patterns/e-ge.ts`              | 恶格（煞忌刑伤）              | `malefic.ts`                                               |
| `patterns/ming-gong-summary.ts` | 命宫摘要                      | `soul-summary.ts`（对齐 iztro Soul Palace）                |
| `analysis/views/daxian.ts`      | 当前大限分析                  | `decadal.ts`（与 `--decadal` 一致）                        |
| `analysis/views/liunian.ts`     | 流年 + 流月分析               | `yearly.ts`（与 `--yearly` 一致）                          |
| `analysis/views/kuiyue.ts`      | 魁钺贵人倾向                  | `patron.ts`                                                |
| `analysis/views/sanfang.ts`     | 三方四正联动                  | `surround.ts`（对齐 iztro `surroundPalaces`）              |
| `analysis/views/sihua.ts`       | 本命四化会照                  | `mutagen.ts`（与目录两层各一，路径区分）                   |

**保留拼音**（「尽力」的边界）：classics 的 `data/gusuifu.ts`（骨髓赋）/ `quanji.ts`（全集）/ `quanshu.ts`（全书）是**古籍书名专名**，无通行英文名，转译反而丢失可检索性。

改名牵动：全仓 import 改写（约 20 处）、`test/` 与 `tools/` 引用、CLAUDE.md 目录树。与 §2.10 路径迁移**同一笔提交**做（都是 `git mv` + import 改写，分两笔会互相踩）。

### 2.8 解析引擎：cac 退役，底座 Node 内置 `util.parseArgs` + 薄适配层

三 skill 两套引擎合并时归一为 **Node 内置 `util.parseArgs`（`tokens` 模式做底座）+ 薄适配层**，
`cac` 依赖从根 `package.json` 移除（classics / synastry 已实战此选型，推广为唯一实现）。

分工：

- **底座（`util.parseArgs` `tokens: true`）**：token 化交给标准库——`--key value` / `--key=value` /
  裸开关 / `--` 分隔的 token 识别，行为官方文档明确、零依赖。
- **适配层（`cli/args.ts`，薄）**：输入格式适配全部在此——
  - 声明表校验：未知参数当场中文报错（**不走 strict**——其报错是 Node 写死的英文
    `Unknown option '--unknown'`，与全中文报错约定冲突；自校验反而完全可控）；
  - `OPTION_ALIASES` 归一（`--geju`→`--pattern`）；
  - 位置参数归类（§1.2 形态识别）；
  - 取值判据取自声明表 `kind`：已声明的取值参数**贪婪吃紧随 token**（`--limit -3` 的 `-3`
    是合法值）。⚠️ 此行为**版本敏感**：早期 `util.parseArgs`（Node 18.x）把负数当 short
    option（strict 下报错），当前版本贪婪吃值——本项目运行要求 Node ≥ 22.15，实测
    `--limit -3` → `{kind:"option", name:"limit", value:"-3"}` 正确；selftest 钉死此断言，
    若未来 Node 行为回退立即变红；
  - 可选值形态（`--decadal 37` / 裸开关 `true`）与 `camelKey` 归一。

**行为变更（有意）**：同一参数重复给出由 cac 的「取末值」改为**报错**。
回归面：selftest 全量 + 层 2 CLI 端到端全跑兜底。

### 2.9 术语全对齐 iztro：类型值、内核字段与标识符（共五层）

前两层（参数 / 文件名）见上文；此节是**类型值、`ziwei/types.ts` 公开字段与标识符层**——与 iztro 原作者术语全面对齐（用户拍板）。牵动 types / algorithm / render / patterns / analysis / compare /
test 与 **JSON 输出字段名**；合盘消费方（chart-view.ts）同仓同笔改。

**类型值**：

| 现值                           | 新值             | iztro 依据                                          |
| ------------------------------ | ---------------- | --------------------------------------------------- |
| `Star.type` 的 `lucky` / `sha` | `soft` / `tough` | iztro 星曜 type 英文值（实测 minorStars type=soft） |
| 类型名 `SiHua`                 | `Mutagen`        | `Star.mutagen` 字段同名                             |
| 类型名 `DaXian`                | `Decadal`        | `decadal`                                           |

**内核字段（`types.ts` 公开面，`analyze --json` 随之变更字段名）**：

| 现字段                            | 新字段                                        | iztro 依据                                                            |
| --------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `chart.wuxingJu` / `wuxingJuName` | `fiveElementsClass` / `fiveElementsClassName` | `astrolabe.fiveElementsClass`（iztro 原名含 s）                       |
| `chart.mingGongBranch`            | `soulBranch`                                  | `earthlyBranchOfSoulPalace`（Soul Palace）                            |
| `chart.shenGongBranch`            | `bodyBranch`                                  | `earthlyBranchOfBodyPalace`（Body Palace）                            |
| `chart.daXians`                   | `decadals`                                    | `decadalList`                                                         |
| `chart.currentDaXianIndex`        | `currentDecadalIndex`                         | 自有语义 + decadal 词根                                               |
| `Palace.daXianAge`                | `decadalRange`                                | `decadal.range`                                                       |
| `Palace.isCurrentDaXian`          | `isCurrentDecadal`                            | 同上                                                                  |
| `Palace.xiaoXianAges`             | `ages`                                        | `palace.ages`（同名直取）                                             |
| `BirthInfo.hour`                  | `timeIndex`                                   | `bySolar(date, timeIndex, …)` 入参同名，语义完全一致（时辰序号 0–12） |
| `Star.siHua`                      | `mutagen`                                     | `Star.mutagen`                                                        |

**标识符层**（函数 / 常量名，第五层——拼音标识符全部对齐 iztro 词根）：

| 现名                                                   | 新名                                              | iztro 依据                                                     |
| ------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------- |
| `duiGongBranch`                                        | `oppositeBranch`                                  | `surroundPalaces.opposite`                                     |
| `sanFangBranches`                                      | `surroundBranches`                                | `surroundPalaces`（结构 `{target, opposite, wealth, career}`） |
| `sanFangSiZheng`（render）                             | `surroundNames`                                   | 同上                                                           |
| `getSanFangPalaces`（patterns/helpers）                | `getSurroundPalaces`                              | 同上                                                           |
| `Palace.isShenGong` / `isMingGong`                     | `isBodyPalace` / `isSoulPalace`                   | iztro 宫字段 `isBodyPalace` 同名；Soul Palace 词根             |
| `SHA_STARS` / `LUCKY_STARS`                            | `TOUGH_STARS` / `SOFT_STARS`                      | `tough` / `soft`                                               |
| `getSiHuaByStem`                                       | `getMutagenByStem`                                | mutagen                                                        |
| `getLiuNianSiHua` / `getLiuYueSiHua`                   | `getYearlyMutagen` / `getMonthlyMutagen`          | `yearly` / `monthly` + mutagen                                 |
| `getLiuYueStemIndex`                                   | `getMonthlyStemIndex`                             | `monthly`                                                      |
| `liuNianBranchOf`（fortune.ts）                        | `yearlyBranchOf`                                  | `horoscope.yearly`                                             |
| `xiaoXianPalaceOf`                                     | `agePalaceOf`                                     | `horoscope.agePalace`                                          |
| `liuNianSection` / `daXianSection` / `xiaoXianSection` | `yearlySection` / `decadalSection` / `ageSection` | 对应参数词根                                                   |
| `gejuSection` / `sihuaSection`                         | `patternSection` / `mutagenSection`               | 对应参数词根                                                   |
| `parseAgeArg`                                          | `parseAgesArg`                                    | 对齐 `--ages`                                                  |

标识符层的**保留**：`getYearStemIndex`（英文意译，无 iztro 对应概念）、`SHICHEN`（时辰为中国
时制专名，iztro 无对应英文常量——`timeIndex` 是纯数字）、`lateZi*` 与 `--late-zi`（晚子时
在 iztro 仅表现为 `timeIndex 12`，无术语名可对齐，参数保持拼音专名）、`mustPalace` /
`palaceAtBranch` / `chartSignature`（英文意译的渲染辅助）、`ZiweiChart` / `BirthInfo` /
`borrowed*`（自有结构与概念）。

**保留不动**（专名或既有英文意译）：`ziweiPos`（紫微为星名音译专名，iztro 库自身亦用）、
`yearStem` / `yearBranch`（干支通行英文意译）、宫名「交友宫」（倪师体系口径，**有意**偏离
iztro「仆役」——领域立场，不应对齐）。

### 2.10 路径迁移牵动清单（改漏即崩）

| 位置                         | 改什么                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `tsconfig.json`              | `paths` 的 `@/*` 改映 `./scripts/*`；`include` 收窄（`skills` 目录 → `scripts` 与 `test` 等） |
| `test/lib/loader.ts`         | 内核根路径 `skills/purplestar-astrology/scripts` → `scripts`                                  |
| `test/lib/skills.ts`         | `ALL_SKILLS` / `SOURCE_SKILL` / `CHART_LIKE`：三 skill → 单 skill（根）                       |
| `test/lib/citation-guard.ts` | 扫描根：三个 skill 的 scripts/ → 根 scripts/                                                  |
| `test/repo.test.ts` 层 6     | 「三 skill 自包含 / 触发互斥」断言 → 「单 skill 自包含」                                      |
| `test/cli.test.ts`           | 三条 CLI 路径合一；synastry-guide.md 的引用路径改根 references/                               |
| `test/invariants.test.ts`    | `skills/purplestar-classics/scripts/index` 的类型引用路径改根                                 |
| `tools/db/db.ts`             | `TOPIC_KEYS` 的字面 import 路径 `../../skills/...` → `../../scripts/...`                      |
| `tools/bench/startup.ts`     | `CLI` 路径常量改根 `scripts/purple-star.ts`                                                   |
| `scripts/boot-hooks.ts`      | `pickRoot` 的调用方 probe 值随入口位置自适（机制不变）                                        |
| 引导层 REQUIRED_EXPORTS      | 补 classics / synastry 关键导出                                                               |

⚠️ `tools/` 不在 `npm test` 覆盖内（已知风险面）——迁移后必须**实跑** `tools/db` 的入口与 `tools/bench/startup.ts` 各一次验证，光靠测试套件发现不了它们的路径断裂。

## 3. 命令面调整与 help 强化

### 3.1 命令面（合并后 5 条 + help）

`astrology`（排盘分析，融合原 analyze / insight / chart / topic）/ `classics` / `synastry` / `stars` / `selftest`，外加强化的 `help`。

- **`cities` 命令删除**：`ziwei/cities.ts` 的数据表**保留**（`--city` 的容错解析与歧义提示仍查它），删的只是查询命令。`REQUIRED_EXPORTS` 里的 `PROVINCES` 随之退役（无命令消费者）。
- `chart` 保持十二宫逐宫详表职责（见 §1.3）。

### 3.2 `help` 强化 + 每命令 `--help`

- **`help`（总览）**：每条命令一段**详细说明**——功能、专属参数、典型示例（含专题参数组合）、注意事项（如「排盘四必问」「synastry 需先备两张 JSON」）。命令列表仍由 `COMMAND_DESC` 派生，详细文本新增 `COMMAND_HELP`（命令名 → 多行说明），HELP 逐命令展开。
- **`<命令> --help`（每命令）**：输出**该命令**的用法——专属参数（从 `OPTION_GROUPS` 过滤出该命令实际读取的子集，**命令 → 参数归属表**由此落地）、示例、口径警告。此前「参数作用域是 skill 级不校验归属」的诚实边界顺势收窄：help 层面先给出正确的归属视图。
- **输出形态按 man 手册页结构**（用户指定）：`NAME`（命令名 + 一句话）/ `SYNOPSIS`（用法形态
  概要行，位置参数形态与参数形态并列）/ `DESCRIPTION`（功能详述）/ `OPTIONS`（按归属表过滤的
  参数清单，分类缩进，别名尾注）/ `EXAMPLES`（逐条示例 + 一句说明）/ `NOTES`（排盘四必问、
  拼音别名表、口径警告）/ `SEE ALSO`（其余命令）。每命令 `--help` 同结构（总览多一节
  `COMMANDS`）。节标题大写、固定节序——`less purple-star.ts help` 的观感即 man。
- 实现住 `cli/help.ts`：总览 help 与每命令 help 共用一张命令 → 参数归属表 + `COMMAND_HELP` 文案表。

### 3.3 配置文件输入

- **`--config <file>`**：读 JSON 文件。键名与参数的 camelCase 同名（`date` / `time` / `city` / `gender` / `pattern` / `mutagen` / `yearly` …），出生信息与专题参数都可写。
- **优先级：命令行参数覆盖配置文件同名字段**（命令行更明确，必须赢；配置是基底）。
- **`--template`**：打印可直接使用的示例 JSON 模板到 stdout（含双方合盘示例与注释性字段说明），用户 `--template > my.json` 落盘。模板本身必须是合法可跑的配置。
- 校验：配置文件里的未知键、非法值与命令行同规则报错（不静默）。
- 实现住 `cli/config.ts`：读文件 → 键校验 → 与 argv 合并（argv 优先）→ 产出合成 `CliArgs`。

### 3.4 示例数据与隐私

- **文档 / help / `--template` 的出生示例**：全部换为一组全新虚构组合（随机挑选、不关联真实
  人物）——`2011-06-24 07:45 男 杭州`（甲方）与 `1999-11-03 15:20 女 成都`（乙方），示例旁注明
  「示例数据为虚构」。旧组合（1990-05-15 北京 男 / 1993-08-22 上海 女）从一切公开可见文本清退。
- **测试固定样例**：保持确定性（基准回归与具体值断言的本质），但收敛到集中常量——
  `test/lib/sample.ts`（仓库测试）与 selftest 顶部一处（skill 内），文件头注明「虚构样本，
  无真实人物」；想整组更换时改一处。
- **随机样本不变量断言**（回应「随机」的字面诉求）：selftest 每次运行随机生成若干日期盘，
  断言不变量集（十二宫齐全 / 地支不重复 / `ages` 覆盖 1–120 / 斗君在十二支内 / soft-tough
  分类完备）——随机性进测试覆盖，不进期望值。

## 4. SKILL.md 重写

- **description**：合并三域触发词（排盘解读 / 合盘合婚 / 古籍检索），删除「用 xxx 技能」指路句（改为本技能命令）。
- 命令速查 5 条 + help：`astrology` / `classics` / `synastry` / `stars` / `selftest`（analyze / insight / chart / topic / cities 皆废）。
- 路径约定改写：命令一律 `node scripts/purple-star.ts`（仓库根 = skill 根，两重身份合一，原「仓库级文档写全路径」的区分作废）。
- 合盘工作流：先 `astrology --json` 两张 → `synastry --charts a.json,b.json`。

## 5. 测试策略

- TDD：selftest 断言先行（红→绿），沿用上一轮的模式。
- 迁移本身以「行为不变」为准：迁移提交前后 `selftest`（合并后的三段合计）与 `npm test` 必须全绿；`typecheck` 0 错。
- 层 6 守卫改写为单 skill 形态后，必须仍有「skill 自包含可拷走」的断言（对用户的承诺不变，只是承诺对象从三个变一个）。
- 新增断言：位置参数形态（`astrology 1990-5-15 9:30 男 北京`）与参数形态排出同一张盘、`--year`/`--month`/`--day` 已删（调用即未知参数）、同类位置参数重复报错、城市 token 查不到报错；`astrology` 默认输出概览含信息面板、各功能参数（英文名）产出对应专题、`--palaces` 出十二宫逐宫详表、`--yearly` 缺省当前年、旧命令名（analyze / chart / topic / insight / cities）调用即报未知命令、每命令 `--help` 输出且含归属参数、`--focus` 四项深化各自可锚定、`--config` 合并优先级（命令行赢）、`--template` 产物可被 `--config` 吃回。

## 6. 文档同步面

| 文档                  | 改动                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| 根 `SKILL.md`         | 全量重写（见 §4）                                                                                 |
| `references/`         | workflow / flags / output-contract 随命令面更新；并入 synastry-guide.md；troubleshooting 路径更新 |
| `CLAUDE.md`（仓库）   | 目录树、路径约定、skill 布局表、「另两个 skill」相关各节全删或改写、守卫表更新                    |
| `README.md`           | 三 skill 介绍 → 单 skill                                                                          |
| `docs/test/README.md` | 备案区追加「三 skill 合一」通告（报告正文不回改）                                                 |

## 7. 风险与不做的事

- **git 历史可追溯**：迁移用 `git mv`，diff 可追溯；不 squash 历史。
- **不做**：synastry 出生信息直传（用户明确否决）；不引 YAML/新依赖；不改排盘内核逻辑（ziwei/ 平移零改动）；不动 `tools/db/`（它引用的路径若受牵动单独核）。
- **依赖形态变化**：合并后只有根 `package.json` 一份，`iztro` + `lunar-typescript` 归它，`cac` 移除（§2.8）——原 classics / synastry「零 npm 依赖、拷走即跑」的优势消失，整个 skill 安装后需先 `npm install`（SKILL.md 安装说明要写明）。iztro 调用关系不变：astrology / selftest 排盘，synastry 吃 `astrology --json`（数据源头仍是 iztro），classics / stars / help 零排盘。
- **风险点**：路径迁移的「改漏即崩」清单（§2.10）与术语全对齐（§2.9）——后者改公开字段名，`typecheck` + 两层测试 + 合盘消费方同笔改兜底——每项都有测试或 typecheck 兜着，迁移提交必须单独成笔、全绿才合。
- 分支策略：在 master 直接做（仓库惯例，无 PR 流程），但**迁移提交与功能提交分开**，出问题可单独 revert。
