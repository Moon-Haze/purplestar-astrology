/**
 * v3 行格式的序列化单点 —— 「本仓 chart → 导出口径」的字段映射只有这一份：
 * generate-shards（内核直出分片）与 tar-source（tar 源物化）都消费它。
 * 两处各抄一份必然漂移（历史上 sample-id / 字段名各分叉过一次）。
 */
import { compactPalaceKey } from "../../scripts/data/ganzhi";

/** 本仓星曜 type → 导出口径（toolkit/ziwei-interp 的 luck 分组名）。 */
export const STAR_TYPE_OUT: Record<string, string> = {
	major: "major",
	minor: "minor",
	soft: "lucky",
	tough: "sha",
};

type AnyChart = {
	lunarInfo: unknown;
	soulBranch: number;
	bodyBranch: number;
	fiveElementsClass: number;
	fiveElementsClassName: string;
	ziweiPos: number;
	palaces: Array<{
		branch: number;
		stem: number;
		name: string;
		stars: Array<{
			name: string;
			type: string;
			brightness?: string | null;
			mutagen?: string | null;
		}>;
		decadalRange?: [number, number] | number[];
		isSoulPalace?: boolean;
		isBodyPalace?: boolean;
		isCurrentDecadal?: boolean;
	}>;
	decadals: Array<{ startAge: number; endAge: number; palaceBranch: number; palaceName: string }>;
	currentAge: number;
	currentDecadalIndex: number;
};

/**
 * 本仓 ZiweiChart → 分片 chart（导出口径：字段名 hour/mingGongBranch/siHua/daXianAge、
 * 紧凑宫名 compactPalaceKey、lucky/sha 星型）。
 *
 * @param chart - 本仓内核排盘产物
 * @param birth - 分片 birthInfo（导出口径：hour = 时辰索引 0–11，非钟点）
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
