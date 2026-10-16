# synastry —— 合盘内核

本篇覆盖 `scripts/synastry/`：`chart-view.ts`（命盘视图层）·
`synastry-knowledge.ts`（合盘知识库）· `selftest-asserts.ts`（合盘自检断言组）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`chart-view.ts`：消费方契约，不排盘

> 命盘视图层 —— 读排盘命令 `astrology --json` 的输出，并对其做只读访问。
>
> ## 本 skill 不排盘
>
> 命盘由排盘解读 skill（`purplestar-astrology`）产出，本 skill 只**消费**它
> `astrology --json` 的输出。故本文件里没有一行排盘逻辑、也没有 `iztro` 依赖 ——
> 它做三件事：解析那份 JSON、按宫名 / 地支查宫、把宫位里的主星取出来。

### 1.1 为什么类型契约是本文件自带的

> ## 为什么类型契约是**本文件自带的**，而不是 import 源的 `types.ts`
>
> 本 skill 是纯消费方，不 import 源的 `types.ts`，类型契约自带。整份全量类型副本有两个问题：
>
> 1. **它是内核的全量类型**（含 `Decadal` / `SelfMutagenMark` / `LunarInfo` 等本 skill
>    一个字段都不读的类型），却要靠「与源逐字节相同」来维持 —— 而本 skill 只是**消费方**，
>    消费方该声明的是「我依赖什么」，不是「上游有什么」。
> 2. 内核里 `Palace.selfMutagen` / `Decadal.mutagen` 是**三合派硬约束的绊线字段**
>    （刻意保留、由源与 `test/school.test.ts` 的断言盯着有没有被填回）。本 skill
>    不排盘、不会填这两个字段，把绊线抄进来只会让「这里是消费方还是内核」变得含糊。
>
> 故现在按**实际读到的字段**重述一份子集，见 {@link ZiweiChart} 一组定义。
> 这份契约窄而明确：上游若改了某个被读字段的名字或形状，`npm run typecheck` 会当场报错；
> 上游若只是新增字段，这里**什么都不用改**（以前那份副本要跟着同步）。

### 1.2 为什么不 import 源的 `render.ts`

> ## 为什么不去 import 源的 `cli/chart/render.ts`
>
> `render.ts` 是排盘 CLI 的渲染层，它 import `@/algorithm`（真排盘）。本 skill
> 一旦引它，排盘内核就得整份跟过来 —— 那正是本次改造要消灭的东西。这里只重建合盘真正
> 用到的几个小函数。

### 1.3 为什么地支名在这里自写一份

> ## 为什么地支名在这里自写一份
>
> 源的 `constants.ts` 也有 `BRANCHES`，但那是**运行期**导入（值是数组）——
> 引它会把 500 多行的常量表（四化表、星曜释义、时辰对照）整份拖进本 skill。
> 地支名是**永不变化的宇宙常量**（子丑寅卯…），不是会漂移的排盘逻辑，故自带 12 个字
> 比拖一整份内核划算。⚠️ 这是**自有的常量**，不是「漏了同步的副本」——
> 改 `constants.ts` 的 `BRANCHES` 时**不需要**同步这里（两者不会同时被读到：
> 本 skill 的盘是从 JSON 来的，地支索引与名字的对应关系由排盘方保证）。

⚠️ 下面这组 interface 是**消费方声明**：只列本 skill 真的读到的字段 ——
上游改了被读字段的名字或形状，`typecheck` 当场报错；上游只新增字段则无需改动。

---

## 二、`synastry-knowledge.ts`：纯文本知识库

> 紫微斗数合盘知识库
> 基于倪海厦《天纪》体系 + 《紫微斗数全书》古典断语 + 全网专业资料整合
> 供合盘 AI 分析使用
>
> **性质**：这是**纯文本知识库**，导出的全是常量数据，不含任何逻辑 —— 断语怎么用、
> 用在哪一步，由 `commands.ts` 的合盘命令决定，不在这里。
>
> **归属**：本文件只住在本仓 `scripts/synastry/`（单 skill 合一前属 `purplestar-synastry`
> skill）。排盘内核里没有对应物，故不存在「改源再同步」这回事 —— 要补断语、改措辞，就地改。
>
> **消费者**：`commands.ts`（`synastry` 的断语输出与 `--json`）、
> `selftest.ts`（非空断言，防知识库被搬空却不报错）。
>
> **方法论与评分标准不在这里**：它们是恒定静态文本，住在本 skill 的
> `references/synastry-guide.md`（按需读取，不经 CLI 输出）—— 改方法论改那个 md，
> 别指望在本文件里找。
>
> ⚠️ 与本项目体系的边界：本文件里的断语是**文案素材**，不是判定逻辑 ——
> 格局命中由 `patterns/` 负责，四化只看**生年干**。断语里的「自化」「飞化」一类字眼
> 是传统措辞，**不要据此去找飞星派工具**（宫干自化与来因宫函数已删除，见仓库根
> `CLAUDE.md` 的「体系口径」一节）。

⚠️ 夫妻宫断语表（`STAR_IN_FUQI_GU`）与四化断语同样是文案素材：空宫借对宫主星论时也走本表
（`commands.ts` 传入「本宫主星，为空则取 `borrowedStars`」的并集），查不到输出
「（无收录断语）」而非报错。

---

## 三、`selftest-asserts.ts`：合盘自检断言组

> 合盘自检断言组 —— 从 synastry 自带的 selftest.ts 抽出。
>
> 断言体基本原样；适配点有三类：
>
> 1. **参数面断言改跑合并后的根 CLI**（`node scripts/purple-star.ts synastry …`）；
> 2. 「出生信息旗标被整个拒收」一条在合并后**暂缓**：主引擎的参数面是 skill 级，
>    `--a-date` 剥前缀后 `date` 在全量声明表里（synastry 命令不读它，仍会因缺
>    `--a-chart` / `--b-chart` 报错指路）—— 这条守卫在 Task 7 输入改 `--charts`
>    后以「`--a-chart` 是未知参数」的形态重新钉死；
> 3. 两条 SKILL.md 一致性断言换成「合并接线」断言（根 SKILL.md 的重写在 Task 10）。
>
> 与 `cli/selftest/index.ts` 的接口：导出 {@link asserts}（收主 selftest 注入的
> {@link SelftestDeps} —— call / ctx / ok 与排盘段同一套，不再本地手搓），
> 逐条结果由主 selftest 汇总。

### 3.1 fixture 的宫序不追求排盘学含义

> 顺序照传统宫序（命宫 → 兄弟 → 夫妻 → …）。**仅用于造 fixture**：合盘不排盘，
> 这里不追求宫序的排盘学含义，只要十二个名字齐、且 `mustPalace` 找得到即可。

### 3.2 输入必须是 `--charts` 形态

> ⚠️ 输入必须是 --charts 形态：--a-chart 在解析层就是未知参数，到不了读文件的环节。
