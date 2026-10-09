/**
 * selftest 的共用 harness（叶子模块：无第三方依赖）。
 *
 * 断言接口原先在 `cli/selftest.ts` 与 classics / synastry 两个断言组里**逐字同形**
 * 定义三份，靠「与 cli/selftest.ts 同形」的注释维持同步 —— 抽到这里后，新增断言组
 * 只 import 本模块，不再复制样板。主 selftest 负责声明有哪些组并渲染分段报告。
 *
 * 注：子进程探针（spawnSync 跑根 CLI）**不**收进本模块 —— 各断言组的内核根来源
 * 不同（主 selftest 用引导层交代的 `ctx.root`，断言组自推导），「机制共用、策略各异」，
 * 且探针涉及进程创建，留在各自的运行语境里更诚实。
 */

import type { CliArgs, CliContext } from "./args";

/** 单条断言的结果 */
export interface Assertion {
	/** 是否通过 */
	pass: boolean;
	/** 断言名（本身即断言内容的描述，直接进报告） */
	name: string;
	/** 补充说明：通过时是断言体返回的 detail，失败时是抛出的错误信息 */
	detail: string;
}

/** 进程内直调结果：与子进程冒烟的 `{ code, out, err }` 同构，断言换载体不改判据。 */
export interface CallResult {
	/** 退出码语义：0 成功，1 命令抛错 */
	code: number;
	/** 命令返回的渲染文本（成功路径） */
	out: string;
	/** 错误文案（引导层同形 `错误：<message>`；失败路径） */
	err: string;
}

/**
 * 进程内直调一条命令（等价于走一遍 main 的分发，但不起子进程）。**同步版**：
 * 断言组测的命令（astrology / stars / classics / synastry）都是同步返回文本，
 * harness 的 `ok` 无需为直调改异步签名。
 *
 * @param cmd - 命令名（须已在命令表内；未知命令由调用方先判键集）
 * @param argv - 命令参数（不含命令名本身）
 * @param dispatch - 命令表里的实现（`COMMANDS[cmd]`）
 * @param parse - `parseArgs`（调用方注入，kit 不静态依赖 args 的运行时）
 * @param ctx - 运行期上下文（内核根与其来源）
 * @returns 与子进程冒烟同构的结果；throw 被捕获并拼成引导层同形文案
 *
 * @remarks
 * 输出形态断言原用 spawnSync 起真 CLI —— 每次约 3.2 秒（iztro 冷启动），全量 30 个
 * 调用点 ≈ 96 秒。直调复用本进程已加载的 iztro（约 25ms/次），断言语义等价：成功路径
 * 同一返回串；错误路径同一 throw（此处捕获后拼「错误：」前缀）。「stderr 前缀 + exit 1」
 * 这条真链路由各断言组保留的子进程冒烟覆盖。
 */
export function callDirect(
	cmd: string,
	argv: string[],
	dispatch: (args: CliArgs, ctx: CliContext) => string | Promise<string>,
	parse: (argv: string[], cmd: string) => CliArgs,
	ctx: CliContext
): CallResult {
	try {
		const out = dispatch(parse(argv, cmd), ctx);
		if (typeof out !== "string")
			throw new Error(`kit 直调仅支持同步命令（${cmd} 返回了 Promise——本断言组不测 selftest 命令）`);
		return { code: 0, out, err: "" };
	} catch (err) {
		return { code: 1, out: "", err: `错误：${(err as Error).message}` };
	}
}

/**
 * 相等断言，不等即抛错。
 *
 * @param actual - 实得值
 * @param expected - 期望值
 * @param msg - 错误信息前缀，用来点明是哪一处比对失败
 *
 * @remarks
 * 用 `!==` **严格相等**比较，不做深比较也不做类型转换；失败信息里用 `JSON.stringify` 展开两侧取值。
 */
export function eq(actual: unknown, expected: unknown, msg = ""): void {
	if (actual !== expected)
		throw new Error(`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
}

/**
 * harness：各断言组独立收集自己的结果（工厂函数，不共享状态）。
 *
 * @remarks
 * `ok` 跑一条断言并登记结果 —— 断言体抛错即记为该条失败，一条失败不影响其余断言继续跑；
 * 断言体返回值若非空则作为该项的补充说明。
 */
export function createHarness(): {
	results: Assertion[];
	/** 跑一条断言并登记结果（断言体抛错即记失败，一条失败不影响其余） */
	ok: (name: string, fn: () => unknown) => void;
} {
	const results: Assertion[] = [];
	const ok = (name: string, fn: () => unknown) => {
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};
	return { results, ok };
}
