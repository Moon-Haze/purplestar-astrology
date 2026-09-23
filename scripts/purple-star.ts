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
 *   cli/selftest.ts    回归自检（46 项断言；留在 scripts/ 而非 test/，理由见该文件）
 *
 * 设计原则：**不重复实现任何命理逻辑**，全部复用与脚本同级的既有内核模块：
 *   scripts/ziwei/algorithm.ts        排盘主流程
 *   scripts/ziwei/patterns.ts         格局识别（40+ 格局，含古籍出处与破格条件）
 *   scripts/ziwei/sihua.ts            四化（生年 / 流年 / 流月）
 *   scripts/ziwei/heming-knowledge.ts 合盘方法论 + 夫妻宫断语
 *   scripts/ziwei/cities.ts           中国城市经纬度（真太阳时校正）
 *   scripts/ziwei/constants.ts        天干地支 / 四化表 / 星曜释义
 *   scripts/classics/                 古籍原文全文检索
 *   scripts/nihai/                    倪海厦天纪/地纪/人纪知识
 *
 * 依赖 Node ≥ 22.15（module.registerHooks + 原生 TS 类型擦除）。
 * 用法：node scripts/purple-star.ts <command> [options]   （在 skill 根目录下执行；脚本本身也可从任意 cwd 运行）
 * 帮助：node scripts/purple-star.ts help
 * 自检：node scripts/purple-star.ts selftest
 *
 * @packageDocumentation
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// ── 类型层：`import type` 与 `typeof import(...)` 在运行时被**完全擦除**，不产生任何静态依赖 ──
// 这一点是本文件能同时「自举注册 TS 钩子」与「拿到内核/子模块类型」的关键：
// ESM 的静态 import 会被提升到模块求值之前，若用普通 import 引内核或 scripts/cli/*，
// registerHooks 还没执行、对方的 .ts 就已经要加载了。类型节点擦除后什么都不剩，故安全。
//
// ⚠️ 因此：**本文件里除了 `node:` 内置模块，不允许出现任何普通静态 import** ——
//    `scripts/cli/` 下的自家子模块也不行（它们静态 import 内核，同样会触发提前加载）。
//    凡是要用的值，一律走下面的 load<T>()。这是本文件最容易被改坏的一处。

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
 * 定位排盘内核根目录。
 *
 * @returns `root` 为命中的内核根（`null` 表示全部候选都不成立）；`label` 是该来源的描述
 *   （「ZIWEI_ROOT 环境变量」/「技能自带内核」）；`tried` 是已尝试过的候选清单，供失败时逐条列给用户
 *
 * @remarks
 * 优先级：
 * 1. `ZIWEI_ROOT` 环境变量 —— 显式指定（想把内核指到别处时用）
 * 2. 技能自带内核 —— 就是本脚本所在目录 `<skill 根>/scripts/`
 *
 * 判定依据是「该目录下存在 `ziwei/algorithm.ts`」，而非目录本身是否存在。
 *
 * 内核根 = `scripts/` **本身**：CLI（`purple-star.ts`、`cli/`）与三个内核目录（`ziwei/`、`classics/`、`nihai/`）
 * 同处一层。因此 `@/` 别名指向的是 `scripts/`，而**不是** skill 根。
 *
 * 这里刻意**没有**「宿主项目」候选：仓库内只有这一份内核，不存在副本漂移问题。
 *
 * ⚠️ 失败时 `label` 取**空串**而非 `null`：调用点随即 `exit`，用不到它，而空串让返回类型保持
 * `label: string`，省得调用点为了给 `CliContext` 传值再断言一次。
 */
function pickRoot() {
	const tried: string[] = [];
	const candidates: [string | undefined, string][] = [
		[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
		[HERE, "技能自带内核"],
	];
	for (const [dir, label] of candidates) {
		if (!dir) continue;
		if (existsSync(resolve(dir, "ziwei/algorithm.ts"))) return { root: dir, label, tried };
		tried.push(`${label}：${dir}`);
	}
	return { root: null, label: "", tried };
}

const { root: rootFound, label: ROOT_LABEL, tried: ROOT_TRIED } = pickRoot();

if (!rootFound) {
	console.error(
		`[ziwei 启动失败] 找不到排盘内核（ziwei/algorithm.ts）\n` +
			`  已尝试：\n` +
			ROOT_TRIED.map(t => `    - ${t}`).join("\n") +
			"\n" +
			`  处理：\n` +
			`    ① 确认 skill 目录完整 —— scripts/ 下应同时有 purple-star.ts、cli/ 与 ziwei/、classics/、nihai/ 三个内核目录（拷贝时漏带内核会走到这里）；或\n` +
			`    ② 用 ZIWEI_ROOT=<含 ziwei/ 的目录> 显式指定内核位置。`
	);
	process.exit(1);
}

/**
 * 内核根（已确定为非空）。
 *
 * @remarks
 * `rootFound` 的收窄在模块顶层成立，但**不会延续到函数体内**（`load` 的错误分支就要用 `ROOT`）。
 * 故此处显式落成一个非空 `string`，免得每个闭包里都得再断言一次。
 */
const ROOT: string = rootFound;

// ── 让 Node 直接加载 TS：解析 @/ 别名，补全省略的 .ts / index.ts，并把裸包名指向当前根 ──
/**
 * 裸包名重定向所用的 parentURL：「内核根/package.json」。
 *
 * @remarks
 * 该文件通常不存在，无妨 —— Node 会自它向上逐级查找 `node_modules`，最终命中 skill 根的
 * `node_modules/`。这条重定向的意义在于：脱离项目运行时，从文件位置向上找不到 `node_modules`，
 * 必须显式把 `iztro` / `lunar-typescript` 指到当前内核根去解析。
 */
const ROOT_PARENT_URL = pathToFileURL(resolve(ROOT, "package.json")).href;

/**
 * 注册 TS 解析钩子，让 Node 直接加载本仓库的 `.ts`。
 *
 * @param specifier - 待解析的模块说明符
 * @param context - Node 传入的解析上下文（含 parentURL）
 * @param nextResolve - 链上的下一个解析器；本钩子未命中的说明符一律原样交给它
 * @returns 该说明符的解析结果
 *
 * @remarks
 * **钩子必须在任何内核模块被求值之前注册**（见文件顶部注释）：ESM 的静态 import 会被提升到
 * 模块求值之前，晚一步注册，内核的 `.ts` 就已经要加载了。三条分支：
 *
 * 1. `@/xxx` —— `@` 指**内核根**（`scripts/`）：`@/ziwei/algorithm` → `scripts/ziwei/algorithm.ts`，
 *    `@/cli/commands` → `scripts/cli/commands.ts`。依次尝试「原样 → `<base>.ts` → `<base>/index.ts`」，
 *    目录导入兜底是为了避免 `ERR_UNSUPPORTED_DIR_IMPORT`。
 * 2. `./xxx` —— 子模块内部的相对 import（如 `./args`）在这里补 `.ts`；已带 `.ts` / `.mts` / `.cts` /
 *    `.js` / `.mjs` / `.cjs` 后缀的原样放行，补后缀失败则落回默认解析。
 * 3. 裸包名（含 `@scope/pkg`）—— 若当前内核根的 `node_modules` 里有同名包，就以
 *    {@link ROOT_PARENT_URL} 为 parentURL 重新解析，摆脱对 cwd 与文件位置的依赖；`node:` 前缀一律不碰。
 */
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.startsWith("@/")) {
			const base = resolve(ROOT, specifier.slice(2));
			// 依次尝试：原样 → <base>.ts → <base>/index.ts（目录导入兜底，避免 ERR_UNSUPPORTED_DIR_IMPORT）
			const target = existsSync(base + ".ts")
				? base + ".ts"
				: existsSync(resolve(base, "index.ts"))
					? resolve(base, "index.ts")
					: base;
			return nextResolve(pathToFileURL(target).href, context);
		}
		if (specifier.startsWith(".")) {
			if (!/\.[cm]?[jt]s$/.test(specifier)) {
				try {
					return nextResolve(specifier + ".ts", context);
				} catch {
					/* 非 TS 目标，落回默认解析 */
				}
			}
			return nextResolve(specifier, context);
		}
		// 裸包名（含 @scope/pkg）：若当前根的 node_modules 里有，就从当前根解析，摆脱对 cwd 与文件位置的依赖
		if (!specifier.startsWith("node:")) {
			const pkgName = specifier.startsWith("@")
				? specifier.split("/").slice(0, 2).join("/")
				: specifier.split("/")[0];
			if (existsSync(resolve(ROOT, "node_modules", pkgName))) {
				return nextResolve(specifier, {
					...context,
					parentURL: ROOT_PARENT_URL,
				});
			}
		}
		return nextResolve(specifier, context);
	},
});

// ── 统一加载器：任何上游模块挂了都给出可执行的排查指引，而不是裸栈 ──
/**
 * 动态加载一个内核或 CLI 子模块；任何上游模块挂了，都给出可执行的排查指引而不是裸栈。
 *
 * @typeParam T - 模块类型，以 `typeof import("...")` 的别名传入（如 `AlgorithmModule`）
 * @param spec - 模块说明符；解析交给上方 `registerHooks` 注册的钩子（`@/...` 或裸包名）
 * @returns 加载到的模块命名空间
 *
 * @remarks
 * **所有内核模块与 `scripts/cli/*` 子模块都必须经由本函数加载**（见文件顶部注释：钩子注册前
 * 不允许出现普通静态 import）。`spec` 是变量，TS 推不出模块类型，故由调用方以
 * `load<Module 类型>()` 指定；`as T` 断言只影响类型层，运行时的解析仍由 `registerHooks` 决定。
 *
 * ⚠️ 失败时**不抛错，而是打印排查指引后 `process.exit(1)`** —— 所以调用点拿到的返回值必然非空，
 * 也就不必再写 try/catch。指引分两支：依赖未装（在 skill 根执行 `npm install`）与 Node 版本过低
 * （需 ≥ 22.15，`registerHooks` 不可用或 TS 语法报错即属此类）。
 */
async function load<T>(spec: string): Promise<T> {
	try {
		return (await import(spec)) as T;
	} catch (err) {
		console.error(
			`[ziwei 启动失败] 无法加载 ${spec}\n  ${(err as Error).message}\n` +
				`  当前内核根：${ROOT}（来源：${ROOT_LABEL}）\n` +
				`  → Cannot find module 'iztro' / 'lunar-typescript'：依赖未装。\n` +
				`     在 skill 根（${resolve(ROOT, "..")}）执行 npm install 即可（依赖清单见该目录 package.json）\n` +
				`  → registerHooks is not a function 或 TS 语法报错：Node 版本过低，需 ≥ 22.15（当前 ${process.version}）`
		);
		process.exit(1);
	}
}

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

const { parseArgs } = await load<ArgsModule>("@/cli/args");
const { COMMANDS } = await load<CommandsModule>("@/cli/commands");

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
 * 帮助文本（无参数、`help`、`--help`、`-h` 时打印）。
 *
 * @remarks
 * ⚠️ 内容必须与 `scripts/cli/commands.ts` 的 `COMMANDS` 表及各命令的实际参数保持一致；
 * CLI 改了参数名或输出格式，这里要同步改 —— `SKILL.md` 同理，否则 Claude 会照着过时的说明调用。
 */
const HELP = `紫微斗数 CLI —— 复用 scripts/ 下的排盘内核与知识库

用法：node scripts/purple-star.ts <command> [options]

命令：
  analyze    解读用完整输入包（命盘 + 十二宫一览 + 格局 + 四化 + 大限）★ 最常用
  chart      纯排盘十二宫
  heming     合盘（双宫联参 + 夫妻宫断语 + 方法论）
  classics   古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）
  nihai      倪海厦天纪 / 地纪 / 人纪知识
  stars      星曜释义
  cities     城市经纬度查询（真太阳时校正用）
  selftest   回归自检（农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）

出生日期（三选一；heming 加 a- / b- 前缀）：
  --date  YYYY-MM-DD   公历生日
  --lunar YYYY-MM-DD   农历生日（脚本自动换算，勿与 --date 同用）
  --leap               配合 --lunar，表示闰月
  --year / --month / --day   公历生日（分写）

出生时辰（二选一）：
  --time HH:MM         钟表时间（配合 --lng / --city 自动换算真太阳时）
  --branch 0-12        直接指定时辰支（0=子 … 11=亥；12=晚子时），与 --time 二选一
  --late-zi            配合 --time：23:00–23:59 出生改按「晚子时算次日」排
  --eot                配合 --time：真太阳时额外计入均时差（±16 分），默认不计
                       ※ 真太阳时跨过午夜时，出生日期会自动回退/顺延一天，
                         输出里会写明「已跨过午夜，出生日期…」。这是正确行为。

其他出生信息：
  --gender male|female
  --lng 116.4          出生地经度（默认 120，即不做经度校正）
  --city 北京          用城市名代替 --lng（容错「石家庄市」「石家庄地区」等写法）
  --province 山东      用省份代替 --lng（按省会计）
  --name 张三          可选

输出选项：
  --json              输出原始 JSON（供程序消费）
  --liunian 2027      analyze 时指定流年（默认今年）。勿用 --year，那是出生年
  --liuyue 6          analyze 时追加农历 6 月的流月四化（需先有流年）
  --focus 财帛        analyze 时额外展开指定宫位

⚠️ 晚子时：23:00–23:59 出生时，子时横跨两日，【当日早子时】与【晚子时算次日】
   排出的是两张不同的盘。复核请加 --late-zi 或 --branch 12。

示例：
  # 单人解读（公历）
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
  node scripts/purple-star.ts selftest
`;

/**
 * CLI 入口：取命令名 → 查 `COMMANDS` 表 → 解析参数 → 打印命令的返回值。
 *
 * @remarks
 * `console.log` 只在这一处发生 —— 七个 `cmdXxx` 一律**返回**已渲染好的文本字符串，由这里统一输出。
 *
 * 无参数、`help`、`--help`、`-h` 都打印 {@link HELP}；未知命令与命令内部抛出的错误都以非零码退出
 * （只打印 `err.message`，不打印栈）。传给命令的第二个参数是 `CliContext`（内核根及其来源），
 * 目前只有 `selftest` 用得上。
 *
 * ⚠️ 命令名直接来自 `argv`，故查表必然可能未命中 —— `COMMANDS` 的值类型显式带 `| undefined`。
 */
function main() {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
		console.log(HELP);
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
		console.log(fn(parseArgs(argv.slice(1)), { root: ROOT, rootLabel: ROOT_LABEL }));
	} catch (err) {
		console.error(`错误：${(err as Error).message}`);
		process.exit(1);
	}
}

main();
