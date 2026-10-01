/**
 * `astrology` 命令：排盘分析一条命令（原 analyze 更名，2026-09-30 命令面收敛）。
 *
 * 拆自 commands.ts（各命令按文件拆分，spec §2.2）；四命令融合（chart/topic 并入
 * 参数）留 Task 6，本文件先承载 analyze 的原实现。
 */

import type { BirthInfo, Mutagen, ZiweiChart } from "@/ziwei/types";
import type { CliArgs } from "./args";
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
			// 流年命宫与小限宫（运限速览的结构化等价物，2026-09-28 新增，只加不删）
			liuNianPalace: {
				year: liuNianYear,
				branchIndex: yearlyBranchOf(liuNianYear),
				branch: BRANCHES[yearlyBranchOf(liuNianYear)],
				palaceName:
					chart.palaces.find(p => p.branch === yearlyBranchOf(liuNianYear))?.name ?? null,
			},
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
 * `astrology` 命令：解读用的完整输入包（本 CLI 最常用的一条；原 analyze，2026-09-30 更名）。
 *
 * @param args - CLI 参数表；出生信息之外认专题旗标族 `--info` / `--pattern` / `--mutagen` /
 *   `--decadal [虚岁]` / `--ages [虚岁]` / `--yearly [年]` / `--monthly` / `--focus`
 * @returns 已渲染好的文本；带 `--json` 时返回命盘 + 格局 + 三组四化的原始 JSON 字符串
 *
 * @remarks
 * **精简概览 + 专题分发**（2026-09-28 起）：不带任何专题旗标时只输出命盘总览、
 * 口径提示（出生地 / 晚子时）与一行运限速览 + 专题指路；给了哪个专题旗标就**只追加**
 * 该专题的详版（可叠加，按 --info → --pattern → --mutagen → --yearly → --decadal → --ages
 * → --focus 的固定顺序）。十二宫逐宫详表归 `chart` 命令与 `--json`，不再默认铺开。
 *
 * 命宫空宫时 `getMingGongSummary` 返回空关键词 / 空星性，`--json` 的消费方
 * （合盘 skill）自会处理；文本路径的宫详表见 `./fortune.ts` 各专题。
 */
export function cmdAstrology(args: CliArgs) {
	// --template：打印配置模板即止（不排盘）
	if (args.template) return renderTemplate();
	// --config：配置是基底，命令行同名键覆盖（spec §3.3）
	args = applyConfig(args);
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

	// ── 融合分支（2026-09-30 四命令合一，spec §1）──
	// --info：只输出信息面板这一节（面板本身在默认输出里无条件存在，本参数是「只看面板」）
	if (args.info) {
		return [
			chartHeader("【命盘总览】", info, note),
			"",
			...infoSection(chart, {
				clockTime: typeof args.time === "string" ? args.time : null,
				solarNote: note,
				longitude,
			}),
		].join("\n");
	}

	// --palaces：十二宫逐宫详表（原 chart 命令的职责，2026-09-30 起并入本参数）。
	// --palaces --json 与原 chart --json 同形：顶层即命盘本身（不带格局/四化包装）。
	if (args.palaces) {
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
					.map(d => `${d.startAge}-${d.endAge}岁 ${d.palaceName}(${BRANCHES[d.palaceBranch]})`)
					.join(" | ")
		);
		out.push(
			`当前年龄：${chart.currentAge}岁 · 当前大限：${chart.decadals[chart.currentDecadalIndex]?.palaceName ?? "—"}`
		);
		return out.join("\n");
	}

	// --topic：主题论断（原 topic 命令的职责）。不带值（或裸开关）= 列 13 主题清单。
	if (args.topic !== undefined) {
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

	const out: string[] = [];
	out.push(`${chartHeader("【命盘总览】", info, note)} · 经度 ${longitude}°E`);
	out.push(
		`农历 ${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱 ${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]} · ${chart.fiveElementsClassName}`
	);
	out.push(
		`命宫 ${BRANCHES[chart.soulBranch]} · 身宫 ${BRANCHES[chart.bodyBranch]} · 紫微落 ${BRANCHES[chart.ziweiPos]} · 三方四正 ${surroundNames(chart, chart.soulBranch).join("/")}`
	);
	out.push("");

	out.push(...birthplaceSection(lngNote, lngAmbiguous));
	out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
	// ── 基本信息面板：无条件输出（2026-09-30 融合契约，spec §1）──
	// 从前它是 --info 专题；spec §0 的用户反馈第一条就是「基本信息应默认可见」。
	out.push(
		"",
		...infoSection(chart, {
			clockTime: typeof args.time === "string" ? args.time : null,
			solarNote: note,
			longitude,
		})
	);
	out.push(...overviewSection(chart, liuNianYear));
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
		out.push("", ...decadalSection(chart, parseAgesArg(args.decadal, chart.currentAge, "--decadal")));
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

	return out.join("\n");
}

