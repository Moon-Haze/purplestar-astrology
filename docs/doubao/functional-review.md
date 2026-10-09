# 功能实现层面的可优化点分析

> 日期：2026-10-09
> 范围：合并后单 skill 全部实现（`scripts/` 内核 + CLI 层 + 合盘消费方）
> 方法：通读核心文件（algorithm / birth-info / chart-view / astrology / fortune / render / patterns / analysis），对照热点实测
> 总评：**实现质量很高，未发现功能性缺陷或逻辑错误**。可优化点集中在「重复计算与重复遍历」的**代码结构**层面，不是性能瓶颈；另有少量可读性建议。

---

## 一、总体评价

代码在三个维度做得很好，先肯定（这些不是优化对象）：

1. **宁可报错不静默**纪律贯彻到底：宫名/干支/紫微定位查不到即抛错，不带兜底 0——杜绝"错盘静默产出"。
2. **单一来源设计**：对宫偏移、宫名映射、声明表、知识源都收敛到单点，注释解释"为什么这里自有一份"。
3. **契约明确**：`--json` 契约一处生产（`buildAnalyzeJson`）一处消费（`readAnalyzeJson`）一处对拍（selftest 进程内直调）。
4. **无第三方重复**：合盘消费方不拖排盘内核，类型契约是消费方声明（窄而明确）。

---

## 二、可优化点（按收益排序）

### P1：同一函数内重复计算 —— 顺手可改，零风险

**证据**：`buildAnalyzeJson`（astrology.ts:148-151）里 `yearlyBranchOf(liuNianYear)` 连续调了 **3 次**：

```ts
liuNianPalace: {
  year: liuNianYear,
  branchIndex: yearlyBranchOf(liuNianYear),
  branch: BRANCHES[yearlyBranchOf(liuNianYear)],
  palaceName: chart.palaces.find(p => p.branch === yearlyBranchOf(liuNianYear))?.name ?? null,
},
```

**建议**：提一个局部变量 `const lnBranch = yearlyBranchOf(liuNianYear)`，三处引用一次计算。纯函数零成本，但消除重复与读代码时的"这三处一定是同一个值吗"疑虑。

**同样模式**：`fortune.ts` 内 `yearlySection` / `decadalSection` 多次调 `surroundNames(chart, 同 branch)`，可先取 `const names = surroundNames(...)` 复用。

### P2：palace 查找用 Map 索引统一 —— 结构性优化，收益在可维护性

**证据**：全仓 `chart.palaces.find(p => p.branch === X)` 出现 **10+ 处**，散落在 6 个文件：

| 文件 | 处数 |
|---|---|
| `cli/fortune.ts` | 5 |
| `cli/render.ts` | 2 |
| `cli/astrology.ts` | 1 |
| `ziwei/analysis/palace-query.ts` | 2 |
| `ziwei/patterns/basic.ts` + `helpers.ts` | 2 |

**分析**：十二宫只有 12 个，线性 find 是 O(12)，**性能上完全不是问题**（实测排盘 + 全专题 1.6s 中此占比可忽略）。真正的价值是：
- 消除散落的 `?.name ?? "?"` 与 `find(...)?.name ?? null` 这类**口径不一的兜底**（有的退化 `"?"`、有的 `null`、有的抛错）；
- 建一个 `palaceByBranch(chart): Map<number, Palace>`（或在 `render.ts` 加 `palaceIndex(chart)`），各文件共用。

**收益**：统一"取不到怎么办"的语义（项目纪律是抛错），消灭重复遍历模式。**注意**：这不改变行为，只是把既有纪律收拢成工具函数——改动面大、收益在可维护性，可作为重构任务而非 bug 修复。

### P3：合盘/消费方每次读盘全量校验 —— 合理，仅记录

**证据**：`readAnalyzeJson` 每次同步读 2 个 JSON 文件并逐项校验 4 个关键字段（chart / nativeSiHua.located / lateZi / basis）。

**分析**：CLI 一次性进程，每次读 2 个小文件（几十 KB）+ 校验，毫秒级，**不值得缓存或异步化**。校验"宁可失败不渲染缺节"正是纪律所在，保留。

### P4：巨型数据文件 —— 可拆分，收益看团队偏好

**证据**：`ziwei/analysis/data.ts` 1747 行，含 10+ 个 `Record` 常量表（STAR_CONTENT_MAP 819 行、TOPIC_KEY_PALACES 196 行…）。

**分析**：全是**声明式字典**（非逻辑），单文件便于"改内容只动一处"。拆分会增加模块间 import 噪音，收益有限。**建议保持**；仅当未来单表超过千行时再按主题拆。

### P5：进程内直调场景（selftest / 会话多次排盘）无缓存 —— 实测无需

**证据**：`detectPatterns` / `getTopicAnalysis` 每次全量推算，无 memo；`generateChart` 每次调 2 次 `getLunarInfo`（出生日 + 今日）。

**分析**：CLI 单次运行 1.6s 主成本在 iztro 冷启动（见 selftest 性能文档），推算本身 25ms/次。进程内直调 15 次 = 377ms，**缓存收益可忽略且引入状态风险**（命盘应每次重排保证时效）。不优化。

---

## 三、明确"不优化"项（及理由）

| 项 | 理由 |
|---|---|
| 合盘 `chart-view.ts` 自写 `BRANCHES` 12 字 | 有意为之（注释声明）：消费方自带宇宙常量，避免拖进 500 行常量表；且两个 `BRANCHES` 不会同时被读到 |
| 每次 CLI 同步读盘 | 一次性进程 + 小文件，异步化无收益 |
| `--json` 全量算 patterns/四化 | 是 JSON 输出契约的一部分（消费方依赖），不能懒 |
| 虚岁用 `new Date()` 每次实时算 | 语义如此（虚岁随当前日期走），跨年自动正确 |

---

## 四、推荐路线

1. **P1（顺手改）**：`buildAnalyzeJson` 提 `lnBranch` 局部变量；`fortune.ts` 各 Section 复用 `surroundNames` 结果。改完跑 selftest 全绿即可。
2. **P2（重构任务，可选）**：新增 `palaceByBranch(chart)` 索引工具，替换 10+ 处散落 find——统一兜底语义（一律抛错），行为不变，selftest + npm test 兜底。
3. P3/P4/P5 维持现状，不投入。

## 五、验证方式
- P1：改后 `selftest` 128/128 全绿 + `--json` 输出与改前逐字节一致（golden snapshot 思维）。
- P2：改后 `npm test` 全绿（语料回归盯着格局/论断链路）+ selftest 全绿。
