# 评估收口修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 CLI 的文档承诺与实际行为一致（独占分支不静默、Node 下限真实、知识分级可机检），并补齐合盘工作流的数据缺口。

**Architecture:** 全部修复走两条既有接缝——CLI 端到端（stdout/stderr/exit code）与 selftest 文档一致性断言（读 SKILL.md/references/data.ts 文本）；不新增接缝、不新增依赖。独占分支保留实测确立的优先级链（`--palaces` > `--topic` > 其余功能参数），只把"静默吞"改为"指路 throw"。知识分级采用**登记表**形态（`analysis/grades.ts`，28 条引句逐条登记档位），不动渲染链——引句嵌在长文案字符串内，逐条字段化不可行；机检由 selftest 对「文案中的引句 ↔ 登记表」做双向匹配。

**Tech Stack:** TypeScript（Node ≥22.18 原生类型擦除）、node:test、selftest 断言组（`scripts/cli/selftest-kit.ts`）。

**Spec:** `docs/superpowers/specs/2026-10-03-evaluation-remediation-spec.md`（本计划逐条落实其 §4.1–4.5）

## Global Constraints

- 三层验证每任务必跑且全绿：`node scripts/purple-star.ts selftest` 全通过 · `npm test` 520/520 · `npm run typecheck` 0 错误。
- 独占分支优先级链保留：`--palaces` > `--topic` > 其余功能参数；`--json` 与 `--palaces` 的组合是 synastry 契约的一部分，**不得破坏**。
- 「未收录星曜」「古籍中未找到」等**合法无命中**是正常业务输出，保持 return 文案，不得改成 throw。
- 分级枚举只有四个值：`verified` / `traditional` / `suspect` / `methodology`。
- 飞星派术语（自化/来因宫/飞化）在**用户可见的肯定性论断**中禁止；否定/辨析语境（"已下线""不要据此""倪师不主张"）合规。
- 升级 iztro 禁止使用 `npm install iztro@latest`（会把精确 pin 改写为 `^`）；本计划全程不升级依赖。
- 文档中的日期标注与 Claude 品牌措辞已按此前提交清理，本计划新写文案不得再引入。

## Review Focus

1. **未测组合**（如 `--palaces --json --config` 三方同给）：独占检测必须仍生效、`--config` 覆盖语义不受影响——Task 1 的断言 5 覆盖。
2. **grade 枚举拼错**（如 `verifiede`）：机检断言按枚举白名单校验，拼错即红——Task 3 断言覆盖。
3. **合盘"自盘对照"**（`--charts` 两路径相同）：新增互参节在甲=乙时不得崩溃或输出重复荒谬内容——Task 5 断言覆盖。
4. **引句文案的嵌套引号**：登记表的 `quote` 定位串若与正文改动失配，机检必须红（双向匹配的另一半）——Task 3 断言覆盖。
5. **`--topic` 分支早退**（`args.topic === true` 列清单路径）：独占检测不得误伤列清单——Task 1 断言覆盖。

---

### Task 1: 独占分支不静默——检测与指路 throw

**Files:**
- Modify: `scripts/cli/astrology.ts`（cmdAstrology 的 --info / --palaces / --topic 三个分支入口）
- Modify: `scripts/cli/selftest.ts`（命令面断言区，追加 4 条）

**Interfaces:**
- Consumes: `OPTION_GROUPS`（`./args`，按组标题派生可被吞参数集合）；`cmdAstrology`（已有）。
- Produces: 模块级函数 `assertNoShadowedFeatures(args: CliArgs, exclusive: "--palaces" | "--topic"): void`（Task 5 的 selftest 断言依赖它产生的报错文案含「独占分支」与被吞参数名）。

- [ ] **Step 1: 写失败断言**（selftest.ts 的「命令面」断言区，即现有「--monthly 不带 --mutagen 必须指路」断言之后）

```ts
	ok("命令面：独占分支激活时被吞的功能参数必须指路（不静默）", () => {
		const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
		for (const [argv, keyword] of [
			[[...base, "--palaces", "--pattern"], "--pattern"],
			[[...base, "--palaces", "--mutagen"], "--mutagen"],
			[[...base, "--topic", "love", "--pattern"], "--pattern"],
			[[...base, "--json", "--info"], "--info"],
			[[...base, "--json", "--topic", "love"], "--topic"],
		] as const) {
			let msg: string | null = null;
			try {
				cmdAstrology(parseArgs(argv as unknown as string[], "astrology"));
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg || !msg.includes("独占") || !msg.includes(keyword as string))
				throw new Error(`独占分支未指路（${keyword}）：${msg ?? "未报错且静默输出"}`);
		}
		// 组合边界：--json + --palaces 是 synastry 契约，必须保留且出合法 JSON
		const json = cmdAstrology(
			parseArgs([...base, "--palaces", "--json"], "astrology")
		);
		JSON.parse(json);
		return "--palaces/--topic/--json 三组独占语义全部指路；--palaces --json 契约保留";
	});
```

- [ ] **Step 2: 跑 selftest 确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep -E '❌|通过'`
Expected: 新断言 FAIL（当前 `--palaces --pattern` 静默 exit 0），其余全绿。

- [ ] **Step 3: 实现检测**

在 `scripts/cli/astrology.ts` 的 `cmdAstrology` 定义之前加：

```ts
/**
 * 可被独占分支吞掉的功能参数集合——从声明表**派生**：专题深入组的全部参数
 * （palaces 自身除外）加上输出与选题组里的 yearly / monthly / focus。
 */
const SHADOWABLE = new Set(
	OPTION_GROUPS.flatMap(g => {
		if (g.title.startsWith("专题深入")) return g.options.map(o => o.name).filter(n => n !== "palaces");
		if (g.title === "输出与选题") return g.options.filter(o => ["yearly", "monthly", "focus"].includes(o.name)).map(o => o.name);
		return [];
	})
);

/**
 * 独占分支（--palaces / --topic）激活时，其余功能参数不会生效——静默吞违反
 * 「宁可启动失败，也不静默产出错盘」，在这里指路。优先级链：
 * --palaces > --topic > 其他功能参数（--json 仅与 --palaces 组合，见各自分支）。
 */
function assertNoShadowedFeatures(args: CliArgs, exclusive: "--palaces" | "--topic"): void {
	const shadowed = [...SHADOWABLE].filter(n => (args as Record<string, unknown>)[camelKey(n)] !== undefined);
	if (shadowed.length)
		throw new Error(
			`${exclusive} 是独占分支，以下功能参数不会生效：${shadowed.map(n => `--${n}`).join("、")}。` +
				`独占分支请单独使用（优先级：--palaces > --topic > 其他功能参数）。`
		);
}
```

三个分支入口加调用（`camelKey` 已从 ./args 导入；`OPTION_GROUPS` 若未导入则补）：

- `--info` 分支（`if (args.info) {` 之后第一行）：

```ts
		if (args.json)
			throw new Error("--info 与 --json 不可同给：--info 只输出文本面板（--json 仅与完整概览或 --palaces 组合）。");
```

- `--palaces` 分支（`if (args.palaces) {` 之后、`if (args.json)` 之前）：

```ts
		assertNoShadowedFeatures(args, "--palaces");
```

- `--topic` 分支（`if (args.topic !== undefined) {` 之后、`args.topic === true` 列清单判断**之前**）：

```ts
		if (args.json)
			throw new Error("--topic 与 --json 不可同给：主题论断只有文本形态（--json 仅与完整概览或 --palaces 组合）。");
		assertNoShadowedFeatures(args, "--topic");
```

- [ ] **Step 4: 跑 selftest 确认通过 + 全量回归**

Run: `node scripts/purple-star.ts selftest 2>&1 | tail -1 && npm run typecheck 2>&1 | grep -cE 'error TS'; npm test 2>&1 | grep 总计`
Expected: selftest 全通过（+1 断言）、typecheck 0、npm test 520/520。若 npm test 有用例钉了旧的静默行为（`--palaces --pattern`、`--json --info`），按新行为同步改断言（stdout→stderr、exit 0→1）。

- [ ] **Step 5: Commit**

```bash
git add scripts/cli/astrology.ts scripts/cli/selftest.ts test/cli.test.ts
git commit -m "fix(cli): 独占分支（--palaces/--topic）检测被吞功能参数并指路——优先级链文档化语义落地"
```

---

### Task 2: 文档承诺对齐批（options/SKILL/README/CLAUDE/test-README）

**Files:**
- Modify: `references/options.md`（可叠加收窄、独占分支小节、--monthly 强制、--late-zi 互斥）
- Modify: `SKILL.md`（「可叠加」措辞、晚子时节互斥句）
- Modify: `README.md`（Node ≥ 22.18）
- Modify: `CLAUDE.md`（Node ≥ 22.18，两处：命令节引导句与「为什么能直接跑 TypeScript」）
- Modify: `test/README.md`（升级 iztro 的 pin 警告）
- Modify: `scripts/cli/selftest.ts`（文档一致性断言 2 条）

**Interfaces:**
- Consumes: Task 1 的报错文案（「独占分支」关键词，文档描述要与之一致）。
- Produces: 文档一致性断言钉住的关键句——「Node ≥ 22.18」（README/CLAUDE.md）、「独占分支」（options.md）、「禁止 npm install iztro@latest」（test/README.md）。

- [ ] **Step 1: 改四处文档**

1. `references/options.md`：开头「功能参数可叠加」相关表述改为「**专题参数**（pattern / mutagen / yearly / monthly / decadal / ages / focus）可叠加；`--info` / `--palaces` / `--topic` 是**独占分支**（给出即接管输出，静默组合会报错指路）。优先级：`--palaces` > `--topic` > 其他功能参数。」；`--monthly` 行改为「配合 `--mutagen` 四化专题（**强制**）：追加该农历月的流月四化（流年缺省取当年，可用 `--yearly` 指定）」；补一行「`--late-zi` 须配合 `--time`；直接指定时辰的晚子时用 `--branch 12`，两者不可同给」。
2. `SKILL.md`：命令速查上方「可叠加」句同步收窄（与 options.md 措辞一致）；晚子时说明补互斥句。
3. `README.md` 与 `CLAUDE.md`：所有「Node ≥ 22.15」改「**Node ≥ 22.18**」；CLAUDE.md「为什么能直接跑 TypeScript」补一句「22.15–22.17 需 `NODE_OPTIONS=--experimental-strip-types` 且子进程链路不可靠，不作承诺」。
4. `test/README.md`「升级 iztro 的流程」节补：**禁止 `npm install iztro@latest`——实测会把 package.json 的精确 pin `"2.6.1"` 改写为 `"^2.6.1"`，锁版本失效。正确姿势：显式编辑 package.json 版本号 → `npm install` → `git diff package.json` 确认 pin 形态未被改写。**

- [ ] **Step 2: 加文档一致性断言**（selftest.ts 的「文档一致性」断言区，即 references 漂移断言之后）

```ts
	ok("文档一致性：Node 下限、独占分支、升级警告三处承诺与实现同步", () => {
		const readme = readFileSync(resolve(ctx.root, "..", "README.md"), "utf8");
		const claude = readFileSync(resolve(ctx.root, "..", "CLAUDE.md"), "utf8");
		const opts = readFileSync(resolve(ctx.root, "..", "references", "options.md"), "utf8");
		const testReadme = readFileSync(resolve(ctx.root, "..", "test", "README.md"), "utf8");
		for (const [name, text] of [["README.md", readme], ["CLAUDE.md", claude]] as const) {
			if (text.includes("22.15") && !text.includes("NODE_OPTIONS"))
				throw new Error(`${name} 仍承诺 Node ≥ 22.15 —— 实测 22.15.0 裸跑 ERR_UNKNOWN_FILE_EXTENSION，下限应为 22.18`);
		}
		if (!opts.includes("独占分支") || !opts.includes("--palaces` > `--topic"))
			throw new Error("options.md 缺独占分支优先级链描述");
		if (!testReadme.includes("npm install iztro@latest"))
			throw new Error("test/README.md 缺升级 iztro 的 pin 改写警告");
	});
```

- [ ] **Step 3: 跑三层验证 + Commit**

Run: `node scripts/purple-star.ts selftest 2>&1 | tail -1 && npm test 2>&1 | grep 总计 && npm run typecheck 2>&1 | grep -cE 'error TS'`
Expected: 全绿。（SKILL.md 的参数面断言只扫参数名，本任务措辞改动不影响；references 断言只盯三个被盯文件，options.md 不在其中。）

```bash
git add references/options.md SKILL.md README.md CLAUDE.md test/README.md scripts/cli/selftest.ts
git commit -m "docs: 文档承诺对齐——Node 下限 22.18、独占分支优先级链、--monthly 强制 --mutagen、升级 pin 警告"
```

---

### Task 3: 知识分级登记表（grades.ts + 28 条引句 + 机检）

**Files:**
- Create: `scripts/ziwei/analysis/grades.ts`
- Modify: `scripts/cli/selftest.ts`（文档一致性区之后追加机检断言）

**Interfaces:**
- Consumes: `data.ts` 文本（机检读源码文本抽引句，与登记表双向匹配）。
- Produces: `NI_GRADES: readonly NiGradeEntry[]` 与 `type KnowledgeGrade = "verified" | "traditional" | "suspect" | "methodology"`（Task 4 的 synastry 口径统一引用同一枚举）。

- [ ] **Step 1: 写失败机检断言**（selftest.ts）

```ts
	ok("知识分级：data.ts 全部倪师引句在 grades.ts 有登记且档位合法（零缺失）", async () => {
		const { NI_GRADES } = await import("@/ziwei/analysis/grades");
		const legal = new Set(["verified", "traditional", "suspect", "methodology"]);
		for (const e of NI_GRADES) {
			if (!legal.has(e.grade))
				throw new Error(`grades.ts 的「${e.quote}」档位非法：${e.grade}`);
		}
		const src = readFileSync(resolve(ctx.root, "ziwei", "analysis", "data.ts"), "utf8");
		// 引句标记（与评估报告口径一致）：倪师说/论/言、倪海夏说/言/描述/明言/论
		const marks = [...src.matchAll(/(倪师说|倪师论|倪师言|倪海夏说|倪海夏言|倪海夏描述|倪海夏明言)[：:]?「([^」]{6,})」/g)];
		if (marks.length < 28) throw new Error(`引句标记只抽到 ${marks.length} 条（评估基线 28）——标记正则或文案已变，先核对再改断言`);
		const registered = new Set(NI_GRADES.map(e => e.quote));
		const missing = marks
			.map(m => m[2].slice(0, 12))
			.filter(q => !registered.has(q));
		if (missing.length)
			throw new Error(`以下倪师引句未在 grades.ts 登记分级：${missing.map(q => `「${q}…」`).join("、")}`);
		return `${marks.length} 条引句全部有分级登记`;
	});
```

- [ ] **Step 2: 跑 selftest 确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep -E '❌|通过'`
Expected: 新断言 FAIL（grades.ts 不存在，动态 import 抛错）。

- [ ] **Step 3: 建 grades.ts 并逐条登记**

创建 `scripts/ziwei/analysis/grades.ts`：

```ts
/**
 * 主题论断库（data.ts）倪师引句的知识分级登记表。
 *
 * @remarks
 * 引句嵌在 data.ts 的长文案字符串内（非独立条目），故分级以**登记表**承载：
 * `quote` 是引句「」内前 12 字的定位串，selftest 对「文案中的引句 ↔ 本表」做
 * 双向匹配——文案新增引句未登记、或登记的 quote 与文案失配，都会变红。
 * 档位判定规则（与评估报告一致）：
 * - `verified`：引句带《天纪》集数出处（如「天纪 03 明言」）；
 * - `traditional`：古诀云 / 古书云 / 口诀 / 无出处的倪师转述（默认档）；
 * - `suspect`：原文案已带「未核实 / 来源存疑 / 一说非倪师原话」散注；
 * - `methodology`：描述推算方法而非断语的引句。
 */
export type KnowledgeGrade = "verified" | "traditional" | "suspect" | "methodology";

export interface NiGradeEntry {
	/** 引句所属主星（STAR_CONTENT_MAP 的键） */
	star: string;
	/** 引句所在文案字段（mingGong / fuQi / summary.female.overview 等） */
	field: string;
	/** 引句「」内前 12 字定位串 */
	quote: string;
	grade: KnowledgeGrade;
}

export const NI_GRADES: readonly NiGradeEntry[] = [
	// 行号依据 2026-10-03 评估报告；quote 取各引句「」内前 12 字。
	// 档位示例（执行者按上方规则完成全部 28 行，逐条打开 data.ts 对应行核对语境）：
	{ star: "紫微", field: "mingGong", quote: "紫微守命，贵而不富", grade: "traditional" },
	{ star: "紫微", field: "summary.female.overview", quote: "紫微守命，贵而不富", grade: "traditional" },
	// ……（评估报告行号清单：85, 113, 115, 152, 180, 212, 254, 276, 304, 305, 397, 398,
	// 425, 481, 510, 540, 573, 601, 634, 661, 688, 711, 732, 787, 789, 835, 839, 862；
	// 其中 276「天纪 03 明言」→ verified；788「未核实」→ suspect；其余按规则判）
];
```

执行者逐行打开 `scripts/ziwei/analysis/data.ts` 的 28 个行号，按规则填全 28 条（行号与引句一一对应；同句出现在两个字段的——如紫微 mingGong 与 summary.female.overview——各登记一条）。`quote` 必须是文案「」内**逐字**前 12 字（机检双向匹配，失配即红）。

- [ ] **Step 4: 跑 selftest 确认通过 + 全量回归**

Run: `node scripts/purple-star.ts selftest 2>&1 | tail -1 && npm run typecheck 2>&1 | grep -cE 'error TS'`
Expected: 全绿、typecheck 0。

- [ ] **Step 5: Commit**

```bash
git add scripts/ziwei/analysis/grades.ts scripts/cli/selftest.ts
git commit -m "feat(analysis): 知识分级登记表——28 条倪师引句逐条标注，selftest 机检零缺失"
```

---

### Task 4: 两库口径统一 + 飞星派断语清除

**Files:**
- Modify: `scripts/ziwei/analysis/data.ts`（3 处：409 廉贞丙火→丁火、422/429 火木→丁火、305 武曲二十八岁→30 岁后）
- Modify: `scripts/synastry/synastry-knowledge.ts`（:154-155 七杀 ni_quote 降级 suspect、:77 太阳「必有」→「需格外注意」、:179 自化禄断语删除）
- Modify: `scripts/classics/data/quanji.ts`（:38 补口径注）
- Modify: `scripts/cli/selftest.ts`（机检断言 2 条）

**Interfaces:**
- Consumes: Task 3 的 `KnowledgeGrade` 枚举。
- Produces: synastry-knowledge 的 `ni_quote` 字段语义收窄——**只承载 verified/traditional 档**，suspect 档内容降级为普通文案并在句首带「（坊间流传，未核实倪师原话）」；selftest 断言依赖 synastry 输出**不再含**「自化禄」。

- [ ] **Step 1: 写失败断言**（selftest.ts）

```ts
	ok("体系合规：合盘输出无飞星派断语，两库引句口径不打架", () => {
		const k = readFileSync(resolve(ctx.root, "synastry", "synastry-knowledge.ts"), "utf8");
		if (/自化(禄|权|科|忌)/.test(k))
			throw new Error("synastry-knowledge 仍含「自化」断语——体系不计算宫干自化，用户可见文案不得出现");
		const d = readFileSync(resolve(ctx.root, "ziwei", "analysis", "data.ts"), "utf8");
		if (d.includes("娶个七杀入命的太太") && !d.includes("坊间流传"))
			throw new Error("七杀「娶妻毁一半」引句丢失「未核实」口径标注");
		const s = readFileSync(resolve(ctx.root, "synastry", "synastry-knowledge.ts"), "utf8");
		if (s.includes("必有重大灾祸"))
			throw new Error("太阳「三不见」在 synastry 侧被强化为「必有」——两库口径打架");
		if (d.includes("二十八岁后"))
			throw new Error("武曲晚婚门槛 data.ts 仍为 28 岁——应统一为 30 岁");
	});
```

- [ ] **Step 2: 跑 selftest 确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep -E '❌|通过'`
Expected: 新断言 FAIL（synastry-knowledge 含「自化禄」、data.ts 含「二十八岁后」）。

- [ ] **Step 3: 实现**

1. `synastry-knowledge.ts:179`：删除「；自化禄则财来财去，感情有但难守」片段（该情形体系不计算，整句保留生年四化语境的部分）。
2. `synastry-knowledge.ts:154-155`（七杀 ni_quote）：句首加「（坊间流传，未核实倪师原话）」，并确认 `data.ts:788` 的「坊间流传倪师笑言（未核实）」保持原样——两库从此同口径。
3. `synastry-knowledge.ts:77`（太阳三不见）：「那十年丈夫必有重大灾祸」改「那十年丈夫需格外注意重大灾祸」。
4. `data.ts:305`：「建议晚婚（二十八岁后）」改「建议晚婚（30 岁后）」。
5. `data.ts:409`：「丙火」改「丁火」；`:422`、`:429`：「火木」改「丁火」（廉贞标准口径为丁阴火）。
6. `quanji.ts:38`：条目描述「四参大限流年之飞化」后补括注「（古籍原文如此；本项目的四化星固定不动，大限流年只看宫位迁移——见 scripts/ziwei/mutagen.ts 的体系基准节）」。

- [ ] **Step 4: 跑三层验证**

Run: `node scripts/purple-star.ts selftest 2>&1 | tail -1 && npm run typecheck 2>&1 | grep -cE 'error TS'; npm test 2>&1 | grep 总计`
Expected: 全绿。（test/cli.test.ts 与 selftest-asserts 若有断言钉住「自化禄」文案或廉贞五行旧值，按新口径同步——先 grep「自化禄」「丙火」确认。）

- [ ] **Step 5: Commit**

```bash
git add scripts/ziwei/analysis/data.ts scripts/synastry/synastry-knowledge.ts scripts/classics/data/quanji.ts scripts/cli/selftest.ts
git commit -m "fix(analysis): 两库引句口径统一、自化禄断语清除、廉贞五行与武曲门槛校准"
```

---

### Task 5: 合盘双盘四化互参节 + 交付模板补齐

**Files:**
- Modify: `scripts/cli/synastry.ts`（渲染层：在「生年四化入夫妻宫」节之后追加「双盘四化互参」节）
- Modify: `scripts/cli/selftest.ts`（断言 2 条）
- Modify: `references/output-contract.md`（补「流年解读」「合盘」两种交付模板）
- Modify: `references/workflow.md`（合盘段补「`--json` 输出走 stdout 重定向落盘」）

**Interfaces:**
- Consumes: `ca` / `cb`（cmdSynastry 已加载的两份 `AnalyzeJson`，其 `nativeSiHua.located` 数组元素含 `{ hua, star, palace, branch }`，`chart.palaces` 提供 branch → 宫名）。
- Produces: 合盘文本输出新增一节，标题 `【双盘四化互参】`；output-contract 的两种新模板（Markdown 小节）。

- [ ] **Step 1: 写失败断言**（selftest.ts 合盘相关断言区，复用现有「合盘抬头」断言的临时盘设施）

```ts
	ok("合盘交付：输出含双盘四化互参节（五步法第 4 步的数据缺口补齐）", () => {
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-synastry-hucan-"));
		try {
			const json = (d: string, g: string) =>
				cmdAstrology(parseArgs(["--date", d, "--branch", "5", "--gender", g, "--json"], "astrology"));
			const a = join(tmp, "a.json");
			const b = join(tmp, "b.json");
			writeFileSync(a, json("1990-05-15", "male"), "utf8");
			writeFileSync(b, json("1992-08-01", "female"), "utf8");
			const out = cmdSynastry(parseArgs(["--charts", `${a},${b}`], "synastry"));
			if (!out.includes("【双盘四化互参】"))
				throw new Error("缺【双盘四化互参】节");
			if (!out.includes("甲方") || !out.includes("落乙方") || !out.includes("乙方") || !out.includes("落甲方"))
				throw new Error("互参节缺双向对照行");
			// 自盘对照：两路径相同时不得崩溃
			const self2 = cmdSynastry(parseArgs(["--charts", `${a},${a}`], "synastry"));
			if (!self2.includes("【双盘四化互参】")) throw new Error("自盘对照缺互参节");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
```

- [ ] **Step 2: 跑 selftest 确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep -E '❌|通过'`
Expected: 新断言 FAIL（现输出无该节）。

- [ ] **Step 3: 实现互参节**

在 `scripts/cli/synastry.ts` 的「生年四化入夫妻宫」节输出之后追加（复用已加载的 `ca`/`cb` 与既有的宫名查找方式）：

```ts
	// 双盘四化互参（五步法第 4 步的数据底座）：甲方四化星落乙方何宫、乙方落甲方何宫。
	// 数据两份 JSON 里本就齐备，这里只是渲染成对照，免得助手自己排两份详表手工对星。
	out.push("", "【双盘四化互参】", "  甲方四化 → 落乙方宫位：");
	for (const x of ca.nativeSiHua.located) {
		const palace = x.palace ? (cb.chart.palaces.find(p => p.name === x.palace)?.name ?? null) : null;
		out.push(`    化${x.hua} ${x.star} → ${palace ? `乙方${palace}` : "（未上乙方盘）"}`);
	}
	out.push("  乙方四化 → 落甲方宫位：");
	for (const x of cb.nativeSiHua.located) {
		const palace = x.palace ? (ca.chart.palaces.find(p => p.name === x.palace)?.name ?? null) : null;
		out.push(`    化${x.hua} ${x.star} → ${palace ? `甲方${palace}` : "（未上甲方盘）"}`);
	}
```

（实现时按 `ca`/`cb` 实际变量名与宫名查找的既有 helper 对齐——synastry.ts 已有按 branch 找宫的写法，照抄其惯用形态；`palace` 名跨盘匹配的语义是「同名宫位」（如甲方化禄星落自己夫妻宫，看乙方同名宫），与 guide 的「飞化互参」口径一致。）

- [ ] **Step 4: 跑 selftest 确认通过 + 全量回归**

Run: `node scripts/purple-star.ts selftest 2>&1 | tail -1 && npm test 2>&1 | grep 总计 && npm run typecheck 2>&1 | grep -cE 'error TS'`
Expected: 全绿。（synastry selftest-asserts 的冒烟断言若钉了节的**数量**，同步改为「至少」语义。）

- [ ] **Step 5: 补两份文档模板**

1. `references/output-contract.md`：在「全盘」「聚焦」两种形态之后补两节——
   - **流年解读形态**（`--yearly` 请求）：流年命宫与主星 → 流年四化（重点标 ★ 入三方）→ 与大限关系 → 同星引动 → 建议；篇幅基线 300–600 字。
   - **合盘形态**（`synastry` 请求）：口径提示转达 → 双宫联参表 → 主星对应判定 → 四化互参（用【双盘四化互参】节）→ 夫妻宫断语要点 → 星级定档（注明裁量）→ 建议；篇幅基线 500–900 字。
2. `references/workflow.md` 合盘段：在 `synastry --charts /tmp/a.json,/tmp/b.json` 之前补一句「`astrology --json` 的产物经 stdout 重定向落盘（`> /tmp/a.json`）；勿带 `--palaces`」。

- [ ] **Step 6: Commit**

```bash
git add scripts/cli/synastry.ts scripts/cli/selftest.ts references/output-contract.md references/workflow.md
git commit -m "feat(synastry): 双盘四化互参节——五步法第 4 步数据缺口补齐；output-contract 补流年/合盘模板"
```

---

### Task 6: 终验与收尾

**Files:**
- 无新改动（验证 + 汇总）。

- [ ] **Step 1: 三层全量验证**

Run: `node scripts/purple-star.ts selftest 2>&1 | tail -1 && npm test 2>&1 | grep 总计 && npm run typecheck 2>&1 | grep -cE 'error TS'`
Expected: selftest 全通过（含本计划新增全部断言）· npm test 520/520 · typecheck 0。

- [ ] **Step 2: 端到端抽查**

Run（应全部指路/正常，无静默）:
```bash
node scripts/purple-star.ts astrology --date 1990-05-15 --branch 5 --gender male --city 杭州 --palaces --pattern 2>&1 | head -2
node scripts/purple-star.ts astrology --date 1990-05-15 --branch 5 --gender male --city 杭州 --json --info 2>&1 | head -2
node scripts/purple-star.ts astrology --date 1990-05-15 --branch 5 --gender male --city 杭州 --topic love --view liunian --yearly 2027 | head -3
```

- [ ] **Step 3: 推送**

```bash
git push
```
