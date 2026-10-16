# cli-commands —— CLI 命令层

本篇覆盖 `scripts/cli/commands/`（`index.ts` · `command-meta.ts` · `help.ts` ·
`astrology.ts` · `fortune.ts` · `report.ts` · `synastry.ts`）、`scripts/cli/fortune/`
（运限八节）与 `scripts/cli/knowledge/`（四域合一的知识检索命令）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`commands/index.ts`：命令注册薄层

> 命令注册（spec §2.2：各命令按文件拆分）。本文件只做三件事：
> 声明命令名与文案（`command-meta.ts`）、装配命令表、re-export 实现（各命令文件）。
>
> `CommandFn` 允许 async 是给 `cmdSelftest` 的：它要 `await import("./index")` 取命令表
> 键集（替代旧的「读源码文本正则抽键」），动态 import 是打断
> 「commands → selftest → commands」静态环的唯一手段 —— 同步签名下这条 seam 只能用对
> 物理排版敏感的正则走第三条路。

- `COMMAND_TABLE`（裸表，刻意**不导出**）：
  > 刻意**不导出**这张裸表：导出的是下面两个视图（`COMMANDS` 供分发、{@link COMMAND_DESC}
  > 供渲染 HELP）。调用方拿不到「键集与描述可能对不上」的中间态。
  >
  > 用 `satisfies` 而非 `: Record<...>` 标注，是为了保住字面量键集 —— `CommandName` 与
  > `COMMAND_DESC` 的完备性都建立在它之上。
- `COMMANDS`（分发用）：
  > 值类型显式写出 `| undefined`：命令名来自 argv，查表必然未命中，这里让「未命中」
  > 在类型上就成立，而不是靠断言把 undefined 抹掉。多数命令只需要 args，签名里少的那个
  > 参数 TS 允许省略；只有 selftest 用得上 ctx（它要在输出里交代内核根是哪一份）。
  > `help` 不在表内 —— 引导层单独处理，见 `purple-star.ts` 的 `main()`。

## 二、`command-meta.ts`：轻模块

> 命令元数据 —— 命令名清单与 HELP 渲染所需的描述文案。
>
> `commands.ts` 静态 import 各命令实现（→ astrology → 内核 → iztro），HELP 渲染却只需要
> 名字与文案。本模块拆出后 `purple-star.ts` 的 help / 未知命令路径只加载它即可返回，
> 不再为看一眼用法付出 iztro 冷启动（约 3.2 秒）。
>
> ⚠️ 本文件是**轻模块**：不得 import 任何命令实现或内核（help 渲染的依赖底线）。
> 键集与 `commands.ts` 的 COMMAND_TABLE 互相钉住：那边 `satisfies Record<CommandName, Cmd>`，
> 这边 `Record<CommandName, ...>` —— 任何一侧加命令漏改另一侧都编译不过。

优先级链：

> 优先级链的真相源在声明表（纯数据零依赖，不破本文件的轻模块底线）——
> 旧手抄文案漏了 `--report`，与 astrology 实际报错和 options.md 均不符，收拢即修正。

`COMMAND_DESC`：

> 类型写成 `Record<CommandName, string>` 而非 `Record<string, string>`：**新增命令忘了
> 写说明就编译不过**。

## 三、`help.ts`：man 结构

> help 渲染 —— 总览 help 与每命令 `--help`（man 手册页结构，spec §3.2）。
>
> - **总览 `help`**：NAME / SYNOPSIS / DESCRIPTION / COMMANDS / OPTIONS / EXAMPLES /
>   NOTES / SEE ALSO 八节（比每命令版多一节 COMMANDS），节标题大写、节序固定 ——
>   `less purple-star.ts help` 的观感即 man。
> - **`<命令> --help`**：同一结构减 COMMANDS 节；OPTIONS 按命令 → 参数归属表
>   （`ownedOptions` 投影，源数据在声明表的 `cmds` 标志）过滤成该命令实际读取的子集。
> - **归属表是 help 视图**，不做硬校验（作用域仍 skill 级）：「哪条命令读哪个参数」
>   的诚实边界收窄只发生在 help 层。
>
> 两处数据源：`commands.ts` 的 COMMAND_HELP（逐命令多行说明）与本文件就近声明的
> 示例与注意事项。参数清单从 `args-table.ts` 的 OPTION_GROUPS 派生（与实际接受面同源）。

- OPTIONS 节正文（行内）：
  > 逐组收集（相邻同名组合并），最后按组序同步输出标题与参数 —— 旧写法把组标题
  > 即时 push、参数行收集到循环外统一 append，结果所有标题堆在前面，分组名存实亡。
- 每命令 help 的归属与全局参数：
  > 归属 = 声明表投影（候选 4）：cmds 标志单点声明，help 不再持有第二张表。
  > 全局参数单列（不进任何命令的专属投影）：`--out` 的落盘通道在引导层 main，对每条命令
  > 都生效 —— 只写在 astrology 名下是旧手抄表与实际行为的漂移点。
- NOTES 按命令裁剪：
  > 四必问 / 晚子时 / 真太阳时跨午夜都是**排盘**铁律 —— synastry 不排盘、knowledge
  > 不涉出生信息，全量模板会让命令级 help 教人用对它无效的参数（如 synastry --help 里的
  > `--late-zi`）。全量铁律保留在总览 help。

示例数据：统一为虚构组合（spec §3.4）：甲方 2011-06-24 杭州 / 乙方 1999-11-03 成都。

## 四、`astrology.ts`：排盘分析一条命令

### 4.1 模块定位

> `astrology` 命令：排盘分析一条命令。各命令按文件拆分（spec §2.2）；
> chart/topic 融入参数（见 spec §1）。

### 4.2 `--view` 取值别名

> 英文主名与参数别名表（`OPTION_ALIASES`）同名同义 —— decadal = daxian（当前大限）/
> yearly = liunian（流年）/ monthly = liuyue（流月），归一到内部拼音取值后走同一套
> `AnalysisView`。mingpan（本命）在参数别名表中无英文对应，只有拼写本身。

### 4.3 运限参数的校验纪律（宁可报错，不静默产出错盘）

- `--yearly` 年份：
  > 非数字静默传下去会得到「NaN 天干 → 四空串」的垃圾输出，与 `--monthly` 同一纪律：
  > 宁可报错，不静默产出错盘。裸开关默认当前公历年（语义就是「深入今年」）。
- `--monthly` 农历月（行内）：
  > 裸开关必须报错：`Number(true) = 1` 会让它被静默当成农历一月（与 `--yearly` 不同，
  > 流月的「当前月」没有明确语义 —— 农历月随流年干五虎遁推，不设默认）。
- `--daily` / `--hourly`：与 `--monthly` 同一纪律 —— 「当前日 / 当前时」没有明确语义，
  不设默认，裸开关直接报错指路。

### 4.4 `buildAnalyzeJson`：`--json` 顶层契约（生产端）

> `--json` 的产物（生产端）：`astrology --json` 的顶层契约，也是
> `synastry/chart-view 的 readAnalyzeJson` 所消费的形状。
>
> 提为具名纯函数是为了让契约**一处生产、一处消费、一处对拍** —— 键名不再散落在
> 分发函数中段，selftest 可以进程内直调本函数、把产物喂给消费方校验（原先是子进程
> 端到端才能测的形状）。顶层键即输出契约：chart / patterns / mingGongSummary /
> nativeSiHua / liuNianSiHua / liuYueSiHua / liuNianPalace / xiaoXian / lateZi / basis。

`basis` 键（⚠️ 冻结契约）：

> 排盘依据（日期换算 / 出生地解析 / 时辰校正的说明），原样进 `basis` 键。传整包
> `CaliberBasis`（结构超集，变量传参无 excess 检查；JSON 只出四键，契约冻结）。
>
> 键名刻意不叫 `trueSolar` —— notes 里还含农历换算与出生地解析，与真太阳时无关。
> ⚠️ 显式四键是**冻结契约**（消费方 `chart-view.ts` 只声明这四键）：调用方传整包
>    CaliberBasis 时整包序列化会多出 longitude / lngNote / clockTime 等键 ——
>    类型的「结构超集无 excess 检查」拦不住运行时，键集在此逐键声明。

派生收进实现内部：

> 派生收进实现内部（caller 只给语义参数，interface 上不存在「传错组合」的态空间）：
> 年干取农历口径（与宫详表同源），生年四化与流年 / 流月四化由查表函数从年号重算 ——
> 全是纯函数，重算零成本，换来的是少 7 个参数与天然一致。

### 4.5 零输入演示

> 零输入演示的内置虚构样例 —— 与 help 示例、`--template` 配置模板同源
> （2011-06-24 07:45 杭州 male），输出自带「虚构」声明，不会被误当真实排盘。

> 零输入演示契约：出生信息一项没给且未表达其他输出意图时，不报「缺少出生日期」，
> 改以内置虚构样例演示基本信息面板。部分输入不适用 —— 给了一半说明想排特定的盘，
> 继续走「缺一问一」报错；`--json` / `--palaces` / `--topic` / 专题参数在场同样不适用：
> 那是明确的输出意图，虚构盘只会伪装成他要的产物。

### 4.6 独占分支与优先级链

> 独占分支（`--palaces` / `--topic` / `--report` / `--info`）激活时，其余功能参数不会
> 生效 —— 静默吞违反「宁可启动失败，也不静默产出错盘」，在这里指路。优先级链：
> `--palaces` > `--topic` > `--report` > 其他功能参数（`--info` 属于链上的「其他功能参数」，
> 但它自身也是独占分支 —— 只输出面板一节；`--json` 仅与完整概览或 `--palaces` 组合，
> 见各自分支）。

- `--topic` 消费 `--yearly` / `--monthly`：
  > `--topic` 自身**消费** `--yearly` / `--monthly`（流年 / 流月视角的年份与农历月）——
  > 它们不是被吞参数，检测必须放行，否则 `--topic love --yearly 2027`（流年论断指定年份）
  > 这一合法用法会被误伤。
- 独占参数自指：
  > 排除独占参数自身：`info` 在 SHADOWABLE 集合里（专题深入组），不过滤会报出
  > 「`--info` 不会生效：`--info`」的自指文案。
- 流月 / 流日 / 流时：
  > 流月 / 流日 / 流时四化随四化专题输出：单独给（不带 `--mutagen`）会被静默吞掉，
  > 在这里指路。只约束文本路径 —— `--json` 的对应顶层键是独立键（基准对拍依赖裸
  > `--json --monthly`）。

### 4.7 `cmdAstrology` 的输出形态

> **精简概览 + 专题分发**：不带任何专题旗标时输出口径提示（出生地 / 晚子时）、基本信息
> 面板与运限速览 + 专题指路（`--info` 同尾：面板 + 两节）；给了哪个专题旗标就只追加该
> 专题的详版（可叠加，按 `--pattern` → `--mutagen` → `--yearly` → `--decadal` → `--ages`
> → `--focus` 的固定顺序），且不再带面板与运限速览 / 指路 —— 已在深入，基底与指路都是噪声。
> 十二宫逐宫详表归 `--palaces` 与 `--json`。

### 4.8 `composeSections`（候选 3：接线升为可测 interface）

> 「给定 args + 排盘上下文 → 产出专题 section 序列」—— 候选 3 把旗标 → section 的接线
> 升为可直测 interface（原 `cmdAstrology` 默认路径的内联块）。
>
> 收益：接线本身成为被测物（`test/cli/astrology-sections.test.ts`），fortune 各
> `*Section` 退为 implementation 零件，守卫链（monthly / daily / hourly 须配 mutagen / 层级）
> 与 `parseAgesArg` / `deepDive` 门沉进同一实现。调用方只消费返回的 `string[]`，
> 不再手抄顺序与守卫。
>
> 行为契约：与迁移前的内联块逐字节等价（无深掘时带信息面板 + 运限速览；给了任一专题
> 旗标则跳过基底，按 pattern → mutagen → yearly → decadal → ages → focus 固定序追加）。

### 4.9 年干口径（生年四化必须取农历年干）

> 生年四化的年干必须取**农历年干**（`chart.lunarInfo.yearStem`），与 iztro 落在
> `Star.mutagen` 上的 mutagen 同源。不可用 `getYearStemIndex(info.year)`：那是公历年取模，
> 1-2 月出生（农历仍在上一年）者两口径分叉，本区块会与宫详表自相矛盾
> （实测 1990-01-15：农历己巳年 → 武曲化禄，公历取模却得庚 → 化权武曲）。
>
> 流年用 `--yearly`，不可复用 `--year` —— 后者是出生年的回退参数。二者同时给出不会报错：
> 流年取 `--yearly`；而出生日期一旦给了 `--date` / `--lunar`，`--year` 就被静默忽略
> （`buildBirthInfo` 里 `--date` / `--lunar` 优先），不会有任何提示。

## 五、`report.ts`：全盘报告的文档装配层

> `astrology --report` 的文档装配层：把 13 个主题的 Markdown 报告节拼成一份全盘报告。
>
> 内核侧（`analysis/report.ts` 的 `getTopicReport`）只管**单主题内容**；本文件管
> 文档级的事：报告顺序（用户口径：财运在事业前、性格在感情后）、文档头（出生信息 /
> 农历 / 全盘骨架 / 生年四化 / 格局 / 运限速览）、口径提示、经典出处的古籍检索，以及
> 知识来源分级尾注。经典出处在本层查（`corpus` 是独立知识域、经 `knowledge` 命令出面，
> 内核不反向依赖它），引文经 `options.citations` 递给内核逐节渲染。

- 板块顺序：
  > 报告的 13 个板块及顺序 —— 与 `TOPIC_KEYS` 的存储序不同（那份数序是 parquet 列序，
  > 动不得）：财运提到事业前、性格放在感情后，其余按「先核心五项、后十二宫顺次」。
- 经典出处：
  > 查一个主题的经典出处：先在古籍里找该主题主宫的**宫位专章**（全书「十二宫论·X宫」
  > 只覆盖命 / 财帛 / 官禄 / 夫妻四宫），取其中含主星的段落；再按主星名全局检索补足。
  >
  > 引文只出自本仓古籍库（公版古籍、已入库的定本），不做任何改写拼接 —— 查不到就少给，
  > 不凑数。
- 口径提示：
  > 口径提示（出生地 / 晚子时）—— 有则随报告，作为引用块紧跟文档头（口径提示必须随
  > 报告走，不能只在终端概览里出现）。
- 末尾不带换行：引导层统一 `console.log` 输出时补上唯一一个，文件以单换行结尾。

## 六、`synastry.ts`：合盘命令

> 两份盘都得由排盘命令的 `--json` 产出（spec §2.3；a- / b- 前缀已退役）。
> ⚠️ 缺失或份数不对时报错，而**不是**回退去读出生信息 —— 那种回退会让本命令
>    悄悄又变成排盘方（且回退路径无人测，必然腐坏）。
>
> 同路径允许：自盘对照（同一人两份相同盘）是有意义的用法。

- 双盘四化互参（五步法第 4 步的数据底座）：
  > 甲方四化星落乙方何宫、乙方落甲方何宫。数据两份 JSON 里本就齐备，这里只是渲染成
  > 对照，免得助手自己排两份详盘手工对星。跨盘匹配按「同名宫位」（甲方化禄星落自己
  > 夫妻宫 → 看乙方盘上同名的那座宫），与 guide 的「飞化互参」口径一致；宫名查找沿用
  > `mustPalace` 的 find 惯用形态，但找不到不抛错 —— 互参是对照表，兜底一行「未上盘」
  > 即可。
- 评分标准与完整方法论：
  > 评分标准与完整方法论是**恒定静态文本** —— 与「这一对是谁」无关，排谁的盘都是同一份，
  > 曾在此处无条件重印（实测占本命令输出 78%）。现住在 `references/synastry-guide.md`，
  > 按需读取，此处只留指针。
  >
  > ⚠️ 指针文案**不得**出现「【评分标准】」/「【完整方法论】」这两个块标题：
  >    `test/cli.test.ts` 的绊线正是盯这两个字面量，引用了就是自己踩自己。

## 七、`fortune.ts` / `cli/fortune/`：运限专题

> 运限专题模块的 re-export 面 —— 实现住在 `../fortune/`（按专题分文件）。
>
> 存在的理由与 selftest.ts 相同：它被 commands.ts 与 selftest.ts **两方**调用，
> 而 selftest 被 commands 静态引着，专题渲染若留在 cmdAnalyze 里，selftest 就测不到它
> （静态环）—— 独立成本层叶子即无环。
>
> 目录分工：`primitives.ts` 运限定位原语（流年地支 / 小限落宫 / 虚岁参数解析）·
> `sihua-helpers.ts` 四化与会照的专题共用 helper · `overview.ts` / `info.ts` /
> `pattern.ts` / `mutagen.ts` / `yearly.ts` / `decadal.ts` / `age.ts` / `focus.ts`
> 八个互不调用的专题节。
>
> **口径基准（文墨排盘 + 倪师三合派论断的混合口径）**：运限分析 = **宫位移动 +
> 三方四正 + 生年 / 流年 / 大限宫干 / 流月 / 流日 / 流时四化**。大限宫干四化是文墨排盘
> 展示口径；宫干自化与来因宫仍然不做 —— 那是飞星派禁列，见仓库根 `CLAUDE.md` 的
> 「体系口径」一节。
>
> ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核
>    与同层模块。

## 八、`cli/knowledge/`：四域合一的知识检索命令

### 8.1 `index.ts`

> `knowledge` 命令：统一知识检索 —— 四域合一（books 古籍 / stars 星曜释义 /
> tianji 天纪判语 / oracle 断语手册）。
>
> Phase 1 · KnowledgeSource 接缝：分发走 `KNOWLEDGE_SOURCES` 注册表，本文件只做
> 「查表 → 调 `search`」，不再写 `switch`（ADR-002：清单注册）。域由 `--source` 选择
> （缺省 `books`，与「classics 只搜古籍」的历史用法向后兼容）。新增域只加一个源文件 +
> 一行注册，不必改本入口。
>
> `--source books`（缺省）为古籍检索，行为与「classics 只搜古籍」的旧用法逐字兼容。
> tianji / oracle 域的实现在各自源文件内动态 import 懒加载（见 `knowledge/sources/`）。

### 8.2 `oracle.ts`

> knowledge 的 **oracle 域**：断语手册检索。由 `knowledge --source oracle` 进入
> （原独立 `oracle` 命令已并入，旧命令名不保留）。数据（`corpus/data/manual/`，
> 4.4MB 分类断语）在函数体内动态 import 懒加载。
>
> 三形态：裸（列 13 主题）/ 主题（14 星概览）/ 主题+星（分类断语全展开）。

### 8.3 `stars.ts`

> knowledge 的 **stars 域**：星曜释义。由 `knowledge --source stars` 进入
> （原独立 `stars` 命令已并入，旧命令名不保留）。数据是内核轻表
> （`STAR_DESCRIPTIONS`），静态 import 不影响启动。
>
> 裸开关（`--search` 落在参数末尾）会被解析层存成 `true`（可选值形态），先拦下指路，
> 否则 `String(true) = "true"` 被当成星名，静默产出错结果。

### 8.4 `tianji.ts`

> knowledge 的 **tianji 域**：天纪判语检索。由 `knowledge --source tianji` 进入。
> 数据（`corpus/data/tianji.ts`，392KB、1125 条）在函数体内动态 import 懒加载 ——
> 本模块被 `index.ts` 静态 import，不能让 CLI 主链路吃这份语料。
>
> 每条判语带 `[part §section @时:分:秒]` 溯源与 B 站回放直链；语料 CC BY-NC-SA 4.0。
