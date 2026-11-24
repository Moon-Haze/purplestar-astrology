/** selftest harness。@remarks 接口原三处同形，抽此；见 docs/code/cli-selftest.md。 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { CliArgs, CliContext } from "../args";

/** 断言结果 */
export interface Assertion {
	/** 通过? */
	pass: boolean;
	/** 断言名 */
	name: string;
	/** 补充：detail/错误 */
	detail: string;
	/** 「依赖文件不在分发包内」则跳过：记 pass、⏭ 示未跑。 */
	skipped?: boolean;
}

/** 直调结果（`{ code, out, err }`） */
export interface CallResult {
	/** 0 成功/1 抛错 */
	code: number;
	/** 渲染文本 */
	out: string;
	/** 错误文案 */
	err: string;
}

/**
 * 直调命令。@param cmd - 命令名 @param argv - 参数 @param dispatch - 实现 @param parse - 解析器
 * @param ctx - 上下文 @returns 同构结果 @throws 不抛 @remarks 复用 iztro 省冷启动。
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

/** 共享运行时。@remarks COMMANDS 由主 selftest 动态取断环；组文件不静态 import cli/commands。 */
export interface SelftestDeps {
	/** 上下文（读 SKILL.md/数据） */
	ctx: CliContext;
	/** 断言注册（createHarness） */
	ok: OkFn;
	/** 直调命令 */
	call: (argv: string[]) => CallResult;
	/** 子进程探针 */
	runCli: (args: string[]) => CallResult;
	/** 命令表键集 */
	commandNames: string[];
}

/**
 * 相等断言。@param actual - 实得 @param expected - 期望 @param msg - 错误前缀 @returns 无
 * @throws 不等抛「`msg`期望 X，实得 Y」@remarks `!==` 严格。
 */
export function eq(actual: unknown, expected: unknown, msg = ""): void {
	if (actual !== expected) {
		throw new Error(`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
	}
}

/** 断言登记签名。 */
export type OkFn = (name: string, fn: () => unknown, opts?: { skip?: string }) => void;

/**
 * 各组独立收集（工厂）。@remarks `ok` 抛错记失败不阻断；`opts.skip` 唯一跳过，⏭ 可见防恒真。
 * @returns results。
 */
export function createHarness(): {
	results: Assertion[];
	/** 跑断言登记 */
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
 * 仅仓库形态跑仓库文档断言。@param ctx - `ctx.root` 内核根 @param why - 跳过原因
 * @returns 不该跑返原因 @remarks 判据「包根有没有 `AGENTS.md`」：探针指现存文件防降级；
 * `test/repo.test.ts` 盯。⚠️ 别加多余 skip。
 */
export function skipUnlessRepo(ctx: { root: string }, why: string): string | undefined {
	const repoOnly = resolve(ctx.root, "..", "AGENTS.md");
	if (!existsSync(repoOnly)) {
		return `⏭ ${why}（分发包不含仓库级文档）`;
	}
	return undefined;
}
