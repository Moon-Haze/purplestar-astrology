# 批次 D：代码结构收敛（P1 + F6）实施计划

> **For agentic workers:** 本计划按任务逐步执行，步骤用 checkbox 跟踪。实现 spec：`docs/specs/2026-10-09-review-fixes.md` 批次 D。

**Goal:** 消除 `buildAnalyzeJson` 与 `yearlySection` 内的同函数重复计算；删 package.json 残留的数据路线 npm scripts。

**Architecture:** 纯局部变量提取，行为零变化（golden 对比：`--json` 输出改前改后逐字节一致）；F6 只删 scripts 不删 devDep（tools/db 仍在仓内、tsconfig include tools/ 仍需 @duckdb/node-api 类型）。

**Tech Stack:** TypeScript。

**Spec:** `docs/specs/2026-10-09-review-fixes.md`

## Global Constraints

- 行为零变化：改后 `--json` 输出与改前逐字节一致（写入临时文件 diff）。
- 改 `scripts/` 源码用 Edit/Write 工具提交（Mimosa 钩子拦截 Bash 直写）。

## Review Focus

- P1 提取变量时不要顺手改兜底语义（`?? null` 原样保留）。
- F6 删 scripts 后 `npm run` 列表不得再含 db 三项，`npm test`/`typecheck` 不受影响。

---

### Task 1：P1a——buildAnalyzeJson 提流年地支局部变量

**Files:**
- Modify: `scripts/cli/astrology.ts:146-152`

**Steps:**

- [ ] 改前先留 golden：`node scripts/purple-star.ts astrology --date 1990-05-15 --time 9:30 --city 北京 --gender 男 --json > /tmp/json-before.txt`
- [ ] 把 liuNianPalace 块改为：

```ts
			// 流年命宫与小限宫（运限速览的结构化等价物，2026-09-28 新增，只加不删）
			// 流年地支一次算好：三处引用同值，重复调用徒增「这三处是否同值」的读码疑虑。
			liuNianPalace: (() => {
				const lnBranch = yearlyBranchOf(liuNianYear);
				return {
					year: liuNianYear,
					branchIndex: lnBranch,
					branch: BRANCHES[lnBranch],
					palaceName: chart.palaces.find(p => p.branch === lnBranch)?.name ?? null,
				};
			})(),
```

- [ ] golden 对比：`node scripts/purple-star.ts astrology --date 1990-05-15 --time 9:30 --city 北京 --gender 男 --json > /tmp/json-after.txt && diff /tmp/json-before.txt /tmp/json-after.txt` → 无输出。

### Task 2：P1b——yearlySection 复用大限三方名

**Files:**
- Modify: `scripts/cli/fortune.ts:398-408`

**Steps:**

- [ ] 把与当前大限关系段中的两次 `surroundNames(chart, dx.palaceBranch)` 提取一次：

```ts
	if (dx) {
		const dxSanFang = surroundBranches(dx.palaceBranch);
		const entered = dxSanFang.includes(lnBranch);
		// 大限三方名一次取好（entered 与 not-entered 两分支共用，原两次重复查询）
		const dxSanFangNames = surroundNames(chart, dx.palaceBranch).join("/");
		out.push("");
		out.push(
			`与当前大限（${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})）：` +
				(entered
					? `流年命宫**入**大限三方四正（${dxSanFangNames}）—— 限运引动流年`
					: `流年命宫**不入**大限三方四正（${dxSanFangNames}）—— 流年独立于限运看`)
		);
	}
```

- [ ] 实跑对拍：`node scripts/purple-star.ts astrology 1990-05-15 9:30 男 北京 --yearly 2026` 输出与改前一致（肉眼核对「与当前大限」行即可，或同样 diff）。

### Task 3：F6——删数据路线 npm scripts

**Files:**
- Modify: `package.json`（scripts 段）

**Steps:**

- [ ] 删除三行：`"build:db"`、`"verify:db"`、`"query"`（数据路线已下线，运行时零依赖；tools/db 脚本保留在仓内，需要时用 `npx tsx tools/db/build-duckdb.ts` 直跑）。
- [ ] 在 `tools/db/` 下若有 README 则补一行「npm scripts 入口已删（2026-10-09，数据路线下线），直跑 `npx tsx tools/db/<script>.ts`」；若无 README 跳过。
- [ ] `npm run typecheck` 与 `npm test` 通过（确认删 scripts 不影响二者）。

### Task 4：回归与提交

- [ ] `node scripts/purple-star.ts selftest` 全绿。
- [ ] 提交：`git add scripts/cli/astrology.ts scripts/cli/fortune.ts package.json && git commit -m "refactor: 流年地支与大限三方名一次计算复用(P1)；删数据路线 npm scripts(F6)"`
- [ ] 更新 `docs/doubao/functional-review.md` P1 状态 ✅、`docs/doubao/skill-functional-review.md` F6 状态 ✅。
