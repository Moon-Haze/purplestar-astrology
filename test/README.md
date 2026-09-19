# 排盘基准测试

本目录是本 skill 的回归测试，用 `reference/ziwei-samples-toolkit/` 的 518,400 条紫微斗数样本
作为 golden 基准，锁定 `scripts/ziwei/` 排盘内核的行为。

```bash
npm test                                  # 日常回归：300 条抽样基准，约 5 秒
npm run test:corpus -- --year 1960        # 全量核验：只跑 1960 年（8,640 条，约 2 分钟）
npm run test:corpus                       # 全量核验：518,400 条，约 2.3 小时

node scripts/purple-star.mjs selftest     # CLI 自带的 37 项自检（与本套测试分工不同，见下）
```

与 CLI 自带 `selftest` 的关系：`selftest` 固定在 CLI 里，测的是**代码逻辑自洽**（农历换算、
真太阳时、晚子时等价性、三合派字段不被回填），用几条固定样例。本套测试是**外部基准比对**，
用 300 条真实盘逐字段对标，覆盖面大得多。**两者都要跑**，没有替代关系。

---

## 一、测试分四层

| 文件 | 层 | 依赖基准样本 | 测什么 |
| --- | --- | --- | --- |
| [chart.test.mjs](chart.test.mjs) | 1（主力） | ✅ | 300 条样本逐字段全等比对 |
| [cli.test.mjs](cli.test.mjs) | 2 | ❌ | CLI 端到端：真太阳时、农历入参、晚子时、性别护栏、城市容错 |
| [invariants.test.mjs](invariants.test.mjs) | 3 | ❌ | 排盘结构不变量：12 宫必齐、十四主星各一、大限区间连续…… |
| [school.test.mjs](school.test.mjs) | 4 | ✅ | 三合派体系约束：飞星派字段不得被回填 |

层 2、3 刻意**不依赖基准样本**，因此不受 iztro 升级影响 —— 层 1 变红时，它们能帮你区分
「是 iztro 行为变了」还是「内核真的排出了坏盘」。

`test/lib/` 是共享工具（内核加载器 + 比对器），`test/tools/` 是手动执行的脚本，两者都不是测试文件。

---

## 二、测试的真实效力边界

这一节比上面那张表重要。**请勿高估这套测试。**

### 1. 它是回归锁定，不是正确性证明

基准样本由 toolkit 的 `lib/ziwei/algorithm.ts` 生成，与本项目 `scripts/ziwei/algorithm.ts`
**同源**（都调 iztro 的 `bySolar`）。所以这套测试能回答的是「行为有没有变」，
**不能**回答「盘排得对不对」—— 两边一起错的地方（比如 iztro 自身某个安星算法有误）测不出来。

真正的正确性验证需要独立的第三方案源（古籍安星诀手工推演、其他排盘软件对照），本目录没有做。

### 2. 唯一的独立交叉验证点，是那两处 iztro 版本差异

基准是 **iztro 2.5.8** 的产物，本项目用 **2.6.1**。两版之间 iztro 改了星曜亮度表，
实测差异**有且仅有两处**：

| 星位 | 本项目（2.6.1） | 样本（2.5.8） |
| --- | --- | --- |
| 太阳 @ 酉 | `normal`（平） | `dim`（陷） |
| 太阴 @ 酉 | `bright`（旺） | `dim`（陷） |

两边的 `mapBrightness()` 代码完全相同，差异源自 iztro 自身的亮度表变更，**不是任何一方的 bug**。
新版取值（酉宫日平、月旺）更合传统口径，故本项目是对的，样本是旧版的陈旧值。

这两条登记在 [lib/compare.mjs](lib/compare.mjs) 的 `KNOWN_DIVERGENCES` 白名单里。
它的价值在于：**证明这套比对机制确实能发现行为变化** —— 如果 300 条盘全都"恰好一致"，
你无从判断是排盘真的没变，还是比对器根本没在工作。

### 3. 不采用「跳过 brightness 字段」的做法

跳过字段能立刻让测试全绿，但会永久丧失对亮度表的保护力。本套测试用
**全等比对 + 显式白名单**：白名单只放行 `brightness` **单个字段**在**特定宫位**上的差异
（不是整颗星 —— 星名、type、siHua 仍严格比对），且每条必须写明 `cause` 根因。
白名单之外的任何新差异都会让测试失败。

### 4. fixtures 锁死 iztro 2.5.8 的行为，这是设计意图

将来升级 iztro 时若差异超出白名单，测试会变红。**这是要你显式审阅行为变化**，
而不是默默接受 —— 见下方「升级 iztro 的流程」。

### 5. 随运行年份漂移的字段，测试自己重算

`scripts/ziwei/algorithm.ts` 里 `currentAge = new Date().getFullYear() - year`（**无 +1**），
影响 `chart.currentAge`、`chart.currentDaXianIndex`、`palace.isCurrentDaXian` 三处。

样本生成于 2026 年，直接比对会在 **2027 年全线失败**。故比对器**按当前年份重算期望值**
（公式极简，且 `daXians` 本身不漂移，可精确重算），而非抄样本的陈旧快照。

---

## 三、样本覆盖不到的盲区

以下六处**没有基准可依**，只能靠层 2 的手工基准与 CLI 的 `selftest` 兜底：

| 盲区 | 为什么样本覆盖不到 |
| --- | --- |
| **真太阳时校正** | 样本 `longitude` 恒为 `120`，校正量恒为 0 |
| **晚子时口径** | 样本 `hour` 只有 0–11，没有 `12`（晚子时是 CLI 层概念，由 `--branch 12` / `--late-zi` 表达） |
| **23:00–23:59 分支** | 同上 |
| **农历入参路径** | 样本 `birthInfo` 恒为公历 |
| **格局识别** | 样本无 `patterns` 字段，`scripts/ziwei/patterns.ts`（1190 行、40+ 格局）**无任何基准** |
| **合盘** | 样本是单人盘 |

层 2 已为前四项手工构造了断言（含用 `lunar-javascript` 独立换算互证），但**格局与合盘仍是空白**。

---

## 四、fixtures 从哪来

- **来源**：`reference/ziwei-samples-toolkit/samples-out/`（5.5GB，**不入版本控制**）
- **抽样**：60 年（1924–1983）每年 5 条 = 300 条，实测覆盖
  **12/12 月 · 12/12 时辰 · 2/2 性别 · 5/5 五行局 · 22 个闰月年**
- **只存 `birthInfo` + `chart`**：样本的 `topics`（13 主题解读文本）占单条体积 90%，
  由 toolkit 私有的 `db-analysis.ts`（2254 行 `STAR_DB`）生成 —— 本项目刻意不含该文件，
  无法复现，故一律剔除。单条 62.5KB → 5.4KB，300 条共 1.6MB
- **抽样是确定性的**（不用随机数），同样的输入必然产出同样的 fixtures，基准可复现、diff 可审阅

> ⚠️ **数据来源的合规性**：toolkit 的 `package.json` 标记为 `private` 且无 LICENSE 文件。
> 入库的 fixtures 只含**排盘算法的确定性输出**（星曜位置、宫位、大限等事实性数据），
> 已剔除全部 LLM 生成的解读文本。若对外分发本仓库，请自行确认这一用法无碍。

### 重建 fixtures

```bash
node test/tools/build-fixtures.mjs
```

只在**需要重建基准**时手动跑（`reference/` 不存在时跑不了，但**日常测试不需要它** —— fixtures 已入库）。

脚本会在写盘前做**分歧自检**：拿当前内核重排这 300 条，若与基准有白名单之外的差异，
**拒绝写盘**并列出差异。理由是重建 fixtures 等于「把当前行为固化成新基准」，
若此刻已有分歧，直接固化等于把分歧悄悄转正 —— 下次跑测试就是绿的，谁也不知道行为变过。

---

## 五、升级 iztro 的流程

```bash
npm install iztro@<新版本>
node scripts/purple-star.mjs selftest       # 1. 先过 CLI 自检
npm test                                   # 2. 跑基准回归
```

- **全绿** → 行为未变，直接提交 `package.json` + `package-lock.json`
- **变红** → 逐个看失败信息（带宫位、星名、基准值、实际值）。确认是预期的版本行为变化后：
  1. 在 [lib/compare.mjs](lib/compare.mjs) 的 `KNOWN_DIVERGENCES` **登记新条目并写明 `cause`**
     （哪一版、改了什么、为什么新值是对的）
  2. 跑 `npm run test:corpus -- --year <受影响年份>` 确认差异范围没有超出预期
  3. 必要时 `node test/tools/build-fixtures.mjs` 重建基准
  4. 重跑 `npm test` 确认全绿

**不要**为了让测试变绿而直接删白名单条目或放宽比对字段 —— 那等于关掉报警器。

---

## 六、文件清单

```text
test/
├── README.md                  本文件
├── chart.test.mjs             层 1：排盘对标（主力）
├── cli.test.mjs               层 2：CLI 端到端
├── invariants.test.mjs        层 3：排盘结构不变量
├── school.test.mjs            层 4：三合派体系约束
├── lib/
│   ├── loader.mjs             加载 TS 内核（scripts/purple-star.mjs 加载机制的副本）
│   └── compare.mjs            比对器 + 归一化 + 已知差异白名单
├── fixtures/
│   ├── charts.jsonl           300 条基准（每行 {"birthInfo":…,"chart":…}）
│   └── manifest.json          来源、基准引擎版本、抽样算法、覆盖度
└── tools/
    ├── build-fixtures.mjs     从 reference/ 抽样重建 fixtures（手动执行）
    └── full-corpus.mjs        全量核验 518,400 条（手动执行）
```

### 两处需要留意的维护点

1. **`lib/loader.mjs` 是 `scripts/purple-star.mjs` 加载机制的副本**，两者必须行为一致。
   刻意不抽成共享模块：CLI 的加载器带 CLI 特有的错误处理（`console.error` + `process.exit(1)`），
   测试需要**抛错**而非退进程。改任意一侧的 `registerHooks` 或 `pickRoot` 时请同步另一侧 ——
   `cli.test.mjs` 里有一条断言（内核直调结果 ≡ CLI `--json` 子进程输出）专门盯着两侧不漂移。

2. **`tools/` 下的脚本都带「仅直接执行才跑 `main()`」的守卫**。Node 的默认测试文件识别模式
   含 `test/**/*`，没有这道守卫时 `node --test test/` 可能把会写盘的 `build-fixtures.mjs`
   当成测试文件执行。`npm test` 用的是显式 glob `test/**/*.test.mjs`，双重保险。
