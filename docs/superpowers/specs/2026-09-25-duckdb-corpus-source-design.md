# 基准工具改用 DuckDB 数据源 — 设计

**日期：** 2026-09-25
**状态：** 待审阅
**影响面：** `test/tools/full-corpus.ts`、`test/tools/build-fixtures.ts`、`test/tools/verify-source.ts`（新增）、`test/lib/sample-source.ts`（新增）、`package.json`、`.gitignore`、`test/README.md`、`docs/test/05-corpus-and-blindspots.md`

---

## 一、背景与动机

本项目的排盘基准（518,400 条样本）取自 `reference/ziwei-samples-toolkit/samples-out/`。
2026-09-25 实测：该目录是**实体目录**（非符号链接），内含 5.5 GB / 720 个 `jsonl.gz` /
60 个年份目录（`year-1924` … `year-1983`），分片可正常解压读取，旧实现此刻仍能跑通
（`npm run test:corpus -- --limit 5` 零差异通过）。

同一份语料现已**等价地**载入 `db/ziwei.duckdb`（1.8 GB）。本次改造把基准工具的数据源
换成 DuckDB，动机是三条工程收益：

1. **单文件代替 720 个分片** —— `--year` / `--month` 从「拼路径 + 判文件存在」变成 SQL 谓词，
   「跳过缺失分片并计数」这类中间状态随之消失。
2. **体积降到约 1/3** —— 1.8 GB 对 5.5 GB。
3. **可直接 SQL 探查** —— 核对排盘不变量（每样本恒 12 宫、大限区间连续等）不必再写一次性脚本。

> ⚠️ **本文档早期版本含一处事实错误，已更正，且更正带来设计变更。**
> 该版本断言「上游项目与符号链接均已不存在，`db/ziwei.duckdb` 是孤本，语料唯一载体是它」。
> 这是 2026-09-25 的一次误判：核查时用了 `ls`，而本机 `ls` 是指向
> `eza -al --git-ignore` 的**别名**，会把 `.gitignore` 覆盖的 `reference/`、`db/`
> 显示成空目录。据此又去比对文档记载的外部路径（该路径确实不存在），两个错误叠加成了
> 「语料已丢失」的结论。
>
> 更正后的设计后果：**jsonl 语料与 DuckDB 并存，前者可作为后者重建结果的独立参照物**。
> 因此第五节验收标准从「对 300 条 fixtures 零 diff」升级为**逐条互验**（4.5）。
> 核查被 gitignore 的路径时，一律用 `find` / `stat` / `du`，不用 `ls`。

---

## 二、目标与非目标

### 目标

1. `npm run test:corpus` 与 `build-fixtures.ts` 从 `db/ziwei.duckdb` 取样本，行为与改造前等价。
2. 从关系表重建出的 `BaselineSample` 与 jsonl 原始样本**逐字节一致**，且该等价性由一个
   可复跑的互验工具证明，而非一次性人工核对（4.5、第五节）。
3. 保持「数据不存在时给出清晰指引并退出」的既有行为。

### 非目标

- **不动内核**（`scripts/`）与 `SKILL.md`。
- **不动 `compare.ts` 的基准契约**（`BaselineSample` / `BaselineChart` / `BaselinePalace` /
  `BaselineDaXian` 的形状）。比对器对数据来源没有立场。
- **不做双数据源**（不保留「有 jsonl 就走 jsonl」的回退分支）。jsonl 语料**仍在**，但基准
  工具的数据源只认 DuckDB：留回退分支等于让两条读取路径长期并存，而它们的等价性只在
  互验那一刻被检查 —— 那正是最容易悄悄漂移的形态。jsonl 的定位是**验收期的参照物**
  （4.5），不是运行时备选。这与 CLAUDE.md 记录的 `pickRoot()` 立场一致：刻意不做
  「实时内核 vs 分发副本」的双模式。
- 不使用 `topics` / `topic_dict` / `topic_lines` 三张表（673 万行，是原语料中单条体积占
  90% 的论断文本；基准已在 `build-fixtures.ts` 中刻意剔除）。

---

## 三、DuckDB 数据结构与重建可行性

### 表结构（`ziwei` 库，`main` schema）

| 表                                      | 行数                         | 用途                                   |
| --------------------------------------- | ---------------------------- | -------------------------------------- |
| `samples`                               | 518,400                      | 样本主表：出生信息 + 农历 + 盘级标量   |
| `palaces`                               | 6,220,800                    | 每样本恒 12 行：宫位 + 星曜 + 大限区间 |
| `topics` / `topic_dict` / `topic_lines` | 518,400 / 21,435 / 6,739,200 | 本次不用                               |

`sample_id` 为 1..518400，连续无重复。语料范围 60 年 × 12 月 × 30 日 × 12 时辰 × 2 性别
= 518,400（`hour` 列是 0–11 的**时辰序号**，不是 24 小时制的小时），
与 `full-corpus.ts` 的 `YEAR_ALL = {start:1924, end:1983}` 一致。

### 已核实的关键事实

以下每一条都经过实测（`duckdb -readonly` 查询 + 对 300 条既有 fixtures 的统计），
是重建逻辑的**事实基础**，不是推断：

| 事实                                                | 核实方式                                                |
| --------------------------------------------------- | ------------------------------------------------------- |
| `palaces` 每样本恒 12 行，`daxian_start/end` 无空值 | `HAVING count(*)<>12` → 0 条                            |
| 每样本恒有 12 个不同大限区间，为连续十年段          | `HAVING count(DISTINCT daxian_start)<>12` → 0 条        |
| 宫名是 **iztro 原生口径**（有「仆役」、无「交友」） | `SELECT DISTINCT palace_name` → 12 个                   |
| `major_brightness` 已是三档 `bright`/`normal`/`dim` | 与 fixtures 逐值一致                                    |
| `fixtures` 与 DuckDB 是**同一次快照**               | 两者 `currentAge` 均为 102、`currentDaXianIndex` 均为 9 |

### 大限可从 `palaces` 反推

库中**没有** `daXians` 独立表，但每个宫的 `daxian_start` / `daxian_end` 即该宫所辖的大限区间，
12 个宫恰好覆盖 12 个大限。按 `startAge` 升序排列即得 `chart.daXians[]`。
（实测：起运点为 2/3/4/5/6，分别对应水二局至火六局。）

---

## 四、设计

### 4.1 新增模块 `test/lib/sample-source.ts`

唯一懂 DuckDB 与表结构的地方。对外接口：

```js
/** 数据文件路径：<skill 根>/db/ziwei.duckdb */
export const SAMPLE_DB: string;

/** 过滤条件。对应 CLI 的 --year / --month；limit 对应 --limit。 */
export interface SampleFilter {
  year?: number;
  month?: number;
  /** 已读取的样本数上限；达到即停止。 */
  limit?: number;
}

/**
 * 流式遍历样本。回调返回 false 即停止读取。
 * 返回 true 表示读尽，false 表示被回调中止 —— 调用方据此区分「正常结束」与「提前收工」。
 */
export async function forEachSample(
  filter: SampleFilter,
  fn: (raw: BaselineSample) => boolean | void
): Promise<boolean>;

/** 按出生信息精确取一条样本；不存在返回 null。build-fixtures.ts 用。 */
export async function fetchSample(birthInfo: BirthInfo): Promise<BaselineSample | null>;

/** 关闭连接（测试收尾用）。 */
export function closeSource(): void;
```

> `forEachSample` 的 `Promise<boolean>` 返回值是对旧签名的**刻意保留** —— `full-corpus.ts`
> 的 `--limit` 中断逻辑依赖它区分「扫完了」与「够了，停」。不要图省事改成 `void`。

- **连接管理**：惰性单例，首次调用时以 `READ_ONLY` 模式打开，进程退出时自然释放。
- **依赖加载**：`@duckdb/node-api` 走**动态 `import()` 包在 try/catch 中**。它是
  devDependency，可能未安装；顶层静态 import 会让整个文件加载失败，连错误指引都打不出来。
- **类型契约**：返回 `BaselineSample`（从 `./compare.ts` 引入类型），**不新增平行类型**。

### 4.2 重建映射

#### `samples` 行 → `chart` 标量与出生信息

| 库中列                                                                           | 去处                                 |
| -------------------------------------------------------------------------------- | ------------------------------------ |
| `year` `month` `day` `hour` `gender` `longitude`                                 | `birthInfo` **与** `chart.birthInfo` |
| `lunar_year` `lunar_month` `lunar_day` `year_stem` `year_branch` `is_leap_month` | `chart.lunarInfo`（六字段一一对应）  |
| `ming_gong_branch` `shen_gong_branch` `wuxing_ju` `wuxing_ju_name` `ziwei_pos`   | 同名标量                             |
| `current_age` `current_daxian_index`                                             | 同名标量，**原样带入不重算**         |

> ⚠️ `chart.birthInfo` 在 `BaselineChart` 接口中**没有声明**，但 fixtures 的每一行都有它 ——
> 它是 `JSON.parse` 带进来的多余字段，而 `build-fixtures.ts` 写盘时 `JSON.stringify` 会原样保留。
> 重建时**必须**填上，否则重写出的 `charts.jsonl` 会凭空少一个字段。

#### `palaces` 12 行 → `palaces[]`

**必须显式排序**：库中行的物理顺序是 `[1,0,11,…,2]`（丑起逆序），而 fixtures 的 `palaces`
数组是 `[2,3,…,11,0,1]`（寅起）。排序表达式 `ORDER BY (branch + 10) % 12`。

单宫映射：

| 库中列                                            | 去处                                          |
| ------------------------------------------------- | --------------------------------------------- |
| `branch` `stem`                                   | 同名                                          |
| `palace_name`                                     | `name`，**原样保留 iztro 口径**（如「仆役」） |
| `daxian_start` `daxian_end`                       | `daXianAge: [起, 讫]`                         |
| `is_ming_gong` `is_shen_gong` `is_current_daxian` | 同名                                          |

宫名的翻译**不在这里做** —— 与旧行为一致，由 `compare.ts` 的 `normalizePalaceName`
施加在 baseline 一侧。数据源保持原样，比对器负责口径转换。

#### 星曜装配

顺序恒为 **major → lucky → sha → minor**（实测吉煞星不交错，四段直接拼接即可）：

| 库中列           | type    | 附加字段                                                 |
| ---------------- | ------- | -------------------------------------------------------- |
| `major_stars[i]` | `major` | `brightness: major_brightness[i]`（按下标配对）、`siHua` |
| `lucky_stars[]`  | `lucky` | `siHua`（按下方规则决定是否带此键）                      |
| `sha_stars[]`    | `sha`   | 无                                                       |
| `minor_stars[]`  | `minor` | 无                                                       |

#### `siHua` 键的存在性 —— 本次最隐晦的一条规则

`algorithm.ts` 组装星曜时一律写 `siHua: s.mutagen`，而 `JSON.stringify` 会**省略值为
`undefined` 的键**。因此「有 `siHua` 键但值为 `""`」与「完全没有 `siHua` 键」是两种不同的
JSON，取决于 iztro 原始数据是否给了 `mutagen` 字段。

实测（全库扫 2000 条样本、按星名聚合）该差异**按星名恒定、无一混用**，且集合是：

- **恒有键（18 颗）**：14 主星 + `左辅` `右弼` `文昌` `文曲`
- **恒无键（54 颗）**：`天魁` `天钺` `禄存` `天马` 等全部煞星与杂曜

18 这个数**不等于**十干四化表自身的覆盖数。表里 40 个格子去重后是 **15 颗**（11 主星 +
`左辅右弼文昌文曲`），差额来自**终生不参与四化的三颗主星** `天府` `天相` `七杀`——它们有
`siHua` 键（因为 `type === "major"`），值恒为 `""`。故规则拆成两半，正好由两个来源拼出：

```js
// 键存在 ⟺ 是主星，或星名落在四化表取值集合内
const SIHUA_STARS = new Set(Object.values(SI_HUA_TABLE).flat()); // 15 颗
const hasKey = (type: Star["type"], name: string) => type === "major" || SIHUA_STARS.has(name);
// → major 一侧出 14 颗（含天府/天相/七杀），SIHUA_STARS 一侧只额外补进 4 颗辅星 = 18
```

值从 `palaces.sihua_stars`（格式 `'贪狼:忌'`）解析；该星无四化时填 `""`。

> ⚠️ `SI_HUA_TABLE` 来自 `scripts/ziwei/constants.ts`，必须经 `loadConstants()` **动态**获取，
> **不能**在文件顶层静态 `import` —— ESM 的静态 import 在 `loader.ts` 注册解析钩子**之前**
> 就完成了链接，那时 `@/ziwei/constants`（`.ts`）还解析不了。`compare.ts` 取
> `IZTRO_TO_PROJECT_PALACE` 时已是同样处理，照抄即可。
>
> **为什么这条必须较真**：`compare.ts` 的 `val()` 把 `""` 与 `undefined` 归一化，所以
> 搞混了 `npm test` **也不会红** —— 但 `charts.jsonl` 会 diff。靠测试发现不了，
> 只能靠第五节的两层字节级比对验收。

#### `daXians[]`

从 12 个宫的 `daxian_start/end` 重建，**按 `startAge` 升序**：

```js
{ startAge, endAge, palaceBranch: branch, palaceName: palace_name }
```

> ⚠️ 比对器 `compareChart` 对 `daXians` 是**按下标**逐项比的（`aD[i]` vs `bD[i]`），
> 顺序错了会直接报红。这与 `palaces` 按 `branch` 建索引不同。

### 4.3 SQL 形状

**全量遍历**（`forEachSample`）：一条 JOIN 流式读取，按 `sample_id` 分组。

```text
SELECT s.sample_id, s.year, /* …其余 samples 列… */,
       p.branch, p.stem, p.palace_name,
       p.major_stars, p.lucky_stars, p.sha_stars, p.minor_stars,
       p.major_brightness, p.sihua_stars,
       p.is_ming_gong, p.is_shen_gong, p.is_current_daxian,
       p.daxian_start, p.daxian_end
FROM samples s
JOIN palaces p USING (sample_id)
WHERE <过滤条件>
ORDER BY s.sample_id, (p.branch + 10) % 12
```

用 `@duckdb/node-api` 的流式 reader 逐行消费，累积同一 `sample_id` 的 12 行，
遇 id 变化即组装并回调 —— **不把 622 万行一次性读进内存**。

**单条取**（`fetchSample`）：同一 SELECT + `WHERE s.year=? AND s.month=? AND s.day=? AND s.hour=? AND s.gender=?`。

**过滤条件**：`--year` / `--month` 直接变成 SQL 参数（旧的「跳过不存在的分片文件」逻辑随之消失）。

### 4.4 两个调用点的改造

| 文件                               | 改动                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full-corpus.ts`                   | `SAMPLES` 常量与 `forEachSample` / `shardPath` 实现移除，改调 `sample-source`；`--year` / `--month` / `--limit` 语义不变                                          |
| `build-fixtures.ts`                | `readShard` / `pickFrom` 移除，改调 `fetchSample`                                                                                                                 |
| `verify-source.ts`（新增，见 4.5） | 承接 `readShard` 的**顺序读法**作为 jsonl 侧参照实现；`pickFrom` 的下标算址**不承接**（理由见 4.5），但其公式保留在工具内用于「按下标取 vs 按五元组取」的对照输出 |

> ⚠️ `build-fixtures.ts` 旧的 `pickFrom` 用**下标算址**：`idx = (day-1)*24 + hour*2 + genderIdx`。
> 它隐含假设「每月每天都齐 24 条样本」。改成按五元组主键查询后，这个假设**不再需要**，
> 语义更正确。若重建结果与既有 `charts.jsonl` 有 diff，**先怀疑旧实现曾经错位取数**，
> 而不是直接断定新实现有错 —— 4.5 的互验工具正是为查清这一点而设。

### 4.5 验收工具 `test/tools/verify-source.ts`

把「DuckDB 重建 ≡ jsonl 原样」从一次性人工核对变成**可复跑的工具**。这是本次改造的
主要验收手段。

**取样本时刻意不用下标算址。** 旧 `pickFrom` 的 `idx = (day-1)*24 + hour*2 + genderIdx`
隐含「每月每天都齐 24 条」的假设，互验若沿用它，就继承了待验证的假设。改为：

1. 顺序读 jsonl 分片，逐行 `JSON.parse` 取出 `birthInfo`（五元组）；
2. 用这个五元组调 `fetchSample` 向 DuckDB 取同一条；
3. 把 jsonl 行按 `build-fixtures.ts` 的规则裁剪成 `{ birthInfo, chart }`，
   与重建结果**逐字节比对**。

于是「`pickFrom` 是否曾经错位」变成一个可直接证实或证伪的问题：把「按下标取到的样本」
与「按五元组取到的样本」并排看即可（处置流程见第五节）。

**参数**：`--year` / `--month` 限定分片（默认 720 个全跑）、`--limit` 限定条数。

**键序是「逐字节」的必要条件。** `JSON.stringify` 按插入顺序输出键，故重建时
`body` / `chart` / `palaces[i]` / 各星曜的**键插入顺序必须与 jsonl 原始对象一致**。
该顺序可由任意一条样本读出，且对全部样本恒定（同一段生成代码产出）。
报告里要区分**键序不同**与**结构不同**两种差异 —— 前者改重建侧构造顺序，后者是映射写错。

**体积提示**：全量互验要读 5.5 GB jsonl 并查 622 万行 palaces，量级与 `test:corpus`
相当（约 2.3 小时）。日常用 `--year` / `--limit` 抽样即可。

### 4.6 错误处理

沿用旧实现「给出可执行指引后退出」的风格，三个分支：

| 情形                                      | 指引                                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@duckdb/node-api` 未安装                 | 在 skill 根执行 `npm install`                                                                                                                      |
| `db/ziwei.duckdb` 不存在                  | 说明它不入版本控制、体积 1.8 GB；**并指出 `reference/ziwei-samples-toolkit/samples-out` 是同一份语料的原始形态**，可由其重建该库，不必视为数据丢失 |
| jsonl 语料不存在（仅 `verify-source.ts`） | 指向 `reference/ziwei-samples-toolkit/samples-out`，说明它是 5.5 GB 只读语料、不入版本控制；互验需要它，其余工具不需要                             |

`full-corpus.ts` 原先的「跳过缺失分片并计数」逻辑**移除** —— 单一数据文件不存在时，
不存在「部分缺失」这种中间状态。

---

## 五、验收标准

分两层，都由机器判定，**两层都要过**。

### 第一层：jsonl ↔ DuckDB 逐条互验（主要手段）

```text
node test/tools/verify-source.ts                          # 全量 720 个分片
node test/tools/verify-source.ts --year 1962 --limit 500  # 抽样
```

判定：**每一条都逐字节一致**。jsonl 与 DuckDB 是同一份语料的两个载体，不存在引擎版本
噪音，所以这里**没有「已知差异」的容身之处** —— 出现任何 diff 都是重建映射写错了。

### 第二层：fixtures 零 diff（保留）

```text
node test/tools/build-fixtures.ts && git diff --exit-code test/fixtures/charts.jsonl
```

这一层测的是**另一件事**：重建结果经得起 `build-fixtures.ts` 的抽样与写盘流程，产出的
基准与既有 `charts.jsonl` 逐字节相同。

**为什么两层缺一不可**：本次映射规则里有多处隐晦约定（`siHua` 键存在性、星序、宫序、
`chart.birthInfo` 的存在），它们**全都不影响 `npm test` 的结果**（比对器或按名索引、
或做了 `val()` 归一化）—— 只能靠字节级比对兜住。第一层覆盖面大（可推至全量）且无版本
噪音；第二层验证下游写盘链路端到端一致。

### 出现 diff 时的处置顺序

1. 看互验工具报告的是**字节差异还是结构差异**。若仅键序不同 → 改重建侧的键插入顺序。
2. 若结构也不同 → 逐字段定位。特别地，怀疑**旧 `pickFrom` 的下标算址曾经错位**时
   （见 4.4 警告），用互验工具把「按下标取到的样本」与「按五元组取到的样本」并排比对，
   判定哪一侧才是 jsonl 里真实存在的那条。
3. 确认是映射规则写错 → 修正映射，回到第 1 步。
4. **不得**直接把新结果覆盖上去当基准。基准是负债还是保障，取决于它有没有被审阅过。

### 测试安排

| 层           | 内容                                                  | 何时跑                            |
| ------------ | ----------------------------------------------------- | --------------------------------- |
| 逐条互验     | `verify-source.ts`：jsonl ↔ DuckDB 逐字节             | 手动，改造落地时 + 每次改动映射后 |
| 零 diff 验收 | 重建 300 条 fixtures 与既有 `charts.jsonl` 逐字节一致 | 手动，重建基准时（数秒）          |
| 全量核验     | `npm run test:corpus`（518,400 条）                   | 手动，约 2.3 小时                 |
| 日常回归     | `npm test` —— **不受本次改造影响**                    | 每次                              |

> ⚠️ **日常回归必须继续在「无 `db/ziwei.duckdb`、无 DuckDB 依赖、无 jsonl 语料」的
> 环境下跑通。** `fixtures` 已入库的设计意图正是如此（见 `test/README.md`）。因此本次
> **不往 `npm test` 里新增依赖数据文件的用例** —— 上面三层都是手动执行的构建/验收步骤，
> 不是回归测试。若将来确要加入，必须做**显式跳过**（文件或依赖缺失时 skip 而非 fail）。

---

## 六、依赖变更

`package.json` 的 `devDependencies` 增加：

```json
"@duckdb/node-api": "1.5.5-r.5"
```

**精确锁定版本**，与 `iztro` / `lunar-typescript` 的既有风格一致。选定 `1.5.5-r.5` 是因为
它与开发机上的 `duckdb` CLI（v1.5.5）同源，不会引入 DuckDB 存储格式的版本差异。

> ⚠️ 该包带平台相关原生二进制，`npm install` 体积会显著增加。它对**运行 skill 本身**
> 没有任何影响 —— 只有三个手动执行的测试工具用到它（`full-corpus.ts`、`build-fixtures.ts`、
> `verify-source.ts`）。

---

## 七、需要同步更新的文档

改造落地后，以下几处对数据源的描述需要更新（有的会失效，有的需补记两份数据并存的现状）：

| 文件                                    | 位置                             | 现状                                                           | 应改为                                                                                                                                        |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/README.md`                        | 第 3、271、289、336 行           | 只提 `reference/ziwei-samples-toolkit`（5.5 GB，不入版本控制） | 补上 `db/ziwei.duckdb`（1.8 GB）作为基准工具的数据源，并写明**两者并存、互为验证**（不是孤本）                                                |
| `docs/test/05-corpus-and-blindspots.md` | 第 4、16、222 行                 | 同上的数据集描述                                               | 同上                                                                                                                                          |
| `docs/test/05-corpus-and-blindspots.md` | 第 531–533 行                    | 称语料以**符号链接**接入外部项目                               | 实测该目录是**实体目录**（非符号链接）；补记 DuckDB 等价载体已就位，两者并存                                                                  |
| `.gitignore`                            | `reference/` 与 `db/` 两节的注释 | 「语料本身已改以 `db/ziwei.duckdb` 的形式提供」                | 改为：语料仍在 `reference/`，`db/ziwei.duckdb` 是其等价载体；并记下**核查这两个目录不能用 `ls`**（本机 `ls` 是带 `--git-ignore` 的 eza 别名） |

**不需要改**：`SKILL.md` 第 188、333 行提到的 `reference/ziwei-samples-toolkit/` 是指
`db-analysis.ts` 的**历史出处**，与 corpus 数据源无关，改造后该描述依然属实。

---

## 八、未决问题

无阻塞项。所有映射规则的可行性均已实测确认，验收标准为机器可判定。

一处留待实现时落实（不阻塞设计）：重建对象的**键插入顺序**需与 jsonl 原始 JSON 对齐。
该顺序可从任意一条样本读出，但尚未逐字段抄录 —— 实现时按第一条样本的键序构造，
再由第一层逐字节互验把关。
