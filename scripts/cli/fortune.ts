/**
 * 运限专题模块 —— 流年 / 大限 / 小限 / 基本信息 / 格局 / 四化各专题的定位与渲染。
 *
 * 拆自 commands.ts 的 cmdAnalyze（2026-09-28 专题旗标族改造）。存在的理由与 selftest.ts
 * 相同：它被 commands.ts 与 selftest.ts **两方**调用，而 selftest 被 commands 静态引着，
 * 专题渲染若留在 cmdAnalyze 里，selftest 就测不到它（静态环）—— 独立成本层叶子即无环。
 *
 * 口径基准（三合派，倪师《天纪》）：运限分析 = **宫位移动 + 三方四正 + 生年/流年四化**。
 * 不做宫干四化、不做自化 —— 那是飞星派，见 `.claude/CLAUDE.md` 的「体系硬约束」。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核
 *    与同层模块（`./render`）。
 */

import type { Palace, ZiweiChart, Mutagen } from "@/ziwei/types";
import { STEMS, BRANCHES } from "@/ziwei/constants";
import {
	getYearlyMutagen,
	getMonthlyMutagen,
	getMutagenByStem,
	getYearStemIndex,
} from "@/ziwei/mutagen";
import { surroundBranches, oppositeBranch } from "@/ziwei/palace-relations";
import { detectPatterns } from "@/ziwei/patterns";
import { FOCUS_ALIASES, locateSihua, renderPalace, starLine, surroundNames } from "./render";
import { Solar } from "lunar-typescript";

// ══════════════════════ 运限定位（纯函数）══════════════════════

/**
 * 公历年 → 流年地支索引。
 *
 * @param year - 公历年（用户问「2026 年运势」即指该公历年对应的干支年）
 * @returns 地支索引 0–11
 *
 * @remarks
 * 与 `ziwei/mutagen.ts` 的 `getYearStemIndex` 同一口径（`(year - 4) % 12`）。
 * 流年命宫就是**年支所在的那个宫**（三合派：不重排十二宫，以年支宫为流年命宫论三方四正）。
 */
export function yearlyBranchOf(year: number): number {
	return ((year - 4) % 12 + 12) % 12;
}

/**
 * 虚岁 → 该岁小限所在宫。
 *
 * @param chart - 命盘
 * @param age - 虚岁（1–120）
 * @returns 小限落宫
 * @throws 当该虚岁不落在任何宫的小限岁数表内时（如 0 / 121 —— 多半是参数敲错，
 *   静默兜底会把「小限」指到一个不相干的宫）
 *
 * @remarks
 * 数据取自 iztro 的 `palace.ages`（`algorithm.ts` 提取为 `Palace.ages`），
 * 十二宫并集连续覆盖 1–120，故正常输入必命中。
 */
export function agePalaceOf(chart: ZiweiChart, age: number): Palace {
	const p = chart.palaces.find(x => x.ages?.includes(age));
	if (!p)
		throw new Error(
			`虚岁 ${age} 不落在任何宫的小限岁数表内（有效域 1–120）—— 多半是参数敲错，不静默兜底`
		);
	return p;
}

/**
 * 解析 `--daxian` / `--xiaoxian` 的可选值形态 `[虚岁]`。
 *
 * @param raw - CliArgs 里的原始值：字符串（带值）、`true`（裸开关）、`undefined`（未给）；
 *   类型上还含 `string[]`（CliArgs 索引签名的宽域，归一层实际已把重复值并成末值）
 * @param currentAge - 当前虚岁（裸开关与缺省都取它）
 * @param flagName - 旗标名，只用于错误文案
 * @returns 有效的虚岁
 * @throws 非整数、超出 1–120 时
 *
 * @remarks
 * 与 `parseLiuNianArg` 同一条纪律：非数字静默传下去会产出错盘，宁可报错。
 * 裸开关（`true`）不报错 —— 它的语义就是「看当前」。
 */
export function parseAgesArg(
	raw: string | boolean | string[] | undefined,
	currentAge: number,
	flagName: string
): number {
	if (raw === undefined || raw === true) return currentAge;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1 || n > 120)
		throw new Error(`${flagName} 应为 1-120 的整数虚岁，收到：${raw}`);
	return n;
}

// ══════════════════════ 农历中文数字 ══════════════════════

/**
 * 农历月 → 中文月名。
 *
 * @param m - 农历月 1–12
 * @returns 正月 / 二月 / … / 十月 / **冬月** / **腊月**（十一月、十二月的传统叫法）
 */
function lunarMonthCN(m: number): string {
	return ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"][
		m - 1
	] ?? `${m}月`;
}

/**
 * 农历日 → 中文日名（初一 / 初十 / 十五 / 二十 / 廿一 / 三十）。
 *
 * @param d - 农历日 1–30
 *
 * @remarks
 * 传统口径：十以前「初X」，十一至十九「X十X」省作「十一…十九」，二十一至二十九用「廿」。
 */
function lunarDayCN(d: number): string {
	const ones = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
	if (d <= 10) return `初${ones[d - 1]}`;
	if (d < 20) return `十${ones[d - 11]}`;
	if (d === 20) return "二十";
	if (d < 30) return `廿${ones[d - 21]}`;
	return "三十";
}

// ══════════════════════ 概览节（默认输出的运限速览）══════════════════════

/**
 * 概览节：一行运限速览 + 一行专题指路 —— 精简默认输出的全部内容（总览节除外）。
 *
 * @param chart - 命盘
 * @param liuNianYear - 流年公历年（默认输出取当前年；给了 `--liunian` 时取它）
 * @returns 两行文本
 *
 * @remarks
 * 速览行同时给出四个运限坐标（虚岁 / 大限 / 流年命宫 / 小限宫），让「一眼定位」
 * 与「该往哪个专题旗标深入」在一次默认输出里就能完成。
 */
export function overviewSection(chart: ZiweiChart, liuNianYear: number): string[] {
	const dx = chart.decadals[chart.currentDecadalIndex];
	const lnBranch = yearlyBranchOf(liuNianYear);
	const lnPalace = chart.palaces.find(p => p.branch === lnBranch);
	const xx = agePalaceOf(chart, chart.currentAge);
	const ganZhi = `${STEMS[getYearStemIndex(liuNianYear)]}${BRANCHES[lnBranch]}`;
	return [
		`【运限速览】虚岁 ${chart.currentAge} · 大限 ${
			dx ? `${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})` : "童限未起运"
		} · 流年 ${liuNianYear} ${ganZhi} 流年命宫${BRANCHES[lnBranch]}·${lnPalace?.name ?? "?"} · 小限${BRANCHES[xx.branch]}·${xx.name}`,
		"【专题深入】--pattern 格局 · --mutagen 四化 · --decadal [虚岁] 大限 · --ages [虚岁] 小限 · --yearly [年] 流年 · --focus <宫> 宫盘深化 · --palaces 十二宫详表 · --topic <key> 主题论断",
	];
}

// ══════════════════════ 基本信息专题（--info）══════════════════════

/**
 * `--info` 基本信息专题的输入：出生时刻的**展示串**（由调用方从 `buildBirthInfo` 结果拼，
 * 本模块不重新解析钟表时 —— 那是 `birth-info.ts` 的职责）。
 */
export interface InfoClockOpts {
	/** 钟表时间原文（如 `"2000-4-6 0:15"`）；`--branch` 直按时辰排盘时为 null */
	clockTime: string | null;
	/** 真太阳时说明（`buildBirthInfo` 的 note：钟表 → 校正量 → 时辰链条） */
	solarNote: string;
	/** 本次实际采用的经度（东经为正；未给出生地时为 120） */
	longitude: number;
}

/**
 * `--info`：基本信息专题 —— 性别 / 经度 / 钟表与真太阳时 / 农历 / 节气与非节气四柱 /
 * 五行局 / 命盘类型 / 命主身主斗君身宫。
 *
 * @param chart - 命盘
 * @param opts - 出生时刻展示串
 *
 * @remarks
 * 四柱由 `lunar-typescript` 现算（节气口径 = `getEightChar()`，立春分年、节气分月；
 * 非节气口径 = 正月初一分年 + 农历月柱）。⚠️ 四柱**仅为出生时刻记录**，本技能
 * 不做八字论命 —— SKILL.md 的红线拦的是八字解读，不拦出生数据展示。
 */
export function infoSection(chart: ZiweiChart, opts: InfoClockOpts): string[] {
	const li = chart.lunarInfo;
	const bi = chart.birthInfo;
	const lunar = Solar.fromYmd(bi.year, bi.month, bi.day).getLunar();
	const bazi = lunar.getEightChar();
	const jieQi = `${bazi.getYear()} ${bazi.getMonth()} ${bazi.getDay()} ${bazi.getTime()}`;
	const feiJieQi = `${lunar.getYearInGanZhi()} ${lunar.getMonthInGanZhi()} ${bazi.getDay()} ${bazi.getTime()}`;
	const nongLi = `${STEMS[li.yearStem]}${BRANCHES[li.yearBranch]}年${lunarMonthCN(li.lunarMonth)}${lunarDayCN(li.lunarDay)}日${BRANCHES[bi.timeIndex % 12]}时`;
	// 两口径相同时并列两行是噪音（并列相同值会被读者当成 bug 疑点）；只有分叉
	// （立春与正月初一之间出生，年/月柱走不同分界）才值得并列对照。
	const pillars =
		jieQi === feiJieQi
			? [`四柱(节气与非节气同) : ${jieQi}`]
			: [`节气四柱 : ${jieQi}`, `非节气四柱 : ${feiJieQi}`];
	return [
		"【基本信息】",
		`性别 : ${bi.gender === "male" ? "男" : "女"}`,
		`地理经度 : ${opts.longitude.toFixed(3)}`,
		`钟表时间 : ${opts.clockTime ?? "未给（按 --branch 时辰排盘）"}`,
		`真太阳时 : ${opts.solarNote}`,
		`农历时间 : ${nongLi}`,
		...pillars,
		`五行局数 : ${chart.fiveElementsClassName}`,
		"命盘类型 : 三合盘(天盘)",
		`身主:${chart.shenZhu}; 命主:${chart.mingZhu}; 子年斗君:${BRANCHES[chart.douJunBranch]}; 身宫:${BRANCHES[chart.bodyBranch]}`,
		"（注：四柱仅为出生时刻记录，本技能不做八字论命。）",
	];
}

// ══════════════════════ 专题共用的内部 helper ══════════════════════

/**
 * 一个地支集合内的**会照主星**汇总（跨宫并集，按盘面出现顺序）。
 *
 * @param chart - 命盘
 * @param branches - 地支索引集合（通常是三方四正四支）
 */
function huiZhaoMajors(chart: ZiweiChart, branches: number[]): string[] {
	const seen: string[] = [];
	for (const b of branches) {
		const p = chart.palaces.find(x => x.branch === b);
		if (!p) continue;
		for (const s of p.stars.filter(x => x.type === "major")) {
			if (!seen.includes(s.name)) seen.push(s.name);
		}
	}
	return seen;
}

/**
 * 四化落宫行：`化{化} {星} → {宫}(支)`。
 *
 * @param sanFang - 给定时，落在其中的行追加 {@link mark} 后缀（★ 类标记）
 * @param mark - 三方命中的标记文案（流年节是「★ 入流年三方四正」，大限节是短「★」）
 *
 * @remarks
 * 收拢原先散在 5 个专题节里的同构循环（生年 / 流年 / 流月 / 流年深入 / 大限深入）——
 * 各节差异只有「要不要三方标记、标记文案」，一个参数表达；「（未上盘）」兜底与支号
 * 括号的拼接规则也只活在一处。
 */
function sihuaLines(
	chart: ZiweiChart,
	transforms: Record<Mutagen, string>,
	sanFang?: number[],
	mark = " ★"
): string[] {
	return locateSihua(chart, transforms).map(x => {
		const base = `  化${x.hua} ${x.star} → ${x.palace ?? "（未上盘）"}${x.branch ? `(${x.branch})` : ""}`;
		if (!sanFang) return base;
		const palace = chart.palaces.find(p => x.palace !== null && p.name === x.palace);
		const hit = palace ? sanFang.includes(palace.branch) : false;
		return base + (hit ? mark : "");
	});
}

/**
 * 「会照主星：…」行（{@link huiZhaoMajors} 的并集；空时给兜底文案）—— 三个专题节同款。
 */
function huiZhaoLine(chart: ZiweiChart, sanFang: number[]): string {
	return `  会照主星：${huiZhaoMajors(chart, sanFang).join("、") || "（无主星会照）"}`;
}

/**
 * 生年四化（农历年干口径，与盘面 mutagen 同源）。
 *
 * @remarks 与 cmdAnalyze 的既有口径一致：取 `chart.lunarInfo.yearStem`，不可用公历取模。
 */
function nativeSiHuaOf(chart: ZiweiChart) {
	return getMutagenByStem(chart.lunarInfo.yearStem);
}

/**
 * 生年×流年的**同星引动**：同一颗星同时被两套四化点到（不论何化）。
 *
 * @returns 每条含星名、生年化、流年化与落宫地支
 *
 * @remarks
 * 三合派传统论「叠」的可靠形态之一（双忌 / 忌逢禄引动等）的**事实陈述**，
 * 具体吉凶交给解读层 —— 这里只报「谁被双引动、落哪」。
 */
function sameStarPairs(
	chart: ZiweiChart,
	native: Record<string, string>,
	liuNian: Record<string, string>
) {
	const out: { star: string; nativeHua: string; liuNianHua: string; branch: number | null }[] = [];
	for (const hua of ["禄", "权", "科", "忌"] as const) {
		for (const hua2 of ["禄", "权", "科", "忌"] as const) {
			if (native[hua] === liuNian[hua2] && !out.some(o => o.star === native[hua])) {
				const palace = chart.palaces.find(p =>
					p.stars.some(s => s.name === native[hua])
				);
				out.push({
					star: native[hua],
					nativeHua: hua,
					liuNianHua: hua2,
					branch: palace ? palace.branch : null,
				});
			}
		}
	}
	return out;
}

// ══════════════════════ 格局专题（--geju）══════════════════════

/**
 * `--geju`：格局识别专题 —— 与原 analyze 的格局节同源（detectPatterns 全量输出）。
 *
 * @param chart - 命盘
 */
export function patternSection(chart: ZiweiChart): string[] {
	const patterns = detectPatterns(chart);
	const out = [`【格局识别】共 ${patterns.length} 个`];
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
	return out;
}

// ══════════════════════ 四化专题（--sihua）══════════════════════

/**
 * `--sihua`：四化专题 —— 生年 / 流年（/ 流月）四化落宫 + 同星引动。
 *
 * @param chart - 命盘
 * @param liuNianYear - 流年公历年
 * @param liuYueMonth - 农历月 1–12；`null` 表示不算流月
 */
export function mutagenSection(
	chart: ZiweiChart,
	liuNianYear: number,
	liuYueMonth: number | null
): string[] {
	const native = nativeSiHuaOf(chart);
	const liuNian = getYearlyMutagen(liuNianYear);

	const out = [`【生年四化】年干 ${STEMS[chart.lunarInfo.yearStem]}`];
	out.push(...sihuaLines(chart, native));
	out.push("");
	out.push(`【${liuNianYear} 流年四化】年干 ${liuNian.stemName}`);
	out.push(...sihuaLines(chart, liuNian.transforms));
	if (liuYueMonth !== null) {
		const liuYue = getMonthlyMutagen(liuNian.stemIndex, liuYueMonth);
		out.push("");
		out.push(
			`【${liuNianYear} 年 农历${liuYueMonth}月 流月四化】月干 ${liuYue.stemName}（五虎遁，由流年干 ${liuNian.stemName} 推）`
		);
		out.push(...sihuaLines(chart, liuYue.transforms));
	}
	const pairs = sameStarPairs(chart, native, liuNian.transforms);
	if (pairs.length) {
		out.push("");
		out.push("【生年 × 流年 同星引动】");
		for (const p of pairs) {
			out.push(
				`  ${p.star}：生年化${p.nativeHua} × 流年化${p.liuNianHua} —— 同星双引动` +
					(p.branch !== null ? `（同落${BRANCHES[p.branch]}宫）` : "（未上盘）")
			);
		}
	}
	return out;
}

// ══════════════════════ 流年专题（--liunian）══════════════════════

/**
 * `--liunian [年]`：流年专题 —— 流年命宫（年支宫）→ 流年三方四正会照 →
 * 流年四化落点（标 ★ 于入流年三方者）→ 与当前大限三方的关系 → 生年×流年同星引动。
 *
 * @param chart - 命盘
 * @param year - 流年公历年
 *
 * @remarks
 * 三合派口径：流年命宫就是**年支所在宫**，不重排十二宫；四化取流年干（年干）与生年干，
 * **不取宫干**（飞星派工具已下线）。
 */
export function yearlySection(chart: ZiweiChart, year: number): string[] {
	const lnBranch = yearlyBranchOf(year);
	const lnPalace = chart.palaces.find(p => p.branch === lnBranch);
	if (!lnPalace) throw new Error(`流年命宫（${BRANCHES[lnBranch]}）不在十二宫内 —— 内核输出已损坏`);
	const sanFang = surroundBranches(lnBranch);
	const liuNian = getYearlyMutagen(year);
	// 流年虚岁：流年农历年 − 出生农历年 + 1（与 currentAge 同域同口径）
	const lnAge = year - chart.lunarInfo.lunarYear + 1;
	const dx = chart.decadals[chart.currentDecadalIndex];

	const out = [
		`【${year} 流年】年柱 ${STEMS[getYearStemIndex(year)]}${BRANCHES[lnBranch]} · 该年虚岁 ${lnAge}`,
		`流年命宫：${lnPalace.name}(${BRANCHES[lnBranch]}) —— 年支所在宫`,
		renderPalace(lnPalace, chart),
		`流年三方四正：${surroundNames(chart, lnBranch).join(" / ")}`,
		huiZhaoLine(chart, sanFang),
		"",
		`流年四化（年干 ${liuNian.stemName}）：`,
	];
	out.push(...sihuaLines(chart, liuNian.transforms, sanFang, " ★ 入流年三方四正"));	if (dx) {
		const dxSanFang = surroundBranches(dx.palaceBranch);
		const entered = dxSanFang.includes(lnBranch);
		out.push("");
		out.push(
			`与当前大限（${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})）：` +
				(entered
					? `流年命宫**入**大限三方四正（${surroundNames(chart, dx.palaceBranch).join("/")}）—— 限运引动流年`
					: `流年命宫**不入**大限三方四正（${surroundNames(chart, dx.palaceBranch).join("/")}）—— 流年独立于限运看`)
		);
	}
	const pairs = sameStarPairs(chart, nativeSiHuaOf(chart), liuNian.transforms);
	if (pairs.length) {
		out.push("生年 × 流年同星引动：");
		for (const p of pairs) {
			out.push(
				`  ${p.star}（生年化${p.nativeHua} × 流年化${p.liuNianHua}）` +
					(p.branch !== null ? `同落${BRANCHES[p.branch]}宫` : "")
			);
		}
	}
	return out;
}

// ══════════════════════ 大限专题（--daxian）══════════════════════

/**
 * `--daxian [虚岁]`：大限（十年大运）专题 —— 十二年运时间轴 → 指定岁所在限深入
 * （限宫 + 限之三方四正 + 生年四化落点）→ 限内十年逐年对照（流年命宫 / 小限宫）。
 *
 * @param chart - 命盘
 * @param age - 深查的虚岁；`--daxian` 缺省时传当前虚岁
 *
 * @remarks
 * 三合派口径：大限只看**宫位移动**，四化永远取生年干（不取大限宫干）；
 * 大限的三方四正即大限宫地支的三合 + 对宫（限之财官迁移）。
 */
export function decadalSection(chart: ZiweiChart, age: number): string[] {
	const dxIndex = chart.decadals.findIndex(d => age >= d.startAge && age <= d.endAge);
	const dx = chart.decadals[dxIndex];

	const out = [`【大限 · 十年大运】命主虚岁 ${chart.currentAge}`];
	out.push("十年大运时间轴：");
	for (const d of chart.decadals) {
		const p = chart.palaces.find(x => x.branch === d.palaceBranch);
		const majors = p ? p.stars.filter(s => s.type === "major").map(s => s.name).join("、") : "";
		const cur = d === dx;
		out.push(
			`  ${String(d.startAge).padStart(3)}-${String(d.endAge).padStart(3)}岁  ${d.palaceName}(${BRANCHES[d.palaceBranch]})` +
				(majors ? `  ${majors}` : "  （空宫）") +
				(cur ? "  ← 本次深查" : "")
		);
	}
	if (!dx) {
		out.push(`虚岁 ${age} 未起运（童限）—— 按命宫论，不套大限。`);
		return out;
	}

	const dxPalace = chart.palaces.find(p => p.branch === dx.palaceBranch);
	out.push("");
	out.push(`深查大限：${age} 岁 → ${dx.startAge}-${dx.endAge}岁 ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})`);
	if (dxPalace) out.push(renderPalace(dxPalace, chart));
	const sanFang = surroundBranches(dx.palaceBranch);
	out.push(`大限三方四正（限之财官迁移）：${surroundNames(chart, dx.palaceBranch).join(" / ")}`);
	out.push(huiZhaoLine(chart, sanFang));

	out.push("");
	out.push("生年四化落点（★ = 落大限三方四正）：");
	const native = nativeSiHuaOf(chart);
	out.push(...sihuaLines(chart, native, sanFang));

	out.push("");
	out.push("限内十年逐年（流年命宫 = 年支宫；小限宫见岁数表）：");
	for (let a = dx.startAge; a <= dx.endAge; a++) {
		const y = chart.lunarInfo.lunarYear + a - 1;
		const b = yearlyBranchOf(y);
		const lp = chart.palaces.find(p => p.branch === b);
		const xp = agePalaceOf(chart, a);
		out.push(
			`  ${String(a).padStart(3)}岁  ${y} ${STEMS[getYearStemIndex(y)]}${BRANCHES[b]}` +
				`  流年命宫${lp ? `${lp.name}` : "?"}  小限${xp.name}(${BRANCHES[xp.branch]})`
		);
	}
	return out;
}

// ══════════════════════ 小限专题（--xiaoxian）══════════════════════

/**
 * `--xiaoxian [虚岁]`：小限专题 —— 指定岁的小限宫与三方四正 → 十二宫小限岁数分布
 * → 小限宫与流年命宫的对照。
 *
 * @param chart - 命盘
 * @param age - 小限虚岁；缺省时传当前虚岁
 * @param liuNianYear - 流年公历年（对照行用；缺省当前年由调用方给）
 */
export function ageSection(chart: ZiweiChart, age: number, liuNianYear: number): string[] {
	const xp = agePalaceOf(chart, age);
	const sanFang = surroundBranches(xp.branch);
	const lnBranch = yearlyBranchOf(liuNianYear);

	const out = [`【小限】虚岁 ${age} 的小限：${xp.name}(${BRANCHES[xp.branch]})`];
	out.push(renderPalace(xp, chart));
	out.push(`小限三方四正：${surroundNames(chart, xp.branch).join(" / ")}`);
	out.push(huiZhaoLine(chart, sanFang));

	out.push("");
	const relation =
		xp.branch === lnBranch
			? `小限宫与 ${liuNianYear} 流年命宫**同宫**（${BRANCHES[lnBranch]}）—— 限年并临，引动力最强`
			: oppositeBranch(xp.branch) === lnBranch
				? `小限宫与 ${liuNianYear} 流年命宫**互为对宫**（${BRANCHES[xp.branch]}↔${BRANCHES[lnBranch]}）—— 对冲引动`
				: `小限宫（${BRANCHES[xp.branch]}）与 ${liuNianYear} 流年命宫（${BRANCHES[lnBranch]}）无直接会照 —— 各自论`;
	out.push(relation);

	out.push("");
	out.push("十二宫小限岁数分布（虚岁；每宫 10 岁，1–120 连续）：");
	for (const p of chart.palaces) {
		out.push(`  ${p.name}(${BRANCHES[p.branch]})：${(p.ages ?? []).join(",")}`);
	}
	return out;
}

// ══════════════════════ 宫盘聚焦专题（--focus）══════════════════════

/**
 * `--focus <宫>`：宫盘分析专题 —— 目标宫详表 + 对宫 + 三方四正会照星曜 +
 * 四化落宫标注 + 大限年龄段与流年/小限引动。
 *
 * @param chart - 命盘
 * @param focusRaw - 用户原始输入（项目全名 / 口语简称 / iztro 旧口径 / 地支名）
 * @param liuNianYear - 流年公历年（引动标注用）
 * @returns 渲染好的文本
 * @throws 宫名不命中任何写法时（值域非法与命令其它 throw 行为一致：
 *   引导层打「错误：」并 exit 1；原「聚焦失败」文本段会被机器路径当正常输出吞掉）
 */
export function focusSection(chart: ZiweiChart, focusRaw: string, liuNianYear: number): string[] {
	const want = FOCUS_ALIASES.get(focusRaw);
	const target = chart.palaces.find(
		p => p.name === want || BRANCHES[p.branch] === focusRaw
	);
	if (!target)
		// 指路信息全留在 message 里，stderr 一条不丢
		throw new Error(
			`找不到宫位「${focusRaw}」。可用：${chart.palaces.map(p => p.name).join("、")}` +
				`（也接受口语简称与旧写法，如「交友」「仆役」；或直接给地支名）`
		);

	const sanFang = surroundBranches(target.branch);
	const oppBranch = oppositeBranch(target.branch);
	const lnBranch = yearlyBranchOf(liuNianYear);
	const liuNian = getYearlyMutagen(liuNianYear);

	const out = [`【聚焦：${target.name}】`];
	out.push(renderPalace(target, chart));
	// 命主 / 身主星标注 + 身宫标记（spec §1 四项深化的第四件）
	if (target.isSoulPalace) out.push(`  命宫 —— 命主星：${chart.mingZhu}`);
	if (target.isBodyPalace) out.push(`  ⭐ 此宫为身宫 —— 身主星：${chart.shenZhu}`);
	out.push("");

	// ── 深化一：对宫完整详表（renderPalace 同规格，2026-09-30 起）──
	const oppPalace = chart.palaces.find(p => p.branch === oppBranch);
	out.push(`对宫详表：${oppPalace?.name ?? "?"}`);
	if (oppPalace) out.push(renderPalace(oppPalace, chart));
	out.push("");

	// ── 深化二：三方四正逐宫全星曜（主星含亮度四化 + 吉煞杂曜，不再只列主星）──
	out.push("三方四正会照（逐宫全星曜）：");
	for (const b of sanFang) {
		const p = chart.palaces.find(x => x.branch === b);
		if (!p) continue;
		const all = p.stars.map(starLine).join("、");
		out.push(`  ${p.name}(${BRANCHES[b]})：${all || `空宫借${p.borrowedFromName ?? "?"}`}`);
	}
	out.push(`  会照主星汇总：${huiZhaoMajors(chart, sanFang).join("、") || "（无）"}`);

	// ── 深化三：涉及此宫的格局全列（detectPatterns 过滤 palaces 含此宫）──
	out.push("");
	out.push("涉及此宫的格局：");
	const patternsHere = detectPatterns(chart).filter(pt =>
		(pt.palaces ?? []).some(n => n === target.name || n.includes(target.name))
	);
	if (patternsHere.length) for (const pt of patternsHere) out.push(`  · ${pt.name}（${pt.level}）`);
	else out.push("  （无成立的格局涉及此宫）");

	out.push("");
	out.push("四化落宫：");
	const native = nativeSiHuaOf(chart);
	const nativesHere = locateSihua(chart, native).filter(
		x => x.palace === target.name
	);
	if (nativesHere.length)
		for (const x of nativesHere) out.push(`  生年化${x.hua} ${x.star} 落此宫`);
	else out.push("  生年四化：无落此宫");
	const liuNianHere = locateSihua(chart, liuNian.transforms).filter(
		x => x.palace === target.name
	);
	if (liuNianHere.length)
		for (const x of liuNianHere) out.push(`  ${liuNianYear} 流年化${x.hua} ${x.star} 落此宫`);
	else out.push(`  ${liuNianYear} 流年四化：无落此宫`);

	out.push("");
	out.push("运限引动：");
	if (target.decadalRange)
		out.push(`  此宫为 ${target.decadalRange[0]}-${target.decadalRange[1]} 岁大限宫${target.isCurrentDecadal ? "（当前所行）" : ""}`);
	if (target.branch === lnBranch)
		out.push(`  ${liuNianYear} 流年命宫在此 —— 值年之宫`);
	else if (lnBranch === oppBranch)
		out.push(`  ${liuNianYear} 流年命宫在其对宫 —— 对冲引动`);
	else if (sanFang.includes(lnBranch))
		out.push(`  ${liuNianYear} 流年命宫会照此宫（三方四正内）`);
	const xx = agePalaceOf(chart, chart.currentAge);
	if (xx.branch === target.branch)
		out.push(`  当前虚岁 ${chart.currentAge} 小限在此宫`);
	// ── 深化四（续）：小限岁数段 + 当前大限十年内此宫被流年引动的年份 ──
	const ages = target.ages ?? [];
	if (ages.length)
		out.push(
			`  小限岁数段：${ages[0]}-${ages[ages.length - 1]} 岁（共 ${ages.length} 个落点）`
		);
	const cur = chart.decadals[chart.currentDecadalIndex];
	if (cur) {
		// 大限起止虚岁 → 公历年区间（虚岁 = 出生公历年 + 虚岁 - 1 的近似口径，
		// 与 overviewSection 的速览同源）；逐年看流年命宫是否落此宫 / 对宫 / 三方
		const birthYear = chart.lunarInfo.lunarYear;
		const y0 = birthYear + cur.startAge - 1;
		const y1 = Math.min(birthYear + cur.endAge - 1, new Date().getFullYear() + 10);
		const hits: number[] = [];
		for (let y = y0; y <= y1; y++) {
			const b = yearlyBranchOf(y);
			if (b === target.branch || b === oppBranch || sanFang.includes(b)) hits.push(y);
		}
		out.push(
			`  当前大限（${cur.startAge}-${cur.endAge} 岁，${y0}-${y1} 年）内流年引动此宫（含对冲/会照）：` +
				(hits.length ? hits.join("、") : "（无）")
		);
	}
	return out;
}
