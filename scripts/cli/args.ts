/**
 * CLI 参数解析 —— 纯函数，不依赖任何内核模块，也不使用 `@/` 别名。
 *
 * 拆自 purple-star.ts。依赖图的最底层（args / render 并列底层，
 * 其余模块都建立在它们之上）：
 *
 *   args ─┐
 *         ├─→ birth-info ─→ commands ─→ selftest
 *   render┘        ↑____________|
 *
 * ⚠️ 本文件由引导层（purple-star.ts）在 `registerHooks` **之后**动态加载。
 *    不要在 purple-star.ts 顶部用静态 `import` 引它 —— 钩子未注册时解析会失败。
 */

/**
 * CLI 参数表。
 * `_` 收位置参数；其余键对应 `--key` —— 带值的是 string，纯开关是 boolean。
 * 索引签名里保留 string[] 是为了与 `_` 的写入同域（TS 要求索引签名涵盖所有具名属性）。
 */
export interface CliArgs {
	_: string[];
	[key: string]: string | boolean | string[];
}

/** 参数解析：--key value / --flag */
export function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const key = a.slice(2);
			// 显式标为可能 undefined：越界访问才是「这个开关没有取值」的真实来源
			const next: string | undefined = argv[i + 1];
			if (next === undefined || next.startsWith("--")) args[key] = true;
			else {
				args[key] = next;
				i++;
			}
		} else {
			args._.push(a);
		}
	}
	return args;
}

/**
 * 运行期上下文：只有引导层才知道的东西。
 *
 * 目前仅 selftest 用得上（它要在输出里交代「排这张盘用的是哪一份内核」），
 * 但类型在此统一，免得将来再多一个命令时又改一遍所有签名。
 */
export interface CliContext {
	/** 实际生效的内核根目录（已解析为绝对路径） */
	root: string;
	/** 该根目录的来源描述，如「技能自带内核」「ZIWEI_ROOT 环境变量」 */
	rootLabel: string;
}
