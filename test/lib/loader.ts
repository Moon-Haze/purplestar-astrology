// ── 测试用的排盘内核加载器 ──
//
// 引导机制（内核根定位 / TS 解析钩子 / 动态加载）与 CLI **共用** boot-hooks.ts 一份实现，
// 本文件只提供测试特有的**策略**，两处：
//
//   1. 内核根候选的**起点**是排盘解读 skill 的 scripts/（CLI 的起点是脚本自身所在目录）
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
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// ⚠️ 带 `.ts` 扩展名，且 boot-hooks.ts 只依赖 `node:` 内置 —— 故本行在解析钩子注册之前
//    就能被 Node 的原生类型擦除加载。改动本行前先读 boot-hooks.ts 的顶部注释。
//
// ⚠️ 搬迁（2026-09-27）：内核已从仓库根 scripts/ 移入 skills/purplestar-astrology/scripts/。
//    本行是**字面相对路径**，不受解析钩子照顾 —— 挪内核时它是会静默失效的方向之一
//    （另一个是 tools/ 下同样写死路径的两处，见 CLAUDE.md「skill 的布局」）。
import { installHooks, loadFailureHint, makeLoader, pickRoot } from "../../skills/purplestar-astrology/scripts/boot-hooks.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <仓库根>/test/lib

// ── 内核根定位：两级优先级 ──
/**
 * 本 skill 的内核入口 —— `pickRoot` 拿它判定「这份内核在不在」。
 *
 * @remarks
 * 回归测试只对标**源** skill（副本的正确性由 `test/repo.test.ts` 的逐字节断言与
 * `test/cli.test.ts` 的子进程用例负责，不在这里重复跑一遍排盘）。故这里写的是源的内核入口。
 */
const KERNEL_ENTRY = "ziwei/algorithm.ts";

const picked = pickRoot(
	[
		[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
		[resolve(HERE, "../../skills/purplestar-astrology/scripts"), "技能自带内核"],
	],
	KERNEL_ENTRY
);

if (!picked.root) {
	throw new Error(
		`找不到排盘内核（${KERNEL_ENTRY}）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			`\n  处理：确认 skills/purplestar-astrology/scripts/ 下有 purple-star.ts 与 ziwei/，` +
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
 * 与排盘解读 skill 的 `purple-star.ts` 同名加载器共用 `boot-hooks.ts` 的 `makeLoader`，
 * 唯一差别是 `onFailure` 策略：此处**抛错**（归到具体用例），CLI 那边退出进程。
 * 排查指引本身（依赖未装 / Node 版本过低）也共用 `loadFailureHint()`。
 */
export const load = makeLoader(ROOT, ROOT_LABEL, f => {
	throw new Error(`无法加载 ${f.spec}\n  ${f.error.message}\n${loadFailureHint(f)}`);
});

// ── 内核模块入口 ──
// 每次调用都走 import()，命中 ESM 缓存，无重复解析开销。
// 返回类型用 `typeof import("@/…")` 静态锚定：tsconfig 的 paths 让 tsc 把 `@/` 解析到
// 排盘解读 skill 的 scripts/ 下的真实模块（从而拿到**真实导出签名**，内核签名变了这里跟着红）；
// 运行时该类型整体擦除，实际加载仍走上面的动态 import + 解析钩子。
// ⚠️ `load<T>()` 是字符串动态导入，tsc 本不检查 —— 类型锚定全靠这里的 typeof import，
//    这正是 CLI 引导层同款模式（详见 CLAUDE.md「CLI 如何既自举又拿到内核类型」）。
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

// ── 跨 skill 加载 ──

/** `skills/` 目录（各 skill 同处一层），跨 skill 加载的基准。 */
const SKILLS_DIR = resolve(HERE, "../../skills");

/**
 * 从**其它 skill** 的内核里加载一个模块。
 *
 * @param skill - skill 目录名，如 `"purplestar-classics"`
 * @param rel - 相对该 skill `scripts/` 的路径（**不带扩展名**，且必须是**单文件**）
 * @returns 该模块的导出；类型由调用点的泛型锚定
 *
 * @remarks
 * **为什么需要它**：`@/` 在运行期解析到**当前运行中 CLI 的内核根**（这里是源 skill 的
 * `scripts/`），而 `classics/`（归 `purplestar-classics`）与各 skill 自写的
 * `cli/flag-scope.ts` 自 2026-09-27 起都不住在源里 —— 源的钩子**够不到**它们了。
 * 这几条用例测的不是「源的内核」而是「那些模块本身」（古籍文本的排版不变量与检索行为、
 * 各 skill 的旗标作用域），所以换口径加载，而不是删用例。
 *
 * **为什么不在 `boot-hooks.ts` 加第二个 `@/` 基准**：`@/` == 当前 CLI 的内核根是
 * 文档化的不变量，且多个解析钩子之间**不会互相兜底**（前一个抛 `ERR_MODULE_NOT_FOUND`
 * 不会落到后一个）。本函数因此绕开钩子，直接用绝对 `file://` URL 走 Node 默认解析 ——
 * 代价是**类型锚必须写在调用点**（`loadFromSkill<typeof import("../../skills/…")>()`），
 * 用仓库相对字面路径，因为 tsc 的 `paths` 只把 `@/` 映到源。
 *
 * ⚠️ `rel` 不带扩展名（本函数补 `.ts`），且**不支持目录模块**（`./patterns` 那种）——
 * 需要时再补候选序，别在这里顺手抄一份 `makeResolveHook` 的解析逻辑。
 */
export function loadFromSkill<T>(skill: string, rel: string): Promise<T> {
	const abs = resolve(SKILLS_DIR, skill, "scripts", rel) + ".ts";
	return import(pathToFileURL(abs).href) as Promise<T>;
}
