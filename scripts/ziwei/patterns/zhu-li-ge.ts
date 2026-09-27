/**
 * 助力格识别器 —— 吉星夹拱、双禄三奇一类「锦上添花」的格局。
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
import { SHA_KONG, PATTERN_VERDICTS, PATTERN_ASIDES } from "./data";
import {
	hasStar,
	hasShaInPalace,
	getSanFangPalaces,
	getJiaPalaces,
	sanFangAllStars,
	fillVerdict,
} from "./helpers";

/** 辅弼夹命 */
function detectFuBiJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return [];
	const prevHasZuo = hasStar(prev, "左辅");
	const prevHasYou = hasStar(prev, "右弼");
	const nextHasZuo = hasStar(next, "左辅");
	const nextHasYou = hasStar(next, "右弼");
	if (!((prevHasZuo && nextHasYou) || (prevHasYou && nextHasZuo))) return [];

	const required = ["左辅右弼分居命宫前后两宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("天魁") || sanFangAllStars(chart).has("天钺"))
		bonus.push("再会魁钺");

	const name = "辅弼夹命";
	return [{
		name,
		level: 90,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 昌曲夹命 */
function detectChangQuJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return [];
	const prevHasChang = hasStar(prev, "文昌");
	const prevHasQu = hasStar(prev, "文曲");
	const nextHasChang = hasStar(next, "文昌");
	const nextHasQu = hasStar(next, "文曲");
	if (!((prevHasChang && nextHasQu) || (prevHasQu && nextHasChang))) return [];

	const name = "昌曲夹命";
	return [{
		name,
		level: 90,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["文昌文曲分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 魁钺夹命 */
function detectKuiYueJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return [];
	const okA = hasStar(prev, "天魁") && hasStar(next, "天钺");
	const okB = hasStar(prev, "天钺") && hasStar(next, "天魁");
	if (!okA && !okB) return [];

	const name = "魁钺夹命";
	return [{
		name,
		level: 75,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["天魁天钺分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 双禄朝垣：化禄 + 禄存 同会三方 */
function detectShuangLuChaoYuan({ chart, ming }: DetectContext): Pattern[] {
	const sanFang = getSanFangPalaces(chart);
	let huaLuFound = false;
	let luCunFound = false;
	for (const p of sanFang) {
		if (p.stars.some(s => s.siHua === "禄")) huaLuFound = true;
		if (hasStar(p, "禄存")) luCunFound = true;
	}
	if (!huaLuFound || !luCunFound) return [];

	const name = "双禄朝垣";
	return [{
		name,
		level: 90,
		palaces: sanFang.map(p => p.name),
		conditions: {
			required: ["化禄会照三方四正", "禄存会照三方四正"],
			breaking: hasShaInPalace(ming, SHA_KONG)
				? ["命坐空劫（双禄遇空，财来财去）"]
				: undefined,
		},
		...PATTERN_VERDICTS[name],
	}];
}

/** 三奇加会：化禄 化权 化科 同会三方 */
function detectSanQiJiaHui({ chart }: DetectContext): Pattern[] {
	const sanFangPalaces = getSanFangPalaces(chart);
	let lu = false,
		quan = false,
		ke = false;
	for (const p of sanFangPalaces) {
		for (const s of p.stars) {
			if (s.siHua === "禄") lu = true;
			if (s.siHua === "权") quan = true;
			if (s.siHua === "科") ke = true;
		}
	}
	if (!(lu && quan && ke)) return [];

	const name = "三奇加会";
	return [{
		name,
		level: 90,
		palaces: sanFangPalaces.map(p => p.name),
		conditions: { required: ["化禄、化权、化科三吉化齐会命宫三方四正"] },
		...PATTERN_VERDICTS[name],
	}];
}

/** 化禄入命/官/财 */
function detectHuaLuRuMing({ chart, ming }: DetectContext): Pattern[] {
	const huaLuStar = ming.stars.find(s => s.siHua === "禄" && s.type === "major");
	if (!huaLuStar) return [];

	const name = `${huaLuStar.name}化禄入命`;
	return [{
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: [`${huaLuStar.name}化禄坐命宫`] },
		...fillVerdict(PATTERN_VERDICTS["化禄入命"], {
			星: huaLuStar.name,
			注: PATTERN_ASIDES["化禄入命"]?.[huaLuStar.name] ?? "",
		}),
	}];
}

export const ZHU_LI_GE: ReadonlyArray<Detector> = [
	detectFuBiJiaMing,
	detectChangQuJiaMing,
	detectKuiYueJiaMing,
	detectShuangLuChaoYuan,
	detectSanQiJiaHui,
	detectHuaLuRuMing,
];
