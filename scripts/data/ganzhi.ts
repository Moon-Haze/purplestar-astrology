/**
 * 干支与宫名数据 —— 十天干、十二地支、十二时辰、宫名序列与 iztro 宫名映射。
 *
 * 2026-10-11 从 `constants.ts` 拆出，内容逐字迁移，仅改变物理位置。
 *
 * @packageDocumentation
 */

/**
 * 十天干（Heavenly Stems），数组下标即全项目的**天干索引**（0=甲、1=乙 … 9=癸）。
 *
 * ⚠️ 索引基是 **0**；本文件的几张 `Record<number, ...>` 表（四化、天魁天钺、禄存）都以它为键。
 *
 * 消费者：`algorithm.ts`（由 iztro 的天干名反查索引）、`sihua.ts`、`cli/chart/render.ts`
 * （渲染「寅戊」这类宫位干支）、`cli/commands/index.ts`、`cli/selftest/index.ts`。
 * `purple-star.ts` 的 `REQUIRED_EXPORTS` 启动自检也盯着它——**改名或删除会让 CLI 启动即失败**，
 * 这是有意的（宁可启动失败，也不静默产出错盘）。
 */
export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/**
 * 十二地支（Earthly Branches），数组下标即全项目的**地支索引**（0=子、1=丑 … 11=亥）。
 *
 * ⚠️ 与**时辰序号**不同域：后者多一个 12（晚子时），见 `types.ts` 的 `BirthInfo.timeIndex`。
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
 * 安星口径（时辰序号 12，见 `types.ts` 的 `BirthInfo.timeIndex`）。
 *
 * 消费者：`cli/birth/birth-info.ts` 的 `shichenLabel`（拼「巳时(09:00-11:00)」这类提示文案）、
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
 * 口径说明：第 8 宫写作「**交友宫**」（下标 7），这是本项目既定口径（用词承自倪师《天纪》
 * 体系）；iztro 的原始名是「仆役」，换算见 {@link IZTRO_TO_PROJECT_PALACE}。
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
 * 于是 iztro 的第 8 宫「仆役」直接漏进了本项目的输出。而本文件上方的
 * `PALACE_NAMES_ORDER`（沿承倪师《天纪》体系的用词）用的是「交友」——
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
