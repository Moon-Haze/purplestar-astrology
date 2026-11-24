/** 装配 */

import type { BirthInfo, ZiweiChart } from "@/types";
import type { CliArgs } from "../args";
import { BIRTH_KEYS, INTENT_KEYS } from "../args/table";
import { applyConfig } from "../args/config-input";
import { buildBirthInfo } from "../birth/birth-info";
import { toBasis, type CaliberBasis } from "../birth/birth-info-defs";
import { generateChartCached } from "../chart/chart-cache";

/** `cli/selftest/sample.ts` */
const SAMPLE_BIRTH: Partial<CliArgs> = {
	date: "2011-06-24",
	time: "07:45",
	city: "杭州",
	gender: "male",
};

/** @param args @returns 年 @throws 越 @remarks 详上 */
export function parseYearlyArg(args: CliArgs): number {
	const y =
		args.yearly !== undefined && args.yearly !== true
			? Number(args.yearly)
			: new Date().getFullYear();
	if (!Number.isInteger(y) || y < 1 || y > 9999) {
		throw new Error(`--yearly 应为 1-9999 的整数年份，收到：${args.yearly}`);
	}
	return y;
}

/** @param args @returns 月（「不算流月」）@throws 越*/
export function parseMonthlyArg(args: CliArgs): number | null {
	// 裸开关必须报错：Number(true) = 1 会让它被静默当成农历一月（与 --yearly 不同，
	// 流月的「当前月」没有明确语义 —— 农历月随流年干五虎遁推，不设默认）。
	if (args.monthly === true) {
		throw new Error("--monthly 需要一个农历月值（如 --monthly 6）");
	}
	const m = args.monthly !== undefined ? Number(args.monthly) : null;
	if (m !== null && (!Number.isInteger(m) || m < 1 || m > 12)) {
		throw new Error("--monthly 应为农历月 1-12");
	}
	return m;
}

/** @returns 日（「不算流日」）@throws 越 @remarks 「当前日」 @param args */
export function parseDailyArg(args: CliArgs): number | null {
	if (args.daily === true) {
		throw new Error("--daily 需要一个农历日值（如 --daily 15）");
	}
	const d = args.daily !== undefined ? Number(args.daily) : null;
	if (d !== null && (!Number.isInteger(d) || d < 1 || d > 30)) {
		throw new Error("--daily 应为农历日 1-30");
	}
	return d;
}

/** @returns 时支（「不算流时」）@throws 越 @param args*/
export function parseHourlyArg(args: CliArgs): number | null {
	if (args.hourly === true) {
		throw new Error("--hourly 需要一个时支值（如 --hourly 5，12=晚子时）");
	}
	const h = args.hourly !== undefined ? Number(args.hourly) : null;
	if (h !== null && (!Number.isInteger(h) || h < 0 || h > 12)) {
		throw new Error("--hourly 应为时支 0-12（12 = 晚子时）");
	}
	return h;
}

/** {@link prepareAstrologyContext} 产物 */
export interface AstrologyContext {
	/** · */
	args: CliArgs;
	/** · */
	info: BirthInfo;
	/** · */
	basis: CaliberBasis;
	/** · */
	chart: ZiweiChart;
	/** · */
	liuNianYear: number;
	/** · */
	liuYueMonth: number | null;
	/** · */
	liuRiDay: number | null;
	/** · */
	liuShiHour: number | null;
	/** · */
	usingSample: boolean;
}

/** @param args @returns 上下文（{@link AstrologyContext}）@remarks 顺序即interface，详 docs/code/cli-commands.md */
export function prepareAstrologyContext(args: CliArgs): AstrologyContext {
	// --config：配置是基底，命令行同名键覆盖（spec §3.3）
	args = applyConfig(args);
	// ── 零输入演示契约：出生信息一项没给且未表达其他输出意图时，改以内置虚构样例演示
	// 基本信息面板。部分输入不适用（想排特定的盘），--json / --palaces / --topic /
	// 专题参数在场同样不适用：那是明确的输出意图（见 docs/code/cli-commands.md）。
	const usingSample =
		BIRTH_KEYS.every(k => (args as Record<string, unknown>)[k] === undefined) &&
		!INTENT_KEYS.some(k => (args as Record<string, unknown>)[k] !== undefined);
	if (usingSample) {
		args = { ...args, ...SAMPLE_BIRTH, info: true };
	}
	// 口径字段整包收进 basis：8 个局部变量逐个传递改为一包传递，
	// clockTime 折算由 toBasis 单点完成（此前两处 infoSection 各自逐字重复）。
	const built = buildBirthInfo(args);
	const basis = toBasis(built, args.time);
	const { info } = built;
	// 排盘走缓存层（键 = 出生信息 sha256）：同一份出生信息在本农历年内只排一次，
	// 换专题参数 / 换视角重跑时只付「读文件 + 渲染」。--no-cache 强制直排。
	const chart = generateChartCached(info, { noCache: args.noCache === true });

	// 流年只认 --yearly（裸开关 = 当年）。--year 三连已于 2026-09-30 删除：误敲
	// `--year` 会在 parseArgs 层报「未知参数」并建议最接近的 --yearly（selftest
	// 解析引擎段钉住该行为）——不存在「出生年回退」或「静默忽略」的旧路径。
	const liuNianYear = parseYearlyArg(args);
	// 流月：农历月 1-12，取流年干推五虎遁（可选）
	const liuYueMonth = parseMonthlyArg(args);
	// 流日 / 流时：取值校验在此（数值域），组合护栏（须配 --mutagen / --monthly / --daily）
	// 只守文本路径 —— --json 的对应顶层键是独立键，程序消费方自担取值链（基准对拍依赖裸 --json --monthly）。
	const liuRiDay = parseDailyArg(args);
	const liuShiHour = parseHourlyArg(args);

	return {
		args,
		info,
		basis,
		chart,
		liuNianYear,
		liuYueMonth,
		liuRiDay,
		liuShiHour,
		usingSample,
	};
}
