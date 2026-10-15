# 架构深化 8 候选实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 `docs/reviews/architecture-review-20261011.md` 的全部 8 个架构深化候选，把分发协议、声明语义、组合层测试面、归属表、断言组 harness、口径提示 basis、性别过滤公开面、宫位查询收敛为更深的 module。

**Architecture:** 每个候选独立成任务，按依赖排序（分发 module → 断言组统一 → 声明语义 → 归属投影 → 组合层测试面 → basis → 公开面 → 宫位查询）。除任务显式声明的行为变更（T1 未知命令文案统一、T4 help 全局参数行）外，全部输出保持逐字节不变。

**Tech Stack:** TypeScript（Node ≥ 22.18 直跑，无构建）、iztro 2.6.1、自研 selftest 断言框架（`scripts/cli/selftest-kit.ts`）、node:test（`npm test`）。

**Spec:** `docs/reviews/architecture-review-20261011.md`（本计划的论证来源；执行者两份都读）。

## Global Constraints

- 行为不变优先：除 T1/T4 声明的输出变更外，`selftest` / `npm test` / `cli-samples` 输出 diff=0。
- 每任务验收三件套：`node scripts/purple-star.ts selftest`、`npm test`、`npm run typecheck`——退出码直接取命令本身，**不得接管道**（历史坑：`| tail` 后 `$?` 是 tail 的）。
- `typecheck` 必须 0 错误；**禁用 `any` / `@ts-ignore` 绕过报错**。
- 引导层铁律：`purple-star.ts` 除 `node:` 内置与 `./boot-hooks.ts` 外禁止任何普通静态 import（值一律走 `load<T>()` 动态导入）。
- `cli/` 单向依赖无环；`args-table.ts` 保持零依赖纯数据（新增派生常量允许，新 import 不允许）。
- 绊线字段 `Palace.selfMutagen` 不得填回；宫干自化 / 来因宫继续禁用。
- 中文报错文案口径不变（`错误：` 前缀、最近邻指路、含原因的中文提示）。
- 计数类事实不写死：selftest 项数由首行自报；新增断言后检查 `runDocConsistency` 等对拍断言是否需要同步。
- 工作区已有大量未提交修改：每任务只用 `git diff -- <本任务文件>` 核对本任务改动，不把既有修改算进验收。
- **不执行 git commit**（提交策略由用户另行确认）。

## Review Focus

以下五类失败最可能咬人，每条在归属任务里有对应测试：

1. **help / 文案输出变更的连环对拍**——`selftest` 的 `runHelpPrune` / `runHelpEnrich` / `runDocConsistency`、`test/cli.test.ts` 的 help 断言、`references/options.md` 都可能钉住被 T1/T4 改动的文本。预期：这些断言**红**，修断言与文档同步，不回退设计。（T1、T4）
2. **cli-samples 入库样例过期**——help 文案一变，`tools/cli-samples.ts` 生成的样例 Markdown 就与实跑不一致。T4 后必须重跑生成器并核对 diff 只含预期文案变化。（T4）
3. **脏工作区归因错误**——`git status` 已有几十个 M/D 文件。验收只看本任务文件的 diff；跑基线前用 `mktemp -d` 存快照（**不要**重定向到已存在文件，会被 noclobber 整条拒绝）。（全部）
4. **typecheck 假绿**——退出码被管道吃掉、或用 `any` 压制。T0 修复后 `npm run typecheck` 必须单独跑并看到 exit 0。（T0 及全部）
5. **`"analyze"` 退役命令名的假绿**——`selftest/args.ts` 6 处、`commands.ts` / `guard.ts` 各处需逐处核语境改 `"astrology"`；改名后作用域收窄探针必须**仍然拒绝** `--a-chart`（在 astrology 命令上），否则等于把探针改空。（T5）

---

### Task 0: 基线修复——corpus manual 生成模板的断线 import

**Files:**

- Modify: `tools/db/export-manual.ts:561`（生成模板里的 `from "../data"`）
- Modify: `scripts/corpus/data/manual/index.ts:9`（由生成器重写，不手改）

**Interfaces:**

- Consumes: `TopicKey` 类型（实际定义在 `scripts/analysis/data.ts`，见 `export-manual.ts:29` 的自用 import）
- Produces: `npm run typecheck` 退出码 0（本任务后其余任务的公共前提）

背景：`scripts/corpus/data/manual/index.ts` 位于 `scripts/corpus/data/manual/`，模板写的 `../data` 解析到不存在的 `scripts/corpus/data/data`。`import type` 运行时被擦除所以运行不崩，但 tsc 报 TS2307。该文件是生成物（头注释「不要手改」），必须改生成器模板。

- [ ] **Step 1: 确认 TopicKey 定义位置**

Run: `grep -n "export type TopicKey\|type TopicKey" scripts/analysis/data.ts`
Expected: 命中（`export-manual.ts:29` 已从该模块 import，应一致）

- [ ] **Step 2: 改生成模板**

`tools/db/export-manual.ts:561` 的 `` `import type { TopicKey } from "../data";` `` 改为：

```ts
`import type { TopicKey } from "../../../ziwei/analysis/data";`,
```

- [ ] **Step 3: 重新生成手册数据**

Run: `npx tsx tools/db/export-manual.ts code`
Expected: 正常退出

- [ ] **Step 4: 核对 diff 只含预期变更**

Run: `git diff --stat -- scripts/corpus/data/manual/ tools/db/export-manual.ts`
Expected: `tools/db/export-manual.ts` 模板一行 + `scripts/corpus/data/manual/index.ts` import 行；**若出现其他生成文件的无关 diff**，`git checkout -- scripts/corpus/data/manual/` 回退后改为手改两处（模板 + `index.ts:9` 同步改成同一路径），使生成物与模板一致。

- [ ] **Step 5: typecheck 验证（退出码直接取）**

Run: `npm run typecheck; echo exit=$?`
Expected: `exit=0`，无 TS 错误输出

---

### Task 1: 分发协议收成一个 module（候选 1）

**Files:**

- Create: `scripts/cli/dispatch.ts`
- Modify: `scripts/purple-star.ts:271-327`（main 改调 dispatch）
- Modify: `scripts/cli/selftest.ts:97-107`（call 的未知命令文案改用共享函数）
- Modify: `tools/cli-samples.ts:962`（未知命令文案改用共享函数）
- Modify: `test/cli.test.ts:109`（进程内未知命令文案改用共享函数）
- Test: `scripts/cli/selftest/guard.ts`（新增 async 组 `runDispatchProbe`）

**Interfaces:**

- Consumes: `CliContext`（`@/cli/args` 类型）、`load<T>` 引导层加载器（仅 purple-star 内）
- Produces（T2/T5 与后续任务依赖）:

```ts
// scripts/cli/dispatch.ts
export interface DispatchResult {
  code: number;        // 0 成功；1 命令抛错 / 未知命令
  out: string;         // 成功路径的渲染文本（或 help 文本）
  err: string;         // 失败路径文案（已带语义，宿主直接打印）
  outFile?: string;    // args.out 存在时的落盘路径（dispatch 不写盘，副作用归宿主）
}
/** 旧命令迁移提示行（stars / oracle / classics），无匹配返回空串 */
export function unknownCommandMerged(cmd: string): string;
/** 未知命令完整文案（唯一真相源）：可用列表 + 迁移提示 + help 指路 */
export function unknownCommandMessage(cmd: string, available: readonly string[]): string;
/** 全链分发：help 拦截 → 查表 → parseArgs → 执行 → out 记录 → 错误包装 */
export async function dispatch(
  argv: string[],
  ports: DispatchPorts
): Promise<DispatchResult>;
export interface DispatchPorts {
  argv: string[];
  ctx: { root: string; rootLabel: string };
  loadCore: () => Promise<{
    COMMANDS: Record<string, (args: unknown, ctx: unknown) => string | Promise<string>>;
    parseArgs: (argv: string[], cmd: string) => Record<string, unknown>;
  }>;
  loadHelp: () => Promise<{
    renderOverviewHelp: () => string;
    renderCommandHelp: (cmd: string) => string;
    commandNames: readonly string[];
  }>;
}
```

说明：`dispatch` **不写盘、不 print、不 exit**——副作用全部归宿主（purple-star main）。这样进程内测试（selftest）与子进程真链路（guard 冒烟）消费同一 seam。

- [ ] **Step 1: 写失败测试（guard.ts 新增 async 组）**

在 `scripts/cli/selftest/guard.ts` 文件末尾新增导出组（组内先 `await` 跑 dispatch，再同步断言——`createHarness` 的 `ok` 是同步的，rejected Promise 不会被它捕获）：

```ts
/** 分发 module 的进程内探针（候选 1）：未知命令文案与 help 拦截经同一 seam 可达。 */
export async function runDispatchProbe(deps: SelftestDeps): Promise<void> {
	const { dispatch, unknownCommandMessage } = await import("../dispatch");
	const NAMES = ["astrology", "knowledge", "synastry", "selftest", "help"] as const;
	const ports = {
		argv: [] as string[],
		ctx: deps.ctx,
		loadCore: async () => ({ COMMANDS: {}, parseArgs: (() => ({})) as never }),
		loadHelp: async () => ({
			renderOverviewHelp: () => "OVERVIEW",
			renderCommandHelp: () => "CMDHELP",
			commandNames: [...NAMES],
		}),
	};
	// ① 未知命令：code=1，且 err 必须 === 共享文案函数对同一列表的产出（同源断言）
	const unknown = await dispatch(["bogus"], ports);
	deps.ok("分发：未知命令 code=1 且文案出自共享函数", () => {
		if (unknown.code !== 1) throw new Error(`code 应为 1，实得 ${unknown.code}`);
		if (unknown.err !== unknownCommandMessage("bogus", NAMES))
			throw new Error(`文案不同源：${unknown.err}`);
	});
	// ② help 拦截先于查表与 loadCore：桩的 COMMANDS 为空也能拿到 CMDHELP
	const help = await dispatch(["astrology", "--help"], ports);
	deps.ok("分发：--help 拦截在查表之前返回 code=0", () => {
		if (help.code !== 0 || help.out !== "CMDHELP")
			throw new Error(`实得 code=${help.code} out=${help.out}`);
	});
}
```

在 `scripts/cli/selftest.ts` 的组清单（112–138 行）`runSmoke(deps);` 附近加一行：

```ts
await runDispatchProbe(deps);
```

并从 `./selftest/guard` import 该函数（与同文件其他 run* 同一 import 语句）。

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | head -5; echo exit=$?`
Expected: 失败（`../dispatch` 模块不存在，断言红或加载报错）

- [ ] **Step 3: 实现 `scripts/cli/dispatch.ts`**

内容三部分（逻辑从 `purple-star.ts:271-327` 平移，文案从 `purple-star.ts:294-307` 提炼）：

```ts
/**
 * dispatch.ts —— argv → { code, out, err, outFile } 的分发协议（候选 1）。
 *
 * 唯一真相源：未知命令文案、--help 拦截位置、错误前缀、参数解析→执行次序。
 * 本模块不写盘、不 print、不 exit：副作用归宿主（purple-star main），
 * 进程内测试与子进程真链路消费同一 seam。
 */
import type { CliContext } from "./args";

export interface DispatchPorts { /* 如 Interfaces 块 */ }
export interface DispatchResult { code: number; out: string; err: string; outFile?: string; }

export function unknownCommandMerged(cmd: string): string {
	if (cmd === "stars")
		return "—— 星曜释义已并入：knowledge --source stars --search <星名>";
	if (cmd === "oracle")
		return "—— 断语手册已并入：knowledge --source oracle --topic <主题> [--star <星名>]";
	if (cmd === "classics")
		return "—— 本命令原名 classics，已改名：knowledge --search <词>（古籍用法逐字不变）";
	return "";
}

export function unknownCommandMessage(cmd: string, available: readonly string[]): string {
	const merged = unknownCommandMerged(cmd);
	return `未知命令「${cmd}」。可用：${available.join(" / ")}${merged ? "\n" + merged : ""}\n运行 help 查看完整用法。`;
}

export async function dispatch(argv: string[], ports: DispatchPorts): Promise<DispatchResult> {
	const cmd = argv[0];
	// ① --help 拦截：任何位置的 --help/-h 都是「想要用法」，先于查表与 parseArgs
	if (cmd && cmd !== "help" && (argv.includes("--help") || argv.includes("-h"))) {
		const help = await ports.loadHelp();
		if (help.commandNames.includes(cmd)) return { code: 0, out: help.renderCommandHelp(cmd), err: "" };
	}
	if (!cmd || cmd === "help" || argv.includes("--help") || argv.includes("-h")) {
		const help = await ports.loadHelp();
		return { code: 0, out: help.renderOverviewHelp(), err: "" };
	}
	// ② 真正执行：此刻才加载内核（启动自检在 loadCore 内）
	const { COMMANDS, parseArgs } = await ports.loadCore();
	const fn = COMMANDS[cmd];
	if (!fn) return { code: 1, out: "", err: unknownCommandMessage(cmd, Object.keys(COMMANDS)) };
	try {
		const args = parseArgs(argv.slice(1), cmd);
		const out = await fn(args, ports.ctx);
		const outFile = typeof (args as { out?: unknown }).out === "string" && (args as { out?: string }).out !== ""
			? (args as { out: string }).out : undefined;
		return { code: 0, out: String(out), err: "", outFile };
	} catch (err) {
		return { code: 1, out: "", err: `错误：${(err as Error).message}` };
	}
}
```

（类型按实际 `COMMANDS` / `parseArgs` 签名收窄，不写 `any`。）

- [ ] **Step 4: purple-star main 改调 dispatch**

`purple-star.ts` 的 `main()` 改为：组装 `ports`（`loadCore` 照旧；`loadHelp` = 现 276–290 行两段轻加载合成一个 async 函数），`await dispatch(argv, ports)` 后按结果执行副作用：

```ts
const result = await dispatch(process.argv.slice(2), { ctx: { root: ROOT, rootLabel: ROOT_LABEL }, loadCore, loadHelp });
if (result.code !== 0) { console.error(result.err); process.exit(result.code); }
if (result.outFile) {
  const { writeOutFile } = await load<OutModule>("@/cli/out");
  writeOutFile(result.outFile, result.out);
  console.error(`已写入 ${result.outFile}`);
} else console.log(result.out);
```

`purple-star.ts` 顶部经 `load<typeof import("@/cli/dispatch")>("@/cli/dispatch")` 动态取 `dispatch`（引导层铁律：不许静态 import）。JSDoc 中「main 的四件事」描述同步更新为「经 dispatch 分发」。

- [ ] **Step 5: 三处进程内文案点改用共享函数**

- `scripts/cli/selftest.ts:104`：`err: unknownCommandMessage(cmd, commandNames)`
- `tools/cli-samples.ts:962`：`stderr = unknownCommandMessage(cmd, Object.keys(COMMANDS))`
- `test/cli.test.ts:109`：`throw asCliFailure(unknownCommandMessage(sub, Object.keys(commandsMod.COMMANDS)))`（import 自 `@/cli/dispatch`，test/ 有解析钩子）
- `scripts/corpus/selftest-asserts.ts:57` 与 `scripts/synastry/selftest-asserts.ts:158` 的裸句**本任务不动**（T2 将整体删除这两个本地 call）。

- [ ] **Step 6: 跑测试确认通过**

Run: `node scripts/purple-star.ts selftest`
Expected: 全绿（新增 2 条分发断言，首行项数比基线 +2）

- [ ] **Step 7: 全量验收**

Run: `npm test` 与 `npm run typecheck`（各自单独跑取退出码）
Expected: `npm test` 549+ 全绿；typecheck exit=0
Expected（行为变更面）: `node scripts/purple-star.ts bogus` 输出含可用命令列表与迁移提示行；`node scripts/purple-star.ts classics --help` 等旧命令 help 路径不回归

---

### Task 2: 断言组 interface 统一——corpus / synastry 接进 deps 注入（候选 5）

**Files:**

- Modify: `scripts/corpus/selftest-asserts.ts:40-61`（删本地 run/call/ctx 手搓）
- Modify: `scripts/synastry/selftest-asserts.ts:148-163`（同）
- Modify: `scripts/cli/selftest.ts:141-142`（传 deps）
- Modify: `scripts/cli/selftest-kit.ts`（补 `AssertGroup` 类型别名，可选）

**Interfaces:**

- Consumes: T1 的 `SelftestDeps`（`ctx` / `call` / `runCli` / `commandNames` / `ok`）
- Produces: `corpusAsserts(deps: SelftestDeps): Promise<Assertion[]>`、`synastryAsserts(deps: SelftestDeps): Promise<Assertion[]>`（主 selftest 与未来调用方依赖的新签名）

现状：两组各自手搓 `call`（含 `未知命令` 裸句文案）、`run`（spawnSync 拷贝）、`ctx: { root: resolve(ROOT, ".."), rootLabel: "技能自带内核" }`（设 `ZIWEI_ROOT` 时标签撒谎）。

- [ ] **Step 1: 存基线快照**

Run: `d=$(mktemp -d) && node scripts/purple-star.ts selftest > "$d/before.txt" && echo "$d"`
Expected: 记下输出目录（**不要**重定向到已存在文件）

- [ ] **Step 2: 改 corpus 断言组签名**

`corpusAsserts()` → `corpusAsserts(deps: SelftestDeps)`：删除本地 `run` / `call` 闭包与 ctx 手搓，断言体内改用 `deps.runCli` / `deps.call` / `deps.ctx`；`import type { SelftestDeps } from "../cli/selftest-kit"`（`../cli/selftest-kit` 路径按实际相对位置）。`createHarness` / `eq` 照旧从 kit import。`commandNames` 需要处用 `deps.commandNames`。

- [ ] **Step 3: 同法改 synastry 断言组**

同 Step 2；注意 synastry 组的临时目录 / 子进程 fixture 逻辑不动（只换 call/run/ctx 的来源）。

- [ ] **Step 4: 主 selftest 传入 deps**

`scripts/cli/selftest.ts:141-142` 改为：

```ts
const classics = await classicAsserts(deps);
const synastry = await synastryAsserts(deps);
```

- [ ] **Step 5: 跑 selftest 与基线 diff（本任务零断言增减，必须逐字节一致）**

Run: `node scripts/purple-star.ts selftest > <新临时文件> && diff <before> <after>`
Expected: diff 为空（项数、每条断言名与 detail 完全一致）

- [ ] **Step 6: 全量验收**

Run: `npm test`、`npm run typecheck`（单独取退出码）
Expected: 全绿、exit=0

---

### Task 3: 独占分支与专题语义收成一张声明（候选 2）

**Files:**

- Modify: `scripts/cli/args-table.ts`（`OptionGroup` 加 `role`、`OptionSpec` 加语义标志、新增四个派生常量与 `EXCLUSIVE_PRIORITY_LABEL`）
- Modify: `scripts/cli/astrology.ts:279-311`（删三处字符串反推）、`:585-591`（删硬编码 deepDive）、`:358`、`:442`（优先级链引常量）
- Modify: `scripts/cli/command-meta.ts:36`、`scripts/cli/selftest/guard.ts:155`（同上）
- Test: `scripts/cli/selftest/commands.ts`（`runDeclarationTable` 组加派生等价断言）

**Interfaces:**

- Consumes: `OPTION_GROUPS` / `camelKey`（args-table 现有）
- Produces（T4 依赖）:

```ts
// args-table.ts 新增导出
export type GroupRole = "birth" | "topic-deep" | "output-select" | "other";
// OptionGroup 增加: role: GroupRole
// OptionSpec 增加: shadow?: true; noShadow?: true; deep?: true; noIntent?: true
export const SHADOWABLE_KEYS: ReadonlySet<string>;   // kebab 原名（与现 SHADOWABLE 同域）
export const BIRTH_KEYS: readonly string[];          // camelCase（与现同域）
export const INTENT_KEYS: readonly string[];         // camelCase（与现同域）
export const DEEP_DIVE_KEYS: readonly string[];      // camelCase，值 = pattern/mutagen/yearly/decadal/ages/focus
export const EXCLUSIVE_PRIORITY_LABEL: string;       // "--palaces > --topic > --report > 其他功能参数"
```

- [ ] **Step 1: 快照现状三个集合（写进断言的期望值）**

Run: `node --input-type=module -e "process.env.NODE_OPTIONS=''; const {execSync}=await import('node:child_process');" 2>/dev/null; node scripts/purple-star.ts selftest >/dev/null 2>&1; npx tsx -e "import {OPTION_GROUPS} from './scripts/cli/args-table.ts'; const camel=(n)=>n.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); const S=new Set(OPTION_GROUPS.flatMap(g=>g.title.startsWith('专题深入')?g.options.map(o=>o.name).filter(n=>n!=='palaces'):g.title==='输出与选题'?g.options.filter(o=>['yearly','monthly','focus','topic','report'].includes(o.name)).map(o=>o.name):[])); const B=OPTION_GROUPS.flatMap(g=>g.title.startsWith('出生')?g.options.map(o=>camel(o.name)):[]); const I=OPTION_GROUPS.flatMap(g=>g.title.startsWith('专题深入')||g.title==='输出与选题'?g.options.map(o=>camel(o.name)).filter(k=>k!=='info'&&k!=='config'):[]); console.log(JSON.stringify({S:[...S].sort(),B:B.sort(),I:I.sort()},null,0))"`
Expected: 打印三个集合的 JSON 快照——**原样保存**，Step 3 的断言期望值用它

- [ ] **Step 2: 写失败测试（runDeclarationTable 组加断言）**

```ts
ok("声明表：语义角色派生与原字符串反推等价（候选 2）", async () => {
	const t = await import("../args-table");
	// 期望值 = Step 1 快照，原样粘贴
	const snap = { S: [/* 快照 S */], B: [/* 快照 B */], I: [/* 快照 I */] };
	eq([...t.SHADOWABLE_KEYS].sort(), snap.S, "SHADOWABLE 等价 ");
	eq([...t.BIRTH_KEYS].sort(), snap.B, "BIRTH 等价 ");
	eq([...t.INTENT_KEYS].sort(), snap.I, "INTENT 等价 ");
	eq([...t.DEEP_DIVE_KEYS].sort(), ["ages","decadal","focus","mutagen","pattern","yearly"], "DEEP 等价 ");
	eq(t.EXCLUSIVE_PRIORITY_LABEL, "--palaces > --topic > --report > 其他功能参数", "优先级链 ");
	if (OPTION_GROUPS.some(g => !g.role)) throw new Error("存在未标 role 的选项组");
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep -A2 "候选 2"`
Expected: 红（导出不存在）

- [ ] **Step 4: 实现 args-table 的角色与派生**

- `OptionGroup` 加 `role: GroupRole`；给 `OPTION_GROUPS` 每组标 role（出生日期/出生时辰/其他出生信息 → `"birth"`；专题深入 → `"topic-deep"`；输出与选题 → `"output-select"`；其余 → `"other"`）。
- `OptionSpec` 加四个可选标志；标 `deep: true` 的六个参数（pattern / mutagen / yearly / decadal / ages / focus）、`noShadow: true`（palaces）、`shadow: true`（输出组的 yearly / monthly / focus / topic / report）、`noIntent: true`（info / config）。
- 文件尾部实现派生（逻辑**逐字**对应现 `astrology.ts:279-311` 与 `585-591`，含 kebab/camel 两域区分）：

```ts
export const SHADOWABLE_KEYS: ReadonlySet<string> = new Set(
	OPTION_GROUPS.flatMap(g =>
		g.role === "topic-deep"
			? g.options.filter(o => o.name !== "palaces").map(o => o.name)
			: g.role === "output-select"
				? g.options.filter(o => o.shadow === true).map(o => o.name)
				: []
	)
);
export const BIRTH_KEYS = OPTION_GROUPS.filter(g => g.role === "birth").flatMap(g => g.options.map(o => camelKey(o.name)));
export const INTENT_KEYS = OPTION_GROUPS.filter(g => g.role === "topic-deep" || g.role === "output-select").flatMap(g =>
	g.options.map(o => camelKey(o.name)).filter((k, i, a) => g.options[i] && g.options[i].noIntent !== true)
);
export const DEEP_DIVE_KEYS: readonly string[] = OPTION_GROUPS.flatMap(g => g.options.filter(o => o.deep === true).map(o => camelKey(o.name)));
export const EXCLUSIVE_PRIORITY_LABEL = "--palaces > --topic > --report > 其他功能参数";
```

（`INTENT_KEYS` 的过滤按 index 对齐 options——实现时用 `flatMap(g => g.options.filter(o => o.noIntent !== true).map(o => camelKey(o.name)))` 更直接，以现语义为准：刨去 info 与 config。）

- [ ] **Step 5: astrology 与文案点改引派生**

- `astrology.ts`：删本地 `SHADOWABLE` / `BIRTH_KEYS` / `INTENT_KEYS`，从 `@/cli/args-table` import 同名导出；`deepDive` 改 `DEEP_DIVE_KEYS.some(k => (args as Record<string, unknown>)[k] !== undefined)`。
- `astrology.ts:358`、`:442`、`command-meta.ts:36`、`guard.ts:155` 的优先级链字面量改引 `EXCLUSIVE_PRIORITY_LABEL`（文案拼接结果逐字不变）。

- [ ] **Step 6: 跑 selftest 确认全绿**

Run: `node scripts/purple-star.ts selftest`
Expected: 全绿（含 Step 2 新断言；既有输出形态断言零变化）

- [ ] **Step 7: 全量验收**

Run: `npm test`、`npm run typecheck`（单独取退出码）
Expected: 549+ 全绿、exit=0（派生等价 → 帮助与演示输出零变化）

---

### Task 4: 归属表从转录改为投影（候选 4）

**Files:**

- Modify: `scripts/cli/args-table.ts`（`OptionSpec` 加 `cmds` / `global`；新增 `ownedOptions` / `GLOBAL_OPTIONS`）
- Modify: `scripts/cli/help.ts:26-62`（删手抄 `OPTION_OWNERSHIP`）、`:248` 附近（改投影调用 + OPTIONS 节尾全局行）
- Modify: `scripts/cli/selftest/commands.ts:619-631`（负向抽查按新语义更新 + 新正向断言）
- Regenerate: `tools/cli-samples.ts` 产物（help 样例）
- Sync: `references/options.md`、`SKILL.md` 中 `--out` 归属表述（grep 核对）

**Interfaces:**

- Consumes: Task 3 后的 `args-table.ts`（同文件追加）
- Produces:

```ts
// args-table.ts 新增
export function ownedOptions(cmd: CommandName): readonly string[];  // 投影：cmds 含该命令的 kebab 名
export const GLOBAL_OPTIONS: readonly string[];                      // ["out"]
```

**行为变更声明**：help 的每命令 OPTIONS 节尾新增一行全局参数说明；`--out` 从 astrology 专属列表移入全局（`--config` / `--template` 保持仅 astrology——它们确实只被 `cmdAstrology` 读取）。

- [ ] **Step 1: 写失败测试（正向断言）**

`runDeclarationTable` 组新增：

```ts
ok("归属：OPTION_OWNERSHIP 从声明投影而非手抄（候选 4）", async () => {
	const t = await import("../args-table");
	if (!t.GLOBAL_OPTIONS.includes("out")) throw new Error("--out 应为全局参数");
	if (!t.ownedOptions("knowledge").includes("search")) throw new Error("knowledge 应含 --search");
	if (!t.ownedOptions("synastry").includes("charts")) throw new Error("synastry 应含 --charts");
	if (t.ownedOptions("selftest").length !== 0) throw new Error("selftest 无专属参数");
	if (!t.ownedOptions("astrology").includes("config")) throw new Error("astrology 应含 --config");
	// help 消费同一投影：renderCommandHelp 不再持有第二张表
	const help = await import("../help");
	if ("OPTION_OWNERSHIP" in help) throw new Error("help.ts 仍手抄归属表");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep "候选 4"`
Expected: 红

- [ ] **Step 3: 声明表承载归属**

`OptionSpec` 加 `cmds?: readonly string[]`（kebab 命令名列表）与 `global?: true`。逐 option 标注：现手抄 `OPTION_OWNERSHIP`（help.ts:26-62）四组内容平移——astrology 31 项、knowledge 6 项、synastry 2 项；`out` 标 `global: true` 且**从** astrology 列表移除；`config` / `template` 标 `cmds: ["astrology"]`。文件尾：

```ts
const GLOBAL_OPTIONS: readonly string[] = OPTION_GROUPS.flatMap(g => g.options).filter(o => o.global === true).map(o => o.name);
export function ownedOptions(cmd: string): readonly string[] {
	return OPTION_GROUPS.flatMap(g => g.options).filter(o => o.global !== true && (o.cmds ?? []).includes(cmd)).map(o => o.name);
}
```

- [ ] **Step 4: help.ts 改投影 + 全局行**

- 删 `OPTION_OWNERSHIP` 定义；`renderCommandHelp` 的 `new Set(OPTION_OWNERSHIP[cmd])` 改 `new Set(ownedOptions(cmd))`。
- OPTIONS 节渲染完后追加（man 风格两空格缩进，具体拼接对齐现排版）：

```ts
lines.push(`  · 全局：${GLOBAL_OPTIONS.map(o => `--${o} <路径>`).join(" ")} —— 任意命令可用（输出落盘）`);
```

- [ ] **Step 5: 更新钉住旧归属/help 文本的断言与文档**

- `selftest/commands.ts:619-631` 负向抽查：按新语义改（原断言若钉「--out 只在 astrology」则改为「--out 在 GLOBAL_OPTIONS 而不在任何 ownedOptions」）。
- 跑 selftest，逐条处理 `runHelpPrune` / `runHelpEnrich` / `runDocConsistency` 的红（改断言与 `references/options.md` / `SKILL.md` 中 `--out` 归属表述，使其与新 help 一致——**这是 Review Focus #1 的预期动作**）。
- `test/cli.test.ts` 中 help 相关断言同核。

- [ ] **Step 6: 重跑 cli-samples 并核对 diff**

Run: `npx tsx tools/cli-samples.ts`（带其现有输出参数；先读文件头确认用法）
Expected: 生成器全绿；`git diff` 样例文件的变更**只**含 `--out` 归属行与新增全局行（Review Focus #2）

- [ ] **Step 7: 全量验收**

Run: `node scripts/purple-star.ts selftest`、`npm test`、`npm run typecheck`（单独取退出码）
Expected: 全绿、exit=0

---

### Task 5: 专题旗标 → section 接线的端到端测试面 + analyze 假绿修复（候选 3）

**Files:**

- Modify: `scripts/cli/selftest/args.ts`（6 处 `"analyze"` → `"astrology"`）
- Modify: `scripts/cli/selftest/commands.ts`（grep `"analyze"` 逐处核；`runAstrologyShapes` 组加组合层端到端断言）
- Modify: `scripts/cli/selftest/guard.ts`（grep `"analyze"` 逐处核）
- Test: 同上（本任务基本不改生产代码——组合层的「interface 即测试面」经既有 `deps.call` 达成，缺的是断言）

**Interfaces:**

- Consumes: `SelftestDeps.call`（进程内直调 `cmdAstrology` 全链，含 parseArgs → 组合层 → section 接线）
- Produces: 组合层回归保护（`--decadal` / `--ages` 端到端用例从 0 到有；守卫链三条报错进程内可测）

- [ ] **Step 1: 修 analyze 假绿**

`grep -n '"analyze"' scripts/cli/selftest/args.ts scripts/cli/selftest/commands.ts scripts/cli/selftest/guard.ts`，逐处改 `"astrology"`。语境注意：`args.ts` 的作用域收窄探针注释（「叠在 analyze 上必须报错」）同步改为 astrology。

- [ ] **Step 2: 跑 args / commands / guard 组确认语义未空转**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep -E "作用域|旗标|假绿|❌"`
Expected: 全绿——尤其「`--a-chart` 在 astrology 上未报错」的探针必须仍通过（若红，说明旧断言测的从来不是真实命令面：修 `parseArgs` 的作用域逻辑使 astrology 拒绝 `--a-chart`，而非回退命令名）
预期（读实文案）: 同时裸跑 `node scripts/purple-star.ts astrology --date 1990-05-15 --branch 5 --gender male --decadal 37 | head -40` 与 `--ages 45`、`--pattern`、`--monthly 6`（无 --mutagen）各一次，**记下实际节标题与报错文案**供 Step 3 钉断言。

- [ ] **Step 3: 写组合层端到端断言（runAstrologyShapes 组新增）**

文案取自 Step 2 实跑（下面占位以实际输出为准）：

```ts
const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
ok("组合层：--decadal 端到端经 cmdAstrology 出大限节（候选 3）", () => {
	const r = deps.call(["astrology", ...base, "--decadal", "37"]);
	eq(r.code, 0, r.err);
	if (!r.out.includes(/* 实跑节标题 */)) throw new Error("缺大限节标题");
});
ok("组合层：--ages 端到端出小限节", () => {
	const r = deps.call(["astrology", ...base, "--ages", "45"]);
	eq(r.code, 0, r.err);
	if (!r.out.includes(/* 实跑节标题 */)) throw new Error("缺小限节标题");
});
ok("组合层：守卫链 --monthly 无 --mutagen 报错并指路", () => {
	const r = deps.call(["astrology", ...base, "--monthly", "6"]);
	eq(r.code, 1);
	if (!r.err.includes("需要 --mutagen")) throw new Error(`实得：${r.err}`);
});
ok("组合层：deepDive 门——给 --pattern 时不输出基底节", () => {
	const r = deps.call(["astrology", ...base, "--pattern"]);
	eq(r.code, 0, r.err);
	if (r.out.includes(/* 基底节标题，如「运限速览」实文案 */)) throw new Error("deepDive 门失效：深入形态仍输出基底");
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/purple-star.ts selftest`
Expected: 全绿（新增 4 条，首行项数 +4）

- [ ] **Step 5: 全量验收**

Run: `npm test`、`npm run typecheck`（单独取退出码）
Expected: 全绿、exit=0

---

### Task 6: 口径提示 basis 收成一处（候选 6）

**Files:**

- Modify: `scripts/cli/birth-info-defs.ts`（新增 `CaliberBasis` + `toBasis` + `clockOptsFromBasis`）
- Modify: `scripts/cli/render.ts:112`（`birthplaceSection` 收 basis）、`:309`（`lateZiSection` 收 basis）
- Modify: `scripts/cli/astrology.ts:399-400`（解构处改 `toBasis`）、`:450-451`、`:475-476`、`:579-580`、`:595-596`（调用点改收 basis）
- Modify: `scripts/cli/report.ts:95-102`（`buildReport` 的 basis 参数换 `CaliberBasis`）
- Modify: `scripts/cli/fortune.ts:181`（`InfoClockOpts` 保持，新增 `clockOptsFromBasis` 或调用点经它取）
- Modify: `scripts/cli/selftest/render.ts`（直调 `birthplaceSection` / `lateZiSection` 的断言若有，同步签名——grep）
- NOT modified: `buildAnalyzeJson` 的 JSON 输出键（synastry 消费方契约，冻结）、`chart-view.ts:229`

**Interfaces:**

- Consumes: `BirthInfoResult`（birth-info-defs 现有）
- Produces:

```ts
// birth-info-defs.ts 新增
export interface CaliberBasis {
	note: string; notes: readonly string[]; longitude: number;
	lngNote: string; lngAmbiguous: string[] | null;
	isLateZi: boolean; lateZiCandidate: boolean;
	/** args.time 折算的钟表时刻（非字符串给 null）——消灭两处逐字重复 */
	clockTime: string | null;
}
export function toBasis(r: BirthInfoResult, time: unknown): CaliberBasis;
export function clockOptsFromBasis(b: CaliberBasis): { clockTime: string | null; solarNote: string; longitude: number };
// render.ts 签名变更
export function birthplaceSection(basis: Pick<CaliberBasis, "lngNote" | "lngAmbiguous">): string[];
export function lateZiSection(chart: ZiweiChart, info: BirthInfo, basis: Pick<CaliberBasis, "isLateZi" | "lateZiCandidate">): string[];
// report.ts
buildReport(chart, info, basis: CaliberBasis): string
```

- [ ] **Step 1: 先 grep 全部调用点定迁移清单**

Run: `grep -rn "birthplaceSection\|lateZiSection\|InfoClockOpts\|clockTime" scripts/ test/ tools/ --include='*.ts' | grep -v node_modules`
Expected: 输出即迁移清单——逐行进 Step 3（含 `selftest/render.ts` 直调点、`fortune.ts` 内部）

- [ ] **Step 2: 实现 basis 类型与折算**

`birth-info-defs.ts` 加 `CaliberBasis` / `toBasis` / `clockOptsFromBasis`（如 Interfaces 块；`toBasis` 内做 `clockTime: typeof time === "string" ? time : null` 的单点折算）。

- [ ] **Step 3: 按迁移清单改签名与调用点**

- `render.birthplaceSection` / `lateZiSection` 收 basis（实现体不变，只换取参方式）。
- `astrology.ts`：`const basis = toBasis(buildBirthInfo(args), args.time)` 替代 8 局部变量解构；4 处成对调用改 `birthplaceSection(basis)` / `lateZiSection(chart, info, basis)`；两处 `infoSection(chart, { clockTime: …, solarNote: note, longitude })` 改 `infoSection(chart, clockOptsFromBasis(basis))`；`buildAnalyzeJson` 的 `basis: { note, notes, lateZiCandidate, isLateZi }` 改传 basis（结构子集，变量传参无 excess 检查）。
- `report.ts`：`buildReport` 第三参类型换 `CaliberBasis`，内部 `basis.lngNote` 等取参不变（字段同名）；调用点（grep 找）传 `toBasis` 产物。
- `fortune.infoSection` 的 `InfoClockOpts` 不改（保持 render 测试面稳定），调用点经 `clockOptsFromBasis`。

- [ ] **Step 4: typecheck 驱动收尾**

Run: `npm run typecheck; echo exit=$?`
Expected: exit=0——漏改的调用点会以参数类型错误暴露；逐一修（**不加 any**）

- [ ] **Step 5: 输出逐字节验收（纯重构零输出变）**

Run: `node scripts/purple-star.ts selftest`、`npm test`、`npx tsx tools/cli-samples.ts`（各自核对与改前一致）
Expected: 全绿且输出 diff=0（selftest 项数不增不减）

---

### Task 7: 性别过滤上 analysis 公开面（候选 7）

**Files:**

- Modify: `scripts/analysis/index.ts:135`（公开面 re-export 加 `filterGenderContent`，同步 130–134 注释中的名字清单）
- Test: `scripts/cli/selftest/render.ts`（`runTopicRender` 组加三条断言）

**Interfaces:**

- Consumes: `filterGenderContent`（`analysis/lookups.ts:28-78` 现实现，不改实现体）
- Produces: `analysis/index.ts` 公开面新增 `filterGenderContent(text: string, gender: "male" | "female"): string`（测试与外部消费方从公开面获得）

注意：`analysis/report.ts` 与 `analysis/index.ts` 互相引用会成环——**两个调用点保持 import `./lookups`**，公开面导出服务于「可从外部直测」；「拼接后整篇过滤」的结构约束由断言钉住（见 Step 3 的 C）。

- [ ] **Step 1: 公开面导出**

`analysis/index.ts:135` 改为 `export { TOPIC_LABEL, TOPIC_PALACE_NAME, getTopicReport, getTopicReportMeta, filterGenderContent };`（配合上方 `import { filterGenderContent } from "./lookups"` 或 `export { filterGenderContent } from "./lookups"`），并把注释里「5 个名字」的清点同步为实际数量。

- [ ] **Step 2: 写测试（runTopicRender 组新增三条）**

```ts
ok("性别过滤：male 的 getTopicAnalysis 不含女命残留（候选 7）", () => {
	const out = getTopicAnalysis(SAMPLE_CHART, "overview"); // SAMPLE_CHART 用该组既有 chart 构造
	if (out.includes("；女命") || out.includes("（女命）")) throw new Error("存在女命残留");
});
ok("性别过滤：filterGenderContent 三条规则直测", () => {
	const { filterGenderContent } = /* 经 @/ziwei/analysis 公开面 import */;
	const f = filterGenderContent("甲；女命宜静。乙\n（女命）丙\n女命主柔。", "male");
	if (f.includes("女命")) throw new Error(`规则未生效：${JSON.stringify(f)}`);
	const g = filterGenderContent("男命主刚。乙", "female");
	if (g.includes("男命")) throw new Error("female 侧未过滤男命句");
});
ok("性别过滤：整篇作用域——跨行子句在拼接后被删", () => {
	// 构造跨行输入：「；女命」子句横跨 \n，逐行过滤会漏、整篇过滤会删
	const input = "上句；女命\n下句继续。";
	const f = filterGenderContent(input, "male");
	if (f.includes("女命")) throw new Error("跨行子句残留——过滤未作用于整篇");
});
```

（`SAMPLE_CHART` 名称以 `selftest/render.ts` 现有构造为准；filterGenderContent 从 `@/ziwei/analysis` 公开面 import——**必须经公开面**，直插 lookups 即本断言失败的意义。）

- [ ] **Step 3: 跑测试确认通过并验收**

Run: `node scripts/purple-star.ts selftest`、`npm test`、`npm run typecheck`
Expected: 全绿、exit=0（新增 3 条，首行项数 +3；输出内容本身零变化）

---

### Task 8: 宫位查询实现收敛（候选 8）

**Files:**

- Modify: `scripts/palace-relations.ts`（扩充为按 branch 取宫的唯一实现：可缺省 + 必得两失败语义）
- Modify: `scripts/cli/render.ts:72-76`（`palaceAtBranch` 变薄壳，文案参数化保持逐字）
- Modify: `scripts/patterns/helpers.ts:101`（`getPalaceByBranch` 变薄壳）、`:148/:166/:180`（`getSurroundPalaces` / `isInSanFang` / `getDuiGong` 的偏移算术改调 palace-relations）
- NOT modified: 各导出面签名（19 个导出名与返回类型冻结——6 个 detector 零改动）；`analysis/palace-query.ts`（按宫名，另一条 seam）；`test/invariants.test.ts` 与 `test/tools/year-scan.ts`（独立预言机，palace-relations 头注释明令不单点化）

**Interfaces:**

- Consumes: `palace-relations.ts` 现有 3 个导出与偏移常量（实现前先读该文件头注释与现有算术）
- Produces:

```ts
// palace-relations.ts 新增（实现体 = 现 render.palaceAtBranch / helpers.getPalaceByBranch 的查表）
export function palaceAtBranch(chart: ZiweiChart, branch: number): Palace | undefined;
export function mustPalaceAtBranch(chart: ZiweiChart, branch: number, what: string): Palace; // 抛现 render 文案
```

- [ ] **Step 1: 写失败测试（同源断言，runChartInvariants 组 / chart.ts）**

```ts
ok("宫位查询：helpers 与 palace-relations 同源（候选 8）", () => {
	for (const p of SAMPLE_CHART.palaces) {
		const a = getPalaceByBranch(SAMPLE_CHART, p.branch);
		const b = palaceAtBranch(SAMPLE_CHART, p.branch);
		if (a !== b) throw new Error(`branch ${p.branch} 两实现不同源`);
	}
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/purple-star.ts selftest 2>&1 | grep "候选 8"`
Expected: 红（`palaceAtBranch` 未导出）

- [ ] **Step 3: 实现收敛**

- `palace-relations.ts` 加两个函数（查表逻辑从 render 平移；抛错文案用 `what` 参数拼出与现 `render.palaceAtBranch` 逐字相同的句子）。
- `render.palaceAtBranch` 改薄壳 `return mustPalaceAtBranch(chart, branch, what)`；`helpers.getPalaceByBranch` 改薄壳 `return palaceAtBranch(chart, branch)`。
- `getSurroundPalaces` / `isInSanFang` / `getDuiGong` 内部的 `+4 / +8 / +6` 偏移改调 palace-relations 的既有偏移函数（读现文件确认导出名；`render.surroundNames` 已走 `surroundBranches`——若 grep 显示三处已同源，此步收窄为只消 helpers 两处）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node scripts/purple-star.ts selftest`
Expected: 全绿（同源断言 +3 条循环或 1 条；首行项数按实现 +1）

- [ ] **Step 5: 全量验收（格局判定零行为差是硬标准）**

Run: `npm test`、`npm run typecheck`（单独取退出码）
Expected: 549+ 全绿（518,400 样本基准对拍经 detector → helpers → 新实现，任何算术漂移都会在这里红）、exit=0

---

## 任务依赖与顺序

```text
T0 基线 ─┬─→ T1 分发 module ─→ T2 断言组 deps 统一 ─→ T5 组合层断言
         ├─→ T3 声明语义 ─→ T4 归属投影（同文件追加）
         ├─→ T6 basis 收敛（独立）
         ├─→ T7 性别过滤公开面（独立）
         └─→ T8 宫位查询收敛（独立，风险最高，放最后）
```

T3 → T4 有文件依赖（同改 `args-table.ts`，先角色后归属避免冲突）；T1 → T2 → T5 是同一条测试链；其余可乱序。
