/**
 * 基本信息专题（--info）—— 出生时刻 / 农历 / 四柱 / 命盘骨架面板，含农历中文数字 helper。
 */

import type { ZiweiChart } from "@/types";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { surroundNames } from "../chart/render";
import { Solar } from "lunar-typescript";

/**
 * 农历月 → 中文月名。
 *
 * @param m - 农历月 1–12
 * @returns 正月 / 二月 / … / 十月 / **冬月** / **腊月**（十一月、十二月的传统叫法）
 */
function lunarMonthCN(m: number): string {
	return (
		[
			"正月",
			"二月",
			"三月",
			"四月",
			"五月",
			"六月",
			"七月",
			"八月",
			"九月",
			"十月",
			"冬月",
			"腊月",
		][m - 1] ?? `${m}月`
	);
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
	if (d <= 10) {
		return `初${ones[d - 1]}`;
	}
	if (d < 20) {
		return `十${ones[d - 11]}`;
	}
	if (d === 20) {
		return "二十";
	}
	if (d < 30) {
		return `廿${ones[d - 21]}`;
	}
	return "三十";
}

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
 * `--info`：基本信息专题 —— 姓名 / 性别 / 公历生日 / 经度 / 钟表与真太阳时 / 农历 /
 * 节气与非节气四柱 / 五行局 / 命盘类型 / 命宫身宫紫微 / 三方四正 / 命主身主斗君。
 *
 * @param chart - 命盘
 * @param opts - 出生时刻展示串
 *
 * @remarks
 * 面板行集：公历生日与姓名，命宫 / 紫微落 / 三方四正（身宫与命宫同行，避免重复）。
 *
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
		...(bi.name ? [`姓名 : ${bi.name}`] : []),
		`性别 : ${bi.gender === "male" ? "男" : "女"}`,
		`公历生日 : ${bi.year}-${String(bi.month).padStart(2, "0")}-${String(bi.day).padStart(2, "0")}`,
		`地理经度 : ${opts.longitude.toFixed(3)}`,
		`钟表时间 : ${opts.clockTime ?? "未给（按 --branch 时辰排盘）"}`,
		`真太阳时 : ${opts.solarNote}`,
		`农历时间 : ${nongLi}`,
		...pillars,
		`五行局数 : ${chart.fiveElementsClassName}`,
		"命盘类型 : 三合盘(天盘)",
		`命宫:${BRANCHES[chart.soulBranch]} · 身宫:${BRANCHES[chart.bodyBranch]} · 紫微落:${BRANCHES[chart.ziweiPos]}`,
		`三方四正:${surroundNames(chart, chart.soulBranch).join("/")}`,
		`身主:${chart.shenZhu}; 命主:${chart.mingZhu}; 子年斗君:${BRANCHES[chart.douJunBranch]}`,
		"（注：四柱仅为出生时刻记录，本技能不做八字论命。）",
	];
}
