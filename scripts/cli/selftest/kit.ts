/**
 * selftest 的共用 harness（叶子模块：无第三方依赖）—— 断言接口原先在主报告与
 * classics / synastry 两个断言组里**逐字同形**定义三份，抽到这里后新增断言组只 import
 * 本模块。主 selftest 负责声明有哪些组并渲染分段报告。
 *
 * ⚠️ 子进程探针（spawnSync 跑根 CLI）**不**收进本模块 —— 各断言组的内核根来源不同
 *    （主 selftest 用 `ctx.root`，断言组自推导），「机制共用、策略各异」。
 *    harness 各处的完整论证见 docs/code/cli-selftest.md。
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CliArgs, CliContext } from "../args";

/** 单条断言的结果 */
export interface Assertion {
	/** 是否通过 */
	pass: boolean;
	/** 断言名（本身即断言内容的描述，直接进报告） */
	name: string;
	/** 补充说明：通过时是断言体返回的 detail，失败时是抛出的错误信息 */
	detail: string;
	/** 是否因「依赖文件不在分发包内」而跳过。跳过仍记 pass，但报告里前置 ⏭ 以示未跑。 */
	skipped?: boolean;
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
 * 断言组测的命令（astrology / synastry）都是同步返回文本（knowledge 已改 async 分发
 * 四域，async 命令的直调探针走各自组内的 await），harness 的 `ok` 无需为直调改异步签名。
 *
 * @param cmd - 命令名（须已在命令表内；未知命令由调用方先判键集）
 * @param argv - 命令参数（不含命令名本身）
 * @param dispatch - 命令表里的实现（`COMMANDS[cmd]`）
 * @param parse - `parseArgs`（调用方注入，kit 不静态依赖 args 的运行时）
 * @param ctx - 运行期上下文（内核根与其来源）
 * @returns 与子进程冒烟同构的结果；throw 被捕获并拼成引导层同形文案
 *
 * @remarks
 * 输出形态断言原用 spawnSync 起真 CLI —— 每次约 3.2 秒（iztro 冷启动），全量 30 个调用点
 * ≈ 96 秒。直调复用本进程已加载的 iztro（约 25ms/次），断言语义等价。「stderr 前缀 +
 * exit 1」这条真链路由各断言组保留的子进程冒烟覆盖（见 docs/code/cli-selftest.md）。
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
		if (typeof out !== "string") {
			throw new Error(
				`kit 直调仅支持同步命令（${cmd} 返回了 Promise——本断言组不测 selftest 命令）`
			);
		}
		return { code: 0, out, err: "" };
	} catch (err) {
		return { code: 1, out: "", err: `错误：${(err as Error).message}` };
	}
}

/**
 * 主 selftest 各断言组的共享运行时。
 *
 * @remarks
 * 主 selftest 构造一次、按源码断言顺序逐组传入组函数。`call` / `runCli` / `commandNames`
 * 只在这里构造：命令表 COMMANDS 由主 selftest 动态 import 取得（打断静态环），组文件因此
 * 一律不静态 import `cli/commands.ts`（见 docs/code/cli-selftest.md）。
 */
export interface SelftestDeps {
	/** 运行期上下文（内核根与其来源）—— 读 SKILL.md / 数据文件等守护断言用 */
	ctx: CliContext;
	/** harness 的断言注册（来自 createHarness，结果直接进主报告） */
	ok: OkFn;
	/** 进程内直调一条命令（`{ code, out, err }` 同构三元组） */
	call: (argv: string[]) => CallResult;
	/** 子进程探针（仅冒烟断言用） */
	runCli: (args: string[]) => CallResult;
	/** 命令表键集（命令拆分 / 旧名退役 / SKILL.md 速查对拍用） */
	commandNames: string[];
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
	if (actual !== expected) {
		throw new Error(`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
	}
}

/** harness 的断言登记签名（各组通过 deps 拿到，故声明在此便于共用）。 */
export type OkFn = (name: string, fn: () => unknown, opts?: { skip?: string }) => void;

/**
 * harness：各断言组独立收集自己的结果（工厂函数，不共享状态）。
 *
 * @remarks
 * `ok` 跑一条断言并登记结果 —— 断言体抛错即记为该条失败，一条失败不影响其余断言继续跑；
 * 断言体返回值若非空则作为该项的补充说明。
 *
 * ⚠️ `opts.skip` 是**唯一的跳过入口**：跳过记 pass 但 `skipped: true`，报告前置 `⏭`。
 *    **必须看得见「这条没跑」** —— 否则恒真守卫会伪装成通过（见 docs/code/cli-selftest.md）。
 */
export function createHarness(): {
	results: Assertion[];
	/** 跑一条断言并登记结果（断言体抛错即记失败，一条失败不影响其余） */
	ok: OkFn;
} {
	const results: Assertion[] = [];
	const ok: OkFn = (name, fn, opts) => {
		if (opts?.skip) {
			results.push({ pass: true, name, detail: opts.skip, skipped: true });
			return;
		}
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};
	return { results, ok };
}

/**
 * 守卫：只有**仓库形态**（而非分发包形态）才跑依赖仓库级文档的断言。
 *
 * @param ctx - 运行期上下文，`ctx.root` 为内核根（即 `scripts/`）
 * @param why - 跳过原因，进报告 detail
 * @returns 不该跑时返回跳过原因字符串；该跑时返回 `undefined`
 *
 * @remarks
 * 判据取「包根有没有 `CLAUDE.md`」：分发包只含 `SKILL.md` / `package.json` /
 * `references/` / `scripts/` 四项，仓库级文档一律不带 —— 用 `CLAUDE.md` 作
 * 「我在不在仓库里」的探针（它必然与那三份文档同进同出）。
 *
 * ⚠️ **不要给不需要的断言加跳过**：文件若都在 `scripts/` 或 `references/` 内会被打包带上，
 *    跳过只会白白丢掉覆盖。全仓仅此一处适用（见 docs/code/cli-selftest.md）。
 */
export function skipUnlessRepo(ctx: { root: string }, why: string): string | undefined {
	const repoOnly = resolve(ctx.root, "..", "CLAUDE.md");
	if (!existsSync(repoOnly)) {
		return `⏭ ${why}（分发包不含仓库级文档）`;
	}
	return undefined;
}
