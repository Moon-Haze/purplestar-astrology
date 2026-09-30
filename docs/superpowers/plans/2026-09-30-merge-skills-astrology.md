# 三 skill 合一 + astrology 命令融合 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仓库重组为单一 skill（根 `scripts/`），四条排盘命令融合为 `astrology`（英文功能参数 + 拼音别名），术语五层对齐 iztro，解析引擎换 `util.parseArgs` tokens 底座 + 薄适配层，新增配置文件输入与强化 help。

**Architecture:** 三个阶段——①迁移（`git mv` 到根 `scripts/`、classics/synastry 搬入、文件名英文化与术语对齐，行为不变、每步全绿）；②命令重构（解析引擎、cli/ 按命令拆分、astrology 融合、help/config）；③文档（SKILL.md 重写、仓库散文、最终回归）。

**Tech Stack:** Node ≥ 22.15（`module.registerHooks` + 原生类型擦除 + `node:util` 的 `parseArgs`）；iztro 2.6.1 / lunar-typescript 1.8.6；测试为 skill 内 `selftest` + 仓库 `npm test`（七层）+ `npm run typecheck`。

**Spec:** `docs/superpowers/specs/2026-09-29-merge-skills-and-topics-design.md`（本计划从它推导，执行时两个文件都读；映射表以 spec §1/§2.7/§2.8/§2.9 为准，冲突时以 spec 为准）。

## Global Constraints

- 体系红线：三合派——不做宫干四化/自化/来因宫；运限分析只走宫位+三方四正+生年/流年四化。
- 每个任务收尾必跑三连并全绿才算完：`node scripts/purple-star.ts selftest`（合并后三段合计）、`npm test`、`npm run typecheck`。
- 迁移与改名一律 `git mv`（可追溯），不 squash 历史；迁移类任务（Task 1–3）各自单独成笔提交。
- 中文报错：所有面向用户的报错为中文；不引入英文报错路径。
- `tools/` 不在 `npm test` 覆盖内——涉及路径的迁移任务必须实跑 `tools/db` 入口与 `tools/bench/startup.ts` 各一次。
- 引导层铁律：`purple-star.ts` 除 `node:` 内置与 `boot-hooks.ts` 外不得普通静态 import；`cli/` 内部静态 import 是对的。
- 计数类事实（断言数/测试项数）不写死进任何文档。
- 命令示例路径：仓库级文档写 `node scripts/purple-star.ts`（合并后仓库根 = skill 根，全路径前缀 `skills/<name>/` 作废）。

## Review Focus

1. **位置参数与参数混排**：`astrology 1990-5-15 9:30 男 北京 --palaces`——形态归类不得吞掉 `--palaces`；同类 token 重复（两个日期）必须报错。→ Task 4 断言钉。
2. **`--limit -3` 负数值**（Node 版本敏感）：贪婪吃值，`-3` 是 `--limit` 的值不是短参数。→ Task 4 断言钉（tokens 流 value 内联）。
3. **重复参数**：同一参数给两次（`--geju --geju` 或 `--geju --pattern` 同义并列）一律报错（旧 cac「取末值」废止）。→ Task 4 断言钉。
4. **`--charts` 输入校验**：非恰好两份 / 文件不可读 / JSON 不符消费契约 / 同路径（允许）——三种报错一种放行。→ Task 7 断言钉。
5. **旧命令名的肌肉记忆**：`analyze --date …`（已删命令）报错信息须指路 `astrology`；`--a-chart`/`--year` 是「未知参数」并给出建议。→ Task 6/7 断言钉。

---

### Task 1: 仓库重组——skills/ 迁到根，行为不变

**Files:**
- Move: `skills/purplestar-astrology/scripts/**` → `scripts/**`（git mv）
- Move: `skills/purplestar-astrology/SKILL.md` → `SKILL.md`；`skills/purplestar-astrology/references/**` → `references/**`
- Move: `skills/purplestar-astrology/package.json` 内容并入根 `package.json`（iztro/lunar-typescript 依赖与 scripts）后删除
- Delete: `skills/`（另两个 skill 的搬移在 Task 2，本任务先保留 `skills/purplestar-classics`、`skills/purplestar-synastry` 原地不动）
- Modify: `tsconfig.json`（`paths` 的 `@/*` → `./scripts/*`；`include` 的 `skills/**/*` → `scripts/**/*`）
- Modify: `test/lib/loader.ts`（内核根 `skills/purplestar-astrology/scripts` → `scripts`）、`test/lib/skills.ts`（`ALL_SKILLS`/`SOURCE_SKILL`/`CHART_LIKE` 收窄）、`test/lib/citation-guard.ts`（扫描根）、`test/cli.test.ts`（三条 CLI 路径先只改 astrology 那条）、`tools/db/db.ts`、`tools/bench/startup.ts`（字面路径）
- Test: 迁移后三连 + `tools/db` 与 `tools/bench/startup.ts` 实跑

**Interfaces:**
- Produces: 根 `scripts/` 为内核根；后续所有任务在新路径工作。
- 本任务**不改任何行为**：CLI 输出、JSON、断言文案全部不变（层 2 断言里的 `skills/...` 路径字符串按新路径更新，仅此而已）。

- [ ] **Step 1: 迁移前基线**

Run: `node skills/purplestar-astrology/scripts/purple-star.ts selftest 2>&1 | head -1 && npm test 2>&1 | grep 总计 && npm run typecheck && echo 绿`
Expected: 全绿（基线，万一红了先停下排查）。

- [ ] **Step 2: git mv 与路径改写**

```bash
git mv skills/purplestar-astrology/scripts scripts
git mv skills/purplestar-astrology/SKILL.md SKILL.md
git mv skills/purplestar-astrology/references references
# 依赖并入根 package.json（iztro、lunar-typescript 已在；核对 devDeps/scripts 后删 skills/purplestar-astrology）
```

随后按 spec §2.10 表逐项改写：`tsconfig.json` 的 `paths.include`；`test/lib/loader.ts`、`test/lib/skills.ts`（`ALL_SKILLS` 现在只含 classics/synastry 两个待搬 skill + 根——**本任务临时**把根当作一个条目或先注释断言，Task 2 收口）、`test/lib/citation-guard.ts`（扫描根列表加 `scripts/`）、`test/cli.test.ts` 的 astrology CLI 路径、`tools/db/db.ts:20` 的 import、`tools/bench/startup.ts:44` 的 `CLI` 常量。
`SKILL.md` 与 `references/` 内部一律写 `node scripts/purple-star.ts`（skill 根 = 仓库根，原「相对 skill 根」的写法恰好不用改，只删 `skills/<name>/` 前缀出现处）。

- [ ] **Step 3: 三连 + tools 实跑**

```bash
node scripts/purple-star.ts selftest 2>&1 | head -1   # 通过 N/N
npm test 2>&1 | grep 总计                              # 全绿
npm run typecheck && echo typecheck 绿
npx tsx tools/bench/startup.ts 2>&1 | head -3          # 起动基准实跑不崩
npx tsx tools/db/build-duckdb.ts --help 2>&1 | head -3 # db 入口实跑不崩（若该入口有 --help）
```

Expected: 全部通过。红了按报错补漏改的路径（重定向坑：查引用用 `grep -rn "skills/purplestar" --include="*.ts" --include="*.json" --include="*.md" .` 清零，`docs/` 与 `reference/` 除外）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(repo): 仓库重组为单 skill 形态——内核上提根 scripts/（行为不变）"
```

---

### Task 2: classics / synastry 搬入根 scripts/ + selftest 三段合并

**Files:**
- Move: `skills/purplestar-classics/scripts/**` → `scripts/classics/`（data/ 随行）
- Move: `skills/purplestar-synastry/scripts/**` → `scripts/synastry/`
- Move: `skills/purplestar-synastry/references/synastry-guide.md` → `references/synastry-guide.md`
- Delete: `skills/`（清空后）
- Create: `scripts/cli/classics.ts`、`scripts/cli/synastry.ts`（命令薄层，import 各自内核）
- Modify: `scripts/cli/commands.ts`（COMMAND_TABLE 加 classics/synastry）、`scripts/cli/selftest.ts`（汇总三段断言）、`scripts/cli/args.ts` + `option-scope.ts`（Task 5 才重写；本任务先在现 cac 骨架的 FLAG_GROUPS 加 classics/synastry 的参数声明：`search`/`limit` 已在全集，`chart` 已在全集——补作用域即可）
- Test: `scripts/classics/selftest`（迁移后并入主 selftest）

**Interfaces:**
- Produces: `cmdClassics(args: CliArgs): string`、`cmdSynastry(args: CliArgs): string`（cli/classics.ts、cli/synastry.ts 导出）；classics 内核导出 `searchClassics`（检索纯函数）；synastry 内核导出 `readAnalyzeJson`/`runSynastry` 等既有函数（搬入后 import 从全扩展名改为省扩展名 + `@/` 别名）。
- 合并后 selftest 报告三段：排盘 / 古籍 / 合盘，首行「通过 N/N」合计。

- [ ] **Step 1: 搬移 + import 风格统一**

```bash
git mv skills/purplestar-classics/scripts scripts/classics
git mv skills/purplestar-synastry/scripts scripts/synastry
git mv skills/purplestar-synastry/references/synastry-guide.md references/synastry-guide.md
```

改写搬入文件的 import：全扩展名（`./data/quanshu.ts`）→ 省扩展名（`./data/quanshu`）与 `@/ziwei/...`（引内核时）。tsconfig `include` 已覆盖 `scripts/**`，typecheck 自动接管。
各自的 `purple-star.ts`/`commands.ts`/`selftest.ts` 重构：命令实现进 `cli/classics.ts`/`cli/synastry.ts`；各自 selftest 的断言体抽成 `scripts/classics/selftest-asserts.ts` 与 `scripts/synastry/selftest-asserts.ts`（导出 `function asserts(): {name,detail,pass}[]` 或等价形态，跟主 selftest 的 Assertion 接口对齐）。

- [ ] **Step 2: 主 selftest 汇总三段（先写失败断言）**

在 `scripts/cli/selftest.ts` 增加一条：

```ts
ok("自检合并：classics / synastry 断言组随主 selftest 执行", () => {
	const classics = classicAsserts();  // scripts/classics/selftest-asserts.ts
	const synastry = synastryAsserts(); // scripts/synastry/selftest-asserts.ts
	if (!classics.length || !synastry.length) throw new Error("断言组为空——搬移未完成");
	return `古籍 ${classics.filter(x=>x.pass).length}/${classics.length} · 合盘 ${synastry.filter(x=>x.pass).length}/${synastry.length}`;
});
```

并把两组的逐条结果追加进 `results`（分段标题行「── 古籍 ──」「── 合盘 ──」）。跑 selftest：因断言组还没搬好而红。

- [ ] **Step 3: 完成搬移使断言组产出，验证绿**

Run: `node scripts/purple-star.ts selftest 2>&1 | head -1 && npm test 2>&1 | grep 总计 && npm run typecheck && echo 绿`
Expected: 三段合计全绿；`skills/` 目录已不存在（`test/lib/skills.ts` 的 `ALL_SKILLS` 此时改为从根 `SKILL.md` 推导单 skill，相关断言收窄）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(skills): classics / synastry 搬入根 scripts/，selftest 三段合一"
```

---

### Task 3: 文件名英文化 + 术语五层对齐 iztro

**Files:**
- Rename（spec §2.7 表，14 个）：`ziwei/sihua.ts→mutagen.ts`、`cli/yun.ts→fortune.ts`、`patterns/{ji-chu-ge→basic, shang-ge→superior, zhong-ge→medium, shou-lian-ge→converged, zhu-li-ge→enhancing, e-ge→malefic, ming-gong-summary→life-summary→**改 soul-summary**}.ts`、`analysis/views/{daxian→decadal, liunian→yearly, kuiyue→patron, sanfang→surround, sihua→mutagen}.ts`
- Modify: `ziwei/types.ts`（类型值 `lucky/sha→soft/tough`、`SiHua→Mutagen`、`DaXian→Decadal`；字段 `wuxingJu/wuxingJuName→fiveElementsClass/fiveElementsClassName`、`mingGongBranch→soulBranch`、`shenGongBranch→bodyBranch`、`daXians→decadals`、`currentDaXianIndex→currentDecadalIndex`、`daXianAge→decadalRange`、`isCurrentDaXian→isCurrentDecadal`、`xiaoXianAges→ages`、`isShenGong→isBodyPalace`、`isMingGong→isSoulPalace`、`hour→timeIndex`、`Star.siHua→mutagen`）
- Modify: 全仓引用（algorithm/render/patterns/analysis/fortune/cli 各命令/classics/synastry/test/tools——`grep -rn` 逐个旧名清零）
- Test: 三连 + JSON 字段名快照核对（`astrology --json` 的字段——此时还叫 analyze，见 Task 6）

**Interfaces:**
- Produces: 全部新标识符（后续任务一律用新名）；JSON 输出字段随 types 改名（本仓无外部消费者，合盘 chart-view 同笔改）。
- 保留不动：`ziweiPos`、`yearStem/yearBranch`、`SHICHEN`、`lateZi*`/`--late-zi`、`getYearStemIndex`、宫名「交友宫」、classics 三部书名文件。

- [ ] **Step 1: 先钉红色基线断言（改名前的契约断言）**

selftest 增补（先写、后改，改完它们转绿）：

```ts
ok("术语对齐：iztro 字段名生效（fiveElementsClass / soulBranch / ages / mutagen）", () => {
	const c = generateChart(sample);
	if (!("fiveElementsClass" in c) || !("soulBranch" in c) || !("bodyBranch" in c)) throw new Error("chart 字段未对齐 iztro");
	const p = c.palaces.find(x => x.isSoulPalace);
	if (!p) throw new Error("isSoulPalace 不存在");
	if (c.palaces.some(x => x.stars.some(s => s.type === "lucky" || s.type === "sha"))) throw new Error("Star.type 仍有 lucky/sha 残留");
	if (c.palaces.some(x => x.stars.some(s => s.type === "soft" || s.type === "tough")) === false) throw new Error("soft/tough 未出现");
	return "字段/类型值对齐";
});
```

Run: `node scripts/purple-star.ts selftest 2>&1 | grep 术语对齐` → 预期 ❌（旧字段）。

- [ ] **Step 2: git mv 14 个文件 + 全仓标识符替换**

```bash
git mv scripts/ziwei/sihua.ts scripts/ziwei/mutagen.ts   # …按 §2.7 表逐个执行
```

替换策略：**旧名→新名逐对全仓替换**（含 test/ 与 tools/；先 types.ts，后引用方，typecheck 逐轮收敛）。注意 `SiHua→Mutagen` 连带 `getSiHuaByStem→getMutagenByStem`、`getLiuNianSiHua→getYearlyMutagen`、`getLiuYueSiHua→getMonthlyMutagen`、`getLiuYueStemIndex→getMonthlyStemIndex`（§2.9 标识符表）与 `duiGongBranch→oppositeBranch`、`sanFangBranches→surroundBranches`、`sanFangSiZheng→surroundNames`、`getSanFangPalaces→getSurroundPalaces`、`SHA_STARS→TOUGH_STARS`、`LUCKY_STARS→SOFT_STARS`、fortune.ts 内 `liuNianSection→yearlySection`、`daXianSection→decadalSection`、`xiaoXianSection→ageSection`、`gejuSection→patternSection`、`sihuaSection→mutagenSection`、`liuNianBranchOf→yearlyBranchOf`、`xiaoXianPalaceOf→agePalaceOf`、`parseAgeArg→parseAgesArg`。
清零验证：`grep -rn "wuxingJu\|mingGongBranch\|daXianAge\|xiaoXianAges\|siHua\|SiHua\|DaXian\b" scripts/ test/ tools/ --include="*.ts"` → 空输出（注释里的历史陈述除外，逐条人工判读后改写或保留）。

- [ ] **Step 3: 三连全绿**

Run: `node scripts/purple-star.ts selftest 2>&1 | head -1 && npm test 2>&1 | grep 总计 && npm run typecheck && echo 绿`
Expected: 全绿（层 1 基准比对不受改名影响——它比对的是排盘行为；层 3 断言里引用旧字段名的按新名更新）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(terms): 文件名英文化 + 术语五层对齐 iztro（含 JSON 字段名变更）"
```

---

### Task 4: 解析引擎——util.parseArgs tokens 底座 + 薄适配层

**Files:**
- Rewrite: `scripts/cli/args.ts`（cac 退役；`OPTION_GROUPS` 声明表结构保留；新增 `OPTION_ALIASES`、位置参数归类、贪婪取值、重复报错、中文报错）
- Rename: `scripts/cli/flag-scope.ts` → `option-scope.ts`（`FLAG_*→OPTION_*`；`sidePrefixes`/`prefixedCommands` 空表保留）
- Modify: 根 `package.json`（删 `cac` 依赖）、`scripts/purple-star.ts`（不再从 args.ts 拿 cac 的 `cli` 实例——help 渲染改走 Task 8 的 `cli/help.ts`；本任务先给最小 help 保持可跑）
- Modify: `scripts/cli/birth-info.ts`（删 `--year/--month/--day` 回退链；新增位置参数归类入口）
- Test: selftest 参数面断言组全量重写

**Interfaces:**
- Produces: `parseArgs(argv: string[], command?: string): CliArgs`（签名不变，实现全换）；`camelKey(name: string): string`（保留）；`OPTION_ALIASES: Record<string,string>`（`geju→pattern, sihua→mutagen, liunian→yearly, liuyue→monthly, daxian→decadal, xiaoxian→ages`）；`OPTION_NAMES: ReadonlySet<string>`（含主名，**不含**别名——校验时先查别名归一）。
- 行为契约：未知参数→中文报错（含 `suggestOption` 最近名）；重复参数（含主名与别名同现）→报错；`--key=value` 支持；`--` 之后全进 `_`；取值参数贪婪吃紧随 token（`--limit -3` 合法）；裸开关=`true`；出生信息位置参数按形态归类（§1.2：日期 `^\d{4}-\d{1,2}-\d{1,2}$`、时刻 `^\d{1,2}:\d{2}$`、性别 `男|女|male|female|m|f`、其余中文 token=城市名）。

- [ ] **Step 1: 写失败的参数面断言组（覆盖 Review Focus 1/2/3）**

在 selftest 参数面区重写（先红）：

```ts
ok("解析引擎：util.parseArgs tokens 底座——贪婪取值 / 等号式 / -- 分隔", () => {
	const a = parseArgs(["--limit", "-3"], "classics");
	eq(a.limit, "-3", "--limit -3 的值 ");
	eq(parseArgs(["--focus=财帛"], "astrology").focus, "财帛", "等号式 ");
	eq(parseArgs(["--", "-x", "y"], "astrology")._.join(","), "-x,y", "-- 之后全位置 ");
});
ok("解析引擎：重复参数与主别名同现必须报错", () => {
	for (const argv of [["--geju", "--geju"], ["--geju", "--pattern"]]) {
		let msg = "";
		try { parseArgs(argv, "astrology"); } catch (e) { msg = (e as Error).message; }
		if (!msg) throw new Error(`${argv.join(" ")} 未报错——重复参数应报错（旧「取末值」废止）`);
	}
});
ok("解析引擎：拼音别名归一到英文主名", () => {
	eq(parseArgs(["--geju"], "astrology").pattern, true, "--geju → pattern ");
	eq(parseArgs(["--sihua"], "astrology").mutagen, true, "--sihua → mutagen ");
	eq(parseArgs(["--liunian", "2027"], "astrology").yearly, "2027", "--liunian → yearly ");
});
ok("解析引擎：--year/--month/--day 三连已删，未知参数中文报错", () => {
	let msg = "";
	try { parseArgs(["--year", "1990"], "astrology"); } catch (e) { msg = (e as Error).message; }
	if (!msg.includes("未知参数") || !msg.includes("--yearly")) throw new Error(`应报未知参数并建议 --yearly，实得：${msg}`);
});
ok("出生信息：位置参数形态归类（日期/时刻/性别/城市），与旗标形态同盘", () => {
	const pos = buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "北京"], "astrology"));
	const flg = buildBirthInfo(parseArgs(["--date", "1990-05-15", "--time", "09:30", "--gender", "male", "--city", "北京"], "astrology"));
	eq(chartSignature(generateChart(pos.info)), chartSignature(generateChart(flg.info)), "位置参数与旗标 ");
	let dup = "";
	try { parseArgs(["1990-5-15", "1991-6-1"], "astrology"); } catch (e) { dup = (e as Error).message; }
	if (!dup) throw new Error("两个日期 token 未报错");
	let badCity = "";
	try { buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "不存在的城市XYZ"], "astrology")); } catch (e) { badCity = (e as Error).message; }
	if (!badCity) throw new Error("未知城市 token 未报错（不得静默落 120°E）");
});
```

Run: `node scripts/purple-star.ts selftest 2>&1 | grep 解析引擎` → 全 ❌（旧引擎行为：取末值不报错 / 别名不存在 / 三连还在）。

- [ ] **Step 2: 重写 args.ts（底座 + 适配层）**

骨架（完整实现按本步契约展开，禁止留空）：

```ts
import { parseArgs as nodeParseArgs } from "node:util";

// OPTION_GROUPS 声明表：结构照旧（name/kind/value/desc），旗标→参数术语（§1.3）
// OPTION_ALIASES：拼音别名 → 英文主名（§1.1）
export const OPTION_ALIASES: Record<string, string> = {
	geju: "pattern", sihua: "mutagen", liunian: "yearly",
	liuyue: "monthly", daxian: "decadal", xiaoxian: "ages",
};

export function parseArgs(argv: string[], command?: string): CliArgs {
	const tokens = nodeParseArgs({ args: argv, strict: false, tokens: true }).tokens as Token[];
	// 单趟扫描 tokens：
	//  1) kind==="option"：名字先查 OPTION_ALIASES 归一，再查 OPTION_NAMES；未知→中文报错+suggestOption
	//  2) kind==="option" 且已出现过（按归一后主名判重）→报「参数重复给出」
	//  3) 声明表 kind==="value"：贪婪吃紧随 token（不论其形状，Review Focus 2）
	//  4) kind==="short"（如 -x）→报「本项目只有 --xxx 长参数形式」
	//  5) kind==="option-terminator"→其后全进 _
	//  6) 其余 positional：astrology 命令交给位置参数归类（形态识别），其他命令进 _
}
```

位置参数归类放 `birth-info.ts`：`classifyPositionals(tokens: string[]): Partial<CliArgs>`（§1.2 形态正则；产出 `date/time/gender/city` 四键，冲突与未知城市报错；`--` 后与 `parseArgs` 的 `_` 不参与归类）。`camelKey` 原样保留。

- [ ] **Step 3: 引导层解耦 cac + 最小 help**

`purple-star.ts` 去掉 cac `cli` 的消费（help 暂时输出 OPTION_GROUPS 平铺——Task 8 换强化版）；根 `package.json` 删 `cac`。全仓 `grep -rn "cac" scripts/ --include="*.ts"` 清零（注释里「cac 时代」的历史陈述改为「旧引擎」措辞）。

- [ ] **Step 4: 三连全绿 + Commit**

```bash
node scripts/purple-star.ts selftest 2>&1 | head -1 && npm test 2>&1 | grep 总计 && npm run typecheck && echo 绿
git add -A && git commit -m "refactor(cli): 解析引擎换 util.parseArgs tokens 底座 + 薄适配层（中文报错/别名/位置参数/贪婪取值/重复报错），cac 退役"
```

---

### Task 5: cli/ 按命令拆分 + cities 删除

**Files:**
- Create: `scripts/cli/{astrology,chart,topic,stars,classics,synastry}.ts`（cmdAnalyze 改名 cmdAstrology 留 Task 6；本任务先原样拆位）
- Rewrite: `scripts/cli/commands.ts`（只留 `COMMAND_TABLE` + `COMMAND_DESC`；cmdCities 删除）
- Delete: `cities` 命令实现（`ziwei/cities.ts` 数据表**保留**——`--city` 容错解析在用；`REQUIRED_EXPORTS` 去掉 `PROVINCES`）
- Test: selftest 命令面断言

**Interfaces:**
- Produces: 各命令文件导出 `cmdXxx(args: CliArgs, ctx: CliContext): string`；`COMMANDS: Record<string, Cmd | undefined>` 键集 = `astrology/chart/topic/classics/synastry/stars/selftest`。
- cities 删除后：调用 `cities --search 北京` → 「未知命令」且报错文案列出全部命令。

- [ ] **Step 1: 断言先行**（selftest）：`cities` 命令已删（`COMMANDS["cities"] === undefined`——读 commands.ts 源码文本断言 COMMAND_TABLE 无 cities 键，沿用现有「正则抽 COMMAND_TABLE」手法）；`stars --search 紫微` 仍产出释义。

- [ ] **Step 2: 拆分与删除**（git mv 意义上的文件级拆分；import 面按消费者更新；`COMMAND_DESC` 增 `astrology` 条目文案「排盘分析一条命令（概览默认 + 功能参数）」）。

- [ ] **Step 3: 三连全绿 + Commit**：`refactor(cli): 命令实现按文件拆分，cities 命令删除（数据表保留）`

---

### Task 6: astrology 命令融合（四命令合一）+ 输出调整

**Files:**
- Rewrite: `scripts/cli/astrology.ts`（融合 analyze/chart/topic；insight 从未落地，直接跳过中间态）
- Modify: `scripts/cli/commands.ts`（COMMAND_TABLE 删 chart/topic 条目——chart/topic 的功能成为 astrology 的 `--palaces`/`--topic`）、`scripts/cli/fortune.ts`（小节函数已在 Task 3 改名；本任务接参数名）、`scripts/cli/render.ts`
- Test: selftest 输出形态断言组 + 层 2 端到端全面更新

**Interfaces:**
- Produces: `astrology` 命令全参数面 = 出生信息（位置参数或旗标）+ `--info`（只出信息面板）+ `--pattern` + `--mutagen`（配 `--monthly`）+ `--yearly [年]` + `--monthly 1-12` + `--decadal [虚岁]` + `--ages [虚岁]` + `--focus <宫>`（四项深化）+ `--palaces` + `--topic <key>`/`--view` + `--json`。
- 默认输出（无功能参数）：总览三行 → 【基本信息】12 行面板（无条件）→ 口径提示 → 【运限速览】 → 功能参数指路。
- `--focus` 四项深化：三方四正逐宫全星曜（主星含亮度四化+吉+煞+杂曜）、对宫完整详表（renderPalace 同规格）、涉及此宫的格局全列（detectPatterns 过滤 palaces 含此宫）、该宫 ages 岁数段 + 当前 decadal 十年内此宫被 yearly 引动的年份 + 命主/身主星标注 + 身宫标记。
- 旧命令名 `analyze/chart/topic/insight/cities` 全部「未知命令」，报错文案列出可用命令并指路 astrology。

- [ ] **Step 1: 断言先行**（selftest 输出形态组，先红）：

```ts
ok("astrology：默认输出含基本信息面板与运限速览，无专题节", () => {
	const t = runCli(["astrology", "1990-5-15", "9:30", "男", "北京"]); // selftest 内以函数直调或子进程，沿用现有端到端手法
	for (const want of ["【命盘总览】", "【基本信息】", "子年斗君", "【运限速览】"]) if (!t.includes(want)) throw new Error(`缺 ${want}`);
	for (const gone of ["【格局识别】", "【生年四化】"]) if (t.includes(gone)) throw new Error(`默认不应出现 ${gone}`);
});
ok("astrology：--palaces 出十二宫逐宫详表（原 chart 职责）", () => { /* 断言 12 个宫名块与 renderPalace 形态 */ });
ok("astrology：--topic love 出主题论断（原 topic 职责）；--view 越界报错", () => { /* … */ });
ok("astrology：旧命令名已删且报错指路", () => {
	for (const old of ["analyze", "chart", "topic", "insight", "cities"]) {
		const out = runCli([old, "--date", "1990-05-15", "--time", "9:30", "--gender", "男"]);
		if (!out.includes("未知命令") || !out.includes("astrology")) throw new Error(`${old} 应报未知命令并指路 astrology`);
	}
});
ok("astrology：--focus 四项深化（全星曜/对宫详表/涉及格局/运限引动）", () => {
	const t = runCli(["astrology", "1990-5-15", "9:30", "男", "--focus", "命宫"]);
	for (const want of ["会照", "对宫", "格局", "小限"]) if (!t.includes(want)) throw new Error(`focus 深化缺 ${want}`);
});
```

- [ ] **Step 2: 实现**：cmdAstrology 组装（总览 + infoSection + 口径 + overviewSection 默认；功能参数分发 fortune.ts 各 Section / palaces 渲染 / getTopicAnalysis）；render.ts 补「三方四正逐宫全星曜」渲染helper（复用 starLine）。
- [ ] **Step 3: 三连 + 层 2 全量更新**（test/cli.test.ts 的 analyze/chart/topic 用例全部改 astrology 调用与新参数名；synastry 输入说明改 `astrology --json`）。
- [ ] **Step 4: Commit**：`feat(cli): 四条排盘命令融合为 astrology（英文功能参数 + focus 深化 + 默认概览含基本信息）`

---

### Task 7: synastry `--charts` + classics/stars 归位

**Files:**
- Modify: `scripts/cli/synastry.ts`（`--a-chart`/`--b-chart` → `--charts a.json,b.json`；恰好两份/可读/契约校验，同路径允许）、`scripts/classics/**`（无改动，仅回归）、`scripts/cli/stars.ts`
- Test: selftest 合盘段断言更新

**Interfaces:** `--charts` 值 = 逗号分隔恰好两个路径，甲先乙后；非两份报「应给两个文件路径（甲,乙）」；读文件/JSON 解析失败/不符 AnalyzeJson 契约报具体原因；`--a-chart` 成为未知参数。

- [ ] **Step 1: 断言先行**（合盘段）：`--charts a,b` 产出与旧 `--a-chart a --b-chart b` 同输出（用 makeFixture 双盘）；`--charts a`（一份）与 `--charts a,b,c`（三份）报错；`--a-chart` 未知参数。
- [ ] **Step 2: 实现 + 三连 + Commit**：`feat(synastry): 输入改 --charts 单参数（逗号分隔双盘），a-/b- 前缀退役`

---

### Task 8: help 强化——COMMAND_HELP + 归属表 + 每命令 --help

**Files:**
- Create: `scripts/cli/help.ts`
- Modify: `scripts/cli/commands.ts`（`COMMAND_HELP: Record<CommandName, string[]>`——每命令多行详细说明：功能/专属参数/典型示例/注意事项）、`scripts/cli/args.ts`（`OPTION_OWNERSHIP: Record<CommandName, readonly string[]>`——命令 → 专属参数名表，help 据此过滤）
- Test: selftest help 断言

**Interfaces:**
- `help`（总览）：逐命令一段（COMMAND_DESC 一行 + COMMAND_HELP 展开）+ 全参数段（OPTION_GROUPS 派生，拼音别名尾注）+ 口径警告两段（HELP_CAUTION 沿用）。
- `<命令> --help`：该命令的 COMMAND_HELP + 归属参数子集 + 示例。`--help` 本身进 OPTION_GROUPS（switch）。
- 归属表是 **help 视图**，不做硬校验（作用域仍 skill 级——spec §3.2 的「诚实边界收窄」只发生在 help 层）。

- [ ] **Step 1: 断言先行**：`help` 含每命令的示例行与「排盘四必问」提示；`astrology --help` 列出 `--pattern/--mutagen/--yearly/...` 且**不含** `--search`（归属过滤）；`stars --help` 反之。
- [ ] **Step 2: 实现 + 三连 + Commit**：`feat(cli): help 强化——逐命令详细说明与每命令 --help（命令→参数归属表）`

---

### Task 9: `--config` / `--template` 配置文件输入

**Files:**
- Create: `scripts/cli/config.ts`
- Modify: `scripts/cli/args.ts`（`--config <file>` / `--template` 进 OPTION_GROUPS 与 astrology 归属）、`scripts/cli/astrology.ts`（入口先 `applyConfig`）
- Test: selftest 配置断言

**Interfaces:**
- `applyConfig(argv: CliArgs): CliArgs`：读 JSON（键 = 参数 camelCase 主名，如 `date/time/city/gender/pattern/mutagen/yearly`），**命令行已给的键覆盖配置**（命令行优先）；配置内未知键/非法值与命令行同规则中文报错。
- `--template`：stdout 打印合法可跑的示例 JSON（含单人全参数与注释性 `_说明` 键——实现时 `_` 前缀键在 applyConfig 中跳过），用户 `--template > my.json` 落盘。
- 模板必须可被 `--config` 吃回并排出示例盘（断言闭环）。

- [ ] **Step 1: 断言先行**（Review Focus 无新增，但闭环断言必须）：写配置文件 → `--config` 应用 → 命令行同名键覆盖 → 排盘正确；`--template` 输出直接写盘后可 `--config` 使用。
- [ ] **Step 2: 实现 + 三连 + Commit**：`feat(cli): --config JSON 配置输入（命令行优先）与 --template 模板生成`

---

### Task 10: SKILL.md 重写 + references 同步

**Files:**
- Rewrite: `SKILL.md`（description 合并三域触发词：排盘解读/合盘合婚/古籍检索，删「用 xxx 技能」指路句；命令速查 `astrology/classics/synastry/stars/selftest`；路径约定「仓库根 = skill 根」；铁律/晚子时/体系约束章节保留）
- Modify: `references/workflow.md`（第 1 步 = astrology 位置参数形态与功能参数组合）、`references/flags.md` → 改名 `references/options.md`（参数面细则：英文主名表/拼音别名/位置参数形态/`--config`/`--charts`）、`references/output-contract.md`（五节契约不变，聚焦形态引 astrology `--focus`）、`references/troubleshooting.md`（路径更新）
- Test: 层 6 的「SKILL.md ↔ references 双向一致」「SKILL.md 提到的参数都有声明」「命令速查表命令都有实现」三组断言

- [ ] **Step 1: 重写 SKILL.md 与 references**（selftest 的参数扫描断言此刻会抓未声明参数——先写文档再核对声明表，红了补声明或改文档）。
- [ ] **Step 2: 三连全绿**（层 6 是重点）+ **Step 3: Commit**：`docs(skill): SKILL.md 重写为单 skill 形态，references 同步参数面与工作流`

---

### Task 11: 仓库级文档 + 备案 + 最终回归

**Files:**
- Rewrite: `CLAUDE.md`（目录树按新结构重画——`scripts/` 根、cli/ 逐文件；删「三个 skill」「另两个 skill 怎么加载」「派生关系」各节；守卫表更新；「参数面单点声明」改 OPTION_GROUPS 表述）、`README.md`（单 skill 介绍 + 安装需 `npm install` + 新命令示例）
- Modify: `docs/test/README.md`（备案区追加「三 skill 合一 + 命令融合 + 术语对齐」通告，报告正文不回改）
- Test: 全量最终回归

- [ ] **Step 1: 文档重写**；**Step 2: 最终回归**

```bash
node scripts/purple-star.ts selftest 2>&1 | head -1      # 三段合计全绿
npm test 2>&1 | grep 总计                                 # 全绿
npm run typecheck && echo typecheck 绿
node scripts/purple-star.ts help | head -20               # 强化 help 实貌
node scripts/purple-star.ts astrology 1990-5-15 9:30 男 北京 --pattern --mutagen | head -30  # 端到端抽查
npx tsx tools/bench/startup.ts 2>&1 | tail -2             # tools 实跑
```

- [ ] **Step 3: Commit**：`docs: 仓库级文档同步单 skill 形态与测试备案`

---

## Self-Review 记录

- **Spec 覆盖**：§1（astrology 融合/别名/输入简化）→ Task 4/6；§2.1–2.6（重组/搬入/selftest 合并）→ Task 1/2；§2.7–2.10（文件名/术语/引擎/迁移清单）→ Task 3/4 与 Task 1 Step 2；§3（命令面/help/config）→ Task 5–9；§4（SKILL.md）→ Task 10；§5（测试）→ 各任务 TDD 步；§6（文档）→ Task 10/11；§7（风险：tools 实跑、同笔迁移）→ Global Constraints 与 Task 1。无缺口。
- **占位符**：无 TBD/「稍后实现」；Task 4 Step 2 的骨架注明「完整实现按契约展开，禁止留空」并以接口契约锚定。
- **类型一致**：`parseArgs(argv, command?)` 签名全程不变；`cmdXxx(args, ctx)` 统一；fortune.ts 小节函数名以 Task 3 改名后为准（Task 6 引用同名）。
- **Review Focus**：五条各钉在 Task 4（1/2/3）、Task 7（4）、Task 6/7（5）的断言步骤。
