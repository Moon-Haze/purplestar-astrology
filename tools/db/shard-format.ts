/**
 * v3 行格式的序列化单点 —— 「本仓 chart → 导出口径」的字段映射只有这一份：
 * generate-shards（内核直出分片）与 tar-source（tar 源物化）都消费它。
 * 两处各抄一份必然漂移（历史上 sample-id / 字段名各分叉过一次）。
 *
 * @file v3 行格式的序列化单点 —— 「本仓 chart → 导出口径」的字段映射只有这一份：
 */
import { compactPalaceKey } from "../../scripts/data/ganzhi";

/** 本仓星曜 type → 导出口径（toolkit/ziwei-interp 的 luck 分组名）。 */
export const STAR_TYPE_OUT: Record<string, string> = {
	major: "major",
	minor: "minor",
	soft: "lucky",
	tough: "sha",
};

/**
 * 本仓 ZiweiChart 里序列化真正读到的那部分字段（结构性类型，只声明用到的成员）。
 *
 * 字段语义与 `scripts/types.ts` 的 ZiweiChart 同域（此处刻意不 import 内核类型：
 * 本工具只做字段搬运，取值口径以导出侧为准）。
 */
type AnyChart = {
	/** 农历信息，原样透传到分片（分片口径只需 lunarYear / lunarDay / isLeapMonth） */
	lunarInfo: unknown;
	/** 命宫地支索引 0–11 */
	soulBranch: number;
	/** 身宫地支索引 0–11 */
	bodyBranch: number;
	/** 五行局局数 2–6 */
	fiveElementsClass: number;
	/** 五行局名（iztro 原文，如「水二局」） */
	fiveElementsClassName: string;
	/** 紫微星所在宫的地支索引 0–11 */
	ziweiPos: number;
	/** 十二宫（宫名在本工具里会经 compactPalaceKey 转成紧凑形） */
	palaces: Array<{
		/** 宫位地支索引 0–11 */
		branch: number;
		/** 宫干（天干索引 0–9），取自本仓 Palace.stem */
		stem: number;
		/** 宫名（展开形，带「宫」字，如「命宫」） */
		name: string;
		/** 本宫星曜 */
		stars: Array<{
			/** 星名 */
			name: string;
			/** 星曜分类（major/minor/soft/tough，经 STAR_TYPE_OUT 映射为导出口径） */
			type: string;
			/** 亮度（可缺失；缺则分片不带该键） */
			brightness?: string | null;
			/** 四化标记（禄 / 权 / 科 / 忌；未化为 null） */
			mutagen?: string | null;
		}>;
		/** 本宫大限年龄段 `[起, 讫]`（虚岁闭区间；可缺失，缺则分片写空数组） */
		decadalRange?: [number, number] | number[];
		/** 是否命宫 */
		isSoulPalace?: boolean;
		/** 是否身宫 */
		isBodyPalace?: boolean;
		/** 当前虚岁是否落在本宫大限内 */
		isCurrentDecadal?: boolean;
	}>;
	/** 各大限（按起始虚岁升序） */
	decadals: Array<{ startAge: number; endAge: number; palaceBranch: number; palaceName: string }>;
	/** 当前虚岁（农历年正月初一为界） */
	currentAge: number;
	/** 当前大限下标；-1 表示尚未起运 */
	currentDecadalIndex: number;
};

/**
 * 本仓 ZiweiChart → 分片 chart（导出口径：字段名 hour/mingGongBranch/siHua/daXianAge、
 * 紧凑宫名 compactPalaceKey、lucky/sha 星型）。
 *
 * @param chart - 本仓内核排盘产物
 * @param birth - 分片 birthInfo（导出口径：hour = 时辰索引 0–11，非钟点）
 *
 * @returns 分片口径的 chart（字段名与星曜类型编码见上方说明）
 */
export function toShardChart(chart: AnyChart, birth: Record<string, unknown>) {
	return {
		birthInfo: birth,
		lunarInfo: chart.lunarInfo,
		mingGongBranch: chart.soulBranch,
		shenGongBranch: chart.bodyBranch,
		wuxingJu: chart.fiveElementsClass,
		wuxingJuName: chart.fiveElementsClassName,
		ziweiPos: chart.ziweiPos,
		palaces: chart.palaces.map(p => ({
			branch: p.branch,
			stem: p.stem,
			name: compactPalaceKey(p.name),
			stars: p.stars.map(s => ({
				name: s.name,
				type: STAR_TYPE_OUT[s.type],
				...(s.brightness !== undefined ? { brightness: s.brightness } : {}),
				siHua: s.mutagen ?? "",
			})),
			daXianAge: p.decadalRange ?? [],
			isMingGong: p.isSoulPalace ?? false,
			isShenGong: p.isBodyPalace ?? false,
			isCurrentDaXian: p.isCurrentDecadal ?? false,
		})),
		daXians: chart.decadals.map(d => ({ ...d, palaceName: compactPalaceKey(d.palaceName) })),
		currentAge: chart.currentAge,
		currentDaXianIndex: chart.currentDecadalIndex,
	};
}
