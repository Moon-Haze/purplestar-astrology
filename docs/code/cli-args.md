# cli-args —— CLI 参数面

本篇覆盖 `scripts/cli/args/`：`index.ts`（门面）· `table.ts`（声明表）· `parse.ts`（解析引擎）·
`scope.ts`（作用域）· `config-input.ts`（`--config` / `--template`）。

收录的是这四个模块里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`index.ts`：门面

> `args/index.ts` —— 参数面的统一出口（`@/cli/args` 的落点）。
>
> ## 为什么是门面而不是改写引用方
>
> `CliArgs` / `CliContext` 是**全 CLI 的公共类型锚点**：`knowledge/` 各源、`selftest` 各组、
> `commands/` 与 `host/` 都从 `@/cli/args` 取它。本门面聚合本目录四个模块，
> 使这些引用一字不改 —— 目录分组是**物理组织**的变更，不该连带改语义引用。
>
> ⚠️ 本门面**只 re-export 被外部实际消费的那些符号**（下表即全部），
> 不做「整目录转手」：门面多导出一个符号，就多一处可能与源模块脱钩的名单。
> 各模块之间仍按需直接 import 具体文件（`./parse` / `./table`），不必绕本门面。
>
> | 符号 | 来源 | 谁在用 |
> |---|---|---|
> | `CliArgs` `CliContext` | `parse.ts` | 全 CLI 类型锚点（knowledge / selftest / commands / host） |
> | `parseArgs` | `parse.ts` | selftest 各组、引导层 |
> | `OPTION_NAMES` `SIDE_PREFIXES` | `parse.ts` | selftest 参数组、`config-input` |

## 二、`table.ts`：声明表（「有哪些参数」的唯一定义处）

### 2.1 模块定位与三层分工

> CLI 参数声明面 —— 「有哪些参数」的唯一定义处（纯数据，零依赖）。
>
> 与同目录两个模块的分工（三层自底向上）：
>   1. 本文件：**声明了什么** —— 参数表 / 拼音别名 / 全集派生 / 键名换算，零逻辑零依赖；
>   2. `option-scope.ts`：**本 skill 认哪些** —— 作用域契约与差量排除值；
>   3. `args.ts`：**怎么解析** —— `util.parseArgs` tokens 底座 + 校验 + 薄适配层。

### 2.2 为什么参数要有声明表

> 「有哪些参数」的唯一来源是 `OPTION_GROUPS`：`args.ts` 的解析器据它拒绝未知参数、
> help 据它渲染参数段、`SKILL.md` 则由 `selftest` 断言兜底。拼错参数名（`--ctiy 喀什`）
> 曾静默落回默认经度排出错盘 —— 那正是这张表要消灭的失败模式。

### 2.3 ⚠️ 键名换算与加载时机

> ⚠️ **键名是 camelCase**（`late-zi` → `lateZi`）。换算只有 `camelKey` 一处，
>    声明表里的 `name` 仍写 kebab（它同时是用户敲的名字、help 的显示名）。
>
> ⚠️ 本文件由引导层（purple-star.ts）在 `registerHooks` **之后**经 `args.ts` 间接加载。
>    不要在 purple-star.ts 顶部用静态 `import` 引它 —— 钩子未注册时解析会失败。

### 2.4 `OptionSpec`：界面刻意只留四格

> 界面刻意只留四格 `name / kind / value / desc` —— 声明表要能被一眼扫完，
> 免得「加参数」变成一件要读文档才敢做的事。

语义标志（候选 2）与归属标志（候选 4）各自承载一套派生，四格之外均为可选标志：
`shadow`（可被独占分支吞掉）· `noShadow`（排除出可吞集合）· `deep`（专题深入旗标）·
`noIntent`（排除出「输出意图」判据）· `cmds`（读取本参数的命令）· `global`（任意命令可用）。

### 2.5 `OPTION_GROUPS` 的口径

> - 专题参数族主名英文化（spec §1 表）：`pattern` / `mutagen` / `yearly` /
>   `monthly` / `decadal` / `ages`；拼音原名成为 `OPTION_ALIASES` 别名。
> - `--year` / `--month` / `--day` 三连**已删**：`--date 1990-5-15` 完全覆盖（格式宽松，
>   月日不补零）。误敲 `--year` 由拼错建议引向 `--yearly`（编辑距离 2）。
>
> 分组标题里的「三选一」「二选一」是**口径**而非装饰：`buildBirthInfo` 对
> `--date` / `--lunar` 与 `--time` / `--branch` 各取其一，同时给出时按该处的优先级处理。

### 2.6 拼音别名

> 拼音别名 → 英文主名（spec §1.1）。
>
> 别名是**显式声明**的映射，不是拼错容错 —— `--patern` 仍然报错，
> `args.ts` 的 `suggestOption` 建议主名 `--pattern`。help / SKILL.md 一律用主名，
> 别名在 help 的参数描述尾注。

### 2.7 语义派生（候选 2）

> 四套派生 + 优先级链同源于 role 与参数标志：改 help 标题不再静默拆掉任何一套；
> 新增专题旗标只需标 `deep: true`，deepDive 自动认。域注意：`SHADOWABLE` 用 kebab
> 原名（调用处按 `exclusive.slice(2)` 对拍），其余三个用 camelCase（消费 args 键）。

- `SHADOWABLE_KEYS`：
  > 可被独占分支吞掉的功能参数（kebab 原名）—— 专题深入组除 `palaces`（noShadow）
  > 之外的全部，加上输出与选题组标了 `shadow` 的五项（yearly / monthly / focus /
  > topic / report）。独占参数自身也在集合里，是为了让「两个独占分支同给」被指路
  > 而非静默吞掉低优先级的那个（自指由调用处的 `n !== exclusive` 过滤兜住）。
- `BIRTH_KEYS`：
  > 出生相关参数名（camelCase）—— `role: "birth"` 三个组的全部参数。零输入演示的
  > 判据之一：这些键**全部**缺席。「其他出生信息」组（gender / lng / city /
  > province / name）也在内 —— 只给 `--gender` 是部分输入，按「缺一问一」报错，
  > 不该走演示盘。位置参数归类与 `--config` 注入都发生在 parseArgs / applyConfig，
  > 二者给出的出生信息均算「已输入」。
- `INTENT_KEYS`：
  > 表达了输出意图的功能参数（camelCase）—— 专题深入与输出选题两组，刨去标了
  > `noIntent` 的 `info`（零输入时它正是演示目标）与 `config`（参数来源而非输出形态）。
  > 零输入 + 这些参数在场 = 用户要特定输出，不替他排虚构盘 —— 交回原路径按「缺一问一」
  > 报错（`--json` / `--report` 尤其如此：机器接口与全盘报告都不喂虚构数据）。
- `DEEP_DIVE_KEYS`：
  > 专题深入旗标（camelCase）—— 深入态基底（基本信息面板 / 运限速览 / 专题指路）的
  > 显隐判据：任一在场即「已在深入，基底与指路是噪声」。旧 astrology 的 `deepDive`
  > 硬编码六旗标由此收编；新增专题参数只需标 `deep: true`。

### 2.8 归属投影（候选 4）

> 「哪个参数归哪条命令」此前是 help.ts 手抄的第二真相源（`OPTION_OWNERSHIP`，
> 零正向测试，`--out` 的承诺与 main 的实际行为早已漂移）。现收进声明表：
> 每个参数标 `cmds`（读取它的命令），全局参数标 `global`，help 只做投影。

`ownedOptions(cmd)`：

> 命令 → 该命令实际读取的专属参数（kebab 名，投影非转录）。
>
> help 视图：未列出的参数对该命令无害（skill 级作用域收下不用），但 help 不展示
> —— 用户照 help 敲不会被误导。作用域仍是 skill 级，本投影不做硬校验。

## 三、`parse.ts`：解析引擎

### 3.1 模块定位与 cac 退役

> CLI 参数解析引擎 —— `util.parseArgs` tokens 底座 + 薄适配层。
> 不依赖任何内核模块，也不使用 `@/` 别名。
>
> 与同目录两个模块的分工（三层自底向上）：`args-table.ts` 管**声明了什么**
> （参数表 / 别名 / 全集 / 键名换算，零依赖纯数据）、`option-scope.ts` 管
> **本 skill 认哪些**（作用域契约与差量排除值），本文件只管**怎么解析**：
>
> cac 已退役，底座换 Node 内置 `util.parseArgs`
> （`tokens: true` 拿 token 流），输入格式适配全部在本文件的薄适配层：
>
> - **底座只管切分**：`--key=value`（inlineValue）/ 裸 `--key` / `--` 分隔 / positional
>   的 token 识别。⚠️ 实测（Node v26）：`strict: false` 下 `--limit -3` 的 `-3` 是**独立的
>   option token**（name "3"），不是 limit 的值 —— 贪婪取值因此必须由适配层自己做
>   （见 `parseArgs` 的单趟扫描），这也是「薄适配层」存在的第一个理由。
> - **声明表校验**：未知参数当场中文报错（不走 strict —— 其报错是 Node 写死的英文，
>   与全中文报错约定冲突；自校验完全可控）。
> - **OPTION_ALIASES 归一**（`--geju`→`--pattern`）与主名判重（重复参数报错，
>   旧 cac「取末值」废止）。
>
> ⚠️ 本文件由引导层（purple-star.ts）在 `registerHooks` **之后**动态加载。
>    不要在 purple-star.ts 顶部用静态 `import` 引它 —— 钩子未注册时解析会失败。

### 3.2 `OPTION_NAMES` 的差量派生

> 从 `args-table.ts` 的全集（`ALL_OPTION_NAMES`）按 `OPTION_SCOPE.excluded`
> **差量**派生：单 skill 形态下排除表为空，作用域即全集；「有哪些参数」因此
> 真正只有 OPTION_GROUPS 一处声明。

### 3.3 `SIDE_PREFIXES`

> 本 skill 认的出生方前缀（合盘是 `a-` / `b-`，它要分别读两方的命盘）。
>
> 取自 `option-scope.ts` 的 `OPTION_SCOPE.sidePrefixes`。导出是给 `cli/selftest.ts`
> 用的：它扫 `SKILL.md` 里提到的参数，要先剥掉这层前缀再与 `OPTION_NAMES`
> 比对 —— 前缀表不该有第二份。

### 3.4 拼错建议的阈值

> 阈值取 2 是权衡：`ctiy` → `city`（换位算 2 步）、`year` → `yearly` 都要抓；
> 再放宽就会开始乱建议，反而把提示变成噪声。

同距离偏好**包含**敲入名的候选：

> `--year` 距 `--leap` 与 `--yearly` 同为 2，
> 但 yearly 以 year 为前缀，几乎总是用户想要的那个（leap 只是无辜的等距词）。

### 3.5 `checkOptionName`：三条规则各挡一种静默失败

> 1. 名字（归一后）不在 `OPTION_NAMES`：拼错。报错并给出最近的名字。
> 2. `a-` / `b-` 前缀出现在不收它的命令上：那里读的是不带前缀的名字，带前缀的写法会被
>    整个忽略（`astrology --a-city 北京` 排的是默认经度的盘）。
> 3. 前缀后面接的仍必须是声明过的名字：`--a-ctiy` 同样要抓。
>
> ⚠️ 刻意**不**校验「这个参数属于这个命令」：`--json` 给 `knowledge` 是无害的多余参数，
>    而把归属做成硬约束会让每条命令的合法集合成为第二个需要维护的真相 —— 拼错才是要挡的。
>    （Task 8 的 help 归属表是**视图**，不做硬校验。）

### 3.6 `parseArgs`：两步法与贪婪取值

> ## 两步：**底座切分 → 单趟适配**
>
> 底座 `nodeParseArgs({ strict: false, tokens: true })` 只交 token 流；
> 取值判据、判重、别名归一、中文报错全部在下面这趟扫描里：
>
> - **贪婪取值**：声明表 `kind: "value"` 的参数**无条件吃紧随 token**（不论其形状）——
>   `--limit -3` 的 `-3` 在底座里是一个 name 为 "3" 的假 option token（实测 Node v26，
>   见文件头），扫描把它吃成 limit 的值。⚠️ 此行为**版本敏感**（早期 Node 的 strict 模式
>   会拒绝负值），selftest 钉死 —— Node 行为若回退立即变红。
> - **重复报错**：同一参数（归一后主名，含主别名同现 `--geju --pattern`）给两次即报错
>   —— 旧 cac「取末值」是静默择一，废止（spec §2.8 行为变更）。
> - **`--` 之后**全进 `_`（不做形态归类）。
> - **`-x` 短参数**：不在取值位置时一律报错 —— 本项目只有长参数。
>
> `command` 省略即退回「照单全收」的宽松解析 —— 供不关心参数面、只想拿个参数表的
> 调用方使用。

扫描循环内的两条行内 ⚠️（留在源码）：

> // 紧随 token 是真 option（`--xxx`）/ terminator / 结尾 → 可选值形态存 true。
> // ⚠️ `-3` 这类假 option（底座把负数切成 name "3" 的 option token）**不算**——
> //    贪婪取值恰恰要吃它（`--limit -3` 的 -3 是值）。

### 3.7 `classifyPositionals`：为什么住在本文件

> 形态正则：日期 `^\d{4}-\d{1,2}-\d{1,2}$`、时刻 `^\d{1,2}:\d{2}$`、性别
> `男|女|male|female|m|f`，其余中文 token 为城市名（含「山东青岛」省市连写与「山东」
> 裸省名 —— 城市与省的解析在 `birth-info.ts` 的 findLongitude / 省会计链）。
> 农历生日只能走 `--lunar`（与公历同形，无法按形态区分）。
>
> ⚠️ 住本文件而非 `birth-info.ts`（计划原案）：归类在 `parseArgs` 内完成
> （同类 token 重复必须在解析层报错），而 birth-info 静态 import 本文件的
> `CliArgs` —— 挪过去会成环。

`--` 之后的内容已进 `_` 且不归类（用户明确说了「这些是字面量」）。

## 四、`scope.ts`：作用域（空表机制）

### 4.1 模块定位

> 本 skill 的**参数作用域** —— 单 skill 认哪些参数。
>
> 与 `./parse.ts` 的分工：那份是**声明表 + 解析骨架**（`util.parseArgs` tokens 底座 +
> 薄适配层），本文件则是「本 skill 认声明表里的哪些参数」那一层 —— `OptionScope`
> 契约与 `OPTION_SCOPE` 值同居于此，本文件不 import 任何模块（依赖图叶子）。

### 4.2 差量形态：默认全集，只声明排除项

> 单 skill 形态下正面清单恒等于
> `OPTION_GROUPS` 全集（25 项逐字重抄不产生任何信息），却要付两笔成本 —— 拼错
> 一个名字静默失效（该参数直接不生效），以及每次加参数都要来这里抄一遍。差量形态下
> `OPTION_NAMES` 由 `args.ts` 从全集派生，手抄清单退役。
>
> ⚠️ **粒度仍是 skill 级**：`stars --json` 这类「本 skill 有、但当前命令不读」的参数
> 仍会被收下不用（归属只过滤 help 视图，不做硬校验）。

### 4.3 `OptionScope.excluded`

> 从声明表**排除**的参数名（差量形态：默认全集）。单 skill 形态下为空数组 ——
> 全集即作用域，旧的「正面清单全量手抄」已退役（它恒等于全集，只付拼错静默失效
> 与逐项维护两笔成本）。每一项都必须是声明表 `OPTION_GROUPS` 里真有的名字。

`OPTION_SCOPE.excluded` 上另有一条：

> ⚠️ 这里的每一项都必须是声明表 `OPTION_GROUPS` 里真有的名字：selftest
> 会盯差集，但「想排除一个不存在的名字」仍是拼写错误，别等红灯才发现。

### 4.4 `prefixedCommands`：不能省的那一维

> 哪些命令接受 `sidePrefixes` 前缀。空数组表示本 skill 没有这种命令。
>
> ⚠️ 这一维**不能省**：它是「前缀写在别的命令上」这条静默失败的判据。若只看
> `sidePrefixes` 非空就放行，`selftest --a-chart` 会从「报错」变成「静默忽略」。

### 4.5 ⚠️ 类型标注写 `: OptionScope`，不要写 `as const satisfies`

> 后者会把 `OPTION_SCOPE` 的类型钉成这里**字面量写出来的那个对象类型**，于是一旦某个
> 可选字段没写，`args.ts` 里对可选字段的访问就成了「访问一个不存在的属性」而编译不过。
> 这里也不需要字面量类型（args.ts 只用它做差量过滤）。

### 4.6 空表机制（a- / b- 前缀退役后）

> 出生方前缀已退役：synastry 输入用 `--charts` 单参数，
> a- / b- 前缀不再需要 —— 两个空表让解析层的前缀分支整个不可达。

## 五、`config-input.ts`：`--config` / `--template`

> - **`--config <file>`**：读 JSON 文件，键名与参数的 camelCase 主名同名
>   （`date` / `time` / `city` / `gender` / `pattern` / `mutagen` / `yearly` …），
>   出生信息与专题参数都可写。
> - **优先级：命令行参数覆盖配置文件同名字段**（命令行更明确，必须赢；配置是基底）。
> - **校验**：配置文件里的未知键、非法值与命令行同规则报错（不静默）；
>   `_` 前缀键是注释性说明，跳过（模板里用它写人类备注）。
> - **`--template`**：打印可直接使用的示例 JSON 模板到 stdout（含 `_说明` 键），
>   用户 `--template > my.json` 落盘后可直接 `--config my.json` —— 模板本身
>   必须是合法可跑的配置（selftest 有吃回闭环断言盯着）。

`CONFIG_OPTION_GROUPS`：

> 导出声明表引用（模板与校验共用一张 OPTION_GROUPS，防两处漂移）。
