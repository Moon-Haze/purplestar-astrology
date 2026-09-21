// ── 测试用的排盘内核加载器 ──
//
// ⚠️ 本文件是 scripts/purple-star.ts 里 pickRoot / registerHooks / load 三者的**副本**，两者必须保持行为一致。
//    这里刻意用函数名而非行号定位：CLI 已按职责拆进 scripts/cli/，行号是漂移最快的东西。
//    刻意不抽成共享模块：CLI 的加载器带 CLI 特有的错误处理（console.error + process.exit(1)），
//    而测试场景需要**抛错**而非退出进程 —— 抽共享模块会让两边都被对方的错误处理污染。
//    若 CLI 的 registerHooks 或 pickRoot 有改动，请同步本文件；test/cli.test.ts 里有一条
//    断言（内核直调结果 ≡ CLI --json 子进程输出）专门盯着两侧不漂移。
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/lib

// ── 内核根定位：与 CLI 同为两级优先级 ──
// 探测标志是 ziwei/algorithm.ts（内核的入口文件），缺了它说明目录不完整。
// 刻意用判别联合而非 `root: string | null` 一把抓：命中分支里 label 必然非空，
// 解构处无须非空断言即可拿到收窄后的 string。
interface RootFound {
	root: string;
	label: string;
	tried: string[];
}
interface RootMissing {
	root: null;
	label: null;
	tried: string[];
}

function pickRoot(): RootFound | RootMissing {
	const tried: string[] = [];
	const candidates: Array<[string | undefined, string]> = [
		[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
		[resolve(HERE, "../../scripts"), "技能自带内核"],
	];
	for (const [dir, label] of candidates) {
		if (!dir) continue;
		if (existsSync(resolve(dir, "ziwei/algorithm.ts"))) return { root: dir, label, tried };
		tried.push(`${label}：${dir}`);
	}
	return { root: null, label: null, tried };
}

const picked = pickRoot();

if (!picked.root) {
	throw new Error(
		`找不到排盘内核（ziwei/algorithm.ts）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			`\n  处理：确认 <skill 根>/scripts/ 下同时有 purple-star.ts 与 ziwei/、classics/、nihai/，` +
			`或用 ZIWEI_ROOT=<含 ziwei/ 的目录> 指定内核位置。`
	);
}

const { root: ROOT, label: ROOT_LABEL } = picked;

export { ROOT, ROOT_LABEL };

// ── 解析钩子：@/ 别名指向内核根，相对导入补 .ts，裸包名从内核根解析 ──
// `@/xxx` 的 @ 是**内核根**（scripts/）而非 skill 根：`@/ziwei/algorithm` → scripts/ziwei/algorithm.ts。
// 裸包名重定向的意义：脱离项目运行时从文件位置向上找不到 node_modules，
// 必须显式把 iztro / lunar-typescript 指到内核根去解析。
const ROOT_PARENT_URL = pathToFileURL(resolve(ROOT, "package.json")).href;

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier.startsWith("@/")) {
			const base = resolve(ROOT, specifier.slice(2));
			// 依次尝试：原样 → <base>.ts → <base>/index.ts（目录导入兜底）
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
		if (!specifier.startsWith("node:")) {
			const pkgName = specifier.startsWith("@")
				? specifier.split("/").slice(0, 2).join("/")
				: specifier.split("/")[0];
			if (existsSync(resolve(ROOT, "node_modules", pkgName))) {
				return nextResolve(specifier, { ...context, parentURL: ROOT_PARENT_URL });
			}
		}
		return nextResolve(specifier, context);
	},
});

// 与 CLI 不同：加载失败直接抛错并带上排查指引，不退进程 —— 让 node:test 把失败归到具体用例。
export async function load<T>(spec: string): Promise<T> {
	try {
		return (await import(spec)) as T;
	} catch (err) {
		throw new Error(
			`无法加载 ${spec}\n  ${err instanceof Error ? err.message : String(err)}\n` +
				`  当前内核根：${ROOT}（来源：${ROOT_LABEL}）\n` +
				`  → Cannot find module 'iztro' / 'lunar-typescript'：依赖未装，在 skill 根执行 npm install\n` +
				`  → registerHooks is not a function 或 TS 语法报错：Node 版本过低，需 ≥ 22.15（当前 ${process.version}）`
		);
	}
}

// ── 内核模块入口 ──
// 每次调用都走 import()，命中 ESM 缓存，无重复解析开销。
// 返回类型用 `typeof import("@/…")` 静态锚定：tsconfig 的 paths 让 tsc 把 `@/` 解析到
// scripts/ 下的真实模块（从而拿到**真实导出签名**，内核签名变了这里跟着红）；
// 运行时该类型整体擦除，实际加载仍走上面的动态 import + 解析钩子。
// ⚠️ `load<T>()` 是字符串动态导入，tsc 本不检查 —— 类型锚定全靠这里的 typeof import，
//    这正是 CLI 引导层同款模式（详见 .claude/CLAUDE.md「CLI 如何既自举又拿到内核类型」）。
export const loadAlgorithm = () => load<typeof import("@/ziwei/algorithm")>("@/ziwei/algorithm");
export const loadConstants = () => load<typeof import("@/ziwei/constants")>("@/ziwei/constants");
export const loadPatterns = () => load<typeof import("@/ziwei/patterns")>("@/ziwei/patterns");
export const loadSihua = () => load<typeof import("@/ziwei/sihua")>("@/ziwei/sihua");
export const loadRender = () => load<typeof import("@/cli/render")>("@/cli/render");

/** 一次性取回测试最常用的符号。 */
export async function loadKernel() {
	const [algo, constants] = await Promise.all([loadAlgorithm(), loadConstants()]);
	return { ...algo, ...constants };
}
