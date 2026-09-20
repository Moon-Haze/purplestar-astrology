// 天干 Heavenly Stems
export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

// 地支 Earthly Branches
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 时辰对应地支
export const SHICHEN = [
	{ branch: 0, name: "子时", range: "23:00-01:00" },
	{ branch: 1, name: "丑时", range: "01:00-03:00" },
	{ branch: 2, name: "寅时", range: "03:00-05:00" },
	{ branch: 3, name: "卯时", range: "05:00-07:00" },
	{ branch: 4, name: "辰时", range: "07:00-09:00" },
	{ branch: 5, name: "巳时", range: "09:00-11:00" },
	{ branch: 6, name: "午时", range: "11:00-13:00" },
	{ branch: 7, name: "未时", range: "13:00-15:00" },
	{ branch: 8, name: "申时", range: "15:00-17:00" },
	{ branch: 9, name: "酉时", range: "17:00-19:00" },
	{ branch: 10, name: "戌时", range: "19:00-21:00" },
	{ branch: 11, name: "亥时", range: "21:00-23:00" },
];

// 十二宫名，从命宫顺时针
export const PALACE_NAMES_ORDER = [
	"命宫",
	"兄弟宫",
	"夫妻宫",
	"子女宫",
	"财帛宫",
	"疾厄宫",
	"迁移宫",
	"交友宫",
	"官禄宫",
	"田宅宫",
	"福德宫",
	"父母宫",
];

/**
 * iztro 宫名 → 本项目宫名（倪师《天纪》体系）。
 *
 * 为什么需要这张表：`algorithm.ts` 原先写的是 `name: p.name`，宫名**直通 iztro**，
 * 于是 iztro 的第 8 宫「仆役」直接漏进了本项目的输出。而倪师《天纪》原文
 * （`nihai/tianji.ts`）与本文件上方的 `PALACE_NAMES_ORDER` 用的都是「交友」——
 * 项目自己的口径早就定好了，只是从未生效。经这张表映射，等于把宫名收回项目手里。
 *
 * 与 `PALACE_NAMES_ORDER` 的分工：这里是**无序的词典**（按 iztro 的原始名索引），
 * 那里是**有序的序列**（按命宫顺时针排）。两者必须同集合，且互为对照 ——
 * `test/invariants.test.mjs` 用后者验证前者，正是为了防「映射表写错了、
 * 比对器跟着一起错」的同源盲区（见 test/README.md「复读机」那条教训）。
 *
 * ⚠️ 增删条目时同步 `PALACE_NAMES_ORDER`，两边必须同集合。
 * ⚠️ 未命中的宫名一律**抛错**而非回退（见 algorithm.ts 的 projectPalaceName）——
 *    宫名是十二宫一览、--focus、三方四正、大限、格局判定的公共索引，不能静默降级。
 */
export const IZTRO_TO_PROJECT_PALACE: Record<string, string> = {
	命宫: "命宫",
	兄弟: "兄弟宫",
	夫妻: "夫妻宫",
	子女: "子女宫",
	财帛: "财帛宫",
	疾厄: "疾厄宫",
	迁移: "迁移宫",
	仆役: "交友宫",
	官禄: "官禄宫",
	田宅: "田宅宫",
	福德: "福德宫",
	父母: "父母宫",
};

// 纳音五行（30组干支对的五行）
export const NAYIN_ELEMENTS = [
	"金",
	"火",
	"木",
	"土",
	"金",
	"火",
	"水",
	"土",
	"金",
	"木",
	"水",
	"土",
	"火",
	"木",
	"水",
	"金",
	"火",
	"木",
	"土",
	"金",
	"火",
	"水",
	"土",
	"金",
	"木",
	"水",
	"土",
	"火",
	"木",
	"水",
];

// 五行 → 局数
export const ELEMENT_TO_JU: Record<string, number> = {
	水: 2,
	木: 3,
	金: 4,
	土: 5,
	火: 6,
};

// 局数名称
export const JU_NAMES: Record<number, string> = {
	2: "水二局",
	3: "木三局",
	4: "金四局",
	5: "土五局",
	6: "火六局",
};

// 四化表（年干 → [化禄, 化权, 化科, 化忌]）
export const SI_HUA_TABLE: Record<number, [string, string, string, string]> = {
	0: ["廉贞", "破军", "武曲", "太阳"], // 甲
	1: ["天机", "天梁", "紫微", "太阴"], // 乙
	2: ["天同", "天机", "文昌", "廉贞"], // 丙
	3: ["太阴", "天同", "天机", "巨门"], // 丁
	4: ["贪狼", "太阴", "右弼", "天机"], // 戊
	5: ["武曲", "贪狼", "天梁", "文曲"], // 己
	6: ["太阳", "武曲", "太阴", "天同"], // 庚
	7: ["巨门", "太阳", "文曲", "文昌"], // 辛
	8: ["天梁", "紫微", "左辅", "武曲"], // 壬
	9: ["破军", "巨门", "太阴", "贪狼"], // 癸
};

// 天魁天钺表（年干 → [天魁branch, 天钺branch]）
export const TIANKUI_TABLE: Record<number, [number, number]> = {
	0: [1, 7], // 甲: 魁丑 钺未
	1: [0, 8], // 乙: 魁子 钺申
	2: [11, 9], // 丙: 魁亥 钺酉
	3: [11, 9], // 丁: 魁亥 钺酉
	4: [1, 7], // 戊: 魁丑 钺未
	5: [0, 8], // 己: 魁子 钺申
	6: [1, 7], // 庚: 魁丑 钺未
	7: [6, 2], // 辛: 魁午 钺寅
	8: [3, 5], // 壬: 魁卯 钺巳
	9: [3, 5], // 癸: 魁卯 钺巳
};

// 禄存表（年干 → 禄存branch）
export const LUCUN_TABLE: Record<number, number> = {
	0: 2, // 甲: 寅
	1: 3, // 乙: 卯
	2: 5, // 丙: 巳
	3: 6, // 丁: 午
	4: 5, // 戊: 巳
	5: 6, // 己: 午
	6: 8, // 庚: 申
	7: 9, // 辛: 酉
	8: 11, // 壬: 亥
	9: 0, // 癸: 子
};

// 天马表（年支三合 → 天马branch）
// 寅午戌→申, 申子辰→寅, 巳酉丑→亥, 亥卯未→巳
export const TIANMA_TABLE: Record<number, number> = {
	2: 8, // 寅年 → 申
	6: 8, // 午年 → 申
	10: 8, // 戌年 → 申
	8: 2, // 申年 → 寅
	0: 2, // 子年 → 寅
	4: 2, // 辰年 → 寅
	5: 11, // 巳年 → 亥
	9: 11, // 酉年 → 亥
	1: 11, // 丑年 → 亥
	11: 5, // 亥年 → 巳
	3: 5, // 卯年 → 巳
	7: 5, // 未年 → 巳
};

// 主星亮度表 [branch]: 主星亮度映射
// 庙(bright) 旺(bright) 利(normal) 平(normal) 不利(dim) 陷(dim)
export const STAR_BRIGHTNESS: Record<string, Record<number, string>> = {
	紫微: {
		2: "bright",
		5: "bright",
		8: "bright",
		11: "bright",
		1: "normal",
		4: "normal",
		7: "bright",
		10: "normal",
		0: "normal",
		3: "dim",
		6: "dim",
		9: "normal",
	},
	天机: {
		5: "bright",
		11: "bright",
		3: "bright",
		9: "bright",
		1: "normal",
		7: "normal",
		2: "dim",
		8: "dim",
		0: "normal",
		4: "normal",
		6: "normal",
		10: "normal",
	},
	太阳: {
		3: "bright",
		4: "bright",
		5: "bright",
		6: "bright",
		7: "normal",
		8: "normal",
		9: "normal",
		10: "dim",
		11: "dim",
		0: "dim",
		1: "dim",
		2: "normal",
	},
	武曲: {
		2: "bright",
		5: "bright",
		8: "bright",
		11: "bright",
		0: "normal",
		3: "normal",
		6: "normal",
		9: "normal",
		1: "dim",
		4: "dim",
		7: "dim",
		10: "dim",
	},
	天同: {
		0: "bright",
		3: "bright",
		6: "bright",
		9: "bright",
		2: "normal",
		5: "normal",
		8: "normal",
		11: "normal",
		1: "dim",
		4: "dim",
		7: "dim",
		10: "dim",
	},
	廉贞: {
		2: "bright",
		5: "bright",
		8: "bright",
		11: "bright",
		0: "normal",
		3: "normal",
		6: "normal",
		9: "normal",
		1: "dim",
		4: "dim",
		7: "dim",
		10: "dim",
	},
};

// 主星描述（倪海夏体系）
export const STAR_DESCRIPTIONS: Record<
	string,
	{ keywords: string; nature: string; element: string }
> = {
	紫微: { keywords: "帝王·尊贵·独立", nature: "中性偏吉", element: "土" },
	天机: { keywords: "智慧·机变·谋略", nature: "吉星", element: "木" },
	太阳: { keywords: "阳刚·官贵·慷慨", nature: "吉星", element: "火" },
	武曲: { keywords: "财富·刚毅·果断", nature: "中性", element: "金" },
	天同: { keywords: "温和·享福·随缘", nature: "吉星", element: "水" },
	廉贞: { keywords: "才艺·刑囚·桃花", nature: "凶中带吉", element: "火" },
	天府: { keywords: "财库·稳重·保守", nature: "吉星", element: "土" },
	太阴: { keywords: "柔美·财富·阴柔", nature: "吉星", element: "水" },
	贪狼: { keywords: "欲望·桃花·多才", nature: "中性", element: "木" },
	巨门: { keywords: "口舌·是非·善辩", nature: "凶中带吉", element: "水" },
	天相: { keywords: "辅佐·行政·印绶", nature: "吉星", element: "水" },
	天梁: { keywords: "荫护·医药·长辈", nature: "吉星", element: "土" },
	七杀: { keywords: "将星·果决·孤克", nature: "凶星", element: "金" },
	破军: { keywords: "开创·变动·破坏", nature: "凶星", element: "水" },
};
