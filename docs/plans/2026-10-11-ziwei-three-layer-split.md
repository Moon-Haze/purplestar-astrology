# scripts/ziwei 三层拆分 · 设计规格

> 状态：**待用户确认**。确认后按 `superpowers` 流程开隔离 worktree、写实施计划、TDD 执行。
> 基线（2026-10-11）：`npm run typecheck` exit 0 · `selftest` 全通过 · `npm test` 549/549 通过。

## 1. 目标与非目标

**目标**：把 `scripts/` 的顶层 8 个文件按「契约 / 数据 / 计算」三层归位，消除三处已确认的结构缺陷，同时**保持全部对外行为逐字节不变**。

**非目标**：
- 不改任何命理口径、算法、输出文案。
- 不动 `analysis/`（5004 行，已有清晰模块化）与 `patterns/`。
- 不碰 `types.ts` 的绊线字段（`Palace.selfMutagen` 等）。
- 不做 `cities` 命令复活，不动 `scripts/corpus/`、`scripts/synastry/`。

## 2. 现状事实（勘察结论）

顶层 8 文件共 2715 行，按性质分三类：

| 文件 | 行数 | 性质 | 处置 |
|---|---|---|---|
| `types.ts` | 324 | 纯类型契约 | 保持扁平 |
| `palace-relations.ts` | 76 | 零依赖纯函数，已单点化 | 保持扁平 |
| `constants.ts` | 410 | 14 张互不相关的查表 | 拆入 `data/` |
| `cities.ts` | 569 | 纯数据，与排盘内核零耦合 | 迁往 `cli/data/` |
| `wenmo-brightness.ts` | 556 | 420 行生成数据 + 100 行查询逻辑 | 数据下沉，逻辑留计算层 |
| `algorithm.ts` | 413 | 排盘主流程 | 保持扁平 |
| `mutagen.ts` | 367 | 六层四化 | 保持扁平 |

**新发现（此前未记录）**：`constants.ts` 中 **5 张表零外部消费者**，合计约 100 行纯留存数据——
`NAYIN_ELEMENTS`、`JU_NAMES`、`TIANKUI_TABLE`、`LUCUN_TABLE`、`TIANMA_TABLE`。

有消费者的 9 张：`SI_HUA_TABLE`(13 处)、`PALACE_NAMES_ORDER`(22)、`IZTRO_TO_PROJECT_PALACE`(21)、`STAR_DESCRIPTIONS`(8)、`ELEMENT_TO_JU`(4)、`SHICHEN`(3)、`STAR_BRIGHTNESS`(1)。

## 3. 目标结构

```
scripts/
├── types.ts                    契约层（不动）
├── palace-relations.ts         契约层（不动）
├── constants.ts                兼容门面 → re-export ./data
├── wenmo-brightness.ts         兼容门面 → re-export 逻辑，数据来自 ./data
├── algorithm.ts                计算层（不动）
├── mutagen.ts                  计算层（不动）
├── data/                       数据层（新增）
│   ├── ganzhi.ts               STEMS/BRANCHES/SHICHEN/PALACE_NAMES_ORDER/IZTRO_TO_PROJECT_PALACE
│   ├── wuxing.ts               NAYIN_ELEMENTS/ELEMENT_TO_JU/JU_NAMES
│   ├── sihua.ts                SI_HUA_TABLE/TIANKUI_TABLE/LUCUN_TABLE/TIANMA_TABLE
│   ├── stars.ts                STAR_DESCRIPTIONS/STAR_BRIGHTNESS
│   ├── wenmo-tables.ts         WENMO_STAR_ID_TO_NAME + 四张 SB 表 + 档位映射
│   └── index.ts                数据层门面
├── analysis/                   不动
└── patterns/                   不动

scripts/cli/data/
└── cities.ts                   从 ziwei/cities.ts 迁入
```

依赖方向单向向下：`计算层 → 契约层`、`计算层 → 数据层 → 契约层`。数据层**不得**反向依赖计算层。

## 4. 关键决策与理由

### D1 · 数据目录命名 `data/`，绝不叫 `constants/`

`test/repo.test.ts:308` 钉死了解析候选序：同名 `.ts` 文件优先于同名目录。拆分当口若 `constants.ts`（门面）与 `constants/`（目录）并存，`./constants` 会静默解析到门面而非目录——**typecheck 全绿、真跑解析错目标**，且这种分叉只在运行时炸。

命名 `data/` 与门面 `constants.ts` 无冲突，从根上规避该类问题。

### D2 · 门面保留 re-export，外部 20 处导入零改动

`cli/` 与 `test/` 共约 20 处 `@/ziwei/xxx` 导入。门面承接后本次拆分**不改任何外部导入路径**，回归风险集中在「文件内容是否等价」而非「路径是否解析」。

门面文件须写明：过渡期性质、清理条件（待 `@/ziwei/constants` 引用归零后删除）。

### D3 · wenmo 拆分时，流派单例留在计算层

`currentSchool` 是模块级可变状态，`setBrightnessSchool` / `getBrightnessSchool` 是其唯一出入口。四张 SB 表与档位映射是纯数据，下沉 `data/wenmo-tables.ts`；单例与查询函数留在 `wenmo-brightness.ts`（转门面 + 逻辑）。

⚠️ 陷阱：数据下沉后 `validateWenmoBrightness()` 的**模块加载即跑**语义必须保留——它是排盘启动期的数据完整性防线（坏了当场炸，而非静默错亮度）。拆分后仍须在门面加载链路上被触发，不得因 re-export 变成惰性求值而失效。

### D4 · 5 张零消费者表原样保留，不删

它们是刻意留存的命理数据（文件内注释已说明"仅为数据留存"）。本轮是结构拆分，不做数据清理——删表属另一个决策，需单独确认。

### D5 · cities 迁移须同步改 selftest 硬编码断言

`selftest/commands.ts:322` 直接读文件做正则：

```js
const cities = readFileSync(resolve(ctx.root, "ziwei", "cities.ts"), "utf8");
if (!/export const PROVINCES/.test(cities)) throw new Error("ziwei/cities.ts 的 PROVINCES 不在了");
```

cities 迁走后门面只有 `export { PROVINCES } from ...`，**该正则不匹配、断言会红**。这是断言写死实现细节的固有缺陷，处置：断言改为读 `cli/data/cities.ts` 的真实定义处，并把注释里 `ziwei/cities.ts` 的旧口径一并更正。

## 5. 已识别的破防点（Review Focus）

1. **同名文件/目录并存解析** → D1 命名规避；验收须实跑而非只看 typecheck。
2. **selftest 路径硬编码断言** → D5 显式处置；`selftest/commands.ts:298` 注释里的旧口径同步改。
3. **`validateWenmoBrightness` 加载即跑语义丢失** → D3；验收须验证「故意破坏表 → 启动即炸」。
4. **`guard.ts:126` 动态 import** `@/ziwei/analysis/grades` → analysis/ 不动，天然免疫，但需确认。
5. **`citations.test.ts` 扫 `scripts/` 全树** → 文件移动后仍在树内，但**引文标注位置随之移动**，须复跑 9 项引文守卫确认零违例。
6. **`guard.ts` 的 `runDocConsistency`** 扫 `references/` 若干文件 → 本次不改文案，预期无变化，若变红即说明拆分意外触及了输出。
7. **5 张零消费者表** → D4 保留；验收须确认它们仍可从门面 import 到（防 re-export 漏项）。

## 6. 验收标准（三件套，退出码直取，不得接管道）

每任务完成后：

```bash
npm run typecheck        # exit 0，禁用 any / @ts-ignore 绕过
node scripts/purple-star.ts selftest   # 全通过
npm test                 # 549/549，计数以实跑为准不写死
```

**附加验收**：
- `node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --json > /tmp/before.json`，拆分前后逐字节 diff = 0。
- 故意破坏一张 SB 表，确认 CLI 启动即抛错（D3 生效证据）。
- 5 张零消费者表逐一从门面 import 并断言非 undefined（D4 防漏项）。

## 7. 待确认事项

1. 目标结构（第 3 节）与四项关键决策（D1–D5）是否认可？
2. 5 张零消费者表确认为保留——是否有你希望顺带清理的？
3. 是否需要同步更新 `CLAUDE.md` 中提及 `ziwei/cities.ts`、`ziwei/mutagen.ts` 的路径口径（迁移后这些表述会过期）？