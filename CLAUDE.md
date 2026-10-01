# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

一个 **Claude Code skill**：紫微斗数排盘、合盘与古籍检索三域合一（2026-09-30 起单 skill 形态，
**仓库根 = skill 根**）。根 `SKILL.md` + 根 `scripts/`（CLI + 三个域的内核）+ 根 `references/` +
根 `package.json`，整个仓库可拷进 `~/.claude/skills/` 直接使用（拷走后需 `npm install`）。

关键含义：**`SKILL.md` 不是文档，是可执行的行为规范**——Claude 读它来决定如何排盘与解读。改 `SKILL.md` 等于改这个 skill 的行为。

**`SKILL.md` 是骨架，`references/` 是它的延伸**——这是 Claude Code 的三级渐进披露：frontmatter 常驻上下文，`SKILL.md` 在技能触发后加载，`references/` 只在 Claude 真的去读时才进上下文。骨架只放**每次触发都要用**的东西（路径约定、铁律、晚子时、体系约束、已知口径、命令速查），而排障 / 输出契约全文 / 参数面细则 / 工作流详展开一律进 `references/`，并**由 `SKILL.md` 写明何时读它**。

**路径约定**：仓库根 = skill 根，一切命令写 `node scripts/purple-star.ts`（仓库级文档与 skill 内文档从此同一口径，不再有 `skills/<name>/` 前缀）。

## 命令

没有构建、没有 lint（`typecheck` 是类型检查，不是 lint），排盘与解读全部经由 CLI 入口（`npm test` 只跑测试，不参与运行）。

以下在**仓库根**执行（示例数据为虚构）：

```bash
npm install        # 依赖（iztro / lunar-typescript）

# 主力命令：默认概览（总览三行 + 基本信息 12 行面板 + 运限速览），深入靠功能参数（可叠加）
node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州
node scripts/purple-star.ts astrology \
     --date 2011-06-24 --time 07:45 --city 杭州 --gender male --pattern --mutagen --decadal
# 功能参数族：--pattern 格局 · --mutagen 四化 · --yearly [年] 流年 · --monthly 流月
#   --decadal [虚岁] 大限 · --ages [虚岁] 小限 · --focus <宫>（四项深化）
#   --palaces 十二宫详表 · --topic <key> 主题论断 · --config my.json（配置输入）
# 拼音别名仍被识别：--geju→--pattern、--sihua→--mutagen、--liunian→--yearly 等

# 合盘：先排两张盘，再逗号分隔交给 synastry（甲先乙后；本命令不排盘）
node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json > /tmp/a.json
node scripts/purple-star.ts synastry --charts /tmp/a.json,/tmp/b.json
# 古籍原文检索与星曜释义
node scripts/purple-star.ts classics --search 机月同梁
node scripts/purple-star.ts stars --search 紫微

node scripts/purple-star.ts help             # 总览（man 八节结构）
node scripts/purple-star.ts astrology --help # 每命令（归属参数子集）

# 第一层：CLI 自带自检（排盘 / 古籍 / 合盘三段合一，项数由首行自报）
node scripts/purple-star.ts selftest

# 第二层：基准回归，用 toolkit 的 518,400 条样本对标排盘结果（默认跑 300 条抽样，约 8 秒）
npm test
npm run test:corpus -- --year 1960    # 全量核验（需 reference/ 存在，不入日常回归）

# 类型检查：必须 0 错误。运行不依赖它（Node 直接擦类型），改过类型就该跑
npm run typecheck
```

**改过内核或升级 `iztro` 之后，两层都要跑；动过 `.ts` 的类型标注，`npm run typecheck` 也要跑。** `selftest` 测「代码逻辑自洽」，覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、性别护栏、排盘不变量、三合派体系约束、知识源可用性、古籍检索行为、合盘护栏与参数面契约；`npm test` 是**外部基准比对**，用 300 条真实盘逐字段对标，能抓住 `selftest` 那几条固定样例漏掉的行为漂移。测试的性质与效力边界见 [test/README.md](test/README.md)。

三者分工不同，谁都替代不了谁：`typecheck` 只看类型**自洽**，不看类型**标得对不对**——把 `Star` 写成 `any` 它一样全绿，所以我们**不用 `any` 绕过报错**。

## 架构

### 数据流

```text
<仓库根>/                                ← 仓库根 = skill 根
├── SKILL.md                        骨架（行为规范，非文档）
├── references/                     细则（workflow / options / output-contract /
│                                   troubleshooting / synastry-guide / synastry-troubleshooting）
└── scripts/                        内核根：CLI 与内核同处一层
    ├── purple-star.ts              引导层：定位内核根 → 注册 TS 钩子 → 启动自检 → 分发命令
    ├── boot-hooks.ts               引导**机制**（内核根定位 / 解析钩子 / 动态加载），CLI 与 test/ 共用
    │                               只 import node: 内置 —— 故可在钩子注册前被静态 import
    ├── cli/args.ts                 参数面：声明表 OPTION_GROUPS + OPTION_ALIASES + 校验 +
    │                               解析（util.parseArgs tokens 底座 + 薄适配层，cac 已退役）
    ├── cli/option-scope.ts         参数作用域：本 skill 认声明表里的哪些参数
    ├── cli/birth-info.ts           出生信息（真太阳时 / 农历 / 城市容错 / 省名回退）
    ├── cli/birth-info-defs.ts      出生信息层的声明：接口与常量
    ├── cli/render.ts               命盘渲染（宫位 / 星曜 / 四化 / 宫名口径）
    ├── cli/fortune.ts              运限专题（流年/大限/小限/信息/格局/四化/聚焦各节）
    ├── cli/astrology.ts            排盘分析一条命令（四命令合一：概览默认 + 功能参数分发）
    ├── cli/classics.ts             古籍检索命令
    ├── cli/synastry.ts             合盘命令（--charts 输入）
    ├── cli/stars.ts                星曜释义命令
    ├── cli/config.ts               --config / --template（JSON 配置输入）
    ├── cli/help.ts                 help 渲染（man 七节 + 命令→参数归属表）
    ├── cli/commands.ts             命令注册薄层（COMMAND_TABLE + COMMAND_DESC + COMMAND_HELP）
    ├── cli/selftest.ts             回归断言（三段汇总，项数由首行自报）
    ├── cli/selftest-kit.ts         selftest 断言共用 harness（Assertion / eq / ok）——selftest 与
    │                               classics / synastry 两个断言组共用
    ├── ziwei/                      排盘内核：algorithm（iztro 主流程）/ patterns（格局层）/
    │                               mutagen（四化）/ analysis（主题论断数据库 v3）/ constants /
    │                               cities / palace-relations / annotations / types
    ├── classics/                   古籍内核：data/（骨髓赋·全集·全书）+ index（检索纯函数）
    │                               + selftest-asserts（断言组，主 selftest 汇总执行）
    └── synastry/                   合盘内核：synastry-knowledge（断语库）/ chart-view（JSON 消费方
                                    契约）/ selftest-asserts（断言组）
```

`cli/` 之间是**单向依赖**，没有环：`args` / `render`（`fmtDate` 的定义处）← `birth-info` ← 各命令 → `selftest`。要动哪一层，往上找它的消费者即可。

### 为什么能直接跑 TypeScript（没有构建步骤）

`scripts/purple-star.ts` 用 Node ≥ 22.15 的 `module.registerHooks` 注册了解析钩子：

- `@/xxx` → 解析到 `<内核根>/xxx`，自动补 `.ts` 或 `/index.ts`。内核根是仓库的 `scripts/`，所以 `@/ziwei/algorithm` = `scripts/ziwei/algorithm.ts`
- **`.` 相对说明符** → 同一条候选序：先补 `.ts`，再兜底 `<spec>/index.ts`。故内核里引**文件夹模块**时 `./patterns` 与 `@/ziwei/patterns` 等价
- **裸包名**（`iztro`、`lunar-typescript`）→ 自内核根向上查找 `node_modules` 解析

⚠️ 两条分支的候选序**必须一致**：它们分叉过一次，症状是 **typecheck 全绿而运行时崩**。`test/repo.test.ts` 层 6 有断言用桩 `nextResolve` 钉死这条候选序。

仓库里的 `tsconfig.json` 只服务于**类型检查**（`npx tsc --noEmit`），不参与运行：`paths` 的 `@/*` 映到 `./scripts/*`（与 CLI 运行期的别名同义）；`include` 是 `scripts/**`、`test/**`、`tools/**`。

**`@/` 只在 `cli/` 与引导层用**；内核 `ziwei/*.ts` 内部一律相对路径 import（运行期 `@/` 解析到「当前正在跑的 CLI 的内核根」，两者只在源里重合）。`classics/` 与 `synastry/` 的内部 import 用省扩展名相对路径（`./data/quanshu`）与 `@/`（引排盘内核时），统一走同一套钩子。

### CLI 如何既自举又拿到内核类型

CLI 必须在**求值之前**注册解析钩子，而 ESM 的静态 `import` 会被提升——若用普通 `import` 引内核，钩子还没注册、内核的 `.ts` 就已经要加载了。解法是**类型走静态、值走动态**：

- `import type { … } from "@/ziwei/types"` 与 `typeof import("…")` 在运行时被**完全擦除**，可安全地写在文件顶部
- 所有内核模块用 `await load<XxxModule>("@/ziwei/...")` 动态导入

**引导层铁律**：`purple-star.ts` 除 `node:` 内置与 `boot-hooks.ts`（它只依赖 `node:` 内置、调用点写全 `.ts` 扩展名，靠原生类型擦除加载）外，**不允许出现任何普通静态 import**。`cli/` 内部静态 import 内核是对的（它们只在钩子注册后才被加载）。

### ROOT 如何确定

`pickRoot(candidates, probe)`（`scripts/boot-hooks.ts`，CLI 与 `test/lib/loader.ts` 共用）两级优先级：`ZIWEI_ROOT` 环境变量 → 脚本自身所在目录（即 `scripts/`）。`test/lib/loader.ts` 的候选起点是仓库根 `scripts/`；加载失败策略由调用方传入（CLI 渲染指引后退出进程、测试抛错）——「机制共用、策略各异」。

### 三处启动期防御

1. **`LOADED` 全量导出自检**：每个模块 load 一次存 namespace、收进 `LOADED` 表（含 classics/synastry 的入口模块），自检对**全部**导出做非空扫描（不再有手抄清单）——缺任何一个直接退出，**宁可启动失败，也不静默产出错盘**。
2. **`selftest`**：CLI 自带的回归断言（三段汇总），整体执行。
3. **`npm test`**：`test/` 下的基准回归（七层），失效的基准是负债而非保障——见 [test/README.md](test/README.md) 的「升级 iztro 的流程」。

## 体系硬约束：三合派，不是飞星派

本项目严格遵循倪海夏《天纪》三合派。以下飞星派工具被**主动下线**，不得使用：

- ❌ **宫干自化** —— `algorithm.ts` 已停止填充 `Palace.selfMutagen`
- ❌ **大限四化取宫干** —— 已停止生成 `decadals[].mutagen` / `stemIndex`
- ❌ **来因宫**

⚠️ `ziwei/mutagen.ts` 只导出三层四化（`getMutagenByStem` / `getYearStemIndex` / `getYearlyMutagen` / `getMonthlyStemIndex` / `getMonthlyMutagen`）；飞星派函数已删除，全仓零调用点。但 `types.ts` 的**绊线字段刻意保留**（`Palace.selfMutagen` / `Decadal.mutagen` 与 `SelfMutagenMark` / `DecadalMutagen` 类型）——断言要盯的正是「有没有被填回」。**要删这些字段，先读 `types.ts` 里紧挨着它们的说明。**

## 单 skill 形态（2026-09-30 三 skill 合一）

此前 `skills/` 下有三个自包含 skill（astrology 排盘 / synastry 合盘 / classics 古籍），2026-09-30 合并为仓库根的单 skill：内核上提根 `scripts/`，classics 与 synastry 的内核分别住 `scripts/classics/` 与 `scripts/synastry/`，命令并入同一条 CLI，selftest 三段合一。**`skills/` 目录已删除**，别照旧记忆找它。

**归属规则（三句话）**：

1. **排盘内核**（`ziwei/` + `cli/` + 引导层）—— 排盘逻辑只改这里。
2. **合盘断语**（`synastry/synastry-knowledge.ts`）—— 就地改。
3. **古籍原文**（`classics/data/`）—— 就地改。

合盘不排盘：`synastry --charts` 消费 `astrology --json` 的产物（`synastry/chart-view.ts` 自带消费方契约，只声明它真读到的字段子集）。

### 仍然保留的守卫

| 守卫                                | 位置                     | 盯什么                                            |
| ----------------------------------- | ------------------------ | ------------------------------------------------- |
| skill 自包含 + `type: module`       | `test/repo.test.ts`      | 根 `SKILL.md` / `package.json` / CLI 入口齐备     |
| `SKILL.md` ↔ `references/` 双向一致 | `test/repo.test.ts`      | 骨架指了路、文件真的在                            |
| 解析钩子候选序                      | `test/repo.test.ts`      | `boot-hooks.ts` 那对候选序（`.ts` 优先于同名目录）|
| 引文守卫                            | `test/citations.test.ts` | 扫 `scripts/` 全树，比对 `ziwei/annotations.ts`   |

`ALL_SKILLS` 由磁盘推导（判据：根下有 `SKILL.md`），单 skill 形态下只有一项；`CHART_LIKE` 手写——「排不排盘」是语义。

## 内核回归的主场

排盘内核的回归在 `npm test` 与 `selftest` 的排盘段；古籍与合盘的断言组（`*/selftest-asserts.ts`）由主 `selftest` 汇总执行——**三段都在同一条 selftest 里**，报告分段（排盘 / 古籍 / 合盘）、首行合计。

## 依赖变更的后果

`iztro` 是排盘引擎，**升级它会改变排盘结果**。`package-lock.json` 已提交以锁定精确版本（iztro 2.6.1 / lunar-typescript 1.8.6）。动过依赖后先跑 `selftest` **与 `npm test`** 再交付解读。

基准样本是 iztro **2.5.8** 拍的快照，与本项目的 2.6.1 有且仅有两处已知差异（太阳/太阴在酉宫的亮度，见 `test/lib/compare.ts` 的白名单）。

## SKILL.md 与 CLI 的耦合

`SKILL.md` **及其 `references/`** 描述的命令、参数、输出结构必须与 CLI 的实际行为一致。改 CLI 的参数名或输出格式时两处都要同步。

**计数类事实一律不写死**：`selftest` 的断言数、`npm test` 的项数、测试层数——能自报的自报、能派生的派生、其余由断言盯双向一致。

**参数面单点声明**：`cli/args.ts` 的 `OPTION_GROUPS` 是「有哪些参数」的唯一来源——help 的参数段据它派生、`parseArgs` 据它拒绝未知参数、`OPTION_ALIASES` 声明拼音别名（归一到英文主名）、`selftest` 断言 `SKILL.md` 提到的参数都有声明。拼错参数（`--ctiy 喀什`）报错并给最近邻建议，不再静默落回默认经度。

**解析引擎**（2026-09-30 重写）：`util.parseArgs` `tokens` 模式做**底座**（token 化交给标准库），薄适配层做四件事——声明表校验（未知参数中文报错）、别名归一、判重（重复参数报错，旧「取末值」废止）、贪婪取值（`--limit -3` 的 `-3` 是值；Node 版本敏感，selftest 钉死）。`classics` / `synastry` 等命令的位置参数语义各自独立（检索词 / `--charts` 路径），`astrology` 的位置参数按形态归类（日期/时刻/性别/城市）。⚠️ `--charts` 与前缀退役后，`option-scope.ts` 的 `sidePrefixes` / `prefixedCommands` 是空表（概念保留，机制不可达）；作用域清单本身也已差量化（2026-10-01）：`excluded` 空表即默认全集、显式声明排除项，`OPTION_NAMES` 由 `args.ts` 从全集按排除项派生。

三条约束，改动时别踩：

- **键名是 camelCase**（`--late-zi` → `lateZi`）：换算只在 `camelKey()` 一处；`OPTION_GROUPS` 里的 `name` 一律写 kebab。
- **不能给参数设「默认值」**：未给出的键根本不出现，调用方靠 `undefined` 判空取默认（`cmdClassics` 的 `--limit` 就靠它给默认 15）。
- **归属表是 help 视图**：`help.ts` 的 `OPTION_OWNERSHIP`（命令 → 参数子集）只过滤 help 展示，不做硬校验——作用域仍是 skill 级。

CLI 里有几个**刻意的非常规设计**，改动时别当成 bug：

- **晚子时**：23:00–23:59 出生，两种口径排出的是两张不同的盘。`--late-zi` 切换口径，`astrology` 会自动输出两盘差异对照
- **`--yearly` 不是出生年**：出生日期只有 `--date` / `--lunar` 两途（`--year` 三连已删）
- **`chart.palaces` 按地支数组序排**——`branch` 序列实测为 `2,3,…,11,0,1`（寅起）。比对或展示时请按 `branch` 建索引
- **真太阳时默认不含均时差**：默认只做 `(经度−120)×4` 的经度校正，加 `--eot` 才计入均时差（±16 分，足以改变时辰判定），显式开关而非静默启用
- **真太阳时跨午夜时日期跟着走**：`calcTrueSolar` 返回 `dayOffset`（未取整判定），调用点用 `shiftDate` 调整 `info`。日期单点流入，下游自动跟随

## 内核的来源

排盘内核提取自上游开源项目 `ziwei-master`（未发布到 npm），**在本项目内独立演化**。线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/` 不在其中；本仓自带分析数据库 v3（`ziwei/analysis/`）。
