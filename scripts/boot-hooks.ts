/**
 * @file 引导机制：内核根定位 / TS 解析钩子 / 加载失败指引。
 * @packageDocumentation
 */

import { registerHooks } from "node:module";
import type { ResolveHookSync } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/** 命中根。@remarks 判别联合，解构即收窄 string。 */

// 回归通道已删（--test-name-pattern）；残留按「不静默忽略无效输入」报错。

/** 已退役变量名单：残留即拒收。 */
export const RETIRED_ENV_VARS = ["ZIWEI_NO_CACHE", "ZIWEI_TEST_YEAR"] as const;

/** 返回现存退役变量。@returns 命中清单，无则 [] */
export function retiredEnvVars(): string[] {
	return RETIRED_ENV_VARS.filter(k => process.env[k] !== undefined);
}

/** 命中根：路径、来源、候选。 */
export interface RootFound {
	/** 内核根(scripts/) */
	root: string;
	/** 来源(如「技能自带内核」「ZIWEI_ROOT 环境变量」) */
	label: string;
	/** 已试候选 */
	tried: string[];
}

/** 全不成立；tried 已试。 */
export interface RootMissing {
	/** 恒 null：收窄失败分支 */
	root: null;
	/** 恒 null：未命中无来源 */
	label: null;
	/** 已试(来源:目录) */
	tried: string[];
}

/** 定位结果：命中({@link RootFound})或未命中({@link RootMissing})。 */
export type RootPick = RootFound | RootMissing;

/**
 * 定位内核根。@param candidates - 候选 @param probe - 入口 @returns 首个命中
 * @remarks 判据「该目录下存在 `probe`」；probe 由调用方给，免误判「找不到排盘内核」；「入口在即命中」仅此一份。
 */
export function pickRoot(candidates: Array<[string | undefined, string]>, probe: string): RootPick {
	const tried: string[] = [];
	for (const [dir, label] of candidates) {
		if (!dir) {
			continue;
		}
		if (existsSync(resolve(dir, probe))) {
			return { root: dir, label, tried };
		}
		tried.push(`${label}：${dir}`);
	}
	return { root: null, label: null, tried };
}

/**
 * 解析钩子：`@/` 指内核根，相对补 .ts，裸包名从内核根解析。@param root - 根 @returns 同步钩子
 * @remarks 两分支候选序须一致：`<spec>.ts` 优先、`<spec>/index.ts` 兜底，否则 tsc 抓不住；见 docs/code/boot-layer.md。
 */
export function makeResolveHook(root: string): ResolveHookSync {
	// 裸包名 parentURL：「内核根/package.json」

	const rootParentUrl = pathToFileURL(resolve(root, "package.json")).href;

	return (specifier, context, nextResolve) => {
		if (specifier.startsWith("@/")) {
			const base = resolve(root, specifier.slice(2));
			// 原样→<base>.ts→<base>/index.ts
			const target = existsSync(base + ".ts")
				? base + ".ts"
				: existsSync(resolve(base, "index.ts"))
					? resolve(base, "index.ts")
					: base;
			return nextResolve(pathToFileURL(target).href, context);
		}
		if (specifier.startsWith(".")) {
			if (!/\.[cm]?[jt]s$/.test(specifier)) {
				const base = specifier.replace(/\/+$/, "");
				try {
					return nextResolve(specifier + ".ts", context);
				} catch {
					/* 不是 TS 文件 */
				}
				try {
					return nextResolve(`${base}/index.ts`, context);
				} catch {
					/* 也非目录模块，落回默认 */
				}
			}
			return nextResolve(specifier, context);
		}
		// 裸包名(含 @scope/pkg)从内核根解析

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
 * 注册解析钩子。@param root - 根 @returns 无
 * @remarks 免记「传进去的键叫 resolve」；挂进 ESM 链，走 {@link makeResolveHook}
 */
export function installHooks(root: string): void {
	registerHooks({ resolve: makeResolveHook(root) });
}

/** 加载失败事实，交 onFailure。 */
export interface LoadFailure {
	/** 失败的模块说明符 */
	spec: string;
	/** 底层错误 */
	error: Error;
	/** 当前内核根 */
	root: string;
	/** 来源描述 */
	label: string;
}

/**
 * 造「带类型锚定的动态加载器」，失败交 onFailure。@param root - 根 @param label - 来源 @param onFailure - 失败策略不返回
 * @returns load<T>(spec)，类型调用方给
 * @remarks spec 推不出类型故 load<Module>()；as T 仅类型层，运行时由 {@link makeResolveHook} 定。
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
 * 失败指引公共部分：依赖未装 / Node 版本过低，外加内核根。@param f - 失败事实 @returns 指引(不含首行「无法加载 xxx」)
 * @remarks 首行与处理各异，排查方向共用，即「机制共用、策略各异」的分界。
 */
export function loadFailureHint(f: LoadFailure): string {
	return (
		`  当前内核根：${f.root}（来源：${f.label}）\n` +
		`  → Cannot find module 'iztro' / 'lunar-typescript'：依赖未装。\n` +
		`     在 skill 根（${resolve(f.root, "..")}）执行 npm install 即可（依赖清单见该目录 package.json）\n` +
		`  → registerHooks is not a function 或 TS 语法报错：Node 版本过低，需 ≥ 22.18（当前 ${process.version}）`
	);
}
