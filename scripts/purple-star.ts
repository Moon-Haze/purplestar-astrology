#!/usr/bin/env node
/**
 * purple-star.ts — 紫微斗数排盘 / 合盘 / 知识检索 CLI（入口 / 引导层）
 *
 * 本文件只做四件事：**定位内核根 → 注册 TS 解析钩子 → 启动期内核自检 → 把命令分发出去**。
 * 命令实现、渲染、出生信息解析、自检都**不在**这里，见 scripts/cli/：
 *
 *   cli/args.ts        CLI 参数表与解析（纯函数，不依赖内核）
 *   cli/render.ts      命盘渲染（宫位 / 星曜 / 四化 / 晚子时提示 / 宫名口径）
 *   cli/birth-info.ts  出生信息解析（真太阳时、农历换算、城市容错）
 *   cli/commands.ts    七个命令实现 + 命令表
 *   cli/selftest.ts    回归自检（留在 scripts/ 而非 test/，理由见该文件）
 *
 * 设计原则：**不重复实现任何命理逻辑**，全部复用与脚本同级的既有内核模块：
 *   scripts/ziwei/algorithm.ts        排盘主流程
 *   scripts/ziwei/patterns/           格局识别（含古籍出处与破格条件）
 *   scripts/ziwei/sihua.ts            四化（生年 / 流年 / 流月）
 *   scripts/ziwei/analysis/           分析数据库 v3（主题论断动态推算，topic 命令用）
 *   scripts/ziwei/heming-knowledge.ts 合盘方法论 + 夫妻宫断语
 *   scripts/ziwei/cities.ts           中国城市经纬度（真太阳时校正）
 *   scripts/ziwei/constants.ts        天干地支 / 四化表 / 星曜释义
 *   scripts/classics/                 古籍原文全文检索
 *
 * 依赖 Node ≥ 22.15（module.registerHooks + 原生 TS 类型擦除）。
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
type SihuaModule = typeof import("@/ziwei/sihua");
type ConstantsModule = typeof import("@/ziwei/constants");
type CitiesModule = typeof import("@/ziwei/cities");
type ClassicsModule = typeof import("@/classics/index");
type ArgsModule = typeof import("@/cli/args");
type CommandsModule = typeof import("@/cli/commands");

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
 * 内核根 = `scripts/` **本身**：CLI（`purple-star.ts`、`cli/`）与两个内核目录（`ziwei/`、`classics/`）
 * 同处一层。因此 `@/` 别名指向的是 `scripts/`，而**不是** skill 根。
 *
 * 这里刻意**没有**「宿主项目」候选：仓库内只有这一份内核，不存在副本漂移问题。
 */
const ROOT_CANDIDATES: Array<[string | undefined, string]> = [
	[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
	[HERE, "技能自带内核"],
];

const picked = pickRoot(ROOT_CANDIDATES);

if (!picked.root) {
	console.error(
		`[ziwei 启动失败] 找不到排盘内核（ziwei/algorithm.ts）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			"\n" +
			`  处理：\n` +
			`    ① 确认 skill 目录完整 —— scripts/ 下应同时有 purple-star.ts、cli/ 与 ziwei/、classics/ 两个内核目录（拷贝时漏带内核会走到这里）；或\n` +
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
	console.error(`[ziwei 启动失败] 无法加载 ${f.spec}\n  ${f.error.message}\n${loadFailureHint(f)}`);
	process.exit(1);
});

// 钩子已就绪，从这里开始才能安全地加载任何 .ts（内核与 scripts/cli/ 下的子模块都一样）。
const { generateChart } = await load<AlgorithmModule>("@/ziwei/algorithm");
const { detectPatterns, getMingGongSummary } = await load<PatternsModule>("@/ziwei/patterns");
const { getSiHuaByStem, getYearStemIndex, getLiuNianSiHua, getLiuYueSiHua } =
	await load<SihuaModule>("@/ziwei/sihua");
const { STEMS, BRANCHES, SHICHEN, STAR_DESCRIPTIONS } =
	await load<ConstantsModule>("@/ziwei/constants");
const { PROVINCES } = await load<CitiesModule>("@/ziwei/cities");
const { searchClassics } = await load<ClassicsModule>("@/classics/index");
const { Lunar } = await load<typeof import("lunar-typescript")>("lunar-typescript");

const { parseArgs, cli } = await load<ArgsModule>("@/cli/args");
const { COMMANDS, COMMAND_DESC } = await load<CommandsModule>("@/cli/commands");

// ── 启动自检：内核若重构导致关键导出消失，立即报错，而不是静默产出错盘 ──
/**
 * 启动期必须存在的上游导出清单，每项是 `[导出名, 运行时值]`。
 *
 * @remarks
 * 子模块是静态 import 内核的，少一个导出本来就会让它们加载失败；但那时抛的是裸的
 * `SyntaxError: does not provide an export named ...`，指不到该改哪里。这里先 load 一遍
 * 并逐项点名，把「哪个导出没了、当前内核根在哪、接下来怎么办」一次说清。
 *
 * ⚠️ 也因此：在内核里重命名或删除导出会让 CLI 立刻报错 —— **这是有意的，不是脆弱**。
 * 与 `algorithm.ts` 的 `projectPalaceName` 同一理念：宁可启动失败，也不静默产出错盘。
 */
const REQUIRED_EXPORTS = [
	["generateChart", generateChart],
	["detectPatterns", detectPatterns],
	["getMingGongSummary", getMingGongSummary],
	["getSiHuaByStem", getSiHuaByStem],
	["getYearStemIndex", getYearStemIndex],
	["getLiuNianSiHua", getLiuNianSiHua],
	["getLiuYueSiHua", getLiuYueSiHua],
	["STEMS", STEMS],
	["BRANCHES", BRANCHES],
	["SHICHEN", SHICHEN],
	["STAR_DESCRIPTIONS", STAR_DESCRIPTIONS],
	["PROVINCES", PROVINCES],
	["searchClassics", searchClassics],
	["Lunar", Lunar],
];
{
	const missing = REQUIRED_EXPORTS.filter(([, v]) => v === undefined || v === null).map(
		([n]) => n
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

// ══════════════════════ 入口 ══════════════════════

/**
 * 两条最容易排出错盘的口径，作为 help 的追加段。
 *
 * @remarks
 * 刻意留在 help 里而不是别处：这两条各自都能排出一张**不同的盘**，而排盘本身不会报错
 * —— 复核时先看它们，是这个项目唯一能给的提示。（`cli/args.ts` 的旗标声明表能防
 * 「拼错旗标静默落回默认值」，防不了「口径选错」。）
 */
const HELP_CAUTION = `  · 晚子时：23:00–23:59 出生时，子时横跨两日，【当日早子时】与【晚子时算次日】
    排出的是两张不同的盘。复核请加 --late-zi 或 --branch 12。

  · 真太阳时跨过午夜：出生日期会自动回退/顺延一天，输出里会写明「已跨过午夜，
    出生日期…」。这是正确行为 —— 只换时辰不换日期，排出的「日 + 时」指向的
    就不是出生时刻（喀什 00:30 的真太阳时是前一日 21:34，农历日会错一天）。`;

/**
 * 常用调用示例，作为 help 的追加段。
 *
 * @remarks
 * ⚠️ 这段仍在手写（cac 渲染不到），改参数名时要一并改 —— `selftest` 有一条断言扫
 * `SKILL.md` 里的旗标写法，示例里的旗标因此也落在它的覆盖范围内。
 */
const HELP_EXAMPLES = `  # 单人解读（公历）
  node scripts/purple-star.ts analyze --date 1990-05-15 --time 09:30 --city 北京 --gender male

  # 用户只给农历生日
  node scripts/purple-star.ts analyze --lunar 1988-06-26 --time 10:30 --city 杭州 --gender male

  # 时辰直接指定 + 指定流年 + 聚焦官禄宫
  node scripts/purple-star.ts analyze --date 1985-11-03 --branch 6 --gender female --liunian 2027 --focus 官禄

  # 23:00 后出生，复核晚子时口径
  node scripts/purple-star.ts analyze --date 1988-02-14 --time 23:40 --late-zi --city 北京 --gender male

  # 合盘
  node scripts/purple-star.ts heming \\
    --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \\
    --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海

  # 古籍检索 / 回归自检
  node scripts/purple-star.ts classics --search 机月同梁
  node scripts/purple-star.ts selftest`;

// 命令注册进 cac **只为让 help 列出命令**：分发仍由下面的 main() 查 COMMANDS 表 ——
// cac 的 action 模型与「cmdXxx 一律**返回**字符串、console.log 只在 main() 一处发生」不合，
// 用 action 会让输出点从 1 处变成 8 处。
for (const [name, desc] of Object.entries(COMMAND_DESC)) cli.command(name, desc);
// 用法/命令/参数三段由 cac 自己渲染（分别来自名字、COMMAND_DESC、FLAG_GROUPS），
// 这两段是它渲染不到的领域知识。
cli.help(sections => [
	// 无标题段渲染成最前面独立的一行，位置与原 HELP 的首行一致。
	// （不要改用 `cli.usage()` 放这句：它会把文本拼在 `$ purple-star ` **同一行**后面，
	//   还会顶掉 cac 自带的 `<command> [options]`，读起来像一条命令。）
	{ body: "紫微斗数 CLI —— 复用 scripts/ 下的排盘内核与知识库" },
	...sections,
	{ title: "⚠️ 两个容易排出错盘的口径（复核时先看这两条）", body: HELP_CAUTION },
	{ title: "示例", body: HELP_EXAMPLES },
]);

/**
 * CLI 入口：取命令名 → 查 `COMMANDS` 表 → 解析参数 → 打印命令的返回值。
 *
 * @remarks
 * `console.log` 只在这一处发生 —— 七个 `cmdXxx` 一律**返回**已渲染好的文本字符串，由这里统一输出。
 *
 * 无参数、`help`、`--help`、`-h` 都走 `cli.outputHelp()`（用法 / 命令 / 参数三段由 cac 渲染，
 * 两条口径警告与示例由上面注册的 help 回调追加）；未知命令与命令内部抛出的错误都以非零码退出
 * （只打印 `err.message`，不打印栈）。传给命令的第二个参数是 `CliContext`（内核根及其来源），
 * 目前只有 `selftest` 用得上。
 *
 * ⚠️ 命令名直接来自 `argv`，故查表必然可能未命中 —— `COMMANDS` 的值类型显式带 `| undefined`。
 *
 * `--help` 出现在**任何位置**都打印 help，包括 `analyze --help` 这种。这是刻意的：
 * `--help` 不在旗标声明表里，放它走到 `parseArgs` 只会得到一句「未知参数 --help」，
 * 而用户此刻想要的显然是用法。判定提前到分发之前，`parseArgs` 因此永远见不到它。
 */
function main() {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	if (!cmd || cmd === "help" || argv.includes("--help") || argv.includes("-h")) {
		// 警告走的是上面那个 help 回调而非在这里事后补打：`outputHelp()` 直接打印、
		// 取不回文本，接不上任何后处理。
		cli.outputHelp();
		return;
	}
	const fn = COMMANDS[cmd];
	if (!fn) {
		console.error(
			`未知命令「${cmd}」。可用：${Object.keys(COMMANDS).join(" / ")}\n运行 help 查看完整用法。`
		);
		process.exit(1);
	}
	try {
		// 命令名一并交给 parseArgs：旗标面要按命令校验（如 a- / b- 前缀只有 heming 认）
		const args = parseArgs(argv.slice(1), cmd);
		console.log(fn(args, { root: ROOT, rootLabel: ROOT_LABEL }));
	} catch (err) {
		console.error(`错误：${(err as Error).message}`);
		process.exit(1);
	}
}

main();
