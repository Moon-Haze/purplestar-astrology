# scripts/cli 代码结构评估（2026-10-11）

> 评估范围：`scripts/cli/` 19 个文件（4387 行）+ 入口 `purple-star.ts`（311 行）。
> 依据：全量文件头部职责注释、逐文件 import 关系图、大文件内部构成实测（行数与函数分布）。
> 评审边界：文件头注释写明的刻意设计（`command-meta` 轻模块底线、`args` 不依赖内核、
> `render` 只依赖 `@/ziwei`、`boot-hooks` 引导层加载时机等）不作为摩擦项。
> 本轮为 `selftest` 拆分落地（`selftest/` 子目录 8 文件）后的跟进评估。

---

## 总评

**结构整体健康，无需伤筋动骨。** 分层单向、每文件头部有职责与依赖边界声明、
启动性能考量已内建（轻模块规避 iztro 冷启动）。评估发现：

- 1 个接缝瑕疵（模块图双向引用，5 分钟可修，无运行时危害）；
- 2 个中等价值拆分候选（`args.ts` 声明数据与解析逻辑混装、`fortune.ts` 最大文件）；
- 2 个低价值项（记录备查，不建议主动动）；
- 无运行时环、无失控文件、无必须立即修的问题。

## 现状分层（依赖自底向上）

```text
叶子层     out(16)  command-meta(90)  birth-info-defs(126)  option-scope(41)  selftest-kit(131)
声明/解析  args(651) ─→ option-scope      config(105) ─→ args
渲染底层   render(345)（只依赖 @/ziwei）
构造层     birth-info(467) ─→ args / render / cities / defs
专题层     fortune(697)  report(154)
命令层     stars(43)  classics(55)  oracle(142)  synastry(233)  astrology(547)
分发/帮助  commands(72)  help(287)
自检       selftest(185) + selftest/(8 文件) + selftest-kit
入口       purple-star.ts(311)（引导层 + main）
```

值得肯定的三点：命令按文件拆分后聚合薄（`commands.ts` 仅 72 行）；`selftest` 已
完成编排/断言组分离；各文件「存在理由」注释使依赖约束可机检（selftest 有对应断言）。

---

## 候选 1 · 消解 `args ↔ option-scope` 模块图双向引用 　【Strong · 小】✅ 已实施（2026-10-11）

> 落地结果：`OptionScope` 接口迁入 `option-scope.ts`（与 `OPTION_SCOPE` 值同居），
> 该文件现为零依赖叶子；实测 import 图：`option-scope → （无）`、`args → option-scope + args-table`，双向引用消失。

**涉及文件**

- `scripts/cli/option-scope.ts:18` —— `import type { OptionScope } from "./args"`
- `scripts/cli/args.ts:34` —— `import { OPTION_SCOPE } from "./option-scope"`

**Problem**　两文件互相 import。运行时无环（`type` 导入被擦除，实际方向是
`args → option-scope`），但模块图上双向引用违反「args 依赖 option-scope」的
单向心智模型。根因是契约位置错位：`OptionScope` 类型定义在 `args.ts`（L91），
而它的**唯一值实现方**恰是 `option-scope.ts` ——类型声明在消费方的消费方。

**Solution**　`OptionScope` 类型移入 `option-scope.ts`（与 `OPTION_SCOPE` 值同居，
契约面合一），`args.ts` 如需引用从 option-scope 取；若外部有用到
`OptionScope`，args 侧 `export type { OptionScope }` 保持兼容。

**Wins**

- 模块图严格单向，双向引用从 import 图上消失
- 契约（类型）与实现（值）物理同文件，改作用域形态只碰一处
- 改动约 5 分钟，无行为变化

---

## 候选 2 · `args.ts` 声明数据与解析逻辑分离 　【Medium】✅ 已实施（2026-10-11）

> 落地结果：新建 `args-table.ts`（284 行，零依赖：`OptionSpec` / `OptionGroup` /
> `OPTION_GROUPS` / `OPTION_ALIASES` / `ALL_OPTION_NAMES` / `camelKey`）；
> `args.ts` 651 → 365 行（解析引擎 + 校验域派生 `OPTION_NAMES` / `SIDE_PREFIXES`）。
> **对原案的偏离**：`OPTION_NAMES` 留在 `args.ts` 未随迁 —— 它是「全集 − excluded」的
> 校验域派生而非声明数据，且 `classics/synastry` 两个断言组动态 `import("../cli/args")`
> 取它；收窄后 args-table 保持零依赖。`camelKey` 归 args-table（声明域键名编码规则）。
> 引导层 `LOADED` 启动自检表已登记 `@/cli/args-table`（新模块进清单、导出自动受检）。
> 验收：selftest 输出与基线逐字节一致、`npm test` 533 全绿、cli-samples 52/52、
> tsc 与 prettier 通过。

**涉及文件**

- `scripts/cli/args.ts`（651 行）

**Problem**　实测构成：L126–355 为**纯声明数据**（`OPTION_GROUPS` ≈190 行 +
`OPTION_ALIASES` ≈15 行 + 派生 Set ≈20 行），L45–124 为类型，L356–645 为解析
逻辑（`camelKey` / `suggestOption` / `parseArgs` / `classifyPositionals`）。
两种变更频率不同的东西混装：改参数**文案/增删参数**（高频，skill 迭代常事）
与改**解析引擎**（低频，spec §2.8 钉死）落在同一文件，diff 与 blame 互相污染；
且数据面正是 help / config / selftest 多方消费的契约，淹没在 651 行里。

**Solution**　抽 `args-table.ts`（或并入 option-scope 形成完整「声明面」文件）：
`OptionSpec` / `OptionGroup` / `OPTION_GROUPS` / `OPTION_ALIASES` 及两个派生
Set——纯数据零逻辑；`args.ts` 保留类型 + 解析引擎（约 420 行）。

**Wins**

- 文案 diff 与引擎 diff 隔离，声明表成为一眼可读的单一契约面
- `help` 路径（启动敏感）未来可只加载声明数据，不触解析逻辑
- 与 `option-scope`「声明作用域」的语义分工更清晰：那份管「认哪些」，这份管「长什么样」

**Cost**　机械搬移 + import 改道，`npm test` 与 selftest 输出 diff=0 即可验收；
约半天。

---

## 候选 3 · `fortune.ts` 按专题拆分 　【Medium · 可缓】

**涉及文件**

- `scripts/cli/fortune.ts`（697 行，目录内最大文件）

**Problem**　11 个导出函数约 600 行渲染 + 90 行定位原语。实测 **8 个 section
函数互不调用**（overview / info / pattern / mutagen / yearly / decadal / age /
focus），仅 `yearlyBranchOf`（内部 6 处引用）与 `agePalaceOf`（4 处）是被
sections 共享的定位原语——拆分难度低（纯机械，与 selftest 拆分同款手法）。

**Solution**　复刻 `selftest/` 子目录模式：`fortune/` 下按专题分文件，
定位原语（`yearlyBranchOf` / `agePalaceOf` / `parseAgesArg`）单独成共享底座；
主文件保留 re-export 面不改调用方。或轻量版：只拆「定位原语 vs section 渲染」
两个文件（697 → 约 90 + 610）。

**Cost / 缓的理由**　搬移本身半天内可完，但 697 行尚未失控、函数内聚真实存在
（同一「运限专题」主题），收益主要在单专题修改的定位速度。**建议挂起，
等下一次对 fortune 的实质改动（branch by abandonment）顺手拆**，不为拆而拆。

---

## 候选 4 · `birth-info → render` 依赖收敛 　【Low · 仅记录】

**证据**　`birth-info.ts:13` 仅因 `fmtDate` 一个函数依赖 render（L402 一处调用
——跨天回退提示文案里的日期格式化）。分层语义上 `fmtDate` 是纯格式化件而非
「渲染」，render 自述「并列底层」却多了一个构造层消费方。

**判定**　现实无害（方向仍单向），头部注释已自述该依赖及理由。仅当动候选 1/2
时顺手把 `fmtDate` 挪到共享底层（如 birth-info-defs 或独立 format 件）才有意义，
**不建议单独立项**。

## 候选 5 · `selftest/commands.ts`（615 行）再分 　【Low · 仅记录】

selftest 拆分后的最大组文件（命令面 + 契约对拍 + astrology 形态 + help，33 条断言）。
若将来继续增长，可按「命令面杂项 / astrology 输出形态」二分。当前 615 行
（约一半是形态断言的 argv 样板）尚在可读范围，**暂不动**。

---

## 明确不建议动的

| 文件 | 行数 | 理由 |
|---|---|---|
| `astrology.ts` | 547 | `cmdAstrology` 的各输出形态分支共享 header/校验/常量，是命令本体的真实内聚；`buildAnalyzeJson` 已有独立消费方（selftest 对拍、synastry），若消费方继续增多再议独立 |
| `help.ts` | 287 | man 手册结构内聚，依赖最轻（command-meta + args） |
| `report.ts` / `synastry.ts` / `oracle.ts` | 154/233/142 | 尺寸健康、职责单一 |
| `stars.ts` / `classics.ts` / `config.ts` / `out.ts` | ≤105 | 薄命令与通道层，正合适 |
| `commands.ts` | 72 | 命令表聚合，恰如其分 |
| `purple-star.ts` | 311 | 引导层 + main，`command-meta` 拆分后启动路径已收敛 |

## 建议落地顺序

1. **候选 1**（类型归位）：5 分钟，随手做；
2. **候选 2**（args 数据/逻辑分离）：半天，含 selftest diff=0 + `npm test` + cli-samples 全套验证；
3. **候选 3**（fortune 目录化）：挂起观察，下次实质改动时顺手；
4. 候选 4/5：仅记录，不立项。
