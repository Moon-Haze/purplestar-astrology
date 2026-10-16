# data-tables —— 数据表

本篇覆盖 `scripts/data/`：`index.ts`（门面）· `ganzhi.ts`（干支与宫名）·
`wuxing.ts`（纳音与五行局）· `sihua.ts`（四化与安星表）·
`stars.ts`（主星亮度与释义）· `wenmo-tables.ts`（文墨亮度表，生成物）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`index.ts`：门面与「共享数据层」判据

> 紫微内核数据层门面 —— `scripts/data/` 的统一出口。
>
> ## 分层
>
> `计算层（algorithm / mutagen / wenmo-brightness）→ 数据层（本目录）→ 契约层（types）`
> 单向依赖。本目录**不得**反向 import 计算层，`BrightnessSchool` 因此下沉而非上浮。
>
> ## 域名一览
>
> | 文件 | 内容 | 2026-10-11 前的位置 |
> |---|---|---|
> | `ganzhi.ts` | 十天干、十二地支、十二时辰、宫名序列与映射 | `constants.ts` |
> | `wuxing.ts` | 纳音五行、五行局局数与局名 | `constants.ts` |
> | `sihua.ts` | 生年四化、天魁天钺、禄存、天马 | `constants.ts` |
> | `stars.ts` | 主星亮度表、十四主星释义 | `constants.ts` |
> | `wenmo-tables.ts` | 文墨 SB 四流派亮度表（生成物，勿手改） | `wenmo-brightness.ts` |
>
> ## 使用约定
>
> **优先 import 具体域文件**（`import { STEMS } from "@/data/ganzhi"`），
> 而非本门面 —— 具体到域能在某张表增删 `export` 时把编译错误定位得更准，
> 也让「谁依赖了哪张表」在图上一目了然。本门面服务于需要一次性取多个域的场景
> （引导层启动自检、测试加载器都走这里）。
>
> ⚠️ 本目录是**共享数据层**，判据是「被多个模块消费」。只服务单一消费者的数据表
> 不该放这儿（`cli/birth/cities.ts` 那张城市经度表曾一度单开 `cli/data/`，
> 只有一个消费者，已于 2026-10-13 撤并回它的消费方目录）。

---

## 二、`ganzhi.ts`：索引基与两张必须同集合的表

### 2.1 `STEMS`：全项目天干索引的唯一基准

> ⚠️ 索引基是 **0**；本文件的几张 `Record<number, ...>` 表（四化、天魁天钺、禄存）都以它为键。
>
> 消费者：`algorithm.ts`（由 iztro 的天干名反查索引）、`sihua.ts`、`cli/chart/render.ts`
> （渲染「寅戊」这类宫位干支）、`cli/commands/index.ts`、`cli/selftest/index.ts`。
> `purple-star.ts` 的 `REQUIRED_EXPORTS` 启动自检也盯着它——**改名或删除会让 CLI 启动即失败**，
> 这是有意的（宁可启动失败，也不静默产出错盘）。

### 2.2 `BRANCHES`：与时辰序号、palaces 数组序都不同域

> ⚠️ 与**时辰序号**不同域：后者多一个 12（晚子时），见 `types.ts` 的 `BirthInfo.timeIndex`。
> ⚠️ `ZiweiChart.palaces` 的数组顺序**不是**本数组的顺序（实测为 2,3,…,11,0,1，寅起）。
> 消费者同 {@link STEMS}。

### 2.3 `SHICHEN`：12 项，不含晚子时

> ⚠️ 本表只有 12 项、**不含「晚子时」** —— 晚子时不是第 13 个时辰，而是子时的另一种
> 安星口径（时辰序号 12，见 `types.ts` 的 `BirthInfo.timeIndex`）。
>
> 消费者：`cli/birth/birth-info.ts` 的 `shichenLabel`（拼「巳时(09:00-11:00)」这类提示文案）、
> `purple-star.ts` 的 `REQUIRED_EXPORTS` 自检。**不参与安星**。

### 2.4 `PALACE_NAMES_ORDER` 与 `IZTRO_TO_PROJECT_PALACE`：同集合的两张表

> ⚠️ 与 {@link IZTRO_TO_PROJECT_PALACE} 的分工：这里是**有序序列**，那里是**无序词典**，
> 两者必须**同集合**。`test/invariants.test.ts` 用本数组验证那张映射表，正是为了防
> 「映射表写错了、比对器跟着一起错」的同源盲区（见 `test/README.md`「复读机」那条教训）。
> **增删条目时两张表必须同步**。
>
> ⚠️ 当前 `scripts/` 运行期没有它的消费者（`algorithm.ts` 只在抛错文案里提到它），
> 主要服务于测试侧的不变量校验。

### 2.5 `IZTRO_TO_PROJECT_PALACE`：未命中一律抛错

> ⚠️ 增删条目时同步 `PALACE_NAMES_ORDER`，两边必须同集合。
> ⚠️ 未命中的宫名一律**抛错**而非回退（见 algorithm.ts 的 projectPalaceName）——
>    宫名是十二宫一览、--focus、三方四正、大限、格局判定的公共索引，不能静默降级。

---

## 三、`wuxing.ts`：纳音与五行局

### 3.1 `NAYIN_ELEMENTS`：无消费者的数据留存

> ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**：排盘由 iztro 完成，纳音不参与安星，
> 也没有任何渲染或断言读它。仅为数据留存，**改它不会影响现有输出**。

### 3.2 `ELEMENT_TO_JU`：两处独立预言机盯着

> ⚠️ 改本表会改变 `ZiweiChart.fiveElementsClass`，从而改变 300 条基准的对标结果。两处独立预言机
> 盯着这条映射：`test/invariants.test.ts` 的「五行局取值 2-6 且名称与数字对应」用的是
> 表外自带的字面量表，`test/lib/compare.ts` 比对的 `fiveElementsClass` 则来自 toolkit 的样本快照。

### 3.3 `JU_NAMES`：与 `ELEMENT_TO_JU` 的状态不对等是刻意的

> ⚠️ 当前无消费者：运行时展示的是 iztro 的原文 `ZiweiChart.fiveElementsClassName`，不经本表。
> 它与 {@link ELEMENT_TO_JU} 成对（五行 ↔ 局数 ↔ 局名），仅为数据留存。
>
> 注意本表与 {@link ELEMENT_TO_JU} 的**状态不对等**：后者已被 `parseWuxingJu` 消费，
> 本表仍无消费者，是刻意的数据留存 —— 见到这处不对称不必"顺手补齐"。

---

## 四、`sihua.ts`：四化与安星表

### 4.1 `SI_HUA_TABLE`：全链路都盯着它

> ⚠️ 键是**年干**索引（0=甲 … 9=癸）。本表**不含**宫干四化、流年干四化、自化那种
> 飞星派口径 —— 那些已主动下线（见仓库根 `CLAUDE.md` 的「体系口径」一节）。
>
> 消费者：`sihua.ts` 的 `getMutagenByStem`（生年 / 流年 / 流月三层的公共出口），上承 `cli/commands/index.ts`
> 的生年四化落宫与合盘四化分析。⚠️ 改本表会改变**所有**四化落宫、进而改变格局命中，
> `npm test` 的语料回归盯着这条链路。

### 4.2 三张「无消费者」的安星表

> ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者** —— 天魁天钺由 iztro 安星，
> `algorithm.ts` 的 `SOFT_STARS` 名单只按星名判类型，不查本表。仅为数据留存，
> 改它不会影响现有输出。（`KUIYUE_TABLE`）

> ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**（禄存由 iztro 安星），仅为数据留存。（`LUCUN_TABLE`）

> ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**（天马由 iztro 安星），仅为数据留存。（`TIANMA_TABLE`）

### 4.3 `TIANMA_TABLE` 的键与 `LUCUN_TABLE` 不同

> ⚠️ 键与 {@link LUCUN_TABLE} **不同**：禄存看年干，天马看年支三合
> （寅午戌→申、申子辰→寅、巳酉丑→亥、亥卯未→巳，即每三个年支共用一个马位，
> 故 12 个键只映射到 4 个值）。

---

## 五、`stars.ts`：亮度表与释义表

### 5.1 `STAR_BRIGHTNESS`：无消费者，运行时走 iztro 亮度

> ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者** —— 运行时的 `Star.brightness` 对**全部**
> 主星都是直接取 iztro 的亮度字、经 `mapBrightness` 归并得来，**未走本表**。
> 仅为数据留存，改它不会影响现有输出。

### 5.2 `STAR_DESCRIPTIONS`：只影响文案，别与线上 `STAR_DB` 混为一谈

> ⚠️ 本表**不参与安星，也不参与格局判定**，只影响文案。增删条目会让 `selftest` 的
> 「星曜释义条数」断言变红。注意：线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）
> **不在本 skill 内**，别把它和本表混为一谈。

---

## 六、`wenmo-tables.ts`：生成物，勿手改

> 文墨天机 SB 亮度表（生成物）—— 装配层逐星覆写的底层数据源。
>
> ## ⚠️ 勿手改
>
> 本文件的 SB 四流派亮度表（83 星 × 12 宫）提取自文墨天机 v2.5.8 反编译整数表
> （与上游开源仓库逐字同源），由提取脚本生成。改表先改上游 / 提取脚本再重新生成。
>
> 2026-10-11 从 `wenmo-brightness.ts` 拆出，**数据部分**下沉至此，查询逻辑留在
> `wenmo-brightness.ts`。仅改变物理位置，数据逐字迁移。
>
> ## 类型归属说明
>
> {@link BrightnessSchool} 类型随数据下沉至此而非留在计算层：SB 表与档位映射以它为键，
> 它是**数据的 schema 契约**。若留在计算层会形成「数据层 → 计算层」的反向依赖，
> 破坏单向性；计算层改为从本模块 import 后向外 re-export。
