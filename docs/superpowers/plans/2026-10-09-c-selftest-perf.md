# 批次 C：selftest 性能（方案 A 续 + 方案 B）实施计划

> **For agentic workers:** 本计划按任务逐步执行，步骤用 checkbox 跟踪。实现 spec：`docs/specs/2026-10-09-review-fixes.md` 批次 C。

**Goal:** selftest 从约 75 秒降到约 10-15 秒（子进程调用点 30 → 保留 3 个冒烟）；`help` 从 3.3 秒降到约 0.1 秒（入口懒加载内核）。

**Architecture:** 两步：①三个断言组的子进程封装（runCli/run）改为进程内直调（`parseArgs` + `COMMANDS[cmd]` 直调，错误路径以 throw message 断言），仅保留 3 个真子进程冒烟守住「入口 → 解析 → 命令表 → 渲染 + 错误出口」链路；②新建轻量 `command-meta.ts`（命令名/描述/帮助文案，无命令实现依赖），`purple-star.ts` 把内核加载与启动自检包进惰性函数，help/未知命令路径不再拉起 iztro。

**Tech Stack:** TypeScript；`node:child_process.spawnSync` 仅剩冒烟用。

**Spec:** `docs/specs/2026-10-09-review-fixes.md`

## Global Constraints

- 断言语义与子进程版等价：输出关键词、报错文案逐字保留；改的只是执行载体。
- `purple-star.ts` 的 import 纪律不变：除 `node:` 与 `./boot-hooks.ts` 外不得出现任何普通静态 import（selftest:725 有断言盯 boot-hooks，本批不动它）。
- 改 `scripts/` 源码用 Edit/Write 工具提交（Mimosa 钩子拦截 Bash 直写）。
- 启动导出自检仅在真正加载内核时执行（help 不排盘，不触发）。

## Review Focus

- 直调错误路径测不到「引导层 catch → stderr 前缀『错误：』+ exit 1」——必须由保留的错误路径冒烟覆盖。
- 方案 B 后 `astrology` 等排盘命令的启动自检时机后移，不得漏（内核重构导致导出缺失仍要在排盘前报错）。
- 30 个调用点计数（主 selftest 17 / classics 2 / synastry 11）以 `grep -c "runCli(\[\|run(\["` 实测为准，改造后冒烟 ≤ 3。

---

### Task 1：selftest-kit 增加进程内直调 helper

**Files:**

- Modify: `scripts/cli/selftest-kit.ts`（60 行，harness 共用层）

**Interfaces:**

- Produces: `runDirect(cmd: string, argv: string[], ctx: CliContext): Promise<{ code: number; out: string; err: string }>` —— 直调命令表；成功 code 0，throw 时 code 1 且 `err` 为 `错误：${message}`（与引导层 catch 的呈现同形）；未知命令 code 1 且 err 为「未知命令…」文案。

**Steps:**

- [ ] 在 selftest-kit.ts 增加（不引新依赖，`parseArgs`/`COMMANDS` 由调用方传入或动态 import——kit 保持无静态内核依赖，采用**传入注入**）：

```ts
import type { CliArgs, CliContext } from "./args";

/** 进程内直调结果：形状与子进程冒烟的 { code, out, err } 同构，断言可无缝换载体。 */
export interface CallResult {
	code: number;
	out: string;
	err: string;
}

/**
 * 进程内直调命令表（等价于走一遍 main 的分发，但不起子进程）。
 *
 * @remarks
 * selftest 的输出形态断言原用 spawnSync 起真 CLI —— 每次约 3.2 秒（iztro 冷启动），
 * 30 个调用点 ≈ 96 秒。直调复用本进程已加载的 iztro（约 25ms/次），语义等价：
 * 成功路径同一 `console.log` 前的返回串；错误路径同一 throw（此处捕获后拼成引导层
 * 同形文案）。「stderr 前缀 + exit 1」这条真链路由保留的 2-3 个子进程冒烟覆盖。
 */
export async function runDirect(
	cmd: string,
	argv: string[],
	dispatch: (args: CliArgs, ctx: CliContext) => string | Promise<string>,
	parse: (argv: string[], cmd: string) => CliArgs,
	ctx: CliContext
): Promise<CallResult> {
	try {
		const out = await dispatch(parse(argv, cmd), ctx);
		return { code: 0, out, err: "" };
	} catch (err) {
		return { code: 1, out: "", err: `错误：${(err as Error).message}` };
	}
}
```

（若 kit 现有导出风格是 `createHarness`/`eq`，按同风格放置；`import type` 不产生运行时依赖。）

### Task 2：主 selftest 的 runCli 断言组改直调 + 保留冒烟

**Files:**

- Modify: `scripts/cli/selftest.ts:1338-1470+`（runCli 定义与 17 处调用）

**Steps:**

- [ ] 在 runCli 定义旁增加直调用法（`COMMANDS` 已在本文件 101 行动态 import 取到；`parseArgs` 已静态 import）：

```ts
	// 直调版：与 runCli 同形返回，断言换载体不改语义。命令分发层（exit 码 / stderr
	// 前缀）由文末保留的子进程冒烟覆盖。
	const call = (argv: string[]): Promise<{ code: number; out: string; err: string }> => {
		const [cmd, ...rest] = argv;
		const fn = COMMANDS[cmd as keyof typeof COMMANDS];
		if (!fn)
			return Promise.resolve({
				code: 1,
				out: "",
				err: `未知命令「${cmd}」。可用：${commandNames.join(" / ")}\n运行 help 查看完整用法。`,
			});
		return runDirect(cmd, rest, fn, parseArgs, ctx);
	};
```

- [ ] 逐组替换（断言文案里「子进程全链路」改为「进程内直调」或删去载体描述）：
  - 1345 默认概览 → 直调
  - 1354 --palaces → 直调
  - 1364 --topic（含 1376 --view 越界）→ 直调（越界断言 `bad.err.includes("--view")` 仍成立——直调 err 为 `错误：--view 应为…`）
  - 1380 旧命令名 ×5 → 改为进程内键集断言：`for (const old of [...]) if (COMMANDS[old as keyof typeof COMMANDS]) throw new Error(...)`；「未知命令指路」的 stderr/exit 链路由 Task 2 保留的冒烟覆盖
  - 1388 --focus → 直调
  - 1396 非法日期 ×2 + 闰年 ×1 → 直调（`bad.code === 0` / `bad.out.trim()` / `bad.err.includes(...)` 判据在直调形态下同样成立：throw → code 1、out 空、err 含原文）
  - 1414 --config ×3、1441 --template 闭环 → 直调（注意 1441 的「模板吃回」断言若依赖 `--config` 文件路径，直调同构）
- [ ] 保留 3 个子进程冒烟（追加为独立断言，放断言组末尾）：

```ts
	ok("冒烟（子进程）：成功链路 入口→解析→命令表→渲染 一次走通", () => {
		const r = runCli(["astrology", "1990-5-15", "9:30", "男", "北京"]);
		if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		if (!r.out.includes("【命盘总览】")) throw new Error("缺总览");
		return "子进程成功链路在";
	});
	ok("冒烟（子进程）：错误链路 stderr「错误：」前缀 + exit 1 + stdout 空（--json 路径）", () => {
		const r = runCli(["astrology", "--date", "2011-02-30", "--time", "07:45", "--gender", "male", "--json"]);
		if (r.code === 0 || !r.err.startsWith("错误：")) throw new Error(`应 stderr 错误：前缀 + 非零退出，实得 code=${r.code} err=${r.err.slice(0, 60)}`);
		if (r.out.trim()) throw new Error("stdout 应为空");
		return "子进程错误出口在";
	});
	ok("冒烟（子进程）：未知命令 stderr + exit 1 并指路", () => {
		const r = runCli(["analyze", "--date", "1990-05-15"]);
		if (r.code === 0 || !r.err.includes("未知命令") || !r.err.includes("astrology"))
			throw new Error(`实得：${r.err.trim()}`);
		return "未知命令指路在";
	});
```

（`runCli` 保留定义，专供冒烟；`spawnSync` import 保留。）

### Task 3：classics / synastry 断言组同法收敛

**Files:**

- Modify: `scripts/classics/selftest-asserts.ts`（2 处 run 调用）
- Modify: `scripts/synastry/selftest-asserts.ts`（11 处 run 调用）

**Steps:**

- [ ] 两文件各引入与 Task 2 同形的 `call`（`COMMANDS` 两文件已动态 import；`parseArgs` 从 `../cli/args` import——synastry 断言组如未引入则补 import）。
- [ ] classics：保留 1 个子进程冒烟（`classics --search 紫微` 成功链路），另 1 处改直调。
- [ ] synastry：11 处中保留 0 个子进程（主 selftest 的 3 个冒烟已覆盖分发链路；synastry 的 run 断言全部直调；若某断言专门测「双 JSON 文件输入的文件系统交互」，直调同样经过 `--charts` 路径，语义不变）。
- [ ] 跑 selftest 计时确认：`time node scripts/purple-star.ts selftest` ≤ 20 秒（目标 10-15 秒）。

### Task 4：方案 B——command-meta 拆分

**Files:**

- Create: `scripts/cli/command-meta.ts`
- Modify: `scripts/cli/commands.ts`（COMMAND_DESC/COMMAND_HELP/CommandName 改从 command-meta 取并 re-export）
- Modify: `scripts/cli/help.ts:21-22`（改 import command-meta）

**Interfaces:**

- Produces: `command-meta.ts` 导出 `type CommandName`、`COMMAND_DESC: Record<CommandName, string>`、`COMMAND_HELP: Record<CommandName, string>`、`COMMAND_NAMES: readonly CommandName[]`。零依赖（不 import 任何 cmd 实现）。
- commands.ts / help.ts 的既有导出面不变（commands.ts re-export 保旧调用方）。

**Steps:**

- [ ] 从 `commands.ts` 把 `CommandName` 类型、`COMMAND_DESC`、`COMMAND_HELP`（多行帮助文案表）搬到 `command-meta.ts`；commands.ts 顶部改为 `import { COMMAND_DESC, COMMAND_HELP, type CommandName } from "./command-meta"` 并 `export { COMMAND_DESC, COMMAND_HELP } from "./command-meta"; export type { CommandName } from "./command-meta";`。
- [ ] help.ts 的 `import { COMMAND_DESC, COMMAND_HELP } from "./commands"` 与 `import type { CommandName } from "./commands"` 改指 `./command-meta`。
- [ ] 验证 help.ts 加载不再拉起 iztro：`node -e "..."` 或直接进 Task 5 实测。

### Task 5：方案 B——purple-star.ts 懒加载内核

**Files:**

- Modify: `scripts/purple-star.ts:172-284`

**Steps:**

- [ ] 把顶层 9 个 `await load<...>(...)`（172-184 行：algorithm/patterns/mutagen/constants/cities/lunar/classics/chart-view/args/commands/help）与 LOADED 自检块（203-231 行）整体包进：

```ts
/** 排盘所需的全部模块 + 启动导出自检（help/未知命令路径不调用，故不付 iztro 加载成本）。 */
async function loadCore(): Promise<{ COMMANDS: CommandsModule["COMMANDS"] }> {
	const algorithmNs = await load<AlgorithmModule>("@/ziwei/algorithm");
	// ……（原 172-184 行全部照搬，变量名不变）
	const { COMMANDS } = commandsNs;
	const LOADED = [
		/* 原表照搬 */
	];
	// ……（原自检块照搬）
	return { COMMANDS };
}
```

- [ ] `main()` 改为：help 分支只加载轻模块——

```ts
	async function main() {
		const argv = process.argv.slice(2);
		const cmd = argv[0];
		if (cmd && cmd !== "help" && (argv.includes("--help") || argv.includes("-h"))) {
			const metaNs = await load<MetaModule>("@/cli/command-meta");
			const helpLite = await load<typeof import("@/cli/help")>("@/cli/help");
			if ((metaNs.COMMAND_NAMES as readonly string[]).includes(cmd)) {
				console.log(helpLite.renderCommandHelp(cmd as Parameters<typeof helpLite.renderCommandHelp>[0]));
				return;
			}
		}
		if (!cmd || cmd === "help" || argv.includes("--help") || argv.includes("-h")) {
			const helpLite = await load<typeof import("@/cli/help")>("@/cli/help");
			console.log(helpLite.renderOverviewHelp());
			return;
		}
		const { COMMANDS } = await loadCore();
		// ……（未知命令 / 分发逻辑照搬，函数体不变）
	}
```

  并在文件顶部类型层补 `type MetaModule = typeof import("@/cli/command-meta");`。

- [ ] 顶层删去原 172-231 行（含 args/commands/help 的顶层加载与 `const { parseArgs }` / `const { COMMANDS, COMMAND_DESC }` 解构——main 内自取）。
- [ ] `npm run typecheck` 通过。
- [ ] 实测启动：`time node scripts/purple-star.ts help` ≤ 0.5 秒；`node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州` 正常出盘（懒加载后首次排盘仍做启动自检——故意删一个导出模拟内核重构的场景不在本步验证范围，靠既有断言兜底）。
- [ ] `npm run bench:startup` 记录对比数据。

### Task 6：回归与提交

- [ ] `node scripts/purple-star.ts selftest` 全绿；`time` 记录新耗时写入 selftest-performance 文档复核记录。
- [ ] `npm test` 全绿；`npm run typecheck` 通过。
- [ ] 提交：`git add scripts/cli/selftest-kit.ts scripts/cli/selftest.ts scripts/classics/selftest-asserts.ts scripts/synastry/selftest-asserts.ts scripts/cli/command-meta.ts scripts/cli/commands.ts scripts/cli/help.ts scripts/purple-star.ts && git commit -m "perf(selftest): 断言改进程内直调仅留 3 冒烟（方案 A 续）；help 懒加载不拉 iztro（方案 B）"`
- [ ] 更新 `docs/doubao/selftest-performance.md`：方案 A 续 ✅（记录实测耗时）、方案 B ✅；修正「6 个子进程」的口径为实际调用点数（30 → 3）。
