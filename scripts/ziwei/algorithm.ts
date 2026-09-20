/**
 * 紫微斗数排盘算法 —— 基于 {@link https://github.com/SylarLong/iztro | iztro}。
 *
 * 本模块是 iztro 与本项目领域模型之间的**唯一翻译层**：安星、五行局、大限区间全部由
 * iztro 推算，这里只负责换算宫名口径、分类星曜、补借对宫字段，不重复实现任何命理逻辑。
 *
 * @packageDocumentation
 */

import { astro } from "iztro";
import { Solar } from "lunar-typescript";
import type { BirthInfo, LunarInfo, Star, Palace, DaXian, DaXianSiHua, ZiweiChart } from "./types";
import { BRANCHES, STEMS, IZTRO_TO_PROJECT_PALACE } from "./constants";
// 飞星派工具仅供导出，不再在排盘时调用（倪师《天纪 03》：四化星永远固定不动）
// import { detectSelfSihua, getSiHuaByStem } from './sihua';

// ─── 宫名口径 ────────────────────────────────────────────────────
/**
 * 把 iztro 的宫名翻成本项目口径（倪师《天纪》体系）。
 *
 * iztro 第 8 宫叫「仆役」，倪师体系叫「交友宫」；其余 11 宫只是统一补上「宫」字。
 *
 * @param iztroName - iztro 返回的原始宫名
 * @returns 本项目口径的宫名
 * @throws 当 `IZTRO_TO_PROJECT_PALACE` 未覆盖该宫名时
 *
 * @remarks
 * 映射表在 `constants.ts` 的 `IZTRO_TO_PROJECT_PALACE`。
 *
 * ⚠️ 未命中时**抛错，不回退到原名**。回退看着更「稳」，其实是让一个未知宫名静默
 * 流进输出 —— 而宫名是十二宫一览、`--focus`、三方四正、大限、格局判定的公共索引，
 * 错一个名字就是错一片下游。这与 `purple-star.ts` 顶部 `REQUIRED_EXPORTS` 自检
 * 是同一个理念：**宁可启动失败，也不静默产出错盘**。
 */
function projectPalaceName(iztroName: string): string {
	const mapped = IZTRO_TO_PROJECT_PALACE[iztroName];
	if (!mapped) {
		throw new Error(
			`未知的 iztro 宫名「${iztroName}」—— IZTRO_TO_PROJECT_PALACE 未覆盖。` +
				`若 iztro 改了宫名口径，请同步 scripts/ziwei/constants.ts 的映射表` +
				`（并同步 PALACE_NAMES_ORDER 与 test/lib/compare.mjs 的说明）。`
		);
	}
	return mapped;
}

// ─── 农历信息（兼容保留）────────────────────────────────────────
/**
 * 由公历日期取农历信息。
 *
 * @param year - 公历年
 * @param month - 公历月（1–12）
 * @param day - 公历日
 * @returns 农历年月日、年干支索引、是否闰月
 *
 * @remarks
 * 只服务输出层展示与 {@link generateChart} 里虚岁的农历年换算，**不参与安星**
 * （iztro 的排盘入参本身就是公历）。
 *
 * `lunar-typescript` 用**负数月份**表示闰月，故月份取 `Math.abs` 后另以
 * `isLeapMonth` 单独标记。年干支靠 `indexOf` 查表，未命中兜底 0（甲 / 子）。
 */
export function getLunarInfo(year: number, month: number, day: number): LunarInfo {
	const solar = Solar.fromYmd(year, month, day);
	const lunar = solar.getLunar();
	const yearStem = STEMS.indexOf(lunar.getYearGan());
	const yearBranch = BRANCHES.indexOf(lunar.getYearZhi());
	const rawMonth = lunar.getMonth();
	return {
		lunarYear: lunar.getYear(),
		lunarMonth: Math.abs(rawMonth),
		lunarDay: lunar.getDay(),
		yearStem: yearStem >= 0 ? yearStem : 0,
		yearBranch: yearBranch >= 0 ? yearBranch : 0,
		isLeapMonth: rawMonth < 0,
	};
}

// ─── 亮度映射 ────────────────────────────────────────────────────
/**
 * 把 iztro 的中文亮度归并成三档。
 *
 * @param b - iztro 的亮度字（「庙」「旺」「得」「利」「平」「不」「陷」等），可缺省
 * @returns `bright`（庙 / 旺）、`dim`（陷 / 不），其余一切（含缺省）归 `normal`
 *
 * @remarks
 * 只归三档，是因为下游只问「够不够亮」这一个问题（`patterns.ts` 的 `isBright` / `isDim`）；
 * 「得 / 利 / 平」的细分差异在倪师体系里不进格局条件。
 *
 * ⚠️ 缺省值走 `normal` 而非 `dim` —— 拿不到亮度时不做负面假设。
 */
function mapBrightness(b?: string): "bright" | "normal" | "dim" {
	if (!b) return "normal";
	if (b === "庙" || b === "旺") return "bright";
	if (b === "陷" || b === "不") return "dim";
	return "normal";
}

// ─── 星曜类型映射 ────────────────────────────────────────────────
/**
 * 煞星名单。
 *
 * @remarks
 * 与 {@link LUCKY_STARS} 同为 {@link mapStarType} 的**硬编码优先名单**：名字在表内
 * 就先定类型，不再看 iztro 的 `type` 字段（判定顺序见该函数）。
 *
 * ⚠️ 改这张表会改变 `Star.type`，进而改变 `patterns.ts` 的格局命中 ——
 * `npm test` 的语料回归盯着这条链路，别顺手加星。
 */
const SHA_STARS = new Set([
	"擎羊",
	"陀罗",
	"火星",
	"铃星",
	"地空",
	"地劫",
	"天空",
	"旬空",
	"截路",
	"大耗",
	"天使",
	"天伤",
]);
/**
 * 吉星名单。
 *
 * @remarks
 * 与 {@link SHA_STARS} 同为 {@link mapStarType} 的**硬编码优先名单**。两表**不重叠**，
 * 顺序上煞星先判 —— 若将来往两表里加同名星，`sha` 会赢。
 *
 * ⚠️ 同 {@link SHA_STARS}：改表即改格局命中，`npm test` 会盯着。
 */
const LUCKY_STARS = new Set([
	"文昌",
	"文曲",
	"左辅",
	"右弼",
	"天魁",
	"天钺",
	"禄存",
	"天马",
	"天官",
	"天福",
	"天才",
	"天寿",
	"三台",
	"八座",
	"恩光",
	"天贵",
	"台辅",
	"龙池",
	"凤阁",
	"红鸾",
	"天喜",
	"孤辰",
	"寡宿",
]);

/**
 * 判定星曜类型。
 *
 * @param starName - 星曜中文名
 * @param iztroType - iztro 给的 `type` 字段（「主星」「煞星」「吉星」「禄存」「天马」等）
 * @returns `Star["type"]`，取值为 `major` / `sha` / `lucky` / `minor`
 *
 * @remarks
 * 判定优先级从高到低：
 * 1. 名字命中 {@link SHA_STARS} → `sha`
 * 2. 名字命中 {@link LUCKY_STARS} → `lucky`
 * 3. iztro 的 `type`（转小写后比对，中英文皆认）→ 对应类型
 * 4. 兜底 `minor`
 *
 * 前两级先看名字，是 {@link SHA_STARS} 那张表存在的理由。注意 `major` **只能**由
 * iztro 的 `type` 给出 —— 两张名单里没有主星。
 */
function mapStarType(starName: string, iztroType: string): Star["type"] {
	if (SHA_STARS.has(starName)) return "sha";
	if (LUCKY_STARS.has(starName)) return "lucky";
	const t = (iztroType ?? "").toLowerCase();
	if (t === "主星" || t === "major") return "major";
	if (t === "煞星" || t === "tough") return "sha";
	if (t === "吉星" || t === "soft" || t === "禄存" || t === "天马") return "lucky";
	return "minor";
}

// ─── 五行局名称 → 数字 ──────────────────────────────────────────
/**
 * 从五行局名解析出局数。
 *
 * @param name - iztro 给的五行局名，如「水二局」「木三局」
 * @returns 局数 2–6
 *
 * @remarks
 * 靠**中文数字**匹配，故 iztro 若改用阿拉伯数字（「水2局」）会整片落到兜底值。
 *
 * ⚠️ 兜底返回 3（木三局）而**不抛错** —— 与 {@link projectPalaceName} 的严格口径相反。
 * 差别在于局数不参与安星（安星由 iztro 完成，此值只随盘输出），猜错的代价低于中断排盘；
 * 宫名则是下游一切索引的键，错不起。
 */
function parseWuxingJu(name: string): number {
	if (name.includes("二")) return 2;
	if (name.includes("三")) return 3;
	if (name.includes("四")) return 4;
	if (name.includes("五")) return 5;
	if (name.includes("六")) return 6;
	return 3;
}

// ─── 主函数：生成命盘 ────────────────────────────────────────────
/**
 * 生成紫微斗数命盘。
 *
 * @param birthInfo - 出生信息。⚠️ `hour` 是**时辰序号 0–12**（0=子 … 11=亥，12=晚子时），
 *   **不是** 0–23 的钟表时；钟表时到时辰序号的换算（含真太阳时校正）在 `cli/birth-info.ts` 完成
 * @returns 完整命盘。`palaces` 按**地支数组序**排列（寅起），比对时按 `branch` 建索引
 * @throws 当 iztro 返回未知宫名时（见 {@link projectPalaceName}）
 *
 * @remarks
 * **只做组装、不做推算**：调 iztro 排盘 → 逐宫翻译宫名与星曜 → 算虚岁与当前大限
 * → 补借对宫字段。命理逻辑一律不在此处重复实现。
 *
 * **大限四化已主动下线**：不再生成 `daXians[].siHua` / `stemIndex`（飞星派口径）。
 * 体系立场见 `.claude/CLAUDE.md` 与 `SKILL.md`。
 *
 * @example
 * ```ts
 * // hour: 5 = 巳时；务必先经 buildBirthInfo 把钟表时换算成时辰序号
 * const chart = generateChart({ year: 1990, month: 5, day: 15, hour: 5, gender: "male" });
 * const ming = chart.palaces.find(p => p.isMingGong);
 * ```
 */
export function generateChart(birthInfo: BirthInfo): ZiweiChart {
	const { year, month, day, hour, gender } = birthInfo;

	// 调用 iztro 排盘
	const solarDate = `${year}-${month}-${day}`;
	const iztroGender = gender === "male" ? "男" : "女";
	const astrolabe = astro.bySolar(solarDate, hour, iztroGender, true, "zh-CN");

	// ── 组装十二宫 ──
	const palaces: Palace[] = astrolabe.palaces.map(p => {
		const branch = BRANCHES.indexOf(p.earthlyBranch as string);
		const stem = STEMS.indexOf(p.heavenlyStem as string);

		// 合并所有星：主星 + 次星 + 杂耀
		const allStars: Star[] = [
			...(p.majorStars ?? []).map(s => ({
				name: s.name as string,
				type: "major" as const,
				brightness: mapBrightness(s.brightness as string),
				siHua: s.mutagen as Star["siHua"],
			})),
			...(p.minorStars ?? []).map(s => ({
				name: s.name as string,
				type: mapStarType(s.name as string, s.type as string),
				siHua: s.mutagen as Star["siHua"],
			})),
			...(p.adjectiveStars ?? []).map(s => ({
				name: s.name as string,
				type: "minor" as const,
				siHua: s.mutagen as Star["siHua"],
			})),
		];

		const range = p.decadal?.range;
		return {
			branch: branch >= 0 ? branch : 0,
			stem: stem >= 0 ? stem : 0,
			name: projectPalaceName(p.name as string),
			stars: allStars,
			daXianAge: range ? ([range[0], range[1]] as [number, number]) : undefined,
			isMingGong: p.name === "命宫",
			isShenGong: p.isBodyPalace ?? false,
			isCurrentDaXian: false,
		};
	});

	// ── 农历信息 ──
	const lunarInfo = getLunarInfo(year, month, day);

	// ── 当前年龄 & 大限 ──
	// currentAge 是**虚岁**，与 daXianAge / daXians[].startAge 同域（倪师《天纪》亦用虚岁）。
	// 以农历年（正月初一）为界，不是生日、也不是立春 —— 与 iztro 的默认口径
	// `ageDivide: 'normal'` 逐字对应（见 iztro/lib/astro/FunctionalAstrolabe.js）：
	//     nominalAge = 目标日农历年 − 出生农历年 + 1
	// ⚠️ 不可写成 `new Date().getFullYear() - year`（那是周岁）。两者域不同会让
	//    currentAge 偏 1~2 岁，并连带 currentDaXianIndex / palace.isCurrentDaXian 错位，
	//    最坏情况是把**上一个大限的宫**当成当前大限整宫详批。
	const now = new Date();
	const todayLunarYear = getLunarInfo(now.getFullYear(), now.getMonth() + 1, now.getDate()).lunarYear;
	const currentAge = todayLunarYear - lunarInfo.lunarYear + 1;

	palaces.forEach(p => {
		if (p.daXianAge && currentAge >= p.daXianAge[0] && currentAge <= p.daXianAge[1]) {
			p.isCurrentDaXian = true;
		}
	});

	// ── 借对宫结构化字段（codex P0：避免文案层从自然语言反查借宫信息）──
	palaces.forEach(p => {
		p.oppositeBranch = (p.branch + 6) % 12;
		const mainStars = p.stars.filter(s => s.type === "major");
		p.isEmpty = mainStars.length === 0;
		if (p.isEmpty) {
			const oppPalace = palaces.find(q => q.branch === p.oppositeBranch);
			if (oppPalace) {
				p.borrowedFromBranch = oppPalace.branch;
				p.borrowedFromName = oppPalace.name;
				p.borrowedStars = oppPalace.stars.filter(s => s.type === "major").map(s => s.name);
			}
		}
	});

	// ── 关键宫支 ──
	const mingGongBranch = BRANCHES.indexOf(astrolabe.earthlyBranchOfSoulPalace as string);
	const shenGongBranch = BRANCHES.indexOf(astrolabe.earthlyBranchOfBodyPalace as string);
	const wuxingJuName = astrolabe.fiveElementsClass as string;
	const wuxingJu = parseWuxingJu(wuxingJuName);

	// ── 紫微星位置 ──
	const ziweiPalace = palaces.find(p =>
		p.stars.some(s => s.name === "紫微" && s.type === "major")
	);
	const ziweiPos = ziweiPalace?.branch ?? 0;

	// ── 大限数组（倪师《天纪》正统：四化永远固定，大限只看宫位移动）──
	// 不再生成 daXians[].siHua / stemIndex / stemName（飞星派字段已下线）
	const daXians: DaXian[] = palaces
		.filter(p => p.daXianAge)
		.sort((a, b) => a.daXianAge![0] - b.daXianAge![0])
		.map(p => ({
			startAge: p.daXianAge![0],
			endAge: p.daXianAge![1],
			palaceBranch: p.branch,
			palaceName: p.name,
		}));

	// 宫干自化已下线（倪师不主张飞星派宫干自化论）

	const currentDaXianIndex = daXians.findIndex(
		dx => currentAge >= dx.startAge && currentAge <= dx.endAge
	);

	return {
		birthInfo,
		lunarInfo,
		mingGongBranch: mingGongBranch >= 0 ? mingGongBranch : 0,
		shenGongBranch: shenGongBranch >= 0 ? shenGongBranch : 0,
		wuxingJu,
		wuxingJuName,
		ziweiPos,
		palaces,
		daXians,
		currentAge,
		currentDaXianIndex,
	};
}
