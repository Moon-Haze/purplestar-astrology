# chart-kernel —— 排盘内核

本篇覆盖 `scripts/` 根的五个排盘内核文件：
`types.ts` · `algorithm.ts` · `palace-relations.ts` · `mutagen.ts` · `wenmo-brightness.ts`
（即「排盘内核」单元：`scripts/` 根下除 `patterns/` `analysis/` `data/` `corpus/` `knowledge/`
`school/` `synastry/` `cli/` 之外、直接参与出盘的那几个模块）。

收录的是这五个文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约
（`@param` / `@returns` / `@throws`）与 D 类口径锁（解释不直观算式的一行注释）留在源码，此处不收。
分类判据与搬迁纪律见 [README.md](README.md)。

---

## 一、`types.ts`：领域模型

### 1.1 模块定位（原模块头）

> 紫微斗数领域模型 —— 内核、CLI 与测试之间的公共类型契约。
>
> 本模块**只有类型，不含任何逻辑**。每个字段的取值域（索引基、是否可选、单位）在此定死：
> `algorithm.ts` 按它产出，`cli/chart/render.ts` 按它渲染，`test/lib/compare.ts` 按它比对。
>
> 贯穿全项目的三套索引约定（三者**不同域**，混用必错）：
> - **天干索引** 0–9，序同 `constants.ts` 的 `STEMS`（0=甲 … 9=癸）
> - **地支索引** 0–11，序同 `constants.ts` 的 `BRANCHES`（0=子 … 11=亥）
> - **时辰序号** 0–12，见 `BirthInfo.timeIndex` —— 比地支索引**多一个 12**（晚子时）

### 1.2 内核对外契约（冻结 @ 2026-10-12）· 扩展 Phase 不得修改此面

> 本区块是「知识内容插件化」（Phase 1–4）的稳定边界。插件层（KnowledgeSource /
> TopicProvider / SchoolAdapter）只消费以下纯函数面，不得修改、不得增删符号。
> `test/kernel-contract.test.ts` 把本面钉成可断言事实——内核签名一旦漂移，该测试先红。
>
> 冻结面（符号 → 所在模块）：
> - 排盘主流程：`generateChart(birthInfo) → ZiweiChart`（algorithm.ts）
> - 宫位关系查询：`oppositeBranch` / `surroundBranches` / `palaceAtBranch` / `mustPalaceAtBranch`（palace-relations.ts）
> - 四化查询：`getYearStemIndex` / `getMutagenByStem` / `getYearlyMutagen` / `getMonthlyMutagen` /
>   `getDaXianMutagen` / `getDailyMutagen` / `getHourlyMutagen`（mutagen.ts）
> - 亮度查询：`wenmoStarBrightness(starName, branchIdx)` / `getBrightnessSchool` / `setBrightnessSchool`（wenmo-brightness.ts）
>
> ⚠️ 体系立场（绊线，禁止回填）：本契约的类型仍保留飞星派遗留字段
> （`Palace.selfMutagen`、`Decadal.mutagen` 等），但运行时**必须恒为 undefined**——
> algorithm.ts 不再填充它们（倪师三合派）。插件不得「补回」这些字段。

### 1.3 绊线字段：飞星派遗留（刻意保留，禁止回填）

> ⚠️ **飞星派遗留类型，本项目（三合派）不使用。这是一个刻意留下的绊线。**
>
> 「绊线」是什么意思：`algorithm.ts` 已停止填充 `Palace.selfMutagen`（倪师不主张
> 飞星派宫干自化论），而断言要盯的**正是「有没有被填回」** —— 字段与类型删了，就无从盯起。
> 所以它们留着，`cli/selftest/index.ts` 与 `test/school.test.ts` 各有一条断言守着
> （断言名：「宫干自化未被填充」）。
>
> 会**生产**它的那些函数（`sihua.ts` 的 `detectSelfSihua` / `buildAllSelfSihua`）已删除 ——
> 它们在**全仓**没有任何调用点，删除测试判定该消失。所以本类型如今
> 既无生产者也无消费者，唯一的存在理由是上面那条断言。**存在不等于该用**，拿它解读
> 就是背离本项目的体系立场。

—— 以上原文挂在 `SelfMutagenMark` 上；`DecadalMutagen` 上的同义原文：

> ⚠️ **飞星派遗留类型，本项目（三合派）不使用。同 `SelfMutagenMark`，是刻意留下的绊线。**
>
> `algorithm.ts` 已停止生成 `decadals[].mutagen`（本项目大限只看宫位移动，四化永远取生年干），
> 而断言要盯的正是「有没有被填回」—— 字段与类型删了，就无从盯起。
>
> 生产者 `sihua.ts` 的 `getDecadalMutagen` 已删除（全仓零调用点）。
> **存在不等于该用**。

`Palace.selfMutagen` 与 `Decadal.stemIndex` / `stemName` / `mutagen` 四处字段各自挂着同义的
「已停止填充 / 已停止生成，运行时恒为 `undefined`，断言盯着不被重新填回」警告。
**要删这些字段，先读本节**——它们的作用是「留着但不填」。

### 1.4 各字段的取值域红线

`BirthInfo`（排盘的唯一输入）：

> ⚠️ 本接口同时承载「出生时刻」与「出生地」两类数据，`timeIndex` 与 `longitude` 的单位
> 最易混淆（一个不是钟表时，一个不是地方时），改动前先看各自的字段说明。

- `year` / `month` / `day`：公历。`day` 若真太阳时校正跨过午夜，此值已是**校正后**的日期
  （`cli/birth/birth-info.ts` 用 `shiftDate` 调整）。
- `timeIndex`：
  > **时辰序号**，取值 **0–12**：0=子 … 11=亥，**12=晚子时**。
  >
  > ⚠️ 这不是 0–23 的钟表时，也**不能**直接当 `BRANCHES` 的索引用（12 会越界）。
  > 钟表时 → 时辰序号的换算（真太阳时经度校正、可选均时差、跨午夜日期回退）全部在
  > `cli/birth/birth-info.ts` 的 `calcTrueSolar` / `buildBirthInfo` 里完成，本字段消费的是其结果。
  >
  > 12 的语义是「子时，且要求按**晚子时算次日**安星」——它对应 iztro 的 `timeIndex` 12。
  > 同一时刻按晚子时（12）与早子时（0）排出的是**两张不同的盘**，不是微调
  > （实测：同一生日下 12 与 0 的紫微落宫都不同）。
  >
  > `cli/birth/birth-info.ts` 只在两种情况下产出 12：`--branch 12` 直接指定，或 `--time` 的
  > 真太阳时落在 23:00–23:59 且同时给了 `--late-zi`。其余情形一律产出 0–11。
- `gender`：
  > 性别。决定大限顺逆 —— 同一张盘男女的大限可差 80 年（26-35岁 ↔ 106-115岁），
  > 故**必填、无默认值**：缺失时 `buildBirthInfo` 一律报错，不静默兜底成 male。
- `province` / `city`：`--province` 回退时取该省 `cities[0]`（省会）的经度，不参与安星；
  `city` 由 `cli/birth/birth-info.ts` 的 `findLongitude` 按名查经度，不参与安星。
- `longitude`：
  > 出生地经度，**东经为正**（北京 116.4）。
  >
  > 用途只有一个：真太阳时的**经度校正** `(经度 − 120) × 4` 分钟。查表值见
  > `cities.ts` 的 `PROVINCES`；未给出生地时按 120 处理（即不做经度校正）。

`LunarInfo`（由公历生日换算而来，供输出展示与虚岁换算）：

> 由 `algorithm.ts` 的 `getLunarInfo` 产出，**不参与安星**（iztro 的排盘入参本身就是公历）。

- `lunarYear`：**以正月初一为界**（不是立春、也不是生日）——`currentAge` 的虚岁换算依赖此口径。
- `lunarMonth`：
  > 农历月（1–12），**恒为正数**。
  >
  > ⚠️ 闰月不在此处用负号表达：`lunar-typescript` 的 `getMonth()` 确实以**负数月份**表示闰月，
  > 但 `getLunarInfo` 取了 `Math.abs`，闰月与否单独由 `isLeapMonth` 标记。
- `yearStem` / `yearBranch`：查表未命中时兜底 0。

`Mutagen`：

> ⚠️ 本项目只认**生年干四化**（倪师《天纪》：四化星永远固定不动）。
> 大限四化取宫干、宫干自化等飞星派口径已主动下线，见仓库根 `CLAUDE.md` 的「体系口径」一节。

`Star`：

- `type`：四选一 —— `major` 主星**只能**由 iztro 的 `type` 字段给出（吉煞两张名单里没有主星）；
  `sha` 煞星命中 `algorithm.ts` 的 `TOUGH_STARS` 时优先判定；`lucky` 吉星命中 `SOFT_STARS` 时优先判定；
  `minor` 其余（杂曜）兜底。
- `mutagen`：
  > ⚠️ 直接取自 iztro 的 `mutagen`：**无四化时它给的是空字符串 `""`**，而类型上写的是
  > 可选（`?`）——两种「无」在运行时都会出现。判空请用真值判断
  > （`cli/chart/render.ts` 的 `starLine` 即 `if (s.mutagen)`），**不要**写 `=== undefined`。
- `brightness`：
  > 亮度，已归并成三档：`bright` 庙/旺、`dim` 陷/不/闲、其余（含**缺省**）`normal`。
  >
  > ⚠️ **口径随混合口径切换（2026-10）**：主星 + 辅星 + 煞星（凡文墨 SB 表收录的星）
  > 都会填，取值来自文墨 XD2 表的细档塌缩（`algorithm.ts` 装配层覆写）；表未收录的
  > 星中，主星回落 iztro 原值、辅杂曜为 `undefined`。下判决前记得判空。
- `brightnessRaw`：
  > 亮度细档（文墨口径中文，如「庙」「旺」「得」「利」「平」「不」「闲」「陷」）。
  >
  > ⚠️ 只有文墨 SB 表收录且该宫非留白的星才有值；三档 `brightness` 由此细档
  > 塌缩而来（塌缩规则见 `algorithm.ts` 的 `mapBrightness`）。文本输出不显示此字段，
  > 仅进 `--json` 供细粒度消费。

`Palace`：

- 身宫不单独占宫，而是与十二宫中的某一宫同宫，由 `isBodyPalace` 标记（故一张盘里恰有一个 true）。
- `branch`：
  > ⚠️ `ZiweiChart.palaces` 数组**不是**按此值升序排的，见 `ZiweiChart.palaces`。
- `stem`：宫干直接取自 iztro 的 `heavenlyStem`；本项目仅用于展示，**不用它做四化**。
- `name`：
  > 宫名，一律为**本项目口径**（如「交友宫」，而非 iztro 的「仆役」）。
  > 映射表见 `constants.ts` 的 `IZTRO_TO_PROJECT_PALACE`；未命中会抛错，不会回退原名。
- `stars`：顺序固定为 主星 → 次星（iztro `minorStars`）→ 杂曜（`adjectiveStars`）。
- `decadalRange`：本宫所属大限的年龄段 `[起, 讫]`（**虚岁**，闭区间）。仅 iztro 给出 `decadal.range` 时有值。
- `ages`：
  > 小限落在本宫的**虚岁**列表（如 `[9,21,33,…]`，每宫 10 个、十二宫并集连续覆盖 1–120）。
  >
  > 直接取自 iztro 静态盘的 `palace.ages` —— 小限的起宫与顺逆由 iztro 按生年支与性别
  > 推定，本项目不重复实现。**虚岁域**，与 `decadalRange` / `ZiweiChart.currentAge` 同域，
  > 以农历年（正月初一）为界。
- `oppositeBranch`：对宫地支索引，由 `./palace-relations` 的 `oppositeBranch` 算出（该式为全仓单点）。
- `isEmpty` / `borrowedFromBranch` / `borrowedFromName` / `borrowedStars`：`borrowedFromBranch` 恒等于
  `oppositeBranch`；`borrowedStars` 是借到的对宫**主星**名列表（结构化数据，文案层无需再从文本反查），
  无主星的对宫会借到空数组（即「借无可借」，此时该宫按无主星论）。

`Decadal`（由 `algorithm.ts` 汇总十二宫的 `decadalRange` 生成，按起始虚岁**升序**排列）：
`stemIndex` / `stemName` / `mutagen` 三字段均为「⚠️ 飞星派字段，已停止生成」，运行时恒为 `undefined`。

`ZiweiChart`（内核的最终产物，CLI 渲染、合盘、流年、格局判定的公共输入；由 `generateChart` 产出，
只做组装、不做推算，安星交给 iztro）：

- `fiveElementsClassName` vs `fiveElementsClass`：
  > ⚠️ 局数 `fiveElementsClass` 是**取局名首字五行查表**（`constants.ts` 的 `ELEMENT_TO_JU`）
  > 解析出来的，首字非五行时兜底成 3（木三局）；而本字段永远是 iztro 的原文。
  > 两者可能不一致，**展示以本字段为准**。
- `palaces`：
  > ⚠️ **数组顺序不是地支升序**，而是 iztro 的原生顺序：实测 `branch` 序列恒为
  > `2,3,4,5,6,7,8,9,10,11,0,1`（自寅宫起，绕到丑宫）。因此：
  > - **按 `branch` 建索引**（`palaces.find(p => p.branch === b)`），不要依赖数组下标；
  > - 要按「子→亥」或任何其它顺序展示，得自己排（`cli/chart/render.ts` 就是显式 `sort` 后再渲染）。
- `douJunBranch`：
  > **子年斗君**所在宫的地支索引 0–11：以子宫起正月**逆数**至生月，再以生月宫起子时
  > **顺数**至生时，所落之宫。斗君是流月定位的基准（流年正月自斗君宫起）。
  >
  > ⚠️ iztro 静态盘**不带**斗君，此字段由 `algorithm.ts` 按上式自推（已用 2000-4-6 子时男
  > = 戌、1990-05-15 巳时男 = 寅 两组样例校准）。闰月按所闰之月数计（与 `lunarInfo.lunarMonth`
  > 的 `Math.abs` 口径一致）；晚子时（timeIndex 12）按子时论。
- `currentAge`：**虚岁**，以农历年（正月初一）为界，与 `decadalRange` / `decadals[].startAge` **同域**。
- `currentDecadalIndex`：`-1` 表示虚岁尚未落进任何大限（童限未起运）。

---

## 二、`algorithm.ts`：iztro 翻译层

### 2.1 模块定位（原模块头）

> 紫微斗数排盘算法 —— 基于 iztro（`https://github.com/SylarLong/iztro`）。
>
> 本模块是 iztro 与本项目领域模型之间的**唯一翻译层**：安星、五行局、大限区间全部由
> iztro 推算，这里只负责换算宫名口径、分类星曜、补借对宫字段，不重复实现任何命理逻辑。

### 2.2 换年口径显式锁（口径锁论证）

```ts
// 换年口径显式锁：`normal` = 以农历正月初一为界换年（虚岁口径）。
astro.config({ yearDivide: "normal" });
```

> iztro 2.6.1 的默认值恰是它，但「恰好等于默认」是隐式契约 —— 库改默认、或任何
> 代码误动全局配置，都会把流年/虚岁基准静默滑到「以立春为界」（exact），
> 排出的盘农历年错位、生年四化全变。在此显式声明，使口径不随默认值漂移。

（该注释本身留在源码——它贴着 `astro.config` 那一行，属 D 类口径锁；此处收录其论证。）

### 2.3 飞星派工具的下线记号

```ts
// 飞星派工具仅供导出，不再在排盘时调用（倪师《天纪 03》：四化星永远固定不动）
// import { detectSelfSihua, getMutagenByStem } from './mutagen';
```

### 2.4 宫名口径（`projectPalaceName`）

> iztro 第 8 宫叫「仆役」，倪师体系叫「交友宫」；其余 11 宫只是统一补上「宫」字。
>
> ⚠️ 未命中时**抛错，不回退到原名**。回退看着更「稳」，其实是让一个未知宫名静默
> 流进输出 —— 而宫名是十二宫一览、`--focus`、三方四正、大限、格局判定的公共索引，
> 错一个名字就是错一片下游。这与 `purple-star.ts` 顶部 `REQUIRED_EXPORTS` 自检
> 是同一个理念：**宁可启动失败，也不静默产出错盘**。

### 2.5 农历信息（`getLunarInfo`）

> 只服务输出层展示与 `generateChart` 里虚岁的农历年换算，**不参与安星**
> （iztro 的排盘入参本身就是公历）。
>
> `lunar-typescript` 用**负数月份**表示闰月，故月份取 `Math.abs` 后另以
> `isLeapMonth` 单独标记。年干支靠 `indexOf` 查表，未命中兜底 0（甲 / 子）。

### 2.6 亮度三档塌缩（`mapBrightness`）

> 只归三档，是因为下游只问「够不够亮」这一个问题（`patterns/helpers.ts` 的 `isBright` / `isDim`）；
> 「得 / 利 / 平」的细分差异在倪师体系里不进格局条件。文墨 5 档制的「闲」归 `dim`
> —— 闲是比「不」还弱半档的负面亮度（中州派口径，XD2 默认流派含它）。
>
> ⚠️ 缺省值走 `normal` 而非 `dim` —— 拿不到亮度时不做负面假设。

### 2.7 星曜类型名单（`TOUGH_STARS` / `SOFT_STARS`）

> 煞星名单：与 `SOFT_STARS` 同为 `mapStarType` 的**硬编码优先名单**：名字在表内
> 就先定类型，不再看 iztro 的 `type` 字段（判定顺序见该函数）。
>
> ⚠️ 改这张表会改变 `Star.type`，进而改变 `patterns/` 的格局命中 ——
> `npm test` 的语料回归盯着这条链路，别顺手加星。

> 吉星名单：与 `TOUGH_STARS` 同为 `mapStarType` 的**硬编码优先名单**。两表**不重叠**，
> 顺序上煞星先判 —— 若将来往两表里加同名星，`tough` 会赢。
>
> ⚠️ 同 `TOUGH_STARS`：改表即改格局命中，`npm test` 会盯着。

`mapStarType` 判定优先级从高到低：① 命中 `TOUGH_STARS` → `tough`；② 命中 `SOFT_STARS` → `soft`；
③ iztro 的 `type`（转小写后比对，中英文皆认）；④ 兜底 `minor`。
注意 `major` **只能**由 iztro 的 `type` 给出 —— 两张名单里没有主星。

### 2.8 五行局解析（`parseWuxingJu`）

> 取**首字五行**查 `ELEMENT_TO_JU`：五行与局数是固定的一一对应
> （水二 / 木三 / 金四 / 土五 / 火六），首字已足以定局数，无须解析后面的数字。
> 这同时免疫了写法变更 —— 局名里的数字是中文还是阿拉伯（「水二局」/「水2局」）都不影响结果。
>
> ⚠️ 兜底返回 3（木三局）而**不抛错** —— 与 `projectPalaceName` 的严格口径相反。
> 差别在于局数不参与安星（安星由 iztro 完成，此值只随盘输出），猜错的代价低于中断排盘；
> 宫名则是下游一切索引的键，错不起。

### 2.9 `generateChart` 的组装纪律

> **只做组装、不做推算**：调 iztro 排盘 → 逐宫翻译宫名与星曜 → 算虚岁与当前大限
> → 补借对宫字段。命理逻辑一律不在此处重复实现。
>
> **大限四化已主动下线**：不再生成 `decadals[].mutagen` / `stemIndex`（飞星派口径）。
> 体系立场见仓库根 `CLAUDE.md` 与 `SKILL.md` 的「体系口径」章节。

- **干支查表失败即抛错**（逐宫循环内）：
  > `branch` / `stem` 是下游一切索引的键（宫位定位、三方四正、大限、格局判定全按它查），
  > 查表失败若静默兜底 0，会出现「两宫同指子位」且零信号 —— 与 `projectPalaceName`
  > 同一纪律：宁可当场失败，也不静默产出错盘。`BRANCHES` / `STEMS` 覆盖全部十二支十干，
  > 正常情况下 `indexOf` 不可能失败；真失败即说明 iztro 输出已损坏。
- **亮度覆写（混合口径）**：
  > 亮度走文墨 SB 表覆写（XD2 默认）：查表命中 → `brightness` 按细档塌缩 + `brightnessRaw`
  > 记中文细档（主辅杂曜同表）；未收录 / 留白 → 主星回落 iztro 原值，辅杂曜不带亮度。
- **虚岁（⚠️ 最易错的一处）**：
  > `currentAge` 是**虚岁**，与 `decadalRange` / `decadals[].startAge` 同域（倪师《天纪》亦用虚岁）。
  > 以农历年（正月初一）为界，不是生日、也不是立春 —— 与 iztro 的默认口径
  > `ageDivide: 'normal'` 逐字对应（见 `iztro/lib/astro/FunctionalAstrolabe.js`）：
  >     `nominalAge = 目标日农历年 − 出生农历年 + 1`
  >
  > ⚠️ 不可写成 `new Date().getFullYear() - year`（那是周岁）。两者域不同会让
  > `currentAge` 偏 1~2 岁，并连带 `currentDecadalIndex` / `palace.isCurrentDecadal` 错位，
  > 最坏情况是把**上一个大限的宫**当成当前大限整宫详批。
- **借对宫字段**：
  > 对宫算式取自 `./palace-relations` —— 全仓对宫偏移的单点，本字段与它同源。
- **命宫 / 身宫地支**：
  > 命宫 / 身宫地支必在十二宫内，这是排盘不变量（`cli/chart/render.ts` 的 `palaceAtBranch` 同样
  > 依赖它）；查不到即内核输出已已损坏，当场报错而非兜底 0（理由同上方宫循环的干支校验）。
- **紫微星位置**：
  > 紫微必上盘（安星法的锚点），找不到即内核输出已损坏 —— 兜底 0 会静默指向子位错盘。
- **大限数组**：
  > 倪师《天纪》正统：四化永远固定，大限只看宫位移动。
  > 不再生成 `decadals[].mutagen` / `stemIndex` / `stemName`（飞星派字段已下线）。
- **命主 / 身主 / 子年斗君**：
  > 命主身主：iztro 由命/身宫地支查表定星，原样取用（不重复实现查表）。
  > 斗君：子起正月逆数至生月，生月宫起子时顺数至生时。iztro 静态盘不带，故按口诀自推。
  > 闰月按所闰之月数计（`lunarMonth` 已 `Math.abs`）；晚子时（`timeIndex` 12）按子时论（`%12`）。
  > 校准样例：2000-4-6 子时（三月）= 戌、1990-05-15 巳时（四月）= 寅（见 `cli/selftest/index.ts`）。
- **宫干自化已下线**（倪师不主张飞星派宫干自化论）。

---

## 三、`palace-relations.ts`：宫位地支关系

### 3.1 为什么单独成模块

> 这两组偏移在本仓曾被**多处各写一遍**，且绝大多数副本没有名字，只靠注释声明「与某处
> 同源」维持一致 —— 改一处不会有任何东西发现：
>
> - **对宫** `(x + 6) % 12`：`algorithm.ts`（填 `Palace.oppositeBranch` 字段）、
>   `patterns.ts` 6 处、`analysis.ts` 6 处、`cli/commands/index.ts` 1 处
> - **三方四正** `[b, (b+4)%12, (b+8)%12, (b+6)%12]`：`patterns.ts` 2 处、
>   `analysis.ts` 3 处（本命借对宫 / 大限会照 / 流年会照）、`cli/chart/render.ts` 1 处
>
> 本模块是它们的单点：偏移算式**只在这里出现**，其余模块一律引用。

### 3.2 ⚠️ 刻意**不**收敛的三处（独立预言机）

> `test/invariants.test.ts`（验 `Palace.oppositeBranch` 与 `borrowedFromBranch`）与
> `test/tools/year-scan.ts`（空宫借宫恒等式）里各有**内联**的 `(branch + 6) % 12`。
> 那是有意为之的**独立预言机** —— 用「内核之外的重算」去验内核填的字段对不对；
> 改成引用本模块就成了拿内核验内核，恒真、失去验证力。见到那几处**不要**顺手单点化。
>
> 判据是「这份重算是在**产出**结果还是在**核对**结果」：产出的一律收敛到本模块，
> 核对的必须留在原地。

### 3.3 顺序：偏移序，不是 `palaces` 序

> `surroundBranches` 返回**偏移序**（本宫 → 官禄 → 财帛 → 迁移），而
> `ZiweiChart.palaces` 的数组序是地支序（实测寅起，见 `types.ts`）。两者在本仓都有真实
> 用途，且都**逐字进了输出**（`analysis/` 的「大限三方四正会照的本命四化」就是一个
> 按 `palaces` 序 push 的字符串数组），故本模块只给地支、不替调用方选顺序 ——
> 要 `palaces` 序的自行 `chart.palaces.filter(p => surroundBranches(b).includes(p.branch))`。

### 3.4 依赖

> 偏移函数**纯算术**（入参与返回值全是 `number`，无任何 import）；按地支取宫的
> 两个查询函数（`palaceAtBranch` / `mustPalaceAtBranch`，候选 8 新增）
> 引 `./types` 的类型（type-only，运行时擦除）与 `./constants` 的 `BRANCHES`
> （纯表零依赖）—— 无环，本模块仍处内核依赖图叶子附近。

### 3.5 各函数的 ⚠️ 与来历

- `oppositeBranch`：
  > `algorithm.ts` 填 `Palace.oppositeBranch` 字段用的就是本函数 —— 字段与算式同源，
  > 手里已经有 `Palace` 对象时直接读字段即可，不必绕本函数。
  >
  > ⚠️ 入参恒为 0–11（`Palace.branch` 与 `ZiweiChart.soulBranch` 的定义域），故**不做**
  > 两步取模 —— 越界入参会返回越界值，由调用方负责。
- `SAN_FANG_OFFSETS`：
  > 十二宫由命宫**逆行**排布，故官禄在 `+4`、财帛在 `+8`、迁移在 `+6`（**不是**顺行）。
  > 校验见 `test/invariants.test.ts` 的「宫名与相对命宫的逆行偏移一致」。
  >
  > ⚠️ 迁移那一项与 `oppositeBranch` 是同一个事实（对宫），此处按三方四正的次序写进
  > 表里而非调 `oppositeBranch(+6)` —— 四个偏移同表可一眼看全，`+6` 在本表内不会再变。
- 按地支取宫（候选 8 收敛）的来历：
  > 此前同一查表写在两处且语义各半：`patterns/helpers.getPalaceByBranch` 两步取模、
  > 可缺省返回；`cli/render.palaceAtBranch` 不取模、取不到必得（抛错文案含 `what`）。
  > 两函数现收进本模块，各自的语义原样保留 —— 薄壳留在原处，调用方一行不用改。
- `palaceAtBranch`（取不到返回 `undefined`，两步取模）：
  > `((branch % 12) + 12) % 12` 把入参规整到 0–11。调用点因此可以直接写
  > `(branch + 11) % 12` 这类偏移算式而不必再判界。
  >
  > 与 `mustPalaceAtBranch` 的分工：**可能缺席**的查询用本函数（对宫/夹宫的极端输入），
  > **必在盘上**的语义用必得版（命宫/身宫的排盘不变量）。
- `mustPalaceAtBranch`（取不到直接抛错，**不取模**）：
  > 命宫 / 身宫地支必定落在 `palaces` 内，这是排盘不变量；取不到即说明内核输出已损坏。
  > 项目一贯立场：宁可当场失败，也不要渲染出一张缺了命宫的盘。
  >
  > ⚠️ 与 `palaceAtBranch` 不同，本函数**不做取模**：越界入参会按原样匹配不到
  > 而抛错（文案里 `BRANCHES[branch]` 越界时回退显示数字），与旧 render 实现一致。

---

## 四、`mutagen.ts`：六层四化

### 4.1 模块定位（原模块头）

> 四化工具模块 —— 生年 / 流年 / 流月 / 大限宫干 / 流日 / 流时六层四化的映射查询。
>
> 本模块是**纯查表 + 纯算术**：输入天干索引（或公历年 / 农历月日），输出「禄权科忌」各自对应的
> 星名。生年四化本身由排盘层（`algorithm.ts`）从 iztro 的 `mutagen` 字段直接落到 `Star.mutagen`
> 上，这里不参与安星，也不产出任何盘面字段。
>
> **六层四化（本模块接口的全部）**
> - 生年四化（本命）= 出生年天干四化，静态基础，落在 `Star.mutagen` 上（本模块不参与）
> - 流年四化 = 当年年干的四化，一年动态（`getYearlyMutagen`）
> - 流月四化 = 月柱天干（五虎遁）的四化，一月动态（`getMonthlyMutagen`）
> - 大限四化 = **大限宫干**的四化，十年动态（`getDaXianMutagen`）
> - 流日四化 = 农历日柱天干的四化，一日动态（`getDailyMutagen`）
> - 流时四化 = 时柱天干（五鼠遁）的四化，一时辰动态（`getHourlyMutagen`）

### 4.2 体系口径：文墨排盘 + 倪师论断（混合口径）

> - **排盘与运限四化以文墨天机为准**——大限四化取大限宫干（非本命年干）是文墨排盘
>   展示层的口径，与流年/流月/流日/流时同属「时间干四化」，随上游 2026-10 混合口径引入。
> - **论断框架仍按倪师三合派**：命宫为本，三方为用；人事努力 + 地理调整 > 先天命运
>   （2/3 > 1/3）；大道至简，解读不停留在术语堆砌。
> - 论断层引用大限宫干四化时仍按「落宫与会照」组织（化 X 落某宫 → 该宫主管领域受引动），
>   不引入「飞入飞出」的飞星派论法。

### 4.3 ⚠️ 体系红线：本模块不含宫干自化与来因宫

> 以下两件飞星派工具在本项目**继续禁用**，本模块不提供对应函数，`algorithm.ts` 也不填充
> 相关盘面字段：
> - ❌ **宫干自化** —— 某宫宫干引发的四化中被化星恰在本宫（`Palace.selfMutagen` 恒不填）
> - ❌ **来因宫** —— 追溯某化星由哪个宫的宫干「飞」来的飞星派追溯法
>
> ⚠️ **`types.ts` 的绊线刻意保留**：`Palace.selfMutagen` / `Decadal.mutagen` 两个字段与
> `SelfMutagenMark` / `DecadalMutagen` 两个类型仍在，理由是它们的作用**恰恰是「留着但不填」**
> —— 断言要盯的是「有没有被填回」，字段没了就无从盯起。大限宫干四化走本模块的
> `getDaXianMutagen` 纯函数层（调用方传大限索引、返回四化记录），**不往 `Decadal`
> 结构上加字段** —— `school.test.ts` 的「大限键集合全等」断言继续有效。
>
> 完整立场见仓库根 `CLAUDE.md` 的「体系口径」一节与 `SKILL.md` 的同名章节。

### 4.4 各函数的 ⚠️ 与来历

- `getMutagenByStem`：
  > ⚠️ 索引越界（`SI_HUA_TABLE[stemIndex]` 取空）时返回**四项皆为空串**的记录而**不抛错** ——
  > 调用方靠空串自然短路。这与 `algorithm.ts` 的 `projectPalaceName`（未命中即抛错）是
  > 相反的取舍：宫名是下游索引的键，错不起；此处越界的代价只是算不出四化。
- `getYearStemIndex`（`((year − 4) % 10 + 10) % 10`，公元 4 年为甲子年）：
  > ⚠️ **按公历年直接取模，不做农历年或节气的边界切换**：1–2 月出生者，其年柱按农历
  > 口径可能仍属上一农历年 —— 此时本函数与 `algorithm.ts` 的 `getLunarInfo` 返回的
  > `lunarInfo.yearStem`（由 `lunar-typescript` 算出的农历年干）会**相差一位**。
  > 两者用途不同：本函数**只服务流年四化**（用户问「2026 年运势」即指公历年份对应的
  > 干支年，取模恰好正确）；**生年四化必须用 `chart.lunarInfo.yearStem`** —— 盘面上
  > iztro 的 `Star.mutagen`（mutagen）按农历年干标注，生年若走公历取模，1–2 月出生者
  > 的【生年四化】区块会与宫详表自相矛盾（实测 1990-01-15：农历己巳 vs 公历庚）。
  > `test/cli.test.ts` 的「生年四化的年干口径」一节盯着这条红线。
- `getYearlyMutagen`：年干走 `getYearStemIndex`（纯取模），同样按公历年、不做农历年边界切换；
  本函数**不涉及**任何宫干。
- `getMonthlyStemIndex`（五虎遁）：
  > 五虎遁口诀：甲己年起丙寅、乙庚年起戊寅、丙辛年起庚寅、丁壬年起壬寅、戊癸年起甲寅。
  > 函数内的 `startStemOfYin` 表即把「年干索引 → 正月（寅月）天干索引」固化下来
  > （甲 0 / 己 5 → 丙 2，乙 1 / 庚 6 → 戊 4，丙 2 / 辛 7 → 庚 6，丁 3 / 壬 8 → 壬 8，
  > 戊 4 / 癸 9 → 甲 0），再按 `month − 1` 顺推。
  >
  > ⚠️ 起点是**正月（寅月）**而非子月，故 `month` 是农历月份序号，不是地支索引。
  > 表未命中（`yearStem` 越界）时兜底为 0（甲），属静默兜底 —— 代价只是该月的四化算错，
  > 不影响排盘。
- `getMonthlyMutagen`：由流年干推月干，调用时传 `getYearlyMutagen(...).stemIndex` 而非出生年干；
  闰月的月序换算不在本函数内 —— 调用方先用 `getEffectiveMonthlyMonth` 把「闰月 + 农历日」
  折算成有效月序再传入。
- `getDaXianMutagen`：
  > 这是文墨排盘展示层的口径：大限四化随大限宫位走，宫干来自盘面 `Palace.stem`
  > （五虎遁布局，排盘时已填）。**纯函数层** —— 不往 `Decadal` 结构上加字段，
  > `school.test.ts` 的「大限键集合全等」断言因此继续有效。
  >
  > ⚠️ **童限期（`currentDecadalIndex === -1`，未起运）没有大限宫干可言**，调用方须先判
  > 童限再调本函数，不要传 `-1` —— 传入负下标会拿到 `undefined` 大限并返回 `null`，
  > 语义是「无此大限」，不是「童限」。
- `getDailyStemIndex`：
  > 日柱由 `lunar-typescript` 现算（`Lunar.fromYmd(...).getDayGan()`），不做任何缓存 ——
  > 调用频度低（CLI 单次取数），不值得为它建表。日期非法时 lunar-typescript 会抛错，
  > 本函数捕获后返回 `null`，由调用方转为「流日参数超出该月天数」的中文报错。
- `getHourlyStemIndex`（五鼠遁）：
  > 五鼠遁口诀：甲己日起甲子、乙庚日起丙子、丙辛日起戊子、丁壬日起庚子、戊癸日起壬子。
  > 函数内的 `ziStemByDayStem` 表即「日干索引 → 子时天干索引」，再按 `hourBranch` 顺推。
  >
  > ⚠️ **晚子时（23:00–24:00）按当日日干起遁**（`hourBranch 12` 归一为子 0），不换次日的
  > 日干 —— 与上游文墨排盘展示层一致。传统晚子时派（子时归次日）会连日干一起换，那是
  > 另一套口径；本模块只提供文墨口径这一种。
- `getHourlyMutagen`：粒度到时辰即止 —— 本模块不提供流分；调用方须自备**当日日干**。
- `getEffectiveMonthlyMonth`（闰月流月的 split 半月口径）：
  > split 口径（2026-09 随上游定版，150 组文墨专业版真机对照）：**闰月前半月（农历日
  > ≤ 15）按本月取月干，后半月（> 15）按下月取**；闰十二月后半跨到次年正月时月序回 1、
  > 月干须用**次年干**重推（调用方从返回值 `=== 1` 且 `isLeapMonth` 且日 > 15 自行判断，
  > 取 `options.nextYearStem` 重调 `getMonthlyStemIndex`）。非闰月输入原样返回。

---

## 五、`wenmo-brightness.ts`：文墨星曜亮度

### 5.1 数据与代码的分工（2026-10-11 已落实为物理分层）

> - **数据** → `data/wenmo-tables.ts`：SB 四流派亮度表（83 星 × 12 宫），提取自文墨
>   天机 v2.5.8 反编译整数表（与上游开源仓库逐字同源），由提取脚本生成，**勿手改**——
>   改表先改上游 / 提取脚本再重新生成。
> - **代码** → 本文件：流派单例状态与查询函数。星 ID 映射、两套「数值 → 中文」档位
>   表随数据下沉（它们以 `BrightnessSchool` 为键，是数据的 schema 契约），
>   本文件从数据层引入后对外 re-export。

### 5.2 依赖方向

> `本文件（计算层） → data/wenmo-tables.ts（数据层）` 单向。
> 数据层**不得**反向依赖本文件 —— 这正是 `BrightnessSchool` 类型下沉的原因。

### 5.3 索引口径（对拍复核过）

> - **星 ID 1-based**：`[0]` 行占位；1–14 主星、15–20 六吉、21–28 禄马+六煞、29 起杂曜。
>   实际 83 行（ID 0–82）—— 上游注释写「85 星」是滞后说法，以数据 + 维度自检为准。
> - **宫位列「子起一」**：`[0]` 列占位，1=子 … 12=亥。传入地支索引（子起 0）后取
>   `col = branchIdx + 1`。

### 5.4 两套显示档位

> - QS（全书派）/ XD1（现代修订一）：7 档制 `1庙 2旺 3得 4利 5平 6不 7陷`；
> - ZZ（中州派）/ XD2（现代修订二）：5 档制 `1庙 2旺 3平 4闲 5陷`。
> - 表值 0 = 文墨留白（该宫不标亮度），查询返回 `undefined`。

### 5.5 默认流派

> **XD2（现代修订二）** —— 文墨 APP 默认亮度流派即它（用户实证 + 真盘全 12 宫 27/27）。
> 上游注释里的「default = 全书派」是被 XD2 结论推翻的滞后说法，不要采信。

### 5.6 ⚠️ 状态位置与自检调用点

`currentSchool`（模块级单例，默认 XD2）：

> 与上游一致是**模块级单例**：排盘是同步的，进程内不存在并发覆写窗口。
> CLI 不暴露切换参数 —— 本变量只服务测试（切流派对拍）与未来可选的流派开关。
>
> ⚠️ 本状态**留在本模块而非下沉数据层**：它是可变运行时状态，不是数据。

`validateWenmoBrightness()`：

> 维度自检：四表各 83 行 × 13 列、数值落在对应档位域内。
> 模块加载即跑（排盘启动期的数据完整性防线，坏了当场炸而不是静默错亮度）。
>
> ⚠️ 本函数**必须留在本文件、且必须在此处以语句形式立即调用**：它是排盘启动期的
> 数据完整性防线。拆分时若把它移进 `data/` 的惰性 export，或被 tree-shaking 掉，
> 损坏的表就会静默产出错亮度 —— 防线失效且不可见。
