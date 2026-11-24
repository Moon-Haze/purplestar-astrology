/**
 * 出生信息声明层：接口与常量；「怎么算」见 ./birth-info。
 * @remarks 口径警告见 docs/code/cli-birth.md。
 */

import type { BirthInfo } from "@/types";
import { PROVINCES, type CityInfo } from "./cities";

/**
 * {@link calcTrueSolar} 选项。
 * @remarks eot 计均时差；开时 year/month/day 必填，缺项于 {@link equationOfTime} 算 NaN 污染链，入口即抛（docs/code/cli-birth.md）。
 */
export interface TrueSolarOptions {
	/** 计均时差？默认关（仅经度校正） */
	eot?: boolean;
	/** 公历年；eot 时必填 */
	year?: number;
	/** 公历月 1–12；eot 时必填 */
	month?: number;
	/** 公历日；eot 时必填 */
	day?: number;
	/**
	 * 夏令时回拨分钟（1986–91 为 60），默认 0；调用点按日期用 {@link isChinaDstClock} 判定传入
	 */
	dstMinutes?: number;
}

/** {@link calcTrueSolar} 返回值。 */
export interface TrueSolarResult {
	/** 时辰支 0–11；无 12，晚子时由 {@link isLateZi} 标 */
	branch: number;
	/**
	 * @remarks 校正落 23:00–23:59？子时跨两日，23:00 后应「算次日」，与早子时盘全异（docs/code/cli-birth.md）
	 */
	isLateZi: boolean;
	/**
	 * @remarks 跨日界：0 未跨 / +1 次日 / -1 前日。调用方须据此调日期；只取时辰、留日期于钟表轴，「日 + 时」即错（喀什 00:30 实测，docs/code/cli-birth.md）
	 */
	dayOffset: number;
	/**
	 * 总校正分钟（经度+均时差−夏令时）。分项各自取整后相加，使「经度 A + 均时差 B − 夏令时 C = D」自洽
	 */
	offsetMinutes: number;
	/** 经度项 `(经度−120)×4`，取整分钟 */
	longitudeMinutes: number;
	/** 均时差项，取整分钟；未开 eot 恒 0 */
	eotMinutes: number;
	/** 夏令时回拨项，分钟；非夏令时或 --no-dst 时恒 0 */
	dstMinutes: number;
	/** 当日分钟 0–1439（按 1440 归一，无跨天），取整 */
	solarMinutes: number;
}

/**
 * 区划后缀（「石家庄市」「石家庄地区」「XX自治州」），只匹配结尾，由 {@link stripSuffix} 去掉
 */
export const ADMIN_SUFFIX = /(特别行政区|自治州|自治县|自治区|地区|盟|市|县|区|旗)$/;

/**
 * {@link findLongitude} 命中结果。
 */
export interface LongitudeHit {
	/** 经度，东经正 */
	longitude: number;
	/** 表内命中名（可与所写不同＝容错） */
	matched: string;
	/** 精确命中？true 原名 / false 容错 */
	exact: boolean;
	/** 同名候选（≤5，如「吉林(126.57)」）；无歧义 null */
	ambiguous: string[] | null;
}

/**
 * {@link PROVINCES} 平铺全部城市（335 条），加载时算一次。
 * @remarks 为可读性非性能；系 PROVINCES 快照，改动后 findLongitude 读陈旧数据（docs/code/cli-birth.md）。
 */
export const ALL_CITIES: CityInfo[] = PROVINCES.flatMap(p => p.cities);

/**
 * {@link buildBirthInfo} 结果。
 * @remarks info 喂 generateChart；余者供渲染，不参与排盘。
 */
export interface BirthInfoResult {
	/** 可排盘出生信息（时辰序号、日期已调） */
	info: BirthInfo;
	/** 时辰说明（notes 之一） */
	note: string;
	/** 日期/出生地/时辰说明合集，滤空串 */
	notes: string[];
	/** 实际经度（东经正）；同 info.longitude */
	longitude: number;
	/** 出生地解析提示；精确命中空串 */
	lngNote: string;
	/** 同名候选；无歧义 null */
	lngAmbiguous: string[] | null;
	/** 真太阳时落 23:00–23:59（提示复核晚子时） */
	lateZiCandidate: boolean;
	/** 是否按晚子时排盘（timeIndex===12） */
	isLateZi: boolean;
}

/**
 * 口径提示单一搬运载体。
 * @remarks 原在 astrology.ts 解成 8 局部变量逐字传，改一处漏一处无断言红；现 {@link toBasis} 单点折算 + 整包传递，notes 只读。
 */
export interface CaliberBasis {
	/** 时辰说明（notes 之一，solarNote 源） */
	note: string;
	/** 日期/出生地/时辰说明合集，滤空串 */
	notes: readonly string[];
	/** 实际经度（东经正） */
	longitude: number;
	/** 出生地解析提示；精确命中空串 */
	lngNote: string;
	/** 同名候选；无歧义 null */
	lngAmbiguous: string[] | null;
	/** 真太阳时落 23:00–23:59 */
	isLateZi: boolean;
	/** 是否按晚子时排盘（timeIndex===12） */
	lateZiCandidate: boolean;
	/** args.time 钟表时刻展示串（非串 null） */
	clockTime: string | null;
}

/**
 * {@link buildBirthInfo} 结果 + args.time → {@link CaliberBasis}。
 * @param r - 解析结果
 * @param time - --time 值（未给/非串→null）
 * @returns 整包载体，clockTime 单点折算
 */
export function toBasis(r: BirthInfoResult, time: unknown): CaliberBasis {
	return {
		note: r.note,
		notes: r.notes,
		longitude: r.longitude,
		lngNote: r.lngNote,
		lngAmbiguous: r.lngAmbiguous,
		isLateZi: r.isLateZi,
		lateZiCandidate: r.lateZiCandidate,
		clockTime: typeof time === "string" ? time : null,
	};
}

/**
 * {@link CaliberBasis} → infoSection 的 {@link InfoClockOpts}。
 * @param b - 已装配载体
 * @returns 同形对象：clockTime 透传 / solarNote=b.note / longitude 实采经度
 * @remarks InfoClockOpts 留 fortune.ts 不动；转换只此一处。
 */
export function clockOptsFromBasis(b: CaliberBasis): {
	clockTime: string | null;
	solarNote: string;
	longitude: number;
} {
	return { clockTime: b.clockTime, solarNote: b.note, longitude: b.longitude };
}
