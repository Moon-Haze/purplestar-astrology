# boot-layer —— 引导层

本篇覆盖 `scripts/purple-star.ts`（CLI 入口）与 `scripts/boot-hooks.ts`（引导机制）。
这两个文件是整个仓库里**唯一在 TS 解析钩子注册之前就要被求值**的代码，因此它们的注释
密度最高、也最不能改坏。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`purple-star.ts`：入口只做四件事

> purple-star.ts — 紫微斗数排盘与命盘解读 CLI（入口 / 引导层）
>
> 本文件只做四件事：**定位内核根 → 注册 TS 解析钩子 → 启动期内核自检 → 把命令分发出去**
> （分发协议本体在 `cli/host/dispatch.ts`，此处只组装端口并执行副作用）。
> 命令实现、渲染、出生信息解析、自检都**不在**这里，见 scripts/cli/：
>
> cli/args/ 参数面：table（声明面 OPTION_GROUPS + OPTION_ALIASES，零依赖纯数据）
> / parse（解析引擎，util.parseArgs 底座）/ scope（作用域契约）
> / config-input（--config / --template JSON 配置输入）
> cli/birth/ 出生信息解析（真太阳时、农历换算、城市容错）
> cli/chart/ 命盘渲染（宫位 / 星曜 / 四化 / 晚子时提示 / 宫名口径）+ 排盘缓存
> cli/commands/ 命令实现：astrology（四命令合一）/ fortune（运限）/ report（--report）
> / synastry（合盘）/ knowledge/（知识检索四域）/ help / command-meta /
> index（COMMAND_TABLE 注册薄层）
> cli/host/ dispatch（argv → 三元组的分发协议）+ out（--out 落盘通道）
> cli/selftest/ 回归自检（index = 排盘 / 古籍 / 合盘三段合一；kit = 共用 harness）
>
> 设计原则：**不重复实现任何命理逻辑**，全部复用与脚本同级的既有内核模块：
> scripts/algorithm.ts 排盘主流程
> scripts/patterns/ 格局识别（含古籍出处与破格条件）
> scripts/mutagen.ts 四化（生年 / 流年 / 流月）
> scripts/analysis/ 分析数据库 v3（主题论断动态推算，topic 命令用）
> cli/birth/ 出生信息解析（真太阳时、农历换算、城市容错）+ 城市经纬度表
> scripts/data/ 天干地支 / 纳音五行 / 四化表 / 星曜释义（数据层）
>
> 语料（corpus：古籍/天纪/核对表）与 synastry 的内核也住进本仓
> `scripts/corpus/` 与 `scripts/synastry/`，命令并入本 CLI —— 单 skill 单入口，
> 排盘（astrology）、知识检索（knowledge，命令原名 classics）、合盘（synastry）
> 都在这里（见 `SKILL.md`）。
>
> 依赖 Node ≥ 22.18（module.registerHooks + 原生 TS 类型擦除）。
> 用法：node scripts/purple-star.ts <command> [options] （在 skill 根目录下执行；脚本本身也可从任意 cwd 运行）
> 帮助：node scripts/purple-star.ts help
> 自检：node scripts/purple-star.ts selftest

---

## 二、引导层的「不得静态 import」铁律

### 2.1 铁律本身

> ⚠️ 引导层**唯一**被允许的非 `node:` 静态 import，理由见下方「引导层为什么能静态 import
> boot-hooks.ts」—— 该文件自身只依赖 `node:` 内置，且调用点用的是带 `.ts` 扩展名的
> 说明符，靠 Node 原生类型擦除即可加载，**不需要解析钩子**。除此之外本文件不允许出现
> 任何普通静态 import。

> ⚠️ 因此：**本文件里除 `node:` 内置模块与 ./boot-hooks.ts 外，不允许出现任何普通静态 import**
> —— `scripts/cli/` 下的自家子模块也不行（它们静态 import 内核，同样会触发提前加载）。
> 凡是要用的值，一律走下面的 load<T>()。这是本文件最容易被改坏的一处。

### 2.2 为什么类型层可以写在文件顶部

> `import type` 与 `typeof import(...)` 在运行时被**完全擦除**，不产生任何静态依赖 ——
> 这一点是本文件能同时「自举注册 TS 钩子」与「拿到内核/子模块类型」的关键：
> ESM 的静态 import 会被提升到模块求值之前，若用普通 import 引内核或 scripts/cli/*，
> 钩子还没注册、对方的 .ts 就已经要加载了。类型节点擦除后什么都不剩，故安全。

> ⚠️ 这里只允许类型层的 `typeof import(...)`：任何**值导入**（含把内核模块或 `scripts/cli/*`
> 写成普通静态 `import`）都会在钩子注册之前触发加载，直接崩掉。

### 2.3 铁律的实质与 boot-hooks 的豁免

> **引导层为什么能静态 import boot-hooks.ts**：那条禁令的实质不是「禁止静态 import」，
> 而是「禁止在钩子注册前触发 `.ts` 解析」。boot-hooks.ts 只 import `node:` 内置，自身不含
> 任何需要钩子解析的依赖，且调用点写全了 `.ts` 扩展名 —— Node 的原生类型擦除直接就能加载它。
> 把引导机制抽成共享模块（而非让 CLI 与 test/lib/loader.ts 各存一份逐行副本）正是靠这一点。
> `cli/selftest/index.ts` 有一条断言盯着 boot-hooks.ts 的 import 全是 `node:` 前缀，防止这条豁免腐烂。

### 2.4 历史注记：已删除的猴子补丁

> 历史注记：这里曾有一段 `process.emitWarning` 猴子补丁，用于过滤
> `MODULE_TYPELESS_PACKAGE_JSON` 告警 —— 那是上游 ziwei-master（Next.js 项目，不能把
> package.json 改成 "type":"module"）的约束，随内核拷贝带了过来。本仓库的 package.json
> 已声明 "type": "module"，该告警不会触发，补丁是死代码，已删除。

---

## 三、内核根候选：两级优先级

> 优先级：
>
> 1. `ZIWEI_ROOT` 环境变量 —— 显式指定（想把内核指到别处时用）
> 2. 技能自带内核 —— 就是本脚本所在目录 `<skill 根>/scripts/`
>
> 内核根 = `scripts/` **本身**：CLI（`purple-star.ts`、`cli/`）与内核文件（`algorithm.ts` 等）
> 同处一层。因此 `@/` 别名指向的是 `scripts/`，而**不是** skill 根。

---

## 四、启动自检：派生而非手抄

> 已加载模块清单，自检据此**派生**而非手抄第二份：对每个 namespace 的**全部**导出做
> 非空扫描 —— 新模块加进这里一行，它的导出自动受检，「加模块忘登记、自检静默变弱」
> 从结构上不可能。
>
> 子模块是静态 import 内核的，少一个导出本来就会让它们加载失败；但那时抛的是裸的
> `SyntaxError: does not provide an export named ...`，指不到该改哪里。这里先 load 一遍
> 并点名缺失项，把「哪个导出没了、当前内核根在哪、接下来怎么办」一次说清。
>
> ⚠️ 也因此：在内核里重命名或删除导出会让 CLI 立刻报错 —— **这是有意的，不是脆弱**。
> 与 `algorithm.ts` 的 `projectPalaceName` 同一理念：宁可启动失败，也不静默产出错盘。

---

## 五、宿主侧只做端口，不重复实现承诺

> 分发协议本体（--help 拦截位置、查表、解析、错误前缀、退出码语义）在
> `cli/host/dispatch.ts` —— 进程内测试与子进程真链路消费同一 seam，此处只做宿主侧：
> 组装端口（惰性 loader + 上下文）→ 得到 `{ code, out, err, outFile }` →
> 失败打 stderr 并按 code 退出；成功时 `--out <文件>` 走 {@link writeOutFile} 落盘
> （正文不占 stdout，进度提示走 stderr），否则 `console.log`。
>
> 各 `cmdXxx` 一律**返回**已渲染好的文本字符串；传给命令的第二个参数是
> `CliContext`（内核根及其来源），目前只有 `selftest` 用得上。
>
> ⚠️ `--help` 任何位置都生效、未知命令 exit 1 不带栈 —— 这些承诺的**定义处**在
> dispatch.ts，本函数不重复实现它们。

⚠️ help 路径只加载轻模块（command-meta + help，均不依赖命令实现），
不为看一眼 `--help` 付出 iztro 冷启动。

---

## 六、`boot-hooks.ts`：纯机制与 seam 的真实性

> 引导机制 —— 内核根定位 / TS 解析钩子 / 带排查指引的模块加载。
>
> 本模块是**纯机制**：它只回答「内核根在哪」「怎么解析 .ts」「加载失败时把哪些事实交给调用方」，
> 至于「失败之后是退出进程还是抛错」，由调用方以 `onFailure` 策略传入。
>
> 两个调用方让这个 seam 是**真实**的，而不是假想的：
>
> - `scripts/purple-star.ts`（CLI）—— 失败即渲染指引并 `process.exit(1)`
> - `test/lib/loader.ts`（回归测试）—— 失败即抛错，让 node:test 把失败归到具体用例
>
> 此前这两份是逐行副本，靠注释提醒「必须保持行为一致」，只有一条断言间接盯着。
> 副本分叉不会被任何测试抓住：它只影响「怎么观察内核」，测试本身照旧全绿。
>
> ## ⚠️ 本文件只允许 import `node:` 内置模块
>
> 这是它能在**解析钩子注册之前**被静态 import 的唯一理由，也是引导层那条
> 「不得出现普通静态 import」规则的全部动机 —— 那条规则的实质不是「禁止静态 import」，
> 而是「禁止在钩子注册前触发 `.ts` 解析」。
>
> 本文件自身不依赖任何 `.ts` 解析：调用方必须用**带 `.ts` 扩展名**的说明符 import 它
> （`import { … } from "./boot-hooks.ts"`），Node 的原生类型擦除即可加载，不需要钩子。
> `cli/selftest/index.ts` 有一条断言盯着这条约束不被破坏。

### 6.1 `@/` 别名指向内核根

> `@/xxx` 的 `@` 是**内核根**（`scripts/`）而非 skill 根：
> `@/algorithm` → `scripts/algorithm.ts`。
>
> 裸包名重定向的意义：脱离项目运行时从文件位置向上找不到 `node_modules`，
> 必须显式把 iztro / lunar-typescript 指到内核根去解析。

### 6.2 两条分支的候选序必须一致

> ⚠️ **两条分支的候选序必须一致**：`<spec>.ts` 优先，`<spec>/index.ts` 兜底。
> 相对分支原先只有前半条，于是「文件夹模块」在两条路径上行为分叉 ——
> `@/patterns` 能解析到 `patterns/index.ts`，而 `./patterns` 会在运行时
> `ERR_UNSUPPORTED_DIR_IMPORT`。**且 tsc 抓不住**：`moduleResolution: "bundler"`
> 会把 `./patterns` 正常解析到 `patterns/index.ts`，于是类型全绿、只有真跑才崩。
> 补上兜底后，`.ts` 文件仍优先于同名目录，故既有引用一条都不会改变解析目标。

> ⚠️ 顺序不可颠倒：`./x.ts` 必须胜过 `./x/index.ts`。

### 6.3 钩子的注册时机

> ⚠️ 钩子必须在**任何内核模块被求值之前**注册：ESM 的静态 import 会被提升到模块求值之前。

### 6.4 `pickRoot` 用判别联合而非 `string | null`

> 刻意用判别联合而非 `root: string | null` 一把抓：命中分支里 `label` 必然非空，
> 调用点解构后无须非空断言即可拿到收窄后的 `string`。
