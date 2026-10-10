/**
 * `astrology` 命令：排盘分析一条命令。
 *
 * 各命令按文件拆分（spec §2.2）；chart/topic 融入参数（见 spec §1）。
 */

import type { BirthInfo, Mutagen, ZiweiChart } from "@/ziwei/types";
import type { CliArgs } from "./args";
import { camelKey, OPTION_GROUPS } from "./args";
import { applyConfig, renderTemplate } from "./config";
import { buildBirthInfo } from "./birth-info";
import {
	birthplaceSection,
	fmtDate,
	genderCN,
	lateZiSection,
	locateSihua,
	renderPalace,
	surroundNames,
} from "./render";
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
import { generateChart } from "@/ziwei/algorithm";
import { detectPatterns, getMingGongSummary } from "@/ziwei/patterns";
import { getMutagenByStem, getYearlyMutagen, getMonthlyMutagen } from "@/ziwei/mutagen";
import { STEMS, BRANCHES } from "@/ziwei/constants";
import {
	getTopicAnalysis,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type TopicKey,
	type AnalysisView,
} from "@/ziwei/analysis";

/**
 * `--yearly` 的年份校验（`analyze` 的流年专题与 `topic` 的流年论断共用）。
 *
 * @param args - CLI 参数表
 * @returns 流年年份；未给或裸开关时默认当前公历年（裸开关的语义就是「深入今年」）
 * @throws 非整数或超出 1-9999 时
 *
 * @remarks
 * 非数字静默传下去会得到「NaN 天干 → 四空串」的垃圾输出，与 `--monthly` 同一纪律：
 * 宁可报错，不静默产出错盘。
 */
export function parseYearlyArg(args: CliArgs): number {
	const y =
		args.yearly !== undefined && args.yearly !== true
			? Number(args.yearly)
			: new Date().getFullYear();
	if (!Number.isInteger(y) || y < 1 || y > 9999)
		throw new Error(`--yearly 应为 1-9999 的整数年份，收到：${args.yearly}`);
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
	if (args.monthly === true) throw new Error("--monthly 需要一个农历月值（如 --monthly 6）");
	const m = args.monthly !== undefined ? Number(args.monthly) : null;
	if (m !== null && (!Number.isInteger(m) || m < 1 || m > 12))
		throw new Error("--monthly 应为农历月 1-12");
	return m;
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
 * {@link readAnalyzeJson|synastry/chart-view 的 readAnalyzeJson} 所消费的形状。
 *
 * @remarks
 * 提为具名纯函数是为了让契约**一处生产、一处消费、一处对拍** —— 键名不再散落在
 * 分发函数中段，selftest 可以进程内直调本函数、把产物喂给消费方校验（原先是子进程
 * 端到端才能测的形状）。顶层键即输出契约：chart / patterns / mingGongSummary /
 * nativeSiHua / liuNianSiHua / liuYueSiHua / liuNianPalace / xiaoXian / lateZi / basis。
 */
export function buildAnalyzeJson(input: {
	chart: ZiweiChart;
	/** 流年年号（`--yearly` 的值；缺省当年由 caller 先经 parseYearlyArg 归一） */
	liuNianYear: number;
	/** 农历月 1-12；`null` = 不算流月 */
	liuYueMonth: number | null;
	/** 排盘依据（日期换算 / 出生地解析 / 时辰校正的说明），原样进 `basis` 键 */
	basis: { note: string; notes: string[]; lateZiCandidate: boolean; isLateZi: boolean };
}): string {
	const { chart, liuNianYear, liuYueMonth, basis } = input;
	// 派生收进实现内部（caller 只给语义参数，_interface_ 上不存在「传错组合」的态空间）：
	// 年干取农历口径（与宫详表同源），生年四化与流年/流月四化由查表函数从年号重算 ——
	// 全是纯函数，重算零成本，换来的是少 7 个参数与天然一致。
	const yearStem = chart.lunarInfo.yearStem;
	const native = getMutagenByStem(yearStem);
	const liuNian = getYearlyMutagen(liuNianYear);
	const liuYue = liuYueMonth !== null ? getMonthlyMutagen(liuNian.stemIndex, liuYueMonth) : null;
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
			// 排盘依据：日期换算 / 出生地解析 / 时辰校正三类说明，让这份 JSON 自描述
			// 「这张盘是怎么来的」，下游（合盘 skill）据此复述真太阳时与晚子时提示，
			// 而不必自己重做一遍出生信息解析。
			// 键名刻意不叫 trueSolar —— notes 里还含农历换算与出生地解析，与真太阳时无关。
			basis,
		},
		null,
		2
	);
}

/**
 * 可被独占分支吞掉的功能参数集合——从声明表**派生**：专题深入组的全部参数
 * （palaces 自身除外）加上输出与选题组里的 yearly / monthly / focus。
 */
const SHADOWABLE = new Set(
	OPTION_GROUPS.flatMap(g => {
		if (g.title.startsWith("专题深入"))
			return g.options.map(o => o.name).filter(n => n !== "palaces");
		if (g.title === "输出与选题")
			return g.options
				.filter(o => ["yearly", "monthly", "focus"].includes(o.name))
				.map(o => o.name);
		return [];
	})
);

/**
 * 出生相关参数名（camelCase）—— 从声明表派生：前三组（出生日期 / 出生时辰 / 其他出生
 * 信息）的全部参数。零输入演示的判据之一：这些键**全部**缺席。位置参数归类与
 * `--config` 注入都发生在此之前（parseArgs / applyConfig），二者给出的出生信息均算「已输入」。
 */
const BIRTH_KEYS = OPTION_GROUPS.flatMap(g =>
	g.title.startsWith("出生") ? g.options.map(o => camelKey(o.name)) : []
);

/**
 * 表达了输出意图的功能参数（camelCase）—— 从声明表派生：专题深入组与输出选题组的
 * 全部参数，刨去 `info`（零输入时它正是演示目标）与 `config`（它是参数来源而非输出
 * 形态，配置里没写出生信息时同样允许落演示）。零输入 + 这些参数在场 = 用户要特定
 * 输出，不替他排虚构盘 —— 交回原路径按「缺一问一」报错（`--json` 尤其如此：机器
 * 接口不喂虚构数据）。
 */
const INTENT_KEYS = OPTION_GROUPS.flatMap(g =>
	g.title.startsWith("专题深入") || g.title === "输出与选题"
		? g.options.map(o => camelKey(o.name)).filter(k => k !== "info" && k !== "config")
		: []
);

/**
 * 零输入演示的内置虚构样例 —— 与 help 示例、`--template` 配置模板同源
 * （2011-06-24 07:45 杭州 male），输出自带「虚构」声明，不会被误当真实排盘。
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
 * 独占分支（--palaces / --topic / --info）激活时，其余功能参数不会生效——静默吞违反
 * 「宁可启动失败，也不静默产出错盘」，在这里指路。优先级链：
 * --palaces > --topic > 其他功能参数（--info 属于链上的「其他功能参数」，但它自身
 * 也是独占分支——只输出面板一节；--json 仅与 --palaces 组合，见各自分支）。
 */
function assertNoShadowedFeatures(
	args: CliArgs,
	exclusive: "--palaces" | "--topic" | "--info"
): void {
	// --topic 自身**消费** --yearly / --monthly（流年/流月视角的年份与农历月，见 topic
	// 分支的 parseYearlyArg / parseMonthlyArg）——它们不是被吞参数，检测必须放行，
	// 否则 `--topic love --yearly 2027`（流年论断指定年份）这一合法用法会被误伤。
	const consumed = exclusive === "--topic" ? ["yearly", "monthly"] : [];
	const shadowed = [...SHADOWABLE]
		// 排除独占参数自身：info 在 SHADOWABLE 集合里（专题深入组），不过滤会报出
		// 「--info 不会生效：--info」的自指文案（palaces / topic 本就不在集合中，无影响）。
		.filter(n => n !== exclusive.slice(2))
		.filter(n => !consumed.includes(n))
		.filter(n => (args as Record<string, unknown>)[camelKey(n)] !== undefined);
	if (shadowed.length)
		throw new Error(
			`${exclusive} 是独占分支，以下功能参数不会生效：${shadowed.map(n => `--${n}`).join("、")}。` +
				`独占分支请单独使用（优先级：--palaces > --topic > 其他功能参数）。`
		);
}

/**
 * `astrology` 命令：解读用的完整输入包（本 CLI 最常用的一条）。
 *
 * @param args - CLI 参数表；出生信息之外认专题旗标族 `--info` / `--pattern` / `--mutagen` /
 *   `--decadal [虚岁]` / `--ages [虚岁]` / `--yearly [年]` / `--monthly` / `--focus`
 * @returns 已渲染好的文本；带 `--json` 时返回命盘 + 格局 + 三组四化的原始 JSON 字符串
 *
 * @remarks
 * **精简概览 + 专题分发**：不带任何专题旗标时
 * 输出口径提示（出生地 / 晚子时）、基本信息面板与运限速览 + 专题指路（--info 同尾：
 * 面板 + 两节；公历生日 / 命宫 / 紫微落 / 三方四正并入面板）；给了
 * 哪个专题旗标就只追加该专题的详版（可叠加，按 --pattern → --mutagen → --yearly →
 * --decadal → --ages → --focus 的固定顺序），且不再带面板与运限速览/指路 —— 已在
 * 深入，基底与指路都是噪声。十二宫逐宫详表归 `--palaces` 与 `--json`。
 *
 * **零输入演示**：出生信息一项没给且未表达其他输出意图（`--json` /
 * `--palaces` / `--topic` / 专题参数均不在场）时，不报「缺少出生日期」，以内置虚构
 * 样例（2011-06-24 07:45 杭州 male）演示基本信息面板 + 运限速览 + 专题指路并附用法
 * 指路；部分输入不适用，继续按「缺一问一」报错。
 *
 * 命宫空宫时 `getMingGongSummary` 返回空关键词 / 空星性，`--json` 的消费方
 * （合盘 skill）自会处理；文本路径的宫详表见 `./fortune.ts` 各专题。
 */
export function cmdAstrology(args: CliArgs) {
	// --template：打印配置模板即止（不排盘）
	if (args.template) return renderTemplate();
	// --config：配置是基底，命令行同名键覆盖（spec §3.3）
	args = applyConfig(args);
	// ── 零输入演示契约：出生信息一项没给且未表达其他输出意图时，
	// 不报「缺少出生日期」，改以内置虚构样例演示基本信息面板。部分输入不适用 ——
	// 给了一半说明想排特定的盘，继续走「缺一问一」报错；--json / --palaces / --topic /
	// 专题参数在场同样不适用：那是明确的输出意图，虚构盘只会伪装成他要的产物。
	const usingSample =
		BIRTH_KEYS.every(k => (args as Record<string, unknown>)[k] === undefined) &&
		!INTENT_KEYS.some(k => (args as Record<string, unknown>)[k] !== undefined);
	if (usingSample) args = { ...args, ...SAMPLE_BIRTH, info: true };
	const { info, note, notes, longitude, lateZiCandidate, isLateZi, lngNote, lngAmbiguous } =
		buildBirthInfo(args);
	const chart = generateChart(info);

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

	// ── 融合分支（spec §1）──
	// --info：只输出信息面板这一节（面板本身在默认输出里无条件存在，本参数是「只看面板」）
	if (args.info) {
		if (args.json)
			throw new Error(
				"--info 是独占分支，与 --json 不可同给：--info 只输出文本面板（--json 仅与完整概览或 --palaces 组合）。"
			);
		// 优先级链落地：--palaces / --topic 在场时，若放行到下面各分支，独占分支会被
		// 本分支**抢跑**吞掉（本分支排在它们之前）——指路，不静默。--info 属于链上的
		// 「其他功能参数」：--palaces > --topic > --info。
		const higher = args.palaces ? "--palaces" : args.topic !== undefined ? "--topic" : null;
		if (higher)
			throw new Error(
				`${higher} 是独占分支，以下功能参数不会生效：--info。` +
					`独占分支请单独使用（优先级：--palaces > --topic > 其他功能参数）。`
			);
		// 其余功能参数（--pattern / --mutagen / --decadal / --ages / --yearly / --monthly /
		// --focus）与本分支同给同样不会生效——静默吞违反启动纪律，统一走独占检测指路。
		// palaces / topic / json 三者由上方各自的检查负责（职责不重复）。
		assertNoShadowedFeatures(args, "--info");
		return [
			...(usingSample ? [SAMPLE_HEADER, ""] : []),
			...infoSection(chart, {
				clockTime: typeof args.time === "string" ? args.time : null,
				solarNote: note,
				longitude,
			}),
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
		if (args.json) return JSON.stringify(chart, null, 2);
		const out = [
			`命盘  ${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)}`,
			`农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
			`命宫：${BRANCHES[chart.soulBranch]} · 身宫：${BRANCHES[chart.bodyBranch]} · 五行局：${chart.fiveElementsClassName} · 紫微：${BRANCHES[chart.ziweiPos]}`,
			"",
		];
		out.push(...birthplaceSection(lngNote, lngAmbiguous));
		out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
		out.push("─".repeat(56));
		for (const p2 of chart.palaces) out.push(renderPalace(p2, chart), "");
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
		if (args.json)
			throw new Error(
				"--topic 是独占分支，与 --json 不可同给：主题论断只有文本形态（--json 仅与完整概览或 --palaces 组合）。"
			);
		// 检测在列清单判断之前：yearly / monthly 是 --topic 自己消费的参数（已放行），
		// 其余被吞功能参数在列清单路径同样不会生效，一并指路。
		assertNoShadowedFeatures(args, "--topic");
		if (args.topic === true) {
			const rows = (Object.keys(TOPIC_LABEL) as TopicKey[]).map(
				k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k]}（看${TOPIC_PALACE_NAME[k]}）`
			);
			return [
				"13 个主题（--topic <key> 选其一）：",
				...rows,
				"",
				"view 可选：mingpan（本命，默认）/ daxian（当前大限）/ liunian（流年）/ liuyue（流月）",
				"示例：node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --topic love（示例数据为虚构）",
			].join("\n");
		}
		const topic = String(args.topic) as TopicKey;
		if (!TOPIC_LABEL[topic])
			throw new Error(
				`--topic 应为 13 个主题之一（${Object.keys(TOPIC_LABEL).join("/")}），收到：${args.topic}`
			);
		const viewRaw = args.view !== undefined ? String(args.view) : "mingpan";
		if (!["mingpan", "daxian", "liunian", "liuyue"].includes(viewRaw))
			throw new Error(`--view 应为 mingpan/daxian/liunian/liuyue，收到：${args.view}`);
		const view = viewRaw as AnalysisView;
		const text = getTopicAnalysis(chart, topic, {
			view,
			liunianYear: parseYearlyArg(args),
			liuyueMonth: parseMonthlyArg(args) ?? undefined,
		});
		return [
			chartHeader(`【主题论断 · ${TOPIC_LABEL[topic]}】`, info, note),
			"",
			text,
			"",
			"⚠️ 知识来源分级：以上论断出自分析数据库 v3 —— 其中「倪师说」引号句部分为传统口诀的",
			"   风格化转述，不一定是《天纪》逐字原话（verified / traditional / methodology / suspect 四级），",
			"   引用下断语时请注明口径。",
		].join("\n");
	}

	if (args.json) {
		// 契约生产端提为具名纯函数（buildAnalyzeJson）：键名集中一处，selftest 可进程内直测。
		// 只传语义参数 —— 四化派生收在函数内部，天然一致。
		return buildAnalyzeJson({
			chart,
			liuNianYear,
			liuYueMonth,
			basis: { note, notes, lateZiCandidate, isLateZi },
		});
	}

	// ── 未深入形态的输出基底 ──
	// 基本信息面板（公历生日 / 姓名 / 命宫 / 紫微落 / 三方四正，见 infoSection）──
	const out: string[] = [];
	out.push(...birthplaceSection(lngNote, lngAmbiguous));
	out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
	// ── 未深入形态的基底：基本信息面板 + 运限速览 + 专题指路
	// 三者同进退，只在「无功能参数的概览」输出（--info 与零输入演示态同尾）。
	// 给了具体专题参数的输出只保留命盘总览与口径提示 + 专题详版 ——
	// 已在深入，基底与指路都是噪声（--monthly 必配 --mutagen，归 mutagen 管）。
	const deepDive =
		args.pattern ||
		args.mutagen ||
		args.yearly !== undefined ||
		args.decadal !== undefined ||
		args.ages !== undefined ||
		args.focus !== undefined;
	if (!deepDive)
		out.push(
			"",
			...infoSection(chart, {
				clockTime: typeof args.time === "string" ? args.time : null,
				solarNote: note,
				longitude,
			}),
			"",
			...overviewSection(chart, liuNianYear)
		);
	if (args.pattern) out.push("", ...patternSection(chart));
	// 流月四化随四化专题输出：单独给 --monthly（不带 --mutagen）会被静默吞掉，在这里指路。
	// 只约束文本路径 —— --json 的 liuYueSiHua 是独立顶层键（基准对拍依赖裸 --json --monthly）。
	if (args.monthly !== undefined && !args.mutagen)
		throw new Error(
			"--monthly 需要 --mutagen：流月四化在四化专题中输出，请加 --mutagen（流年缺省取当年，可用 --yearly 指定）。"
		);
	if (args.mutagen) out.push("", ...mutagenSection(chart, liuNianYear, liuYueMonth));
	if (args.yearly !== undefined) out.push("", ...yearlySection(chart, liuNianYear));
	if (args.decadal !== undefined)
		out.push(
			"",
			...decadalSection(chart, parseAgesArg(args.decadal, chart.currentAge, "--decadal"))
		);
	if (args.ages !== undefined)
		out.push(
			"",
			...ageSection(chart, parseAgesArg(args.ages, chart.currentAge, "--ages"), liuNianYear)
		);
	if (args.focus !== undefined) {
		// typeof 判空挡掉「给了 --focus 却没跟值」（parseArgs 存布尔 true）的形态 ——
		// focusSection 的归一表查不到 true，自然落到「聚焦失败」分支并列出可用宫名。
		const focus = typeof args.focus === "string" ? args.focus : String(args.focus);
		out.push("", ...focusSection(chart, focus, liuNianYear));
	}

	// 头部三行删除后，口径节可能为空（未给出生地且非晚子时）—— 清掉开头可能
	// 残留的空行，让面板或专题节直接顶格。
	while (out.length > 0 && out[0] === "") out.shift();
	return out.join("\n");
}
