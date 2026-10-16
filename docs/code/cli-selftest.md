# cli-selftest —— CLI 回归自检

本篇覆盖 `scripts/cli/selftest/`：`index.ts`（主报告与编排）· `kit.ts`（共用 harness）·
七个断言组（`calc` / `birth` / `chart` / `render` / `args` / `commands` / `guard`）·
`sample.ts`（固定样例盘）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`index.ts`：主报告

### 1.1 模块定位（为什么住在 `scripts/` 而不是 `test/`）

> 回归自检 —— 内核或 iztro 升级后，用一组不变量快速验证 CLI 仍然正确。
>
> 拆自 purple-star.ts。独立成文件的两个理由：
>
> 1. 它占原文件四分之一（489 行），且**性质是测试代码**，不是产品代码；
> 2. 它的依赖是单向的 —— 它调用解析层与渲染层，但没有任何东西调用它（除了命令表）。
>    抽一个叶子出去，是所有重构里最安全的一种。
>
> ⚠️ 它留在 `scripts/` 而非 `test/`，是有意的：skill 分发时只带走
> `SKILL.md + scripts/ + package.json`，`test/` 不带走。自检必须在交付包内，
> 否则装到别人机器上就没法自证。
>
> ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
>
> ⚠️ 本文件即 `@/cli/selftest` 的落点（原 `cli/selftest.ts`，2026-10-13 并入 `cli/selftest/`
> 成为该目录的 index；同批把 `cli/selftest-kit.ts` 收为 `kit.ts`）。这一步顺带消掉了一处
> 隐患：此前 `selftest.ts` 与 `selftest/` 目录**同名并存**，而 `boot-hooks` 的解析候选序是
> 「同名 `.ts` 优先于同名目录」—— 两种形态同时存在时，`./selftest` 的落点依赖这个顺序，
> 改名任一方都会静默改判解析目标。
>
> 断言本体按主题住在 `./selftest/` 子目录（calc / birth / chart / render / args /
> commands / astrology-shapes / guard 八组），本文件只做编排：构造 harness 与直调 / 子进程探针，按
> 报告顺序逐组调用，再把 classics / synastry 断言组并入并渲染分段报告。

### 1.2 `cmdSelftest`

> `selftest` 命令：跑一组排盘不变量与知识源可用性断言，返回逐项报告。
>
> 覆盖：农历换算、真太阳时、晚子时等价性、城市容错、性别护栏、排盘不变量、三合派约束、
> 格局与知识源可用性。首行自报项数，故此处不写死数字。
>
> 内核根从 `ctx` 取而非自己推导：那是引导层 `pickRoot()` 的职责，自检只负责把它交代出来。
>
> ⚠️ 有失败项时**不抛错，而是先 `console.error` 全量报告再 `process.exit(1)`** ——
> `test/cli.test.ts` 依赖这个退出码判定自检是否全绿。

### 1.3 三条运行期纪律（行内）

- **强制直排、绕过排盘缓存**：
    > 自检全程**强制直排、绕过排盘缓存**：回归要验的是「当前内核排出来的盘」，
    > 若允许命中 .cache/charts 里改动前写下的条目，改完内核的回归会拿着旧盘全绿 ——
    > 那比没有回归更坏（假绿）。本行同时覆盖下方 runCli 的子进程（env 随进程继承）。
- **命令表键集（动态 import 打断静态环）**：
    > 命令表键集：动态 import 打断「commands → selftest → commands」静态环，取代旧
    > 「读 commands.ts 源码文本、正则抽键」的第三条路 —— 那条路让命令表的物理排版成了
    > load-bearing 契约。取 COMMANDS 视图而非裸表：表本身刻意不导出，而断言要的正是
    > 运行期真实键集。selftest/ 下组文件一律不静态 import commands。
- **子进程探针只留给冒烟**：
    > 子进程探针只留给文末的冒烟（守住「入口 → 解析 → 命令表 → 渲染 + 错误出口」真链路）；
    > 输出形态断言用进程内直调（call）—— 每次子进程约 3.2 秒（iztro 冷启动），直调约
    > 25ms，判据同构（code / out / err 三元组，错误路径同一「错误：」前缀文案）。
- **⏭ 跳过标记**：
    > ⚠️ 跳过项**前置 ⏭**：它记 pass 但那条断言**根本没跑**，与「跑过且通过」是
    > 两件事。不标出来就是恒真守卫伪装成通过 —— 最坏的那种假绿。
- **三段汇总**：
    > corpus 与 synastry 的自检断言各自住在 `scripts/corpus/selftest-asserts.ts` 与
    > `scripts/synastry/selftest-asserts.ts`，由本命令汇总执行 —— 报告分三段
    > （排盘 / 古籍 / 合盘），首行「通过 N/N」为合计。

## 二、`kit.ts`：共用 harness

### 2.1 模块定位与「机制共用、策略各异」

> selftest 的共用 harness（叶子模块：无第三方依赖）。
>
> 断言接口原先在 `cli/selftest/` 的主报告与 classics / synastry 两个断言组里**逐字同形**
> 定义三份，靠「与主 selftest 同形」的注释维持同步 —— 抽到这里后，新增断言组
> 只 import 本模块，不再复制样板。主 selftest 负责声明有哪些组并渲染分段报告。
>
> 注：子进程探针（spawnSync 跑根 CLI）**不**收进本模块 —— 各断言组的内核根来源
> 不同（主 selftest 用引导层交代的 `ctx.root`，断言组自推导），「机制共用、策略各异」，
> 且探针涉及进程创建，留在各自的运行语境里更诚实。

### 2.2 `runCli`：进程内直调（为什么不都起子进程）

> 进程内直调一条命令（等价于走一遍 main 的分发，但不起子进程）。**同步版**：
> 断言组测的命令（astrology / synastry）都是同步返回文本，harness 的 `ok` 无需为直调
> 改异步签名。
>
> 输出形态断言原用 spawnSync 起真 CLI —— 每次约 3.2 秒（iztro 冷启动），全量 30 个
> 调用点 ≈ 96 秒。直调复用本进程已加载的 iztro（约 25ms/次），断言语义等价：成功路径
> 同一返回串；错误路径同一 throw（此处捕获后拼「错误：」前缀）。「stderr 前缀 + exit 1」
> 这条真链路由各断言组保留的子进程冒烟覆盖。

### 2.3 `SelftestDeps`：各组的共享运行时

> 主 selftest 各断言组的共享运行时。
>
> 主 selftest 构造一次、按源码断言顺序逐组传入 `selftest/` 下的组函数。`call` /
> `runCli` / `commandNames` 只在这里构造：命令表 COMMANDS 由主 selftest 动态 import 取得
> （打断「commands → selftest → 组 → commands」静态环），组文件因此一律不静态 import
> `cli/commands.ts` —— 需要命令表的一律走 deps。

### 2.4 `createHarness`：⚠️ 唯一跳过入口

> harness：各断言组独立收集自己的结果（工厂函数，不共享状态）。
>
> `ok` 跑一条断言并登记结果 —— 断言体抛错即记为该条失败，一条失败不影响其余断言继续跑；
> 断言体返回值若非空则作为该项的补充说明。
>
> ⚠️ `opts.skip` 是**唯一的跳过入口**：跳过记 pass 但 `skipped: true`，报告渲染时前置 `⏭`。
> **必须看得见「这条没跑」** —— 否则恒真守卫会伪装成通过：断言读不到文件时若静默 return，
> 读者的默认理解是「检查过了，没问题」。

### 2.5 `eq`

> 用 `!==` **严格相等**比较，不做深比较也不做类型转换；失败信息里用 `JSON.stringify`
> 展开两侧取值。

### 2.6 `skipUnlessRepo`：仓库形态探针

> 守卫：只有**仓库形态**（而非分发包形态）才跑依赖仓库级文档的断言。
>
> 判据取「包根有没有 `CLAUDE.md`」：分发包只含 `SKILL.md` / `package.json` /
> `references/` / `scripts/` 四项（见 `tools/pack.ts`），仓库级文档
> （`CLAUDE.md` / `README.md` / `test/README.md`）一律不带。故用 `CLAUDE.md` 作
> 「我在不在仓库里」的探针 —— 它必然与那三份文档同进同出。
>
> ⚠️ **不要给不需要的断言加跳过**：读的文件若都在 `scripts/` 或 `references/` 内，
> 它会被打包带上，跳过只会白白丢掉覆盖。全仓仅此一处仓库级断言组适用。

## 三、七个断言组（模块头原文）

- **`calc.ts`** —— 换算层：农历 → 公历、真太阳时、晚子时等价性（原 `cli/selftest.ts`
  区块 1–3）。断言体原样搬移，只改依赖归属（harness 经 `SelftestDeps` 注入）；
  报告顺序由主 selftest 的调用序保证。
- **`birth.ts`** —— 出生信息构造层：城市容错、性别护栏、出生信息形态（原区块 4 / 4.5 与
  「出生信息」区）。「出生信息形态」三条在主 selftest 的调用序里排在解析引擎之后。
- **`chart.ts`** —— 内核数据面：排盘不变量、运限数据、三合派约束、格局四化、运限定位
  （原区块 5 / 5.5 / 6 / 7 与「运限定位」区）。样例盘改用 `./sample` 的 SAMPLE；
  「体系合规」一条读 `ctx.root` 下的数据文件。
- **`render.ts`** —— 渲染与知识源：知识源可用性、专题渲染各节（原区块 8 与「专题渲染」区）。
- **`args.ts`** —— 参数系统：解析引擎、参数面、声明表、SKILL.md 参数对拍（原解析引擎 /
  参数面 / 声明表区块）。
- **`commands.ts`** —— 命令层：命令面、help 裁剪 / 强化、契约对拍、命令拆分。直调探针
  `call` 由主 selftest 构造后经 deps 传入 —— 组文件不静态 import
  `cli/commands.ts`，命令表键集判断一律走 `commandNames`。
- **`astrology-shapes.ts`** —— astrology 输出形态：未深入 / 深入 / 零输入 / --palaces /
  --topic / --focus / --config / --template 与组合层端到端（自 `commands.ts` 拆出，
  断言体原样；同走 deps 注入，不静态 import `cli/commands.ts`）。
- **`guard.ts`** —— 兜底守护：子进程冒烟、SKILL.md 命令对拍、文档一致性、知识分级。
  冒烟五条走 `deps.runCli`（守「入口 → 解析 → 命令表 → 渲染 + 错误出口」真链路）；
  知识分级组的 grades 动态 import 保持在 ok 断言流之外（ok 断言体是同步回调）。

各组共同的一条：

> 断言体原样搬移，只改依赖归属；「…」组在主 selftest 的调用序里与源码顺序一致。

## 四、`sample.ts`：固定样例盘

> 排盘断言的固定样例盘：1990-05-15 巳时（时辰序号 5），男。
>
> 虚构样本，无真实人物（换样本组时改这一处；各断言的期望值均按本样本盘校准）。
> 各断言组共用，由 `cli/selftest.ts` 与 `selftest/` 下组文件 import。
