/**
 * 命令实现 —— 七个 `cmdXxx` 与命令表。
 *
 * 拆自 purple-star.ts。七个命令互不调用，故集中在一处反而好对照；
 * 只有 `selftest` 另立门户（见 ./selftest.ts 的说明）。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliArgs, CliContext } from "./args";
import { buildBirthInfo, findLongitude } from "./birth-info";
import {
	FOCUS_ALIASES,
	birthplaceSection,
	fmtDate,
	genderCN,
	lateZiSection,
	locateSihua,
	mustPalace,
	palaceAtBranch,
	palaceBrief,
	renderPalace,
	sanFangSiZheng,
} from "./render";
import { cmdSelftest } from "./selftest";
import type { Palace } from "@/ziwei/types";
import { generateChart } from "@/ziwei/algorithm";
import { detectPatterns, getMingGongSummary } from "@/ziwei/patterns";
import { getSiHuaByStem, getLiuNianSiHua, getLiuYueSiHua } from "@/ziwei/sihua";
import { STEMS, BRANCHES, STAR_DESCRIPTIONS } from "@/ziwei/constants";
import { PROVINCES } from "@/ziwei/cities";
import {
	HEMING_METHODOLOGY,
	STAR_IN_FUQI_GU,
	SIHUA_IN_FUQI_GU,
	MARRIAGE_STARS_BRIEF,
	HEMING_SCORE_CRITERIA,
} from "@/ziwei/heming-knowledge";
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/classics/index";
import { TIANJI_MODULES, RENJI_MODULES, DIJI_MODULES, NI_HAIXIA_BIO } from "@/nihai/index";

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
 * 返回字符串而不打印 —— `console.log` 由引导层统一负责（本文件七个命令皆然）。
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
 * @param args - CLI 参数表；除出生信息外还认 `--liunian` / `--liuyue` / `--focus`
 * @returns 已渲染好的文本；带 `--json` 时返回命盘 + 格局 + 三组四化的原始 JSON 字符串
 *
 * @remarks
 * 输出顺序：命盘总览 → 出生地与晚子时提示 → 十二宫一览 → 命宫 / 身宫详表 → 格局识别
 * （含成立 / 加分 / 破格条件与出处）→ 生年 / 流年 / 流月四化落宫 → 大限（当前大限详表加全部大限）
 * → `--focus` 指定宫的深挖。其中「十二宫一览」是直接遍历 `chart.palaces` 输出的，即**数组原序**
 * （不是地支升序，见 `ziwei/types.ts` 的 `palaces` 字段说明）。
 *
 * 命宫空宫时 `getMingGongSummary` 返回空关键词 / 空星性，这里改从借入的对宫主星取释义；
 * 两者都取不到时星性落成「无主星亦无对宫可借，全看三方四正会照」。
 */
function cmdAnalyze(args: CliArgs) {
	const { info, note, longitude, lateZiCandidate, isLateZi, lngNote, lngAmbiguous } =
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
	if (args.liunian === true)
		throw new Error("--liunian 需要一个年份值（如 --liunian 2027）");
	const liuNianYear =
		args.liunian !== undefined ? Number(args.liunian) : new Date().getFullYear();
	// 非数字静默传下去会得到「【NaN 流年四化】」的垃圾输出（NaN 天干 → 四空串），
	// 与 --liuyue 的校验同一纪律：宁可报错，不静默产出错盘。
	if (!Number.isInteger(liuNianYear) || liuNianYear < 1 || liuNianYear > 9999)
		throw new Error(`--liunian 应为 1-9999 的整数年份，收到：${args.liunian}`);
	const liuNian = getLiuNianSiHua(liuNianYear);
	// 流月：农历月 1-12，取流年干推五虎遁（可选）
	const liuYueMonth = args.liuyue !== undefined ? Number(args.liuyue) : null;
	if (
		liuYueMonth !== null &&
		(!Number.isInteger(liuYueMonth) || liuYueMonth < 1 || liuYueMonth > 12)
	) {
		throw new Error("--liuyue 应为农历月 1-12");
	}
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
				lateZi: { candidate: lateZiCandidate, applied: isLateZi },
			},
			null,
			2
		);
	}

	const ming = palaceAtBranch(chart, chart.mingGongBranch, "命宫");
	const shen = palaceAtBranch(chart, chart.shenGongBranch, "身宫");
	const summary = getMingGongSummary(chart);

	// 命宫空宫时 getMingGongSummary 返回空关键词/星性，改从借入的对宫主星取释义
	let mingKeywords = summary.keywords;
	let mingNature = summary.nature;
	if (!mingKeywords.length && ming.isEmpty && ming.borrowedStars?.length) {
		mingKeywords = ming.borrowedStars.flatMap(
			s => STAR_DESCRIPTIONS[s]?.keywords?.split("·") ?? []
		);
		mingNature = `空宫，借${ming.borrowedFromName ?? ""}的${ming.borrowedStars.join("、")}论`;
	}
	if (!mingKeywords.length) mingNature = mingNature || "无主星亦无对宫可借，全看三方四正会照";
	const patterns = detectPatterns(chart);
	const dx = chart.daXians[chart.currentDaXianIndex];
	const dxPalace = dx ? chart.palaces.find(p => p.branch === dx.palaceBranch) : null;

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

	// ── 十二宫一览（按地支序，速查全盘用；解读主力仍是下方命宫/身宫详表）──
	// ⚠️ 是**寅→丑**（数组原序，寅起），不是子→亥 —— `chart.palaces` 按地支数组序排，
	//    `palaceBrief` 不做任何排序。表头写错会让读者按错误顺序去数宫位。
	out.push("【十二宫一览】按地支序 寅→丑");
	for (const p of chart.palaces) out.push(palaceBrief(p));
	out.push("");

	out.push("【命宫】");
	out.push(renderPalace(ming, chart));
	out.push(`  关键词：${mingKeywords.join("、") || "—"} · 星性：${mingNature}`);
	out.push("");

	out.push("【身宫】");
	out.push(renderPalace(shen, chart));
	out.push("");

	out.push(`【格局识别】共 ${patterns.length} 个`);
	if (!patterns.length) out.push("  （未识别到已收录格局）");
	for (const p of patterns) {
		out.push(`  ▸ ${p.name} [${p.level}分]  涉及：${p.palaces.join("、")}`);
		out.push(`    ${p.description}`);
		if (p.conditions) {
			if (p.conditions.required?.length)
				out.push(`    成立：${p.conditions.required.join("；")}`);
			if (p.conditions.bonus?.length) out.push(`    加分：${p.conditions.bonus.join("；")}`);
			if (p.conditions.breaking?.length)
				out.push(`    破格：${p.conditions.breaking.join("；")}`);
		}
		if (p.source) out.push(`    出处：${p.source}`);
	}
	out.push("");

	out.push(`【生年四化】年干 ${STEMS[yearStem]}`);
	for (const x of locateSihua(chart, native)) {
		out.push(
			`  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`
		);
	}
	out.push("");

	out.push(`【${liuNianYear} 流年四化】年干 ${liuNian.stemName}`);
	for (const x of locateSihua(chart, liuNian.transforms)) {
		out.push(
			`  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`
		);
	}
	out.push("");

	if (liuYue) {
		out.push(
			`【${liuNianYear} 年 农历${liuYueMonth}月 流月四化】月干 ${liuYue.stemName}（五虎遁，由流年干 ${liuNian.stemName} 推）`
		);
		for (const x of locateSihua(chart, liuYue.transforms)) {
			out.push(
				`  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`
			);
		}
		out.push("");
	}

	out.push(
		`【大限】当前 ${chart.currentAge}岁，走 ${dx ? `${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})` : "—"}`
	);
	if (dxPalace) out.push(renderPalace(dxPalace, chart));
	out.push("");
	out.push("全部大限：");
	for (const d of chart.daXians) {
		out.push(
			`  ${String(d.startAge).padStart(2)}-${String(d.endAge).padStart(2)}岁  ${d.palaceName}(${BRANCHES[d.palaceBranch]})${d === dx ? "  ← 当前" : ""}`
		);
	}

	// 指定宫位深挖
	if (args.focus) {
		// --focus 只接受单个宫位。typeof 判空挡掉的是「给了 --focus 却没跟值」的形态 ——
		// 此时 parseArgs 把它存成布尔 true（不是字符串），不参与下面的比对，
		// 直接落到「聚焦失败」分支并列出可用宫名。
		const focus = typeof args.focus === "string" ? args.focus : null;
		// 先把输入归一化到项目口径再比：交友宫 / 交友 / 仆役 / 仆役宫 四种写法都能命中
		const want = focus ? FOCUS_ALIASES.get(focus) : undefined;
		const target = focus
			? chart.palaces.find(p => p.name === want || BRANCHES[p.branch] === focus)
			: undefined;
		if (!target) {
			out.push(
				"",
				`【聚焦失败】找不到宫位「${args.focus}」。可用：${chart.palaces.map(p => p.name).join("、")}`,
				"（也接受口语简称与旧写法，如「交友」「仆役」；或直接给地支名）"
			);
		} else {
			out.push("", `【聚焦：${target.name}】`);
			out.push(renderPalace(target, chart));
			out.push(
				`  对宫：${chart.palaces.find(p => p.branch === (target.branch + 6) % 12)?.name}`
			);
		}
	}

	return out.join("\n");
}

/**
 * `heming` 命令：合盘（双宫联参 + 夫妻宫断语 + 方法论）。
 *
 * @param args - CLI 参数表；甲乙两方各一套出生信息参数，分别带 `a-` / `b-` 前缀
 * @returns 已渲染好的文本；带 `--json` 时返回两方命盘摘要 + 方法论 + 评分标准的原始 JSON 字符串
 *
 * @remarks
 * 遵循倪海夏的双宫联参口径：看婚姻不能只看夫妻宫，必须同时看福德宫。输出两方命宫 / 夫妻宫 /
 * 福德宫主星、天作之合对应关系判定、夫妻宫断语（空宫借对宫主星论）、生年四化入夫妻宫、
 * 夫妻宫桃花孤克星，最后附评分标准与完整方法论。
 *
 * ⚠️ 任一方校正后的出生时刻落在 23:00–23:59 时单独提示：本次按**当日早子时**口径排，
 * 若改用 `--a-late-zi` / `--b-late-zi`（晚子时算次日），该方命盘会整体改变，合盘结论需重跑。
 */
function cmdHeming(args: CliArgs) {
	const a = buildBirthInfo(args, "a-");
	const b = buildBirthInfo(args, "b-");
	const ca = generateChart(a.info);
	const cb = generateChart(b.info);

	const mingA = palaceAtBranch(ca, ca.mingGongBranch, "甲方命宫");
	const mingB = palaceAtBranch(cb, cb.mingGongBranch, "乙方命宫");
	const fuqiA = mustPalace(ca, "夫妻宫");
	const fuqiB = mustPalace(cb, "夫妻宫");
	const fudeA = mustPalace(ca, "福德宫");
	const fudeB = mustPalace(cb, "福德宫");

	const majors = (p: Palace): string[] =>
		p.stars.filter(s => s.type === "major").map(s => s.name);
	const mA = majors(mingA),
		mB = majors(mingB);
	const fA = majors(fuqiA),
		fB = majors(fuqiB);

	if (args.json) {
		return JSON.stringify(
			{
				a: { chart: ca, mingGong: mA, fuQiGong: fA, fuDeGong: majors(fudeA) },
				b: { chart: cb, mingGong: mB, fuQiGong: fB, fuDeGong: majors(fudeB) },
				methodology: HEMING_METHODOLOGY,
				scoreCriteria: HEMING_SCORE_CRITERIA,
			},
			null,
			2
		);
	}

	const out: string[] = [];
	out.push("【合盘 · 双宫联参】倪海夏：看婚姻不能只看夫妻宫，必须同时看福德宫");
	out.push("");
	out.push(
		`甲方 ${a.info.name ?? ""} ${fmtDate(a.info)} ${a.note} · ${genderCN(a.info.gender)} · ${ca.wuxingJuName}`
	);
	out.push(`  命宫 ${BRANCHES[ca.mingGongBranch]}：${mA.join("、") || "（空宫借对宫）"}`);
	out.push(`  夫妻宫 ${BRANCHES[fuqiA.branch]}：${fA.join("、") || "（空宫借对宫）"}`);
	out.push(`  福德宫 ${BRANCHES[fudeA.branch]}：${majors(fudeA).join("、") || "（空宫借对宫）"}`);
	out.push("");
	out.push(
		`乙方 ${b.info.name ?? ""} ${fmtDate(b.info)} ${b.note} · ${genderCN(b.info.gender)} · ${cb.wuxingJuName}`
	);
	out.push(`  命宫 ${BRANCHES[cb.mingGongBranch]}：${mB.join("、") || "（空宫借对宫）"}`);
	out.push(`  夫妻宫 ${BRANCHES[fuqiB.branch]}：${fB.join("、") || "（空宫借对宫）"}`);
	out.push(`  福德宫 ${BRANCHES[fudeB.branch]}：${majors(fudeB).join("、") || "（空宫借对宫）"}`);
	out.push("");

	// 晚子时提醒（任一方命中都要提示，否则合盘基准可能是错的）
	for (const [label, side] of [
		["甲", a],
		["乙", b],
	] as const) {
		if (side.lateZiCandidate && !side.isLateZi) {
			out.push(`⚠️ ${label}方出生时间落在 23:00–23:59（晚子时），本次按当日早子时口径排盘。`);
			out.push(
				`   若改用 --${label === "甲" ? "a" : "b"}-late-zi（晚子时算次日），该方命盘会整体改变，合盘结论需重跑。`
			);
		}
	}
	out.push("");

	// 天作之合判定（HEMING_METHODOLOGY 二）
	out.push("【对应关系判定】");
	const crossA = fA.some(s => mB.includes(s));
	const crossB = fB.some(s => mA.includes(s));
	const both = crossA && crossB;
	out.push(
		`  甲方夫妻宫主星 ∩ 乙方命宫主星：${fA.filter(s => mB.includes(s)).join("、") || "无"}`
	);
	out.push(
		`  乙方夫妻宫主星 ∩ 甲方命宫主星：${fB.filter(s => mA.includes(s)).join("、") || "无"}`
	);
	out.push(
		`  → ${both ? "双向对应，符合「天作之合」最高级匹配" : crossA || crossB ? "单向对应，属「次级良配」" : "无主星对应，需结合四化与福德宫另判"}`
	);
	out.push("");

	// 夫妻宫断语（STAR_IN_FUQI_GU 为五字段对象；空宫借对宫主星论）
	out.push("【夫妻宫断语】");
	for (const [label, fuqi] of [
		["甲", fuqiA],
		["乙", fuqiB],
	] as const) {
		const stars = majors(fuqi);
		const borrowed = stars.length ? stars : (fuqi.borrowedStars ?? []);
		if (!borrowed.length) {
			out.push(`  ${label}方夫妻宫空宫且对宫亦无主星 —— 婚姻之事全看四化与大限引动`);
			continue;
		}
		if (!stars.length)
			out.push(`  ${label}方夫妻宫空宫，借对宫 ${fuqi.borrowedFromName ?? ""} 主星论：`);
		for (const s of borrowed) {
			const e = STAR_IN_FUQI_GU[s];
			if (!e) {
				out.push(`    ${s}：（无收录断语）`);
				continue;
			}
			out.push(`    ${s}：${e.summary}`);
			out.push(`      吉象：${e.good}`);
			out.push(`      凶象：${e.bad}`);
			out.push(`      配偶特质：${e.spouse_traits}`);
			out.push(`      婚期：${e.timing}`);
			if (e.ni_quote) out.push(`      倪师原话：「${e.ni_quote}」`);
		}
	}
	out.push("");

	// 四化入夫妻宫：SIHUA_IN_FUQI_GU 的键是「化禄/化权/化科/化忌」，需先定位生年四化落宫
	out.push("【生年四化入夫妻宫】");
	let sihuaHit = 0;
	for (const [label, chart, fuqi] of [
		["甲", ca, fuqiA],
		["乙", cb, fuqiB],
	] as const) {
		// 生年四化取农历年干（与盘面 Star.siHua 的 mutagen 同源），不用公历取模 —— 理由见 cmdAnalyze
		const stem = chart.lunarInfo.yearStem;
		for (const x of locateSihua(chart, getSiHuaByStem(stem))) {
			if (x.palace !== fuqi.name) continue;
			sihuaHit++;
			out.push(`  ${label}方 生年${STEMS[stem]}干 化${x.hua}（${x.star}）入夫妻宫：`);
			out.push(`    ${SIHUA_IN_FUQI_GU[`化${x.hua}`] ?? ""}`);
		}
	}
	if (!sihuaHit)
		out.push("  双方夫妻宫均无生年四化落入 —— 婚姻非先天格局的着力点，随大限流年引动。");
	out.push("");

	// 夫妻宫桃花 / 孤克星
	out.push("【夫妻宫桃花·孤克星】");
	let marriageHit = 0;
	for (const [label, fuqi] of [
		["甲", fuqiA],
		["乙", fuqiB],
	] as const) {
		for (const s of fuqi.stars) {
			if (MARRIAGE_STARS_BRIEF[s.name]) {
				marriageHit++;
				out.push(`  ${label}方 ${s.name}：${MARRIAGE_STARS_BRIEF[s.name]}`);
			}
		}
	}
	if (!marriageHit) out.push("  双方夫妻宫无收录的桃花/孤克星。");
	out.push("");
	out.push("【评分标准】");
	out.push(
		typeof HEMING_SCORE_CRITERIA === "string"
			? HEMING_SCORE_CRITERIA
			: JSON.stringify(HEMING_SCORE_CRITERIA, null, 2)
	);
	out.push("");
	out.push("【完整方法论】");
	out.push(HEMING_METHODOLOGY);

	return out.join("\n");
}

/**
 * `classics` 命令：古籍原文检索。
 *
 * @param args - CLI 参数表；`--search` 为关键词（也可用位置参数代替），`--limit` 为条数上限（默认 15）
 * @returns 已渲染好的文本
 *
 * @remarks
 * 无关键词时列出已收录的书目与总段数；有关键词时逐条输出「书名 · 章节」与摘要。
 *
 * 摘要里的 `<mark>` 高亮标签会换成 `『』`，并把 `『词『` 这类未闭合的嵌套收尾成一个 `』`。
 */
function cmdClassics(args: CliArgs) {
	if (!args.search && !args._.length) {
		return [
			`已收录古籍 ${ALL_BOOKS.length} 部，共 ${TOTAL_PARAGRAPHS} 段：`,
			...ALL_BOOKS.map(
				b => `  ▸ ${b.title ?? b.slug}（${b.slug}）${b.chapters?.length ?? 0} 章`
			),
			"",
			"用法：classics --search <关键词>",
		].join("\n");
	}
	const q = String(args.search ?? args._.join(" "));
	const hits = searchClassics(q, Number(args.limit ?? 15));
	if (!hits.length) return `古籍中未找到「${q}」。`;
	const out = [`古籍检索「${q}」命中 ${hits.length} 条：`, ""];
	for (const h of hits) {
		const plain = String(h.snippet ?? "")
			.replace(/<\/?mark>/g, "『")
			.replace(/『([^』]*)『/g, "『$1』");
		out.push(`  ▸ [${h.bookTitle ?? h.bookSlug ?? ""} · ${h.chapterTitle ?? ""}]`);
		out.push(`    ${plain.replace(/\n/g, " ")}`);
	}
	return out.join("\n");
}

/**
 * `nihai` 命令：倪海厦天纪 / 地纪 / 人纪知识。
 *
 * @param args - CLI 参数表；`--category` 限 `tianji` / `diji` / `renji`（大小写不敏感），
 *   `--bio` 改出倪师生平
 * @returns 已渲染好的文本；带 `--bio` 时返回生平 JSON 字符串
 *
 * @remarks
 * 不传 `--category` 时三纪全列。逐模块输出中文名（英文名）与状态、副标题、简介、关键词，
 * 再逐章输出标题、描述、要点与原文引用。
 */
function cmdNihai(args: CliArgs) {
	const cat = String(args.category ?? "").toLowerCase();
	if (args.bio) {
		return JSON.stringify(NI_HAIXIA_BIO, null, 2);
	}
	const groups = [
		["tianji", "天纪 —— 上知天文（紫微斗数、易经、堪舆、推命、面相、测字）", TIANJI_MODULES],
		["diji", "地纪 —— 下知地理（国家地理志、风水与国运）", DIJI_MODULES],
		[
			"renji",
			"人纪 —— 中知人事（针灸、黄帝内经、神农本草经、伤寒论、金匮要略）",
			RENJI_MODULES,
		],
	] as const;
	const out: string[] = [];
	for (const [key, title, mods] of groups) {
		if (cat && cat !== key) continue;
		out.push(`【${title}】共 ${mods.length} 个模块`, "");
		for (const m of mods) {
			out.push(`  ▸ ${m.name}（${m.nameEn}）[${m.status}]`);
			out.push(`    ${m.subtitle}`);
			out.push(`    ${m.description}`);
			if (m.keywords?.length) out.push(`    关键词：${m.keywords.join("、")}`);
			for (const ch of m.chapters ?? []) {
				out.push(`      · ${ch.title}${ch.subtitle ? "｜" + ch.subtitle : ""}`);
				out.push(`        ${ch.description}`);
				if (ch.keyPoints?.length) out.push(`        要点：${ch.keyPoints.join("；")}`);
				for (const q of ch.quotes ?? []) out.push(`        原文：「${q}」`);
			}
			out.push("");
		}
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

// ══════════════════════ 命令表 ══════════════════════

/**
 * 命令表：命令名 → 实现（返回**已渲染好的文本**，由引导层 `console.log`）。
 *
 * @remarks
 * 值类型显式写出 `| undefined`：命令名来自 argv，查表必然未命中，
 * 这里让「未命中」在类型上就成立，而不是靠断言把 undefined 抹掉。
 *
 * 多数命令（含七个 `cmdXxx`）只需要 args，签名里少的那个参数 TS 允许省略；
 * 只有 selftest 用得上 ctx（它要在输出里交代内核根是哪一份）。
 *
 * `help` 不在表内 —— 引导层单独处理，见 `purple-star.ts` 的 `main()`。
 */
export const COMMANDS: Record<
	string,
	((args: CliArgs, ctx: CliContext) => string) | undefined
> = {
	analyze: cmdAnalyze,
	chart: cmdChart,
	heming: cmdHeming,
	classics: cmdClassics,
	nihai: cmdNihai,
	stars: cmdStars,
	cities: cmdCities,
	selftest: (_args, ctx) => cmdSelftest(ctx),
};
