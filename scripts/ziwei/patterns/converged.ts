/**
 * 收敛自 db-analysis 的格局识别器 —— 判定收敛到格局层后归入本组。
 *
 * @remarks
 * 以下 11 个识别器（产出 13 个格局名）的判定住在本文件；
 * `db-analysis.ts` 的 `detectGeJu` 只按名字取用这里的产出、保留自己的倪师口吻长判词。
 *
 * **口径照搬，不趁迁移"顺手修正"**：判定条件逐字对齐原 `detectGeJu`（含它偏宽或偏窄之处），
 * 差异要改就两侧一起改 —— `test/invariants.test.ts` 里这 13 个名字都有独立预言机盯着。
 *
 * `source` 照实标注：本仓古籍库（`purplestar-classics` 技能的 `classics --search`）
 * 查得到直接出处的写书名与篇名，查不到的写「传统口诀（本仓古籍库无直接出处）」——
 * **不编造篇名**，等将来补录古籍再换。
 *
 * 识别器签名一律 `(ctx: DetectContext) => Pattern[]`：命中返回 `[one]`，未命中返回 `[]`，
 * 并进总表只发生在 `./index` 的 `detectPatterns` 那一行 for 里 —— 本文件不接触任何累积数组。
 * 判词一律从 `./data` 的 `PATTERN_VERDICTS` 取，收尾经 `./helpers` 的 `fillVerdict` 填占位符。
 *
 * 下方导出的数组**次序即 `detectPatterns` 的输出次序**，增删或调整组内次序都会改变输出排列。
 *
 * @packageDocumentation
 */

import type { Pattern, DetectContext, Detector } from "./types";
import { CHANG_QU, PATTERN_VERDICTS } from "./data";
import {
	hasStar,
	findStarPalace,
	getSurroundPalaces,
	isInSanFang,
	getJiaPalaces,
	sanFangAllStars,
	isBright,
	getStarMutagen,
	fillVerdict,
} from "./helpers";
import { oppositeBranch } from "../palace-relations";

/** 七杀朝斗格：七杀居寅或申，且落命宫或迁移宫（对宫紫微天府相照） */
function detectQiShaChaoDou({ chart }: DetectContext): Pattern[] {
	const qisha = findStarPalace(chart, "七杀");
	if (!qisha) return [];
	if (qisha.branch !== 2 && qisha.branch !== 8) return []; // 寅=2、申=8
	const inMing = qisha.branch === chart.soulBranch;
	const inQianYi = qisha.branch === oppositeBranch(chart.soulBranch);
	if (!inMing && !inQianYi) return [];

	const name = "七杀朝斗格";
	return [{
		name,
		level: 90,
		palaces: [qisha.name],
		conditions: { required: ["七杀居寅宫或申宫", "七杀坐命宫或迁移宫"] },
		...fillVerdict(PATTERN_VERDICTS[name], { 宫: inMing ? "命宫" : "迁移宫" }),
	}];
}

/** 日月并明格：太阳与太阴**同时**入庙（不限宫位，也不要求同宫——后者是「日月同宫」） */
function detectRiYueBingMing({ chart }: DetectContext): Pattern[] {
	const sun = findStarPalace(chart, "太阳");
	const moon = findStarPalace(chart, "太阴");
	if (!sun || !moon) return [];
	if (!isBright(sun, "太阳") || !isBright(moon, "太阴")) return [];

	const name = "日月并明格";
	return [{
		name,
		level: 90,
		palaces: [sun.name, moon.name],
		conditions: { required: ["太阳入庙（bright）", "太阴入庙（bright）"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 英星入庙格：破军居子或午守命 */
function detectYingXingRuMiao({ chart, ming }: DetectContext): Pattern[] {
	if (ming.branch !== 0 && ming.branch !== 6) return []; // 子=0、午=6
	if (!hasStar(ming, "破军")) return [];

	const name = "英星入庙格";
	return [{
		name,
		level: 90,
		palaces: ["命宫"],
		conditions: { required: ["破军居子宫或午宫", "破军坐命宫"] },
		...PATTERN_VERDICTS[chart.birthInfo?.gender === "male" ? "英星入庙格·男" : "英星入庙格·女"],
	}];
}

/** 日丽中天格：太阳居午守命，光芒最盛 */
function detectRiLiZhongTian({ ming }: DetectContext): Pattern[] {
	if (ming.branch !== 6) return []; // 必须午
	if (!hasStar(ming, "太阳")) return [];

	const name = "日丽中天格";
	return [{
		name,
		level: 90,
		palaces: ["命宫"],
		conditions: { required: ["太阳居午宫", "太阳坐命宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 昌曲守命：文昌或文曲坐命宫（两星俱在时只出「文昌守命」，与 analysis/ 的取值一致） */
function detectChangQuShouMing({ ming }: DetectContext): Pattern[] {
	const hasChang = hasStar(ming, "文昌");
	const hasQu = hasStar(ming, "文曲");
	if (!hasChang && !hasQu) return [];
	const starName = hasChang ? "文昌" : "文曲";

	const name = `${starName}守命`;
	return [{
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: [`${starName}坐命宫`] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 擎羊入命：擎羊坐命宫（刑克之星。擎羊在午守命另有更专门的「马头带箭」，两者可同时命中） */
function detectQingYangRuMing({ ming }: DetectContext): Pattern[] {
	if (!hasStar(ming, "擎羊")) return [];

	const name = "擎羊入命";
	return [{
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["擎羊坐命宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 禄马交驰格：禄存与天马同宫，或同会命宫三方四正 */
function detectLuMaJiaoChi({ chart }: DetectContext): Pattern[] {
	const lu = findStarPalace(chart, "禄存");
	const ma = findStarPalace(chart, "天马");
	if (!lu || !ma) return [];
	const samePalace = lu.branch === ma.branch;
	const bothInSanFang = isInSanFang(chart, lu.branch) && isInSanFang(chart, ma.branch);
	if (!samePalace && !bothInSanFang) return [];

	const name = "禄马交驰格";
	return [{
		name,
		level: 90,
		palaces: samePalace ? [lu.name] : [lu.name, ma.name],
		conditions: { required: [samePalace ? "禄存与天马同宫" : "禄存与天马同会命宫三方四正"] },
		...fillVerdict(PATTERN_VERDICTS[name], {
			会: samePalace ? "禄存与天马同宫" : "禄存与天马同会命宫三方四正",
		}),
	}];
}

/** 羊陀夹命：擎羊陀罗分居命宫前后两宫（煞格） */
function detectYangTuoJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.soulBranch);
	if (!prev || !next) return [];
	const okA = hasStar(prev, "擎羊") && hasStar(next, "陀罗");
	const okB = hasStar(prev, "陀罗") && hasStar(next, "擎羊");
	if (!okA && !okB) return [];

	// ⚠️ 本格与「禄存守命」在 300 条基准上**完全同盘**（安星法里擎羊恒在禄存前一位、
	// 陀罗恒在后一位），两个名字都报是照倪师侧的展示口径，不是判定分歧。
	const name = "羊陀夹命";
	return [{
		name,
		level: 40,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["擎羊陀罗分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 紫府朝垣格：紫微、天府分居三方四正朝拱，而命宫本身不坐紫府 */
function detectZiFuChaoYuan({ chart, ming }: DetectContext): Pattern[] {
	const sanFang = sanFangAllStars(chart);
	if (!sanFang.has("紫微") || !sanFang.has("天府")) return [];
	if (hasStar(ming, "紫微") || hasStar(ming, "天府")) return [];

	const name = "紫府朝垣格";
	return [{
		name,
		level: 90,
		palaces: getSurroundPalaces(chart)
			.filter(p => hasStar(p, "紫微") || hasStar(p, "天府"))
			.map(p => p.name),
		conditions: { required: ["紫微与天府同会命宫三方四正", "命宫不坐紫微、天府"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 天马落空：天马与地空、地劫、旬空或截路同宫 */
function detectTianMaLuoKong({ chart }: DetectContext): Pattern[] {
	const ma = findStarPalace(chart, "天马");
	if (!ma) return [];
	const spoilers = ["地空", "地劫", "旬空", "截路"].filter(n => hasStar(ma, n));
	if (!spoilers.length) return [];

	const name = "天马落空";
	return [{
		name,
		level: 40,
		palaces: [ma.name],
		conditions: { required: [`天马与${spoilers.join("、")}同宫`] },
		...fillVerdict(PATTERN_VERDICTS[name], { 煞: spoilers.join("、") }),
	}];
}

/** 昌曲化忌：文昌或文曲带生年化忌（文星受伤，不限宫位） */
function detectChangQuHuaJi({ chart }: DetectContext): Pattern[] {
	// 本识别器对文昌、文曲**两颗**分别筛，故用累积数组而非「命中即 return」。
	// 实测**至多一条**：一年只有一颗生年化忌星，昌曲不可能同时带忌。
	const hits: Pattern[] = [];
	for (const starName of CHANG_QU) {
		const palace = findStarPalace(chart, starName);
		if (!palace) continue;
		if (getStarMutagen(palace, starName) !== "忌") continue;

		const name = `${starName}化忌`;
		hits.push({
			name,
			level: 40,
			palaces: [palace.name],
			conditions: { required: [`${starName}带生年化忌`] },
			...PATTERN_VERDICTS[name],
		});
	}
	return hits;
}

export const SHOU_LIAN_GE: ReadonlyArray<Detector> = [
	detectQiShaChaoDou,
	detectRiYueBingMing,
	detectYingXingRuMiao,
	detectRiLiZhongTian,
	detectChangQuShouMing,
	detectQingYangRuMing,
	detectLuMaJiaoChi,
	detectYangTuoJiaMing,
	detectZiFuChaoYuan,
	detectTianMaLuoKong,
	detectChangQuHuaJi,
];
