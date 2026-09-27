# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

一个 **Claude Code skill 项目**：紫微斗数排盘与解读。仓库根就是 skill 根（`SKILL.md` 所在目录），自包含 `scripts/`（CLI + 排盘内核）与 `package.json` 依赖。

关键含义：**`SKILL.md` 不是文档，是可执行的行为规范**——Claude 读它来决定如何排盘与解读。改 `SKILL.md` 等于改这个 skill 的行为。

## 命令

没有构建、没有 lint（`typecheck` 是类型检查，不是 lint），排盘与解读全部经由 CLI 入口（`npm test` 只跑测试，不参与运行）：

```bash
npm install        # 装依赖（iztro / lunar-typescript）

# 主力命令：命盘 + 十二宫 + 格局 + 四化 + 大限，解读所需数据一次给全
node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male

node scripts/purple-star.ts heming --a-date <...> --b-date <...>   # 合盘
node scripts/purple-star.ts classics --search 机月同梁              # 古籍原文检索
node scripts/purple-star.ts help                                   # 全部命令与参数

# 第一层：CLI 自带自检，整体执行，不支持筛选单项（项数由末行自报）
node scripts/purple-star.ts selftest

# 第二层：基准回归，用 toolkit 的 518,400 条样本对标排盘结果（默认跑 300 条抽样，约 8 秒）
npm test
npm run test:corpus -- --year 1960    # 全量核验（需 reference/ 存在，不入日常回归）

# 类型检查：必须 0 错误。运行不依赖它（Node 直接擦类型），改过类型就该跑
npm run typecheck
```

**改过内核或升级 `iztro` 之后，两层都要跑；动过 `.ts` 的类型标注，`npm run typecheck` 也要跑。** `selftest` 测「代码逻辑自洽」，覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、性别护栏、排盘不变量、三合派体系约束、知识源可用性；`npm test` 是**外部基准比对**，用 300 条真实盘逐字段对标，能抓住 `selftest` 那几条固定样例漏掉的行为漂移。测试的性质与效力边界见 [test/README.md](../test/README.md)。

三者分工不同，谁都替代不了谁：`typecheck` 只看类型**自洽**，不看类型**标得对不对**——把 `Star` 写成 `any` 它一样全绿，所以我们**不用 `any` 绕过报错**。

## 架构

### 数据流

```text
<skill 根>/
└── scripts/                       ← 内核根：CLI 与内核同处一层
    ├── purple-star.ts            引导层：定位内核根 → 注册 TS 钩子 → 启动自检 → 分发命令
    ├── boot-hooks.ts             引导**机制**（内核根定位 / 解析钩子 / 动态加载），CLI 与 test/ 共用
    │                             只 import node: 内置 —— 故可在钩子注册前被静态 import
    ├── cli/args.ts               参数面：旗标声明表 FLAG_GROUPS + 校验 + cac 驱动的解析
    │                             （纯函数，唯一不依赖内核的 CLI 模块）
    ├── cli/birth-info.ts         出生信息（真太阳时 / 农历 / 城市容错）
    ├── cli/birth-info-defs.ts    出生信息层的声明：接口与常量（公开面由上层 re-export）
    ├── cli/render.ts             命盘渲染（宫位 / 星曜 / 四化 / 宫名口径）
    ├── cli/commands.ts           七个命令实现 + COMMANDS 表
    ├── cli/selftest.ts           回归断言（项数由末行自报）
    ├── ziwei/algorithm.ts        iztro 排盘主流程
    ├── ziwei/patterns/           格局层（文件夹模块）：装配 + 形状 / 数据 / 底座 / 各分组识别器
    │                             index.ts 装配 detectPatterns；types.ts 形状；data.ts 常量与
    │                             名字裁决表 + 两套判词（description / topicDescription）；
    │                             helpers.ts 宫位星曜查询；<分组>-ge.ts 各分组识别器；
    │                             ming-gong-summary.ts 命宫摘要（与判定零耦合）
    ├── ziwei/sihua.ts            四化（生年 / 流年 / 流月）
    ├── ziwei/analysis/           分析数据库 v3（文件夹模块）：编排 + 上下文 / 查询 / 查表 / 各节
    │                             index.ts 编排 getTopicAnalysis；context.ts 跨节共享状态；
    │                             palace-query.ts 按宫名取宫 / 三方四正 / 渲染星曜；
    │                             lookups.ts 文案查表 + 性别过滤 + 格局投影（薄壳：从
    │                             detectPatterns 挑出填了 topicDescription 的命中）；
    │                             views/ 十一个小节，各一个 renderXxx(ctx)
    ├── ziwei/analysis-data.ts    分析数据库 v3 的数据层：类型 + 映射表 + 论断文案
    │                             （STAR_CONTENT_MAP：十四主星 × 12 宫语境）
    ├── ziwei/annotations.ts      「倪师引用」文献核对记录（selftest 锁 suspect 零强归属）
    ├── ziwei/citation-guard.ts   引文守卫：扫内核全树核对「倪师说」引文（selftest 与层 6 共用）
    ├── ziwei/heming-knowledge.ts 合盘方法论 + 夫妻宫断语
    ├── ziwei/constants.ts        天干地支 / 四化表 / 星曜释义
    ├── ziwei/palace-relations.ts 宫位关系（对宫 / 三方四正）的偏移单点，零依赖
    ├── ziwei/cities.ts           中国城市经纬度（真太阳时校正用）
    ├── ziwei/types.ts            内核类型；含两条刻意保留的「绊线」字段（见「体系硬约束」）
    └── classics/                 三部古籍原文检索
```

`cli/` 之间是**单向依赖**，没有环：`args` ← `render`（仅取 `fmtDate`）← `birth-info` ← `commands` → `selftest`。要动哪一层，往上找它的消费者即可。

### 为什么能直接跑 TypeScript（没有构建步骤）

`scripts/purple-star.ts` 用 Node ≥ 22.15 的 `module.registerHooks` 注册了解析钩子（见文件开头的 `registerHooks({...})`）：

- `@/xxx` → 解析到 `<内核根>/xxx`，自动补 `.ts` 或 `/index.ts`。**内核根是 `scripts/` 而非 skill 根**，所以 `@/ziwei/algorithm` = `scripts/ziwei/algorithm.ts`
- **`.` 相对说明符** → 同一条候选序：先补 `.ts`，再兜底 `<spec>/index.ts`。故内核里引**文件夹模块**时 `./patterns` 与 `@/ziwei/patterns` 等价，不必写显式 `/index`
- **裸包名**（`iztro`、`lunar-typescript`）→ 自内核根向上查找 `node_modules` 解析，而非 cwd 或文件所在位置

⚠️ 两条分支的候选序**必须一致**，这不是洁癖：它们分叉过一次，症状是 **`npm run typecheck` 全绿而运行时崩**——`tsconfig.json` 的 `moduleResolution: "bundler"` 会把 `./patterns` 正常解析到 `patterns/index.ts`，只有真的跑起来才会 `ERR_UNSUPPORTED_DIR_IMPORT`。`test/repo.test.ts` 的层 6 有一组断言用桩 `nextResolve` 钉死这条候选序（含「`.ts` 优先于同名目录」的反向一条）。

因此脚本可从**任意 cwd** 运行，**运行**既不需要构建步骤，也不需要 `tsconfig.json`。

仓库里确实有一份 `tsconfig.json`，但它只服务于**类型检查**（`npx tsc --noEmit`），不参与运行：

- `module: "preserve"` + `moduleResolution: "bundler"` —— 内核 import 不带扩展名，别的组合解析不了
- `strict` 全开；`types: ["node"]` **不可省**，TS 7 不会自动加载 `@types/*`，去掉会凭空冒出几十条 `Cannot find name 'process'`
- `paths` 里的 `@/*` 只映到 `./scripts/*`，与 CLI 运行期的别名同义

内核 `*.ts` 内部一律用相对路径 import，不使用 `@/` 别名。`scripts/cli/` 下分两种写法，别混：**引内核用 `@/`**（`@/ziwei/types`），**引同层兄弟模块用相对路径且不带扩展名**（`./args`）——后者靠上面钩子的 `.` 分支补 `.ts`，`moduleResolution: "bundler"` 也认这种写法。

### CLI 如何既自举又拿到内核类型

这是 `purple-star.ts` 里最容易被改坏的一处。CLI 必须在**求值之前**注册解析钩子，而 ESM 的静态 `import` 会被提升到模块求值之前——若用普通 `import` 引内核，钩子还没注册、内核的 `.ts` 就已经要加载了。

解法是**类型走静态、值走动态**：

- `import type { ZiweiChart, Palace, Star } from "@/ziwei/types"` —— `import type` 与 `typeof import("...")` 在运行时被**完全擦除**，不产生任何静态依赖，故可以安全地写在文件顶部
- 所有内核模块用 `await load<XxxModule>("@/ziwei/...")` 动态导入（`load<T>(spec): Promise<T>` 把 `await import()` 的 `any` 收窄回内核真实签名）

**⚠️ 拆分之后，这条约束的作用域扩到了子模块**：`scripts/cli/*` 自己静态 import 内核，所以从引导层静态 import 它们，等于绕道提前加载内核，一样会崩。**引导层里除 `node:` 内置模块与 `boot-hooks.ts` 外，不允许出现任何普通静态 import**——要分发命令就走 `await load<CommandsModule>("@/cli/commands")`。

**唯一的例外是 `scripts/boot-hooks.ts`**（内核根定位 / 解析钩子 / 动态加载的共享实现，CLI 与 `test/lib/loader.ts` 共用同一份）。它成立的理由不是「我们信任它」，而是**可证的**：它只 import `node:` 内置，调用点又写全了 `.ts` 扩展名，于是 Node 的原生类型擦除就能加载它，全程不触碰钩子。`selftest` 有一条断言盯着这条约束——越界有两种形态，**只有省略扩展名的那种会自己崩**（ERR_MODULE_NOT_FOUND），写全扩展名的会照常跑通，那条断言守的正是后者。

反过来说，`scripts/cli/` **内部**用普通静态 `import` 是对的、也是推荐的：它们只在 `registerHooks` 跑完之后才被加载，静态 import 反而是最清晰的写法。别把两层的规则搞反。

**因此：给内核加类型只需加 `import type`，绝不要为了「省事」把某个内核模块或 `cli/` 子模块改成引导层的普通静态 `import`** —— 那会让 CLI 在注册钩子前就崩掉。同理，`ROOT` 在模块顶层用 `const ROOT: string = picked.root` 显式收窄：CFA 的收窄不跨函数边界，`load()` 的错误分支里要用 `ROOT`。

### selftest 怎么拿到内核根

`cli/` 子模块是被动态加载的，拿不到引导层的 `ROOT` 局部变量，所以引导层把 `{ root, ROOT_LABEL }` 打包成 `CliContext` 传给 `cmdSelftest`。`COMMANDS` 的函数签名因此统一是 `(args: CliArgs, ctx: CliContext) => string`——TS 允许参数更少的函数赋给它，所以 `analyze: cmdAnalyze` 这类写法不用改，只有 selftest 那项写成 `(_args, ctx) => cmdSelftest(ctx)`。

### ROOT 如何确定

`pickRoot()`（在 `scripts/boot-hooks.ts`，CLI 与 `test/lib/loader.ts` 共用）两级优先级：`ZIWEI_ROOT` 环境变量 → 脚本自身所在目录（即 `scripts/`）。判定依据是「该目录下存在 `ziwei/algorithm.ts`」，而非目录本身是否存在。

刻意**没有**「宿主项目」候选——仓库内只有一份内核（就在 `scripts/` 下），不存在「实时内核 vs 分发副本」的双模式。

**候选表由调用方给，判定规则在共享模块**：CLI 的起点是脚本自身所在目录，测试的起点是 `<skill 根>/scripts`，两者不同；而「怎样算命中」只有一份实现。同一个 seam 上还挂着加载失败的处理策略（CLI 渲染指引后退出进程、测试抛错），也由调用方以 `onFailure` 传入——这正是「机制共用、策略各异」的分界，也是这份实现不必再存副本的理由。

### 三处启动期防御

1. **`REQUIRED_EXPORTS` 自检**：模块加载后立刻校验 14 个关键导出，缺任何一个直接退出。设计意图是**宁可启动失败，也不静默产出错盘**——所以在内核里重命名或删除导出会让 CLI 立刻报错，这是有意的，不是脆弱。
2. **`selftest`**：CLI 自带的回归断言，整体执行。
3. **`npm test`**：`test/` 下的基准回归，用 toolkit 样本对标排盘结果（默认 300 条抽样，约 8 秒）。失效的基准是负债而非保障 —— 见 [test/README.md](../test/README.md) 的「升级 iztro 的流程」。

## 体系硬约束：三合派，不是飞星派

本项目严格遵循倪海夏《天纪》三合派。以下飞星派工具被**主动下线**，不得使用：

- ❌ **宫干自化** —— `algorithm.ts` 已停止填充 `Palace.selfSihua`
- ❌ **大限四化取宫干** —— 已停止生成 `daXians[].siHua` / `stemIndex`
- ❌ **来因宫**

⚠️ **最容易踩的坑**：`scripts/ziwei/sihua.ts` 现只导出三层四化（`getSiHuaByStem` / `getYearStemIndex` / `getLiuNianSiHua` / `getLiuYueStemIndex` / `getLiuYueSiHua`）。飞星派的 `detectSelfSihua` / `findIncomingPalaces` / `getDaXianSiHua` / `buildAllSelfSihua` / `buildOverlayForStar` 等函数已于 2026-09-27 删除——全仓（含 `cli/`、`test/`、`tools/`）零调用点，按删除测试该消失。删除后红线不再靠「存在不等于该用」的自律维持，而是**不存在**。

⚠️ **但 `types.ts` 的绊线刻意保留**：`Palace.selfSihua` / `DaXian.siHua` 字段与 `SelfSihuaMark` / `DaXianSiHua` 类型仍在，因为断言要盯的正是「有没有被填回」——字段删了就无从盯起。`selftest` 与 `test/school.test.ts` 各有一条断言守着。**要删这两个字段，先读 `types.ts` 里紧挨着它们的说明。**

## 内核的来源

内核提取自上游开源项目 `ziwei-master`（未发布到 npm），**在本项目内独立演化**——改内核直接改 `scripts/` 下的对应文件，不存在需要同步的副本。线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/` 不在其中。

## 依赖变更的后果

`iztro` 是排盘引擎，**升级它会改变排盘结果**。`package-lock.json` 已提交以锁定精确版本（iztro 2.6.1 / lunar-typescript 1.8.6）。动过依赖后先跑 `selftest` **与 `npm test`** 再交付解读。

基准样本是 iztro **2.5.8** 拍的快照，与本项目的 2.6.1 有且仅有两处已知差异（太阳/太阴在酉宫的亮度，见 `test/lib/compare.ts` 的白名单）。升级 iztro 后若出现白名单之外的差异，`npm test` 会变红——**这是要你显式审阅行为变化的信号，不是测试该修的 bug**。流程见 [test/README.md](../test/README.md)。

## SKILL.md 与 CLI 的耦合

`SKILL.md` 描述的命令、参数、输出结构必须与 CLI 的实际行为一致，否则 Claude 会照着过时的说明调用。改 CLI 的参数名或输出格式时，同步改 `SKILL.md`。

容易漂移的几处：命令路径（文档统一写 `node scripts/purple-star.ts`，相对 skill 根）、`scripts/` 下内核与 `scripts/cli/` 的文件数与体积。**文档里引用 CLI 代码位置时优先写模块名而非行号**——`cli/` 拆过一次，行号是漂移最快的东西（`test/lib/loader.ts` 的注释已按此改）。

**计数类事实一律不写死**（2026-09-27）：`selftest` 的断言数、`npm test` 的项数、测试层数，这类「可核对但随时会变」的数字**不得出现在任何文档里**——它们改一次要人工同步八处，而漂移了没有任何东西会发现（`docs/test/README.md` 里那行「断言数变动史：33 → … → 493」就是这套做法的成本账单）。改为三种处置：**能自报的自报**（`selftest` 首行打印「通过 N/N」，文档写「跑一次看输出」）、**能派生的派生**（HELP 的参数段与命令段）、**既不能自报也不能派生的，由断言盯双向一致**（`test/repo.test.ts` 断言 `test/` 下的测试文件与 `test/README.md` 的层表双向一致）。要写「层数」「项数」时，改写这句本身，而不是改数字。

参数解析在 `cli/args.ts`，出生信息在 `cli/birth-info.ts`，输出格式在 `cli/render.ts`——下面这些「非常规设计」多数落在 `birth-info.ts` 与 `commands.ts`：

**参数面单点声明**：`cli/args.ts` 的 `FLAG_GROUPS` 是「有哪些旗标」的唯一来源——cac 据它注册选项并渲染 help 的参数段，`parseArgs` 据它拒绝未知旗标，命令段由 `commands.ts` 的 `COMMAND_DESC` 逐个交给 cac 的 `cli.command()`，`selftest` 再断言 `SKILL.md` 提到的旗标都有声明。**加旗标只改声明表一处**。此前这三处各有一份手写副本，漂移代价不对称：拼错旗标（`--ctiy 喀什`）不报错，直接落回默认经度 120°E，排出一张错约 3 个时辰的盘而全程无提示。同理，`a-` / `b-` 前缀旗标只有 `heming` 认，写在别的命令上会被整个忽略——现在也会报错。

**分词交给 cac，校验仍自己做**（2026-09-27）：`parseArgs` 是「前置扫描 → `cac` 分词 → 归一」三步。之所以不能只留中间那步——cac 对**未注册的选项静默收下**（连 `run: false` 也不校验），而上面那个错盘入口正是「拼错旗标不报错」。另外三条约束，改动时别踩：

- **键名是 camelCase**（`--late-zi` → `lateZi`、`--a-date` → `aDate`），换算是 `camelKey()` 一处；`FLAG_GROUPS` 里的 `name` 仍写 kebab（它同时是用户敲的名字、help 显示名、`SKILL.md` 写的名字）。按 camelCase 错的键读不到值会**静默落回默认值**，与拼错旗标同一种失败。
- **不能用 cac 的 `default`**：设了之后未出现的参数也会进 `options`，破坏调用方「`undefined` 即未给出」的判空（`cmdClassics` 的 `--limit` 就靠它取默认 15）。
- **`cac` 的静态 import 只能待在 `cli/` 层**（现在在 `args.ts`）：引导层除 `node:` 与 `boot-hooks.ts` 外不允许普通静态 import，把 cac 搬过去会让 CLI 在注册钩子前就崩。

CLI 里有几个**刻意的非常规设计**，改动时别当成 bug：

- **晚子时**：23:00–23:59 出生，两种口径排出的是两张不同的盘（不是微调）。`--late-zi` 切换口径，`analyze` 会自动输出两盘差异对照
- **`--liunian` 不是 `--year`** —— 后者是出生年的回退参数，同时使用会撞车
- **`chart.palaces` 按地支数组序排**——`branch` 序列实测为 `2,3,…,11,0,1`（寅起），既不是 0-11（子起）也不是宫位顺序。比对或展示时请按 `branch` 建索引，不要依赖数组下标
- **真太阳时默认不含均时差**：默认只做 `(经度−120)×4` 的**经度校正**（传统排盘口径），加 `--eot` 才额外计入**均时差**得到天文学严格值。这**不是漏算**——均时差可达 ±16 分，足以改变时辰判定（实测北京全年约 5% 的出生时间受影响），故做成显式开关而非静默启用。`calcTrueSolar` 的判定一律用未取整的偏移量，展示值则是分项取整后相加，为的是让提示里的「经度 A + 均时差 B = C」自洽
- **真太阳时跨午夜时日期跟着走**：`calcTrueSolar` 返回 `dayOffset`（未取整判定），调用点用 `shiftDate` 调整 `info` 的年月日。日期是单点流入 `info` 的，下游（农历、排盘、合盘、流年）自动跟随，**无需逐处改**。这是修正而非可选项——只换时辰不换日期，排出的「日 + 时」指向的不是出生时刻（喀什 00:30 的真太阳时是前一日 21:34，农历日错一天 → 紫微定位错 → 十二宫全变）。`dayOffset` 必须用未取整值算：跨没跨过午夜由精确时刻决定，先取整再判断会在边界翻车

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
