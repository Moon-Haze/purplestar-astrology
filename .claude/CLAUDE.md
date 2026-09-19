# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

一个 **Claude Code skill 项目**：紫微斗数排盘与解读。仓库根就是 skill 根（`SKILL.md` 所在目录），自包含 `scripts/`（CLI + 排盘内核）与 `package.json` 依赖。

关键含义：**`SKILL.md` 不是文档，是可执行的行为规范**——Claude 读它来决定如何排盘与解读。改 `SKILL.md` 等于改这个 skill 的行为。

## 命令

没有构建、没有 lint，排盘与解读全部经由 CLI 入口（`npm test` 只跑测试，不参与运行）：

```bash
npm install        # 装依赖（iztro / lunar-javascript）

# 主力命令：命盘 + 十二宫 + 格局 + 四化 + 大限，解读所需数据一次给全
node scripts/purple-star.mjs analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male

node scripts/purple-star.mjs heming --a-date <...> --b-date <...>   # 合盘
node scripts/purple-star.mjs classics --search 机月同梁              # 古籍原文检索
node scripts/purple-star.mjs nihai --category tianji                # 倪海夏三纪
node scripts/purple-star.mjs help                                   # 全部命令与参数

# 第一层：CLI 自带自检，37 项断言，整体执行，不支持筛选单项
node scripts/purple-star.mjs selftest

# 第二层：基准回归，用 toolkit 的 518,400 条样本对标排盘结果（默认跑 300 条抽样，约 8 秒）
npm test
npm run test:corpus -- --year 1960    # 全量核验（需 reference/ 存在，不入日常回归）
```

**改过内核或升级 `iztro` 之后，两层都要跑。** `selftest` 测「代码逻辑自洽」，覆盖农历换算、真太阳时校正、晚子时等价性、城市名容错、性别护栏、排盘不变量、三合派体系约束、知识源可用性；`npm test` 是**外部基准比对**，用 300 条真实盘逐字段对标，能抓住 `selftest` 那几条固定样例漏掉的行为漂移。测试的性质与效力边界见 [test/README.md](../test/README.md)。

## 架构

### 数据流

```text
<skill 根>/
└── scripts/                       ← 内核根：CLI 与内核同处一层
    ├── purple-star.mjs            参数解析 → 调内核 → 渲染成给模型读的结构化文本
    ├── ziwei/algorithm.ts         iztro 排盘主流程
    ├── ziwei/patterns.ts          40+ 格局识别（1190 行，含古籍出处与破格条件）
    ├── ziwei/sihua.ts             四化（生年 / 流年 / 流月）
    ├── ziwei/heming-knowledge.ts  合盘方法论 + 夫妻宫断语
    ├── classics/                  三部古籍原文检索
    └── nihai/                     倪海夏天纪 / 地纪 / 人纪
```

### 为什么能直接跑 TypeScript（没有构建步骤）

`scripts/purple-star.mjs` 用 Node ≥ 22.15 的 `module.registerHooks` 注册了解析钩子（见文件开头的 `registerHooks({...})`）：

- `@/xxx` → 解析到 `<内核根>/xxx`，自动补 `.ts` 或 `/index.ts`。**内核根是 `scripts/` 而非 skill 根**，所以 `@/ziwei/algorithm` = `scripts/ziwei/algorithm.ts`
- **裸包名**（`iztro`、`lunar-javascript`）→ 自内核根向上查找 `node_modules` 解析，而非 cwd 或文件所在位置

因此脚本可从**任意 cwd** 运行，也不需要 `tsconfig.json`。内核 `*.ts` 内部一律用相对路径 import，不使用 `@/` 别名（该别名只有 CLI 自己用）。

### ROOT 如何确定

`pickRoot()` 两级优先级：`ZIWEI_ROOT` 环境变量 → 脚本自身所在目录（即 `scripts/`）。

刻意**没有**「宿主项目」候选——仓库内只有一份内核（就在 `scripts/` 下），不存在「实时内核 vs 分发副本」的双模式。

### 三处启动期防御

1. **`REQUIRED_EXPORTS` 自检**：模块加载后立刻校验 14 个关键导出，缺任何一个直接退出。设计意图是**宁可启动失败，也不静默产出错盘**——所以在内核里重命名或删除导出会让 CLI 立刻报错，这是有意的，不是脆弱。
2. **`selftest`**：CLI 自带的 37 项断言，整体执行。
3. **`npm test`**：`test/` 下的基准回归，用 toolkit 样本对标排盘结果（默认 300 条抽样，约 8 秒）。失效的基准是负债而非保障 —— 见 [test/README.md](../test/README.md) 的「升级 iztro 的流程」。

## 体系硬约束：三合派，不是飞星派

本项目严格遵循倪海夏《天纪》三合派。以下飞星派工具被**主动下线**，不得使用：

- ❌ **宫干自化** —— `algorithm.ts` 已停止填充 `Palace.selfSihua`
- ❌ **大限四化取宫干** —— 已停止生成 `daXians[].siHua` / `stemIndex`
- ❌ **来因宫**

⚠️ **最容易踩的坑**：`scripts/ziwei/sihua.ts` 里**仍然导出** `detectSelfSihua` / `findIncomingPalaces` / `getDaXianSiHua`。它们是历史遗留与前端展示兼容代码——**存在不等于该用**，用它们解读就是背离本项目的体系立场。`selftest` 里有断言专门盯着这些字段不被重新填回。

## 内核的来源

内核提取自上游开源项目 `ziwei-master`（未发布到 npm），**在本项目内独立演化**——改内核直接改 `scripts/` 下的对应文件，不存在需要同步的副本。线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）与 `lib/seo/` 不在其中。

## 依赖变更的后果

`iztro` 是排盘引擎，**升级它会改变排盘结果**。`package-lock.json` 已提交以锁定精确版本（iztro 2.6.1 / lunar-javascript 1.7.7）。动过依赖后先跑 `selftest` **与 `npm test`** 再交付解读。

基准样本是 iztro **2.5.8** 拍的快照，与本项目的 2.6.1 有且仅有两处已知差异（太阳/太阴在酉宫的亮度，见 `test/lib/compare.mjs` 的白名单）。升级 iztro 后若出现白名单之外的差异，`npm test` 会变红——**这是要你显式审阅行为变化的信号，不是测试该修的 bug**。流程见 [test/README.md](../test/README.md)。

## SKILL.md 与 CLI 的耦合

`SKILL.md` 描述的命令、参数、输出结构必须与 `scripts/purple-star.mjs` 的实际行为一致，否则 Claude 会照着过时的说明调用。改 CLI 的参数名或输出格式时，同步改 `SKILL.md`。

容易漂移的几处：命令路径（文档统一写 `node scripts/purple-star.mjs`，相对 skill 根）、`selftest` 声称的断言数、`scripts/` 下内核的文件数与体积。

CLI 里有几个**刻意的非常规设计**，改动时别当成 bug：

- **晚子时**：23:00–23:59 出生，两种口径排出的是两张不同的盘（不是微调）。`--late-zi` 切换口径，`analyze` 会自动输出两盘差异对照
- **`--liunian` 不是 `--year`** —— 后者是出生年的回退参数，同时使用会撞车
- **`chart.palaces` 按地支数组序排**——`branch` 序列实测为 `2,3,…,11,0,1`（寅起），既不是 0-11（子起）也不是宫位顺序。比对或展示时请按 `branch` 建索引，不要依赖数组下标

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
