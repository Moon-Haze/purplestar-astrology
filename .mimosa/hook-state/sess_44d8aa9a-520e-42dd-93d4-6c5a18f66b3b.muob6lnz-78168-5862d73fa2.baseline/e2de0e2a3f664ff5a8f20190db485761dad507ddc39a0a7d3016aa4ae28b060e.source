/**
 * 出生信息解析层的**声明**部分 —— 接口与常量。
 *
 * 与 `./birth-info` 的分工：那边是「怎么算」（真太阳时、农历换算、城市名归一），
 *
 * 依赖：@/ziwei/types（BirthInfo）、@/ziwei/cities（CityInfo / PROVINCES）
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { BirthInfo } from "@/ziwei/types";
import { PROVINCES, type CityInfo } from "@/ziwei/cities";

/**
 * {@link calcTrueSolar} 的可选项。
 *
 * @remarks
 * `eot` 决定是否计入均时差，其余三项是均时差所需的日期。
 *
 * ⚠️ 开了 `eot` 时 `year` / `month` / `day` **三项都必须给**，缺任何一项都会当场抛错 ——
 * 均时差依赖具体日期，缺项会在 {@link equationOfTime} 里静默算出 `NaN`，污染
 * `branch` / `dayOffset` 整条结果链（宁可在入口失败，也不产出错时辰）。
 */
export interface TrueSolarOptions {
	/** 是否额外计入均时差。默认 `false`，即传统口径（只做经度校正） */
	eot?: boolean;
	/** 公历年，`eot` 为真时必填 */
	year?: number;
	/** 公历月 1–12，`eot` 为真时应提供 */
	month?: number;
	/** 公历日，`eot` 为真时应提供 */
	day?: number;
}

/** {@link calcTrueSolar} 的返回值。 */
export interface TrueSolarResult {
	/** 时辰支 0–11（0=子 … 11=亥）。注意：此值不会是 12，晚子时由 {@link isLateZi} 单独标记 */
	branch: number;
	/**
	 * 校正后是否落在 23:00–23:59（晚子时）。
	 *
	 * ⚠️ 这个区分很重要：子时横跨两日，23:00 后出生按传统三合派应「算次日」，
	 * 排出的盘与当日早子时完全不同。
	 */
	isLateZi: boolean;
	/**
	 * 校正后跨了几天的**日界**：0 = 未跨天，+1 = 落到次日，-1 = 落到前一日。
	 *
	 * ⚠️ **调用方必须据此调整日期**：真太阳时是一条连续的时间轴，日期与时辰都得取自它。
	 * 只取时辰而把日期留在钟表轴上，「日 + 时」这个组合指向的就不是出生时刻。
	 * 例：喀什 00:30 的真太阳时是前一日 21:38，日期不回退则「亥时」偏了约 9 小时，
	 * 农历日跟着错一天 → 紫微星定位错 → 整盘十二宫全变。
	 */
	dayOffset: number;
	/**
	 * 总校正（经度 + 均时差），分钟。
	 *
	 * 算法是**分项各自取整后相加**，好让提示里的「经度 A + 均时差 B = C」自洽
	 * （若先相加再取整，-14.4 与 +3.8 会显示成 -14 + 4 = -11，看着像算错了）。
	 */
	offsetMinutes: number;
	/** 经度项的贡献 `(经度 − 120) × 4`，取整后的分钟数 */
	longitudeMinutes: number;
	/** 均时差项的贡献，取整后的分钟数；未开 `eot` 时恒为 0 */
	eotMinutes: number;
	/** 校正后的**当日分钟数** 0–1439（已按 1440 取模归一，故不含跨天信息），取整后 */
	solarMinutes: number;
}

/**
 * 行政区划后缀：用户常写「石家庄市」「石家庄地区」「XX自治州」，而城市表里存的是简称。
 *
 * 只匹配**结尾**的后缀；匹配到的整段会被 {@link stripSuffix} 去掉。
 */
export const ADMIN_SUFFIX = /(特别行政区|自治州|自治县|自治区|地区|盟|市|县|区|旗)$/;

/**
 * {@link findLongitude} 的命中结果。
 */
export interface LongitudeHit {
	/** 命中城市的经度，东经为正 */
	longitude: number;
	/** 实际命中的**表内**城市名（可能与用户所写不同，即发生了容错解析） */
	matched: string;
	/** 是否精确命中：`true` = 用户写的就是表里那个名字；`false` = 做了容错解析 */
	exact: boolean;
	/** 同长度的同名候选（最多 5 个，形如「吉林(126.57)」）；无歧义时为 `null` */
	ambiguous: string[] | null;
}

/**
 * {@link PROVINCES} 平铺后的全部城市（335 条），模块加载时算一次。
 *
 * @remarks
 * 提到模块作用域是为了**可读性** —— 「查经度就是在这 335 条里找」比每次调用现摊一遍更直白。
 * ⚠️ **不要**把它当性能优化引用：`flatMap` 实测约 4μs/次，省下的是噪声。
 *
 * ⚠️ 这是对 `PROVINCES` 的一次性快照。该表是静态常量、运行时不变，故当前等价；
 * 若将来有测试去改 `PROVINCES` 的内容，`findLongitude` 会读到陈旧数据。
 */
export const ALL_CITIES: CityInfo[] = PROVINCES.flatMap(p => p.cities);

/**
 * {@link buildBirthInfo} 的结果。
 *
 * @remarks
 * `info` 可直接喂给 `generateChart`；其余字段供上层渲染提示，**不参与排盘**。
 */
export interface BirthInfoResult {
	/** 可直接用于排盘的出生信息（钟表时已换算为时辰序号，日期已按跨天调整） */
	info: BirthInfo;
	/** 时辰那一条说明（`notes` 的其中一项） */
	note: string;
	/** 日期 / 出生地 / 时辰三类说明的合集，已滤掉空串 */
	notes: string[];
	/** 本次实际采用的经度（东经为正）；`info.longitude` 与它同值 */
	longitude: number;
	/** 出生地解析提示，精确命中时为空串 */
	lngNote: string;
	/** 同名候选城市列表，无歧义时为 null */
	lngAmbiguous: string[] | null;
	/** 校正后的真太阳时落在 23:00–23:59（需提醒用户复核晚子时口径） */
	lateZiCandidate: boolean;
	/** 本次排盘是否真的按晚子时口径（timeIndex === 12） */
	isLateZi: boolean;
}
