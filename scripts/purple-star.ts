#!/usr/bin/env node
/**
 * purple-star.ts — 紫微斗数排盘与命盘解读 CLI（入口 / 引导层）
 *
 * 本文件只做四件事：**定位内核根 → 注册 TS 解析钩子 → 启动期内核自检 → 把命令分发出去**。
 * 命令实现、渲染、出生信息解析、自检都**不在**这里，见 scripts/cli/：
 *
 *   cli/args.ts        参数声明表 OPTION_GROUPS + OPTION_ALIASES + 解析（util.parseArgs 底座）
 *   cli/option-scope.ts 参数作用域（前缀表已退役为空表）
 *   cli/render.ts      命盘渲染（宫位 / 星曜 / 四化 / 晚子时提示 / 宫名口径）
 *   cli/birth-info.ts  出生信息解析（真太阳时、农历换算、城市容错）
 *   cli/astrology.ts   排盘分析一条命令（四命令合一：概览默认 + 功能参数分发）
 *   cli/{classics,synastry,stars}.ts  各命令实现；cli/commands.ts 只做注册薄层
 *   cli/config.ts      --config / --template 配置输入；cli/help.ts  help 渲染（man 七节）
 *   cli/selftest.ts    回归自检（排盘 / 古籍 / 合盘三段合一）
 *
 * 设计原则：**不重复实现任何命理逻辑**，全部复用与脚本同级的既有内核模块：
 *   scripts/ziwei/algorithm.ts   排盘主流程
 *   scripts/ziwei/patterns/      格局识别（含古籍出处与破格条件）
 *   scripts/ziwei/mutagen.ts       四化（生年 / 流年 / 流月）
 *   scripts/ziwei/analysis/      分析数据库 v3（主题论断动态推算，topic 命令用）
 *   scripts/ziwei/cities.ts      中国城市经纬度（真太阳时校正）
 *   scripts/ziwei/constants.ts   天干地支 / 四化表 / 星曜释义
 *
 * classics / synastry 的内核也住进本仓
 * `scripts/classics/` 与 `scripts/synastry/`，命令并入本 CLI —— 单 skill 单入口，
 * 排盘（astrology）、古籍（classics）、合盘（synastry）都在这里（见 `SKILL.md`）。
 *
 * 依赖 Node ≥ 22.18（module.registerHooks + 原生 TS 类型擦除）。
 * 用法：node scripts/purple-star.ts <command> [options]   （在 skill 根目录下执行；脚本本身也可从任意 cwd 运行）
 * 帮助：node scripts/purple-star.ts help
 * 自检：node scripts/purple-star.ts selftest
 *
 * @packageDocumentation
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ⚠️ 引导层**唯一**被允许的非 `node:` 静态 import，理由见下方「引导层为什么能静态 import
//    boot-hooks.ts」—— 该文件自身只依赖 `node:` 内置，且调用点用的是带 `.ts` 扩展名的
//    说明符，靠 Node 原生类型擦除即可加载，**不需要解析钩子**。除此之外本文件不允许出现
//    任何普通静态 import。
import { installHooks, loadFailureHint, makeLoader, pickRoot } from "./boot-hooks.ts";

// ── 类型层：`import type` 与 `typeof import(...)` 在运行时被**完全擦除**，不产生任何静态依赖 ──
// 这一点是本文件能同时「自举注册 TS 钩子」与「拿到内核/子模块类型」的关键：
// ESM 的静态 import 会被提升到模块求值之前，若用普通 import 引内核或 scripts/cli/*，
// 钩子还没注册、对方的 .ts 就已经要加载了。类型节点擦除后什么都不剩，故安全。
//
// ⚠️ 因此：**本文件里除 `node:` 内置模块与 ./boot-hooks.ts 外，不允许出现任何普通静态 import**
//    —— `scripts/cli/` 下的自家子模块也不行（它们静态 import 内核，同样会触发提前加载）。
//    凡是要用的值，一律走下面的 load<T>()。这是本文件最容易被改坏的一处。
//
// **引导层为什么能静态 import boot-hooks.ts**：那条禁令的实质不是「禁止静态 import」，
// 而是「禁止在钩子注册前触发 `.ts` 解析」。boot-hooks.ts 只 import `node:` 内置，自身不含
// 任何需要钩子解析的依赖，且调用点写全了 `.ts` 扩展名 —— Node 的原生类型擦除直接就能加载它。
// 把引导机制抽成共享模块（而非让 CLI 与 test/lib/loader.ts 各存一份逐行副本）正是靠这一点。
// `cli/selftest.ts` 有一条断言盯着 boot-hooks.ts 的 import 全是 `node:` 前缀，防止这条豁免腐烂。

/**
 * 动态导入的模块类型：下方 `load<T>()` 用它把 `await import(spec)` 的 `any` 收窄回真实签名。
 *
 * @remarks
 * `typeof import("...")` 是**类型层节点**，运行时被完全擦除，因此可以安全地写在文件顶部 ——
 * 这是本文件能同时「自举注册 TS 钩子」与「拿到内核真实类型」的关键（详见上方注释）。
 *
 * ⚠️ 这里只允许类型层的 `typeof import(...)`：任何**值导入**（含把内核模块或 `scripts/cli/*`
 * 写成普通静态 `import`）都会在钩子注册之前触发加载，直接崩掉。
 */
type AlgorithmModule = typeof import("@/ziwei/algorithm");
type PatternsModule = typeof import("@/ziwei/patterns");
type SihuaModule = typeof import("@/ziwei/mutagen");
type ConstantsModule = typeof import("@/ziwei/constants");
type CitiesModule = typeof import("@/ziwei/cities");
type ClassicsModule = typeof import("@/classics");
type ChartViewModule = typeof import("@/synastry/chart-view");
type ArgsModule = typeof import("@/cli/args");
type CommandsModule = typeof import("@/cli/commands");
/** 轻量命令元数据（名字与 HELP 文案，无命令实现依赖）——help 路径只需它。 */
type MetaModule = typeof import("@/cli/command-meta");

// 历史注记：这里曾有一段 `process.emitWarning` 猴子补丁，用于过滤
// `MODULE_TYPELESS_PACKAGE_JSON` 告警 —— 那是上游 ziwei-master（Next.js 项目，不能把
// package.json 改成 "type":"module"）的约束，随内核拷贝带了过来。本仓库的 package.json
// 已声明 "type": "module"，该告警不会触发，补丁是死代码，已删除。

/** 本脚本所在目录，即 `<skill 根>/scripts`（内核根的第一个候选，见 {@link pickRoot}） */
const HERE = dirname(fileURLToPath(import.meta.url));

// ── 排盘内核根目录：两级优先级 ──
/**
 * 本 CLI 的内核根候选清单（判定规则与失败呈现都在 `./boot-hooks.ts`，此处只给**策略**）。
 *
 * @remarks
 * 优先级：
 * 1. `ZIWEI_ROOT` 环境变量 —— 显式指定（想把内核指到别处时用）
 * 2. 技能自带内核 —— 就是本脚本所在目录 `<skill 根>/scripts/`
 *
 * 内核根 = `scripts/` **本身**：CLI（`purple-star.ts`、`cli/`）与内核目录（`ziwei/`）
 * 同处一层。因此 `@/` 别名指向的是 `scripts/`，而**不是** skill 根。
 *
 * 这里刻意**没有**「宿主项目」候选：每个 skill 自带内核，不存在「实时内核 vs 分发副本」
 * 的双模式。（本仓已无 skill 间的副本关系 —— 见 `CLAUDE.md`「三个 skill 之间没有关系」。）
 */
const ROOT_CANDIDATES: Array<[string | undefined, string]> = [
	[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
	[HERE, "技能自带内核"],
];

/**
 * 本 skill 的内核入口 —— `pickRoot` 拿它判定「这份内核在不在」。
 *
 * @remarks
 * 由调用方传入而非写死在 `boot-hooks.ts`：各 skill 各有各的内核，古籍检索 skill 里
 * 根本没有 `ziwei/`（见 `CLAUDE.md` 的「skill 的布局」）。
 */
const KERNEL_ENTRY = "ziwei/algorithm.ts";

const picked = pickRoot(ROOT_CANDIDATES, KERNEL_ENTRY);

if (!picked.root) {
	console.error(
		`[ziwei 启动失败] 找不到排盘内核（${KERNEL_ENTRY}）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			"\n" +
			`  处理：\n` +
			`    ① 确认 skill 目录完整 —— scripts/ 下应同时有 purple-star.ts、cli/ 与 ziwei/ 内核目录（拷贝时漏带内核会走到这里）；或\n` +
			`    ② 用 ZIWEI_ROOT=<含 ziwei/ 的目录> 显式指定内核位置。`
	);
	process.exit(1);
}

/**
 * 内核根（已确定为非空）。
 *
 * @remarks
 * `picked` 是判别联合，`!picked.root` 的守卫之后整体收窄为 `RootFound`，故 `root` 与 `label`
 * 都直接是 `string`。收窄不会延续到函数体内（`load` 的错误分支就要用 `ROOT`），
 * 故此处显式落成非空 `string`，免得每个闭包里都得再断言一次。
 */
const ROOT: string = picked.root;
const ROOT_LABEL: string = picked.label;

// ── 让 Node 直接加载 TS：解析 @/ 别名，补全省略的 .ts / index.ts，并把裸包名指向当前根 ──
// 钩子本体在 ./boot-hooks.ts（与 test/lib/loader.ts 共用同一份实现），此处只负责**注册时机**：
// 必须在任何内核模块被求值之前执行，见文件顶部注释。
installHooks(ROOT);

// ── 统一加载器：任何上游模块挂了都给出可执行的排查指引，而不是裸栈 ──
/**
 * 动态加载内核或 `scripts/cli/*` 子模块；任何上游模块挂了都给排查指引而不是裸栈。
 *
 * @remarks
 * **所有内核模块与 `scripts/cli/*` 子模块都必须经由本加载器加载**（见文件顶部注释：钩子注册前
 * 不允许出现会触发 `.ts` 解析的静态 import）。
 *
 * 机制（说明符怎么解析、失败事实长什么样）在 `./boot-hooks.ts` 的 `makeLoader`；
 * 此处只给**策略** —— CLI 的失败呈现是「渲染指引 + `process.exit(1)`」，故调用点拿到的返回值
 * 必然非空，不必再写 try/catch。对照 `test/lib/loader.ts` 的同名加载器：同一份机制配的是
 * 「抛错」策略，让 node:test 把失败归到具体用例；两者共用 `loadFailureHint()` 的排查知识。
 */
const load = makeLoader(ROOT, ROOT_LABEL, f => {
	console.error(
		`[ziwei 启动失败] 无法加载 ${f.spec}\n  ${f.error.message}\n${loadFailureHint(f)}`
	);
	process.exit(1);
});

// ── 排盘内核的加载 + 启动自检：惰性 ──
// help / 未知命令路径只加载 command-meta + help（轻模块）即返回，不为看一眼用法付出
// iztro 冷启动；真正要排盘 / 检索 / 合盘时才调用本函数。启动自检的语义是
// 「加载内核时就地自检」，help 不消费内核导出，不受影响。
/**
 * 加载排盘所需的全部模块并做启动自检，返回分发所需的命令表与参数解析器。
 *
 * @remarks
 * 每个模块 load 一次存 namespace：既供解构，也进 LOADED 表参与启动自检 ——
 * 不再有「解构一份 + REQUIRED_EXPORTS 手抄第二份」的双登记。
 */
async function loadCore() {
	const algorithmNs = await load<AlgorithmModule>("@/ziwei/algorithm");
	const patternsNs = await load<PatternsModule>("@/ziwei/patterns");
	const sihuaNs = await load<SihuaModule>("@/ziwei/mutagen");
	const constantsNs = await load<ConstantsModule>("@/ziwei/constants");
	const citiesNs = await load<CitiesModule>("@/ziwei/cities");
	const lunarNs = await load<typeof import("lunar-typescript")>("lunar-typescript");
	// classics / synastry 的入口模块：分别对应两条命令的内核
	const classicsNs = await load<ClassicsModule>("@/classics");
	const chartViewNs = await load<ChartViewModule>("@/synastry/chart-view");

	const argsNs = await load<ArgsModule>("@/cli/args");
	const commandsNs = await load<CommandsModule>("@/cli/commands");
	const helpMod = await load<typeof import("@/cli/help")>("@/cli/help");

	// ── 启动自检：内核若重构导致关键导出消失，立即报错，而不是静默产出错盘 ──
	/**
	 * 已加载模块清单，自检据此**派生**而非手抄第二份：对每个 namespace 的**全部**导出做
	 * 非空扫描 —— 新模块加进这里一行，它的导出自动受检，「加模块忘登记、自检静默变弱」
	 * 从结构上不可能。
	 *
	 * @remarks
	 * 子模块是静态 import 内核的，少一个导出本来就会让它们加载失败；但那时抛的是裸的
	 * `SyntaxError: does not provide an export named ...`，指不到该改哪里。这里先 load 一遍
	 * 并点名缺失项，把「哪个导出没了、当前内核根在哪、接下来怎么办」一次说清。
	 *
	 * ⚠️ 也因此：在内核里重命名或删除导出会让 CLI 立刻报错 —— **这是有意的，不是脆弱**。
	 * 与 `algorithm.ts` 的 `projectPalaceName` 同一理念：宁可启动失败，也不静默产出错盘。
	 */
	const LOADED: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
		["@/ziwei/algorithm", algorithmNs],
		["@/ziwei/patterns", patternsNs],
		["@/ziwei/mutagen", sihuaNs],
		["@/ziwei/constants", constantsNs],
		["@/ziwei/cities", citiesNs],
		["lunar-typescript", lunarNs],
		["@/classics", classicsNs],
		["@/synastry/chart-view", chartViewNs],
		["@/cli/args", argsNs],
		["@/cli/commands", commandsNs],
		["@/cli/help", helpMod],
	];
	{
		const missing = LOADED.flatMap(([spec, ns]) =>
			Object.entries(ns)
				.filter(([, v]) => v === undefined || v === null)
				.map(([n]) => `${spec} 的 ${n}`)
		);
		if (missing.length) {
			console.error(
				`[ziwei 启动自检失败] 以下上游导出缺失：${missing.join("、")}\n` +
					`  当前内核根：${ROOT}（来源：${ROOT_LABEL}）\n` +
					`  可能原因：内核被重构，或导出被改名 / 删除。\n` +
					`  处理：核对 scripts/cli/ 各模块的 import 列表与 scripts/ 下内核的实际导出是否对得上。`
			);
			process.exit(1);
		}
	}
	return { COMMANDS: commandsNs.COMMANDS, parseArgs: argsNs.parseArgs };
}

// ══════════════════════ 入口 ══════════════════════

/**
 * CLI 入口：取命令名 → 查 `COMMANDS` 表 → 解析参数 → 打印命令的返回值。
 *
 * @remarks
 * `console.log` 只在这一处发生 —— 各 `cmdXxx` 一律**返回**已渲染好的文本字符串，由这里统一输出。
 *
 * 无参数、`help`、`--help`、`-h` 都打印 {@link renderHelp} 的产物；未知命令与命令内部抛出的
 * 错误都以非零码退出（只打印 `err.message`，不打印栈）。传给命令的第二个参数是
 * `CliContext`（内核根及其来源），目前只有 `selftest` 用得上。
 *
 * ⚠️ 命令名直接来自 `argv`，故查表必然可能未命中 —— `COMMANDS` 的值类型显式带 `| undefined`。
 *
 * `--help` 出现在**任何位置**都打印 help，包括 `astrology --help` 这种。这是刻意的：
 * `--help` 不在参数声明表里，放它走到 `parseArgs` 只会得到一句「未知参数 --help」，
 * 而用户此刻想要的显然是用法。判定提前到分发之前，`parseArgs` 因此永远见不到它。
 */
async function main() {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	// help 路径只加载轻模块（command-meta + help，均不依赖命令实现），不为看一眼
	// 用途付出 iztro 冷启动。
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
	// 真正要执行命令了：此刻才加载内核并做启动自检（见 loadCore 的注释）。
	const { COMMANDS, parseArgs } = await loadCore();
	const fn = COMMANDS[cmd];
	if (!fn) {
		console.error(
			`未知命令「${cmd}」。可用：${Object.keys(COMMANDS).join(" / ")}\n运行 help 查看完整用法。`
		);
		process.exit(1);
	}
	try {
		// 命令名一并交给 parseArgs：参数面要按命令校验（前缀参数只有声明过的那几条命令认）
		const args = parseArgs(argv.slice(1), cmd);
		// Cmd 允许返回 Promise（cmdSelftest 异步化后动态 import 命令表），统一 await。
		console.log(await fn(args, { root: ROOT, rootLabel: ROOT_LABEL }));
	} catch (err) {
		console.error(`错误：${(err as Error).message}`);
		process.exit(1);
	}
}

main();
