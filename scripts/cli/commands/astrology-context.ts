/**
 * `astrology` 的装配层 —— args → 排盘上下文的一条链单点：
 * `--config` 覆盖 → 零输入回退 → 出生信息 → 口径 basis → 命盘缓存 → 运限参数解析。
 *
 * 此前这条链只活在 `cmdAstrology` 的函数体里，不是任何 module 的 interface —— 测试
 * 为调 `composeSections` 把它复刻了三份且互相不一致（评审候选 4 / W1）。收编后
 * **装配顺序与前提本身就是可直测的 interface**：cmdAstrology 与测试跨同一 seam。
 */

import type { BirthInfo, ZiweiChart } from "@/types";
import type { CliArgs } from "../args";
import { BIRTH_KEYS, INTENT_KEYS } from "../args/table";
import { applyConfig } from "../args/config-input";
import { buildBirthInfo } from "../birth/birth-info";
import { toBasis, type CaliberBasis } from "../birth/birth-info-defs";
import { generateChartCached } from "../chart/chart-cache";

/**
 * 零输入演示的内置虚构样例 —— 与 help 示例、`--template` 配置模板同源（2011-06-24 07:45
 * 杭州 male），输出自带「虚构」声明（见 docs/code/cli-commands.md）。argv / 位置参数
 * 形态的单点在 `cli/selftest/sample.ts` 的 `DEMO_*`（值驻本处，角色是运行时演示）。
 */
const SAMPLE_BIRTH: Partial<CliArgs> = {
	date: "2011-06-24",
	time: "07:45",
	city: "杭州",
	gender: "male",
};

/**
 * `--yearly` 的年份校验（`analyze` 的流年专题与 `topic` 的流年论断共用）。
 *
 * @param args - CLI 参数表
 * @returns 流年年份；未给或裸开关时默认当前公历年（裸开关的语义就是「深入今年」）
 * @throws 非整数或超出 1-9999 时
 *
 * @remarks
 * 非数字静默传下去会得到「NaN 天干 → 四空串」的垃圾输出 —— 与 `--monthly` 同一纪律：
 * 宁可报错，不静默产出错盘（见 docs/code/cli-commands.md）。
 */
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

/**
 * `--monthly` 的农历月校验（`analyze` 与 `topic` 共用）。
 *
 * @param args - CLI 参数表
 * @returns 农历月 1-12；未给时为 `null`（表示「不算流月」）
 * @throws 非整数或超出 1-12 时
 */
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

/**
 * `--daily` 的农历日校验。
 *
 * @returns 农历日 1-30；未给时为 `null`（表示「不算流日」）
 * @throws 裸开关、非整数或超出 1-30 时
 *
 * @remarks
 * 与 `--monthly` 同一纪律：流日的「当前日」没有明确语义，不设默认 —— 裸开关直接报错
 * 指路（见 docs/code/cli-commands.md）。
 */
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

/**
 * `--hourly` 的时支校验。
 *
 * @returns 时支 0-12（12 = 晚子时）；未给时为 `null`（表示「不算流时」）
 * @throws 裸开关、非整数或超出 0-12 时
 */
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

/** {@link prepareAstrologyContext} 的产物：cmdAstrology 与 composeSections 的共同输入。 */
export interface AstrologyContext {
	/** 应用 `--config` 与零输入回退**之后**的参数表（cmdAstrology 的后续分支读它） */
	args: CliArgs;
	info: BirthInfo;
	basis: CaliberBasis;
	chart: ZiweiChart;
	liuNianYear: number;
	liuYueMonth: number | null;
	liuRiDay: number | null;
	liuShiHour: number | null;
	/** 零输入演示是否生效（头部声明与用法指路随它出现） */
	usingSample: boolean;
}

/**
 * `astrology` 的装配链：args → 排盘上下文（本 module 存在的全部理由）。
 *
 * @param args - `parseArgs` 的产物（命令行侧；`--template` 已在 cmdAstrology 提前分流）
 * @returns 装配好的上下文（见 {@link AstrologyContext}）
 *
 * @remarks
 * 顺序即 interface：`--config` 先覆盖（配置是基底），零输入回退判定在出生信息解析前，
 * basis 的 clockTime 折算由 `toBasis` 单点完成，排盘走缓存层（`--no-cache` 直排），
 * 运限参数最后解析（值域校验在此；组合护栏在 composeSections 的文本路径）。
 */
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

	// 注意：流年用 --yearly，不可复用 --year —— 后者是出生年的回退参数。
	// 二者同时给出不会报错：流年取 --yearly；而出生日期一旦给了 --date/--lunar，
	// --year 就被静默忽略（buildBirthInfo 里 --date/--lunar 优先），不会有任何提示。
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
