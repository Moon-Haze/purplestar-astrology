# 基准工具改用 DuckDB 数据源 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把两个手工基准工具（`full-corpus.ts` / `build-fixtures.ts`）的数据源从 720 个 `jsonl.gz` 分片改为 `db/ziwei.duckdb` 单文件，并新增一个可复跑的逐条互验工具，用 jsonl 语料为重建结果的正确性作证。

**Architecture:** 新增 `test/lib/sample-source.ts` 作为全项目唯一懂 DuckDB 与表结构的地方，对外只暴露「流式遍历」「按出生信息精确取一条」「关闭」三个动作。`test/tools/` 下被改动的两个工具（`full-corpus.ts` / `build-fixtures.ts`）各自只保留「拿样本 → 做事」的逻辑，不写 SQL、不碰连接（该目录下另有 `year-scan.ts`，与本次改造无关，不动）。正确性由两件事分工保证：`npm test` 用**合成行**单测纯映射函数（不需要任何数据文件），新增的 `verify-source.ts` 用**真实 jsonl 逐字节**比对重建结果（需要语料，手工执行）。

**Tech Stack:** Node ≥ 22.15（原生跑 TypeScript，无构建步骤）、`@duckdb/node-api` 1.5.5-r.5、`node:test`。

**Spec:** `docs/superpowers/specs/2026-09-25-duckdb-corpus-source-design.md`

## 相对 spec 的两处增补（请审阅时明确接受或否决）

spec 之外只多做两件事，各自独立、都不影响功能，**否决其一不影响其余任务**：

1. **新增 `test/sample-source.test.ts`，并登记进 `npm test` 的 `LAYERS`**（Task 1、Task 2）。
   spec 第五节说「本次不往 `npm test` 里新增依赖数据文件的用例」。这个测试**不依赖任何数据文件** ——
   它只用**合成行**喂纯映射函数、用**一个写死的、不存在的路径**验错误分支，所以字面合规。
   为什么要加：本次映射里最隐晦的一条（`siHua` **键的存在性**）搞错了 `npm test` 也**不会红**
   （比对器的 `val()` 把 `""` 与 `undefined` 归一化了）。把它钉在合成行上，是让这条规则
   在**默认回归**里可见，而不是只活在手工执行的验收工具里。

2. **`.markdownlint.json` 放行 `ts` / `typescript` 围栏，并让 MD010 跳过代码块**（Task 8 Step 5）。
   纯文档工具配置。本仓库是 TypeScript 项目，文档里的代码片段必须保留源码真实的制表符缩进。

## Global Constraints

以下每一条都来自 spec，**每个任务都隐含要求满足**：

- **不动内核**（`scripts/`）与 `SKILL.md`。
- **不动 `test/lib/compare.ts` 的基准契约**：`BaselineSample` / `BaselineChart` / `BaselinePalace` / `BaselineStar` / `BaselineDaXian` 的形状一个字段都不改。`sample-source.ts` 只**消费**这些类型，不新增平行类型。
- **不做双数据源**：基准工具运行时只认 DuckDB，不保留「有 jsonl 就走 jsonl」的回退分支。jsonl 的定位是**验收期的参照物**，不是运行时备选。
- **不使用** `topics` / `topic_dict` / `topic_lines` 三张表（论断文本，单条占原语料 90% 体积）。
- **`npm test` 必须继续在「无 `db/ziwei.duckdb`、无 DuckDB 依赖、无 jsonl 语料」的环境下跑通**。因此**不得**往 `npm test` 新增依赖数据文件的用例 —— 新增的 `test/sample-source.test.ts` 只允许用**合成行**与**不存在的路径**作输入。
- **`@duckdb/node-api` 精确锁定 `1.5.5-r.5`**，且只进 `devDependencies`。
- **三合派硬约束**：不得引入 `selfSihua`、大限四化取宫干、来因宫等飞星派字段（见 `.claude/CLAUDE.md`）。
- **全部注释、输出、提交信息用简体中文**；代码里的标识符沿用项目既有风格（英文驼峰）。
- **不用 `any` 绕过类型检查**。DB 驱动的返回值在**唯一一处**边界上用 `as unknown as` 收窄，并写明理由。
- **`npm run typecheck` 必须 0 错误**。

## Review Focus

spec 是愿景文档，它说了软件该做什么，没说它会遇到什么。以下是 spec 暗示、但**没有任何任务的测试直接覆盖**、且最可能咬到使用者的五种情况。每条都在下面标出的任务里配了断言。

1. **`fetchSample` 的出生五元组在库中不存在** —— 使用者期望拿到 `null` 后打印「样本缺失」并继续（`build-fixtures.ts` 的槽位 4 在闰月边界上真会遇到），不是抛错中断整个重建。→ Task 3
2. **`forEachSample` 达到 `filter.limit`** —— 使用者期望它**停止读取**并返回 `false`（`--limit 5` 必须秒回，不是读完 622 万行再截断）。→ Task 5
3. **`db/ziwei.duckdb` 不存在** —— 使用者期望看到「该文件不入版本控制、语料仍在 `reference/`、不是数据丢失」的指引后退出，不是 `ENOENT` 堆栈。→ Task 1
4. **`@duckdb/node-api` 未安装**（`npm install --omit=dev`、或只装 `dependencies` 的 CI）—— 使用者期望看到「在 skill 根执行 `npm install`」，不是 `Cannot find module`。→ Task 1
5. **jsonl 语料不存在**（只影响 `verify-source.ts`）—— 使用者期望被指向 `reference/ziwei-samples-toolkit/samples-out`，并被明确告知「只有互验工具需要它」。→ Task 3

---

## 事实基线

**以下全部是 2026-09-25 在本机实测得到的结论，不是推断。实现时请直接采信，不要凭记忆改写。**

### 库文件与表

- 路径：`<skill 根>/db/ziwei.duckdb`，**实测 1.7 GB**（`du -sh`；`stat` 为 1,760,047,104 字节），
  **不入版本控制**，只读打开。

- 语料侧：`reference/ziwei-samples-toolkit/samples-out` 实测 **5.5 GB / 720 个 `jsonl.gz` / 60 个年份目录**。

> ⚠️ **`reference/`、`reference/ziwei-samples-toolkit`、`.../samples-out` 实测三层全是实体目录，无一是符号链接**
> （`[ -L ]` 逐一验过）。本轮所有关于「符号链接接入」的旧说法都要改。

- `samples` 518,400 行；`palaces` 6,220,800 行（每样本恒 12 行）；`topics`/`topic_dict`/`topic_lines` 本次不用。
- 语料范围：60 年（1924–1983）× 12 月 × 30 日 × 12 时辰（**`hour` 列是 0–11 的时辰序号，不是 24 小时制**）× 2 性别 = 518,400。`sample_id` 为 1..518400，连续无重复。
- `palaces` 中行的物理顺序是 `[1,0,11,…,2]`（丑起），**必须**用 `ORDER BY (branch + 10) % 12` 排成 `[2,3,…,11,0,1]`（寅起）才能与 fixtures 一致。

### `@duckdb/node-api` 1.5.5-r.5 的实测 API（已核验，照抄即可）

```ts
import { DuckDBInstance } from "@duckdb/node-api";
const inst = await DuckDBInstance.create(path, { access_mode: "READ_ONLY" }); // 只读，写入被拒
const conn = await inst.connect();
const result = await conn.stream(sql, params?);        // Promise<DuckDBResult>
for await (const batch of result.yieldRowObjectJs()) {  // AsyncIterableIterator<Record<string, JS>[]>
	// batch 是一个**数组**（2048 行/批），不是单行
}
conn.closeSync();      // 连接关闭
inst.closeSync();      // 实例关闭
```

- ⚠️ 官方 README 里的 `reader.readAll()` / `readUntil()` / `reader.done` 在 1.5.5 上**不存在**，别照抄文档。可用的是 `stream()` + `yieldRowObjectJs()`。
- ⚠️ **`bigint` 列到达 JS 侧是 `BigInt`，不是 `number`**。`sample_id` 是 bigint 列。`BigInt(1) !== 1` 在 JS 里恒为 `true`，**分组前必须先 `Number()` 归一**，否则每组都会退化成一行一条样本。
- `varchar[]` 列到达 JS 侧是 `Array`（`yieldRowObjectJs` 会转换；`yieldRowObjects` 不转，得到的是 `DuckDBListValue`）。
- ⚠️ `ORDER_BY` 是**增量吐出**的：实测全量无过滤（622 万行）JOIN + 排序的查询，**首块 2048 行在 111 ms 到达**。所以流式实现不需要分页，`LIMIT/OFFSET` 那套不要引入。
- `DuckDBInstance.create` 用 `READ_ONLY` 打开一个**不存在**的路径会抛错（不会静默建库）—— 但我们要在更早的 `existsSync` 处就拦下，好给出可读指引。

### jsonl 的键序（逐字节比对的前提，跨 4 个年份 1200 条样本实测恒定）

`JSON.stringify` 按插入顺序输出键，所以重建对象的**键插入顺序必须与下表完全一致**：

```text
顶层        : birthInfo, chart, topics, system     ← 互验时裁剪成 birthInfo, chart
birthInfo   : year, month, day, hour, gender, longitude
chart       : birthInfo, lunarInfo, mingGongBranch, shenGongBranch, wuxingJu,
              wuxingJuName, ziweiPos, palaces, daXians, currentAge, currentDaXianIndex
chart.birthInfo : year, month, day, hour, gender, longitude   ← 与顶层 birthInfo 同形
lunarInfo   : lunarYear, lunarMonth, lunarDay, yearStem, yearBranch, isLeapMonth
palace      : branch, stem, name, stars, daXianAge, isMingGong, isShenGong, isCurrentDaXian
star major  : name, type, brightness, siHua
star lucky  : name, type, siHua          ← 仅当星名落在下面的 18 颗内
star lucky  : name, type                 ← 否则（整键缺失）
star sha    : name, type
star minor  : name, type
daXian      : startAge, endAge, palaceBranch, palaceName
```

> `chart.birthInfo` **不在 `BaselineChart` 接口的声明里**，但 jsonl 每一行都有它 —— 它是 `JSON.parse` 带进来的多余字段，`build-fixtures.ts` 写盘时 `JSON.stringify` 原样保留。重建时**必须**填上，否则重写出的 `charts.jsonl` 会凭空少一个字段。

### 星曜装配

四段顺序恒为 **major → lucky → sha → minor**。实测 1200 条样本 × 12 宫 = **14,400 个宫，段序违例 0 处**，故四段直接拼接即可，不需要按类型排序。

### `siHua` 键的存在性（本次最隐晦的一条规则）

`algorithm.ts` 一律写 `siHua: s.mutagen`，而 `JSON.stringify` **省略值为 `undefined` 的键**。所以「有 `siHua` 键但值为 `""`」与「完全没有 `siHua` 键」是两种不同的 JSON。

实测（全库扫 2000 条样本、按星名聚合）该差异**按星名恒定、无一混用**：

- **恒有键（18 颗）**：14 主星 + `左辅` `右弼` `文昌` `文曲`
- **恒无键（54 颗）**：`天魁` `天钺` `禄存` `天马` 等全部煞星与杂曜

规则拆成两半，正好由两个来源拼出 —— 18 **不等于** `SI_HUA_TABLE` 自身的覆盖数 15：

```js
const SIHUA_STARS = new Set(Object.values(SI_HUA_TABLE).flat()); // 15 颗（11 主星 + 4 辅星）
const hasKey = (type, name) => type === "major" || SIHUA_STARS.has(name);
// major 一侧出 14 颗（含终生不参与四化的 天府/天相/七杀，值恒为 ""），
// SIHUA_STARS 一侧只额外补进 4 颗辅星 → 合计 18
```

> ⚠️ **这条搞错了 `npm test` 也不会红** —— `compare.ts` 的 `val()` 把 `""` 与 `undefined` 归一化了。只有字节级比对能抓住它。

### 语料是「合成网格」，不是真实历法（实测，容易栽）

语料按 `60 年 × 12 月 × 30 日 × 12 时辰 × 2 性别` 穷举生成，**不遵循真实月长**：

| 五元组                     | 在库中                                              |
| -------------------------- | --------------------------------------------------- |
| `1924-02-30`（2 月 30 日） | **存在**（24 条）—— 别拿它当「查不到」的反例        |
| `day = 31`                 | 不存在（日是 1..30）                                |
| `hour = 12`                | 不存在（时辰序号是 0..11；12 是晚子时口径，语料无） |
| `month = 13`               | 不存在                                              |
| `year = 1900`              | 不存在（年份是 1924..1983）                         |
| `1924-01-01 时0 male`      | 存在，且 `sample_id = 1`                            |

### 列的取值域（实测）

| 列                                                | 实测取值                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `gender`                                          | `male` / `female`                                                                                                      |
| `longitude`                                       | 恒 `120.0`（JS 侧 `120`，`JSON.stringify` 输出 `120`，与 jsonl 一致）                                                  |
| `major_brightness[]`                              | 仅 `bright` / `normal` / `dim`，**无空串**，长度与 `major_stars` 相等                                                  |
| `major_stars[]` 长度                              | 0 / 1 / 2（空宫为 0）                                                                                                  |
| `lucky_stars[]` / `sha_stars[]` / `minor_stars[]` | 无空串                                                                                                                 |
| `sihua_stars[]`                                   | 形如 `["巨门:权"]`，`星名:四化`；某星无四化则**不在数组内**                                                            |
| `palace_name`                                     | 12 个值全集：`命宫 兄弟 夫妻 子女 财帛 疾厄 迁移 仆役 官禄 田宅 福德 父母`（**iztro 原生口径**，有「仆役」无「交友」） |
| `is_leap_month`                                   | `true` / `false`                                                                                                       |
| `daxian_start` / `daxian_end`                     | 无空值；每样本 12 个互不相同的连续十年段                                                                               |

---

## 文件结构

| 文件                                    | 动作                     | 职责                                                                               |
| --------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `package.json`                          | 改（+1 行）              | `devDependencies` 加 `@duckdb/node-api: 1.5.5-r.5`                                 |
| `package-lock.json`                     | 改（+165 行）            | 依赖锁                                                                             |
| `test/lib/sample-source.ts`             | **新建**                 | 唯一懂 DuckDB 与表结构的地方：连接、SQL、行→`BaselineSample` 的纯映射、流式遍历    |
| `test/sample-source.test.ts`            | **新建**                 | 用**合成行**与**不存在的路径**测纯映射与错误指引。不碰任何数据文件                 |
| `test/lib/run.ts`                       | 改（+1 行）              | 把新测试文件登记进 `LAYERS`，否则分层汇总会报「未映射到层」                        |
| `test/tools/verify-source.ts`           | **新建**                 | 互验工具：jsonl ↔ DuckDB 逐字节比对                                                |
| `test/tools/full-corpus.ts`             | 改                       | 数据源换成 `sample-source`；`--year`/`--month`/`--limit` 语义不变                  |
| `test/tools/build-fixtures.ts`          | 改                       | 取样本换成 `fetchSample`；下标算址的 `pickFrom` 删除                               |
| `test/README.md`                        | 改                       | 数据集描述补上 DuckDB 载体与「两者并存、互为验证」；工具数 3→4；补一节四层验证分工 |
| `docs/test/05-corpus-and-blindspots.md` | 改                       | 同上；并更正「符号链接」的说法与 `full-corpus.mjs` 的扩展名                        |
| `.gitignore`                            | 改（1 个数字）           | 注释里的库体积 `1.8G` → `1.7G`（实测）                                             |
| `.markdownlint.json`                    | 改（2 处，本计划的增补） | 放行 `ts`/`typescript` 围栏；MD010 跳过代码块                                      |
| `test/tools/year-scan.ts`               | **不动**                 | 1900–2100 恒等式扫描，与本次改造无关                                               |

**任务依赖顺序：** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8。Task 3 之后每一环都能独立跑通。

---

## Task 1: 依赖落地 + `sample-source.ts` 骨架

**Files:**

- Modify: `package.json:16-20`（`devDependencies` 块）—— **工作区里已经改好，未提交**
- Modify: `package-lock.json`（+165 行）—— **同上，已改好**
- Create: `test/lib/sample-source.ts`
- Create: `test/sample-source.test.ts`
- Modify: `test/lib/run.ts:129-132`（`LAYERS` 数组）

**Interfaces:**

- Consumes: 无（本任务不依赖任何先前的任务）
- Produces:
  - `SAMPLE_DB: string`
  - `interface SampleFilter { year?: number; month?: number; limit?: number }`
  - `class SourceError extends Error`
  - `missingDepHint(err: unknown): string`
  - `missingDbHint(path?: string): string`
  - `openSource(dbPath?: string): Promise<DuckDBConnection>`

- [ ] **Step 0: 确认依赖已落地（不是「去装」，是「去核对」）**

`@duckdb/node-api` **已经装好**，`package.json` / `package-lock.json` 也已经在工作区里改好，
只是尚未提交。本步骤是核对，不是安装 —— 别重复 `npm install`，也别重写这两行。

```bash
git diff package.json          # 期望：恰好 +1 行，即 devDependencies 里多出 @duckdb/node-api
npm ls @duckdb/node-api        # 期望：@duckdb/node-api@1.5.5-r.5
node -e 'import("@duckdb/node-api").then(m=>console.log(typeof m.DuckDBInstance))'  # 期望：function
```

三条都符合预期就往下走。`git diff` 若显示的不止这 +1 行，**先停下问清楚**——
`package.json` 是本仓库里最不该混入无关改动的文件。

> ⚠️ 提交时**只 add 这两个文件**：工作区里另有若干与本改造无关的未提交改动
> （`.claude/CLAUDE.md`、`SKILL.md`、`scripts/cli/*`、`scripts/purple-star.ts`、`test/cli.test.ts`
> 等），不要顺手 `git add -A`。

- [ ] **Step 1: 写失败的测试**

创建 `test/sample-source.test.ts`：

```ts
// ── 层 5：基准数据源的纯函数 ──
//
// ⚠️ 本文件**不得触碰任何数据文件**。`npm test` 必须在「无 db/ziwei.duckdb、
//    无 DuckDB 依赖、无 jsonl 语料」的环境下跑通（见 test/README.md）。
//    所以这里只测两样东西：错误指引的文本、以及**用不存在的路径**触发的失败分支。
//    真正的映射正确性由 test/tools/verify-source.ts 拿真实语料逐字节证明。
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
	SAMPLE_DB,
	SourceError,
	missingDbHint,
	missingDepHint,
	openSource,
} from "./lib/sample-source.ts";

describe("基准数据源（纯函数与错误指引）", () => {
	it("SAMPLE_DB 指向 <skill 根>/db/ziwei.duckdb", () => {
		assert.match(SAMPLE_DB, /\/db\/ziwei\.duckdb$/);
	});

	it("库文件缺失时抛 SourceError，指引里写明「不是数据丢失」与语料仍在 reference/", async () => {
		await assert.rejects(
			() => openSource("/nonexistent/ziwei-does-not-exist.duckdb"),
			(err: unknown) => {
				assert.ok(err instanceof SourceError, "应当是 SourceError");
				for (const must of [
					"/nonexistent/ziwei-does-not-exist.duckdb",
					"不入版本控制",
					"reference/ziwei-samples-toolkit/samples-out",
					"不是",
					"npm test",
				]) {
					assert.ok(err.message.includes(must), `指引里应含「${must}」，实际：\n${err.message}`);
				}
				return true;
			}
		);
	});

	it("依赖缺失的指引指向 npm install", () => {
		const msg = missingDepHint(new Error("Cannot find package '@duckdb/node-api'"));
		assert.ok(msg.includes("@duckdb/node-api"));
		assert.ok(msg.includes("npm install"));
		assert.ok(msg.includes("Cannot find package '@duckdb/node-api'"), "应回显底层错误信息");
	});

	it("missingDbHint 可接受自定义路径（供 openSource 复用）", () => {
		assert.ok(missingDbHint("/tmp/x.duckdb").includes("/tmp/x.duckdb"));
		assert.ok(missingDbHint().includes(SAMPLE_DB));
	});
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test test/sample-source.test.ts
```

预期：FAIL，报 `Cannot find module`（指向 `./lib/sample-source.ts`）。

- [ ] **Step 3: 实现骨架**

创建 `test/lib/sample-source.ts`：

```ts
// ── 基准样本数据源：db/ziwei.duckdb ──
//
// 全项目**唯一**懂 DuckDB 与表结构的地方。三个手工工具（test/tools/full-corpus.ts、
// test/tools/build-fixtures.ts、test/tools/verify-source.ts）都从这里取样本，
// 它们自己不写 SQL、不碰连接。
//
// ⚠️ 本模块**不进 `npm test` 的断言** —— `npm test` 必须继续在「无 db/ziwei.duckdb、
//    无 DuckDB 依赖、无 jsonl 语料」的环境下跑通（见 test/README.md）。
//    test/sample-source.test.ts 只用**合成行**与**不存在的路径**测纯函数，不碰数据文件。
//
// 表结构（`ziwei` 库，`main` schema）：
//   samples  518,400 行 —— 出生信息 + 农历 + 盘级标量
//   palaces  6,220,800 行 —— 每样本恒 12 行：宫位 + 星曜 + 大限区间
//   topics / topic_dict / topic_lines —— 本次不用（论断文本，单条占原语料 90% 体积）
//
// 为什么数据源是单文件而非 720 个 jsonl.gz 分片：
//   · `--year` / `--month` 从「拼路径 + 判文件存在」变成 SQL 谓词，中间状态消失
//   · 1.7 GB 对 5.5 GB
//   · 可直接 SQL 探查，核对排盘不变量不必再写一次性脚本
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DuckDBConnection } from "@duckdb/node-api";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/lib
const SKILL_ROOT = resolve(HERE, "../..");

/** 数据文件路径：<skill 根>/db/ziwei.duckdb */
export const SAMPLE_DB: string = resolve(SKILL_ROOT, "db/ziwei.duckdb");

/** 过滤条件。对应 CLI 的 `--year` / `--month`；`limit` 对应 `--limit`。 */
export interface SampleFilter {
	year?: number;
	month?: number;
	/** 已读取的样本数上限；达到即停止。省略或 `Infinity` 表示不限。 */
	limit?: number;
}

/** 数据源不可用（缺文件 / 缺依赖）。`message` 已是可直接打印给用户的完整指引。 */
export class SourceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SourceError";
	}
}

/**
 * `@duckdb/node-api` 未安装时的指引。
 *
 * 它是 devDependency，只有三个**手工执行**的构建/验收工具用到它 —— 运行 skill 本身
 * （`node scripts/purple-star.ts ...`）完全不需要。所以「没装」是正常状态，不是故障。
 */
export function missingDepHint(err: unknown): string {
	return (
		`缺少依赖 @duckdb/node-api（${err instanceof Error ? err.message : String(err)}）\n` +
		`  它是 devDependency，只有三个手工执行的测试工具用到它 —— 运行 skill 本身不需要。\n` +
		`  处理：在 skill 根执行 npm install`
	);
}

/**
 * `db/ziwei.duckdb` 不存在时的指引。
 *
 * ⚠️ 措辞要挡住一个真实的误判：该库不入版本控制，克隆仓库后它必然缺失，很容易被读成
 *    「语料丢了」。它不是唯一副本 —— `reference/` 下的 jsonl 语料是同一份数据的原始形态，
 *    可以重建出这个库。2026-09-25 曾因 `ls` 是带 `--git-ignore` 的 eza 别名而误判语料已失，
 *    见 docs/superpowers/specs/ 下的设计文档。
 */
export function missingDbHint(path: string = SAMPLE_DB): string {
	return (
		`找不到样本数据库：${path}\n` +
		`  该文件**不入版本控制**（1.7 GB，超出 GitHub 单文件上限 100 MB）。\n` +
		`  它不是唯一副本，所以这里**不是**数据丢失：\n` +
		`    reference/ziwei-samples-toolkit/samples-out  是同一份语料的原始形态\n` +
		`    （5.5 GB / 720 个 jsonl.gz / 60 个年份目录 1924-1983），可由其重建本库。\n` +
		`  日常回归不需要它 —— 跑 npm test 即可，fixtures 已入库。`
	);
}

/** 惰性单例：路径 → 已建立的连接。进程退出时自然释放。 */
const connections = new Map<string, Promise<DuckDBConnection>>();

/**
 * 建立（或复用）到样本库的只读连接。
 *
 * @param dbPath 库文件路径。**仅供测试注入一个不存在的路径**；生产调用一律走默认值，
 *               三个工具都不传这个参数。
 * @throws {SourceError} 缺依赖或库文件不存在时，`message` 已是可直接打印的完整指引。
 */
export async function openSource(dbPath: string = SAMPLE_DB): Promise<DuckDBConnection> {
	const cached = connections.get(dbPath);
	if (cached) return cached;

	const pending = (async (): Promise<DuckDBConnection> => {
		// ⚠️ 动态 import 而非顶层静态 import：它是 devDependency，可能没装。
		//    静态 import 会让整个模块加载失败，连错误指引都打不出来。
		let DuckDBInstance: typeof import("@duckdb/node-api").DuckDBInstance;
		try {
			({ DuckDBInstance } = await import("@duckdb/node-api"));
		} catch (err) {
			throw new SourceError(missingDepHint(err));
		}

		if (!existsSync(dbPath)) throw new SourceError(missingDbHint(dbPath));

		// READ_ONLY：基准工具的立场是「只读语料」。写坏了这个库，两个验收层会一起失真。
		const inst = await DuckDBInstance.create(dbPath, { access_mode: "READ_ONLY" });
		return inst.connect();
	})();

	// 失败的不缓存：否则一次瞬时失败会让后续所有调用都拿到同一个 rejected promise。
	pending.catch(() => connections.delete(dbPath));
	connections.set(dbPath, pending);
	return pending;
}

/** 关闭全部已建立的连接（手工工具收尾用）。 */
export function closeSource(): void {
	for (const pending of connections.values()) {
		pending.then(conn => conn.closeSync()).catch(() => {});
	}
	connections.clear();
}
```

创建 `test/sample-source.test.ts`（Step 3 只让上面 4 条用例全部通过，不需要额外改动）。

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test test/sample-source.test.ts
```

预期：PASS，4 项通过。

- [ ] **Step 5: 登记测试层**

`test/lib/run.ts` 的 `LAYERS` 是分层汇总的依据，未登记的文件会被报成「未映射到层」。把数组改成：

```ts
const LAYERS = [
	{ label: "层 1 排盘对标", file: "chart.test.ts", suite: "排盘对标（基准：iztro 2.5.8 样本）" },
	{ label: "层 2 CLI 端到端", file: "cli.test.ts", suite: "CLI 端到端" },
	{ label: "层 3 排盘结构不变量", file: "invariants.test.ts", suite: "排盘结构不变量" },
	{ label: "层 4 三合派约束", file: "school.test.ts", suite: "三合派体系约束" },
	{ label: "层 5 数据源纯函数", file: "sample-source.test.ts", suite: "基准数据源（纯函数与错误指引）" },
] as const;
```

> `suite` 必须与测试文件里顶层 `describe` 的**字面名**一致，`run.ts` 用它把「层耗时」从最慢榜里排除。

- [ ] **Step 6: 跑完整回归与类型检查**

```bash
npm test
npm run typecheck
```

预期：`npm test` 分层汇总出现「层 5 数据源纯函数 4 项 ✓」，**没有**「分层合计 ≠ node:test 官方总计」的告警；`typecheck` 0 错误。

- [ ] **Step 7: 验证依赖缺失分支真的可达**

`npm test` 跑的是**已装依赖**的环境，测不到缺依赖的分支。手工确认一次：

```bash
mv node_modules/@duckdb/node-api /tmp/duckdb-api-parked \
	&& node -e 'import("./test/lib/sample-source.ts").then(m=>m.openSource()).catch(e=>console.log(e.message))' ; \
	mv /tmp/duckdb-api-parked node_modules/@duckdb/node-api
```

预期：打印「缺少依赖 @duckdb/node-api … 在 skill 根执行 npm install」，**不是** `Cannot find module` 堆栈。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json test/lib/sample-source.ts test/sample-source.test.ts test/lib/run.ts
git commit -m "feat(sample-source): 新增 DuckDB 数据源骨架

基准工具的数据源要从 720 个 jsonl.gz 分片换成 db/ziwei.duckdb 单文件，
先落地最底层：依赖、只读连接、以及缺库/缺依赖两种情形下的可执行指引。

错误指引刻意写明「该库不入版本控制、语料仍在 reference/、可由其重建」——
克隆仓库后这个库必然缺失，不写清楚很容易被读成「语料丢了」。

新增的 test/sample-source.test.ts 只用合成输入与不存在的路径，
不碰数据文件，npm test 继续在无 db / 无 DuckDB / 无 jsonl 的环境下跑通。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: 重建映射 `rowsToSample`（纯函数）

**Files:**

- Modify: `test/lib/sample-source.ts`
- Modify: `test/sample-source.test.ts`

**Interfaces:**

- Consumes: Task 1 的 `SAMPLE_DB` / `SourceError` / `openSource`；`test/lib/compare.ts` 的 `BaselineSample` 等类型；`test/lib/loader.ts` 的 `loadConstants()`
- Produces:
  - `interface SampleRow`（`samples` 表本模块用到的 19 列）
  - `interface PalaceRow`（`palaces` 表本模块用到的 14 列）
  - `rowsToSample(sample: SampleRow, palaces: PalaceRow[]): BaselineSample`

- [ ] **Step 1: 写失败的测试**

在 `test/sample-source.test.ts` 的 `describe` **之内**追加下面两块（并把 Step 1 里 import 从 `./lib/sample-source.ts` 增加 `rowsToSample`、`type SampleRow`、`type PalaceRow`）：

```ts
/** 造一行 `samples`（只写测试关心的列，其余给 0 —— 映射是逐列的，不会串）。 */
function sampleRow(over: Partial<SampleRow> = {}): SampleRow {
	return {
		year: 1924, month: 1, day: 1, hour: 0, gender: "male", longitude: 120,
		lunar_year: 1923, lunar_month: 12, lunar_day: 25,
		year_stem: 0, year_branch: 0, is_leap_month: false,
		ming_gong_branch: 2, shen_gong_branch: 6, wuxing_ju: 4, wuxing_ju_name: "金四局",
		ziwei_pos: 9, current_age: 102, current_daxian_index: 9,
		...over,
	};
}

/** 造一行 `palaces`。 */
function palaceRow(over: Partial<PalaceRow> = {}): PalaceRow {
	return {
		branch: 2, stem: 0, palace_name: "福德",
		major_stars: [], lucky_stars: [], sha_stars: [], minor_stars: [],
		major_brightness: [], sihua_stars: [],
		is_ming_gong: false, is_shen_gong: false, is_current_daxian: false,
		daxian_start: 104, daxian_end: 113,
		...over,
	};
}

/** 造齐 12 个宫（大限区间连续：2 岁起，每宫十年）。 */
function twelvePalaces(): PalaceRow[] {
	return Array.from({ length: 12 }, (_, i) =>
		palaceRow({
			branch: (i + 2) % 12,
			palace_name: ["命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","仆役","官禄","田宅","福德","父母"][i],
			daxian_start: 2 + i * 10,
			daxian_end: 11 + i * 10,
		})
	);
}
```

```ts
describe("重建映射 rowsToSample（合成行，不碰数据文件）", () => {
	it("盘级标量与农历六字段逐列对应", () => {
		const s = rowsToSample(sampleRow(), twelvePalaces());
		assert.equal(s.birthInfo.year, 1924);
		assert.equal(s.birthInfo.gender, "male");
		assert.equal(s.birthInfo.longitude, 120);
		assert.deepEqual(s.chart.lunarInfo, {
			lunarYear: 1923, lunarMonth: 12, lunarDay: 25,
			yearStem: 0, yearBranch: 0, isLeapMonth: false,
		});
		assert.equal(s.chart.mingGongBranch, 2);
		assert.equal(s.chart.wuxingJuName, "金四局");
		assert.equal(s.chart.currentAge, 102);
		assert.equal(s.chart.currentDaXianIndex, 9);
	});

	it("chart.birthInfo 存在且与顶层 birthInfo 同内容", () => {
		const s = rowsToSample(sampleRow(), twelvePalaces());
		assert.deepEqual((s.chart as Record<string, unknown>).birthInfo, s.birthInfo);
	});

	it("顶层与 chart 的键序与 jsonl 一致（逐字节比对的前提）", () => {
		const s = rowsToSample(sampleRow(), twelvePalaces());
		assert.deepEqual(Object.keys(s), ["birthInfo", "chart"]);
		assert.deepEqual(Object.keys(s.birthInfo), ["year", "month", "day", "hour", "gender", "longitude"]);
		assert.deepEqual(Object.keys(s.chart), [
			"birthInfo", "lunarInfo", "mingGongBranch", "shenGongBranch", "wuxingJu",
			"wuxingJuName", "ziweiPos", "palaces", "daXians", "currentAge", "currentDaXianIndex",
		]);
		assert.deepEqual(Object.keys(s.chart.lunarInfo ?? {}), [
			"lunarYear", "lunarMonth", "lunarDay", "yearStem", "yearBranch", "isLeapMonth",
		]);
	});

	it("宫位键序与 jsonl 一致，daXianAge 取自 daxian_start/end", () => {
		const p = rowsToSample(sampleRow(), twelvePalaces()).chart.palaces![0];
		assert.deepEqual(Object.keys(p), [
			"branch", "stem", "name", "stars", "daXianAge",
			"isMingGong", "isShenGong", "isCurrentDaXian",
		]);
		assert.deepEqual(p.daXianAge, [2, 11]);
	});

	it("星曜四段拼接：major → lucky → sha → minor", () => {
		const palaces = twelvePalaces();
		palaces[0].major_stars = ["太阳", "巨门"];
		palaces[0].major_brightness = ["bright", "dim"];
		palaces[0].lucky_stars = ["左辅"];
		palaces[0].sha_stars = ["擎羊"];
		palaces[0].minor_stars = ["三台", "封诰"];
		const stars = rowsToSample(sampleRow(), palaces).chart.palaces![0].stars;
		assert.deepEqual(stars.map(x => x.type), ["major", "major", "lucky", "sha", "minor", "minor"]);
		assert.deepEqual(stars[0], { name: "太阳", type: "major", brightness: "bright", siHua: "" });
	});

	it("siHua 键的存在性：18 颗有键（主星 + 四辅星），其余整键缺失", () => {
		const palaces = twelvePalaces();
		palaces[0].major_stars = ["天府"]; // 终生不参与四化的主星 —— 有键、值为 ""
		palaces[0].major_brightness = ["normal"];
		palaces[0].lucky_stars = ["左辅", "天钺"]; // 左辅有键，天钺无键
		palaces[0].minor_stars = ["三台"];
		palaces[0].sha_stars = ["擎羊"];
		palaces[0].sihua_stars = ["左辅:科"]; // 天府 无四化 → 不在数组内
		const stars = rowsToSample(sampleRow(), palaces).chart.palaces![0].stars;
		const byName = new Map(stars.map(s => [s.name, s]));

		assert.ok("siHua" in byName.get("天府")!, "主星恒有 siHua 键");
		assert.equal(byName.get("天府")!.siHua, "", "无四化时值为空串，不是 undefined");
		assert.equal(byName.get("左辅")!.siHua, "科");
		assert.ok(!("siHua" in byName.get("天钺")!), "天钺 必须整键缺失");
		assert.ok(!("siHua" in byName.get("三台")!));
		assert.ok(!("siHua" in byName.get("擎羊")!));

		// 逐字节：键缺失与值为 "" 是两种不同的 JSON
		const json = JSON.stringify(byName.get("天府"));
		assert.equal(json, '{"name":"天府","type":"major","brightness":"normal","siHua":""}');
		assert.equal(JSON.stringify(byName.get("天钺")), '{"name":"天钺","type":"lucky"}');
	});

	it("daXians 按 startAge 升序，字段序与 jsonl 一致", () => {
		const palaces = twelvePalaces();
		palaces.reverse(); // 故意打乱输入顺序
		const dx = rowsToSample(sampleRow(), palaces).chart.daXians!;
		assert.equal(dx.length, 12);
		assert.deepEqual(dx.map(d => d.startAge), [2, 12, 22, 32, 42, 52, 62, 72, 82, 92, 102, 112]);
		assert.deepEqual(Object.keys(dx[0]), ["startAge", "endAge", "palaceBranch", "palaceName"]);
	});

	it("不就地改动传入的 palaces 数组", () => {
		const palaces = twelvePalaces();
		const before = palaces.map(p => p.branch);
		rowsToSample(sampleRow(), palaces);
		assert.deepEqual(palaces.map(p => p.branch), before);
	});
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test test/sample-source.test.ts
```

预期：FAIL，报 `rowsToSample is not a function` / `does not provide an export named 'rowsToSample'`。

- [ ] **Step 3: 实现映射**

在 `test/lib/sample-source.ts` 的 `closeSource()` **之后**追加。同时把顶部的 import 区补上两行：

```ts
import type { BirthInfo, Star } from "@/ziwei/types";
import { loadConstants } from "./loader.ts";
import type {
	BaselineChart, BaselineDaXian, BaselinePalace, BaselineSample, BaselineStar,
} from "./compare.ts";
```

> ⚠️ 三者都必须是 `import type` 或**动态**获取：`@/ziwei/constants` 是 `.ts`，静态 import 会在 `loader.ts` 注册解析钩子**之前**完成链接，那时它解析不了。`compare.ts` 取 `IZTRO_TO_PROJECT_PALACE` 时已是同样处理（它用顶层 await），照抄即可。`BaselineSample` 等只是类型，`import type` 在运行时被完全擦除，安全。

```ts
// ── 表结构 → 基准样本的映射 ──
//
// 这里的每一条规则都是实测出来的，不是推断。最隐晦的一条是 `siHua` 键的**存在性**
// （见 hasSiHuaKey），它搞错了 `npm test` 也不会红 —— 只有字节级比对能抓住。
// 详见 docs/superpowers/specs/2026-09-25-duckdb-corpus-source-design.md 的 4.2。

/** `samples` 表的一行（只列本模块用到的列）。 */
export interface SampleRow {
	year: number;
	month: number;
	day: number;
	/** **时辰序号** 0–11（不是 24 小时制的小时；库中正是此时辰序号）。 */
	hour: number;
	gender: string;
	longitude: number;
	lunar_year: number;
	lunar_month: number;
	lunar_day: number;
	year_stem: number;
	year_branch: number;
	is_leap_month: boolean;
	ming_gong_branch: number;
	shen_gong_branch: number;
	wuxing_ju: number;
	wuxing_ju_name: string;
	ziwei_pos: number;
	current_age: number;
	current_daxian_index: number;
}

/** `palaces` 表的一行（只列本模块用到的列）。 */
export interface PalaceRow {
	branch: number;
	stem: number;
	/** **iztro 原生口径**宫名（有「仆役」无「交友」）；翻译交给 `compare.ts` 的 normalizePalaceName。 */
	palace_name: string;
	major_stars: string[];
	lucky_stars: string[];
	sha_stars: string[];
	minor_stars: string[];
	/** 与 `major_stars` **按下标配对**。 */
	major_brightness: string[];
	/** 形如 `["巨门:权"]`；某星无四化则**不在数组内**。 */
	sihua_stars: string[];
	is_ming_gong: boolean;
	is_shen_gong: boolean;
	is_current_daxian: boolean;
	daxian_start: number;
	daxian_end: number;
}

// 四化表从内核取，不在此另抄一份 —— 它是四化的唯一定义处。
// ⚠️ 与 compare.ts 取 IZTRO_TO_PROJECT_PALACE 同理，必须动态获取（见文件头注释）。
const { SI_HUA_TABLE } = await loadConstants();
const SIHUA_STARS: ReadonlySet<string> = new Set(Object.values(SI_HUA_TABLE).flat());

/**
 * 重建出的星曜是否该带 `siHua` **键**（键的存在性，与「值为 `""`」是两回事）。
 *
 * 实测（全库扫 2000 条样本、按星名聚合、无一混用）：
 *   恒有键 18 颗 = 14 主星 + 左辅/右弼/文昌/文曲
 *   恒无键 54 颗 = 天魁/天钺/禄存/天马 + 全部煞星与杂曜
 *
 * 18 ≠ 四化表自身的覆盖数 15：表里 40 个格子去重是 15 颗（11 主星 + 4 辅星），差额来自
 * **终生不参与四化的三颗主星** 天府/天相/七杀 —— 它们有键（因为 type 是 major）、值恒为 ""。
 * 所以规则拆成两半：major 一侧出 14 颗，SIHUA_STARS 一侧只额外补进 4 颗辅星。
 */
function hasSiHuaKey(type: Star["type"], name: string): boolean {
	return type === "major" || SIHUA_STARS.has(name);
}

/** 从 `palaces.sihua_stars`（形如 `["巨门:权"]`）取该星的四化值；该星无四化则 `""`。 */
function siHuaOf(p: PalaceRow, name: string): string {
	for (const entry of p.sihua_stars ?? []) {
		const i = entry.indexOf(":");
		if (i > 0 && entry.slice(0, i) === name) return entry.slice(i + 1);
	}
	return "";
}

/**
 * 一个宫 → `BaselinePalace`。
 *
 * ⚠️ **键序即 JSON 输出顺序**，必须与 jsonl 逐字一致：`branch, stem, name, stars,
 *    daXianAge, isMingGong, isShenGong, isCurrentDaXian`。调换字面量里的书写顺序
 *    会让 charts.jsonl 产生 diff（比对器察觉不到，只有字节级互验能抓住）。
 */
function palaceOf(p: PalaceRow): BaselinePalace {
	const stars: BaselineStar[] = [];

	// 顺序恒为 major → lucky → sha → minor。实测 1200 条样本 × 12 宫 = 14,400 个宫，
	// 段序违例 0 处，故四段直接拼接，不需要按类型排序。
	const majors = p.major_stars ?? [];
	const brightness = p.major_brightness ?? [];
	for (let i = 0; i < majors.length; i++) {
		stars.push({
			name: majors[i],
			type: "major",
			brightness: brightness[i], // 按下标配对；实测长度相等且无空串
			siHua: siHuaOf(p, majors[i]), // 主星恒有键
		});
	}
	for (const name of p.lucky_stars ?? []) {
		if (hasSiHuaKey("lucky", name)) {
			stars.push({ name, type: "lucky", siHua: siHuaOf(p, name) });
		} else {
			stars.push({ name, type: "lucky" }); // 整键缺失，不是 ""
		}
	}
	for (const name of p.sha_stars ?? []) stars.push({ name, type: "sha" });
	for (const name of p.minor_stars ?? []) stars.push({ name, type: "minor" });

	return {
		branch: p.branch,
		stem: p.stem,
		name: p.palace_name,
		stars,
		daXianAge: [p.daxian_start, p.daxian_end],
		isMingGong: p.is_ming_gong,
		isShenGong: p.is_shen_gong,
		isCurrentDaXian: p.is_current_daxian,
	};
}

/**
 * 12 个宫的 `[daxian_start, daxian_end]` 即 12 个大限，**按 `startAge` 升序**排列。
 *
 * ⚠️ 比对器对 `daXians` 是**按下标**逐项比的（`aD[i]` vs `bD[i]`），顺序错了直接报红 ——
 *    这与 `palaces` 按 `branch` 建索引不同。库中行序是丑起，不能直接用。
 */
function daXiansOf(palaces: PalaceRow[]): BaselineDaXian[] {
	return [...palaces] // 复制：不就地改动调用方的数组
		.sort((a, b) => a.daxian_start - b.daxian_start)
		.map(p => ({
			startAge: p.daxian_start,
			endAge: p.daxian_end,
			palaceBranch: p.branch,
			palaceName: p.palace_name,
		}));
}

/**
 * 关系表行 → `BaselineSample`。**纯函数**：不碰数据库、不碰文件系统，故可被 `npm test`
 * 用合成行覆盖（`test/sample-source.test.ts`）。
 *
 * ⚠️ 各层的**键插入顺序**必须与 jsonl 完全一致 —— `JSON.stringify` 按插入顺序输出，
 *    而 `verify-source.ts` 是逐字节比对。顺序见本文件顶部与 spec 的「事实基线」。
 *
 * @param sample  `samples` 表的一行
 * @param palaces 该样本的 12 行 `palaces`，**已按 `(branch + 10) % 12` 排好**（寅起）
 */
export function rowsToSample(sample: SampleRow, palaces: PalaceRow[]): BaselineSample {
	const birthInfo: BirthInfo = {
		year: sample.year,
		month: sample.month,
		day: sample.day,
		hour: sample.hour,
		gender: sample.gender === "female" ? "female" : "male",
		longitude: sample.longitude,
	};

	// ⚠️ 类型写 `BaselineChart & { birthInfo: BirthInfo }` 而不是光 `BaselineChart` ——
	//    `BaselineChart` 接口里**没有** birthInfo 字段，但 jsonl 的每一行都有它（是
	//    JSON.parse 带进来的多余字段，build-fixtures 写盘时原样保留）。不填它，
	//    重写出的 charts.jsonl 会凭空少一个字段。
	//    Global Constraints 禁止改 compare.ts 的契约，所以在这里显式扩展类型。
	const chart: BaselineChart & { birthInfo: BirthInfo } = {
		birthInfo: { ...birthInfo },
		lunarInfo: {
			lunarYear: sample.lunar_year,
			lunarMonth: sample.lunar_month,
			lunarDay: sample.lunar_day,
			yearStem: sample.year_stem,
			yearBranch: sample.year_branch,
			isLeapMonth: sample.is_leap_month,
		},
		mingGongBranch: sample.ming_gong_branch,
		shenGongBranch: sample.shen_gong_branch,
		wuxingJu: sample.wuxing_ju,
		wuxingJuName: sample.wuxing_ju_name,
		ziweiPos: sample.ziwei_pos,
		palaces: palaces.map(palaceOf),
		daXians: daXiansOf(palaces),
		currentAge: sample.current_age,
		currentDaXianIndex: sample.current_daxian_index,
	};

	return { birthInfo, chart };
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test test/sample-source.test.ts
npm run typecheck
```

预期：PASS，13 项通过；typecheck 0 错误。

> 若 `chart.birthInfo` 那一条报类型错，说明实现处写成了光 `BaselineChart`（接口里**没有**
> `birthInfo` 字段）。按 Step 3 的写法改成 `BaselineChart & { birthInfo: BirthInfo }` 即可 ——
> **不要**去改 `compare.ts` 的契约（Global Constraints 禁止）。
> 测试侧的断言用 `(s.chart as Record<string, unknown>).birthInfo`，不受接口影响。

- [ ] **Step 5: 提交**

```bash
git add test/lib/sample-source.ts test/sample-source.test.ts
git commit -m "feat(sample-source): 关系表 → BaselineSample 的纯映射

把 samples + palaces 两表重建成基准样本。三条规则是实测的而非推断：
星曜四段顺序（14,400 个宫零违例）、siHua 键的存在性（18 颗有键，含终生
不参与四化的天府/天相/七杀）、大限按 startAge 升序。

后两条都瞒得过 npm test —— 比对器对 daXians 按下标比但两份数据同序，
val() 又把 \"\" 与 undefined 归一化。所以映射函数做成纯函数，用合成行在
npm test 里逐字节锁住键序与键的存在性，真实语料的正确性另由互验工具证明。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: `fetchSample` + `verify-source.ts` 最小版

**Files:**

- Modify: `test/lib/sample-source.ts`
- Create: `test/tools/verify-source.ts`

**Interfaces:**

- Consumes: Task 2 的 `rowsToSample` / `SampleRow` / `PalaceRow` / `openSource` / `SAMPLE_DB`
- Produces:
  - `fetchSample(birthInfo: BirthInfo): Promise<BaselineSample | null>`
  - `test/tools/verify-source.ts`，接受 `--shard <year>-<month>` 与 `--limit <N>`（完整参数在 Task 4）

- [ ] **Step 1: 实现 `fetchSample`**

在 `test/lib/sample-source.ts` 追加。顶部 import 区补上 `import type { BirthInfo } from "@/ziwei/types";`（若 Task 2 已加则复用）：

```ts
// ── 查询 ──

/**
 * 一条 JOIN 结果行 = `samples` 的列 + `palaces` 的列。
 *
 * ⚠️ `sample_id` 在 JS 侧是 **BigInt**（DuckDB 的 bigint 列经 `yieldRowObjectJs` 不转 number）。
 *    `BigInt(1) !== 1` 恒为 `true`，所以**分组前必须 `Number()` 归一**，否则每组都退化成
 *    「一行一个样本」—— 而且不会报错，只会静默产出 12 倍数量的畸形样本。
 */
type JoinedRow = SampleRow & PalaceRow & { sample_id: bigint };

/**
 * 本模块用到的全部列。`s.sample_id` 供流式遍历分组用（单条取时多余，但共用一条 SQL 更好维护）。
 *
 * ⚠️ 刻意**不** `SELECT *`：库里有 8 个本模块不用的 `sihua_*_star` / `sihua_*_palace` 列，
 *    还有 `topics` 那套论断文本。只取要用的，622 万行的流式读取才不会被无用列拖慢。
 */
const COLUMNS = `
	s.sample_id,
	s.year, s.month, s.day, s.hour, s.gender, s.longitude,
	s.lunar_year, s.lunar_month, s.lunar_day, s.year_stem, s.year_branch, s.is_leap_month,
	s.ming_gong_branch, s.shen_gong_branch, s.wuxing_ju, s.wuxing_ju_name, s.ziwei_pos,
	s.current_age, s.current_daxian_index,
	p.branch, p.stem, p.palace_name,
	p.major_stars, p.lucky_stars, p.sha_stars, p.minor_stars, p.major_brightness, p.sihua_stars,
	p.is_ming_gong, p.is_shen_gong, p.is_current_daxian,
	p.daxian_start, p.daxian_end`;

const FROM = `FROM samples s JOIN palaces p USING (sample_id)`;

/** 宫位必须排成寅起 `[2,3,…,11,0,1]` —— 库中行的物理顺序是丑起 `[1,0,11,…,2]`。 */
const ORDER = `ORDER BY s.sample_id, (p.branch + 10) % 12`;

/** 出生五元组主键（库中唯一确定一条样本）。 */
const KEY_COLUMNS = "s.year = ? AND s.month = ? AND s.day = ? AND s.hour = ? AND s.gender = ?";

/**
 * 按出生信息精确取一条样本；不存在返回 `null`。
 *
 * ⚠️ `birthInfo.hour` 是**时辰序号** 0–11（12=晚子时，语料中不存在）。
 *    `build-fixtures.ts` 的槽位公式恒产出 0–11。
 *
 * ⚠️ 返回 `null` 而非抛错是有意的：`build-fixtures.ts` 在闰月边界上真会遇到取不到的槽位，
 *    它的既有行为是打印「样本缺失」后 `continue`。抛错会让整个重建中断。
 */
export async function fetchSample(birthInfo: BirthInfo): Promise<BaselineSample | null> {
	const conn = await openSource();
	const reader = await conn.runAndReadAll(
		`SELECT ${COLUMNS} ${FROM} WHERE ${KEY_COLUMNS} ${ORDER}`,
		[birthInfo.year, birthInfo.month, birthInfo.day, birthInfo.hour, birthInfo.gender]
	);
	// 唯一一处类型断言：驱动把行值声明为宽松的 `JS` 联合，而我们**刚刚**用上面的 SELECT
	// 亲手指定了列名与顺序，类型由构造保证。断言在 SELECT 旁边，改了列名会立刻失配。
	const rows = reader.getRowObjectsJS() as unknown as JoinedRow[];
	if (rows.length === 0) return null;

	const [first, ...palaces] = rows;
	return rowsToSample(first, palaces);
}
```

- [ ] **Step 2: 写互验工具（最小版）**

创建 `test/tools/verify-source.ts`：

```ts
#!/usr/bin/env node
// ── 互验：jsonl 语料 ↔ DuckDB 逐条比对 ──
//
// 本次改造的主要验收手段。它回答一个别人替不了的问题：**从关系表重建出的样本，
// 与 jsonl 里那一行，是不是逐字节相同？**
//
// 为什么非要有它：本次映射里有多处隐晦约定（siHua 键的存在性、星曜四段顺序、宫位顺序、
// chart.birthInfo 的存在），它们**全都不影响 npm test 的结果** —— 比对器或按名索引、
// 或做了空值归一化。只有字节级比对能兜住。
//
// 取样本时刻意**不用下标算址**。旧 build-fixtures.ts 的 pickFrom 用
// `idx = (day-1)*24 + hour*2 + genderIdx`，隐含「每月每天都齐 24 条」的假设；
// 互验若沿用它，就继承了待验证的假设。这里改为：读 jsonl 的一行 → 取它的出生五元组 →
// 拿这个五元组向 DuckDB 查同一条 → 逐字节比。于是「pickFrom 是否曾经错位」变成一个
// 可直接证实或证伪的问题：差异报告里会同时给出该行的**行号**与**旧公式算出的下标**。
//
// 用法（在 skill 根执行）：
//   node test/tools/verify-source.ts                       # 全量 720 个分片，约 2.3 小时
//   node test/tools/verify-source.ts --shard 1962-06       # 单个分片（720 条，秒级）
//   node test/tools/verify-source.ts --shard 1962-06 --limit 50
//
// 退出码：0 = 全部逐字节一致；1 = 有差异，或语料/依赖/库缺失。
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/ziwei/types";
import type { BaselineSample } from "../lib/compare.ts";
import { fetchSample, openSource, closeSource, SourceError, SAMPLE_DB } from "../lib/sample-source.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/tools
const SKILL_ROOT = resolve(HERE, "../..");

/**
 * jsonl 语料目录。
 *
 * `ZIWEI_SAMPLES` 环境变量可覆盖 —— 这个缝**只为验证「语料缺失」那条错误分支可达**
 * （Step 5 会指向一个不存在的路径）。CLI 引导层的 `pickRoot()` 也是这个套路
 * （`ZIWEI_ROOT` 优先），保持一致。
 */
const SAMPLES = process.env.ZIWEI_SAMPLES ?? resolve(SKILL_ROOT, "reference/ziwei-samples-toolkit/samples-out");

const RULE = "─".repeat(46);

// ── 参数 ──
const argv = process.argv.slice(2);
const optOf = (name: string): string | null => {
	const i = argv.indexOf(`--${name}`);
	if (i < 0) return null;
	const v = argv[i + 1];
	return v && !v.startsWith("--") ? v : null;
};

const SHARD = optOf("shard"); // "1962-06"
const LIMIT = optOf("limit") ? Number(optOf("limit")) : Infinity;

function shardPath(year: number, month: number): string {
	return resolve(SAMPLES, `year-${year}`, `${year}-${String(month).padStart(2, "0")}.jsonl.gz`);
}

/**
 * 把 jsonl 的一行裁剪成基准样本。
 *
 * 与 `build-fixtures.ts` 写盘时的裁剪规则**必须一致**：顶层只留 `birthInfo` 与 `chart`。
 * 样本的 `topics`（13 主题解读文本）占单条体积 90%，且由 toolkit 私有的 db-analysis.ts
 * 生成，本项目刻意不含该文件 —— 基准与互验两侧都剔除它才比得起来。
 */
function trim(raw: { birthInfo: BirthInfo; chart: unknown }): BaselineSample {
	return { birthInfo: raw.birthInfo, chart: raw.chart } as BaselineSample;
}

async function main(): Promise<void> {
	if (!existsSync(SAMPLES)) {
		console.error(
			`找不到 jsonl 语料：${SAMPLES}\n` +
				`  它是 5.5 GB 的只读语料（720 个 jsonl.gz / 60 个年份目录），不入版本控制。\n` +
				`  只有**本互验工具**需要它 —— 重建 fixtures 与全量核验都不需要。\n` +
				`  日常回归更不需要：跑 npm test 即可，fixtures 已入库。`
		);
		process.exit(1);
	}

	try {
		await openSource();
	} catch (err) {
		if (err instanceof SourceError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	}

	// 分片清单：--shard 指定单个，否则 1924-01 ~ 1983-12 全量
	const shards: Array<{ year: number; month: number }> = [];
	if (SHARD) {
		const m = /^(\d{4})-(\d{2})$/.exec(SHARD);
		if (!m) {
			console.error(`--shard 需要形如 1962-06 的值，收到：${SHARD}`);
			process.exit(2);
		}
		shards.push({ year: Number(m[1]), month: Number(m[2]) });
	} else {
		for (let y = 1924; y <= 1983; y++) for (let mo = 1; mo <= 12; mo++) shards.push({ year: y, month: mo });
	}

	console.log(RULE);
	console.log("基准数据源互验（jsonl ↔ DuckDB 逐字节）");
	console.log(`  数据库  : ${SAMPLE_DB}`);
	console.log(`  语料    : ${SAMPLES}`);
	console.log(`  范围    : ${shards.length} 个分片${Number.isFinite(LIMIT) ? `，每片至多 ${LIMIT} 条` : ""}`);
	console.log(RULE);

	let checked = 0;
	let identical = 0;
	const failures: Array<{ shard: string; lineNo: number; birth: BirthInfo; detail: string }> = [];

	for (const { year, month } of shards) {
		const file = shardPath(year, month);
		if (!existsSync(file)) {
			console.error(`  ⚠ 分片缺失：${file}`);
			continue;
		}

		let lineNo = 0;
		const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
		for await (const line of rl) {
			if (!line.trim()) continue;
			lineNo++;
			if (checked >= LIMIT) break;

			const raw = JSON.parse(line) as { birthInfo: BirthInfo; chart: unknown };
			const rebuilt = await fetchSample(raw.birthInfo);
			checked++;

			const want = JSON.stringify(trim(raw));
			const got = rebuilt === null ? null : JSON.stringify(rebuilt);

			if (got === want) {
				identical++;
				continue;
			}

			// 差异定位（Task 4 会把 detail 做成结构化的）
			const detail =
				rebuilt === null
					? "DuckDB 中查无此样本（五元组未命中）"
					: `DuckDB 侧五元组：${JSON.stringify(rebuilt.birthInfo)}\n` +
						`      jsonl 侧五元组：${JSON.stringify(raw.birthInfo)}`;
			failures.push({ shard: `${year}-${String(month).padStart(2, "0")}`, lineNo, birth: raw.birthInfo, detail });
		}
		rl.close();

		if (checked >= LIMIT) break;
	}

	console.log(`\n${RULE}`);
	console.log(`  检查条数  : ${checked}`);
	console.log(`  逐字节一致: ${identical}`);
	console.log(`  有差异    : ${failures.length}`);
	console.log(RULE);

	if (failures.length) {
		console.log(`\n差异明细（前 10 条）：`);
		for (const f of failures.slice(0, 10)) {
			console.log(`\n  ✗ 分片 ${f.shard} 第 ${f.lineNo} 行`);
			console.log(`      样本：${JSON.stringify(f.birth)}`);
			console.log(`      ${f.detail}`);
		}
		if (failures.length > 10) console.log(`\n  …… 另有 ${failures.length - 10} 条未列出`);
		console.log(
			`\n处理：jsonl 与 DuckDB 是同一份语料的两个载体，不存在引擎版本噪音，\n` +
				`      所以这里**没有**「已知差异」的容身之处 —— 任何 diff 都是重建映射写错了。\n` +
				`      若差异是「五元组不符」，先查 finish 分组与 Day/时辰的映射；\n` +
				`      若五元组相符而内容不同，逐字段定位（键序问题改构造顺序，结构问题改映射）。`
		);
	}

	closeSource();
	process.exit(failures.length > 0 ? 1 : 0);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
```

- [ ] **Step 3: 先单独验 `fetchSample` 的两条分支（Review Focus #1）**

互验工具会顺带覆盖正常分支，但它**永远不会**走到「五元组未命中」那条 ——
它的每一次查询都来自 jsonl 里真实存在的行。而 `build-fixtures.ts` 会走到
（闰月边界上取不到的槽位），所以这两条分支要单独钉一遍：

```bash
node --input-type=module -e '
import { fetchSample, closeSource } from "./test/lib/sample-source.ts";
// 真实存在的一条：1924-01-01 时0 male（sample_id = 1）
const hit = await fetchSample({ year: 1924, month: 1, day: 1, hour: 0, gender: "male" });
console.log("命中：", hit ? `${hit.chart.palaces.length} 宫 / 命宫地支 ${hit.chart.mingGongBranch}` : "**null**");
// 语料是 12 月 × 30 日 × 12 时辰的**合成网格**，所以不存在的不是「2 月 30 日」而是越界值：
const miss1 = await fetchSample({ year: 1924, month: 1, day: 31, hour: 0, gender: "male" });   // 日是 1..30
const miss2 = await fetchSample({ year: 1924, month: 1, day: 1, hour: 12, gender: "male" });   // 时辰序号是 0..11
const miss3 = await fetchSample({ year: 1900, month: 1, day: 1, hour: 0, gender: "male" });    // 年份是 1924..1983
console.log("未命中：", miss1, miss2, miss3);
closeSource();
'
```

预期：第一行 `12 宫 / 命宫地支 0`，第二行 `未命中： null null null`。

> ⚠️ **本条曾误写为「命宫地支 2」，已更正为 0。** 执行期实测：DB 与 fixtures 两侧
> `chart.mingGongBranch` 都是 **0**，名为「命宫」的宫位 `branch` 也是 0。
> 「2」混淆了**寅起数组的下标**（`palaces[0].branch === 2`，即寅）与**命宫的地支值** ——
> 两者是不同的量。以真实数据为准，逐字节互验（720/720 全等）证实 0 正确。
>
> ⚠️ **别拿 `1924-02-30` 当反例** —— 实测它在库中**存在**（24 条）。语料是按
> `12 月 × 30 日 × 12 时辰 × 2 性别 × 60 年` 生成的**合成网格**，不遵循真实月长，
> 2 月也有 30 天。真正不存在的只有越界值：`day=31`、`hour=12`、`month=13`、年份越界。
>
> ⚠️ 这一条测的是**返回 `null` 而非抛错**。若这里抛了 `SourceError` 或返回了半条盘
> （`palaces` 不足 12 个），`build-fixtures.ts` 的「打印样本缺失后 `continue`」就变成
> 「整个重建中断」，300 条 fixtures 会在第一个闰月边界上崩掉。

- [ ] **Step 4: 跑一次小样本互验**

```bash
node test/tools/verify-source.ts --shard 1924-01 --limit 20
```

预期：`检查条数 20 / 逐字节一致 20 / 有差异 0`，退出码 0。

**若出现差异**，按报告的提示分层定位，**不要**先怀疑数据源 —— 优先怀疑 Task 2 的三条隐晦规则（`siHua` 键存在性、星曜四段顺序、`daXians` 排序）与键序。

- [ ] **Step 5: 逐步放大到一整个分片**

```bash
node test/tools/verify-source.ts --shard 1924-01
node test/tools/verify-source.ts --shard 1962-06
node test/tools/verify-source.ts --shard 1983-12
```

预期：三项都是 720 条全等、0 差异。挑的三个分片覆盖语料头、中、尾。

- [ ] **Step 6: 验证语料缺失的指引可达（Review Focus #5）**

用 `ZIWEI_SAMPLES` 指向一个不存在的路径，逼出那条分支：

```bash
ZIWEI_SAMPLES=/nonexistent/no-corpus node test/tools/verify-source.ts --shard 1924-01; echo "退出码：$?"
```

预期：打印含 `找不到 jsonl 语料` / `/nonexistent/no-corpus` / `5.5 GB` / `只有**本互验工具**需要它`
的指引，**退出码 1**，且输出里**没有** `ENOENT` 或堆栈。

再确认默认路径下一切正常（同一条命令去掉环境变量）：

```bash
node test/tools/verify-source.ts --shard 1924-01 --limit 5; echo "退出码：$?"
```

预期：5 条全等，退出码 0。

- [ ] **Step 7: 跑回归与类型检查**

```bash
npm test
npm run typecheck
```

预期：全绿（`npm test` 不受本任务影响 —— 它不碰数据文件）。

- [ ] **Step 8: 提交**

```bash
git add test/lib/sample-source.ts test/tools/verify-source.ts
git commit -m "feat(verify-source): 按出生五元组取样本，与 jsonl 逐字节互验

fetchSample 走五元组主键查询，取不到返回 null —— build-fixtures 在闰月
边界上真会遇到取不到的槽位，它的既有行为是打印「样本缺失」后继续。

互验工具刻意不用旧 pickFrom 的下标算址：那个公式隐含「每月每天齐 24 条」
的假设，互验若沿用它就继承了待验证的假设。改为读 jsonl 行 → 取它的五元组
→ 向 DuckDB 查同一条 → 逐字节比，于是「pickFrom 是否曾错位」变成可直接
证实或证伪的问题。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: `verify-source.ts` 完整化

**Files:**

- Modify: `test/tools/verify-source.ts`

**Interfaces:**

- Consumes: Task 3 的全部
- Produces: 命令行 `--year <N>` / `--month <N>` / `--limit <N>` / `--quiet`；差异按「键序 / 结构 / 五元组不符」三类分桶

- [ ] **Step 1: 写分类与定位的逻辑**

在 `test/tools/verify-source.ts` 里，把 Task 3 的 `main()` 中「差异定位（Task 4 会把 detail 做成结构化的）」那一段替换掉，并追加两个纯函数。先在文件里加上这两个函数（放在 `trim` 之后）：

```ts
/** 递归按 key 排序的规范 JSON —— 用来判定「差异是否**只是键序**」。 */
function canonical(v: unknown): unknown {
	if (Array.isArray(v)) return v.map(canonical);
	if (v && typeof v === "object") {
		const o = v as Record<string, unknown>;
		return Object.fromEntries(Object.keys(o).sort().map(k => [k, canonical(o[k])]));
	}
	return v;
}

/** 逐字段找第一处不同，返回 `路径 = 基准 / 实际`（找不到返回 null）。 */
function firstStructuralDiff(a: unknown, b: unknown, path = ""): string | null {
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return `${path} = ${JSON.stringify(a)} / ${JSON.stringify(b)}`;
		if (a.length !== b.length) return `${path}.length = ${a.length} / ${b.length}`;
		for (let i = 0; i < a.length; i++) {
			const d = firstStructuralDiff(a[i], b[i], `${path}[${i}]`);
			if (d) return d;
		}
		return null;
	}
	if (a && b && typeof a === "object" && typeof b === "object") {
		const ao = a as Record<string, unknown>;
		const bo = b as Record<string, unknown>;
		for (const k of Object.keys(ao)) if (!(k in bo)) return `${path}.${k} = 存在 / **缺失**`;
		for (const k of Object.keys(bo)) if (!(k in ao)) return `${path}.${k} = **缺失** / 存在`;
		for (const k of Object.keys(ao)) {
			const d = firstStructuralDiff(ao[k], bo[k], `${path}.${k}`);
			if (d) return d;
		}
		return null;
	}
	return a === b ? null : `${path} = ${JSON.stringify(a)} / ${JSON.stringify(b)}`;
}

type DiffKind = "五元组不符" | "键序不同" | "结构不同";

/** 判定两侧差异属于哪一类。 */
function classify(want: unknown, got: unknown): { kind: DiffKind; detail: string } {
	if (JSON.stringify(canonical(want)) === JSON.stringify(canonical(got))) {
		return { kind: "键序不同", detail: `逐字段值相同，但键的插入顺序不同（改重建侧的构造顺序）` };
	}
	return { kind: "结构不同", detail: firstStructuralDiff(want, got) ?? "（未定位到具体字段）" };
}
```

把 `main()` 里的差异分支换成：

```ts
			// ── 差异分类 ──
			// 问「五元组是否相符」优先于问「内容哪里不同」：不符说明取错了样本，
			// 后面逐字段比毫无意义（且这正是旧 pickFrom 下标算址错位会表现出的样子）。
			const sameKey =
				rebuilt !== null &&
				rebuilt.birthInfo.year === raw.birthInfo.year &&
				rebuilt.birthInfo.month === raw.birthInfo.month &&
				rebuilt.birthInfo.day === raw.birthInfo.day &&
				rebuilt.birthInfo.hour === raw.birthInfo.hour &&
				rebuilt.birthInfo.gender === raw.birthInfo.gender;

			// 旧 pickFrom 的公式：仅供诊断，**不参与取数**。
			// 行号与它算出的下标不一致 = 旧实现曾经错位取数的直接证据。
			const legacyIdx =
				(raw.birthInfo.day - 1) * 24 + raw.birthInfo.hour * 2 + (raw.birthInfo.gender === "female" ? 1 : 0);

			let kind: DiffKind | "查无此样本";
			let detail: string;
			if (rebuilt === null) {
				kind = "查无此样本";
				detail = `DuckDB 中五元组未命中`;
			} else if (!sameKey) {
				kind = "五元组不符";
				detail =
					`DuckDB 侧五元组 ${JSON.stringify(rebuilt.birthInfo)}\n` +
					`      jsonl 侧五元组 ${JSON.stringify(raw.birthInfo)}`;
			} else {
				const c = classify(trim(raw), rebuilt);
				kind = c.kind;
				detail = c.detail;
			}

			buckets.set(kind, (buckets.get(kind) ?? 0) + 1);
			failures.push({
				shard: `${year}-${String(month).padStart(2, "0")}`,
				lineNo,
				birth: raw.birthInfo,
				kind,
				detail,
				legacyIdx,
				aligned: legacyIdx === lineNo - 1,
			});
```

并把 `failures` 与 `buckets` 的声明、报告段落一并改掉：

```ts
	let checked = 0;
	let identical = 0;
	const buckets = new Map<string, number>();
	const failures: Array<{
		shard: string;
		lineNo: number;
		birth: BirthInfo;
		kind: string;
		detail: string;
		legacyIdx: number;
		aligned: boolean;
	}> = [];
```

报告段落（替换 Task 3 里 `if (failures.length) { ... }` 整块）：

```ts
	if (failures.length) {
		console.log(`\n按类型分桶：`);
		for (const [k, n] of [...buckets].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12, "　")} ${n}`);

		console.log(`\n差异明细（前 10 条）：`);
		for (const f of failures.slice(0, 10)) {
			console.log(`\n  ✗ [${f.kind}] 分片 ${f.shard} 第 ${f.lineNo} 行（该行在分片内下标 ${f.lineNo - 1}）`);
			console.log(`      样本：${JSON.stringify(f.birth)}`);
			console.log(`      ${f.detail}`);
			console.log(
				`      旧 pickFrom 公式算出的下标：${f.legacyIdx}` +
					(f.aligned ? "（与本行位置一致）" : "（**与本行位置不一致** —— 旧实现曾经错位取数）")
			);
		}
		if (failures.length > 10) console.log(`\n  …… 另有 ${failures.length - 10} 条未列出`);
		console.log(
			`\n处理（按 spec 第五节的顺序）：\n` +
				`  1. 「键序不同」→ 改 test/lib/sample-source.ts 里重建对象的键插入顺序\n` +
				`  2. 「五元组不符」或「查无此样本」→ 先查取数路径，再看旧 pickFrom 是否曾经错位\n` +
				`  3. 「结构不同」→ 逐字段定位，改映射\n` +
				`  ⚠️ jsonl 与 DuckDB 是同一份语料的两个载体，不存在引擎版本噪音，\n` +
				`     所以这里**没有**「已知差异」的容身之处 —— 任何 diff 都是映射写错了。\n` +
				`  ⚠️ **不得**直接把新结果覆盖上去当基准：基准是负债还是保障，取决于它有没有被审阅过。`
		);
	}
```

- [ ] **Step 2: 加 `--year` / `--month` / `--quiet` 参数**

把 Task 3 的参数区与分片清单换成：

```ts
const SHARD = optOf("shard"); // "1962-06"，与 --year/--month 互斥
const YEAR = optOf("year") ? Number(optOf("year")) : null;
const MONTH = optOf("month") ? Number(optOf("month")) : null;
const LIMIT = optOf("limit") ? Number(optOf("limit")) : Infinity;
const QUIET = argv.includes("--quiet");
```

```ts
	// 分片清单：--shard 单个 > --year/--month > 全量 1924-01 ~ 1983-12
	const shards: Array<{ year: number; month: number }> = [];
	if (SHARD) {
		const m = /^(\d{4})-(\d{2})$/.exec(SHARD);
		if (!m) {
			console.error(`--shard 需要形如 1962-06 的值，收到：${SHARD}`);
			process.exit(2);
		}
		shards.push({ year: Number(m[1]), month: Number(m[2]) });
	} else {
		const years = YEAR ? [YEAR] : Array.from({ length: 60 }, (_, i) => 1924 + i);
		const months = MONTH ? [MONTH] : Array.from({ length: 12 }, (_, i) => i + 1);
		for (const y of years) for (const mo of months) shards.push({ year: y, month: mo });
	}
```

并在分片循环内加进度输出（在 `rl.close()` 之后）：

```ts
		if (!QUIET) {
			process.stderr.write(`  分片 ${year}-${String(month).padStart(2, "0")} 完成（累计 ${checked} 条）\n`);
		}
```

- [ ] **Step 3: 逐项验证参数**

```bash
node test/tools/verify-source.ts --shard 1924-01 --limit 50   # 50 条
node test/tools/verify-source.ts --year 1924 --month 1 --limit 50   # 同上，另一种写法
node test/tools/verify-source.ts --year 1924 --limit 100      # 跨 12 个分片共 100 条
node test/tools/verify-source.ts --year 1900                  # 空结果：0 条，退出码 0
node test/tools/verify-source.ts --shard 62-6                 # 参数写错：提示格式，退出码 2
```

预期：前三条「逐字节一致 = 检查条数」；第四条 0 条 0 差异、退出码 0；第五条打印 `--shard 需要形如 1962-06 的值`、退出码 2。

- [ ] **Step 4: 跑一次跨界面的中等规模互验**

```bash
node test/tools/verify-source.ts --year 1962
```

预期：8,640 条全等、0 差异（约 30–60 秒）。

- [ ] **Step 5: 回归与类型检查**

```bash
npm test && npm run typecheck
```

预期：全绿。

- [ ] **Step 6: 提交**

```bash
git add test/tools/verify-source.ts
git commit -m "feat(verify-source): 差异分类与定位，补齐 --year/--month/--quiet

差异按「五元组不符 / 查无此样本 / 键序不同 / 结构不同」分桶。先判五元组
是否相符再逐字段比：不符说明取错了样本，后面的字段比对毫无意义 —— 而且
这正是旧 pickFrom 下标算址错位会表现出的样子，报告里并把该行的行号与
旧公式算出的下标并排给出，让「曾否错位」一眼可判。

键序与结构的区分靠「递归按 key 排序后的规范形式是否相等」：两者都要修，
但修的地方不同（前者改构造顺序，后者改映射）。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: `forEachSample` 流式遍历

**Files:**

- Modify: `test/lib/sample-source.ts`

**Interfaces:**

- Consumes: Task 3 的 `COLUMNS` / `FROM` / `ORDER` / `JoinedRow`
- Produces: `forEachSample(filter: SampleFilter, fn: (raw: BaselineSample) => boolean | void): Promise<boolean>`

- [ ] **Step 1: 实现流式遍历**

在 `test/lib/sample-source.ts` 的 `fetchSample` **之后**追加：

```ts
/**
 * 流式遍历样本。回调返回 `false` 即停止读取。
 *
 * @returns `true` = 读尽；`false` = 被回调中止，或达到了 `filter.limit`。
 *          **这个返回值是刻意保留的** —— `full-corpus.ts` 的 `--limit` 逻辑靠它区分
 *          「扫完了」与「够了，停」。不要图省事改成 `void`。
 *
 * ⚠️ **不把 622 万行一次读进内存**：`conn.stream()` 按 2048 行一批吐出（实测全量
 *    JOIN + 排序的查询首块 111 ms 到达，DuckDB 的 ORDER_BY 是增量的），
 *    本函数只在内存里攒**当前这一个样本**的 12 行。
 */
export async function forEachSample(
	filter: SampleFilter,
	fn: (raw: BaselineSample) => boolean | void
): Promise<boolean> {
	const conn = await openSource();

	const where: string[] = [];
	const params: Array<number | string> = [];
	if (filter.year !== undefined) {
		where.push("s.year = ?");
		params.push(filter.year);
	}
	if (filter.month !== undefined) {
		where.push("s.month = ?");
		params.push(filter.month);
	}
	const sql = `SELECT ${COLUMNS} ${FROM}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ${ORDER}`;

	const result = await conn.stream(sql, params);

	let currentId: number | null = null;
	let current: SampleRow | null = null;
	let palaces: PalaceRow[] = [];
	let seen = 0;

	/** 组装当前样本并回调；返回 false 表示应当停止。 */
	const flush = (): boolean => {
		if (current === null) return true;
		seen++;
		const sample = rowsToSample(current, palaces);
		if (fn(sample) === false) return false;
		return !(Number.isFinite(filter.limit) && seen >= (filter.limit as number));
	};

	for await (const batch of result.yieldRowObjectJs()) {
		for (const raw of batch) {
			// ⚠️ 必须 Number()：sample_id 是 bigint 列，JS 侧是 BigInt，
			//    而 `BigInt(1) !== 1` 恒为 true —— 直接比会让每个样本都被当成新样本。
			const row = raw as unknown as JoinedRow;
			const id = Number(row.sample_id);

			if (id !== currentId) {
				if (!flush()) return false;
				currentId = id;
				current = row;
				palaces = [];
			}
			palaces.push(row);
		}
	}
	return flush();
}
```

- [ ] **Step 2: 冒烟：条数与过滤**

```bash
node --input-type=module -e '
import { forEachSample, closeSource } from "./test/lib/sample-source.ts";
let n = 0, sum = 0;
await forEachSample({ year: 1924, month: 1 }, raw => { n++; sum += raw.chart.palaces.length; });
console.log(`1924-01：样本 ${n} 条，宫位合计 ${sum}（应为 ${n*12}）`);
closeSource();
'
```

预期：`样本 720 条，宫位合计 8640`。

- [ ] **Step 3: 冒烟：`limit` 必须提前中止（Review Focus #2）**

```bash
time node --input-type=module -e '
import { forEachSample, closeSource } from "./test/lib/sample-source.ts";
let n = 0;
const done = await forEachSample({ limit: 5 }, raw => { n++; });
console.log(`回调收到 ${n} 条，forEachSample 返回 ${done}（应为 false）`);
closeSource();
'
```

预期：`回调收到 5 条，forEachSample 返回 false`，且**墙钟在 2 秒内**（若是读完了 622 万行才停，会花掉分钟级时间 —— 这条断言测的就是「停得下来」）。

- [ ] **Step 4: 冒烟：回调返回 `false` 也中止**

```bash
node --input-type=module -e '
import { forEachSample, closeSource } from "./test/lib/sample-source.ts";
let n = 0;
const done = await forEachSample({}, raw => { n++; return n < 3; });
console.log(`回调收到 ${n} 条，返回 ${done}（应为 3 / false）`);
closeSource();
'
```

预期：`回调收到 3 条，返回 false`。

- [ ] **Step 5: 冒烟：读尽返回 `true`**

```bash
node --input-type=module -e '
import { forEachSample, closeSource } from "./test/lib/sample-source.ts";
let n = 0;
const done = await forEachSample({ year: 1924, month: 1, limit: 720 }, () => { n++; });
console.log(`回调收到 ${n} 条，返回 ${done}（应为 true —— 恰好读尽，未触发 limit 中止）`);
closeSource();
'
```

预期：`720 / true`。

> ⚠️ 边界语义：`seen >= limit` 在**第 720 条之后**判停，此时数据也已读尽，故返回 `true`。这正是 `full-corpus.ts` 需要的 —— 它的 `if (!done || stats.checked >= LIMIT) break` 两种写法都能正确收尾。

- [ ] **Step 6: 回归与类型检查**

```bash
npm test && npm run typecheck
```

预期：全绿。

- [ ] **Step 7: 提交**

```bash
git add test/lib/sample-source.ts
git commit -m "feat(sample-source): 流式遍历 forEachSample

一条 JOIN 流式读取，按 sample_id 分组，遇 id 变化即组装回调 —— 不在内存里
攒 622 万行。DuckDB 的 ORDER_BY 是增量吐出的（实测全量查询首块 111 ms 到达），
所以不需要引入 LIMIT/OFFSET 分页。

sample_id 是 bigint 列，JS 侧是 BigInt，而 BigInt(1) !== 1 恒为 true ——
分组前必须 Number() 归一，否则每个样本都会被当成新样本，且不会报错，只会
静默产出 12 倍数量的畸形样本。

返回值 true/false 区分「读尽」与「被中止」是刻意的，full-corpus 的 --limit
逻辑依赖它。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: `full-corpus.ts` 改接数据源

**Files:**

- Modify: `test/tools/full-corpus.ts`

**Interfaces:**

- Consumes: Task 5 的 `forEachSample`；Task 1 的 `openSource` / `SourceError`
- Produces: 命令行 `--year` / `--month` / `--limit` / `--quiet` 语义与改造前**完全一致**

- [ ] **Step 1: 换掉导入了的读取层**

**先删这三块**（它们在下面的替换范围之外，删漏了就是一片死代码）：

| 位置             | 删什么                                                                                                                                                                                                                                   | 为什么                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 文件头 import 区 | `createReadStream`、`existsSync`（`node:fs` 整行）、`createInterface`（`node:readline` 整行）、`createGunzip`（`node:zlib` 整行）、`dirname`（`node:path` 那行的 `dirname` 分量）、`type BaselineSample`（`compare.ts` import 里的一项） | 只服务于被删掉的 jsonl 读取层                   |
| 常量区           | `SKILL_ROOT`、`SAMPLES`、`YEAR_ALL`                                                                                                                                                                                                      | 数据源已换；年份范围改由 `expectedTotal()` 表达 |
| 函数与派生量     | `range()`、`shardPath()`、整块本地 `forEachSample()`（readline+gunzip 那版）、`const years = …`、`const months = …`                                                                                                                      | 全部由 `sample-source.ts` 接管                  |

**保留不动**：`hasFlag` / `optOf` / `YEAR` / `MONTH` / `LIMIT` / `QUIET`（参数块原样留着）、
`label()`、`DiffBucket`、`MAX_DETAIL`、文件末尾的 `isDirectRun` 守卫
（它用到 `resolve` 与 `fileURLToPath`，故这两个 import 要留）。
`PROGRESS_EVERY` 的**值**由 `10` 改为 `7200`（见 Step 2）。
`CorpusStats` 删掉 `missingShards` 一项（见 Step 3）。

把文件顶部的注释块与 import 换成：

```ts
#!/usr/bin/env node
// ── 全量核验：把 db/ziwei.duckdb 里的全部 518,400 条样本跑一遍 ──
//
// 与 npm test 的分工：
//   npm test                 → test/fixtures/ 里 300 条**抽样**基准，秒级，日常回归
//   本脚本                    → DuckDB 里**全量**语料，单线程约 2 小时，按需手动跑
//
// 什么时候需要它：
//   · 升级 iztro 之后，确认「差异集合没有扩大」（抽样可能刚好没抽到变化的那一宫）
//   · 重建 fixtures 抽样之前，先确认整体一致（抽样只覆盖 12 时辰 × 12 月，未必碰到边界）
//   · 排查某个特定年份/月份的问题
//
// 用法（在 skill 根执行）：
//   node test/tools/full-corpus.ts                        # 全量，约 2 小时
//   node test/tools/full-corpus.ts --year 1960            # 只跑 1960 年（8,640 条，约 2 分钟）
//   node test/tools/full-corpus.ts --year 1960 --month 6  # 只跑 1960-06（720 条，约 12 秒）
//   node test/tools/full-corpus.ts --limit 5000           # 只跑前 5,000 条
//   node test/tools/full-corpus.ts --quiet                # 不打印进度，只出报告
//
// 退出码：0 = 白名单之外零差异；1 = 有差异，或数据库/依赖缺失。可直接用于 CI。
//
// ⚠️ 与 npm test 用**同一个比对器与同一份白名单**（test/lib/compare.ts）。
//    这里不用白名单过滤掉差异，而是用 keepWhitelisted 保留后再分类统计 ——
//    这样报告里能同时看到「放行了多少处已知差异」和「有没有出现新差异」。
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo } from "@/ziwei/types";
import { loadAlgorithm } from "../lib/loader.ts";
import { compareChart, formatDiffs, BRANCHES, type ChartDiff } from "../lib/compare.ts";
import { forEachSample, openSource, closeSource, SourceError, SAMPLE_DB } from "../lib/sample-source.ts";
```

> ⚠️ 刻意**没有** `const HERE = …`：本文件不再需要「<skill 根>/test/tools」这个位置
> （唯一的用途是拼分片路径）。`resolve` 与 `fileURLToPath` 仍被末尾的 `isDirectRun` 守卫用到，要留。
>
> `tsconfig.json` 没开 `noUnusedLocals`，所以漏删的死代码**不会**让 `npm run typecheck` 报错 ——
> 上表那三块必须手动核对删净。

- [ ] **Step 2: 换掉主循环**

把 `main()` 换成：

```ts
/** 进度输出的间隔（条）。旧实现按分片报（每 10 个分片 ≈ 7,200 条），此处等价换算成条数。 */
const PROGRESS_EVERY = 7200;

async function main(): Promise<void> {
	try {
		await openSource();
	} catch (err) {
		if (err instanceof SourceError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	}

	const { generateChart } = await loadAlgorithm();

	const stats: CorpusStats = {
		checked: 0,
		clean: 0,
		dirty: 0,
		whitelistedCells: 0,
		buckets: new Map(),
		detail: [],
	};
	const t0 = Date.now();

	const done = await forEachSample(
		{ year: YEAR ?? undefined, month: MONTH ?? undefined, limit: LIMIT },
		raw => {
			stats.checked++;
			const actual = generateChart({ ...raw.birthInfo });
			const all = compareChart(actual, raw.chart, { keepWhitelisted: true });

			let real: ChartDiff[] | null = null;
			for (const d of all) {
				if (d.whitelisted) {
					stats.whitelistedCells++;
					continue;
				}
				(real ??= []).push(d);
				let b = stats.buckets.get(d.path);
				if (!b) {
					b = { count: 0, expected: d.expected, actual: d.actual, sample: raw.birthInfo };
					stats.buckets.set(d.path, b);
				}
				b.count++;
			}

			if (real) {
				stats.dirty++;
				if (stats.detail.length < MAX_DETAIL) stats.detail.push({ birth: raw.birthInfo, diffs: real });
			} else {
				stats.clean++;
			}

			if (!QUIET && stats.checked % PROGRESS_EVERY === 0) {
				process.stderr.write(
					`  已检查 ${stats.checked.toLocaleString("en-US")} 条` +
						`（用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒）\n`
				);
			}

			return true; // 停止由 filter.limit 负责
		}
	);

	report(stats, expectedTotal(), done, Date.now() - t0);
	closeSource();
	process.exit(stats.dirty > 0 ? 1 : 0);
}

/** 本次过滤条件覆盖的样本总数（用于判断报告是否被 --limit 截断）。 */
function expectedTotal(): number {
	return (YEAR ? 1 : 60) * (MONTH ? 1 : 12) * 720;
}
```

- [ ] **Step 3: 改报告**

把 `report` 的签名与头部换成：

```ts
function report(s: CorpusStats, expected: number, completed: boolean, ms: number): void {
	const line = (k: string, v: string): void => console.log(`  ${k.padEnd(12, "　")} ${v}`);
	const scope = `${YEAR ?? 1924}-${String(MONTH ?? 1).padStart(2, "0")} ~ ${YEAR ?? 1983}-${String(MONTH ?? 12).padStart(2, "0")}`;
	const limited = !completed || s.checked < expected;

	console.log("\n══ 全量核验汇总 ══");
	line("数据源", SAMPLE_DB);
	line("范围", `${scope}（${expected.toLocaleString("en-US")} 条${limited ? "，受 --limit 截断" : ""}）`);
	line("检查条数", s.checked.toLocaleString("en-US"));
	line("完全一致", s.clean.toLocaleString("en-US"));
	line("有差异", s.dirty.toLocaleString("en-US"));
	line("白名单放行", `${s.whitelistedCells.toLocaleString("en-US")} 处（已知：太阳/太阴在酉宫的亮度，见 test/lib/compare.ts）`);
	line("耗时", `${(ms / 1000).toFixed(1)} 秒（${(ms / Math.max(s.checked, 1)).toFixed(1)} ms/条）`);
	console.log("");
```

`report` 其余部分（零差异分支、分桶、明细、处理建议）**保持不变**。同时 `CorpusStats` 里的 `missingShards` 字段**删除**（单一数据文件不存在时，不存在「部分缺失」这种中间状态）。

- [ ] **Step 4: 小范围跑通**

```bash
node test/tools/full-corpus.ts --year 1924 --month 1
node test/tools/full-corpus.ts --year 1960 --month 6
```

预期：各 720 条，`完全一致 720`、`有差异 0`，退出码 0；报告里「数据源」一行指向 `db/ziwei.duckdb`，**没有**「缺失分片」一行。

- [ ] **Step 5: 验证 `--limit` 与 `--quiet`**

```bash
node test/tools/full-corpus.ts --limit 50
node test/tools/full-corpus.ts --limit 50 --quiet
```

预期：都是 50 条、0 差异，退出码 0；报告里带「受 --limit 截断」；`--quiet` 版没有任何进度输出。

- [ ] **Step 6: 与改造前的数字对账**

```bash
node test/tools/full-corpus.ts --year 1960
```

预期：8,640 条，`有差异 0`，白名单放行处数与改造前一致（太阳/太阴在酉宫的亮度差异，量级在数百处）。**这条是本任务最要紧的验收** —— 数据源换了但结论必须一模一样。

- [ ] **Step 7: 回归与类型检查**

```bash
npm test && npm run typecheck
```

预期：全绿。

- [ ] **Step 8: 提交**

```bash
git add test/tools/full-corpus.ts
git commit -m "refactor(full-corpus): 数据源换成 DuckDB

SAMPLES 常量、shardPath 与本地那份 readline+gunzip 的 forEachSample 全部
删除，改调 test/lib/sample-source.ts。「跳过缺失分片并计数」随之消失 ——
单一数据文件不存在时，不存在「部分缺失」这种中间状态，报告里的缺失分片
一行一并去掉。

--year / --month / --limit / --quiet 的语义与改造前完全一致，进度输出从
「每 10 个分片」等价换算成「每 7,200 条」。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: `build-fixtures.ts` 改接数据源 + 零 diff 验收

**Files:**

- Modify: `test/tools/build-fixtures.ts`

**Interfaces:**

- Consumes: Task 3 的 `fetchSample`；Task 1 的 `openSource` / `SourceError`
- Produces: 抽样规则与产出**逐字节不变**的 `test/fixtures/charts.jsonl`

- [ ] **Step 1: 换掉读取层**

把文件顶部注释与 import 换成：

```ts
#!/usr/bin/env node
// ── 从 DuckDB 样本库抽样，生成 test/fixtures/ 轻量基准 ──
//
// 仅在需要**重建**基准时手动执行（db/ziwei.duckdb 不入版本控制，正常跑测试不需要它）：
//   node test/tools/build-fixtures.ts
//
// 抽样是**确定性的**（不用随机数），同样的输入必然产出同样的 fixtures —— 基准可复现、可审阅 diff。
//
// ⚠️ 产出的基准是 **iztro 2.5.8** 的行为快照，本项目用 2.6.1，两者有且仅有两处已知差异
//    （太阳/太阴在酉宫的亮度），已在 test/lib/compare.ts 的 KNOWN_DIVERGENCES 里显式登记。
//
// ⚠️ 取样本改为**按出生五元组主键查询**（旧实现按行下标算址：idx = (day-1)*24 + hour*2 + genderIdx）。
//    下标算址隐含「每月每天都齐 24 条样本」的假设，改成主键查询后这个假设不再需要，语义更正确。
//    若重建结果与既有 charts.jsonl 出现 diff，**先怀疑旧实现曾经错位取数**，
//    用 test/tools/verify-source.ts 查清，而不是直接覆盖。
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BaselineSample } from "../lib/compare.ts";
import { fetchSample, openSource, closeSource, SourceError } from "../lib/sample-source.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url)); // <skill 根>/test/tools
const OUT_DIR = resolve(HERE, "../fixtures");

const YEAR_START = 1924;
const YEAR_END = 1983;
```

> `SAMPLES`、`readShard`、`pickFrom` 与相关的 `createReadStream` / `createInterface` / `createGunzip` / `existsSync` / `dirname` import **整块删除**。

- [ ] **Step 2: 换掉取样本的三处调用**

```ts
		const raw = await fetchSample({ year, month, day, hour, gender });
```

（原第 83 行 `pickFrom(await readShard(year, month), day, hour, gender)`。）

```ts
			raw = await fetchSample({ year, month: solar.getMonth(), day: solar.getDay(), hour, gender: "male" });
```

（原第 101 行。）

```ts
			raw = await fetchSample({ year, month: 12, day: 30, hour: 0, gender: "male" });
```

（原第 104 行。）

- [ ] **Step 3: 把目录守卫换成数据源守卫**

把 `main()` 开头那段 `existsSync(SAMPLES)` 的检查换成：

```ts
	try {
		await openSource();
	} catch (err) {
		if (err instanceof SourceError) {
			console.error(err.message);
			process.exit(1);
		}
		throw err;
	}
```

并在 `main()` 末尾（`console.warn("  ⚠ 月或时辰覆盖不全…")` 之后）加：

```ts
	closeSource();
```

**`manifest.json` 的两个字段刻意不动。** 写盘那一段里有：

```ts
description: "紫微斗数排盘基准（golden）—— 从 reference/ziwei-samples-toolkit 抽样而来",
source: "reference/ziwei-samples-toolkit/samples-out",
```

看起来该改（数据源明明是 DuckDB），**但不要改**：

1. 它们是**语料的出处**，不是「工具从哪读」。语料确实源自 toolkit，改造后这句话依然属实。
2. `manifest.json` 是本任务的零 diff 验收对象之一（Step 6）。改它 = 自己制造 diff，
   还会连带污染 `test/fixtures/` 这个入库产物的审阅范围。

只有 `generatedAt` 与 `coverage` 会随重建自然更新（前者同日不变）。

- [ ] **Step 4: 写盘前先跑互验（前置关）**

**这是本任务的核心。** 重建 fixtures 之前，必须先用互验工具确认重建映射本身是对的 —— 否则 `charts.jsonl` 的 diff 会同时混着「映射错」与「抽样变」两种原因，无从分辨。

```bash
node test/tools/verify-source.ts --shard 1924-01
node test/tools/verify-source.ts --year 1962
```

预期：两次都 0 差异。**有差异就停在这里**，回 Task 2/4 定位，不要往下走。

- [ ] **Step 5: 重建并做零 diff 验收（spec 第五节第二层）**

```bash
cp test/fixtures/charts.jsonl /tmp/charts.jsonl.before
node test/tools/build-fixtures.ts
git diff --exit-code test/fixtures/charts.jsonl
echo "零 diff 验收退出码：$?"
```

预期：脚本打印「分歧自检通过：300 条抽样与当前内核一致」，然后 `git diff` **无输出**、退出码 0。

**若有 diff**，按 spec 第五节的处置顺序办：

1. 看 diff 是键序还是结构 —— 键序 → 改 `rowsToSample` 的构造顺序；结构 → 逐字段定位。
2. 若某条样本整个不同 → 用 `verify-source.ts` 确认是不是旧 `pickFrom` 曾经错位。
3. **不得**直接把新结果覆盖上去当基准。

- [ ] **Step 6: 确认 manifest 未变**

```bash
git diff --exit-code test/fixtures/manifest.json; echo "manifest 退出码：$?"
```

预期：0（`generatedAt` 是日期，同日重建不变；若跨了日期，只有那一行变，**这是预期的**，确认 diff 仅此一行即可）。

- [ ] **Step 7: 回归与类型检查**

```bash
npm test && npm run typecheck
```

预期：全绿。`npm test` 的头部环境块应仍显示「300 条（iztro 2.5.8 快照，1924-1983 抽样）· 覆盖 12/12 月 · 12/12 时辰 · N 闰月年」。

- [ ] **Step 8: 提交**

```bash
git add test/tools/build-fixtures.ts
git commit -m "refactor(build-fixtures): 取样本改为按五元组主键查询

readShard 与 pickFrom 删除。旧的下标算址（idx = (day-1)*24 + hour*2 +
genderIdx）隐含「每月每天都齐 24 条样本」的假设，主键查询不再需要它。

重建前后 charts.jsonl 逐字节零 diff，且 ts 键序与键的存在性由 verify-source
用真实 jsonl 独立证明过 —— 这两条 npm test 都看不见（比对器按名索引，
val() 又把空串与 undefined 归一化）。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: 文档同步

**Files:**

- Modify: `test/README.md`
- Modify: `docs/test/05-corpus-and-blindspots.md`

**Interfaces:**

- Consumes: 前面全部任务的实际行为
- Produces: 文档描述与 CLI/工具行为一致

- [ ] **Step 1: 定位待改处**

```bash
grep -n "reference/ziwei-samples-toolkit\|5\.5\|1\.8\|符号链接\|jsonl" test/README.md docs/test/05-corpus-and-blindspots.md .gitignore
```

- [ ] **Step 2: 改 `test/README.md`**

**（a）第 3–4 行的数据集描述**（现状只提 toolkit）：

```markdown
本目录是本 skill 的回归测试，用 `reference/ziwei-samples-toolkit/` 的 518,400 条紫微斗数样本
作为 golden 基准，锁定 `scripts/ziwei/` 排盘内核的行为。
```

改为：

```markdown
本目录是本 skill 的回归测试，用 518,400 条紫微斗数样本作为 golden 基准，
锁定 `scripts/ziwei/` 排盘内核的行为。

语料有**两个等价载体，并存且互为验证**（不是备份关系，也不是孤本）：

| 载体                                           | 体积                                       | 谁用                             |
| ---------------------------------------------- | ------------------------------------------ | -------------------------------- |
| `reference/ziwei-samples-toolkit/samples-out/` | 5.5 GB / 720 个 `jsonl.gz` / 60 个年份目录 | 只用于 `verify-source.ts` 的互验 |
| `db/ziwei.duckdb`                              | 1.7 GB / `samples` + `palaces` 两张关系表  | `test/tools/` 下基准工具的数据源 |

两者都在 `.gitignore` 里。**核查它们请用 `find` / `stat` / `du`，不要用 `ls`** ——
本机 `ls` 是指向 `eza -al --git-ignore` 的别名，会把这两个目录显示成空的。
```

**（b）第 271 行的 fixtures 来源**：

```markdown
- **来源**：`reference/ziwei-samples-toolkit/samples-out/`（5.5GB，**不入版本控制**）
```

改为：

```markdown
- **来源**：`db/ziwei.duckdb`（1.7GB，**不入版本控制**；语料源自 `reference/ziwei-samples-toolkit`，
  两者等价并存，见文首）
```

**（c）第 289 行的重建前提**：

```markdown
只在**需要重建基准**时手动跑（`reference/` 不存在时跑不了，但**日常测试不需要它** —— fixtures 已入库）。
```

改为：

```markdown
只在**需要重建基准**时手动跑（`db/ziwei.duckdb` 不存在时跑不了 —— 它会打印指引并退出，
但**日常测试不需要它** —— fixtures 已入库）。
```

**（d）第 335–338 行的目录结构图**里 `tools/` 一节，改为四个条目：

```text
└── tools/
    ├── build-fixtures.ts     从 db/ziwei.duckdb 抽样重建 fixtures（手动执行）
    ├── full-corpus.ts        全量核验 518,400 条，1924–1983 有外部基准（手动执行）
    ├── verify-source.ts      jsonl ↔ DuckDB 逐条逐字节互验（手动执行，需要 reference/ 语料）
    └── year-scan.ts          1900–2100 恒等式扫描，约 87,000 条，数据集外年份段的自洽性（手动执行）
```

**（e）加一节讲清四层分工**，插在「## 四、fixtures 从哪来」之前：

```markdown
## 三·五、四层验证的分工

| 层           | 内容                                                         | 需要什么                                         | 何时跑                       |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------ | ---------------------------- |
| 日常回归     | `npm test`（300 条抽样基准 + 各层预言机）                    | **什么都不需要**（fixtures 已入库）              | 每次                         |
| 逐条互验     | `node test/tools/verify-source.ts --year 1960`               | `db/ziwei.duckdb` **与** `reference/` jsonl 语料 | 改过样本重建映射后           |
| 零 diff 验收 | `node test/tools/build-fixtures.ts` + `git diff --exit-code` | `db/ziwei.duckdb`                                | 重建基准时（数秒）           |
| 全量核验     | `npm run test:corpus`（518,400 条）                          | `db/ziwei.duckdb`                                | 升级 iztro 后（约 2.3 小时） |

⚠️ **只有第一层是回归测试，后三层都是手动执行的构建/验收步骤。** 这条边界是刻意的：
`npm test` 必须在「无 `db/ziwei.duckdb`、无 DuckDB 依赖、无 jsonl 语料」的环境下跑通，
所以它**不依赖任何数据文件**。`test/sample-source.test.ts` 是这个约束下唯一新增的用例 ——
它只用合成行与一个写死的、不存在的路径，不碰数据文件，故合规。
```

**（f）第 42 行**「`test/lib/` 是共享工具……`test/tools/` 是手动执行的脚本」这句不必改，仍然准确。

- [ ] **Step 3: 改 `docs/test/05-corpus-and-blindspots.md`**

**（a）第 4 行**：

```markdown
**被测对象：** `reference/ziwei-samples-toolkit` 全量语料 + `patterns.ts`（格局）+ `heming`（合盘）+ SKILL.md ↔ CLI 一致性
```

改为（只补载体，被测对象不变）：

```markdown
**被测对象：** 518,400 条全量语料（载体：`db/ziwei.duckdb`，等价于 `reference/ziwei-samples-toolkit`）+ `patterns.ts`（格局）+ `heming`（合盘）+ SKILL.md ↔ CLI 一致性
```

**（b）第 16 行的数据集一行**：

```markdown
| 数据集      | `reference/ziwei-samples-toolkit/samples-out`，5.5 GB / 720 分片     |
```

改为：

```markdown
| 数据集      | `db/ziwei.duckdb`，1.7 GB / 518,400 条（原始载体 `reference/…/samples-out`，5.5 GB / 720 分片） |
```

**（c）第 19 行的调用方式**（顺带修一处早已漂移的扩展名 —— 文件现在是 `.ts`，不是 `.mjs`）：

```markdown
| 全量核验    | `node test/tools/full-corpus.mjs`（单线程，实测约 21 ms/条）         |
```

改为：

```markdown
| 全量核验    | `node test/tools/full-corpus.ts`（单线程，实测约 21 ms/条）          |
```

**（d）第 147 行**提到「数据集经符号链接接入，见文末『后续修正（五）』」→ 删掉这个插入语
（该说法不实，见 (e)）。

**（e）第 531–533 行的「后续修正（五）」段落**：

```markdown
- 数据集本体位于上游项目 `~/Code/JSProjects/ziwei-samples-toolkit/samples-out`（5.5 GB，
  60 个年份分片），本仓 `reference/` 此前为空目录 —— 已以**符号链接**接入
  （`reference/` 整体在 `.gitignore`，链接不入库）；
```

改为：

```markdown
- 数据集本体位于上游项目 `~/Code/JSProjects/ziwei-samples-toolkit/samples-out`（5.5 GB，
  60 个年份目录 / 720 个 `jsonl.gz`），本仓 `reference/` 下的这份是**实体目录**，
  **不是符号链接**（实测 `[ -L ]` 逐层验过，`reference/`、`reference/ziwei-samples-toolkit`、
  `.../samples-out` 三层全为实体目录）；
- 2026-09-25 补：同一份语料已等价载入 `db/ziwei.duckdb`（1.7 GB，`samples` + `palaces` 两表），
  两个载体**并存、互为验证**。基准工具（`full-corpus.ts` / `build-fixtures.ts`）的数据源已改为
  DuckDB，jsonl 语料转为**验收期参照物**（`verify-source.ts` 逐条逐字节互验）；
- ⚠️ 核查这两个目录请用 `find` / `stat` / `du`，**不要用 `ls`**：本机 `ls` 是指向
  `eza -al --git-ignore` 的别名，会把 `.gitignore` 覆盖的 `reference/`、`db/` 显示成空目录。
  2026-09-25 曾据此误判「语料已丢失」，并把错误结论写进了设计文档与提交 `461cead`；
```

**（f）第 222–223 行**的宫名口径表**不用改**（「仆役」两侧都对，与数据源无关）。
若文中出现「跳过缺失分片」的说法，删除 —— 该逻辑已随数据源改造移除。

- [ ] **Step 4: 修订 `.gitignore` 注释里的体积数字**

`.gitignore` 第 18–32 行的注释在上一次改动里已经写好（语料仍在 `reference/`、DuckDB 是其等价载体、
不能用 `ls` 核查），**只差一个体积数字**：实测 `du -sh db/ziwei.duckdb` 是 **1.7G**，注释里写的是 `1.8G`。
把那一处 `1.8G` 改成 `1.7G` 即可，其余不动。

- [ ] **Step 5: 放行 `ts` / `typescript` 围栏与代码块内的制表符（本计划的增补，见文首）**

`.markdownlint.json` 的 `fenced-code-language.allowed_languages` 白名单里**没有 `ts`**，
且 MD010（`no-hard-tabs`）默认连代码块一起查。本计划的代码片段都是 TypeScript，
且**必须**保留仓库真实的制表符缩进（改成空格会让执行者把空格写进 `.ts` 源文件，
与仓库风格冲突）。所以按仓库既有做法（`.markdownlint.json` 已经为同样的理由放行过 `diff`）
补两处配置：

```json
"fenced-code-language": {
    "allowed_languages": [
        "c", "c++", "diff", "bash", "html", "plaintext", "js", "javascript",
        "json", "markdown", "text", "txt", "verilog", "shell",
        "ts", "typescript"
    ],
    "language_only": true
},
"no-hard-tabs": {
    "code_blocks": false
},
```

（两个新增项：白名单里加 `"ts"` 与 `"typescript"`；新增 `no-hard-tabs` 一节。
`.markdownlint.json` 允许注释以外的一切 JSON 语法，写进去就是普通 JSON。）

核对：

```bash
node -e 'const c=require("./.markdownlint.json");console.log(c["fenced-code-language"].allowed_languages.includes("ts"), c["no-hard-tabs"].code_blocks)'
# 期望：true false
```

> ⚠️ 这一步是**本计划相对 spec 的两处增补之一**（另一处是新增 `test/sample-source.test.ts` 层）。
> spec 没提文档 lint。若审阅时不认可，删掉这一步即可 —— 它不影响任何功能，
> 只是让文档不再有几十条编辑器的黄色波浪线。

- [ ] **Step 6: 核对 `SKILL.md` 只字未动**

```bash
git diff --stat SKILL.md
```

预期：**空**。`SKILL.md` 里提到的 `reference/ziwei-samples-toolkit/` 是 `db-analysis.ts` 的
**历史出处**，与 corpus 数据源无关，改造后该描述依然属实，故不在本次改动范围。
⚠️ 注意 `SKILL.md` 在本分支的工作区里**已经有未提交的改动**，且与本改造无关 ——
若 `git diff` 非空，确认那是不是别人（上一轮会话）留下的，**不要**把它一起提交。

- [ ] **Step 7: 全量核对文档里引用的数字**

```bash
find test/tools -maxdepth 1 -name '*.ts' | wc -l   # 应为 4（build-fixtures / full-corpus / verify-source / year-scan）
grep -c "label:" test/lib/run.ts                   # 应为 5
npm test 2>&1 | tail -20                           # 分层汇总的项数应与 README 记载一致
node test/tools/verify-source.ts --shard 1924-01 --limit 3   # 文档里的示例命令必须真的能跑
```

四处都要与文档记载相符。**文档里引用代码位置时优先写模块名而非行号** ——
`cli/` 与 `test/lib/` 都拆过一次，行号是漂移最快的东西。

- [ ] **Step 8: 提交**

```bash
git add test/README.md docs/test/05-corpus-and-blindspots.md .gitignore .markdownlint.json
git commit -m "docs: 补记 DuckDB 数据源，更正语料「符号链接」的说法

数据集从「一份 jsonl 语料」变成「jsonl 与 DuckDB 两个载体并存、互为验证」，
test/tools/ 下的工具从三个变四个（新增 verify-source），npm test 的测试层
从四层变五层（新增数据源纯函数层）。并补一节写清四层验证各自需要什么 ——
只有日常回归不需要任何数据文件，这是刻意的边界。

并更正两处旧说法：reference/ 下的语料实测是实体目录，不是符号链接
（reference/、reference/ziwei-samples-toolkit、samples-out 三层逐层验过）；
db/ziwei.duckdb 实测是 1.7G，不是 1.8G。同时写明核查这两个目录要用
find/stat/du 而非 ls —— 本机 ls 是带 --git-ignore 的 eza 别名，会把它们
显示成空目录。顺带修一处早已漂移的工具扩展名（full-corpus.mjs → .ts）。

markdownlint 放行 ts/typescript 围栏，并让 MD010 不再检查代码块 ——
本仓库是 TypeScript 项目，文档里的代码片段必须保留源码真实的制表符缩进，
改成空格会让执行者把空格写进 .ts 源文件。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 交付前的整体验收

全部任务完成后，按 spec 第五节的两层验收跑一遍，两层都要过：

```bash
# 第一层：jsonl ↔ DuckDB 逐条互验（主要手段，抽样即可；全量约 2.3 小时）
node test/tools/verify-source.ts --year 1962
node test/tools/verify-source.ts --year 1924
node test/tools/verify-source.ts --year 1983

# 第二层：fixtures 零 diff
node test/tools/build-fixtures.ts && git diff --exit-code test/fixtures/charts.jsonl

# 日常回归：必须仍然在「无 db、无 DuckDB 依赖、无 jsonl」的环境下跑通
npm test
npm run typecheck
```

再来两件收尾事：

1. **确认这次改造没有往 `npm test` 引入任何依赖数据文件的用例** —— `test/sample-source.test.ts`
   应当只引用 `SAMPLE_DB` 这个字符串常量与一个写死的、不存在的路径，不出现任何文件读取。
   核对方式：把 `db/` 临时改名，再跑一次 `npm test`，必须照样全绿。

   ```bash
   mv db /tmp/db-parked && npm test; rc=$?; mv /tmp/db-parked db; echo "退出码：$rc"
   ```

2. **确认文档 lint 干净**（若采纳了 Task 8 Step 5 的配置增补）：

   ```bash
   npx markdownlint-cli2 'docs/superpowers/**/*.md' 2>/dev/null || \
     npx markdownlint 'docs/superpowers/**/*.md'
   ```

   预期：无输出。若只报 MD013（行长）之类与本次无关的既有问题，忽略即可；
   若报 MD040/MD010，说明 Step 5 的配置没生效。
