# 批次 B：CLI 输出体验（O3/O6/P3）实施计划

> **For agentic workers:** 本计划按任务逐步执行，步骤用 checkbox 跟踪。实现 spec：`docs/specs/2026-10-09-review-fixes.md` 批次 B。

**Goal:** 四柱两口径相同时合并为一行、基本信息面板与运限速览之间补空行、缺项报错顺序改为 日期→时辰→性别。

**Architecture:** 三处独立小改：`fortune.ts` 的 `infoSection`（O3）、`astrology.ts` 默认输出拼接（O6）、`birth-info.ts` 校验块顺序（P3）。O3 改变输出契约，须同步 selftest:1191 断言组并补「两口径不同」样例断言。

**Tech Stack:** TypeScript（Node ≥ 22.18 原生 TS 加载）。

**Spec:** `docs/specs/2026-10-09-review-fixes.md`

## Global Constraints

- 「宁可报错不静默」纪律：所有改动不得引入兜底默认值。
- 输出形态是用户可见契约：改动后 selftest 全绿（含同步校准的断言）。
- 改 `scripts/` 源码用 Edit/Write 工具提交（Mimosa 钩子拦截 Bash 直写）。

## Review Focus

- O3 合并行的措辞要让「这是同一值不是缺数据」一目了然。
- P3 只调顺序不改文案；`test/` 与 selftest 若有「缺少性别」先于「缺少出生时辰」出现的断言须同步。
- 两口径不同的样例必须真实存在（立春后、正月初一前 → 年柱分叉），断言值以实跑校准。

---

### Task 1：O3——四柱去重

**Files:**
- Modify: `scripts/cli/fortune.ts:177-199`（infoSection）
- Test: `scripts/cli/selftest.ts:1191-1215`（专题渲染断言组）

**Steps:**

- [ ] 修改 `infoSection` 的四柱行拼接（原 192-193 行）：

```ts
	// 两口径相同时并列两行是噪音（并列相同值会被当成 bug 疑点）；不同（立春与正月初一
	// 之间出生，年/月柱分叉）才值得并列对照。
	const pillars =
		jieQi === feiJieQi
			? [`四柱(节气与非节气同) : ${jieQi}`]
			: [`节气四柱 : ${jieQi}`, `非节气四柱 : ${feiJieQi}`];
```

并把返回数组中的两行 `节气四柱 : …`/`非节气四柱 : …` 替换为 `...pillars`。

- [ ] 同步 selftest:1191 断言组：样例 2000-4-6 两口径相同，期望行列表里把

```ts
			"节气四柱 : 庚辰 庚辰 甲午 甲子",
			"非节气四柱 : 庚辰 庚辰 甲午 甲子",
```

改为

```ts
			"四柱(节气与非节气同) : 庚辰 庚辰 甲午 甲子",
```

- [ ] 在该断言组后新增一条断言（两口径不同的样例——2021-02-08 为立春 2021-02-03 之后、正月初一 2021-02-12 之前，年柱分叉）：

```ts
	ok("专题渲染：节气与非节气四柱分叉时并列两行（2021-02-08，立春后/正月初一前）", () => {
		const args = parseArgs(["--date", "2021-02-08", "--time", "08:30", "--gender", "male"], "astrology");
		const { info } = buildBirthInfo(args);
		const chart = generateChart(info);
		const lines = infoSection(chart, { clockTime: "8:30", solarNote: "", longitude: 120 });
		const jie = lines.find(l => l.startsWith("节气四柱 : "));
		const fei = lines.find(l => l.startsWith("非节气四柱 : "));
		if (!jie || !fei) throw new Error("两口径分叉时应并列两行，实得：\n" + lines.join("\n"));
		if (jie.slice(5) === fei.slice(6)) throw new Error("样例选取失效：两口径竟然相同，换样例");
		return "分叉时两行对照在";
	});
```

- [ ] 实跑校准断言（样例四柱真实值以 CLI 输出为准）：`node scripts/purple-star.ts astrology 2021-02-08 08:30 男`，确认输出两行且年柱不同（辛丑 vs 庚子）；若不同则按实跑修样例日期。

### Task 2：O6——面板与运限之间补空行

**Files:**
- Modify: `scripts/cli/astrology.ts:386`

**Steps:**

- [ ] 在 `out.push(...overviewSection(chart, liuNianYear));` 之前插入 `out.push("");`，使「（注：四柱仅为出生时刻记录…）」行与「【运限速览】」之间隔一空行（与 birthplaceSection/lateZiSection 的空行分隔节奏一致）。
- [ ] 实跑确认：`node scripts/purple-star.ts astrology 1990-05-15 9:30 男 北京`，面板注释行与【运限速览】之间有空行。

### Task 3：P3——缺项校验顺序 日期→时辰→性别

**Files:**
- Modify: `scripts/cli/birth-info.ts:318-329`（性别校验块）与 438 行附近（时辰校验处）

**Steps:**

- [ ] 把性别校验块（`const genderRaw = g("gender");` 到 `const gender = [...]` 共约 12 行，连同上方 3 行注释）从日期校验之后整体搬到时辰校验块之后（「缺少出生时辰」throw 之后、真太阳时口径解析之前），使报错顺序为 日期(316)→时辰(438)→性别。
- [ ] 确认 `gender` 变量在搬移后仍位于其所有使用点之前（返回值 `info` 构造处）。
- [ ] 实跑验证顺序：`node scripts/purple-star.ts astrology 1990-05-15` → 现在应报「缺少出生时辰：需 --time HH:MM 或 --branch 0-12」（原先报缺性别）；补上时间后再报缺性别。
- [ ] `grep -rn "缺少性别" test/ scripts/cli/selftest.ts` 核对既有断言是否只断言文案不断言「先于时辰出现」；若有顺序断言，同步调整。

### Task 4：回归与提交

- [ ] `node scripts/purple-star.ts selftest` 全绿（项数 +1，报告自报）。
- [ ] `npm test` 全绿。
- [ ] 提交：`git add scripts/cli/fortune.ts scripts/cli/astrology.ts scripts/cli/birth-info.ts scripts/cli/selftest.ts && git commit -m "fix(cli): 四柱同口径合并一行(O3)、面板后补空行(O6)、缺项校验顺序日期→时辰→性别(P3)"`
- [ ] 更新 `docs/doubao/cli-usability-review.md` 中 O3/O6/P3 状态标记为 ✅。
