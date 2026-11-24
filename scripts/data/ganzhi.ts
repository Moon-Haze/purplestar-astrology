/** @file 干支/宫名数据。@packageDocumentation */

/** 十天干：下标=天干索引(0=甲…9=癸)；改名即启动失败。 */
export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/** 十二地支：下标=地支索引(0=子…11=亥)，异于时辰序号(多12=「晚子时」)；palaces 寅起序。
 *  同 {@link STEMS}。 */
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/** 时辰表：地支索引→时辰名+时段，子时跨两日；12项无晚子时，不参与安星。 */
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

/** 宫名序列：第8宫「**交友宫**」承倪师《天纪》，iztro 原名「仆役」而项目用「交友」，
 *  见 {@link IZTRO_TO_PROJECT_PALACE}；同集合防「映射表写错、比对器跟着一起错」。
 *  见 docs/code/data-tables.md。 */
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

/** iztro宫名→项目宫名：旧码直通致 iztro「仆役」漏进输出，本表收回；
 *  未命中抛错非回退(公共索引不可降级)。{@link IZTRO_TO_PROJECT_PALACE} */
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

/** 项目宫名(带宫字)→db紧凑键(不带、「仆役」)：仅供 db 导出，未知原样；
 *  与 {@link IZTRO_TO_PROJECT_PALACE} 反向。 */
export const COMPACT_PALACE_KEY: Record<string, string> = {
	命宫: "命宫",
	兄弟宫: "兄弟",
	夫妻宫: "夫妻",
	子女宫: "子女",
	财帛宫: "财帛",
	疾厄宫: "疾厄",
	迁移宫: "迁移",
	交友宫: "仆役",
	官禄宫: "官禄",
	田宅宫: "田宅",
	福德宫: "福德",
	父母宫: "父母",
};

/** 项目宫名→db紧凑键(未知原样)，见 {@link COMPACT_PALACE_KEY}。 */
export const compactPalaceKey = (palaceName: string): string =>
	COMPACT_PALACE_KEY[palaceName] ?? palaceName;
