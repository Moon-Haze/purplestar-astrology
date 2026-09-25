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
node scripts/purple-star.ts nihai --category tianji                # 倪海夏三纪
node scripts/purple-star.ts help                                   # 全部命令与参数

# 第一层：CLI 自带自检，49 项断言，整体执行，不支持筛选单项
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
    ├── cli/args.ts               参数解析（纯函数，唯一不依赖内核的 CLI 模块）
    ├── cli/birth-info.ts         出生信息（真太阳时 / 农历 / 城市容错）
    ├── cli/render.ts             命盘渲染（宫位 / 星曜 / 四化 / 宫名口径）
    ├── cli/commands.ts           八个命令实现 + COMMANDS 表
    ├── cli/selftest.ts           49 项回归断言
    ├── ziwei/algorithm.ts        iztro 排盘主流程
    ├── ziwei/patterns.ts         40+ 格局识别（含古籍出处与破格条件）
    ├── ziwei/sihua.ts            四化（生年 / 流年 / 流月）
    ├── ziwei/db-analysis.ts      分析数据库 v3（主题论断动态推算，topic 命令用）
    ├── ziwei/annotations.json    「倪师引用」文献核对记录（selftest 锁 suspect 零强归属）
    ├── ziwei/heming-knowledge.ts 合盘方法论 + 夫妻宫断语
    ├── classics/                 三部古籍原文检索
    └── nihai/                    倪海夏天纪 / 地纪 / 人纪
```

`cli/` 之间是**单向依赖**，没有环：`args` ← `render`（仅取 `fmtDate`）← `birth-info` ← `commands` → `selftest`。要动哪一层，往上找它的消费者即可。

### 为什么能直接跑 TypeScript（没有构建步骤）

`scripts/purple-star.ts` 用 Node ≥ 22.15 的 `module.registerHooks` 注册了解析钩子（见文件开头的 `registerHooks({...})`）：

- `@/xxx` → 解析到 `<内核根>/xxx`，自动补 `.ts` 或 `/index.ts`。**内核根是 `scripts/` 而非 skill 根**，所以 `@/ziwei/algorithm` = `scripts/ziwei/algorithm.ts`
- **裸包名**（`iztro`、`lunar-typescript`）→ 自内核根向上查找 `node_modules` 解析，而非 cwd 或文件所在位置

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

**⚠️ 拆分之后，这条约束的作用域扩到了子模块**：`scripts/cli/*` 自己静态 import 内核，所以从引导层静态 import 它们，等于绕道提前加载内核，一样会崩。**引导层里除了 `node:` 内置模块，不允许出现任何普通静态 import**——要分发命令就走 `await load<CommandsModule>("@/cli/commands")`。

反过来说，`scripts/cli/` **内部**用普通静态 `import` 是对的、也是推荐的：它们只在 `registerHooks` 跑完之后才被加载，静态 import 反而是最清晰的写法。别把两层的规则搞反。

**因此：给内核加类型只需加 `import type`，绝不要为了「省事」把某个内核模块或 `cli/` 子模块改成引导层的普通静态 `import`** —— 那会让 CLI 在注册钩子前就崩掉。同理，`ROOT` 在模块顶层用 `const ROOT: string = rootFound` 显式收窄：CFA 的收窄不跨函数边界，`load()` 的错误分支里要用 `ROOT`。

### selftest 怎么拿到内核根

`cli/` 子模块是被动态加载的，拿不到引导层的 `ROOT` 局部变量，所以引导层把 `{ root, ROOT_LABEL }` 打包成 `CliContext` 传给 `cmdSelftest`。`COMMANDS` 的函数签名因此统一是 `(args: CliArgs, ctx: CliContext) => string`——TS 允许参数更少的函数赋给它，所以 `analyze: cmdAnalyze` 这类写法不用改，只有 selftest 那项写成 `(_args, ctx) => cmdSelftest(ctx)`。

### ROOT 如何确定

`pickRoot()` 两级优先级：`ZIWEI_ROOT` 环境变量 → 脚本自身所在目录（即 `scripts/`）。

刻意**没有**「宿主项目」候选——仓库内只有一份内核（就在 `scripts/` 下），不存在「实时内核 vs 分发副本」的双模式。

### 三处启动期防御

1. **`REQUIRED_EXPORTS` 自检**：模块加载后立刻校验 14 个关键导出，缺任何一个直接退出。设计意图是**宁可启动失败，也不静默产出错盘**——所以在内核里重命名或删除导出会让 CLI 立刻报错，这是有意的，不是脆弱。
2. **`selftest`**：CLI 自带的 49 项断言，整体执行。
3. **`npm test`**：`test/` 下的基准回归，用 toolkit 样本对标排盘结果（默认 300 条抽样，约 8 秒）。失效的基准是负债而非保障 —— 见 [test/README.md](../test/README.md) 的「升级 iztro 的流程」。

## 体系硬约束：三合派，不是飞星派

本项目严格遵循倪海夏《天纪》三合派。以下飞星派工具被**主动下线**，不得使用：

- ❌ **宫干自化** —— `algorithm.ts` 已停止填充 `Palace.selfSihua`
- ❌ **大限四化取宫干** —— 已停止生成 `daXians[].siHua` / `stemIndex`
- ❌ **来因宫**

⚠️ **最容易踩的坑**：`scripts/ziwei/sihua.ts` 里**仍然导出** `detectSelfSihua` / `findIncomingPalaces` / `getDaXianSiHua`。它们是历史遗留与前端展示兼容代码——**存在不等于该用**，用它们解读就是背离本项目的体系立场。`selftest` 里有断言专门盯着这些字段不被重新填回。

## 内核的来源

内核提取自上游开源项目 `ziwei-master`（未发布到 npm），**在本项目内独立演化**——改内核直接改 `scripts/` 下的对应文件，不存在需要同步的副本。线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/` 不在其中。

## 依赖变更的后果

`iztro` 是排盘引擎，**升级它会改变排盘结果**。`package-lock.json` 已提交以锁定精确版本（iztro 2.6.1 / lunar-typescript 1.8.6）。动过依赖后先跑 `selftest` **与 `npm test`** 再交付解读。

基准样本是 iztro **2.5.8** 拍的快照，与本项目的 2.6.1 有且仅有两处已知差异（太阳/太阴在酉宫的亮度，见 `test/lib/compare.ts` 的白名单）。升级 iztro 后若出现白名单之外的差异，`npm test` 会变红——**这是要你显式审阅行为变化的信号，不是测试该修的 bug**。流程见 [test/README.md](../test/README.md)。

## SKILL.md 与 CLI 的耦合

`SKILL.md` 描述的命令、参数、输出结构必须与 CLI 的实际行为一致，否则 Claude 会照着过时的说明调用。改 CLI 的参数名或输出格式时，同步改 `SKILL.md`。

容易漂移的几处：命令路径（文档统一写 `node scripts/purple-star.ts`，相对 skill 根）、`selftest` 声称的断言数、`scripts/` 下内核与 `scripts/cli/` 的文件数与体积。**文档里引用 CLI 代码位置时优先写模块名而非行号**——`cli/` 拆过一次，行号是漂移最快的东西（`test/lib/loader.ts` 的注释已按此改）。

参数解析在 `cli/args.ts`，出生信息在 `cli/birth-info.ts`，输出格式在 `cli/render.ts`——下面这些「非常规设计」多数落在 `birth-info.ts` 与 `commands.ts`：

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
