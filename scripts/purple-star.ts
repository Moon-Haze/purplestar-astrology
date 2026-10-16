#!/usr/bin/env node
/**
 * purple-star.ts — 紫微斗数排盘与命盘解读 CLI（入口 / 引导层）
 *
 * 本文件只做四件事：**定位内核根 → 注册 TS 解析钩子 → 启动期内核自检 → 把命令分发出去**
 * （分发协议本体在 `cli/host/dispatch.ts`，此处只组装端口并执行副作用）。
 * 命令实现、渲染、出生信息解析、自检都**不在**这里，见 scripts/cli/。
 *
 * ⚠️ 本文件除 `node:` 内置与 `./boot-hooks.ts` 外**不允许任何普通静态 import** ——
 *    值的获取一律走 `load<T>()`（详见下方铁律三连与 docs/code/boot-layer.md）。
 * ⚠️ 内核根 = `scripts/` 本身，故 `@/` 别名指向 `scripts/` 而**不是** skill 根。
 * ⚠️ 启动自检「派生而非手抄」：在内核里重命名 / 删除导出会让 CLI 立刻报错 ——
 *    这是有意的（宁可启动失败，也不静默产出错盘）。
 *
 * 设计原则（不重复实现任何命理逻辑）、cli/ 各层分工与用法，见 docs/code/boot-layer.md。
 *
 * @packageDocumentation
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ⚠️ 引导层**唯一**被允许的非 `node:` 静态 import：该文件自身只依赖 `node:` 内置，且调用点
//    用的是带 `.ts` 扩展名的说明符，靠 Node 原生类型擦除即可加载，**不需要解析钩子**。
//    铁律的实质不是「禁止静态 import」，而是「禁止在钩子注册前触发 `.ts` 解析」——
//    `cli/selftest/index.ts` 有一条断言盯着 boot-hooks.ts 的 import 全是 `node:` 前缀。
import { installHooks, loadFailureHint, makeLoader, pickRoot } from "./boot-hooks.ts";

// ── 类型层：`import type` 与 `typeof import(...)` 在运行时被**完全擦除**，不产生任何静态依赖 ──
// 这是本文件能同时「自举注册 TS 钩子」与「拿到内核/子模块类型」的关键：ESM 的静态 import
// 会被提升到模块求值之前，若用普通 import 引内核或 scripts/cli/*，钩子还没注册、对方的
// .ts 就已经要加载了。类型节点擦除后什么都不剩，故安全。
//
// ⚠️ 因此：**本文件里除 `node:` 内置模块与 ./boot-hooks.ts 外，不允许出现任何普通静态 import**
//    —— `scripts/cli/` 下的自家子模块也不行。凡是要用的值，一律走下面的 load<T>()。
//    这是本文件最容易被改坏的一处，论证全文见 docs/code/boot-layer.md。

/**
 * 动态导入的模块类型：下方 `load<T>()` 用它把 `await import(spec)` 的 `any` 收窄回真实签名。
 *
 * @remarks
 * `typeof import("...")` 是**类型层节点**，运行时被完全擦除，因此可以安全地写在文件顶部 ——
 * 这是本文件能同时「自举注册 TS 钩子」与「拿到内核真实类型」的关键（详见上方注释）。
 *
 * ⚠️ 这里只允许类型层的 `typeof import(...)`：任何**值导入**都会在钩子注册之前触发加载，
 * 直接崩掉。
 */
type AlgorithmModule = typeof import("@/algorithm");
type PatternsModule = typeof import("@/patterns");
type SihuaModule = typeof import("@/mutagen");
type DataModule = typeof import("@/data");
type CitiesModule = typeof import("@/cli/birth/cities");
type ClassicsModule = typeof import("@/corpus");
type ChartViewModule = typeof import("@/synastry/chart-view");
type ArgsModule = typeof import("@/cli/args");
type ArgsTableModule = typeof import("@/cli/args/table");
type CommandsModule = typeof import("@/cli/commands");
/** 轻量命令元数据（名字与 HELP 文案，无命令实现依赖）——help 路径只需它。 */
type MetaModule = typeof import("@/cli/commands/command-meta");
/** `--out` 落盘通道（writeFileSync 的唯一写点，路径校验在内）。 */
type OutModule = typeof import("@/cli/host/out");
/** 分发协议（argv → 三元组的唯一真相源，见该文件头注释）。 */
type DispatchModule = typeof import("@/cli/host/dispatch");

// 历史注记：这里曾有一段 `process.emitWarning` 猴子补丁（过滤
// `MODULE_TYPELESS_PACKAGE_JSON`），随上游 ziwei-master（Next.js，不能改 package.json 的
// "type"）拷贝带了过来；本仓库已声明 "type": "module"，告警不触发，补丁是死代码，已删除。

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
 * 内核根 = `scripts/` **本身**：CLI（`purple-star.ts`、`cli/`）与内核文件（`algorithm.ts` 等）
 * 同处一层。因此 `@/` 别名指向的是 `scripts/`，而**不是** skill 根。
 *
 * 这里刻意**没有**「宿主项目」候选：每个 skill 自带内核，不存在「实时内核 vs 分发副本」
 * 的双模式。（本仓已无 skill 间的副本关系 —— 见 `CLAUDE.md`「三个 skill 之间没有关系」。）
 * 两级优先级的完整论证见 docs/code/boot-layer.md。
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
 * 根本没有内核入口 `algorithm.ts`（见 `CLAUDE.md` 的「skill 的布局」）。
 */
const KERNEL_ENTRY = "algorithm.ts";

const picked = pickRoot(ROOT_CANDIDATES, KERNEL_ENTRY);

if (!picked.root) {
	console.error(
		`[ziwei 启动失败] 找不到排盘内核（${KERNEL_ENTRY}）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			"\n" +
			`  处理：\n` +
			`    ① 确认 skill 目录完整 —— scripts/ 下应同时有 purple-star.ts、cli/ 与内核文件 algorithm.ts（拷贝时漏带内核会走到这里）；或\n` +
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
	const algorithmNs = await load<AlgorithmModule>("@/algorithm");
	const patternsNs = await load<PatternsModule>("@/patterns");
	const sihuaNs = await load<SihuaModule>("@/mutagen");
	const dataNs = await load<DataModule>("@/data");
	const citiesNs = await load<CitiesModule>("@/cli/birth/cities");
	const lunarNs = await load<typeof import("lunar-typescript")>("lunar-typescript");
	// corpus / synastry 的入口模块：分别对应知识检索与合盘两条命令的内核
	const classicsNs = await load<ClassicsModule>("@/corpus");
	const chartViewNs = await load<ChartViewModule>("@/synastry/chart-view");

	const argsNs = await load<ArgsModule>("@/cli/args");
	const argsTableNs = await load<ArgsTableModule>("@/cli/args/table");
	const commandsNs = await load<CommandsModule>("@/cli/commands");
	const helpMod = await load<typeof import("@/cli/commands/help")>("@/cli/commands/help");

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
	 * ⚠️ 也因此：在内核里重命名或删除导出会让 CLI 立刻报错 —— **这是有意的，不是脆弱**
	 *    （与 `algorithm.ts` 的 `projectPalaceName` 同一理念：宁可启动失败，也不静默产出错盘）。
	 */
	const LOADED: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
		["@/algorithm", algorithmNs],
		["@/patterns", patternsNs],
		["@/mutagen", sihuaNs],
		["@/data", dataNs],
		["@/cli/birth/cities", citiesNs],
		["lunar-typescript", lunarNs],
		["@/corpus", classicsNs],
		["@/synastry/chart-view", chartViewNs],
		["@/cli/args", argsNs],
		["@/cli/args/table", argsTableNs],
		["@/cli/commands", commandsNs],
		["@/cli/commands/help", helpMod],
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
 * CLI 入口：把 argv 交给分发协议，按结果执行副作用（打印 / 落盘 / 退出）。
 *
 * @remarks
 * 分发协议本体（--help 拦截位置、查表、解析、错误前缀、退出码语义）在
 * `cli/host/dispatch.ts` —— 进程内测试与子进程真链路消费同一 seam，此处只做宿主侧：
 * 组装端口（惰性 loader + 上下文）→ 得到 `{ code, out, err, outFile }` →
 * 失败打 stderr 并按 code 退出；成功时 `--out <文件>` 走 {@link writeOutFile} 落盘
 * （正文不占 stdout，进度提示走 stderr），否则 `console.log`。
 *
 * 各 `cmdXxx` 一律**返回**已渲染好的文本字符串；传给命令的第二个参数是
 * `CliContext`（内核根及其来源），目前只有 `selftest` 用得上。
 *
 * ⚠️ `--help` 任何位置都生效、未知命令 exit 1 不带栈 —— 这些承诺的**定义处**在
 * dispatch.ts，本函数不重复实现它们。
 */
async function main() {
	const argv = process.argv.slice(2);
	const { dispatch, formatError } = await load<DispatchModule>("@/cli/host/dispatch");
	const result = await dispatch(argv, {
		ctx: { root: ROOT, rootLabel: ROOT_LABEL },
		loadCore,
		// help 路径只加载轻模块（command-meta + help，均不依赖命令实现），不为看一眼
		// 用途付出 iztro 冷启动。
		loadHelp: async () => {
			const metaNs = await load<MetaModule>("@/cli/commands/command-meta");
			const helpLite = await load<typeof import("@/cli/commands/help")>("@/cli/commands/help");
			return {
				renderOverviewHelp: () => helpLite.renderOverviewHelp(),
				renderCommandHelp: (cmd: string) =>
					helpLite.renderCommandHelp(
						cmd as Parameters<typeof helpLite.renderCommandHelp>[0]
					),
				commandNames: metaNs.COMMAND_NAMES as readonly string[],
			};
		},
	});
	if (result.code !== 0) {
		console.error(result.err);
		process.exit(result.code);
	}
	// 输出通道二选一：--out 落盘（正文不再占 stdout，进度提示走 stderr）或 console.log。
	// 落盘是宿主副作用，同样要包住：writeOutFile 的路径校验抛错必须走「错误：」+ exit 1，
	// 裸栈出逃会让冒烟断言的 stderr 前缀断言变红。
	if (result.outFile !== undefined) {
		try {
			const { writeOutFile } = await load<OutModule>("@/cli/host/out");
			writeOutFile(result.outFile, result.out);
			console.error(`已写入 ${result.outFile}`);
		} catch (err) {
			console.error(formatError(err));
			process.exit(1);
		}
	} else {
		console.log(result.out);
	}
}

main();
