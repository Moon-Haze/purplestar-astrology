/**
 * 中格识别器 —— 成格条件稍宽，仍是古书明列的格局。
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
import { SHA_HARD, SHA_KONG, PATTERN_VERDICTS } from "./data";
import { BRANCHES } from "../constants";
import {
	getMajorStarNames,
	hasStar,
	findStarPalace,
	hasShaInPalace,
	getDuiGong,
	getJiaPalaces,
	sanFangAllStars,
	sanFangShaCount,
	isBright,
	isDim,
	getStarSiHua,
	fillVerdict,
} from "./helpers";

/** 廉贞天相：同宫 */
function detectLianXiang({ chart }: DetectContext): Pattern[] {
	const lian = findStarPalace(chart, "廉贞");
	const xiang = findStarPalace(chart, "天相");
	if (!lian || !xiang || lian.branch !== xiang.branch) return [];

	const inMing = lian.branch === chart.mingGongBranch;
	const required = ["廉贞天相同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (hasStar(lian, "禄存") || getStarSiHua(lian, "廉贞") === "禄")
		bonus.push("见禄存或廉贞化禄");
	if (sanFangAllStars(chart).has("左辅")) bonus.push("左辅会照");
	if (hasShaInPalace(lian, ["擎羊"])) breaking.push("廉相宫坐擎羊（廉杀羊倾向）");
	if (getStarSiHua(lian, "廉贞") === "忌") breaking.push("廉贞化忌");

	// 名字取古籍用语：全集·卷四「廉贞与天相同宫为『廉相格』」。全称「廉贞天相格」
	// 古籍零见，2026-09-27 按「古文优先」裁决为简称（见 GEJU_NAME_ALIASES）。
	const name = "廉相格";
	return [{
		name,
		level: breaking.length ? 40 : inMing ? 75 : 60,
		palaces: [lian.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 武曲七杀：同宫，将星配财星 */
function detectWuQiSha({ chart }: DetectContext): Pattern[] {
	const wu = findStarPalace(chart, "武曲");
	const qi = findStarPalace(chart, "七杀");
	if (!wu || !qi || wu.branch !== qi.branch) return [];

	const inMing = wu.branch === chart.mingGongBranch;
	const required = ["武曲七杀同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (getStarSiHua(wu, "武曲") === "权") bonus.push("武曲化权");
	if (getStarSiHua(wu, "武曲") === "禄") bonus.push("武曲化禄");
	if (getStarSiHua(wu, "武曲") === "忌") breaking.push("武曲化忌（武曲化忌为财劫之兆）");
	if (hasShaInPalace(wu, ["擎羊", "陀罗", "火星", "铃星"])) breaking.push("武杀宫煞星过多");

	const name = "武曲七杀";
	return [{
		name,
		level: breaking.length ? 40 : inMing ? 90 : 75,
		palaces: [wu.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 天同天梁：同宫 */
function detectTongLiang({ chart }: DetectContext): Pattern[] {
	const tong = findStarPalace(chart, "天同");
	const liang = findStarPalace(chart, "天梁");
	if (!tong || !liang || tong.branch !== liang.branch) return [];

	const required = ["天同天梁同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("文昌")) bonus.push("文昌会照");
	if (getStarSiHua(tong, "天同") === "禄") bonus.push("天同化禄");
	if (hasShaInPalace(tong, SHA_HARD)) breaking.push("煞星同坐");

	const name = "天同天梁格";
	return [{
		name,
		level: breaking.length ? 60 : 75,
		palaces: [tong.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 日月同宫：太阳太阴丑或未宫同宫 */
function detectRiYueTongGong({ chart }: DetectContext): Pattern[] {
	const sun = findStarPalace(chart, "太阳");
	const moon = findStarPalace(chart, "太阴");
	if (!sun || !moon || sun.branch !== moon.branch) return [];
	if (sun.branch !== 1 && sun.branch !== 7) return []; // 必须丑(1) 或 未(7)

	const inMing = sun.branch === chart.mingGongBranch;
	const required = [`太阳太阴同入${BRANCHES[sun.branch]}宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sun.branch === 7) bonus.push("未宫日月同辉（古书云未宫日月双美）");
	if (sanFangAllStars(chart).has("文昌") && sanFangAllStars(chart).has("文曲"))
		bonus.push("昌曲会照");
	if (hasShaInPalace(sun, SHA_HARD)) breaking.push("日月宫煞星同坐");

	const name = "日月同宫";
	return [{
		name,
		level: breaking.length ? 75 : inMing ? 90 : 75,
		palaces: [sun.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[sun.branch === 7 ? "日月同宫·未" : "日月同宫·丑"],
	}];
}

/** 日月夹命：太阳太阴在命宫前后两宫 */
function detectRiYueJiaMing({ chart }: DetectContext): Pattern[] {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return [];
	const prevHasSun = hasStar(prev, "太阳");
	const prevHasMoon = hasStar(prev, "太阴");
	const nextHasSun = hasStar(next, "太阳");
	const nextHasMoon = hasStar(next, "太阴");
	const ok = (prevHasSun && nextHasMoon) || (prevHasMoon && nextHasSun);
	if (!ok) return [];

	const sunPalace = prevHasSun ? prev : next;
	const moonPalace = prevHasMoon ? prev : next;
	const required = ["太阳太阴分居命宫前后两宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (isBright(sunPalace, "太阳")) bonus.push("太阳庙旺");
	if (isBright(moonPalace, "太阴")) bonus.push("太阴庙旺");
	if (isDim(sunPalace, "太阳") || isDim(moonPalace, "太阴"))
		breaking.push("日月落陷（夹命无光）");

	const name = "日月夹命";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: [sunPalace.name, moonPalace.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 巨日同宫：巨门太阳同入寅或申 */
function detectJuRiTongGong({ chart }: DetectContext): Pattern[] {
	const ju = findStarPalace(chart, "巨门");
	const sun = findStarPalace(chart, "太阳");
	if (!ju || !sun || ju.branch !== sun.branch) return [];
	if (ju.branch !== 2 && ju.branch !== 8) return []; // 必须寅(2) 或 申(8)

	const inMing = ju.branch === chart.mingGongBranch;
	const required = [`巨门太阳同入${BRANCHES[ju.branch]}宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (ju.branch === 2) bonus.push("寅宫太阳庙旺，巨门得日光化解是非");
	if (getStarSiHua(ju, "巨门") === "禄" || getStarSiHua(ju, "巨门") === "权")
		bonus.push("巨门化禄/化权（口才生财）");
	if (getStarSiHua(ju, "巨门") === "忌") breaking.push("巨门化忌（口舌官非）");
	if (ju.branch === 8) breaking.push("申宫太阳偏西，巨门暗曜更显");

	const name = "巨日同宫";
	return [{
		name,
		level: breaking.length ? 40 : inMing && ju.branch === 2 ? 90 : 75,
		palaces: [ju.name],
		conditions: { required, bonus, breaking },
		...fillVerdict(PATTERN_VERDICTS[name], { 宫: BRANCHES[ju.branch] }),
	}];
}

/** 石中隐玉：巨门入命于子午宫 */
function detectShiZhongYinYu({ chart, ming }: DetectContext): Pattern[] {
	if (!hasStar(ming, "巨门")) return [];
	if (ming.branch !== 0 && ming.branch !== 6) return []; // 子(0) 或 午(6)

	const required = [`巨门入命于${BRANCHES[ming.branch]}宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (getStarSiHua(ming, "巨门") === "禄" || getStarSiHua(ming, "巨门") === "权")
		bonus.push("巨门化禄/化权");
	if (sanFangAllStars(chart).has("文昌")) bonus.push("文昌会照（石中隐玉得明）");
	if (getStarSiHua(ming, "巨门") === "忌") breaking.push("巨门化忌（玉藏深泥）");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命坐煞星");

	const name = "石中隐玉";
	return [{
		name,
		level: breaking.length ? 40 : 90,
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 明珠出海：命宫在未空宫，对宫丑宫为太阳太阴 */
function detectMingZhuChuHai({ chart, ming }: DetectContext): Pattern[] {
	if (ming.branch !== 7) return []; // 命在未
	if (getMajorStarNames(ming).length > 0) return []; // 命宫为空宫
	const dui = getDuiGong(chart, ming.branch);
	if (!dui) return [];
	if (!hasStar(dui, "太阳") || !hasStar(dui, "太阴")) return [];

	const required = ["命宫在未为空宫", "对宫丑宫为太阳太阴同度"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("文昌") || sanFangAllStars(chart).has("文曲"))
		bonus.push("再会昌曲");
	if (sanFangAllStars(chart).has("左辅") || sanFangAllStars(chart).has("右弼"))
		bonus.push("辅弼相助");
	if (sanFangShaCount(chart, SHA_HARD) >= 2) breaking.push("煞星会照（珠光黯淡）");

	const name = "明珠出海";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: ["命宫", dui.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 紫微独坐入命 */
function detectZiWeiInMing({ chart, ming }: DetectContext): Pattern[] {
	if (!hasStar(ming, "紫微") || hasStar(ming, "天府")) return [];

	const required = ["紫微独坐命宫（无天府同坐）"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	const sanFangSet = sanFangAllStars(chart);
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("左辅右弼同会");
	if (sanFangSet.has("文昌") && sanFangSet.has("文曲")) bonus.push("文昌文曲同会");
	if (!sanFangSet.has("左辅") && !sanFangSet.has("右弼")) breaking.push("无辅弼（孤君无臣）");
	if (hasShaInPalace(ming, SHA_KONG)) breaking.push("紫微遇空劫（古书最忌）");

	const name = "紫微入命";
	return [{
		name,
		level: breaking.length ? 40 : bonus.length ? 90 : 75,
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

export const ZHONG_GE: ReadonlyArray<Detector> = [
	detectLianXiang,
	detectWuQiSha,
	detectTongLiang,
	detectRiYueTongGong,
	detectRiYueJiaMing,
	detectJuRiTongGong,
	detectShiZhongYinYu,
	detectMingZhuChuHai,
	detectZiWeiInMing,
];
