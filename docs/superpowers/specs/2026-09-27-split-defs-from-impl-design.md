# 实现与声明分离：`db-analysis.ts` / `birth-info.ts` 的纯搬移拆分

**日期**：2026-09-27
**状态**：设计已批准，待写实现计划
**范围**：`scripts/ziwei/db-analysis.ts`（2407 行）、`scripts/cli/birth-info.ts`（532 行）
**先例**：`scripts/ziwei/patterns.ts` + `patterns-defs.ts`（2026-09-27 完成，同一套分法的首次落地）

---

## 1. 背景与目标

### 1.1 问题

`db-analysis.ts` 2407 行里，**声明侧占 ~1530 行**（`STAR_DB` 一个常量就 815 行），实现侧 ~850 行；`birth-info.ts` 532 行里声明侧 ~160 行、实现侧 ~370 行。两类内容的**读者不同**：改判定逻辑的人被迫翻过几百行数据表，改论断文案的人则要在同一个文件里绕开判定代码。

### 1.2 目标

把**模块级静态声明**（类型 + 常量 / 数据表）搬进独立文件，原文件只留函数。**让改判定的人不必先翻过数据表。**

### 1.3 这是纯搬移，不是重构

- **不改变任何行为**：不碰任何判定逻辑、不调整任何常量取值
- **不改变公开面**：拆分前从这两个模块导出的名字，拆分后**逐名仍在原模块可 import**
- **不新增测试**：正确性由「搬前存基线 → 搬后逐字节比对」一次性作证（见 §7）

---

## 2. 非目标

| 不做 | 理由 |
| --- | --- |
| 不拆 `cli/render.ts` | 声明侧仅 33 行（`FOCUS_ALIASES` 21 + `BRIGHTNESS_CN` 12），拆出的 `-defs` 是空壳 |
| 不拆 `classics/index.ts` | 同上，声明侧仅 25 行 |
| 不动 `nihai/index.ts` | 它是聚合入口，**全文 0 个函数**，没有「实现」这一半可分离 |
| 不按数据族继续细分 `db-analysis-defs.ts` | 给 113 行的 `ZIWU_LIUZHU`、88 行的 `PALACE_BRANCH_ORGAN` 各开文件会让 import 区膨胀，且 `TOPIC_KEY_PALACES` 与 `TopicKey` 本应同处（YAGNI） |
| 不动 `patterns.ts` / `patterns-defs.ts` 的既有结构 | 本次不扩大范围 |
| 不在文档里登记新文件行数 | 按 `docs/test/05` 「后续修正（十二）」已定的方向：行数是纯漂移源 |

---

## 3. 文件结构

### 3.1 拆分后

```text
scripts/ziwei/
├── star-db.ts            🆕 ~830 行   只放 STAR_DB
├── db-analysis-defs.ts   🆕 ~700 行   类型 + 元数据表
└── db-analysis.ts        ✏️  ~880 行   只剩函数 + 公开名 re-export

scripts/cli/
├── birth-info-defs.ts    🆕 ~170 行   4 个 interface + 2 个常量
└── birth-info.ts         ✏️  ~380 行   只剩函数 + 公开名 re-export
```

`STAR_DB` 单独成文件（而非并入 `db-analysis-defs.ts`）的理由：它与其余声明**性质不同**——`STAR_DB` 是**会持续增删的论断文案**（14 主星 × 13 主题的内容库），其余是**改结构才动的映射表与类型**。两者增长曲线不同，改动半径也应分开。

### 3.2 `db-analysis.ts` 逐条归属

| 原行 | 符号 | 原可见性 | 去向 |
| --- | --- | --- | --- |
| 42 | `TopicKey` | export type | `db-analysis-defs.ts` |
| 58 | `TOPIC_PALACE_NAME` | export const | `db-analysis-defs.ts` |
| 74 | `TOPIC_LABEL` | export const | `db-analysis-defs.ts` |
| 91 | `TOPIC_SANFANG_LABELS` | private | `db-analysis-defs.ts` |
| 108 | `STAR_BRIEF` | private | `db-analysis-defs.ts` |
| 134 | `StarSummaryGender` | private interface | `db-analysis-defs.ts` |
| 141 | `StarSummary` | private interface | `db-analysis-defs.ts` |
| 146 | `TopicMod` | private interface | `db-analysis-defs.ts` |
| 155 | `StarContent` | private interface | `db-analysis-defs.ts`，**须改为 export**（`star-db.ts` 与实现文件都要引用） |
| 196 | `STAR_DB` | private const | **`star-db.ts`**，**须改为 export** |
| 1011 | `filterGenderContent` | private fn | 留在 `db-analysis.ts` |
| 1064 | `getPalaceStars` | private fn | 留 |
| 1084 | `getSanFangSiZheng` | private fn | 留 |
| 1098 | `descPalaceStars` | private fn | 留 |
| 1110 | `getPalaceSiHua` | private fn | 留 |
| 1115 | `getSiHuaNote` | private fn | 留 |
| 1135 | `PALACE_BRANCH_ORGAN` | private | `db-analysis-defs.ts` |
| 1223 | `ZIWU_LIUZHU` | private | `db-analysis-defs.ts` |
| 1336 | `KUI_YUE_GUIREN_MAP` | private | `db-analysis-defs.ts` |
| 1361 | `MINOR_STAR_PALACE_CONTENT` | private | `db-analysis-defs.ts` |
| 1477 | `getMinorStarNote` | private fn | 留 |
| 1482 | `PALACE_TO_CONTENT_KEY` | private | `db-analysis-defs.ts` |
| 1498 | `TOPIC_KEY_PALACES` | private | `db-analysis-defs.ts` |
| 1695 | `detectGeJu` | private fn | 留 |
| 1718 | `AnalysisView` | export type | `db-analysis-defs.ts` |
| 1720 | `AnalysisOptions` | export interface | `db-analysis-defs.ts` |
| 1730 | `getTopicAnalysis` | export fn | 留 |

**`db-analysis.ts` 的 re-export 清单（5 个，即原公开面）**：
`TopicKey`、`TOPIC_PALACE_NAME`、`TOPIC_LABEL`、`AnalysisView`、`AnalysisOptions`。

其余 13 个符号原本就是 module-private，**不在公开面上**，因此只需从新文件 export（供跨文件引用），**不需要**在 `db-analysis.ts` re-export。

### 3.3 `birth-info.ts` 逐条归属

| 原行 | 符号 | 原可见性 | 去向 |
| --- | --- | --- | --- |
| 28 | `shichenLabel`（箭头） | private | 留在 `birth-info.ts` |
| 37 | `signed`（箭头） | private | 留 |
| 54 | `equationOfTime` | export fn | 留 |
| 72 | `TrueSolarOptions` | export interface | `birth-info-defs.ts` |
| 84 | `TrueSolarResult` | export interface | `birth-info-defs.ts` |
| 141 | `calcTrueSolar` | export fn | 留 |
| 192 | `shiftDate` | export fn | 留 |
| 207 | `ADMIN_SUFFIX` | private const | `birth-info-defs.ts` |
| 215 | `stripSuffix`（箭头） | private | 留 |
| 220 | `LongitudeHit` | export interface | `birth-info-defs.ts` |
| 241 | `ALL_CITIES` | private const | `birth-info-defs.ts` |
| 255 | `findLongitude` | export fn | 留 |
| 292 | `BirthInfoResult` | export interface | `birth-info-defs.ts` |
| 338 | `buildBirthInfo` | export fn | 留 |

**`birth-info.ts` 的 re-export 清单（4 个，即原公开面）**：
`TrueSolarOptions`、`TrueSolarResult`、`LongitudeHit`、`BirthInfoResult`。

### 3.4 搬移判据（一条，无例外）

> **只搬模块级声明。函数体内的局部常量一律不动。**

`getTopicAnalysis` 函数体内有 3 处被 selftest 扫描的引文（行 2117 / 2333 / 2358）、`buildBirthInfo` 体内的局部表——它们**都留在原处**，因为它们的读者是函数本身，不是翻文件的人。

---

## 4. 依赖方向与 import 约定

### 4.1 依赖图（恒为单向，defs 绝不 import 实现）

```text
db-analysis.ts ──→ db-analysis-defs.ts
      │                    ▲
      └──→ star-db.ts ─────┘        （star-db 只为取 StarContent 类型）
birth-info.ts  ──→ birth-info-defs.ts
```

### 4.2 import 写法（照 `.claude/CLAUDE.md` 的既有约定）

| 位置 | 引兄弟模块 | 引内核 |
| --- | --- | --- |
| `scripts/ziwei/*` | 相对路径不带扩展名（`./db-analysis-defs`） | 同左（内核内部一律相对路径，不用 `@/`） |
| `scripts/cli/*` | 相对路径不带扩展名（`./birth-info-defs`） | `@/ziwei/...`、`@/classics/...` |

### 4.3 已知的外部依赖

| 新文件 | 需要的 import | 依据 |
| --- | --- | --- |
| `star-db.ts` | `import type { StarContent } from "./db-analysis-defs"` | 实测声明区唯一外部引用 |
| `db-analysis-defs.ts` | 预计无外部依赖 | 实测声明区**不引用** `BRANCHES` / `STEMS` |
| `birth-info-defs.ts` | `CliArgs`（`./args`）、`BirthInfo`（`@/ziwei/types`）、`CityInfo` + `PROVINCES`（`@/ziwei/cities`） | `BirthInfoResult` 引用前三者；`ALL_CITIES = PROVINCES.flatMap(...)` |

### 4.4 新 export 的尺度

**只给跨文件引用的符号加 `export`，其余保持原可见性。**

- **确定要加 export 的两个**：`StarContent`（被 `star-db.ts` 与实现文件引用）、`STAR_DB`（被实现文件引用）
- **其余符号**：搬进 defs 后是否 export，取决于实现文件用不用它；实现时按 `npm run typecheck` 的报错逐个补齐

`npm run typecheck` 是这条规则的**兜底闸门**：漏了 `export` 会立刻是编译错误，不会静默通过；反之给用不到的符号加了 `export` 只是略微扩大内部可见性，不产生行为影响。

---

## 5. 必须同批修的守卫 ⚠️

### 5.1 问题

`scripts/cli/selftest.ts:599` 有一条**按文件名硬编码**的源码扫描清单：

```ts
const src = ["ziwei/db-analysis.ts", "ziwei/patterns.ts"]
```

它服务于断言「论断引用核对：未核实引文不得冒充倪师原话」，扫描源码中所有 `倪师/倪海夏…说：『引文』` 形式，比对 `annotations.json` 的 suspect / fabricated 清单。

### 5.2 实测风险

| 文件 | 现有扫描命中数 |
| --- | --- |
| `db-analysis.ts` | **26 处** |
| ├─ 落在 `STAR_DB`（行 198–975） | **23 处** |
| └─ 落在 `getTopicAnalysis` 函数体内（行 2117 / 2333 / 2358） | 3 处 |
| `patterns.ts` | 0 处 |
| `birth-info.ts` | 0 处 |

**`STAR_DB` 搬进 `star-db.ts` 后，若不同步改这一行，该断言会漏掉 23/26 的扫描面却照旧变绿。** 这是静默的安全退化——比测试变红危险得多。

该断言自己的注释（595–598 行）已写明这个教训：

> ⚠️ 扫描范围必须覆盖**所有**带倪师引文的源码。……只读一个文件会让本断言**静默失效**——它仍会绿，却再扫不到判词所在的文件。新增带引文的模块时，记得加进这个列表。

`docs/test/05-corpus-and-blindspots.md` 的「搬迁验证」一节记录过同一陷阱的上一次发作（判词从 `db-analysis.ts` 搬到 `patterns.ts` 时）。

### 5.3 处置

清单改为三个元素：

```ts
const src = ["ziwei/db-analysis.ts", "ziwei/star-db.ts", "ziwei/patterns.ts"]
```

`db-analysis-defs.ts`、`birth-info-defs.ts` 实测 0 处引文，**不进清单**。

此项**属于本次拆分的组成部分**，不是后续跟进——漏了它，本次改动就制造了一处静默失效。

---

## 6. 验证方案

### 6.1 判据

| # | 手段 | 通过判据 |
| --- | --- | --- |
| 1 | **搬前存基线**：跑 `analyze` / `topic` / `heming` / `help` 等命令，输出存盘 | 基线文件生成成功 |
| 2 | **搬后逐字节 diff** | 与基线**完全一致**（这是本次改动正确性的要害） |
| 3 | **导出名单比对**：拆前后各 dump 一次模块的公开导出名 | `db-analysis` 5 个、`birth-info` 4 个，**逐一相等** |
| 4 | **引文扫描命中数** | 拆前 26 处 → 拆后**仍 26 处**（证明 §5 的清单改对了） |
| 5 | `npm run typecheck` | 0 错误 |
| 6 | `node scripts/purple-star.ts selftest` | 49/49 |
| 7 | `npm test` | 300 条基准全绿 |

### 6.2 基线怎么取（沿用先例）

`docs/test/05` 的「搬迁验证：14 盘逐字节 diff」用的是：固定一个日期（`1990-05-15`）的多个时辰支 × 男女 × 两个 topic 主题，共 14 份输出。本次覆盖面取**同一思路但更宽**——至少覆盖受这两个模块影响的全部命令路径：

| 覆盖路径 | 为什么必须覆盖 | 它走哪个被拆的模块 |
| --- | --- | --- |
| `analyze`（固定日期 × 5 个时辰支 × 男女） | 排盘 + 格局短判词的主路径 | 两个模块都走 |
| `topic`（`overview` / `personality`） | 长判词只在这两个主题产出 | `db-analysis.ts` 的 `getTopicAnalysis` |
| `heming` | 合盘 | `birth-info.ts` 的 `buildBirthInfo` |
| 带 `--eot` 的 `analyze` | 均时差分支 | `birth-info.ts` 的 `equationOfTime` |
| 城市名容错（同一城市的不同写法） | 名称归一分支 | `birth-info.ts` 的 `findLongitude` |

五条路径**每条的具体命令行**（参数名、日期取值）在实现计划中定稿；本 spec 只锁定覆盖面。

---

## 7. 文档同步

### 7.1 要改（活文档）

| 文件 | 改什么 |
| --- | --- |
| `SKILL.md` | ①第 103 行表格：格局判定规则与两套判词现在分处 `patterns.ts`（判定）与 `patterns-defs.ts`（判词表）②第 107 行、第 188 行：分析数据库 v3 的位置描述，补 `db-analysis-defs.ts` / `star-db.ts` |
| `.claude/CLAUDE.md` | 「数据流」目录树补 4 个新文件（`patterns-defs.ts` 上次拆分后**就已经漏了**，一并补上） |
| `docs/test/05-corpus-and-blindspots.md` | 按体例**仅在末尾追加**一节「后续修正（十三）（2026-09-27）：…」，记本次拆分与 §5 那处守卫的修复；历史节一律不动 |

### 7.2 不改

| 文件 | 理由 |
| --- | --- |
| `docs/test/01~04-*.md` | **带日期的快照**，里面的行数记录的是当时状态，去同步就是伪造记录 |
| `test/README.md` 里「toolkit 私有的 `db-analysis.ts`（2254 行 `STAR_DB`）」 | 那是**上游 toolkit 文件**的行数，不是本仓代码，本仓改代码不会使它漂移 |
| `docs/superpowers/specs/2026-09-25-*.md`、`plans/2026-09-25-*.md` | 历史设计/计划文档 |

### 7.3 不登记行数

`SKILL.md` 已按「后续修正（十二）」删掉了全部内核行数声明，并写明「此处有意不登记内核行数」。**本次不重新引入行数**——新文件的规模只出现在本 spec 的估算表里，那是一次性设计资料，不进活文档。

---

## 8. 风险与效力边界

### 8.1 已知风险

| 风险 | 缓解 |
| --- | --- |
| **引文扫描静默失效**（§5） | 同批修 `selftest.ts` 清单 + 验证项 4 核命中数不变 |
| 漏 export 导致编译错误 | `npm run typecheck` 兜底；验证项 5 |
| 搬移时误改常量取值 | 验证项 1/2 的基线逐字节 diff |
| 公开面变化导致下游 import 断裂 | 验证项 3 的导出名单比对；且 `re-export` 保证调用方一行不改 |

### 8.2 效力边界

- 验证项 2（基线 diff）是**一次性证据**，不是常驻防线：它证明的是「这次搬移没改变输出」，此后任何改动仍由既有测试网兜。
- 本次**不新增常驻测试**——纯搬移不产生新的行为契约；§5 的守卫修复是**恢复既有覆盖**，不是新增能力。
- 公开面「逐名不变」由 re-export 保证，但**导出名单比对只在本次做一次**；日后若有人删掉某个 re-export，现有测试未必变红（取决于是否有消费者）。

### 8.3 落地后的预期状态

`db-analysis.ts` 从 2407 行降到约 880 行，改判定的人不再需要翻过 1530 行声明；改论断文案的人只在 `star-db.ts`（约 830 行）里工作，无需接触任何判定逻辑。`birth-info.ts` 同理减半。
