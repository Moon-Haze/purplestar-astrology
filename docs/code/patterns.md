# patterns —— 格局层

本篇覆盖 `scripts/patterns/`：`index.ts`（装配）· `types.ts`（形状）· `helpers.ts`（底座）·
`superior.ts` / `medium.ts` / `enhancing.ts` / `basic.ts` / `converged.ts` / `malefic.ts`（判定）。
（`soul-summary.ts` 是纯文案映射，不住判定目录 —— 已迁 `scripts/analysis/soul-summary.ts`，
见 [analysis.md](analysis.md)。）

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`index.ts`：装配层与「最多产出 1 条」这条不变量

> 紫微斗数格局识别
>
> 本目录是解读层的主体：由一张已排好的 `ZiweiChart` 判出命中的格局清单，
> 每条含名称、分级、判词、涉及宫位与**分层的成立条件**。各 `detect*` 识别器返回一个
> `Pattern` **数组**，合计覆盖约 82 个格局名。
>
> ⚠️ **每个识别器当前最多产出 1 条**（0 或 1）—— 除下面点名的两个外，全部写成
> 「命中即 `return`」，由代码结构直接保证；`detectHuaJiRuMingQian` / `detectChangQuHuaJi`
> 按宫位 / 星曜逐个筛，写成累积数组，但**实测同样零多产**：生年四化由年干决定，一年只有
> 一颗化忌星，而命宫与迁移宫互为对宫、文昌与文曲是两颗各只可能带一颗忌的星。
> （一次性扫描实证：1950–2009 × 6 月 × 3 日 × 12 时辰 = 12960 张本命盘，两个
> 识别器的产出条数分布均只有「0 条」与「1 条」两档。）
>
> 故返回类型写成 `Pattern[]` 而非 `Pattern | null`，是为了让那两个识别器在语义上表达
> 「所有命中的都要报」，而不是「我知道会多条」。若 `mutagen` 的来源将来扩到流年 / 大限
> 四化，它们会真的多产，届时不必改签名与调用点。

### 1.1 文件分工：形状 / 数据 / 判定

> - `types.ts` —— **形状**：结构体、识别器入参 `DetectContext`、识别器签名 `Detector`
> - `data.ts` —— **数据**：常量、名字裁决表，以及判词表 `PATTERN_VERDICTS`
>   （键为判词条目名，多数即格局名，少数是按变体或一族共用的条目，口径见该文件的「判词」分区）
> - `helpers.ts` —— **底座**：宫位 / 星曜查询与判词填充 `fillVerdict`
> - `superior.ts` / `medium.ts` / `enhancing.ts` / `e-ge.ts` / `basic.ts` /
>   `converged.ts` —— **判定**：各分组识别器，每组末尾导出自己的 `Detector` 数组
> - `soul-summary.ts` —— **命宫摘要**：已迁 `analysis/soul-summary.ts`（纯文案层不住判定目录）
> - `index.ts`（本文件） —— **装配**：`DETECTORS` 总表 + `detectPatterns` + 公开面 re-export

### 1.2 识别器的统一收尾

> 每个识别器的收尾统一是：先把名字算进局部 `name`，再 `return [{ name, level,
palaces, conditions, ...PATTERN_VERDICTS[name] }]` —— 判词**一律**从表里取，
> 识别器文件不再出现 `description` / `topicDescription` / `source` 字面量。
> `level` / `palaces` / `conditions` 的值是盘上算出来的，故留在识别器里。
>
> 识别器**不接触**任何累积数组：`Pattern[]` 是它的全部输出，并进总表的事只发生在本文件
> 的 `detectPatterns` 里那一行 for。故「这个识别器会不会产出多条」在它的签名与 return 处
> 直接可读 —— 从前靠「块末有没有 return」隐式表达，是看漏过的地方。
>
> 拆分前就对外公开的类型与裁决表在本模块**原处 re-export**，故公开面逐名未变。

### 1.3 设计原则

> 1. 古书条件优先：每个格局列出「必须 / 加分 / 破格」三层结构，出处可考
> 2. 倪师立场：不使用宫干自化、大限四化、来因宫等飞星派工具
> 3. 庙旺利陷：用 `brightness` 字段（bright=庙旺、normal=平、dim=陷）
> 4. 三方四正会照：命宫 + 财帛 + 官禄 + 迁移
> 5. 夹宫：命宫前后两宫

### 1.4 判定怎么做（实现口径）

> - **只看结构化字段，不解析文案**：判定依据是 `Palace.branch`、`Star.type`、
>   `Star.brightness`、`Star.mutagen` 四项，不读 `description` 文本
> - **定位宫位走地支算术**：三方四正是 `[m, (m+4), (m+8), (m+6)]`、夹宫是 `(b±1)`、
>   对宫是 `(b+6)`（见 `helpers.ts` 的 `getSurroundPalaces` / `getJiaPalaces` / `getDuiGong`）。
>   少数例外按**宫名**查找（`detectHuaLuRuCai` 找「财帛宫」、`detectHuaQuanRuGuan`
>   找「官禄宫」），依赖 `algorithm.ts` 的宫名口径，见 `../constants` 的
>   `IZTRO_TO_PROJECT_PALACE`
> - **识别器一律「命中才推入」**：每个 `detect*` 内部先判条件，不成立即 `return`，
>   从不推入「未成立」的条目；因此返回数组的长度即命中数
> - **`conditions` 是回填结果、不是判定依据**：`required` / `bonus` / `breaking`
>   记录的是**已经过判定**的项

### 1.5 主要古籍出处

> - 《紫微斗数全集》（陈抟祖师传，明代刊本）
> - 《紫微斗数全书》（罗洪先编，明代刊本）
> - 《骨髓赋》《女命骨髓赋》《十二宫诸星得地合格诀》
> - 倪海厦《天纪》紫微斗数讲义

### 1.6 回归与效力边界

> `test/invariants.test.ts` 的层 3 为全部约 82 个格局名建了**独立预言机**（按定义复算，
> 不看实现），另有「化禄入财 / 化权入官」两条按偏移算术核对的断言；`cli/selftest/index.ts`
> 只断言返回结构与条目必备字段。⚠️ 该预言机复刻的是**实现当前的口径**，不是照命理理想
> 口径重写，且 `level` 分级、`description` / `conditions` 文案均不在其覆盖范围内 ——
> 详见 `test/README.md`。

## 二、`types.ts`：形状

> 格局层的**类型**：结构体、识别器入参、识别器签名。
>
> 本模块只放「是什么形状」，既不放数据也不放判定 —— 常量、名字裁决表与判词表在同目录的
> `data.ts`，识别器按分组散在 `superior.ts` / `medium.ts` / `enhancing.ts` / `e-ge.ts` /
> `basic.ts` / `converged.ts`，装配在 `index.ts`。分工是**形状 / 数据 / 判定**，
> 改哪一层就只需读哪个文件。
>
> 本文件里的 `{@link}` 一律只指向**本文档内**的符号 —— 跨文件 TSDoc 解析不到，
> 指向其他模块的符号时直呼其名，不加链接。

`conditions` 的分层（⚠️ 最易误读的一条）：

> ⚠️ 这三个数组是**回填已判定项**的结果记录，**不是判定依据**：识别器先用代码判完条件，
> 再把已命中的项写进来给文案层展示。故「某条件不在 `required` 里」不等于「该条件不成立」，
> 只是那个识别器没有把它列进去。

## 三、`helpers.ts`：底座

> 格局层的**辅助底座**：宫位 / 星曜查询与判词填充。
>
> 这里的函数只回答「盘上有什么」，不做任何格局判定 —— 判定在各 `<分组>-ge.ts` 里。
> 它们被识别器重度共享（`hasStar` / `sanFangAllStars` / `findStarPalace` 各有十几到二十几处
> 调用点），故必须先于识别器独立成文件，否则每个分组文件都要反向 import 母文件。
>
> 本文件在同目录内**全部导出**，但**不属于格局层的公开面**：`./index` 只对外暴露
> `detectPatterns` / `getMingGongSummary` 与类型名，不转发这里的任何一个。
>
> **定位宫位走地支算术**：三方四正是 `[m, (m+4), (m+8), (m+6)]`、夹宫是 `(b±1)`、
> 对宫是 `(b+6)`（见 `getSurroundPalaces` / `getJiaPalaces` / `getDuiGong`）。
> 偏移算式**全仓单点**在 `../palace-relations`，本文件只做「按宫取星」。

## 四、各分组识别器（共同的模块头契约）

> 识别器签名一律 `(ctx: DetectContext) => Pattern[]`：命中返回 `[one]`，未命中返回 `[]`，
> 并进总表只发生在 `./index` 的 `detectPatterns` 那一行 for 里 —— 本文件不接触任何累积数组。
> 判词一律从 `corpus/data/patterns` 的 `PATTERN_VERDICTS` 取，收尾经 `./helpers` 的
> `fillVerdict` 填占位符。
>
> 下方导出的数组**次序即 `detectPatterns` 的输出次序** —— 增删或调整组内次序都会改变输出排列。

- **`superior.ts`** —— 上格：古书条件最严、成格最难得的一组（正格识别器）。
- **`medium.ts`** —— 中格：成格条件稍宽，仍是古书明列的格局。
- **`enhancing.ts`** —— 助力格：吉星夹拱、双禄三奇一类「锦上添花」的格局。
- **`basic.ts`** —— 基础格局：让普通命盘也能识别出 1-3 个常见格局，而不是 30+ 严格古书
  格局都不匹配。这些都是单一条件触发的轻量识别，level 多为 neutral / good。
- **`converged.ts`** —— 收敛自 db-analysis 的识别器：判定收敛到格局层后归入本组。
- **`malefic.ts`** —— 恶格：煞忌交侵、主刑伤波折的一组，成格条件与上格同严。

## 六、`soul-summary.ts`：命宫摘要（⚠️ 不得改签名）—— 已迁出本目录

> 命宫摘要（命宫主星的简要概括：星名、关键词、星性）现住
> `scripts/analysis/soul-summary.ts`：它是**不判条件、只做映射**的纯文案层，
> 按分层红线不住格局判定目录。搬家是纯位置变动，**签名与返回结构仍不得改动**——
> `cli/commands/astrology.ts` 的 `mingGongSummary`（文本与 `--json`）按原样取用。
> 详情见 [analysis.md](analysis.md) 的「`soul-summary.ts`」节。

## 五、`converged.ts`：⚠️ 口径照搬，不趁迁移「顺手修正」

> 以下 11 个识别器（产出 13 个格局名）的判定住在本文件；
> `db-analysis.ts` 的 `detectGeJu` 只按名字取用这里的产出、保留自己的倪师口吻长判词。
>
> **口径照搬，不趁迁移"顺手修正"**：判定条件逐字对齐原 `detectGeJu`（含它偏宽或偏窄之处），
> 差异要改就两侧一起改 —— `test/invariants.test.ts` 里这 13 个名字都有独立预言机盯着。
>
> `source` 照实标注：本仓古籍库（`knowledge --search`，语料住 `scripts/corpus/`）
> 查得到直接出处的写书名与篇名，查不到的写「传统口诀（本仓古籍库无直接出处）」——
> **不编造篇名**，等将来补录古籍再换。
