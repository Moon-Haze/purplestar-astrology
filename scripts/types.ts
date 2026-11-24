/** @file 领域模型类型契约 @packageDocumentation */

/** 冻结。「为什么这样冻结」 */

/** 出生信息 */
export interface BirthInfo {
	/** 年 */
	year: number;
	/** 月1-12 */
	month: number;
	/** 日1-31 */
	day: number;
	/** 时辰 */
	timeIndex: number;
	/** 性别 */
	gender: "male" | "female";
	/** 姓名 */
	name?: string;
	/** 出生省 */
	province?: string;
	/** 出生市 */
	city?: string;
	/** 经度 */
	longitude?: number;
}

/** 农历信息 */
export interface LunarInfo {
	/** 农历年 */
	lunarYear: number;
	/** 闰见{@link isLeapMonth} */
	lunarMonth: number;
	/** 农历日 */
	lunarDay: number;
	/** 年干 */
	yearStem: number;
	/** 年支 */
	yearBranch: number;
	/** 闰月 */
	isLeapMonth: boolean;
}

/** 四化 */
export type Mutagen = "禄" | "权" | "科" | "忌";

/** 星曜状态 */
export interface Star {
	/** 星名「紫微」「擎羊」 */
	name: string;
	/** 星曜类别 */
	type: "major" | "minor" | "soft" | "tough";
	/** 生年四化 */
	mutagen?: Mutagen;
	/** 亮度{@link brightness} */
	brightness?: "bright" | "normal" | "dim";
	/** 亮度细档 */
	brightnessRaw?: string;
}

/** 「被化之星恰在本宫」星 */
export interface SelfMutagenMark {
	/** 自化四化 */
	mutagen: Mutagen;
	/** 自化星名 */
	starName: string;
}

/** 身宫{@link isBodyPalace} */
export interface Palace {
	/** 序见{@link ZiweiChart.palaces} */
	branch: number;
	/** 宫干 */
	stem: number;
	/** 宫名映射见data/ganzhi.ts */
	name: string;
	/** 本宫星曜 */
	stars: Star[];
	/** 大限年龄 */
	decadalRange?: [number, number];
	/** 虚岁{@link decadalRange} */
	ages?: number[];
	/** 在{@link decadalRange}内 */
	isCurrentDecadal?: boolean;
	/** 命宫{@link ZiweiChart.soulBranch} */
	isSoulPalace?: boolean;
	/** 身宫 */
	isBodyPalace?: boolean;
	/** 宫干自化 */
	selfMutagen?: SelfMutagenMark[];
	/** 对宫地支 */
	oppositeBranch?: number;
	/** 空宫 */
	isEmpty?: boolean;
	/** 借{@link oppositeBranch} */
	borrowedFromBranch?: number;
	/** 借宫名 */
	borrowedFromName?: string;
	/** 借星名 */
	borrowedStars?: string[];
}

/** 四化{@link SelfMutagenMark} */
export interface DecadalMutagen {
	/** 宫干 */
	stemIndex: number;
	/** 宫干名「戊」 */
	stemName: string;
	/** 化禄 */
	lu: string;
	/** 化权 */
	quan: string;
	/** 化科 */
	ke: string;
	/** 化忌 */
	ji: string;
}

/** 大限区间 */
export interface Decadal {
	/** 起始虚岁 */
	startAge: number;
	/** 结束虚岁 */
	endAge: number;
	/** 宫地支 */
	palaceBranch: number;
	/** 宫名 */
	palaceName: string;
	/** 宫干索引停用 */
	stemIndex?: number;
	/** 停用{@link stemIndex} */
	stemName?: string;
	/** {@link stemIndex} {@link DecadalMutagen} */
	mutagen?: DecadalMutagen;
}

/** 完整命盘 */
export interface ZiweiChart {
	/** 出生信息 */
	birthInfo: BirthInfo;
	/** 农历 */
	lunarInfo: LunarInfo;
	/** 命宫地支 */
	soulBranch: number;
	/** 身宫地支 */
	bodyBranch: number;
	/** 五行局 */
	fiveElementsClass: number;
	/** 局名{@link fiveElementsClass} */
	fiveElementsClassName: string;
	/** 紫微地支 */
	ziweiPos: number;
	/** 十二宫，按branch索引 */
	palaces: Palace[];
	/** 全部大限 */
	decadals: Decadal[];
	/** 命主「贪狼」 */
	mingZhu: string;
	/** 身主「火星」 */
	shenZhu: string;
	/** 子年斗君宫地支 */
	douJunBranch: number;
	/** 虚岁 */
	currentAge: number;
	/** 下标{@link decadals} -1未起运 */
	currentDecadalIndex: number;
}
