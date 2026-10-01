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

/** 单条断言的结果 */
export interface Assertion {
	/** 是否通过 */
	pass: boolean;
	/** 断言名（本身即断言内容的描述，直接进报告） */
	name: string;
	/** 补充说明：通过时是断言体返回的 detail，失败时是抛出的错误信息 */
	detail: string;
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
