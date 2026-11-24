#!/usr/bin/env node
/** @file @packageDocumentation 「派生而非手抄」 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ⚠️ 引导层**唯一**被允许的非 `node:` 静态 import：该文件自身只依赖 `node:` 内置，且调用点
//    用的是带 `.ts` 扩展名的说明符，靠 Node 原生类型擦除即可加载，**不需要解析钩子**。
//    铁律的实质不是「禁止静态 import」，而是「禁止在钩子注册前触发 `.ts` 解析」——
//    `cli/selftest/index.ts` 有一条断言盯着 boot-hooks.ts 的 import 全是 `node:` 前缀。
import {
	installHooks,
	loadFailureHint,
	makeLoader,
	pickRoot,
	retiredEnvVars,
} from "./boot-hooks.ts";

// ── 类型层：`import type` 与 `typeof import(...)` 在运行时被**完全擦除**，不产生任何静态依赖 ──
// 这是本文件能同时「自举注册 TS 钩子」与「拿到内核/子模块类型」的关键：ESM 的静态 import
// 会被提升到模块求值之前，若用普通 import 引内核或 scripts/cli/*，钩子还没注册、对方的
// .ts 就已经要加载了。类型节点擦除后什么都不剩，故安全。
//
// ⚠️ 因此：**本文件里除 `node:` 内置模块与 ./boot-hooks.ts 外，不允许出现任何普通静态 import**
//    —— `scripts/cli/` 下的自家子模块也不行。凡是要用的值，一律走下面的 load<T>()。
//    这是本文件最容易被改坏的一处，论证全文见 docs/code/boot-layer.md。

/** @remarks 「拿到内核真实类型」 */
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
/** 元数据 */
type MetaModule = typeof import("@/cli/commands/command-meta");
/** `--out` */
type OutModule = typeof import("@/cli/host/out");
/** 分发协议 */
type DispatchModule = typeof import("@/cli/host/dispatch");

// 历史注记：这里曾有一段 `process.emitWarning` 猴子补丁（过滤
// `MODULE_TYPELESS_PACKAGE_JSON`），随上游 ziwei-master（Next.js，不能改 package.json 的
// "type"）拷贝带了过来；本仓库已声明 "type": "module"，告警不触发，补丁是死代码，已删除。

/** 「架构」{@link pickRoot} */
const HERE = dirname(fileURLToPath(import.meta.url));

// ── 排盘内核根目录：两级优先级 ──
/** @remarks 「宿主项目」「实时内核 vs 分发副本」已无（「单 skill 形态（2026-09-30 三 skill 合一）」）。 */
const ROOT_CANDIDATES: Array<[string | undefined, string]> = [
	[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
	[HERE, "技能自带内核"],
];

/** @remarks 判「这份内核在不在」。 */
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

/** @remarks 收窄 RootFound。 */
const ROOT: string = picked.root;
const ROOT_LABEL: string = picked.label;

// ── 让 Node 直接加载 TS：解析 @/ 别名，补全省略的 .ts / index.ts，并把裸包名指向当前根 ──
// 钩子本体在 ./boot-hooks.ts（与 test/lib/loader.ts 共用同一份实现），此处只负责**注册时机**：
// 必须在任何内核模块被求值之前执行，见文件顶部注释。
installHooks(ROOT);

// ── 统一加载器：任何上游模块挂了都给出可执行的排查指引，而不是裸栈 ──
/** @remarks 失败呈现「渲染指引 + `process.exit(1)`」；test/lib/loader.ts 则「抛错」。 */
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
/** @remarks 不再「解构一份 + REQUIRED_EXPORTS 手抄第二份」。 */
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
	/** @remarks 全导出扫描；宁失败不静默出错盘。 */
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

/** @remarks 组装端口；CliContext 仅 selftest。 @link */
async function main() {
	// 已退役环境变量守卫（失败可见性）：读取点已删除，外壳残留只会被静默携带——
	// 当场报错而非放行。清单与探测函数单点在 boot-hooks（本文件与 run.ts 共用）。
	const retired = retiredEnvVars();
	if (retired.length > 0) {
		console.error(
			`已退役环境变量：${retired.join("、")}——其读取点已删除，不再有任何作用。` +
				"请从运行环境中移除后重试（缓存旁路与年份过滤已改走显式旗标）。"
		);
		process.exit(2);
	}
	const argv = process.argv.slice(2);
	const { dispatch, formatError } = await load<DispatchModule>("@/cli/host/dispatch");
	const result = await dispatch(argv, {
		ctx: { root: ROOT, rootLabel: ROOT_LABEL },
		loadCore,
		// help 路径只加载轻模块（command-meta + help，均不依赖命令实现），不为看一眼
		// 用途付出 iztro 冷启动。
		loadHelp: async () => {
			const metaNs = await load<MetaModule>("@/cli/commands/command-meta");
			const helpLite =
				await load<typeof import("@/cli/commands/help")>("@/cli/commands/help");
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
