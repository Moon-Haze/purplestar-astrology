/**
 * 基本信息专题（--info）：出生时刻 / 农历 / 四柱 / 命盘骨架面板 + 农历数字 helper。
 */

import type { ZiweiChart } from "@/types";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { surroundNames } from "../chart/render";
import { Solar } from "lunar-typescript";

/**
 * 农历月 → 中文月名。
 *
 * @param m - 农历月 1–12
 * @returns 正月 / 二月 / … / 十月 / **冬月** / **腊月**（即十一 / 十二月）
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
 *
 * @returns 中文日名（`一`–`十` 加「初」，`二十` 单列，`廿一`–`廿九`）
 *
 * 口径：≤10「初X」，11–19「X十X」即「十一…十九」，21–29「廿」。
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
 * `--info` 输入：出生时刻**展示串**（调用方从 `buildBirthInfo` 结果拼；本模块不解析钟表时，归 `birth-info.ts`）。
 */
export interface InfoClockOpts {
	/** 钟表原文（如 `"2000-4-6 0:15"`）；`--branch` 直按时辰排盘时为 null */
	clockTime: string | null;
	/** 真太阳时说明（`buildBirthInfo` note：钟表 → 校正量 → 时辰链） */
	solarNote: string;
	/** 采用经度（东经为正；未给出生地时 120） */
	longitude: number;
}

/**
 * `--info` 基本信息专题：姓名 / 性别 / 生日 / 经度 / 钟表与真太阳时 / 农历 / 四柱两口径 / 五行局 / 命盘类型 / 命宫身宫紫微 / 三方四正 / 命主身主斗君。
 *
 * @param chart - 命盘
 * @param opts - 出生时刻展示串
 *
 * @remarks
 *
 * @returns 面板输出行（+ 四柱两口径）；只拼行，未 `join`
 *
 * 行集：命宫 / 紫微落 / 三方四正（身宫与命宫同行去重）。
 *
 * 四柱由 `lunar-typescript` 现算：节气口径 = `getEightChar()`（立春分年、节气分月）；非节气口径 = 正月初一分年 + 农历月柱。⚠️ 四柱仅为出生时刻记录，本技能不做八字论命 —— SKILL.md 红线拦八字解读，不拦出生数据展示。
 */
export function infoSection(chart: ZiweiChart, opts: InfoClockOpts): string[] {
	const li = chart.lunarInfo;
	const bi = chart.birthInfo;
	const lunar = Solar.fromYmd(bi.year, bi.month, bi.day).getLunar();
	const bazi = lunar.getEightChar();
	const jieQi = `${bazi.getYear()} ${bazi.getMonth()} ${bazi.getDay()} ${bazi.getTime()}`;
	const feiJieQi = `${lunar.getYearInGanZhi()} ${lunar.getMonthInGanZhi()} ${bazi.getDay()} ${bazi.getTime()}`;
	const nongLi = `${STEMS[li.yearStem]}${BRANCHES[li.yearBranch]}年${lunarMonthCN(li.lunarMonth)}${lunarDayCN(li.lunarDay)}日${BRANCHES[bi.timeIndex % 12]}时`;
	// 两口径相同并列是噪音（相同值并列会被当成 bug）；只有分叉
	// （立春与正月初一之间出生，年/月柱分界不同）才值得并列对照。
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
