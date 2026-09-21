/**
 * 十天干（Heavenly Stems），数组下标即全项目的**天干索引**（0=甲、1=乙 … 9=癸）。
 *
 * ⚠️ 索引基是 **0**；本文件的几张 `Record<number, ...>` 表（四化、天魁天钺、禄存）都以它为键。
 *
 * 消费者：`algorithm.ts`（由 iztro 的天干名反查索引）、`sihua.ts`、`cli/render.ts`
 * （渲染「寅戊」这类宫位干支）、`cli/commands.ts`、`cli/selftest.ts`。
 * `purple-star.ts` 的 `REQUIRED_EXPORTS` 启动自检也盯着它——**改名或删除会让 CLI 启动即失败**，
 * 这是有意的（宁可启动失败，也不静默产出错盘）。
 */
export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/**
 * 十二地支（Earthly Branches），数组下标即全项目的**地支索引**（0=子、1=丑 … 11=亥）。
 *
 * ⚠️ 与**时辰序号**不同域：后者多一个 12（晚子时），见 `types.ts` 的 `BirthInfo.hour`。
 * ⚠️ `ZiweiChart.palaces` 的数组顺序**不是**本数组的顺序（实测为 2,3,…,11,0,1，寅起）。
 * 消费者同 {@link STEMS}。
 */
export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/**
 * 十二时辰对照表：地支索引 → 时辰名 + **钟表时段**。
 *
 * `branch` 与数组下标等值（冗余保留，便于按值匹配）；`range` 是钟表时段，
 * 子时横跨两日（23:00–01:00）。
 *
 * ⚠️ 本表只有 12 项、**不含「晚子时」** —— 晚子时不是第 13 个时辰，而是子时的另一种
 * 安星口径（时辰序号 12，见 `types.ts` 的 `BirthInfo.hour`）。
 *
 * 消费者：`cli/birth-info.ts` 的 `shichenLabel`（拼「巳时(09:00-11:00)」这类提示文案）、
 * `purple-star.ts` 的 `REQUIRED_EXPORTS` 自检。**不参与安星**。
 */
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

/**
 * 十二宫名的**有序序列**，自命宫起按顺时针排列（命宫 → 兄弟宫 → … → 父母宫）。
 *
 * 口径说明：第 8 宫写作「**交友宫**」（下标 7），这是倪师《天纪》体系与 `nihai/tianji.ts`
 * 的用词；iztro 的原始名是「仆役」，换算见 {@link IZTRO_TO_PROJECT_PALACE}。
 *
 * ⚠️ 与 {@link IZTRO_TO_PROJECT_PALACE} 的分工：这里是**有序序列**，那里是**无序词典**，
 * 两者必须**同集合**。`test/invariants.test.ts` 用本数组验证那张映射表，正是为了防
 * 「映射表写错了、比对器跟着一起错」的同源盲区（见 `test/README.md`「复读机」那条教训）。
 * **增删条目时两张表必须同步**。
 *
 * ⚠️ 当前 `scripts/` 运行期没有它的消费者（`algorithm.ts` 只在抛错文案里提到它），
 * 主要服务于测试侧的不变量校验。
 */
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
 * `test/invariants.test.ts` 用后者验证前者，正是为了防「映射表写错了、
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

/**
 * 纳音五行（30 组干支对的五行）。
 *
 * 索引为六十甲子的**组号**，即甲子序号（0 起）÷ 2：第 n 项对应第 2n、2n+1 两组干支的
 * 纳音五行（如 index 0 = 甲子/乙丑 → 「金」）。值为单个汉字五行
 * （「金」「火」「木」「土」「水」）。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**：排盘由 iztro 完成，纳音不参与安星，
 * 也没有任何渲染或断言读它。仅为数据留存，**改它不会影响现有输出**。
 */
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

/**
 * 五行 → 五行局局数。
 *
 * 键是单个汉字五行（「水」「木」「金」「土」「火」），值为局数 2–6。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者** —— 运行时的局数由 `algorithm.ts` 的
 * `parseWuxingJu` 直接从局名（「水二局」）解析中文数字得出，**未走本表**。
 * 仅为数据留存。
 */
export const ELEMENT_TO_JU: Record<string, number> = {
	水: 2,
	木: 3,
	金: 4,
	土: 5,
	火: 6,
};

/**
 * 五行局局数 → 局名（如 2 → 「水二局」）。
 *
 * ⚠️ 当前无消费者：运行时展示的是 iztro 的原文 `ZiweiChart.wuxingJuName`，不经本表。
 * 它与 {@link ELEMENT_TO_JU} 成对（五行 ↔ 局数 ↔ 局名），仅为数据留存。
 */
export const JU_NAMES: Record<number, string> = {
	2: "水二局",
	3: "木三局",
	4: "金四局",
	5: "土五局",
	6: "火六局",
};

/**
 * 生年四化表：年干索引（0–9）→ `[化禄, 化权, 化科, 化忌]` 四颗星名。
 *
 * ⚠️ 键是**年干**索引（0=甲 … 9=癸）。本表**不含**宫干四化、流年干四化、自化那种
 * 飞星派口径 —— 那些已主动下线（见 `.claude/CLAUDE.md`）。
 *
 * 消费者：`sihua.ts` 的 `getSiHuaByStem` / `buildStarSiHuaMap`，上承 `cli/commands.ts`
 * 的生年四化落宫与合盘四化分析。⚠️ 改本表会改变**所有**四化落宫、进而改变格局命中，
 * `npm test` 的语料回归盯着这条链路。
 */
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

/**
 * 天魁天钺安星表：年干索引（0–9）→ `[天魁地支, 天钺地支]`。
 *
 * 键是**年干**索引，值是地支索引 0–11（行尾注释给出中文对照，如「甲: 魁丑 钺未」）。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者** —— 天魁天钺由 iztro 安星，
 * `algorithm.ts` 的 `LUCKY_STARS` 名单只按星名判类型，不查本表。仅为数据留存，
 * **改它不会影响现有输出**。
 */
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

/**
 * 禄存安星表：年干索引（0–9）→ 禄存所在的**地支**索引 0–11。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**（禄存由 iztro 安星），仅为数据留存。
 */
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

/**
 * 天马安星表：**年支**索引（0–11）→ 天马所在的地支索引 0–11。
 *
 * ⚠️ 键与 {@link LUCUN_TABLE} **不同**：禄存看年干，天马看年支三合
 * （寅午戌→申、申子辰→寅、巳酉丑→亥、亥卯未→巳，即每三个年支共用一个马位，
 * 故 12 个键只映射到 4 个值）。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者**（天马由 iztro 安星），仅为数据留存。
 */
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

/**
 * 主星亮度表：星名 → `{ 地支索引 0–11 → 亮度档 }`。
 *
 * 值域是 `algorithm.ts` 的 `mapBrightness` 的**输出域**（`"bright"` / `"normal"` / `"dim"`），
 * 不是 iztro 的中文原文。中英对照：庙/旺 = `bright`、利/平 = `normal`、不利/陷 = `dim`。
 *
 * 只覆盖 **6 颗**主星（紫微、天机、太阳、武曲、天同、廉贞）—— 十四主星里的另外 8 颗不在表内。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者** —— 运行时的 `Star.brightness` 对**全部**
 * 主星都是直接取 iztro 的亮度字、经 `mapBrightness` 归并得来，**未走本表**。
 * 仅为数据留存，改它不会影响现有输出。
 */
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

/**
 * 十四主星释义（倪海夏体系）：星名 → `{ keywords, nature, element }`。
 *
 * 消费者：`cli/commands.ts` 的「主星释义」查询与关键词展示；`cli/selftest.ts` 的完整性
 * 断言（要求恰 14 条，且键集合与 iztro 的十四主星一致）。
 *
 * ⚠️ 本表**不参与安星，也不参与格局判定**，只影响文案。增删条目会让 `selftest` 的
 * 「星曜释义条数」断言变红。注意：线上站点的 14 主星 × 13 主题论断库（`STAR_DB`）
 * **不在本 skill 内**，别把它和本表混为一谈。
 */
export const STAR_DESCRIPTIONS: Record<
	string,
	{
		/** 关键词，以「·」分隔（`cli/commands.ts` 按「·」切开后逐条展示） */
		keywords: string;
		/** 星性（如「吉星」「凶星」「中性」「中性偏吉」「凶中带吉」） */
		nature: string;
		/** 五行（「木」「火」「土」「金」「水」之一） */
		element: string;
	}
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
