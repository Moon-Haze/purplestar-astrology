/**
 * 上格识别器 —— 古书条件最严、成格最难得的一组。
 *
 * @remarks
 * 正格识别器
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
import {
	getMajorStarNames,
	hasStar,
	findStarPalace,
	shaCountInPalace,
	hasShaInPalace,
	getSurroundPalaces,
	isInSanFang,
	sanFangAllStars,
	sanFangShaCount,
	isBright,
	isDim,
	getStarMutagen,
	palaceHasMutagen,
	sanFangHasMutagen,
	fillVerdict,
} from "./helpers";
import { oppositeBranch } from "../palace-relations";

/** 君臣庆会：紫微入命，左辅右弼同会（同宫或三方） */
function detectJunChenQingHui({ chart, ming }: DetectContext): Pattern[] {
	if (!hasStar(ming, "紫微")) return [];
	const sanFangSet = sanFangAllStars(chart);
	const hasZuo = sanFangSet.has("左辅");
	const hasYou = sanFangSet.has("右弼");
	if (!hasZuo || !hasYou) return [];

	const required = ["紫微入命", "左辅右弼同会三方四正"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会文昌或文曲");
	if (sanFangSet.has("天魁") || sanFangSet.has("天钺")) bonus.push("魁钺贵人加照");
	if (getStarMutagen(ming, "紫微") === "权") bonus.push("紫微化权");
	if (sanFangShaCount(chart, SHA_KONG) >= 2) breaking.push("地空地劫双夹会照（紫微忌空劫）");

	const name = "君臣庆会";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 紫府同宫：紫微+天府同宫，且该宫为命宫或迁移宫 */
function detectZiFu({ chart }: DetectContext): Pattern[] {
	const ziwei = findStarPalace(chart, "紫微");
	const tianfu = findStarPalace(chart, "天府");
	if (!ziwei || !tianfu || ziwei.branch !== tianfu.branch) return [];

	// 判定域：同宫的那一宫必须是命宫或迁移宫。
	//
	// ⚠️ 2026-09-26 由「任一同宫皆可」收窄，取 topic 侧（analysis.ts 的 detectGeJu）口径 ——
	// 它只认 `hasStar('命宫'|'迁移', …)`。旧口径下紫府同宫在任何宫都成格（只把未坐命的降为 75），
	// 与 topic 侧实测 44/300 盘判定相反（如紫府坐财帛：这边报格、那边不报）。
	// 代价：紫微天府同宫于它宫时不再产出「紫府同宫」，那类盘在这两处都不再有此格局。
	// ✓ 迁移宫即命宫对宫 —— 与 `palace-relations.ts` 的三方四正偏移表第 4 项同源。
	const inMing = ziwei.branch === chart.soulBranch;
	const inQianYi = ziwei.branch === oppositeBranch(chart.soulBranch);
	if (!inMing && !inQianYi) return [];

	const required = [inMing ? "紫微天府同入命宫" : "紫微天府同入迁移宫（照命，力减）"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	const sanFangSet = sanFangAllStars(chart);
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("左辅右弼同会");
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会昌曲");
	if (hasShaInPalace(ziwei, SHA_KONG)) breaking.push("紫府宫坐空劫（破紫府之贵气）");
	if (shaCountInPalace(ziwei, SHA_HARD) >= 2) breaking.push("紫府宫见双煞同坐");

	const name = "紫府同宫";
	return [{
		name,
		level: inMing && !breaking.length ? 90 : 75,
		palaces: [ziwei.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[inMing ? "紫府同宫·坐命" : "紫府同宫·照命"],
	}];
}

/** 府相朝垣：天府、天相分别坐守命宫的三方四正 */
function detectFuXiangChaoYuan({ chart, ming }: DetectContext): Pattern[] {
	const tianfu = findStarPalace(chart, "天府");
	const tianxiang = findStarPalace(chart, "天相");
	if (!tianfu || !tianxiang) return [];
	if (!isInSanFang(chart, tianfu.branch) || !isInSanFang(chart, tianxiang.branch)) return [];
	if (tianfu.branch === chart.soulBranch && tianxiang.branch === chart.soulBranch) return [];
	if (tianfu.branch === tianxiang.branch) return [];

	const required = ["天府坐命三方", "天相坐命三方", "两星不同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (hasStar(ming, "禄存") || palaceHasMutagen(ming, "禄")) bonus.push("命宫见禄");
	if (sanFangAllStars(chart).has("左辅")) bonus.push("再会左辅");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命宫坐煞星");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("三方四正煞星过多");

	const name = "府相朝垣";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: [tianfu.name, tianxiang.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 阳梁昌禄：太阳+天梁+文昌+禄存四星会命宫，大贵格 */
function detectYangLiangChangLu({ chart }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	if (
		!sanFangSet.has("太阳") ||
		!sanFangSet.has("天梁") ||
		!sanFangSet.has("文昌") ||
		!sanFangSet.has("禄存")
	)
		return [];

	const sun = findStarPalace(chart, "太阳")!;
	const liang = findStarPalace(chart, "天梁")!;
	const required = ["太阳会命宫三方", "天梁会命宫三方", "文昌会命宫三方", "禄存会命宫三方"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (isBright(sun, "太阳")) bonus.push("太阳庙旺");
	if (isBright(liang, "天梁")) bonus.push("天梁庙旺");
	if (sanFangHasMutagen(chart, "科")) bonus.push("再会化科");
	if (isDim(sun, "太阳")) breaking.push("太阳落陷（阳梁失辉）");
	if (sanFangShaCount(chart, SHA_HARD) >= 2) breaking.push("三方煞重");

	const name = "阳梁昌禄";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: [sun.name, liang.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 火贪格 / 铃贪格：贪狼与火星或铃星**同宫**（不含会照） */
function detectHuoTanLingTan({ chart }: DetectContext): Pattern[] {
	const tan = findStarPalace(chart, "贪狼");
	if (!tan) return [];

	// 判定域：火/铃与贪狼**同宫**。
	//
	// ⚠️ 2026-09-26 由「同宫或三方四正会照 + 贪狼须会照命宫三方」收窄，取 topic 侧
	// （analysis.ts 的 detectGeJu）口径 —— 它只要求 `贪狼宫内有火铃`。
	// 旧口径的两个毛病：① 三方四正**不可传递**，`sameOrTrine` 比的是**贪狼的**三方，
	// 而 `isInSanFang` 只约束贪狼本身，于是命中盘里有一部分煞星其实照不到命宫
	// （旧断言实测 32 次命中里 12 次如此）；② 判词写「主突发横财」，但贪狼在命宫三方
	// 之外（如田宅宫）逢火铃也算，与命格无关。
	// 代价：格局不再锚定命宫，贪狼在田宅/夫妻等宫逢火铃同样成格 —— `required` 如实写出这一点。
	//
	// 火铃**同时**同宫于贪狼时只出「火贪格」：沿用 topic 的 `else if` 语义，不并列两条。
	const hasFire = hasStar(tan, "火星");
	const hasLing = hasStar(tan, "铃星");
	if (!hasFire && !hasLing) return [];
	const shaName = hasFire ? "火星" : "铃星";

	const required = [`贪狼与${shaName}同宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (isBright(tan, "贪狼")) bonus.push("贪狼庙旺");
	if (getStarMutagen(tan, "贪狼") === "禄" || getStarMutagen(tan, "贪狼") === "权")
		bonus.push("贪狼化禄/化权");
	if (hasShaInPalace(tan, ["擎羊", "陀罗"])) breaking.push("贪狼宫又见羊陀（破横发之力）");
	if (hasShaInPalace(tan, SHA_KONG)) breaking.push("贪狼遇空劫（财来财去）");

	const name = shaName === "火星" ? "火贪格" : "铃贪格";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: [tan.name],
		conditions: { required, bonus, breaking },
		...fillVerdict(PATTERN_VERDICTS[name], {
			破格: breaking.length ? "本盘破格条件已触发，发力打折。" : "",
		}),
	}];
}

/** 武贪格：武曲+贪狼 同宫（丑、未） 或 对照 */
function detectWuTan({ chart }: DetectContext): Pattern[] {
	const wu = findStarPalace(chart, "武曲");
	const tan = findStarPalace(chart, "贪狼");
	if (!wu || !tan) return [];
	const sameOrOppose = wu.branch === tan.branch || oppositeBranch(wu.branch) === tan.branch;
	if (!sameOrOppose) return [];
	if (!isInSanFang(chart, wu.branch) && !isInSanFang(chart, tan.branch)) return [];

	const required = [
		wu.branch === tan.branch ? "武曲贪狼同宫（丑/未）" : "武曲贪狼对宫拱照",
		"会照命宫三方",
	];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("火星") || sanFangAllStars(chart).has("铃星"))
		bonus.push("再遇火星/铃星（火贪/铃贪叠加）");
	if (getStarMutagen(wu, "武曲") === "禄") bonus.push("武曲化禄");
	if (hasShaInPalace(wu, ["擎羊", "陀罗"])) breaking.push("武贪宫见羊陀");
	if (hasShaInPalace(wu, SHA_KONG)) breaking.push("武贪宫遇空劫");

	const name = "武贪格";
	return [{
		name,
		level: breaking.length ? 75 : 90,
		palaces: [wu.name, tan.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 杀破狼：七杀、破军、贪狼三方齐聚 */
function detectShaPoLang({ chart, ming }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	const has = ["七杀", "破军", "贪狼"].filter(s => sanFangSet.has(s));
	if (has.length < 3) return [];

	const required = ["七杀、破军、贪狼三星齐入命宫三方四正"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangHasMutagen(chart, "禄") || sanFangHasMutagen(chart, "权"))
		bonus.push("三方有化禄或化权（动得有力）");
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("辅弼同会（变动中得贵人）");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("煞星过重（动而无成）");
	if (hasShaInPalace(ming, SHA_KONG)) breaking.push("命坐空劫（动得辛苦）");

	const name = "杀破狼";
	return [{
		name,
		level: breaking.length ? 40 : 75,
		palaces: getSurroundPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	}];
}

/** 机月同梁：天机、太阴、天同、天梁会入命宫三方四正（四星齐为上格，只齐三星为不全格） */
function detectJiYueTongLiang({ chart, ming }: DetectContext): Pattern[] {
	const sanFangSet = sanFangAllStars(chart);
	const has = ["天机", "太阴", "天同", "天梁"].filter(s => sanFangSet.has(s));
	if (has.length < 3) return [];

	// 「四星齐」与「恰好三星」原是两个格局名（机月同梁 / 机月同梁三星会），2026-09-26 合并为一个：
	// 判定域放宽到 `>= 3`，缺星时把「不全格」记进 breaking 并把 level 降为 60。
	//
	// ⚠️ 域是**三方四正**（含迁移宫），不是「命宫三方」—— topic 侧的 detectGeJu 用的是三方
	// （`[m, m+4, m+8]`），但那会丢掉全部三星盘：实测四星落在命宫三方的个数恒为 **0/1/2/4**
	// （永不为 3），故 topic 侧的 ≥3 与「三方四正四星齐」在 300 条基准上是**同一组 26 盘**。
	// 也就说那 55 张三星盘本来就是 analyze 独有的降级覆盖，topic 从不报它们、无矛盾可消；
	// 照 topic 的域收窄只会让这 55 盘彻底没有机月同梁。此处取并集（26 + 55 = 81 盘）。
	const full = has.length === 4;
	const required = [
		`${has.join("、")}会入命宫三方四正${full ? "（四星齐）" : `（四星中 ${has.length} 星）`}`,
	];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会昌曲");
	if (sanFangHasMutagen(chart, "科")) bonus.push("再会化科");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("煞星过多（机月同梁忌煞）");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命宫坐煞");
	if (!full) breaking.push(`三方四正只齐 ${has.length} 星（机月同梁不全格）`);

	const name = "机月同梁";
	return [{
		name,
		level: full ? (breaking.length ? 75 : 90) : 60,
		palaces: getSurroundPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: { required, bonus, breaking },
		...fillVerdict(PATTERN_VERDICTS[full ? "机月同梁·满格" : "机月同梁·不全格"], {
			星: has.join("、"),
		}),
	}];
}

export const SHANG_GE: ReadonlyArray<Detector> = [
	detectJunChenQingHui,
	detectZiFu,
	detectFuXiangChaoYuan,
	detectYangLiangChangLu,
	detectHuoTanLingTan,
	detectWuTan,
	detectShaPoLang,
	detectJiYueTongLiang,
];
