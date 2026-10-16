/**
 * `astrology` 命令：排盘分析一条命令。
 *
 * 各命令按文件拆分（spec §2.2）；chart/topic 融入参数（见 spec §1）。
 */

import type { BirthInfo, Mutagen, ZiweiChart } from "@/types";
import type { CliArgs } from "../args";
import {
	BIRTH_KEYS,
	camelKey,
	DEEP_DIVE_KEYS,
	EXCLUSIVE_PRIORITY_LABEL,
	INTENT_KEYS,
	SHADOWABLE_KEYS,
} from "../args/table";
import { applyConfig, renderTemplate } from "../args/config-input";
import { buildBirthInfo } from "../birth/birth-info";
import { clockOptsFromBasis, toBasis, type CaliberBasis } from "../birth/birth-info-defs";
import {
	birthplaceSection,
	fmtDate,
	genderCN,
	lateZiSection,
	locateSihua,
	renderPalace,
	surroundNames,
} from "../chart/render";
import {
	decadalSection,
	focusSection,
	patternSection,
	infoSection,
	yearlyBranchOf,
	yearlySection,
	overviewSection,
	parseAgesArg,
	mutagenSection,
	agePalaceOf,
	ageSection,
} from "./fortune";
import { generateChartCached } from "../chart/chart-cache";
import { detectPatterns } from "@/patterns";
import { getMingGongSummary } from "@/analysis/soul-summary";
import {
	getMutagenByStem,
	getYearlyMutagen,
	getMonthlyMutagen,
	getDaXianMutagen,
	getDailyMutagen,
	getHourlyMutagen,
} from "@/mutagen";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { buildReport } from "./report";
import {
	getTopicAnalysis,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type TopicKey,
	type AnalysisView,
} from "@/analysis";

/**
 * `--view` 取值别名：英文主名与参数别名表（`OPTION_ALIASES`）同名同义 ——
 * decadal = daxian / yearly = liunian / monthly = liuyue（mingpan 无英文对应）。
 */
const VIEW_ALIASES: Record<string, AnalysisView> = {
	mingpan: "mingpan",
	daxian: "daxian",
	liunian: "liunian",
	liuyue: "liuyue",
	decadal: "daxian",
	yearly: "liunian",
	monthly: "liuyue",
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

/**
 * 抬头行（命盘总览式）：`【标题】[名字 ]日期 说明 · 性别` —— --info / --topic /
 * 默认概览三处专题分发共用；名字槽缺省时直接省略，不残留双空格。
 */
function chartHeader(title: string, info: BirthInfo, note: string): string {
	const namePart = info.name ? `${info.name} ` : "";
	return `${title}${namePart}${fmtDate(info)} ${note} · ${genderCN(info.gender)}`;
}

/**
 * `--json` 的产物（生产端）：`astrology --json` 的顶层契约，也是
 * `synastry/chart-view 的 readAnalyzeJson` 所消费的形状。
 *
 * @remarks
 * 提为具名纯函数是为了让契约**一处生产、一处消费、一处对拍** —— selftest 可进程内直调
 * 本函数、把产物喂给消费方校验。顶层键即输出契约：chart / patterns / mingGongSummary /
 * nativeSiHua / liuNianSiHua / liuYueSiHua / liuNianPalace / xiaoXian / lateZi / basis
 * （键集与 basis 冻结契约见 docs/code/cli-commands.md）。
 */
export function buildAnalyzeJson(input: {
	chart: ZiweiChart;
	/** 流年年号（`--yearly` 的值；缺省当年由 caller 先经 parseYearlyArg 归一） */
	liuNianYear: number;
	/** 农历月 1-12；`null` = 不算流月 */
	liuYueMonth: number | null;
	/** 农历日 1-30；`null`/`undefined` = 不算流日（须配 liuYueMonth） */
	liuRiDay?: number | null;
	/** 时支 0-12；`null`/`undefined` = 不算流时（须配 liuRiDay） */
	liuShiHour?: number | null;
	/**
	 * 排盘依据（日期换算 / 出生地解析 / 时辰校正的说明），原样进 `basis` 键。
	 * 传整包 `CaliberBasis`（结构超集，变量传参无 excess 检查；JSON 只出四键，契约冻结）
	 */
	basis: { note: string; notes: readonly string[]; lateZiCandidate: boolean; isLateZi: boolean };
}): string {
	const { chart, liuNianYear, liuYueMonth, liuRiDay, liuShiHour, basis } = input;
	// 派生收进实现内部（caller 只给语义参数，_interface_ 上不存在「传错组合」的态空间）：
	// 年干取农历口径（与宫详表同源），生年四化与流年/流月四化由查表函数从年号重算 ——
	// 全是纯函数，重算零成本，换来的是少 7 个参数与天然一致。
	const yearStem = chart.lunarInfo.yearStem;
	const native = getMutagenByStem(yearStem);
	const liuNian = getYearlyMutagen(liuNianYear);
	const liuYue = liuYueMonth !== null ? getMonthlyMutagen(liuNian.stemIndex, liuYueMonth) : null;
	// 大限四化（文墨排盘口径）：随当前大限宫干走；童限期（未起运）为 null。
	const daXian =
		chart.currentDecadalIndex === -1
			? null
			: getDaXianMutagen(chart, chart.currentDecadalIndex);
	const liuRi =
		liuYueMonth !== null && liuRiDay != null
			? getDailyMutagen(liuNianYear, liuYueMonth, liuRiDay)
			: null;
	const liuShi =
		liuRi && liuShiHour != null ? getHourlyMutagen(liuRi.stemIndex, liuShiHour) : null;
	return JSON.stringify(
		{
			chart,
			patterns: detectPatterns(chart),
			mingGongSummary: getMingGongSummary(chart),
			nativeSiHua: {
				stem: STEMS[yearStem],
				transforms: native,
				located: locateSihua(chart, native),
			},
			liuNianSiHua: {
				year: liuNianYear,
				stem: liuNian.stemName,
				transforms: liuNian.transforms,
				located: locateSihua(chart, liuNian.transforms),
			},
			liuYueSiHua: liuYue
				? {
						month: liuYueMonth,
						stem: liuYue.stemName,
						transforms: liuYue.transforms,
						located: locateSihua(chart, liuYue.transforms),
					}
				: null,
			daXianSiHua: daXian
				? {
						stem: daXian.stemName,
						transforms: daXian.transforms,
						located: locateSihua(chart, daXian.transforms),
					}
				: null,
			liuRiSiHua: liuRi
				? {
						lunarYear: liuNianYear,
						lunarMonth: liuYueMonth,
						lunarDay: liuRiDay,
						stem: liuRi.stemName,
						transforms: liuRi.transforms,
						located: locateSihua(chart, liuRi.transforms),
					}
				: null,
			liuShiSiHua: liuShi
				? {
						hourBranch: liuShiHour,
						stem: liuShi.stemName,
						transforms: liuShi.transforms,
						located: locateSihua(chart, liuShi.transforms),
					}
				: null,
			// 流年命宫与小限宫（运限速览的结构化等价物，只加不删）
			// 流年地支一次算好：三处引用同值，重复调用徒增「这三处是否同值」的读码疑虑。
			liuNianPalace: (() => {
				const lnBranch = yearlyBranchOf(liuNianYear);
				return {
					year: liuNianYear,
					branchIndex: lnBranch,
					branch: BRANCHES[lnBranch],
					palaceName: chart.palaces.find(p => p.branch === lnBranch)?.name ?? null,
				};
			})(),
			xiaoXian: (() => {
				const p = agePalaceOf(chart, chart.currentAge);
				return {
					age: chart.currentAge,
					palaceBranchIndex: p.branch,
					palaceBranch: BRANCHES[p.branch],
					palaceName: p.name,
				};
			})(),
			lateZi: { candidate: basis.lateZiCandidate, applied: basis.isLateZi },
			// 排盘依据：让这份 JSON 自描述「这张盘是怎么来的」，下游据此复述真太阳时与
			// 晚子时提示。键名刻意不叫 trueSolar（notes 还含农历换算与出生地解析）。
			// ⚠️ 显式四键是**冻结契约**（消费方 chart-view.ts 只声明这四键）：整包序列化
			//    会多出 longitude/lngNote/clockTime 等键，类型拦不住运行时
			//    —— 键集在此逐键声明。论证见 docs/code/cli-commands.md。
			basis: {
				note: basis.note,
				notes: basis.notes,
				lateZiCandidate: basis.lateZiCandidate,
				isLateZi: basis.isLateZi,
			},
		},
		null,
		2
	);
}

/**
 * 零输入演示的内置虚构样例 —— 与 help 示例、`--template` 配置模板同源（2011-06-24 07:45
 * 杭州 male），输出自带「虚构」声明（见 docs/code/cli-commands.md）。
 */
const SAMPLE_BIRTH: Partial<CliArgs> = {
	date: "2011-06-24",
	time: "07:45",
	city: "杭州",
	gender: "male",
};

/** 零输入演示的头部声明（面板前）与用法指路（面板后）。 */
const SAMPLE_HEADER = "（未给出生信息 —— 以下为内置虚构示例的演示盘）";
const SAMPLE_TRAILER = [
	"",
	"── 零输入演示：以上为虚构示例盘（2011-06-24 杭州男，与 help 示例同源）。排你自己的盘：",
	"   node scripts/purple-star.ts astrology 1990-5-15 9:30 男 北京",
	"   node scripts/purple-star.ts astrology --date 1990-5-15 --time 9:30 --gender 男 --city 北京",
	"   完整参数运行 help 查看。（示例数据为虚构，无真实人物）",
];

/**
 * 独占分支（`--palaces` / `--topic` / `--report` / `--info`）激活时，其余功能参数不会生效
 * —— 静默吞违反「宁可启动失败，也不静默产出错盘」，在这里指路。
 *
 * 优先级链：`--palaces` > `--topic` > `--report` > 其他功能参数（`--info` 属于链上的
 * 「其他功能参数」，但它自身也是独占分支）。链的完整表述见 docs/code/cli-commands.md。
 */
function assertNoShadowedFeatures(
	args: CliArgs,
	exclusive: "--palaces" | "--topic" | "--report" | "--info"
): void {
	// --topic 自身**消费** --yearly / --monthly（流年/流月视角的年份与农历月，见 topic
	// 分支的 parseYearlyArg / parseMonthlyArg）——它们不是被吞参数，检测必须放行，
	// 否则 `--topic love --yearly 2027`（流年论断指定年份）这一合法用法会被误伤。
	const consumed = exclusive === "--topic" ? ["yearly", "monthly"] : [];
	const shadowed = [...SHADOWABLE_KEYS]
		// 排除独占参数自身：info 在 SHADOWABLE 集合里（专题深入组），不过滤会报出
		// 「--info 不会生效：--info」的自指文案（palaces / topic 本就不在集合中，无影响）。
		.filter(n => n !== exclusive.slice(2))
		.filter(n => !consumed.includes(n))
		.filter(n => (args as Record<string, unknown>)[camelKey(n)] !== undefined);
	if (shadowed.length) {
		throw new Error(
			`${exclusive} 是独占分支，以下功能参数不会生效：${shadowed.map(n => `--${n}`).join("、")}。` +
				`独占分支请单独使用（优先级：${EXCLUSIVE_PRIORITY_LABEL}）。`
		);
	}
}

/**
 * `astrology` 命令：解读用的完整输入包（本 CLI 最常用的一条）。
 *
 * @param args - CLI 参数表；出生信息之外认专题旗标族 `--info` / `--pattern` / `--mutagen` /
 *   `--decadal [虚岁]` / `--ages [虚岁]` / `--yearly [年]` / `--monthly` / `--focus` /
 *   `--report`
 * @returns 已渲染好的文本；带 `--json` 时返回命盘 + 格局 + 三组四化的原始 JSON 字符串
 *
 * @remarks
 * **精简概览 + 专题分发**：不带任何专题旗标时输出口径提示、基本信息面板与运限速览 +
 * 专题指路；给了哪个专题旗标就只追加该专题的详版（可叠加，按 `--pattern` → `--mutagen`
 * → `--yearly` → `--decadal` → `--ages` → `--focus` 的固定顺序），且不再带面板与指路
 * —— 已在深入，基底与指路都是噪声。十二宫逐宫详表归 `--palaces` 与 `--json`。
 *
 * **零输入演示**：出生信息一项没给且未表达其他输出意图时，以内置虚构样例演示并附用法
 * 指路；部分输入不适用，继续按「缺一问一」报错。完整契约见 docs/code/cli-commands.md。
 */
/**
 * 「给定 args + 排盘上下文 → 产出专题 section 序列」—— 候选 3 把旗标 → section 的接线
 * 升为可直测 interface（原 `cmdAstrology` 默认路径的内联块）：接线本身成为被测物，
 * fortune 各 `*Section` 退为 implementation 零件，守卫链与 `parseAgesArg` / `deepDive`
 * 门沉进同一实现。
 *
 * 行为契约：与迁移前的内联块逐字节等价（无深掘时带信息面板 + 运限速览；给了任一专题旗标
 * 则跳过基底，按 pattern → mutagen → yearly → decadal → ages → focus 固定序追加）。
 * 候选 3 的收益见 docs/code/cli-commands.md。
 *
 * @param chart - 已生成的命盘
 * @param args - CLI 参数表
 * @param opts - 派生好的上下文：流年/流月/流日/流时、口径 basis、出生信息 info
 * @returns 已按顺序拼好的输出行（不含末尾 join）
 */
export function composeSections(
	chart: ZiweiChart,
	args: CliArgs,
	opts: {
		liuNianYear: number;
		liuYueMonth: number | null;
		liuRiDay: number | null;
		liuShiHour: number | null;
		basis: CaliberBasis;
		info: BirthInfo;
	}
): string[] {
	const { liuNianYear, liuYueMonth, liuRiDay, liuShiHour, basis, info } = opts;
	const out: string[] = [];
	out.push(...birthplaceSection(basis));
	out.push(...lateZiSection(chart, info, basis));
	// 深掘判据从声明派生（deep: true 六旗标），与 cmdAstrology 同源。
	const deepDive = DEEP_DIVE_KEYS.some(k => (args as Record<string, unknown>)[k] !== undefined);
	if (!deepDive) {
		out.push(
			"",
			...infoSection(chart, clockOptsFromBasis(basis)),
			"",
			...overviewSection(chart, liuNianYear)
		);
	}
	if (args.pattern) {
		out.push("", ...patternSection(chart));
	}
	// 流月/流日/流时四化随四化专题输出：单独给（不带 --mutagen）会被静默吞掉，在这里指路。
	// 只约束文本路径 —— --json 的对应顶层键是独立键（基准对拍依赖裸 --json --monthly）。
	if (
		(args.monthly !== undefined || args.daily !== undefined || args.hourly !== undefined) &&
		!args.mutagen
	) {
		throw new Error(
			"--monthly / --daily / --hourly 需要 --mutagen：运限四化在四化专题中输出，请加 --mutagen（流年缺省取当年，可用 --yearly 指定）。"
		);
	}
	if (args.daily !== undefined && liuYueMonth === null) {
		throw new Error(
			"--daily 需要 --monthly：流日干挂在农历年月日上，请用 --monthly 提供农历月（流年缺省取当年，可用 --yearly 指定）。"
		);
	}
	if (args.hourly !== undefined && args.daily === undefined) {
		throw new Error(
			"--hourly 需要 --daily：流时干由日干五鼠遁推，请用 --daily 提供农历日（时支 12 = 晚子时，按当日日干起遁）。"
		);
	}
	if (args.mutagen) {
		out.push("", ...mutagenSection(chart, { liuNianYear, liuYueMonth, liuRiDay, liuShiHour }));
	}
	if (args.yearly !== undefined) {
		out.push("", ...yearlySection(chart, liuNianYear));
	}
	if (args.decadal !== undefined) {
		out.push(
			"",
			...decadalSection(chart, parseAgesArg(args.decadal, chart.currentAge, "--decadal"))
		);
	}
	if (args.ages !== undefined) {
		out.push(
			"",
			...ageSection(chart, parseAgesArg(args.ages, chart.currentAge, "--ages"), liuNianYear)
		);
	}
	if (args.focus !== undefined) {
		// typeof 判空挡掉「给了 --focus 却没跟值」（parseArgs 存布尔 true）的形态 ——
		// focusSection 的归一表查不到 true，自然落到「聚焦失败」分支并列出可用宫名。
		const focus = typeof args.focus === "string" ? args.focus : String(args.focus);
		out.push("", ...focusSection(chart, focus, liuNianYear));
	}
	// 头部三行删除后，口径节可能为空（未给出生地且非晚子时）—— 清掉开头可能
	// 残留的空行，让面板或专题节直接顶格。
	while (out.length > 0 && out[0] === "") {
		out.shift();
	}
	return out;
}

export function cmdAstrology(args: CliArgs) {
	// --template：打印配置模板即止（不排盘）
	if (args.template) {
		return renderTemplate();
	}
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
	// 口径字段整包收进 basis（候选 6）：8 个局部变量逐个传递改为一包传递，
	// clockTime 折算由 toBasis 单点完成（此前两处 infoSection 各自逐字重复）。
	const built = buildBirthInfo(args);
	const basis = toBasis(built, args.time);
	const { info } = built;
	// 排盘走缓存层（键 = 出生信息 sha256）：同一份出生信息在本农历年内只排一次，
	// 换专题参数 / 换视角重跑时只付「读文件 + 渲染」。--no-cache 强制直排。
	const chart = generateChartCached(info, { noCache: args.noCache === true });

	// 生年四化的年干必须取**农历年干**（chart.lunarInfo.yearStem），与 iztro 落在
	// Star.mutagen 上的 mutagen 同源。不可用 getYearStemIndex(info.year)：那是公历年取模，
	// 1-2 月出生（农历仍在上一年）者两口径分叉，本区块会与宫详表自相矛盾
	// （实测 1990-01-15：农历己巳年 → 武曲化禄，公历取模却得庚 → 化权武曲）。
	const yearStem = chart.lunarInfo.yearStem;
	const native = getMutagenByStem(yearStem);
	// 注意：流年用 --yearly，不可复用 --year —— 后者是出生年的回退参数。
	// 二者同时给出不会报错：流年取 --yearly；而出生日期一旦给了 --date/--lunar，
	// --year 就被静默忽略（buildBirthInfo 里 --date/--lunar 优先），不会有任何提示。
	const liuNianYear = parseYearlyArg(args);
	const liuNian = getYearlyMutagen(liuNianYear);
	// 流月：农历月 1-12，取流年干推五虎遁（可选）
	const liuYueMonth = parseMonthlyArg(args);
	const liuYue = liuYueMonth !== null ? getMonthlyMutagen(liuNian.stemIndex, liuYueMonth) : null;
	// 流日 / 流时：取值校验在此（数值域），组合护栏（须配 --mutagen / --monthly / --daily）
	// 只守文本路径 —— --json 的对应顶层键是独立键，程序消费方自担取值链（基准对拍依赖裸 --json --monthly）。
	const liuRiDay = parseDailyArg(args);
	const liuShiHour = parseHourlyArg(args);

	// ── 融合分支（spec §1）──
	// --info：只输出信息面板这一节（面板本身在默认输出里无条件存在，本参数是「只看面板」）
	if (args.info) {
		if (args.json) {
			throw new Error(
				"--info 是独占分支，与 --json 不可同给：--info 只输出文本面板（--json 仅与完整概览或 --palaces 组合）。"
			);
		}
		// 优先级链落地：--palaces / --topic / --report 在场时，若放行到下面各分支，
		// 独占分支会被本分支**抢跑**吞掉（本分支排在它们之前）——指路，不静默。--info
		// 属于链上的「其他功能参数」：--palaces > --topic > --report > --info。
		const higher = args.palaces
			? "--palaces"
			: args.topic !== undefined
				? "--topic"
				: args.report
					? "--report"
					: null;
		if (higher) {
			throw new Error(
				`${higher} 是独占分支，以下功能参数不会生效：--info。` +
					`独占分支请单独使用（优先级：${EXCLUSIVE_PRIORITY_LABEL}）。`
			);
		}
		// 其余功能参数与本分支同给同样不会生效 —— 静默吞违反启动纪律，统一走独占检测指路。
		// palaces / topic / json 三者由上方各自的检查负责（职责不重复）。
		assertNoShadowedFeatures(args, "--info");
		return [
			...(usingSample ? [SAMPLE_HEADER, ""] : []),
			...infoSection(chart, clockOptsFromBasis(basis)),
			// --info 与「无功能参数的概览」同尾：面板后跟运限速览与
			// 专题指路 —— 两者都是「还没深入」的形态，指路正好；给了具体专题参数的
			// 输出则不再带这两节（已在深入，指路是噪声）。
			"",
			...overviewSection(chart, liuNianYear),
			...(usingSample ? SAMPLE_TRAILER : []),
		].join("\n");
	}

	// --palaces：十二宫逐宫详表。
	// --palaces --json 顶层即命盘本身（不带格局/四化包装）。
	if (args.palaces) {
		assertNoShadowedFeatures(args, "--palaces");
		if (args.json) {
			return JSON.stringify(chart, null, 2);
		}
		const out = [
			`命盘  ${info.name ?? ""} ${fmtDate(info)} ${basis.note} · ${genderCN(info.gender)}`,
			`农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
			`命宫：${BRANCHES[chart.soulBranch]} · 身宫：${BRANCHES[chart.bodyBranch]} · 五行局：${chart.fiveElementsClassName} · 紫微：${BRANCHES[chart.ziweiPos]}`,
			"",
		];
		out.push(...birthplaceSection(basis));
		out.push(...lateZiSection(chart, info, basis));
		out.push("─".repeat(56));
		for (const p2 of chart.palaces) {
			out.push(renderPalace(p2, chart), "");
		}
		out.push(
			"大限：" +
				chart.decadals
					.map(
						d =>
							`${d.startAge}-${d.endAge}岁 ${d.palaceName}(${BRANCHES[d.palaceBranch]})`
					)
					.join(" | ")
		);
		out.push(
			`当前年龄：${chart.currentAge}岁 · 当前大限：${chart.decadals[chart.currentDecadalIndex]?.palaceName ?? "—"}`
		);
		return out.join("\n");
	}

	// --topic：主题论断。不带值（或裸开关）= 列 13 主题清单。
	if (args.topic !== undefined) {
		if (args.json) {
			throw new Error(
				"--topic 是独占分支，与 --json 不可同给：主题论断只有文本形态（--json 仅与完整概览或 --palaces 组合）。"
			);
		}
		// 检测在列清单判断之前：yearly / monthly 是 --topic 自己消费的参数（已放行），
		// 其余被吞功能参数在列清单路径同样不会生效，一并指路。
		assertNoShadowedFeatures(args, "--topic");
		if (args.topic === true) {
			const rows = (Object.keys(TOPIC_LABEL) as TopicKey[]).map(
				k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k]}（看${TOPIC_PALACE_NAME[k]}）`
			);
			return [
				`${Object.keys(TOPIC_LABEL).length} 个主题（--topic <key> 选其一）：`,
				...rows,
				"",
				"view 可选：mingpan（本命，默认）/ daxian（当前大限）/ liunian（流年）/ liuyue（流月）",
				"　　　　 也可用同名英文：decadal / yearly / monthly",
				"示例：node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --topic love（示例数据为虚构）",
			].join("\n");
		}
		const topic = String(args.topic) as TopicKey;
		if (!TOPIC_LABEL[topic]) {
			throw new Error(
				`--topic 应为 ${Object.keys(TOPIC_LABEL).length} 个主题之一（${Object.keys(TOPIC_LABEL).join("/")}），收到：${args.topic}`
			);
		}
		const viewRaw = args.view !== undefined ? String(args.view) : "mingpan";
		const view = VIEW_ALIASES[viewRaw];
		if (!view) {
			throw new Error(
				`--view 应为 mingpan/daxian/liunian/liuyue（或同名英文 decadal/yearly/monthly），收到：${args.view}`
			);
		}
		const text = getTopicAnalysis(chart, topic, {
			view,
			liunianYear: parseYearlyArg(args),
			liuyueMonth: parseMonthlyArg(args) ?? undefined,
		});
		return [
			chartHeader(`【主题论断 · ${TOPIC_LABEL[topic]}】`, info, basis.note),
			"",
			text,
			"",
			"⚠️ 知识来源分级：以上论断出自分析数据库 v3 —— 其中「倪师说」引号句部分为传统口诀的",
			"   风格化转述，不一定是《天纪》逐字原话（verified / traditional / methodology / suspect 四级），",
			"   引用下断语时请注明口径。",
		].join("\n");
	}

	// --report：全盘主题报告（Markdown，独占分支）。13 个板块一次出全，
	// 本命静态口径 —— 视角 / 流年 / 流月参数不属于它，由独占检测与 --view 检查指路。
	if (args.report) {
		if (args.json) {
			throw new Error(
				"--report 是独占分支，与 --json 不可同给：全盘报告只有 Markdown 文本形态（--json 仅与完整概览或 --palaces 组合）。"
			);
		}
		assertNoShadowedFeatures(args, "--report");
		if (args.view !== undefined) {
			throw new Error(
				"--report 为本命静态口径，不接受 --view（运限视角的单主题论断见 --topic <key> --view daxian|liunian|liuyue）。"
			);
		}
		return buildReport(chart, info, basis);
	}

	if (args.json) {
		// 契约生产端提为具名纯函数（buildAnalyzeJson）：键名集中一处，selftest 可进程内直测。
		// 只传语义参数 —— 四化派生收在函数内部，天然一致。
		return buildAnalyzeJson({
			chart,
			liuNianYear,
			liuYueMonth,
			liuRiDay,
			liuShiHour,
			basis,
		});
	}

	// ── 未深入形态的输出基底 ──
	// 基本信息面板 + 运限速览 + 专题指路 / 深掘专题详版，统一交给 composeSections
	// （候选 3：旗标→section 接线升为可测 interface，接线本身成为被测物）。
	return composeSections(chart, args, {
		liuNianYear,
		liuYueMonth,
		liuRiDay,
		liuShiHour,
		basis,
		info,
	}).join("\n");
}
