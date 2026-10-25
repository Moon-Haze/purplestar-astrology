# analysis —— 论断库

本篇覆盖 `scripts/analysis/`：`index.ts`（装配）· `report.ts`（第二编排层）·
`context.ts`（共享状态唯一产出点）· `grades.ts`（引文分级登记表）·
`palace-query.ts`（只读查询）· `lookups.ts`（文案查表与过滤器）·
`data.ts`（数据层）· `views/`（十一个小节）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`index.ts`：装配点与公开面

### 1.1 来源与三处口径适配

> 紫微斗数分析数据库 v3 — 倪海厦《天纪》正统口径
>
> 来源：自 reference/ziwei-samples-toolkit/lib/db-analysis.ts 拷入本仓内核。
> 拷入时做了三处口径适配（其余逐字保留）：
>
> 1. TOPIC_PALACE_NAME 改用**本项目宫名口径**（`Palace.name` 带「宫」字、
>    「仆役」→「交友宫」，见 constants.ts 的 IZTRO_TO_PROJECT_PALACE）——
>    本目录按宫名**严格等值**找宫（`palace-query.ts` 的 `getPalaceStars` 等），
>    旧口径会全部失配并静默落到「无法找到 xx」的兜底文案。
> 2. detectGeJu 内 getPalace 加「去宫字」归一化 —— 内容区散布着旧口径名
>    （如 '迁移'），归一化兜住它们，逻辑零改动。
>    ⚠️ 格局判定整体住在 `../patterns/`，而该归一化只服务于
>    **按宫名找宫**这条旧路径；新判定走地支算术（`../palace-relations` 的偏移 +
>    按 branch 取宫），不再按宫名找宫，故它连同那个 `getPalace` 一并消失。
>    本目录只剩第 1 条仍在生效。
> 3. 删除了未使用的 getYearStemIndex 导入（那是公历取模口径，仅流年可用；
>    生年四化必须用 chart.lunarInfo.yearStem，见 sihua.ts 的口径说明）。
>    ⚠️ 该导入后来因「四点五、流年」需要年干而引回，现只在 `views/yearly.ts`；
>    用途仍是那条唯一合法用途（流年干），生年四化依旧走 chart.lunarInfo.yearStem。

### 1.2 知识来源分级与引文披露

> ⚠️ 知识来源分级：
>
> - [verified] 倪师《天纪》讲稿原话（天纪 02-13 集已核对）
> - [traditional] 紫微斗数传统口诀（《紫微斗数全书》等古书，非倪师独创）
> - [methodology] 倪师体系的方法论概念（非原话摘录）
> - [suspect] 来源存疑，疑似其他流派或后人整理
>
> 以「倪海厦/倪师说」开头的引号句，部分为 traditional 口诀的风格化转述，不一定是
> 倪师《天纪》逐字原话。CLI 的 topic 命令在输出末尾固定披露此点。
> 引文主体在 `./data` 的 STAR_CONTENT_MAP，余下零星几处散在 `views/` 各节
> （如 `views/health.ts` 的疾厄论断）。

### 1.3 架构与文件分工

> 架构：
>
> - 十四主星各自的详细命理内容（12 宫语境）
> - 四化（禄权科忌）各自的语义补充
> - getTopicAnalysis：动态推算三方四正、本命四化会照、大限、流年、流月
>
> ## 本目录的文件分工
>
> 拆分的分界线是**「算」与「写」**：状态算一次（`context.ts`），文案各节自己写（`views/`）。
>
> index.ts 装配点：getTopicAnalysis 编排层 + 公开面 re-export
> report.ts 第二编排层：getTopicReport —— --report 的 Markdown 形态
> context.ts 跨节共享状态的**唯一**产出点（`makeContext`）
> palace-query.ts 只读查询：按宫名取宫 / 取三方四正 / 渲染一行星曜
> lookups.ts 文案查表 + 性别投影 + 格局投影
> views/ 十一个小节，每节一个 `renderXxx(ctx) => string[]`
>
> ⚠️ 各 view **只读 ctx、只返回自己的行**：不互相调用、不写回 ctx。唯一的跨节状态
> （`mutagenInSanFang`）已提升进 `context.ts`，理由见该文件头部。

### 1.4 `getTopicAnalysis` 的两条不要动

> 本函数是**编排层**：建一次上下文，按小节序把十一个 `renderXxx` 的行首尾相接，
> 性别已在各 view 经 `selectGender` 投影。各节的实现与口径说明在 `views/` 各文件里。
>
> 两点不要动：
>
> 1. **下面的拼接顺序即报告的小节序**（一 → 六），调整顺序会改变输出
> 2. 性别差异已在数据层拆进结构化字段（`GenderField`），各 view 经 `selectGender` 按
>    `ctx.gender` 投影，编排层不再对拼接后的整篇文本跑正则过滤

### 1.5 公开面 re-export

> 本公开面现导出 6 个值：拆分前即有的 4 个转发（TOPIC_LABEL / TOPIC_PALACE_NAME /
> getTopicReport / getTopicReportMeta）+ TOPIC_KEYS / TOPIC_DEFS（Phase 4 新增）。
>
> - 前 4 个 `./data` 是实际归属地，此处只做转发，调用方一行不用改。
>   `./report` 的两个名字（--report 全盘报告的编排层）同走这张公开面 ——
>   CLI 不直插 analysis 内部模块。
>   TOPIC_KEYS / TOPIC_DEFS（Phase 4）：主题注册表的**单一真相源**（Phase 2 收编的 8 张平行表
>   已由它派生）。上公开面是为插件自证 —— 新增主题只需在此表加一个条目，
>   外部守卫（selftest / 测试）经这里即可断言「某主题已注册且可用」，不必直插 `./data` 内部布局。

---

## 二、`report.ts`：第二编排层（`--report` 的 Markdown 形态）

> 全盘报告编排层 —— 与 {@link ./index|getTopicAnalysis} 平级的第二编排器。
>
> `--topic` 的单主题报告是终端文本形态（小节用 `【】` 加粗标记）；`astrology --report`
> 需要的是**Markdown 文档形态**，且小节流参照 html 版主题报告（总览 → 一句话定调 →
> 核心论断 → 命盘推演 → 三方四正联动 → 四化路径分析 → 命盘依据 → 经典出处 →
> 综合建议）。两者共用同一套叶子 view 与数据表，差异只在编排与排版 —— 故本模块与
> `getTopicAnalysis` 一样**只编排、不算命**：建一次 {@link makeContext} 上下文，
> 把各 `renderXxx` 的行按报告小节序拼接（性别已在各 view 经 `selectGender` 投影，
> 编排层不再做整篇过滤）。
>
> 叶子 view 的行首带着自己的 `**【小节名】**` 头，报告里改用 Markdown 标题
> （`### 三方四正联动`），故取用时经 {@link asMarkdownBlock} 装配 —— 剥掉**首个**
> 匹配头，view 内部的子块头（如疾厄节的【星曜辅助】）转成 `####` 标题：Markdown
> 文档里强调行不能充当标题，也靠它保证各标题前后有空行。
>
> 「经典出处」的引文主体在古籍库（`../../classics`，另一知识域），本模块不引它 ——
> 由 CLI 层经 {@link getTopicReportMeta} 拿到主宫主星后自查古籍、把结果从
> `options.citations` 递进来，保持「排盘内核不依赖古籍域」的分层。

### 2.1 剥头口径与「漂移要被看见」

> 剥掉**首个**头：跳过开头的空行，若第一行非空行匹配 `**【…】**` 形态则删去它与其后
> 的一个空行；view 内部的子块头（同样形态但不在行首）转成 `####` 标题并补足前后空行
> —— Markdown 文档里强调行不能当标题。空数组与无头输出按原行装配（后者说明上游
> view 改了排版，报告标题会与它自带的头并存 —— 那是应当被看见的漂移）。

### 2.2 报告小节流与两节省略

> 小节序参照 html 版主题报告：定调（引语）→ 总览 → 核心论断 → 命盘推演 →
> 三方四正联动 → 四化路径分析（含魁钺贵人）→ 当前大限 → 主题专属补充（疾厄取象 /
> 性格深描）→ 命盘依据 → 经典出处 → 综合建议。html 版另有「主辅煞组合精细论断」
> 「天纪溯源·时间码」两节，其数据不在本仓知识源内，不臆造、整体省略。

---

## 三、`context.ts`：跨节共享状态的唯一产出点

> 主题分析的共享上下文 —— 十一个小节共读的状态，在此**一次算好**。
>
> 各小节原先平铺在 `getTopicAnalysis` 一个函数体里，靠闭包共享十几个局部变量。
> 拆成 `views/` 之后闭包没了，这些变量改由本文件的 `makeContext()` 统一产出，
> 于是每个 `renderXxx` 都退化成「读 ctx → 返回若干行」的纯函数。
>
> ⚠️ **这里故意多算一样东西**：`mutagenInSanFang`（三方四正范围内的本命四化）。
> 它原本在「三、本命四化会照」小节现算，又被「三点五、年干四化」读去做去重集合 ——
> 是全篇**唯一一条真实的跨小节依赖**。若留在 `views/mutagen.ts` 里现算，
> `views/year-stem.ts` 就无从判断哪些四化已经报过，会把三方四正内已展示的
> **再报一遍**。提到这里算一次，两节共读同一份结果。

### 3.1 `AnalysisContext` 不含 `lines`

> 全部字段由 {@link makeContext} 一次算好，各 `renderXxx(ctx)` 只读不写 ——
> 唯一例外是各节**自己产出的输出行**（各自 `return string[]`，由 `index.ts` 拼接），
> 故 ctx 内不含 `lines`。

### 3.2 `makeContext` 的缺省值与纯度

> 缺省值刻意**保持与拆分前逐字一致**：`view` 缺省 `"mingpan"`、流年取系统当前年、
> 流月取系统当前月、大限下标取 `chart.currentDecadalIndex`。它们读的是 `new Date()`，
> 故本函数是 `analysis/` 里唯一一处非纯函数（只影响缺省，不影响给定 options 的调用）。

---

## 四、`grades.ts`：倪师引句的知识分级登记表

> 主题论断库（data.ts）倪师引句的知识分级登记表。
>
> 引句嵌在 data.ts 的长文案字符串内（非独立条目），故分级以**登记表**承载：
> `quote` 是引句「」内前 12 字的定位串，selftest 对「文案中的引句 ↔ 本表」做
> 双向匹配——文案新增引句未登记、或登记的 quote 与文案失配，都会变红。
> 档位判定规则（与评估报告一致）：
>
> - `verified`：引句带《天纪》集数出处（如「天纪 03 明言」）；
> - `traditional`：古诀云 / 古书云 / 口诀 / 无出处的倪师转述（默认档）；
> - `suspect`：原文案已带「未核实 / 来源存疑 / 一说非倪师原话」散注；
> - `methodology`：描述推算方法而非断语的引句。
>
> 实测口径：评估报告基线 28 处标记（行号 85…862）经机检正则全量复核后
> 共抽出 52 条引句——文案中除「倪海厦说 / 言 / 描述 / 明言」外，还有「倪师评 /
> 明言 / 警示 / 天纪 03 言」「倪海厦提醒 / 将…列为 / 体系中…代表」以及英文双引号
> 引文等形态，且同句常在多字段重复出现（每处各登记一条）。本表覆盖全部 52 条，
> 行号注释即 data.ts 中的定位（以评估报告行号清单为基础扩充）。

⚠️ 本表与引文守卫的关系：`ANNOTATIONS` 核对表口径见 [README.md](README.md) 的引文软纪律 ——
出现「倪师…说」形态必须在此登记档位，**占位或自撰内容绝不可挂倪师引语**（属伪造引文）。

---

## 五、`palace-query.ts`：只读查询层

> 宫位查询 —— 按宫名取宫、按宫取三方四正、把宫里的星曜渲染成一行文字。
>
> 本文件是 `analysis/` 的**只读查询层**：四个函数都只读 `ZiweiChart`，不持有状态、
> 不产生输出行，被 `context.ts` 与 `views/` 各节共用。`descPalaceStars` 被 4 处共用
> （三方四正联动 / 当前大限 / 流年 / 流月），故与 `getSanFangSiZheng` 同处一层。
>
> ⚠️ **宫名一律按 `Palace.name` 严格等值匹配**（带「宫」字、「仆役」→「交友宫」）。
> 传旧口径名（`迁移`、`仆役`）会直接找不到宫，并静默落到调用方的兜底文案 ——
> 这是本模块从上游 toolkit 拷入时做的第 1 处口径适配，理由见 `index.ts` 的文件头。

---

## 六、`lookups.ts`：文案查表与性别投影、格局投影

> 文案查表与性别投影、格局投影 —— 把「星 × 宫 × 四化」翻成文案。
>
> 本文件与 `palace-query.ts` 同层，区别在于**它读的是 `./data` 的表**：
> `getMutagenNote` 查四化语义、`getMinorStarNote` 查次星宫位文案、`detectGeJu` 取格局判词。
> 都不产生输出行，被 `views/` 各节调用。
>
> `selectGender` 是唯一一个不查表的：它把 `string | GenderField` 按 `gender` 投影为
> 当前性别的文本（`common + (male|female) + suffix`），供 `views/` 各节调用。

### 6.1 `detectGeJu` 只是投影

> 格局的**命中事实层 + 两套判词**如今都归 `patterns/`：
>
> - 判定（唯一一处）：`detectPatterns`，82 个格局各有独立预言机盯着
> - analyze 侧短判词 + 等级：`Pattern.description` / `Pattern.level`
> - topic 侧倪师口吻长判词：`Pattern.topicDescription`
>
> 本函数只是**投影**：把填了长判词的命中挑出来，供 `overview` / `personality` 展示。
> **新增格局只要在 patterns/ 的识别器里填 `topicDescription`，这边自动就能展示**，
> 不会有「判定加了、判词忘了补、topic 静默不显示」的漏。
>
> 展示顺序**按 level 降序**（同级保持识别器注册序）。

---

## 七、`data.ts`：数据层

### 7.1 模块定位与「依赖：无」约束

> 分析数据库的数据层 —— 类型、映射表与论断文案。
>
> 本模块只放「是什么」，不放「怎么算」：主题键与标签、星曜简述、宫位与脏腑的对应、
> 紫微诸星安放表、魁钺贵人表、十四主星以外的星曜落宫文案、主题与宫位的对应关系、
> topic 报告的展示映射与【综合建议】文案，以及 STAR_CONTENT_MAP（十四主星 × 12 宫语境的
> 论断文案）。推算逻辑在 `./index`。
>
> 依赖：无（内部不引用 BRANCHES / STEMS，故本模块可独立成型）

### 7.2 `TOPIC_KEYS` 的两个消费者

> 主题键 —— 运行时**主题注册表**的唯一定义处。{@link TopicKey} 由它推出。
>
> 此前内核与 `tools/db/db.ts` 各写一份，只靠注释提醒不得漂移；合到一处后「同名同序」
> 由类型系统保证 —— `tools/db/db.ts` 只转出该常量。
>
> ⚠️ **它有两个消费者，角色不同，Phase 4 起显式分开**（此前两者被混为一谈，
> 加一个主题会让数据集查询整体报 `column not found`）：
>
> 1. **运行时注册表**（本数组全部元素）—— 主题元数据派生表、CLI `--topic` 分发、
>    oracle 域主题清单、测试断言。新增主题在此加一项即可。
> 2. **数据集物理列**（只有 {@link STORAGE_TOPIC_KEYS}）—— `topics` 表是**每主题一列**，
>    而**别名视图主题无独立列**（见 {@link TOPIC_CONTENT_SOURCE}）。所有拼 SQL 遍历
>    列的地方必须走 `STORAGE_TOPIC_KEYS`，不能走本数组。
>
> ⚠️ 对 {@link STORAGE_TOPIC_KEYS} 而言，**增删顺序等于改存储格式**：已入库的 parquet
> 会与新代码的列对不上，要改必须同时重建数据集（`npm run build:db`）。

### 7.3 主题定义：8 张平行表收为单一真相源

> 原 8 张平行 `TOPIC_*` 表（palace / label / sanFang / contentKey / summaryKey /
> keyPalaces / suggestions + `SUMMARY_TOPICS`）统一收进 `TOPIC_DEFS`，下方 8 张具名表
> 改为由它派生。**加一个主题 = 只在 TOPIC_DEFS 加一个条目**（断语内容仍走
> `corpus/data/manual/` 生成管线 + `LOADERS` 注册表）。
>
> ⚠️ 与执行计划 §4 的偏差：计划假设 `analysis/data.ts` 存在 `switch(topic)` 分支、可
> 抽成 13 个 `TopicProvider` 文件；实际代码早已数据驱动（`getTopicAnalysis` 是统一管线
>
> - 查表），`corpus/data/manual/index.ts` 的 `LOADERS` 已是内容注册表。故 Phase 2 不造
>   13 个 case 文件（那是纯碎片、且会把主题定义拆到两处），改为把 8 张平行表收为单一真相源
>   —— 这才是真正的扩展摩擦点。`TopicProvider` 之名保留为 `TopicDef` 的类型别名。

### 7.4 `TOPIC_CONTENT_SOURCE`：内容复用即无独立列

> 并非每个注册主题都自带新内容：`contentKey` 就是**内容复用**的声明（`study` 复用
> `career` 的 `guanLu` —— 学业在紫微属官禄/文昌体系，主星内容本就同源）。
> 复用即同一份内容，故它**没有独立的存储列**，也不该有。
>
> 此前这个区分不存在：`TOPIC_KEYS` 同时当「注册表」与「列清单」用，加一个别名视图
> 主题会让所有拼 SQL 的地方（数据集检索宏、导出、校验）报 `column not found`。
> 现在两个角色各自有常量（{@link STORAGE_TOPIC_KEYS} 是列侧），别名视图与
> 「独立新内容」两种扩展形态被显式区分。

### 7.5 `STORAGE_TOPIC_KEYS`：列侧唯一入口

> **数据集 `topics` 表的物理列集合**（顺序即列序）—— 内容源去重后的主题序列。
>
> ⚠️ 所有拼 SQL、按列取值的地方必须用它，**不能**用 {@link TOPIC_KEYS}：
> 后者含无独立列的别名视图主题（如 `study`），用它会让查询报 `column not found`。
> 反之，运行时注册表语义（主题清单、CLI 分发）用 {@link TOPIC_KEYS}。

### 7.6 展示映射收归与四化键的字面量联合

> 以下常量原为 `./index` 的 `getTopicAnalysis` **函数体内联字面量** —— 一次调用重建
> 一份。其中 `SIHUA_SYMBOL` 与 `SIHUA_CHAR_TO_KEY` 更各有一处**逐字相同的副本**
> （大限段与流年段各写一遍），改了其中一处不会有任何东西发现。按本模块「类型 + 映射表
>
> - 论断文案」的定位收归于此，`./index` 只留推算。
>
> ⚠️ 四化键一律写成**字面量联合**而非引 `../types` 的 `Mutagen`：本模块开篇声明的
> 「依赖：无」是条被人依赖的约束（可独立成型、可单测），为一张映射表破例不值当。

---

## 八、`views/`：十一个小节

### 8.1 共同纪律

各节 `renderXxx(ctx)` **只读 ctx、只返回自己的行**：不互相调用、不写回 ctx；
唯一的跨节状态（`mutagenInSanFang`）由 `context.ts` 一次算好（见本篇第三章）。
小节序由 `index.ts` / `report.ts` 的编排层决定，调整顺序会改变输出。

### 8.2 `overview.ts`：一、总论（总-分结构）

> 结构是「动态优先、静态兜底」：先出**命盘关键定制**（按本宫主星的亮度 / 四化从
> `profile.topic_mods` 里取的专属开场）与**命盘特殊格局**（仅 overview / personality），
> 再出静态白话总论（`profile.summary`，personality 段跳过以免与 overview 雷同），
> 最后是本宫主星说明与星曜详解。
>
> 主宫无主星时整节退化成一句兜底提示 —— 注意此时 `ctx.mainStars` 可能仍非空
> （借自对宫），但 `ctx.profile` 为 `null`，故 `if (primaryStar && profile)` 两侧
> 会一并落到 `else`。

### 8.3 `surround.ts`：二、三方四正联动分析

> 本宫只出一行星曜概要（详解已在「一、总论」给过），其余三宫各按 `sanFangLabels`
> 的顺序取标签，逐颗主星展开：有该宫语境的完整段落就整段给，没有就退化成一句简述
> 加四化补充。空宫则借对宫论事（与 `palace-query.ts` 的 `getPalaceStars` 同一口径，
> 但这里只是**列名**，不参与后续论断）。
>
> 每宫末尾另附次星（六吉 + 禄存 + 天马，即 `type === "soft"`）的深度文案。

### 8.4 `mutagen.ts`：三、本命四化会照

> 只负责**展示**：那份 `mutagenInSanFang` 由 `context.ts` 的 `makeContext()` 算好
> （因为「三点五、年干四化」要拿它做去重集合，见 `context.ts` 文件头）。
> 一条都没有时给一段中性判语，而不是留空。

### 8.5 `year-stem.ts`：三点五、年干四化·全局关键宫位解读

> 「三、本命四化会照」只看三方四正；本节的职责是**补齐其余宫位里、对本主题有意义的**
> 那几条：拿 `TOPIC_KEY_PALACES[topic]` 给出的关键宫位清单，去全盘四化里筛，
> 再**去掉三方四正已展示过的** —— 去重集就来自 `ctx.mutagenInSanFang`（跨小节依赖，
> 见 `context.ts` 文件头）。
>
> 一条都没剩时整节不输出（连标题都不出），这与「三」的「留一段中性判语」不同：
> 这里没内容是**正常**的，不值得占版面。

### 8.6 `decadal.ts`：四、当前大限分析

> 核心口径写在节内的那句引文里：**四化星永远固定不动，大限只看走到哪个宫位**，
> 再看该宫三方四正会照了哪几颗**本命**四化 —— 而**不是**按宫干重新起化
> （宫干自化 / 大限四化取宫干属飞星派，本项目已主动下线，见仓库根 `CLAUDE.md`
> 的「体系口径」一节）。改本节时不要顺手加回按宫干起化的逻辑。
>
> 大限宫为空宫时借对宫论事，与 `palace-query.ts` 的空宫口径一致。

### 8.7 `yearly.ts`：四点五、流年 + 四点六、流月

> 两节合在一个文件里，因为它们共用同一个起点：**流年地支**。原实现在流年段与流月段
> 各算了一遍 `(((liunianYear - 4) % 12) + 12) % 12`，此处单点为一个局部常量。
>
> 口径与「四、当前大限」同源：**流年只看年支移到哪个本命宫位、月支再移一格**，
> 本命四化星固定不动，看流年/流月三方四正会哪几颗 —— 不按年柱、月柱重新起化。
>
> 两节的触发条件不同：流年段在 `view` 为 `liunian` 或 `liuyue` 时出，
> 流月段只在 `view === "liuyue"` 时出；其余视角（mingpan / daxian）两节都不出。

⚠️ `getYearStemIndex` 是**公历年取模**口径，本层只用于流年干（唯一合法用途）；
生年四化必须用 `chart.lunarInfo.yearStem` —— 两口径在 1-2 月出生者身上分叉，
见 `mutagen.ts`（sihua.ts）的口径说明与 `test/cli.test.ts` 的「生年四化的年干口径」。

### 8.8 `personality.ts`：五、性格专属补充

> 只有一段 `profile.personality`。之所以与「一、总论」分开：总论里的
> **星曜深层特质**（`profile.summary`）在 personality 主题下**刻意跳过**
> （它取的是 overview 那一段，两节同出会雷同），这块性格深描就是它的替代。

### 8.9 `health.ts`：五点五、疾厄宫

> 三层结构，权重递减：
>
> 1. **宫位主轴**（`PALACE_BRANCH_ORGAN`）—— 疾厄宫落在哪个地支，这是倪师原法
> 2. **星曜辅助**（`ZIWU_LIUZHU`）—— 主星五行的加重 / 减轻提示，只作附加
> 3. **警示**—— 四煞入疾厄、三方四正见化忌、女命妇科保养
>
> ⚠️ 倪师《天纪 05》原话明示：
>
> - 化忌在酉宫 = 肾
> - 火星地空在丑宫 = 肝
> - 头肩胸区域 = 妇科子宫 / 右卵巢
>
> 倪师疾厄论断**以疾厄宫落在哪个地支为主轴**，星曜五行为辅。
> 这与「按星曜五行对应脏腑」的做法不同——后者是传统三合派用法。
>
> 该映射表本身在 `../data` 的 `PALACE_BRANCH_ORGAN`，本函数是它的**唯一使用点**。

### 8.10 `patron.ts`：五点六、魁钺贵人倾向细分

> 天魁、天钺在**哪一宫**，就取 `KUI_YUE_GUIREN_MAP` 里该宫的断语。与本主题的宫位
> 无关，故四个主题共用同一段内容 —— 出与不出由上面的主题清单决定，内容不变。
>
> 两星都没有（或所在宫无断语）时整节不出。

### 8.11 `suggestions.ts`：六、综合建议

> 唯一不判条件的小节：`TOPIC_SUGGESTIONS[topic]` 的建议清单 + 一句固定的
> 「继续深度追问」引导语。它保证报告末尾总有一个可交互的落点 ——
> 故不要在别处加「有内容才出」的条件。

## 九、`soul-summary.ts`：命宫摘要（⚠️ 不得改签名）

> 命宫摘要 —— 命宫主星的简要概括：星名、关键词、星性。
>
> 与格局判定**零耦合**：不调用任何查询函数，`keywordMap` / `natureMap` 两张映射表
> 直接写在文件里 —— 不判条件、只做映射，属纯文案层，故住 `analysis/`（自
> `patterns/soul-summary.ts` 迁入：纯文案内容不住格局判定目录）。
>
> 「保持向后兼容」：`cli/commands/astrology.ts` 的 `mingGongSummary`（文本与
> `--json`）至今按原样取用，**签名与返回结构不得改动**。

## 十、`overview-material.ts`：总览取材与星曜徽标单点

> 「总览段取什么材」的唯一实现：`buildOverviewMaterial(ctx)` 一次取齐七个决策点
> （核心主题判定 / topic_mods 双键注入 / 格局主题清单 / summary 段条件 /
> contentKey 全文选择 / 亮度补充 / 第二主星），返回结构化段落；两个编排器
> （`views/overview.ts` 的【】版式与 `report.ts` 的 ### 版式）只做版式装配。
>
> `starBadge` 是星曜徽标（星名 + 化象 + `（庙旺）/（落陷）` 全角括号）的全仓单点，
> `palace-query.ts` 的 `descPalaceStars` 同式引它。
> 原先两编排器各写一遍取材、徽标两式并存、兜底句两份措辞——均已收敛
> （architecture-review-20261016 候选 1）。
