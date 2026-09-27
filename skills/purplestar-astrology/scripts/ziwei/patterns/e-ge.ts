/**
 * 恶格识别器 —— 煞忌交侵、主刑伤波折的一组，成格条件与上格同严。
 *
 * @remarks
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
import { PATTERN_VERDICTS } from "./data";
import { hasStar, getJiaPalaces, sanFangAllStars, fillVerdict } from "./helpers";
import { duiGongBranch } from "../palace-relations";

/** 化忌入命（坐命宫）/ 化忌冲命（坐迁移宫，对冲命宫） */
function detectHuaJiRuMingQian({ chart }: DetectContext): Pattern[] {
	const qianBranch = duiGongBranch(chart.mingGongBranch);
	// 本识别器筛的是「命宫与迁移宫**两个**宫位」，故用局部数组累积、而不是像多数识别器
	// 那样「命中即 return」—— 表达的是「两宫命中哪个就报哪个」，不是「我知道会两条」。
	// 实测**至多一条**：生年四化一年只有一颗化忌星，而命宫与迁移宫互为对宫，坐不满两宫。
	const hits: Pattern[] = [];
	for (const palace of chart.palaces) {
		if (palace.branch !== chart.mingGongBranch && palace.branch !== qianBranch) continue;
		const jiStar = palace.stars.find(s => s.siHua === "忌" && s.type === "major");
		if (!jiStar) continue;

		const inMing = palace.branch === chart.mingGongBranch;
		// 迁移分支取名「冲命」而**不是**「入迁」：后者在本仓古籍库零见，前者有 1 处
		// （《紫微斗数全书·十二宫论·夫妻宫》）。裁决依据见 `GEJU_NAME_ALIASES`。
		const name = `${jiStar.name}化忌${inMing ? "入命" : "冲命"}`;
		hits.push({
			name,
			level: 40,
			palaces: [palace.name],
			conditions: { required: [`${jiStar.name}化忌坐${inMing ? "命" : "迁"}宫`] },
			...fillVerdict(PATTERN_VERDICTS[inMing ? "化忌入命" : "化忌冲命"], { 星: jiStar.name }),
		});
	}
	return hits;
}

/** 羊陀夹忌：化忌坐宫，左右被擎羊陀罗夹 */
function detectYangTuoJiaJi({ chart }: DetectContext): Pattern[] {
	for (const palace of chart.palaces) {
		const jiStar = palace.stars.find(s => s.siHua === "忌");
		if (!jiStar) continue;
		if (palace.branch !== chart.mingGongBranch) continue; // 只看命宫被夹

		const { prev, next } = getJiaPalaces(chart, palace.branch);
		if (!prev || !next) continue;
		const aPrev = hasStar(prev, "擎羊") && hasStar(next, "陀罗");
		const aNext = hasStar(prev, "陀罗") && hasStar(next, "擎羊");
		if (!aPrev && !aNext) continue;

		const name = "羊陀夹忌";
		return [{
			name,
			level: 40,
			palaces: ["命宫", prev.name, next.name],
			conditions: { required: ["化忌坐命", "擎羊陀罗分居命宫前后两宫"] },
			...PATTERN_VERDICTS[name],
		}];
	}
	return [];
}

/** 火铃夹命：火星铃星分居命宫前后 */
function detectHuoLingJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return [];
	const okA = hasStar(prev, "火星") && hasStar(next, "铃星");
	const okB = hasStar(prev, "铃星") && hasStar(next, "火星");
	if (!okA && !okB) return [];

	const name = "火铃夹命";
	return [{
		name,
		level: 40,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["火星铃星分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 空劫夹命：地空地劫分居命宫前后 */
function detectKongJieJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return [];
	const okA = hasStar(prev, "地空") && hasStar(next, "地劫");
	const okB = hasStar(prev, "地劫") && hasStar(next, "地空");
	if (!okA && !okB) return [];

	const name = "空劫夹命";
	return [{
		name,
		level: 40,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["地空地劫分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 廉杀羊：廉贞、七杀、擎羊三星会照（流年大限最凶） */
function detectLianShaYang({ chart }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (!(sanFangSet.has("廉贞") && sanFangSet.has("七杀") && sanFangSet.has("擎羊"))) return [];

	const name = "廉杀羊";
	return [{
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["廉贞、七杀、擎羊三星会照三方四正"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 巨火羊：巨门、火星、擎羊会照 */
function detectJuHuoYang({ chart }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (!(sanFangSet.has("巨门") && sanFangSet.has("火星") && sanFangSet.has("擎羊"))) return [];

	const name = "巨火羊";
	return [{
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["巨门、火星、擎羊三星会照三方四正"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 铃昌陀武：铃星、文昌、陀罗、武曲会照（限至投河） */
function detectLingChangTuoWu({ chart }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (
		!(
			sanFangSet.has("铃星") &&
			sanFangSet.has("文昌") &&
			sanFangSet.has("陀罗") &&
			sanFangSet.has("武曲")
		)
	)
		return [];

	const name = "铃昌陀武";
	return [{
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["铃星、文昌、陀罗、武曲四星会照三方四正"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 马头带箭：擎羊在午宫坐命 */
function detectMaTouDaiJian({ chart, ming }: DetectContext): Pattern[] {
	if (ming.branch !== 6) return []; // 必须午
	if (!hasStar(ming, "擎羊")) return [];

	const required = ["擎羊于午宫坐命"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("七杀") || sanFangAllStars(chart).has("破军"))
		bonus.push("再会七杀或破军（武职大贵）");
	if (sanFangAllStars(chart).has("天魁") || sanFangAllStars(chart).has("天钺"))
		bonus.push("魁钺加照");

	const name = "马头带箭";
	return [{
		name,
		level: bonus.length ? 75 : 40,
		palaces: ["命宫"],
		conditions: { required, bonus },
		...PATTERN_VERDICTS[name],
	}];
}

export const E_GE: ReadonlyArray<Detector> = [
	detectHuaJiRuMingQian,
	detectYangTuoJiaJi,
	detectHuoLingJiaMing,
	detectKongJieJiaMing,
	detectLianShaYang,
	detectJuHuoYang,
	detectLingChangTuoWu,
	detectMaTouDaiJian,
];
