/**
 * 基础格局识别器 —— 让普通命盘也能识别出常见格局的一组轻量判定。
 *
 * @remarks
 * 基础格局（提升识别覆盖率）：让普通命盘也能识别出 1-3 个常见格局，而不是 30+ 严格古书
 * 格局都不匹配。单一条件触发的轻量识别，level 多为 neutral / good。
 *
 * 签名一律 `(ctx: DetectContext) => Pattern[]`：命中 `[one]`、未命中 `[]`，并进总表只发生在
 * `./index`；判词一律从 `PATTERN_VERDICTS` 取、经 `fillVerdict` 填占位符。
 *
 * ⚠️ 下方导出的数组**次序即 `detectPatterns` 的输出次序**（见 docs/code/patterns.md）。
 *
 * @file 基础格局识别器 —— 让普通命盘也能识别出常见格局的一组轻量判定
 *
 * @packageDocumentation
 */

import type { Palace } from "../types";
import type { Pattern, DetectContext, Detector } from "../patterns/types";
import { PATTERN_VERDICTS } from "../corpus/data/patterns";
import {
	hasStar,
	findStarPalace,
	getSurroundPalaces,
	sanFangAllStars,
	fillVerdict,
} from "../patterns/helpers";
import { oppositeBranch } from "../palace-relations";

/**
 * 禄存守身：禄存入身宫（或命宫与身宫同宫）
 *
 * @param chart - 已排好的命盘（判定只读盘面字段，不改任何状态）
 * @returns 命中时为单元素数组（禄存坐命宫取「禄存守命」、坐身宫取「禄存守身」）；禄存不在命宫也不在身宫时为空数组
 */
function detectLuCunShouShen({ chart }: DetectContext): Pattern[] {
	const luCunPalace = findStarPalace(chart, "禄存");
	if (!luCunPalace) {
		return [];
	}
	const inMing = luCunPalace.branch === chart.soulBranch;
	const inShen = luCunPalace.branch === chart.bodyBranch;
	if (!inMing && !inShen) {
		return [];
	}
	const name = inMing ? "禄存守命" : "禄存守身";
	return [
		{
			name,
			level: 75,
			palaces: [inMing ? "命宫" : "身宫"],
			conditions: { required: [inMing ? "禄存入命宫" : "禄存入身宫"] },
			...PATTERN_VERDICTS[name],
		},
	];
}

/**
 * 天马入命/迁：驿马星动
 *
 * @param chart - 已排好的命盘
 * @returns 天马坐命宫取「天马入命」、坐迁移宫（命宫对宫）取「天马在迁」；两处皆无天马时为空数组
 */
function detectTianMaRuMing({ chart }: DetectContext): Pattern[] {
	const tianMaPalace = findStarPalace(chart, "天马");
	if (!tianMaPalace) {
		return [];
	}
	const inMing = tianMaPalace.branch === chart.soulBranch;
	const inQian = tianMaPalace.branch === oppositeBranch(chart.soulBranch);
	if (!inMing && !inQian) {
		return [];
	}
	const name = inMing ? "天马入命" : "天马在迁";
	return [
		{
			name,
			level: 60,
			palaces: [tianMaPalace.name],
			conditions: { required: [inMing ? "天马入命宫" : "天马入迁移宫"] },
			...PATTERN_VERDICTS[name],
		},
	];
}

/**
 * 化禄入财：财帛宫主星化禄
 *
 * @param chart - 已排好的命盘
 * @returns 财帛宫有主星带生年化禄时为单元素数组（格局名固定「化禄入财」）；否则为空数组
 */
function detectHuaLuRuCai({ chart }: DetectContext): Pattern[] {
	const cai = chart.palaces.find(p => p.name === "财帛宫");
	if (!cai) {
		return [];
	}
	const luStar = cai.stars.find(s => s.type === "major" && s.mutagen === "禄");
	if (!luStar) {
		return [];
	}
	const name = "化禄入财";
	return [
		{
			name,
			level: 75,
			palaces: ["财帛宫"],
			conditions: { required: [`${luStar.name}化禄入财帛宫`] },
			...fillVerdict(PATTERN_VERDICTS[name], { 星: luStar.name }),
		},
	];
}

/**
 * 化权入官：官禄宫主星化权
 *
 * @param chart - 已排好的命盘
 * @returns 官禄宫有主星带生年化权时为单元素数组（格局名固定「化权入官」）；否则为空数组
 */
function detectHuaQuanRuGuan({ chart }: DetectContext): Pattern[] {
	const guan = chart.palaces.find(p => p.name === "官禄宫");
	if (!guan) {
		return [];
	}
	const quanStar = guan.stars.find(s => s.type === "major" && s.mutagen === "权");
	if (!quanStar) {
		return [];
	}
	const name = "化权入官";
	return [
		{
			name,
			level: 75,
			palaces: ["官禄宫"],
			conditions: { required: [`${quanStar.name}化权入官禄宫`] },
			...fillVerdict(PATTERN_VERDICTS[name], { 星: quanStar.name }),
		},
	];
}

/**
 * 化科入命/身：科名加身
 *
 * @param chart - 已排好的命盘（身宫由 `chart.bodyBranch` 定位）
 * @param ming - 命宫（由 `detectPatterns` 保证非空）
 * @returns 命宫有主星化科取「化科入命」、身宫有则取「化科入身」；命中即返回单元素数组，两处皆无时为空数组
 */
function detectHuaKeRuMingShen({ chart, ming }: DetectContext): Pattern[] {
	const shen = chart.palaces.find(p => p.branch === chart.bodyBranch);
	const target = [ming, shen].filter((p): p is Palace => Boolean(p));
	for (const p of target) {
		const keStar = p.stars.find(s => s.type === "major" && s.mutagen === "科");
		if (!keStar) {
			continue;
		}
		const isMing = p.branch === chart.soulBranch;
		const name = isMing ? "化科入命" : "化科入身";
		// 命和身重复时只识别一次：首次命中即返回
		return [
			{
				name,
				level: 75,
				palaces: [isMing ? "命宫" : "身宫"],
				conditions: { required: [`${keStar.name}化科入${isMing ? "命" : "身"}宫`] },
				...fillVerdict(PATTERN_VERDICTS[name], { 星: keStar.name }),
			},
		];
	}
	return [];
}

/**
 * 昌曲同会：文昌+文曲都在命三方四正
 *
 * @param chart - 已排好的命盘（昌曲是否同会由三方四正星曜集合判定）
 * @param ming - 命宫（用来区分「昌曲坐命」与「昌曲同会」）
 * @returns 昌曲俱在三方四正时返回单元素数组；缺任一星时为空数组
 */
function detectChangQuTongHui({ chart, ming }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("文昌") || !sanFangSet.has("文曲")) {
		return [];
	}
	const inMing = hasStar(ming, "文昌") && hasStar(ming, "文曲");
	const name = inMing ? "昌曲坐命" : "昌曲同会";
	return [
		{
			name,
			level: 75,
			palaces: ["命宫"],
			conditions: { required: ["文昌、文曲同会命宫三方四正"] },
			...PATTERN_VERDICTS[name],
		},
	];
}

/**
 * 辅弼同会：左辅+右弼都在命三方四正
 *
 * @param chart - 已排好的命盘
 * @returns 左辅与右弼俱在三方四正时为单元素数组；否则为空数组
 */
function detectFuBiTongHui({ chart }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("左辅") || !sanFangSet.has("右弼")) {
		return [];
	}
	const name = "辅弼同会";
	return [
		{
			name,
			level: 75,
			palaces: ["命宫"],
			conditions: { required: ["左辅、右弼同会命宫三方四正"] },
			...PATTERN_VERDICTS[name],
		},
	];
}

/**
 * 魁钺同会：天魁+天钺都在命三方四正
 *
 * @param chart - 已排好的命盘
 * @returns 天魁与天钺俱在三方四正时为单元素数组；否则为空数组
 */
function detectKuiYueTongHui({ chart }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("天魁") || !sanFangSet.has("天钺")) {
		return [];
	}
	const name = "魁钺同会";
	return [
		{
			name,
			level: 75,
			palaces: ["命宫"],
			conditions: { required: ["天魁、天钺同会命宫三方四正"] },
			...PATTERN_VERDICTS[name],
		},
	];
}

/**
 * 科权双会：化科 + 化权 同会三方四正
 *
 * @param chart - 已排好的命盘（本例扫的是三方四正诸宫的星曜四化字）
 * @returns 化科与化权同现于三方四正时为单元素数组；缺任一项时为空数组
 */
function detectKeQuanShuangHui({ chart }: DetectContext): Pattern[] {
	const sfPalaces = getSurroundPalaces(chart);
	let hasKe = false,
		hasQuan = false;
	for (const p of sfPalaces) {
		for (const s of p.stars) {
			if (s.type === "major" && s.mutagen === "科") {
				hasKe = true;
			}
			if (s.type === "major" && s.mutagen === "权") {
				hasQuan = true;
			}
		}
	}
	if (!hasKe || !hasQuan) {
		return [];
	}
	const name = "科权双会";
	return [
		{
			name,
			level: 75,
			palaces: ["命宫"],
			conditions: { required: ["化科、化权同会命宫三方四正"] },
			...PATTERN_VERDICTS[name],
		},
	];
}

/** 基础格局识别器注册表：让普通命盘也能识别的常见格局。 */
export const JI_CHU_GE: ReadonlyArray<Detector> = [
	detectLuCunShouShen,
	detectTianMaRuMing,
	detectHuaLuRuCai,
	detectHuaQuanRuGuan,
	detectHuaKeRuMingShen,
	detectChangQuTongHui,
	detectFuBiTongHui,
	detectKuiYueTongHui,
	detectKeQuanShuangHui,
];
