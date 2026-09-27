/**
 * 引导机制 —— 内核根定位 / TS 解析钩子 / 带排查指引的模块加载。
 *
 * 本模块是**纯机制**：它只回答「内核根在哪」「怎么解析 .ts」「加载失败时把哪些事实交给调用方」，
 * 至于「失败之后是退出进程还是抛错」，由调用方以 `onFailure` 策略传入。
 *
 * 两个调用方让这个 seam 是**真实**的，而不是假想的：
 *   - `scripts/purple-star.ts`（CLI）—— 失败即渲染指引并 `process.exit(1)`
 *   - `test/lib/loader.ts`（回归测试）—— 失败即抛错，让 node:test 把失败归到具体用例
 *
 * 此前这两份是逐行副本，靠注释提醒「必须保持行为一致」，只有一条断言间接盯着。
 * 副本分叉不会被任何测试抓住：它只影响「怎么观察内核」，测试本身照旧全绿。
 *
 * ## ⚠️ 本文件只允许 import `node:` 内置模块
 *
 * 这是它能在**解析钩子注册之前**被静态 import 的唯一理由，也是引导层那条
 * 「不得出现普通静态 import」规则的全部动机 —— 那条规则的实质不是「禁止静态 import」，
 * 而是「禁止在钩子注册前触发 `.ts` 解析」。
 *
 * 本文件自身不依赖任何 `.ts` 解析：调用方必须用**带 `.ts` 扩展名**的说明符 import 它
 * （`import { … } from "./boot-hooks.ts"`），Node 的原生类型擦除即可加载，不需要钩子。
 * `cli/selftest.ts` 有一条断言盯着这条约束不被破坏。
 *
 * @packageDocumentation
 */

import { registerHooks } from "node:module";
import type { ResolveHookSync } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// ── 内核根定位 ──────────────────────────────────────────────

/**
 * 命中内核根。
 *
 * @remarks
 * 刻意用判别联合而非 `root: string | null` 一把抓：命中分支里 `label` 必然非空，
 * 调用点解构后无须非空断言即可拿到收窄后的 `string`。
 */
export interface RootFound {
	root: string;
	label: string;
	/** 已尝试过的候选清单，供失败时逐条列给用户 */
	tried: string[];
}

/** 全部候选都不成立。`tried` 是已尝试过的候选清单。 */
export interface RootMissing {
	root: null;
	label: null;
	tried: string[];
}

export type RootPick = RootFound | RootMissing;

/**
 * 按优先级定位内核根目录（`scripts/`）。
 *
 * @param candidates - `[目录, 来源描述]` 的有序候选；目录为 `undefined` 的项被跳过
 * @param probe - 该 skill 的内核入口文件（相对内核根），如排盘解读的 `ziwei/algorithm.ts`、
 *   古籍检索的 `index.ts`
 * @returns 命中的第一个候选；`root` 为 `null` 表示全部不成立
 *
 * @remarks
 * 判定依据是「该目录下存在 `probe`」（**该 skill 的**内核入口文件），而非目录本身是否存在
 * —— 拷贝时漏带内核的目录会走到失败分支，且错误信息能点名缺的是哪一份内核。
 *
 * `probe` 由调用方给出而非在此写死，是**各 skill 各有各的内核**带来的（2026-09-27 拆分）：
 * 古籍检索 skill 里根本没有 `ziwei/`，拿排盘内核的入口去判定它，只会得到一句
 * 「找不到排盘内核」的误导信息。判定规则（「入口在即命中」）仍然只有这一份实现。
 *
 * 候选**由调用方给出**同样是刻意的：CLI 的第一候选是脚本自身所在目录，
 * 测试则是 `<skill 根>/scripts`，两者的起点不同，而判定规则相同。
 */
export function pickRoot(candidates: Array<[string | undefined, string]>, probe: string): RootPick {
	const tried: string[] = [];
	for (const [dir, label] of candidates) {
		if (!dir) continue;
		if (existsSync(resolve(dir, probe))) return { root: dir, label, tried };
		tried.push(`${label}：${dir}`);
	}
	return { root: null, label: null, tried };
}

// ── TS 解析钩子 ────────────────────────────────────────────

/**
 * 构造解析钩子：`@/` 别名指向内核根，相对导入补 `.ts`，裸包名从内核根解析。
 *
 * @param root - 内核根（即 `scripts/`）
 * @returns 可直接交给 `registerHooks` 的同步解析钩子
 *
 * @remarks
 * `@/xxx` 的 `@` 是**内核根**（`scripts/`）而非 skill 根：
 * `@/ziwei/algorithm` → `scripts/ziwei/algorithm.ts`。
 *
 * ⚠️ **两条分支的候选序必须一致**：`<spec>.ts` 优先，`<spec>/index.ts` 兜底。
 * 相对分支原先只有前半条，于是「文件夹模块」在两条路径上行为分叉 ——
 * `@/ziwei/patterns` 能解析到 `patterns/index.ts`，而 `./patterns` 会在运行时
 * `ERR_UNSUPPORTED_DIR_IMPORT`。**且 tsc 抓不住**：`moduleResolution: "bundler"`
 * 会把 `./patterns` 正常解析到 `patterns/index.ts`，于是类型全绿、只有真跑才崩。
 * 补上兜底后，`.ts` 文件仍优先于同名目录，故既有引用一条都不会改变解析目标。
 *
 * 裸包名重定向的意义：脱离项目运行时从文件位置向上找不到 `node_modules`，
 * 必须显式把 iztro / lunar-typescript 指到内核根去解析。
 *
 * ⚠️ 钩子必须在**任何内核模块被求值之前**注册：ESM 的静态 import 会被提升到模块求值之前。
 */
export function makeResolveHook(root: string): ResolveHookSync {
	// 裸包名重定向所用的 parentURL：「内核根/package.json」。该文件通常不存在，无妨 ——
	// Node 会自它向上逐级查找 node_modules，最终命中 skill 根的 node_modules/。
	const rootParentUrl = pathToFileURL(resolve(root, "package.json")).href;

	return (specifier, context, nextResolve) => {
		if (specifier.startsWith("@/")) {
			const base = resolve(root, specifier.slice(2));
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
				// 与上面 `@/` 分支**同一条候选序**：`<spec>.ts` 优先，`<spec>/index.ts` 兜底
				// （目录导入兜底，同样为了避免 ERR_UNSUPPORTED_DIR_IMPORT）。
				// ⚠️ 顺序不可颠倒：`./x.ts` 必须胜过 `./x/index.ts`。
				const base = specifier.replace(/\/+$/, "");
				try {
					return nextResolve(specifier + ".ts", context);
				} catch {
					/* 不是 TS 文件 */
				}
				try {
					return nextResolve(`${base}/index.ts`, context);
				} catch {
					/* 也不是目录模块，落回默认解析 */
				}
			}
			return nextResolve(specifier, context);
		}
		// 裸包名（含 @scope/pkg）：若内核根的 node_modules 里有，就从内核根解析，
		// 摆脱对 cwd 与文件位置的依赖。
		if (!specifier.startsWith("node:")) {
			const pkgName = specifier.startsWith("@")
				? specifier.split("/").slice(0, 2).join("/")
				: specifier.split("/")[0];
			if (existsSync(resolve(root, "node_modules", pkgName))) {
				return nextResolve(specifier, { ...context, parentURL: rootParentUrl });
			}
		}
		return nextResolve(specifier, context);
	};
}

/**
 * 注册解析钩子。等价于 `registerHooks({ resolve: makeResolveHook(root) })`。
 *
 * @param root - 内核根（即 `scripts/`）
 *
 * @remarks
 * 包装成一步是为了让调用点不必各自记住「传进去的键叫 resolve」——
 * 两个调用方都只需 `installHooks(ROOT)`。
 */
export function installHooks(root: string): void {
	registerHooks({ resolve: makeResolveHook(root) });
}

// ── 模块加载 ───────────────────────────────────────────────

/** 一次加载失败的全部事实，交给调用方的 `onFailure` 策略决定怎么呈现。 */
export interface LoadFailure {
	/** 加载失败的模块说明符 */
	spec: string;
	/** 底层错误 */
	error: Error;
	/** 当前内核根 */
	root: string;
	/** 内核根的来源描述，如「技能自带内核」「ZIWEI_ROOT 环境变量」 */
	label: string;
}

/**
 * 造一个「带类型锚定的动态加载器」，失败时把事实交给 `onFailure`。
 *
 * @param root - 内核根，用于失败指引
 * @param label - 内核根来源描述，用于失败指引
 * @param onFailure - **策略**：拿到失败事实后怎么处理。必须不返回（退出或抛错）
 * @returns `load<T>(spec)` —— 泛型由调用方以 `typeof import("...")` 的别名指定
 *
 * @remarks
 * **所有内核模块与 `scripts/cli/*` 子模块都必须经由本函数加载**（见文件顶部注释：
 * 钩子注册前不允许出现会触发 `.ts` 解析的静态 import）。`spec` 是变量，TS 推不出模块类型，
 * 故由调用方以 `load<Module 类型>()` 指定；`as T` 断言只影响类型层，运行时的解析仍由
 * {@link makeResolveHook} 决定。
 *
 * `onFailure` 的返回类型是 `never`，故调用点拿到的返回值必然非空，不必再写 try/catch。
 */
export function makeLoader(
	root: string,
	label: string,
	onFailure: (f: LoadFailure) => never
): <T>(spec: string) => Promise<T> {
	return async function load<T>(spec: string): Promise<T> {
		try {
			return (await import(spec)) as T;
		} catch (err) {
			onFailure({ spec, error: err as Error, root, label });
		}
	};
}

/**
 * 失败指引的公共部分：依赖未装 / Node 版本过低两支，外加当前内核根。
 *
 * @param f - 失败事实
 * @returns 多行指引文本（不含首行「无法加载 xxx」）
 *
 * @remarks
 * 两个调用方的**首行与处理方式**不同（CLI 打 `[ziwei 启动失败]` 前缀后退出，测试直接抛错），
 * 但那两支排查方向是同一份知识，故在此共用 —— 这正是「机制共用、策略各异」的分界。
 */
export function loadFailureHint(f: LoadFailure): string {
	return (
		`  当前内核根：${f.root}（来源：${f.label}）\n` +
		`  → Cannot find module 'iztro' / 'lunar-typescript'：依赖未装。\n` +
		`     在 skill 根（${resolve(f.root, "..")}）执行 npm install 即可（依赖清单见该目录 package.json）\n` +
		`  → registerHooks is not a function 或 TS 语法报错：Node 版本过低，需 ≥ 22.15（当前 ${process.version}）`
	);
}
