/**
 * dispatch.ts —— argv → { code, out, err, outFile } 的分发协议（候选 1）。
 *
 * 唯一真相源：未知命令文案、--help 拦截位置、错误前缀、参数解析 → 执行次序（此前这条链
 * 有 6 份独立实现、未知命令文案 5 种变体）。
 *
 * ⚠️ 本模块**不写盘、不 print、不 exit**：副作用全部归宿主，进程内测试与子进程真链路
 *    因此消费同一 seam（`--out` 只把路径带出来，不碰文件系统）。
 *    六份实现的历史与 `--help` 拦截位置的接口承诺见 docs/code/cli-chart.md。
 */
import type { CliArgs, CliContext } from "../args";

/** 命令表条目：与 `cli/commands.ts` 的 `Cmd` 同形（Cmd 未导出，此处内联声明）。 */
type CmdEntry = (args: CliArgs, ctx: CliContext) => string | Promise<string>;

/**
 * 分发所需端口 —— 宿主注入加载器与上下文。
 *
 * @remarks
 * 两个 loader 都是惰性的：help / 未知命令路径只触发 `loadHelp`（轻模块，不付出
 * iztro 冷启动）；真正执行命令时才触发 `loadCore`（含启动自检）。
 */
export interface DispatchPorts {
	/** 加载内核 + 启动自检，返回命令表与参数解析器 */
	loadCore: () => Promise<{
		COMMANDS: Record<string, CmdEntry | undefined>;
		parseArgs: (argv: string[], command?: string) => CliArgs;
	}>;
	/** 加载 help 轻路径（command-meta + help，均不依赖命令实现） */
	loadHelp: () => Promise<{
		renderOverviewHelp: () => string;
		renderCommandHelp: (cmd: string) => string;
		commandNames: readonly string[];
	}>;
	/** 命令执行上下文（内核根及其来源） */
	ctx: CliContext;
}

/** 分发结果：三元组 + 可选落盘路径。code=0 成功；code=1 未知命令或命令内部抛错。 */
export interface DispatchResult {
	code: number;
	/** 成功路径的渲染文本（含 help 文本）；失败路径为空串 */
	out: string;
	/** 失败路径文案（已带语义，宿主直接打印到 stderr）；成功路径为空串 */
	err: string;
	/** `--out <文件>` 存在时的落盘路径——dispatch 不写盘，副作用归宿主 */
	outFile?: string;
}

/**
 * 旧命令迁移提示行（stars / oracle / classics），无匹配返回空串。
 *
 * @remarks
 * 旧命令并入提示：stars / oracle 已并入 --source 选域，classics 随四域合并改名
 * knowledge —— 敲旧名给一条可直接照抄的迁移写法，而不是让用户自己从 help 里找。
 */
export function unknownCommandMerged(cmd: string): string {
	if (cmd === "stars")
		{return `—— 星曜释义已并入：knowledge --source stars --search <星名>`;}
	if (cmd === "oracle")
		{return `—— 断语手册已并入：knowledge --source oracle --topic <主题> [--star <星名>]`;}
	if (cmd === "classics")
		{return "—— 本命令原名 classics，已改名：knowledge --search <词>（古籍用法逐字不变）";}
	return "";
}

/**
 * 未知命令完整文案 —— 全仓唯一真相源：可用命令列表 + 旧命令迁移提示 + help 指路。
 *
 * @param cmd 未命中的命令名
 * @param available 可用命令列表（调用方决定取 COMMANDS 键集还是自定义桩列表）
 */
export function unknownCommandMessage(cmd: string, available: readonly string[]): string {
	const merged = unknownCommandMerged(cmd);
	return `未知命令「${cmd}」。可用：${available.join(" / ")}${merged ? "\n" + merged : ""}\n运行 help 查看完整用法。`;
}

/**
 * 命令失败文案的唯一前缀构造：`错误：<message>`（不带栈）。
 *
 * @remarks
 * dispatch 的执行 catch 与宿主的副作用 catch（--out 落盘）共用 —— 前缀真相源一处，
 * 否则「错误：」会在宿主里再抄一份（见 docs/code/cli-chart.md）。
 */
export function formatError(err: unknown): string {
	return `错误：${err instanceof Error ? err.message : String(err)}`;
}

/**
 * 全链分发：help 拦截 → 查命令表 → parseArgs → 执行 → out 路径记录 → 错误包装。
 *
 * @remarks
 * `--help` / `-h` 出现在**任何位置**都打印 help（含 `astrology --help`）：它不在参数声明表
 * 里，放它走到 parseArgs 只会得到「未知参数 --help」。判定提前到分发之前，parseArgs 因此
 * 永远见不到它 —— **判定顺序是本模块的接口承诺**，由 selftest 的 runDispatchProbe 钉住。
 *
 * 未知命令与命令内部抛出的错误都返回 code=1（只带 err.message，不带栈）。
 */
export async function dispatch(
	argv: string[],
	ports: DispatchPorts
): Promise<DispatchResult> {
	const cmd = argv[0];
	const hasHelpFlag = argv.includes("--help") || argv.includes("-h");
	// ① --help 拦截：先于查表与 loadCore（help 路径只加载轻模块）
	if (cmd && cmd !== "help" && hasHelpFlag) {
		const help = await ports.loadHelp();
		if (help.commandNames.includes(cmd))
			{return { code: 0, out: help.renderCommandHelp(cmd), err: "" };}
	}
	if (!cmd || cmd === "help" || hasHelpFlag) {
		const help = await ports.loadHelp();
		return { code: 0, out: help.renderOverviewHelp(), err: "" };
	}
	// ② 真正执行：此刻才加载内核（启动自检在 loadCore 内）
	const { COMMANDS, parseArgs } = await ports.loadCore();
	const fn = COMMANDS[cmd];
	if (!fn)
		{return { code: 1, out: "", err: unknownCommandMessage(cmd, Object.keys(COMMANDS)) };}
	try {
		// 命令名一并交给 parseArgs：参数面要按命令校验
		const args = parseArgs(argv.slice(1), cmd);
		const out = await fn(args, ports.ctx);
		const outFile =
			typeof args.out === "string" && args.out !== "" ? args.out : undefined;
		return outFile !== undefined
			? { code: 0, out: String(out), err: "", outFile }
			: { code: 0, out: String(out), err: "" };
	} catch (err) {
		return { code: 1, out: "", err: formatError(err) };
	}
}
