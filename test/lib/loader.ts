// ── 测试用的排盘内核加载器 ──
//
// 引导机制（内核根定位 / TS 解析钩子 / 动态加载）与 CLI **共用** scripts/boot-hooks.ts 一份实现，
// 本文件只提供测试特有的**策略**，两处：
//
//   1. 内核根候选的**起点**是 <skill 根>/scripts（CLI 的起点是脚本自身所在目录）
//   2. 加载失败**抛错**而非退出进程 —— 让 node:test 把失败归到具体用例，
//      而不是让整个测试进程带着 exit(1) 消失
//
// 为什么第 2 条不再构成「必须各存一份副本」的理由：它与「怎么解析 .ts」「内核根怎么找」
// 是两件事。boot-hooks.ts 把这些差异收进 `onFailure` 与 `candidates` 两个入参，
// 机制仍只有一份。
//
// 历史：本文件曾是 purple-star.ts 里 pickRoot / registerHooks / load 三者的**逐行副本**，
// 靠注释提醒「两者必须保持行为一致」，只有 test/cli.test.ts 一条断言间接盯着。
// 副本分叉不会被任何测试抓住 —— 它只影响「测试怎么观察内核」，测试本身照旧全绿。
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ⚠️ 带 `.ts` 扩展名，且 boot-hooks.ts 只依赖 `node:` 内置 —— 故本行在解析钩子注册之前
//    就能被 Node 的原生类型擦除加载。改动本行前先读 scripts/boot-hooks.ts 的顶部注释。
import { installHooks, loadFailureHint, makeLoader, pickRoot } from "../../scripts/boot-hooks.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/lib

// ── 内核根定位：两级优先级 ──
const picked = pickRoot([
	[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
	[resolve(HERE, "../../scripts"), "技能自带内核"],
]);

if (!picked.root) {
	throw new Error(
		`找不到排盘内核（ziwei/algorithm.ts）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			`\n  处理：确认 <skill 根>/scripts/ 下同时有 purple-star.ts 与 ziwei/、classics/，` +
			`或用 ZIWEI_ROOT=<含 ziwei/ 的目录> 指定内核位置。`
	);
}

export const ROOT: string = picked.root;
export const ROOT_LABEL: string = picked.label;

installHooks(ROOT);

// ── 加载器：与 CLI 同一份机制，策略换成「抛错」 ──
/**
 * 动态加载内核或 CLI 子模块；失败时抛错并带上排查指引。
 *
 * @remarks
 * 与 `scripts/purple-star.ts` 的同名加载器共用 `./boot-hooks.ts` 的 `makeLoader`，
 * 唯一差别是 `onFailure` 策略：此处**抛错**（归到具体用例），CLI 那边退出进程。
 * 排查指引本身（依赖未装 / Node 版本过低）也共用 `loadFailureHint()`。
 */
export const load = makeLoader(ROOT, ROOT_LABEL, f => {
	throw new Error(`无法加载 ${f.spec}\n  ${f.error.message}\n${loadFailureHint(f)}`);
});

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
