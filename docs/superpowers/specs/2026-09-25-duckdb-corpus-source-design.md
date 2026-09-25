# 基准工具改用 DuckDB 数据源 — 设计

**日期：** 2026-09-25
**状态：** 待审阅
**影响面：** `test/tools/full-corpus.ts`、`test/tools/build-fixtures.ts`、`package.json`、`test/README.md`、`docs/test/05-corpus-and-blindspots.md`

---

## 一、背景与动机

本项目的排盘基准（518,400 条样本）原先取自 `reference/ziwei-samples-toolkit/samples-out/`，
该目录是**符号链接**，指向上游项目 `~/Code/JSProjects/ziwei-samples-toolkit`（5.5 GB / 720 个
`jsonl.gz` 分片，见 `docs/test/05-corpus-and-blindspots.md` 第 531 行）。

**上游项目与符号链接均已不存在**（2026-09-25 核实：`reference/` 为空目录，链接目标
`No such file or directory`）。语料现在**唯一**的载体是本仓 `db/ziwei.duckdb`（1.8 GB）。

因此本次改造不是「换一种更快的读法」，而是**恢复 corpus 核验能力的唯一途径** ——
在此之前，`npm run test:corpus` 与 `build-fixtures.ts` 都已无法执行。

### 一个必须记下的风险

`db/ziwei.duckdb` 是**孤本**，且**不入版本控制**（1.8 GB，远超 GitHub 单文件上限）。
它一旦丢失，全量核验与基准重建能力将**不可恢复**。建议在仓库之外另做备份，并在
`test/README.md` 中写明这一点。

---

## 二、目标与非目标

### 目标

1. `npm run test:corpus` 与 `build-fixtures.ts` 从 `db/ziwei.duckdb` 取样本，行为与改造前等价。
2. 从关系表重建出的 `BaselineSample` 与旧 jsonl 的对应样本**逐字节一致**（见第五节）。
3. 保持「数据不存在时给出清晰指引并退出」的既有行为。

### 非目标

- **不动内核**（`scripts/`）与 `SKILL.md`。
- **不动 `compare.ts` 的基准契约**（`BaselineSample` / `BaselineChart` / `BaselinePalace` /
  `BaselineDaXian` 的形状）。比对器对数据来源没有立场。
- **不做双数据源**（不保留「有 jsonl 就走 jsonl」的回退分支）。上游语料已不存在，双模式
  只会留下一条永不执行的死代码。这与 CLAUDE.md 记录的 `pickRoot()` 立场一致：刻意不做
  「实时内核 vs 分发副本」的双模式。
- 不使用 `topics` / `topic_dict` / `topic_lines` 三张表（673 万行，是原语料中单条体积占
  90% 的论断文本；基准已在 `build-fixtures.ts` 中刻意剔除）。

---

## 三、DuckDB 数据结构与重建可行性

### 表结构（`ziwei` 库，`main` schema）

| 表 | 行数 | 用途 |
|---|---|---|
| `samples` | 518,400 | 样本主表：出生信息 + 农历 + 盘级标量 |
| `palaces` | 6,220,800 | 每样本恒 12 行：宫位 + 星曜 + 大限区间 |
| `topics` / `topic_dict` / `topic_lines` | 518,400 / 21,435 / 6,739,200 | 本次不用 |

`sample_id` 为 1..518400，连续无重复。语料范围 `1924–1983` × 12 月 × `hour 0–11` × 2 性别，
与 `full-corpus.ts` 的 `YEAR_ALL = {start:1924, end:1983}` 一致。

### 已核实的关键事实

以下每一条都经过实测（`duckdb -readonly` 查询 + 对 300 条既有 fixtures 的统计），
是重建逻辑的**事实基础**，不是推断：

| 事实 | 核实方式 |
|---|---|
| `palaces` 每样本恒 12 行，`daxian_start/end` 无空值 | `HAVING count(*)<>12` → 0 条 |
| 每样本恒有 12 个不同大限区间，为连续十年段 | `HAVING count(DISTINCT daxian_start)<>12` → 0 条 |
| 宫名是 **iztro 原生口径**（有「仆役」、无「交友」） | `SELECT DISTINCT palace_name` → 12 个 |
| `major_brightness` 已是三档 `bright`/`normal`/`dim` | 与 fixtures 逐值一致 |
| `fixtures` 与 DuckDB 是**同一次快照** | 两者 `currentAge` 均为 102、`currentDaXianIndex` 均为 9 |

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

| 库中列 | 去处 |
|---|---|
| `year` `month` `day` `hour` `gender` `longitude` | `birthInfo` **与** `chart.birthInfo` |
| `lunar_year` `lunar_month` `lunar_day` `year_stem` `year_branch` `is_leap_month` | `chart.lunarInfo`（六字段一一对应） |
| `ming_gong_branch` `shen_gong_branch` `wuxing_ju` `wuxing_ju_name` `ziwei_pos` | 同名标量 |
| `current_age` `current_daxian_index` | 同名标量，**原样带入不重算** |

> ⚠️ `chart.birthInfo` 在 `BaselineChart` 接口中**没有声明**，但 fixtures 的每一行都有它 ——
> 它是 `JSON.parse` 带进来的多余字段，而 `build-fixtures.ts` 写盘时 `JSON.stringify` 会原样保留。
> 重建时**必须**填上，否则重写出的 `charts.jsonl` 会凭空少一个字段。

#### `palaces` 12 行 → `palaces[]`

**必须显式排序**：库中行的物理顺序是 `[1,0,11,…,2]`（丑起逆序），而 fixtures 的 `palaces`
数组是 `[2,3,…,11,0,1]`（寅起）。排序表达式 `ORDER BY (branch + 10) % 12`。

单宫映射：

| 库中列 | 去处 |
|---|---|
| `branch` `stem` | 同名 |
| `palace_name` | `name`，**原样保留 iztro 口径**（如「仆役」） |
| `daxian_start` `daxian_end` | `daXianAge: [起, 讫]` |
| `is_ming_gong` `is_shen_gong` `is_current_daxian` | 同名 |

宫名的翻译**不在这里做** —— 与旧行为一致，由 `compare.ts` 的 `normalizePalaceName`
施加在 baseline 一侧。数据源保持原样，比对器负责口径转换。

#### 星曜装配

顺序恒为 **major → lucky → sha → minor**（实测吉煞星不交错，四段直接拼接即可）：

| 库中列 | type | 附加字段 |
|---|---|---|
| `major_stars[i]` | `major` | `brightness: major_brightness[i]`（按下标配对）、`siHua` |
| `lucky_stars[]` | `lucky` | `siHua`（按下方规则决定是否带此键） |
| `sha_stars[]` | `sha` | 无 |
| `minor_stars[]` | `minor` | 无 |

#### `siHua` 键的存在性 —— 本次最隐晦的一条规则

`algorithm.ts` 组装星曜时一律写 `siHua: s.mutagen`，而 `JSON.stringify` 会**省略值为
`undefined` 的键**。因此「有 `siHua` 键但值为 `""`」与「完全没有 `siHua` 键」是两种不同的
JSON，取决于 iztro 原始数据是否给了 `mutagen` 字段。

对 300 条 fixtures 的统计显示，该差异**按星名恒定**：

- 恒有键：`左辅` `右弼` `文昌` `文曲`（+ 全部主星）
- 恒无键：`天魁` `天钺` `禄存` `天马`（+ 全部煞星、全部杂曜）

这**恰好等于十干四化表覆盖的 15 颗星**。故规则可从内核现成常量算出：

```js
// 键存在 ⟺ 是主星，或星名落在四化表取值集合内
const SIHUA_STARS = new Set(Object.values(SI_HUA_TABLE).flat());
const hasKey = (type: Star["type"], name: string) => type === "major" || SIHUA_STARS.has(name);
```

值从 `palaces.sihua_stars`（格式 `'贪狼:忌'`）解析；该星无四化时填 `""`。

> ⚠️ `SI_HUA_TABLE` 来自 `scripts/ziwei/constants.ts`，必须经 `loadConstants()` **动态**获取，
> **不能**在文件顶层静态 `import` —— ESM 的静态 import 在 `loader.ts` 注册解析钩子**之前**
> 就完成了链接，那时 `@/ziwei/constants`（`.ts`）还解析不了。`compare.ts` 取
> `IZTRO_TO_PROJECT_PALACE` 时已是同样处理，照抄即可。
>
> **为什么这条必须较真**：`compare.ts` 的 `val()` 把 `""` 与 `undefined` 归一化，所以
> 搞混了 `npm test` **也不会红** —— 但 `charts.jsonl` 会 diff。靠测试发现不了，
> 只能靠第五节的零 diff 验收。

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

| 文件 | 改动 |
|---|---|
| `full-corpus.ts` | `SAMPLES` 常量与 `forEachSample` / `shardPath` 实现移除，改调 `sample-source`；`--year` / `--month` / `--limit` 语义不变 |
| `build-fixtures.ts` | `readShard` / `pickFrom` 移除，改调 `fetchSample` |

> ⚠️ `build-fixtures.ts` 旧的 `pickFrom` 用**下标算址**：`idx = (day-1)*24 + hour*2 + genderIdx`。
> 它隐含假设「每月每天都齐 24 条样本」。改成按五元组主键查询后，这个假设**不再需要**，
> 语义更正确。但这意味着：若重建结果与既有 `charts.jsonl` 有 diff，**先怀疑旧实现曾经
> 错位取数**，而不是直接断定新实现有错。

### 4.5 错误处理

沿用旧实现「给出可执行指引后退出」的风格，两个分支：

| 情形 | 指引 |
|---|---|
| `@duckdb/node-api` 未安装 | 在 skill 根执行 `npm install` |
| `db/ziwei.duckdb` 不存在 | 说明该文件不入版本控制、体积 1.8 GB、需自行放入或其唯一副本已丢失 |

`full-corpus.ts` 原先的「跳过缺失分片并计数」逻辑**移除** —— 单一数据文件不存在时，
不存在「部分缺失」这种中间状态。

---

## 五、验收标准

> **用新实现重建 300 条 fixtures，与现有 `charts.jsonl` 逐字节一致：**
> `node test/tools/build-fixtures.ts && git diff --exit-code test/fixtures/charts.jsonl`

这是本次改造的**硬性验收门槛**，理由：本次映射规则里有多处隐晦约定（`siHua` 键存在性、
星序、宫序、`chart.birthInfo` 的存在），它们**全都不影响 `npm test` 的结果**（比对器或按名
索引、或做了 `val()` 归一化），因此**只有零 diff 能一次性证明全部正确**。

出现 diff 时的处置顺序：

1. 先查**旧实现的下标算址是否曾经错位**（见 4.4 的警告）—— 用旧 jsonl 已不可得，
   只能靠逐条比对重建结果与 fixtures，判断哪一侧的样本组合更自洽。
2. 确认是映射规则写错 → 修正映射，回到第 1 步。
3. **不得**直接把新结果覆盖上去当基准。基准是负债还是保障，取决于它有没有被审阅过。

### 测试安排

| 层 | 内容 | 何时跑 |
|---|---|---|
| 零 diff 验收 | 重建 300 条 fixtures 与既有 `charts.jsonl` 逐字节一致 | 手动，重建基准时（数秒） |
| 全量核验 | `npm run test:corpus`（518,400 条） | 手动，约 2.3 小时 |
| 日常回归 | `npm test` —— **不受本次改造影响** | 每次 |

> ⚠️ **日常回归必须继续在「无 `db/ziwei.duckdb`、无 DuckDB 依赖」的环境下跑通。**
> `fixtures` 已入库的设计意图正是如此（见 `test/README.md`）。因此本次**不往 `npm test`
> 里新增依赖数据文件的用例** —— 零 diff 验收是手动执行的构建步骤，不是回归测试。
> 若将来确要加入，必须做**显式跳过**（文件或依赖缺失时 skip 而非 fail）。

---

## 六、依赖变更

`package.json` 的 `devDependencies` 增加：

```json
"@duckdb/node-api": "1.5.5-r.5"
```

**精确锁定版本**，与 `iztro` / `lunar-typescript` 的既有风格一致。选定 `1.5.5-r.5` 是因为
它与开发机上的 `duckdb` CLI（v1.5.5）同源，不会引入 DuckDB 存储格式的版本差异。

> ⚠️ 该包带平台相关原生二进制，`npm install` 体积会显著增加。它对**运行 skill 本身**
> 没有任何影响 —— 只有两个手动执行的测试工具用到它。

---

## 七、需要同步更新的文档

改造落地后，以下两处对数据源的描述会失效：

| 文件 | 位置 | 现状 | 应改为 |
|---|---|---|---|
| `test/README.md` | 第 3、271、289、336 行 | 「`reference/ziwei-samples-toolkit`（5.5 GB，不入版本控制）」 | 指向 `db/ziwei.duckdb`（1.8 GB），并写明孤本备份建议 |
| `docs/test/05-corpus-and-blindspots.md` | 第 4、16、222 行 | 同上的数据集描述 | 同上 |
| `docs/test/05-corpus-and-blindspots.md` | 第 531–533 行 | 「本仓 `reference/` 此前为空目录 —— 已以**符号链接**接入」 | 该链接与上游项目均已不存在，改为记述 DuckDB 形式的迁移 |

**不需要改**：`SKILL.md` 第 188、333 行提到的 `reference/ziwei-samples-toolkit/` 是指
`db-analysis.ts` 的**历史出处**，与 corpus 数据源无关，改造后该描述依然属实。

---

## 八、未决问题

无。所有映射规则的可行性均已实测确认，验收标准为机器可判定。
