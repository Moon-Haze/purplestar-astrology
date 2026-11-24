/**
 * @file dispatch.ts —— argv→{code,out,err,outFile} 分发。
 * @remarks 唯一真相源：未知命令文案、--help 拦截、错误前缀、解析→执行次序；不写盘（--out 仅带路径），详见 docs/code/cli-chart.md。
 */
import type { CliArgs, CliContext } from "../args";

/** 同 `cli/commands/index.ts` Cmd。 */
type CmdEntry = (args: CliArgs, ctx: CliContext) => string | Promise<string>;

/** 宿主注入。@remarks 惰性：help/未知命令只 loadHelp，执行才 loadCore。 */
export interface DispatchPorts {
	/** 内核+自检 */
	loadCore: () => Promise<{
		COMMANDS: Record<string, CmdEntry | undefined>;
		parseArgs: (argv: string[], command?: string) => CliArgs;
	}>;
	/** help 轻路径 */
	loadHelp: () => Promise<{
		renderOverviewHelp: () => string;
		renderCommandHelp: (cmd: string) => string;
		commandNames: readonly string[];
	}>;
	/** 上下文（内核根/来源） */
	ctx: CliContext;
}

/** 三元组+落盘；0/1 */
export interface DispatchResult {
	/** 0 成功；1 失败 */
	code: number;
	/** 成功文本 */
	out: string;
	/** 失败文案（宿主 stderr） */
	err: string;
	/** `--out <文件>` 路径；归宿主 */
	outFile?: string;
}

/**
 * 旧命令迁移提示，无匹配空串。
 * @remarks stars→--source、classics→knowledge、oracle 下线指推算。
 * @param cmd - 旧命令名
 * @returns 提示或空串
 */
export function unknownCommandMerged(cmd: string): string {
	if (cmd === "stars") {
		return `—— 星曜释义已并入：knowledge --source stars --search <星名>`;
	}
	if (cmd === "oracle") {
		return `—— 断语手册已下线：主题论断用 astrology <出生信息> --topic <主题> 现场推算`;
	}
	if (cmd === "classics") {
		return "—— 本命令原名 classics，已改名：knowledge --search <词>（古籍用法逐字不变）";
	}
	return "";
}

/**
 * 未知命令文案唯一真相源：可用表+迁移+help 指路。
 * @param cmd - 未命中名
 * @param available - 可用表
 * @returns 完整文案
 */
export function unknownCommandMessage(cmd: string, available: readonly string[]): string {
	const merged = unknownCommandMerged(cmd);
	return `未知命令「${cmd}」。可用：${available.join(" / ")}${merged ? "\n" + merged : ""}\n运行 help 查看完整用法。`;
}

/**
 * 失败前缀 `错误：<message>`（无栈）。
 * @remarks 宿主 catch（--out）共用，否则「错误：」重抄（docs/code/cli-chart.md）。
 * @param err - 错误值
 * @returns 带「错误：」文案
 */
export function formatError(err: unknown): string {
	return `错误：${err instanceof Error ? err.message : String(err)}`;
}

/**
 * 全链：help 拦截→查表→parseArgs→执行→out→错包。
 * @remarks --help/-h 任何位置打印 help：落 parseArgs 得「未知参数 --help」，故提前拦截（selftest runDispatchProbe 钉住）；抛错 code=1。
 * @param argv - 参数
 * @param ports - 三端口
 * @returns 码/out/err；--out 带路径
 */
export async function dispatch(argv: string[], ports: DispatchPorts): Promise<DispatchResult> {
	const cmd = argv[0];
	const hasHelpFlag = argv.includes("--help") || argv.includes("-h");
	// ① --help 拦截：先于查表与 loadCore（help 路径只加载轻模块）
	if (cmd && cmd !== "help" && hasHelpFlag) {
		const help = await ports.loadHelp();
		if (help.commandNames.includes(cmd)) {
			return { code: 0, out: help.renderCommandHelp(cmd), err: "" };
		}
	}
	if (!cmd || cmd === "help" || hasHelpFlag) {
		const help = await ports.loadHelp();
		return { code: 0, out: help.renderOverviewHelp(), err: "" };
	}
	// ② 真正执行：此刻才加载内核（启动自检在 loadCore 内）
	const { COMMANDS, parseArgs } = await ports.loadCore();
	const fn = COMMANDS[cmd];
	if (!fn) {
		return { code: 1, out: "", err: unknownCommandMessage(cmd, Object.keys(COMMANDS)) };
	}
	try {
		// 命令名一并交给 parseArgs：参数面要按命令校验
		const args = parseArgs(argv.slice(1), cmd);
		const out = await fn(args, ports.ctx);
		const outFile = typeof args.out === "string" && args.out !== "" ? args.out : undefined;
		return outFile !== undefined
			? { code: 0, out: String(out), err: "", outFile }
			: { code: 0, out: String(out), err: "" };
	} catch (err) {
		return { code: 1, out: "", err: formatError(err) };
	}
}
