/**
 * 紫微斗数排盘算法 —— iztro 与本项目领域模型之间的**唯一翻译层**：安星、五行局、大限区间
 * 全部由 iztro 推算，这里只换算宫名口径、分类星曜、补借对宫字段，不重复实现命理逻辑。
 *
 * 逐段组装纪律（换年口径锁、宫名口径、亮度塌缩、星曜名单、虚岁、斗君）见
 * docs/code/chart-kernel.md。
 *
 * @packageDocumentation
 */

import { astro } from "iztro";

// 换年口径显式锁：`normal` = 以农历正月初一为界换年（虚岁口径）。
// iztro 2.6.1 的默认值恰是它，但「恰好等于默认」是隐式契约 —— 库改默认、或任何
// 代码误动全局配置，都会把流年/虚岁基准静默滑到「以立春为界」（exact），
// 排出的盘农历年错位、生年四化全变。在此显式声明，使口径不随默认值漂移。
astro.config({ yearDivide: "normal" });
import { Solar } from "lunar-typescript";
import type { BirthInfo, LunarInfo, Star, Palace, Decadal, ZiweiChart } from "./types";
import { BRANCHES, STEMS, IZTRO_TO_PROJECT_PALACE } from "@/data/ganzhi";
import { ELEMENT_TO_JU } from "@/data/wuxing";
import { oppositeBranch } from "./palace-relations";
import { wenmoStarBrightness } from "./wenmo-brightness";
// 飞星派工具仅供导出，不再在排盘时调用（倪师《天纪 03》：四化星永远固定不动）
// import { detectSelfSihua, getMutagenByStem } from './mutagen';

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
 * 映射表在 `data/ganzhi.ts` 的 `IZTRO_TO_PROJECT_PALACE`。
 *
 * ⚠️ 未命中时**抛错，不回退到原名** —— 宫名是十二宫一览、`--focus`、三方四正、大限、
 *    格局判定的公共索引，错一个名字就是错一片下游。理由见 docs/code/chart-kernel.md。
 */
function projectPalaceName(iztroName: string): string {
	const mapped = IZTRO_TO_PROJECT_PALACE[iztroName];
	if (!mapped) {
		throw new Error(
			`未知的 iztro 宫名「${iztroName}」—— IZTRO_TO_PROJECT_PALACE 未覆盖。` +
				`若 iztro 改了宫名口径，请同步 scripts/data/ganzhi.ts 的映射表` +
				`（并同步 PALACE_NAMES_ORDER 与 test/lib/compare.ts 的说明）。`
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
 * 把中文亮度字归并成三档。
 *
 * @param b - 亮度字（iztro 的「庙旺得利平不陷」或文墨 SB 表的「庙旺得利平不闲陷」），可缺省
 * @returns `bright`（庙 / 旺）、`dim`（陷 / 不 / 闲），其余一切（含缺省）归 `normal`
 *
 * @remarks
 * 只归三档，是因为下游只问「够不够亮」（`patterns/helpers.ts` 的 `isBright` / `isDim`）；
 * 文墨 5 档制的「闲」归 `dim`（比「不」还弱半档）。
 *
 * ⚠️ 缺省值走 `normal` 而非 `dim` —— 拿不到亮度时不做负面假设（见 docs/code/chart-kernel.md）。
 */
function mapBrightness(b?: string): "bright" | "normal" | "dim" {
	if (!b) {
		return "normal";
	}
	if (b === "庙" || b === "旺") {
		return "bright";
	}
	if (b === "陷" || b === "不" || b === "闲") {
		return "dim";
	}
	return "normal";
}

// ─── 星曜类型映射 ────────────────────────────────────────────────
/**
 * 煞星名单。
 *
 * @remarks
 * 与 {@link SOFT_STARS} 同为 {@link mapStarType} 的**硬编码优先名单**：名字在表内就先定类型，
 * 不再看 iztro 的 `type` 字段。
 *
 * ⚠️ 改这张表会改变 `Star.type`，进而改变 `patterns/` 的格局命中 —— 别顺手加星
 *    （`npm test` 的语料回归盯着这条链路，见 docs/code/chart-kernel.md）。
 */
const TOUGH_STARS = new Set([
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
 * 与 {@link TOUGH_STARS} 同为 {@link mapStarType} 的**硬编码优先名单**。两表**不重叠**，
 * 顺序上煞星先判（将来加同名星则 `tough` 赢）。
 *
 * ⚠️ 同 {@link TOUGH_STARS}：改表即改格局命中，`npm test` 会盯着（见 docs/code/chart-kernel.md）。
 */
const SOFT_STARS = new Set([
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
 * @returns `Star["type"]`，取值为 `major` / `tough` / `soft` / `minor`
 *
 * @remarks
 * 判定优先级从高到低：
 * 1. 名字命中 {@link TOUGH_STARS} → `tough`
 * 2. 名字命中 {@link SOFT_STARS} → `soft`
 * 3. iztro 的 `type`（转小写后比对，中英文皆认）→ 对应类型
 * 4. 兜底 `minor`
 *
 * 前两级先看名字，是 {@link TOUGH_STARS} 那张表存在的理由。注意 `major` **只能**由
 * iztro 的 `type` 给出 —— 两张名单里没有主星。
 */
function mapStarType(starName: string, iztroType: string): Star["type"] {
	if (TOUGH_STARS.has(starName)) {
		return "tough";
	}
	if (SOFT_STARS.has(starName)) {
		return "soft";
	}
	const t = (iztroType ?? "").toLowerCase();
	if (t === "主星" || t === "major") {
		return "major";
	}
	if (t === "煞星" || t === "tough") {
		return "tough";
	}
	if (t === "吉星" || t === "soft" || t === "禄存" || t === "天马") {
		return "soft";
	}
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
 * 取**首字五行**查 {@link ELEMENT_TO_JU}（水二 / 木三 / 金四 / 土五 / 火六），免疫写法变更
 * （「水二局」/「水2局」同结果）。
 *
 * ⚠️ 兜底返回 3（木三局）而**不抛错** —— 与 {@link projectPalaceName} 相反：局数不参与安星，
 *    猜错的代价低于中断排盘；宫名则是下游一切索引的键，错不起（见 docs/code/chart-kernel.md）。
 */
export function parseWuxingJu(name: string): number {
	// 显式标注 `| undefined`：Record 索引签名在 tsc 眼里恒为 number，
	// 不标就掩盖了「查不到」这条真实路径（缺了它，下面的兜底看着像多余的代码）。
	const ju: number | undefined = ELEMENT_TO_JU[name.charAt(0)];
	return ju ?? 3;
}

// ─── 主函数：生成命盘 ────────────────────────────────────────────
/**
 * 生成紫微斗数命盘。
 *
 * @param birthInfo - 出生信息。⚠️ `timeIndex` 是**时辰序号 0–12**（0=子 … 11=亥，12=晚子时），
 *   **不是** 0–23 的钟表时；钟表时到时辰序号的换算（含真太阳时校正）在 `cli/birth/birth-info.ts` 完成
 * @returns 完整命盘。`palaces` 按**地支数组序**排列（寅起），比对时按 `branch` 建索引
 * @throws 当 iztro 返回未知宫名时（见 {@link projectPalaceName}）
 *
 * @remarks
 * **只做组装、不做推算**：调 iztro 排盘 → 逐宫翻译宫名与星曜 → 算虚岁与当前大限
 * → 补借对宫字段。**大限四化已主动下线**（不再生成 `decadals[].mutagen` / `stemIndex`）。
 * 各步纪律见 docs/code/chart-kernel.md；体系立场见仓库根 `CLAUDE.md` 与 `SKILL.md`。
 *
 * @example
 * ```ts
 * // timeIndex: 5 = 巳时；务必先经 buildBirthInfo 把钟表时换算成时辰序号
 * const chart = generateChart({ year: 1990, month: 5, day: 15, timeIndex: 5, gender: "male" });
 * const ming = chart.palaces.find(p => p.isSoulPalace);
 * ```
 */
export function generateChart(birthInfo: BirthInfo): ZiweiChart {
	const { year, month, day, timeIndex, gender } = birthInfo;

	// 调用 iztro 排盘
	const solarDate = `${year}-${month}-${day}`;
	const iztroGender = gender === "male" ? "男" : "女";
	const astrolabe = astro.bySolar(solarDate, timeIndex, iztroGender, true, "zh-CN");

	// ── 组装十二宫 ──
	const palaces: Palace[] = astrolabe.palaces.map(p => {
		const branch = BRANCHES.indexOf(p.earthlyBranch as string);
		const stem = STEMS.indexOf(p.heavenlyStem as string);
		// branch / stem 是下游一切索引的键，查表失败静默兜底 0 会出现「两宫同指子位」且零信号
		// —— 宁可当场失败，也不静默产出错盘（完整纪律见 docs/code/chart-kernel.md）。
		if (branch < 0 || stem < 0) {
			throw new Error(
				`未知的 iztro 天干地支「${p.heavenlyStem}${p.earthlyBranch}」（宫名 ${p.name}）—— ` +
					`内核输出已损坏，请核对 iztro 版本是否变更了干支口径`
			);
		}

		// 合并所有星：主星 + 次星 + 杂耀。亮度走文墨 SB 表覆写（混合口径，XD2 默认）：
		// 命中 → 细档塌缩 + brightnessRaw 记中文；未收录 / 留白 → 主星回落 iztro 原值、
		// 辅杂曜不带亮度（口径见 docs/code/chart-kernel.md）。
		const allStars: Star[] = [
			...(p.majorStars ?? []).map(s => {
				const raw = wenmoStarBrightness(s.name as string, branch);
				return {
					name: s.name as string,
					type: "major" as const,
					brightness: raw ? mapBrightness(raw) : mapBrightness(s.brightness as string),
					brightnessRaw: raw,
					mutagen: s.mutagen as Star["mutagen"],
				};
			}),
			...(p.minorStars ?? []).map(s => {
				const raw = wenmoStarBrightness(s.name as string, branch);
				return {
					name: s.name as string,
					type: mapStarType(s.name as string, s.type as string),
					brightness: raw ? mapBrightness(raw) : undefined,
					brightnessRaw: raw,
					mutagen: s.mutagen as Star["mutagen"],
				};
			}),
			...(p.adjectiveStars ?? []).map(s => {
				const raw = wenmoStarBrightness(s.name as string, branch);
				return {
					name: s.name as string,
					type: "minor" as const,
					brightness: raw ? mapBrightness(raw) : undefined,
					brightnessRaw: raw,
					mutagen: s.mutagen as Star["mutagen"],
				};
			}),
		];

		const range = p.decadal?.range;
		return {
			branch,
			stem,
			name: projectPalaceName(p.name as string),
			stars: allStars,
			decadalRange: range ? ([range[0], range[1]] as [number, number]) : undefined,
			// 小限岁数表：iztro 按生年支与性别推定每宫所辖虚岁，此处原样提取不重复实现
			ages: (p.ages as number[] | undefined) ?? [],
			isSoulPalace: p.name === "命宫",
			isBodyPalace: p.isBodyPalace ?? false,
			isCurrentDecadal: false,
		};
	});

	// ── 农历信息 ──
	const lunarInfo = getLunarInfo(year, month, day);

	// ── 当前年龄 & 大限 ──
	// currentAge 是**虚岁**（以农历年正月初一为界，与 decadals[].startAge 同域），
	// 对应 iztro 的 `ageDivide: 'normal'`：nominalAge = 目标日农历年 − 出生农历年 + 1。
	// ⚠️ 不可写成 `new Date().getFullYear() - year`（那是周岁）：域不同会连带
	//    currentDecadalIndex 错位，最坏把**上一个大限**当成当前大限整宫详批
	//    （论证见 docs/code/chart-kernel.md）。
	const now = new Date();
	const todayLunarYear = getLunarInfo(
		now.getFullYear(),
		now.getMonth() + 1,
		now.getDate()
	).lunarYear;
	const currentAge = todayLunarYear - lunarInfo.lunarYear + 1;

	palaces.forEach(p => {
		if (p.decadalRange && currentAge >= p.decadalRange[0] && currentAge <= p.decadalRange[1]) {
			p.isCurrentDecadal = true;
		}
	});

	// ── 借对宫结构化字段（codex P0：避免文案层从自然语言反查借宫信息）──
	// 对宫算式取自 `./palace-relations` —— 全仓对宫偏移的单点，本字段与它同源。
	palaces.forEach(p => {
		p.oppositeBranch = oppositeBranch(p.branch);
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
	const soulBranch = BRANCHES.indexOf(astrolabe.earthlyBranchOfSoulPalace as string);
	const bodyBranch = BRANCHES.indexOf(astrolabe.earthlyBranchOfBodyPalace as string);
	// 命宫 / 身宫地支必在十二宫内（排盘不变量）；查不到即内核输出已损坏，当场报错而非兜底 0
	// （理由同上方宫循环的干支校验，见 docs/code/chart-kernel.md）。
	if (soulBranch < 0 || bodyBranch < 0) {
		throw new Error(
			`命宫/身宫地支不在十二支内（命宫=${astrolabe.earthlyBranchOfSoulPalace}，` +
				`身宫=${astrolabe.earthlyBranchOfBodyPalace}）—— 内核输出已损坏`
		);
	}
	const fiveElementsClassName = astrolabe.fiveElementsClass as string;
	const fiveElementsClass = parseWuxingJu(fiveElementsClassName);

	// ── 紫微星位置 ──
	const ziweiPalace = palaces.find(p =>
		p.stars.some(s => s.name === "紫微" && s.type === "major")
	);
	// 紫微必上盘（安星法的锚点），找不到即内核输出已损坏 —— 兜底 0 会静默指向子位错盘
	if (!ziweiPalace) {
		throw new Error("紫微星不在任何宫位 —— 内核输出已损坏，无法定位紫微");
	}
	const ziweiPos = ziweiPalace.branch;

	// ── 大限数组（倪师《天纪》正统：四化永远固定，大限只看宫位移动）──
	// 不再生成 decadals[].mutagen / stemIndex / stemName（飞星派字段已下线）
	const decadals: Decadal[] = palaces
		.filter(p => p.decadalRange)
		.sort((a, b) => a.decadalRange![0] - b.decadalRange![0])
		.map(p => ({
			startAge: p.decadalRange![0],
			endAge: p.decadalRange![1],
			palaceBranch: p.branch,
			palaceName: p.name,
		}));

	// ── 命主 / 身主 / 子年斗君 ──
	// 命主身主：iztro 由命/身宫地支查表定星，原样取用（不重复实现查表）
	const mingZhu = astrolabe.soul as string;
	const shenZhu = astrolabe.body as string;
	// 斗君：子起正月逆数至生月，生月宫起子时顺数至生时。iztro 静态盘不带，故按口诀自推
	// （闰月按所闰之月数计；晚子时按子时论 %12）。校准样例见 docs/code/chart-kernel.md
	// 与 cli/selftest/index.ts。
	const douJunBranch = ((timeIndex % 12) + 12 - (lunarInfo.lunarMonth - 1)) % 12;

	// 宫干自化已下线（倪师不主张飞星派宫干自化论）

	const currentDecadalIndex = decadals.findIndex(
		dx => currentAge >= dx.startAge && currentAge <= dx.endAge
	);

	return {
		birthInfo,
		lunarInfo,
		soulBranch,
		bodyBranch,
		fiveElementsClass,
		fiveElementsClassName,
		ziweiPos,
		palaces,
		decadals,
		mingZhu,
		shenZhu,
		douJunBranch,
		currentAge,
		currentDecadalIndex,
	};
}
