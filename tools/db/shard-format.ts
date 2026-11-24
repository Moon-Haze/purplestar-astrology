/**
 * generate-shards 与 tar-source 共用；各抄必漂移，历史上分叉过。
 * @file v3 行格式序列化单点：「本仓 chart → 导出口径」字段映射仅此一份
 */
import { compactPalaceKey } from "../../scripts/data/ganzhi";

/** 星曜 type → 导出口径（ziwei-interp luck 分组名）。 */
export const STAR_TYPE_OUT: Record<string, string> = {
	major: "major",
	minor: "minor",
	soft: "lucky",
	tough: "sha",
};

/**
 * 序列化用到 ZiweiChart 字段（只声明用到的成员）。取值口径以导出侧为准，语义同 `scripts/types.ts`。
 */
type AnyChart = {
	/** 农历信息透传（lunarYear/lunarDay/isLeapMonth） */
	lunarInfo: unknown;
	/** 命宫地支索引 0–11 */
	soulBranch: number;
	/** 身宫地支索引 0–11 */
	bodyBranch: number;
	/** 五行局局数 2–6 */
	fiveElementsClass: number;
	/** 五行局名（如「水二局」） */
	fiveElementsClassName: string;
	/** 紫微星所在宫地支索引 0–11 */
	ziweiPos: number;
	/** 十二宫（宫名转紧凑形） */
	palaces: Array<{
		/** 宫位地支索引 0–11 */
		branch: number;
		/** 宫干（天干索引 0–9） */
		stem: number;
		/** 宫名（带「宫」字，如「命宫」） */
		name: string;
		/** 本宫星曜 */
		stars: Array<{
			/** 星名 */
			name: string;
			/** 星曜分类（→ STAR_TYPE_OUT 导出） */
			type: string;
			/** 亮度（可缺失，缺则不带键） */
			brightness?: string | null;
			/** 四化标记（禄/权/科/忌；未化 null） */
			mutagen?: string | null;
		}>;
		/** 大限年龄段 `[起, 讫]`（虚岁闭区间） */
		decadalRange?: [number, number] | number[];
		/** 是否命宫 */
		isSoulPalace?: boolean;
		/** 是否身宫 */
		isBodyPalace?: boolean;
		/** 当前虚岁是否落本宫大限 */
		isCurrentDecadal?: boolean;
	}>;
	/** 各大限（按起始虚岁升序） */
	decadals: Array<{ startAge: number; endAge: number; palaceBranch: number; palaceName: string }>;
	/** 当前虚岁（农历年正月初一为界） */
	currentAge: number;
	/** 当前大限下标；-1 未起运 */
	currentDecadalIndex: number;
};

/**
 * 本仓 ZiweiChart → 分片 chart（hour/mingGongBranch/siHua/daXianAge、
 * 紧凑宫名、lucky/sha 星型）。
 * @param chart - 本仓内核排盘产物
 * @param birth - 分片 birthInfo（hour 为时辰索引 0–11）
 * @returns 分片口径 chart
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
