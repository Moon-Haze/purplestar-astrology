/**
 * 命令实现 —— 各 `cmdXxx` 与命令表。
 *
 * 拆自 purple-star.ts。各命令互不调用，故集中在一处反而好对照；
 * 只有 `selftest` 另立门户（见 ./selftest.ts 的说明）。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliArgs, CliContext } from "./args";
import { buildBirthInfo, findLongitude } from "./birth-info";
import {
	birthplaceSection,
	fmtDate,
	genderCN,
	lateZiSection,
	locateSihua,
	renderPalace,
	sanFangSiZheng,
} from "./render";
import {
	daXianSection,
	focusSection,
	gejuSection,
	infoSection,
	liuNianBranchOf,
	liuNianSection,
	overviewSection,
	parseAgeArg,
	sihuaSection,
	xiaoXianPalaceOf,
	xiaoXianSection,
} from "./yun";
import { cmdSelftest } from "./selftest";
import { generateChart } from "@/ziwei/algorithm";
import { detectPatterns, getMingGongSummary } from "@/ziwei/patterns";
import { getSiHuaByStem, getLiuNianSiHua, getLiuYueSiHua } from "@/ziwei/sihua";
import {
	getTopicAnalysis,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type TopicKey,
	type AnalysisView,
} from "@/ziwei/analysis";
import { STEMS, BRANCHES, STAR_DESCRIPTIONS } from "@/ziwei/constants";
import { PROVINCES } from "@/ziwei/cities";

/**
 * `--liunian` 的年份校验（`analyze` 的流年专题与 `topic` 的流年论断共用）。
 *
 * @param args - CLI 参数表
 * @returns 流年年份；未给或裸开关时默认当前公历年（裸开关的语义就是「深入今年」）
 * @throws 非整数或超出 1-9999 时
 *
 * @remarks
 * 非数字静默传下去会得到「NaN 天干 → 四空串」的垃圾输出，与 `--liuyue` 同一纪律：
 * 宁可报错，不静默产出错盘。
 */
function parseLiuNianArg(args: CliArgs): number {
	const y =
		args.liunian !== undefined && args.liunian !== true
			? Number(args.liunian)
			: new Date().getFullYear();
	if (!Number.isInteger(y) || y < 1 || y > 9999)
		throw new Error(`--liunian 应为 1-9999 的整数年份，收到：${args.liunian}`);
	return y;
}

/**
 * `--liuyue` 的农历月校验（`analyze` 与 `topic` 共用）。
 *
 * @param args - CLI 参数表
 * @returns 农历月 1-12；未给时为 `null`（表示「不算流月」）
 * @throws 非整数或超出 1-12 时
 */
function parseLiuYueArg(args: CliArgs): number | null {
	// 裸开关必须报错：Number(true) = 1 会让它被静默当成农历一月（与 --liunian 不同，
	// 流月的「当前月」没有明确语义 —— 农历月随流年干五虎遁推，不设默认）。
	if (args.liuyue === true) throw new Error("--liuyue 需要一个农历月值（如 --liuyue 6）");
	const m = args.liuyue !== undefined ? Number(args.liuyue) : null;
	if (m !== null && (!Number.isInteger(m) || m < 1 || m > 12))
		throw new Error("--liuyue 应为农历月 1-12");
	return m;
}

/**
 * `chart` 命令：纯排盘十二宫。
 *
 * @param args - CLI 参数表
 * @returns 已渲染好的文本；带 `--json` 时返回命盘的原始 JSON 字符串
 *
 * @remarks
 * 最小排盘：只要出生信息，不算流年、格局与四化。输出命盘头（姓名 / 日期 / 时辰 / 性别 / 农历 /
 * 命身宫 / 五行局 / 紫微位）、出生地与晚子时提示、逐宫详表，最后是大限一览与当前年龄大限。
 *
 * 返回字符串而不打印 —— `console.log` 由引导层统一负责（本文件命令皆然）。
 */
function cmdChart(args: CliArgs) {
	const { info, note, lateZiCandidate, isLateZi, lngNote, lngAmbiguous } = buildBirthInfo(args);
	const chart = generateChart(info);

	if (args.json) return JSON.stringify(chart, null, 2);

	const out = [
		`命盘  ${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)}`,
		`农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
		`命宫：${BRANCHES[chart.mingGongBranch]} · 身宫：${BRANCHES[chart.shenGongBranch]} · 五行局：${chart.wuxingJuName} · 紫微：${BRANCHES[chart.ziweiPos]}`,
		"",
	];
	out.push(...birthplaceSection(lngNote, lngAmbiguous));
	out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
	out.push("─".repeat(56));
	for (const p of chart.palaces) out.push(renderPalace(p, chart), "");
	out.push(
		"大限：" +
			chart.daXians
				.map(
					d => `${d.startAge}-${d.endAge}岁 ${d.palaceName}(${BRANCHES[d.palaceBranch]})`
				)
				.join(" | ")
	);
	out.push(
		`当前年龄：${chart.currentAge}岁 · 当前大限：${chart.daXians[chart.currentDaXianIndex]?.palaceName ?? "—"}`
	);
	return out.join("\n");
}

/**
 * `analyze` 命令：解读用的完整输入包（本 CLI 最常用的一条）。
 *
 * @param args - CLI 参数表；出生信息之外认专题旗标族 `--info` / `--geju` / `--sihua` /
 *   `--daxian [虚岁]` / `--xiaoxian [虚岁]` / `--liunian [年]` / `--liuyue` / `--focus`
 * @returns 已渲染好的文本；带 `--json` 时返回命盘 + 格局 + 三组四化的原始 JSON 字符串
 *
 * @remarks
 * **精简概览 + 专题分发**（2026-09-28 起）：不带任何专题旗标时只输出命盘总览、
 * 口径提示（出生地 / 晚子时）与一行运限速览 + 专题指路；给了哪个专题旗标就**只追加**
 * 该专题的详版（可叠加，按 --info → --geju → --sihua → --liunian → --daxian → --xiaoxian
 * → --focus 的固定顺序）。十二宫逐宫详表归 `chart` 命令与 `--json`，不再默认铺开。
 *
 * 命宫空宫时 `getMingGongSummary` 返回空关键词 / 空星性，`--json` 的消费方
 * （合盘 skill）自会处理；文本路径的宫详表见 `./yun.ts` 各专题。
 */
function cmdAnalyze(args: CliArgs) {
	const { info, note, notes, longitude, lateZiCandidate, isLateZi, lngNote, lngAmbiguous } =
		buildBirthInfo(args);
	const chart = generateChart(info);

	// 生年四化的年干必须取**农历年干**（chart.lunarInfo.yearStem），与 iztro 落在
	// Star.siHua 上的 mutagen 同源。不可用 getYearStemIndex(info.year)：那是公历年取模，
	// 1-2 月出生（农历仍在上一年）者两口径分叉，本区块会与宫详表自相矛盾
	// （实测 1990-01-15：农历己巳年 → 武曲化禄，公历取模却得庚 → 化权武曲）。
	const yearStem = chart.lunarInfo.yearStem;
	const native = getSiHuaByStem(yearStem);
	// 注意：流年用 --liunian，不可复用 --year —— 后者是出生年的回退参数。
	// 二者同时给出不会报错：流年取 --liunian；而出生日期一旦给了 --date/--lunar，
	// --year 就被静默忽略（buildBirthInfo 里 --date/--lunar 优先），不会有任何提示。
	const liuNianYear = parseLiuNianArg(args);
	const liuNian = getLiuNianSiHua(liuNianYear);
	// 流月：农历月 1-12，取流年干推五虎遁（可选）
	const liuYueMonth = parseLiuYueArg(args);
	const liuYue = liuYueMonth !== null ? getLiuYueSiHua(liuNian.stemIndex, liuYueMonth) : null;

	if (args.json) {
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
					branchIndex: liuNianBranchOf(liuNianYear),
					branch: BRANCHES[liuNianBranchOf(liuNianYear)],
					palaceName:
						chart.palaces.find(p => p.branch === liuNianBranchOf(liuNianYear))?.name ?? null,
				},
				xiaoXian: (() => {
					const p = xiaoXianPalaceOf(chart, chart.currentAge);
					return {
						age: chart.currentAge,
						palaceBranchIndex: p.branch,
						palaceBranch: BRANCHES[p.branch],
						palaceName: p.name,
					};
				})(),
				lateZi: { candidate: lateZiCandidate, applied: isLateZi },
				// 排盘依据：日期换算 / 出生地解析 / 时辰校正三类说明，让这份 JSON 自描述
				// 「这张盘是怎么来的」，下游（合盘 skill）据此复述真太阳时与晚子时提示，
				// 而不必自己重做一遍出生信息解析。
				// 键名刻意不叫 trueSolar —— notes 里还含农历换算与出生地解析，与真太阳时无关。
				basis: { note, notes },
			},
			null,
			2
		);
	}

	const out: string[] = [];
	out.push(
		`【命盘总览】${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)} · 经度 ${longitude}°E`
	);
	out.push(
		`农历 ${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱 ${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]} · ${chart.wuxingJuName}`
	);
	out.push(
		`命宫 ${BRANCHES[chart.mingGongBranch]} · 身宫 ${BRANCHES[chart.shenGongBranch]} · 紫微落 ${BRANCHES[chart.ziweiPos]} · 三方四正 ${sanFangSiZheng(chart, chart.mingGongBranch).join("/")}`
	);
	out.push("");

	out.push(...birthplaceSection(lngNote, lngAmbiguous));
	out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
	out.push(...overviewSection(chart, liuNianYear));

	// ── 专题分发：给了哪个旗标就追加哪个专题（可叠加）──
	if (args.info) {
		out.push(
			"",
			...infoSection(chart, {
				clockTime: typeof args.time === "string" ? args.time : null,
				solarNote: note,
				longitude,
			})
		);
	}
	if (args.geju) out.push("", ...gejuSection(chart));
	if (args.sihua) out.push("", ...sihuaSection(chart, liuNianYear, liuYueMonth));
	if (args.liunian !== undefined) out.push("", ...liuNianSection(chart, liuNianYear));
	if (args.daxian !== undefined)
		out.push("", ...daXianSection(chart, parseAgeArg(args.daxian, chart.currentAge, "--daxian")));
	if (args.xiaoxian !== undefined)
		out.push(
			"",
			...xiaoXianSection(chart, parseAgeArg(args.xiaoxian, chart.currentAge, "--xiaoxian"), liuNianYear)
		);
	if (args.focus !== undefined) {
		// typeof 判空挡掉「给了 --focus 却没跟值」（parseArgs 存布尔 true）的形态 ——
		// focusSection 的归一表查不到 true，自然落到「聚焦失败」分支并列出可用宫名。
		const focus = typeof args.focus === "string" ? args.focus : String(args.focus);
		out.push("", ...focusSection(chart, focus, liuNianYear));
	}

	return out.join("\n");
}

/**
 * `cities` 命令：城市经纬度查询（真太阳时校正用）。
 *
 * @param args - CLI 参数表；`--search` 为关键词（也可用位置参数代替）
 * @returns 已渲染好的文本
 *
 * @remarks
 * 无关键词时列出全部省级行政区与城市及其经度；有关键词时按省名与市名各做一次包含匹配、
 * 去重后输出，并附上 `findLongitude` 的**容错解析**结果 —— 免得出现「查询有结果但 `--city`
 * 传不进去」。两者的措辞互斥：容错解析命中时不会同时报「未收录」。
 */
function cmdCities(args: CliArgs) {
	const q = String(args.search ?? args._.join(" "));
	if (!q) {
		const total = PROVINCES.reduce((n, p) => n + p.cities.length, 0);
		return [
			`已收录 ${PROVINCES.length} 个省级行政区、${total} 个城市。`,
			"用法：cities --search <城市或省份关键词>",
			"",
			...PROVINCES.map(
				p => `${p.name}：${p.cities.map(c => `${c.name}(${c.longitude})`).join(" ")}`
			),
		].join("\n");
	}
	const hits: string[] = [];
	for (const p of PROVINCES) {
		if (p.name.includes(q)) {
			for (const c of p.cities) hits.push(`${p.name} ${c.name} → 东经 ${c.longitude}°`);
		}
		for (const c of p.cities) {
			if (c.name.includes(q)) hits.push(`${p.name} ${c.name} → 东经 ${c.longitude}°`);
		}
	}
	const uniq = [...new Set(hits)];
	const resolved = findLongitude(q);
	// 结论文案与容错解析必须互斥：resolved 存在时不能报「未收录」，
	// 否则同一段输出会先否定、再自证能解析，自相矛盾。
	let head;
	if (uniq.length) head = `匹配 ${uniq.length} 条：\n` + uniq.map(h => "  " + h).join("\n");
	else if (resolved) head = `未直接命中「${q}」，但排盘时可按容错解析识别。`;
	else head = `未收录「${q}」，可用 --lng 直接指定经度。`;
	// 顺带告知排盘时的容错解析结果，避免「查询有结果但 --city 传不进去」
	if (!resolved) return head;
	return (
		head +
		`\n\n排盘容错解析：「${q}」→ ${resolved.matched}（东经 ${resolved.longitude}°）` +
		(resolved.ambiguous
			? `\n⚠️ 存在同名候选：${resolved.ambiguous.join("、")}，已取最短名，如有误请直接 --lng`
			: "")
	);
}

/**
 * `stars` 命令：星曜释义。
 *
 * @param args - CLI 参数表；`--search` 为星名
 * @returns 已渲染好的文本
 *
 * @remarks
 * 不给 `--search` 时列出全部已收录星曜的「关键词 · 星性 · 五行」；给定时只出该星一条，
 * 未收录则回列全部星名。
 */
function cmdStars(args: CliArgs) {
	const names = Object.keys(STAR_DESCRIPTIONS);
	if (args.search) {
		// 用 String() 归一，与原先 obj[args.search] 的取值结果逐字等价：
		// 对象下标本就会把 true / 数组强制转成字符串（数组转成 join(",") 的结果）。
		const q = String(args.search);
		const s = STAR_DESCRIPTIONS[q];
		if (!s) return `未收录星曜「${q}」。已收录：${names.join("、")}`;
		return `${q}：关键词 ${s.keywords} · 星性 ${s.nature} · 五行 ${s.element}`;
	}
	return [
		"已收录星曜释义：",
		...names.map(n => {
			const s = STAR_DESCRIPTIONS[n];
			return `  ${n}：${s.keywords} · ${s.nature} · ${s.element}`;
		}),
	].join("\n");
}

/**
 * `topic` 命令：主题论断 —— 十四主星 × 13 主题的**动态推算**（分析数据库 v3）。
 *
 * @param args - CLI 参数表；出生信息参数与 `analyze` 相同，另认
 *   `--topic <key>`（13 主题之一）、`--view mingpan|daxian|liunian|liuyue`（默认 mingpan）、
 *   `--liunian` / `--liuyue`（view 为流年/流月时的目标年月）
 * @returns 已渲染好的论断文本
 *
 * @remarks
 * 与静态文案库不同：`getTopicAnalysis` 基于**整张盘**动态推算 —— 主宫主星（空宫借对宫）、
 * 三方四正会照、本命四化（取 `Star.siHua`，农历年干口径，与盘面同源）、格局、以及所选
 * view 的大限/流年/流月引动，逐层拼出论断。
 *
 * 不带 `--topic` 时列出 13 个主题清单（key · 标签 · 对应宫位）。
 *
 * ⚠️ 输出末尾固定披露**知识来源分级**（verified/traditional/methodology/suspect）：
 * 库中「倪师说」引号句部分为传统口诀的风格化转述，不一定是《天纪》逐字原话 ——
 * 引用下断语时须注明口径，防止把转述当原话。
 */
function cmdTopic(args: CliArgs) {
	const { info, note } = buildBirthInfo(args);

	// 不带 --topic：列主题清单（--topic 裸开关也走这里，与「给了没值」的形态一致）
	if (args.topic === undefined || args.topic === true) {
		const rows = (Object.keys(TOPIC_LABEL) as TopicKey[]).map(
			k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k]}（看${TOPIC_PALACE_NAME[k]}）`
		);
		return [
			"13 个主题（--topic <key> 选其一）：",
			...rows,
			"",
			"view 可选：mingpan（本命，默认）/ daxian（当前大限）/ liunian（流年）/ liuyue（流月）",
			"示例：node scripts/purple-star.ts topic --date 1990-05-15 --branch 5 --gender male --topic love",
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
	// 上行已限定四值，断言只影响类型层
	const view = viewRaw as AnalysisView;

	const chart = generateChart(info);
	const liuNianYear = parseLiuNianArg(args);
	const liuYueMonth = parseLiuYueArg(args);
	const text = getTopicAnalysis(chart, topic, {
		view,
		liunianYear: liuNianYear,
		liuyueMonth: liuYueMonth ?? undefined,
	});

	return [
		`【主题论断 · ${TOPIC_LABEL[topic]}】${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)}`,
		"",
		text,
		"",
		"⚠️ 知识来源分级：以上论断出自分析数据库 v3 —— 其中「倪师说」引号句部分为传统口诀的",
		"   风格化转述，不一定是《天纪》逐字原话（verified / traditional / methodology / suspect 四级），",
		"   引用下断语时请注明口径。",
	].join("\n");
}

// ══════════════════════ 命令表 ══════════════════════

/** 命令实现的签名：返回**已渲染好的文本**，由引导层统一 `console.log`。 */
type Cmd = (args: CliArgs, ctx: CliContext) => string;

/**
 * 命令名 → 实现。
 *
 * @remarks
 * 刻意**不导出**这张裸表：导出的是下面两个视图（{@link COMMANDS} 供分发、
 * {@link COMMAND_DESC} 供渲染 HELP）。调用方拿不到「键集与描述可能对不上」的中间态。
 *
 * 用 `satisfies` 而非 `: Record<...>` 标注，是为了保住字面量键集 ——
 * `CommandName` 与 `COMMAND_DESC` 的完备性都建立在它之上（见下）。
 */
const COMMAND_TABLE = {
	analyze: cmdAnalyze,
	chart: cmdChart,
	topic: cmdTopic,
	stars: cmdStars,
	cities: cmdCities,
	selftest: (_args: CliArgs, ctx: CliContext) => cmdSelftest(ctx),
} satisfies Record<string, Cmd>;

/** 合法命令名。 */
export type CommandName = keyof typeof COMMAND_TABLE;

/**
 * 分发用的命令表：命令名 → 实现。
 *
 * @remarks
 * 值类型显式写出 `| undefined`：命令名来自 argv，查表必然未命中，
 * 这里让「未命中」在类型上就成立，而不是靠断言把 undefined 抹掉。
 *
 * 多数命令（含各 `cmdXxx`）只需要 args，签名里少的那个参数 TS 允许省略；
 * 只有 selftest 用得上 ctx（它要在输出里交代内核根是哪一份）。
 *
 * `help` 不在表内 —— 引导层单独处理，见 `purple-star.ts` 的 `main()`。
 */
export const COMMANDS: Record<string, Cmd | undefined> = COMMAND_TABLE;

/**
 * 命令名 → 一行说明，HELP 的命令段据此派生。
 *
 * @remarks
 * 类型写成 `Record<CommandName, string>` 而非 `Record<string, string>`：**新增命令忘了
 * 写说明就编译不过**。此前这段文案只活在 `purple-star.ts` 的 `HELP` 字符串里，
 * 与 `COMMANDS` 的键集靠一句「必须保持一致」的注释互相提醒 —— 参数面已经证明了那种
 * 提醒拦不住漂移：同一份 `HELP` 的参数段就整整漏掉了 `--search` / `--limit` /
 * `--topic` / `--view` 四个旗标（只在示例里露过脸）。
 */
export const COMMAND_DESC: Record<CommandName, string> = {
	analyze: "解读用完整输入包（命盘 + 十二宫一览 + 格局 + 四化 + 大限）★ 最常用",
	chart: "纯排盘十二宫",
	topic: "主题论断（13 主题动态推算：主宫 + 三方四正 + 四化会照 + 大限/流年）",
	stars: "星曜释义",
	cities: "城市经纬度查询（真太阳时校正用）",
	selftest: "回归自检（农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）",
};
