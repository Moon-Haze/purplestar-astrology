/**
 * 紫微斗数格局识别（v2 严格化版本）。
 *
 * 本模块是解读层的主体：由一张已排好的 {@link ZiweiChart} 判出命中的格局清单，
 * 每条含名称、分级、判词、涉及宫位与**分层的成立条件**。41 个 `detect*` 识别器各推入
 * 0 或 1 条 {@link Pattern}（其中火贪/铃贪、化忌入命/迁等可推入多条），合计覆盖约 70 个
 * 格局名。
 *
 * ## 设计原则
 *
 * 1. 古书条件优先：每个格局列出"必须 / 加分 / 破格"三层结构，出处可考
 * 2. 倪师立场：不使用宫干自化、大限四化、来因宫等飞星派工具
 * 3. 庙旺利陷：用 brightness 字段（bright=庙旺、normal=平、dim=陷）
 * 4. 三方四正会照：命宫 + 财帛 + 官禄 + 迁移
 * 5. 夹宫：命宫前后两宫
 *
 * ## 判定怎么做（实现口径）
 *
 * - **只看结构化字段，不解析文案**：判定依据是 `Palace.branch`、`Star.type`、
 *   `Star.brightness`、`Star.siHua` 四项，不读 `description` 文本
 * - **定位宫位走地支算术**：三方四正是 `[m, (m+4), (m+8), (m+6)]`、夹宫是 `(b±1)`、
 *   对宫是 `(b+6)`（见 `getSanFangPalaces` / `getJiaPalaces` / `getDuiGong`）。
 *   少数例外按**宫名**查找（`detectHuaLuRuCai` 找「财帛宫」、`detectHuaQuanRuGuan`
 *   找「官禄宫」），依赖 `algorithm.ts` 的宫名口径，见 `constants.ts` 的
 *   `IZTRO_TO_PROJECT_PALACE`
 * - **识别器一律"命中才推入"**：每个 `detect*` 内部先判条件，不成立即 `return`，
 *   从不推入"未成立"的条目；因此返回数组的长度即命中数
 * - **`conditions` 是回填结果、不是判定依据**：`required` / `bonus` / `breaking`
 *   记录的是**已经过判定**的项（见 {@link PatternCondition}）
 *
 * ## 主要古籍出处
 *
 *  - 《紫微斗数全集》（陈抟祖师传，明代刊本）
 *  - 《紫微斗数全书》（罗洪先编，明代刊本）
 *  - 《骨髓赋》《女命骨髓赋》《十二宫诸星得地合格诀》
 *  - 倪海厦《天纪》紫微斗数讲义
 *
 * ## 回归与效力边界
 *
 * `test/invariants.test.ts` 的层 3 为全部约 70 个格局名建了**独立预言机**（按定义复算，
 * 不看实现），另有「化禄入财 / 化权入官」两条按偏移算术核对的断言；`cli/selftest.ts`
 * 只断言返回结构与条目必备字段。⚠️ 该预言机复刻的是**实现当前的口径**，不是照命理理想
 * 口径重写，且 `level` 分级、`description` / `conditions` 文案均不在其覆盖范围内 ——
 * 详见 `test/README.md`。
 *
 * @packageDocumentation
 */

import type { ZiweiChart, Palace, Star, SiHua } from "./types";
import { BRANCHES } from "./constants";

// ────────────────── 类型 ──────────────────
/**
 * 格局的成立条件分层（v2 结构）。
 *
 * @remarks
 * ⚠️ 这三个数组是**回填已判定项**的结果记录，**不是判定依据**：识别器先用代码判完条件，
 * 再把已命中的项写进来给文案层展示。故"某条件不在 `required` 里"不等于"该条件不成立"，
 * 只是那个识别器没有把它列进去。
 *
 * 三层语义：`required` 全部成立格局才被推入；`bonus` 与 `breaking` 只影响
 * {@link Pattern.level} 的取值（有 `breaking` 通常降级）。
 */
export interface PatternCondition {
	required: string[]; // 必须满足条件（已通过的）
	bonus?: string[]; // 加分项（已触发）
	breaking?: string[]; // 破格警示（已触发）
}

/**
 * 一条已命中的格局。
 *
 * @remarks
 * 由各 `detect*` 识别器在条件成立时推入 {@link detectPatterns} 的累积数组。
 */
export interface Pattern {
	name: string; // 格局名；部分识别器会拼入星名（如「武曲化禄入命」「太阴化忌入迁」）
	level: "excellent" | "good" | "neutral" | "caution"; // 分级：excellent 上格 / good 吉格 / neutral 平 / caution 凶格警示。触发破格条件时**降级**（如 excellent → good、good → caution）
	description: string; // 判词文案，由 cli/commands.ts 直接输出给用户
	palaces: string[]; // 涉及宫位（**宫名**，非地支索引；可能含"身宫"或格局定名宫位）
	conditions?: PatternCondition; // 成立条件分层（v2 新增）
	source?: string; // 古籍出处（v2 新增）
}

// ────────────────── 常量 ──────────────────
// 三张煞星名单：多个识别器共用同一份口径，改这里等于同时改所有引用它的格局。
// SHA_NAMES 是全集（六煞）；SHA_HARD（四煞）与 SHA_KONG（空劫）是它的**两个互不相交的
// 子集** —— 空劫不在四煞之内，故计煞时两者分别累加，不会重复计数。
/** 六煞名单：擎羊、陀罗、火星、铃星、地空、地劫。{@link hasShaInPalace} 的默认口径。 */
const SHA_NAMES = ["擎羊", "陀罗", "火星", "铃星", "地空", "地劫"];
/** 四煞名单（不含空劫）。陷阱计数类判定的默认口径，见 {@link shaCountInPalace} / {@link sanFangShaCount}。 */
const SHA_HARD = ["擎羊", "陀罗", "火星", "铃星"]; // 四煞
/** 空劫名单。紫微、双禄等格局的"最忌空劫"判定用它，与四煞分开计。 */
const SHA_KONG = ["地空", "地劫"]; // 空劫
/**
 * 左辅、右弼的名单。
 *
 * @remarks
 * ⚠️ 本文件内**无任何引用**：辅弼的判定都在调用点直接写字面量（`sanFangSet.has("左辅")
 * && sanFangSet.has("右弼")`），未走这张表。保留是为了不动逻辑，改动时别以为它在生效。
 */
const ZUO_YOU = ["左辅", "右弼"];
/**
 * 文昌、文曲的名单。
 *
 * @remarks
 * ⚠️ 本文件内**无任何引用**，同 {@link ZUO_YOU}：昌曲判定在调用点直接写字面量。
 */
const CHANG_QU = ["文昌", "文曲"];
/**
 * 天魁、天钺的名单。
 *
 * @remarks
 * ⚠️ 本文件内**无任何引用**，同 {@link ZUO_YOU}：魁钺判定在调用点直接写字面量。
 */
const KUI_YUE = ["天魁", "天钺"];

// ────────────────── 辅助函数 ──────────────────
/**
 * 取一宫的主星名列表。
 *
 * @param palace - 目标宫位
 * @returns 该宫 `type === "major"` 的星名；**不含**吉煞与杂耀
 *
 * @remarks
 * "空宫"判定（`detectMingZhuChuHai`）与 "本宫含某主星" 判定（`detectShaPoLang` /
 * `detectJiYueTongLiang` 的 `palaces` 回填）都走这里，故口径必须与 `Star.type`
 * 保持一致 —— 而 `Star.type` 由 `algorithm.ts` 的 `mapStarType` 决定。
 */
function getMajorStarNames(palace: Palace): string[] {
	return palace.stars.filter(s => s.type === "major").map(s => s.name);
}
/**
 * 在一宫内按星名取星。
 *
 * @param palace - 目标宫位
 * @param name - 星曜中文名
 * @returns 命中的 {@link Star}；该宫无此星时返回 `undefined`
 *
 * @remarks
 * 与 {@link hasStar} 的差别是返回值：需要读亮度 / 四化时用本函数，只问有无时用 `hasStar`。
 * 同名星同宫出现多次时只取首个（`find` 语义）。
 */
function findStar(palace: Palace, name: string): Star | undefined {
	return palace.stars.find(s => s.name === name);
}
/**
 * 判断一宫内是否有某星。
 *
 * @param palace - 目标宫位
 * @param name - 星曜中文名
 * @returns 该宫含此星则为 `true`
 */
function hasStar(palace: Palace, name: string): boolean {
	return palace.stars.some(s => s.name === name);
}
/**
 * 在整张盘里按星名找宫位。
 *
 * @param chart - 命盘
 * @param name - 星曜中文名
 * @returns 第一个含该星的宫位；全盘无此星时返回 `undefined`
 *
 * @remarks
 * ⚠️ 只返回**首个**命中宫。主星在十二宫中唯一，吉煞与杂耀按安星法也各只落一宫，故实际
 * 不会歧义；但若 `Star` 数据异常（同名星出现两次），后一个会被静默忽略。
 *
 * ⚠️ 星曜**不在盘上**（`star` 未出现在任何宫）时同样返回 `undefined`，与"该宫为空"无法
 * 区分。多数调用点因此先判空再取。
 */
function findStarPalace(chart: ZiweiChart, name: string): Palace | undefined {
	return chart.palaces.find(p => p.stars.some(s => s.name === name));
}
/**
 * 按地支索引取宫位。
 *
 * @param chart - 命盘
 * @param branch - 地支索引；可为任意整数（含负数、超出 0–11）
 * @returns 该地支对应的宫位；无匹配时返回 `undefined`
 *
 * @remarks
 * `((branch % 12) + 12) % 12` 是两步取模，把入参规整到 0–11。调用点因此可以直接写
 * `(branch + 6) % 12`、`(branch + 11) % 12` 这类偏移算式而不必再判界。
 */
function getPalaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
	return chart.palaces.find(p => p.branch === ((branch % 12) + 12) % 12);
}
/**
 * 数一宫内的煞星个数。
 *
 * @param palace - 目标宫位
 * @param list - 煞星名单，默认 {@link SHA_HARD}（四煞）
 * @returns 该宫中属于 `list` 的星数
 *
 * @remarks
 * 逐星计数，故一宫同时坐羊、陀会返回 2。默认口径是四煞而非六煞 —— 空劫要单独数时
 * 显式传 {@link SHA_KONG}。
 */
function shaCountInPalace(palace: Palace, list: string[] = SHA_HARD): number {
	return palace.stars.filter(s => list.includes(s.name)).length;
}
/**
 * 判断一宫内是否坐着煞星。
 *
 * @param palace - 目标宫位
 * @param list - 煞星名单，默认 {@link SHA_NAMES}（六煞，含空劫）
 * @returns 命中名单中任意一颗即为 `true`
 *
 * @remarks
 * ⚠️ 默认口径与 {@link shaCountInPalace} **不同**：这里默认六煞（含空劫），那里默认四煞。
 * 需要"坐四煞"而非"坐六煞"时显式传 {@link SHA_HARD}（如 `detectWuQiSha`、
 * `detectTongLiang` 就是这么调的）。
 */
function hasShaInPalace(palace: Palace, list: string[] = SHA_NAMES): boolean {
	return palace.stars.some(s => list.includes(s.name));
}
/**
 * 取命宫的三方四正。
 *
 * @param chart - 命盘
 * @returns 命宫、官禄宫、财帛宫、迁移宫四个宫位
 *
 * @remarks
 * 以 `chart.mingGongBranch` 为基准做地支偏移，四个地支分别是：
 *
 * | 偏移 | 宫位 |
 * | --- | --- |
 * | `m` | 命宫 |
 * | `m + 4` | 官禄宫 |
 * | `m + 8` | 财帛宫 |
 * | `m + 6` | 迁移宫 |
 *
 * 偏移方向以 `test/invariants.test.ts` 的「宫名与相对命宫的逆行偏移一致」为准
 * （`k = (mingGongBranch − branch + 12) % 12`，期望宫名取自 `PALACE_NAMES_ORDER`）——
 * 十二宫由命宫**逆行**排布，别想当然写成顺行。
 *
 * ⚠️ 返回顺序是 **`chart.palaces` 的地支序**（`filter` 保持原数组序），不是上表的偏移序，
 * 也不是宫位顺序；需要稳定顺序时请自行排序。正常命盘恒返回 4 个宫位。
 */
function getSanFangPalaces(chart: ZiweiChart): Palace[] {
	const m = chart.mingGongBranch;
	const branches = [m, (m + 4) % 12, (m + 8) % 12, (m + 6) % 12];
	return chart.palaces.filter(p => branches.includes(p.branch));
}
/**
 * 判断某地支是否落在命宫的三方四正内。
 *
 * @param chart - 命盘
 * @param branch - 待判定的地支索引（**需已规整在 0–11**，此处不做取模）
 * @returns 在命宫、官禄宫、财帛宫或迁移宫则为 `true`
 *
 * @remarks
 * 与 {@link getSanFangPalaces} 同一组偏移，但走 `includes` 直判，省去构造数组 ——
 * 识别器里高频调用（如火贪/武贪的"会照命宫三方"关卡）。
 *
 * ⚠️ 入参不做 `% 12` 规整，与 {@link getPalaceByBranch} 不同：传入越界值一律判 `false`，
 * 不会误命中。
 */
function isInSanFang(chart: ZiweiChart, branch: number): boolean {
	const m = chart.mingGongBranch;
	return [m, (m + 4) % 12, (m + 8) % 12, (m + 6) % 12].includes(branch);
}
/**
 * 取对宫。
 *
 * @param chart - 命盘
 * @param branch - 基准地支索引
 * @returns 相隔六个地支的那个宫位；无匹配时返回 `undefined`
 *
 * @remarks
 * 对宫恒为 `(branch + 6) % 12`，与 `algorithm.ts` 填的 `Palace.oppositeBranch`
 * 是同一个算式。
 */
function getDuiGong(chart: ZiweiChart, branch: number): Palace | undefined {
	return getPalaceByBranch(chart, (branch + 6) % 12);
}
/**
 * 取夹宫：某宫地支前后各一宫。
 *
 * @param chart - 命盘
 * @param branch - 基准地支索引（通常传 `chart.mingGongBranch`）
 * @returns `prev` 为地支序前一位（`(branch + 11) % 12`），`next` 为后一位（`(branch + 1) % 12`）；
 *   宫位缺失时对应字段为 `undefined`
 *
 * @remarks
 * "夹"看的是**地支相邻**，与宫名无关。以命宫（`m`）为基准时，`prev` 即兄弟宫
 * （偏移 1）、`next` 即父母宫（偏移 11）—— 偏移口径同 {@link getSanFangPalaces}。
 *
 * 调用点（`detectRiYueJiaMing` / `detectFuBiJiaMing` / `detectYangTuoJiaJi` 等）
 * 一律先 `if (!prev || !next) return;`，因为缺一宫就构不成"夹"。
 */
function getJiaPalaces(chart: ZiweiChart, branch: number): { prev?: Palace; next?: Palace } {
	return {
		prev: getPalaceByBranch(chart, (branch + 11) % 12),
		next: getPalaceByBranch(chart, (branch + 1) % 12),
	};
}
/**
 * 取命宫三方四正内出现过的所有星名。
 *
 * @param chart - 命盘
 * @returns 三方四正四宫中全部星曜名的集合（含主星、吉煞、杂耀）
 *
 * @remarks
 * 是 {@link getSanFangPalaces} 的聚合视图，识别器里最常用的入口（"再会昌曲"、"辅弼同会"
 * 这类判定都基于它）。
 *
 * ⚠️ 返回 `Set` 即**去重**：同名星出现多次只留一份。所以它只能回答"有没有"，
 * 不能用来数煞星个数 —— 数个数请用 {@link sanFangShaCount}。
 *
 * ⚠️ 判定的是**星名是否出现在这四宫**，与"该星是否在本宫 / 是否同宫"无关。要区分
 * 同宫与会照，得另比 `Palace.branch`（如 `detectHuoTanLingTan` 的做法）。
 */
function sanFangAllStars(chart: ZiweiChart): Set<string> {
	return new Set(getSanFangPalaces(chart).flatMap(p => p.stars.map(s => s.name)));
}
/**
 * 数命宫三方四正内的煞星个数。
 *
 * @param chart - 命盘
 * @param list - 煞星名单，默认 {@link SHA_HARD}（四煞）
 * @returns 四宫煞星数之和
 *
 * @remarks
 * 逐宫累加（`reduce` + {@link shaCountInPalace}），故**保留重复计数** —— 与
 * {@link sanFangAllStars} 的去重语义相反，这正是"三方煞重"类破格条件所需。
 */
function sanFangShaCount(chart: ZiweiChart, list: string[] = SHA_HARD): number {
	return getSanFangPalaces(chart).reduce((sum, p) => sum + shaCountInPalace(p, list), 0);
}
/**
 * 判断一宫内某星是否庙旺。
 *
 * @param palace - 目标宫位
 * @param starName - 星曜中文名
 * @returns 该星在该宫亮度为 `"bright"` 则为 `true`
 *
 * @remarks
 * ⚠️ 星不在该宫、或亮度字段缺省（`undefined`）时**一律返回 `false`** —— 拿不到亮度时
 * 不做正面假设。加分之处的误判方向因此是"少加分"而非"多加分"，与 `algorithm.ts`
 * 的 `mapBrightness`（缺省归 `normal`）口径呼应。
 *
 * 三档亮度里 `"normal"`（得 / 利 / 平）**不算**庙旺。
 */
function isBright(palace: Palace, starName: string): boolean {
	const s = findStar(palace, starName);
	return s?.brightness === "bright";
}
/**
 * 判断一宫内某星是否落陷。
 *
 * @param palace - 目标宫位
 * @param starName - 星曜中文名
 * @returns 该星在该宫亮度为 `"dim"` 则为 `true`
 *
 * @remarks
 * ⚠️ 同 {@link isBright}：星不在该宫或亮度缺省时返回 `false`，不把"不知道"当成"落陷"。
 * 破格判定因此偏向"少判破格"。
 */
function isDim(palace: Palace, starName: string): boolean {
	const s = findStar(palace, starName);
	return s?.brightness === "dim";
}
/**
 * 取一宫内某星的四化标记。
 *
 * @param palace - 目标宫位
 * @param starName - 星曜中文名
 * @returns 该星的 `siHua`（禄 / 权 / 科 / 忌）；无四化或星不在该宫时为 `undefined`
 *
 * @remarks
 * 读到的是**生年四化**（`algorithm.ts` 把 iztro 的 `mutagen` 落到 `Star.siHua`），
 * 三合派口径；不涉及宫干，故不受飞星派下线影响。
 */
function getStarSiHua(palace: Palace, starName: string): Star["siHua"] | undefined {
	return findStar(palace, starName)?.siHua;
}
/**
 * 判断一宫内是否有**任意**星带指定四化。
 *
 * @param palace - 目标宫位
 * @param hua - 四化之一（禄 / 权 / 科 / 忌）
 * @returns 该宫存在带此四化的星则为 `true`
 *
 * @remarks
 * 与 {@link getStarSiHua} 的分工：后者问「**某颗指定星**化没化」，本函数问「**这一宫**里
 * 有没有星化」。判「命宫见禄」这类**不指定星**的条件时用本函数。
 *
 * ⚠️ 不要用 `palace.stars.some(s => s.name === "化禄")` 代替本函数 —— 四化是
 * `Star.siHua` **字段**（取值「禄」「权」「科」「忌」），不是星曜名。把「化禄」当星名去查
 * 星名集合**恒为 false**，条件静默失效而 `tsc` 与测试都发现不了。
 */
function palaceHasSiHua(palace: Palace, hua: SiHua): boolean {
	return palace.stars.some(s => s.siHua === hua);
}
/**
 * 判断命宫三方四正内是否有**任意**星带指定四化。
 *
 * @param chart - 命盘
 * @param hua - 四化之一（禄 / 权 / 科 / 忌）
 * @returns 四宫中任一宫存在带此四化的星则为 `true`
 *
 * @remarks
 * 是 {@link palaceHasSiHua} 的三方四正视图，用于「再会化科」「三方有化禄或化权」这类
 * 会照判定。会照**不分宫位**，故只看「四宫里有没有」，不比 `Palace.branch`。
 *
 * ⚠️ 理由同 {@link palaceHasSiHua}：`sanFangAllStars(chart).has("化科")` 是恒假写法，
 * 因为那个 `Set` 装的是**星名**。
 */
function sanFangHasSiHua(chart: ZiweiChart, hua: SiHua): boolean {
	return getSanFangPalaces(chart).some(p => palaceHasSiHua(p, hua));
}
/**
 * 地支索引 → 地支名。
 *
 * @remarks
 * 索引口径与 `types.ts` 的 `Palace.branch` 一致：0=子 … 11=亥。仅用于拼判词
 * （如"太阳太阴同入**未**宫"、"巨门入命于**子**宫"）与 `PatternCondition` 的文案。
 */
// 判词用的地支名直接取 constants 的 BRANCHES（原先此处有一份内容相同的本地副本，
// 两份相同数据表是漂移隐患 —— 已删除，见 .claude/CLAUDE.md 的架构说明）；
const BRANCH_NAMES = BRANCHES;

// ────────────────── 正格识别器 ──────────────────

/** 君臣庆会：紫微入命，左辅右弼同会（同宫或三方） */
function detectJunChenQingHui(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	if (!hasStar(ming, "紫微")) return;
	const sanFangSet = sanFangAllStars(chart);
	const hasZuo = sanFangSet.has("左辅");
	const hasYou = sanFangSet.has("右弼");
	if (!hasZuo || !hasYou) return;

	const required = ["紫微入命", "左辅右弼同会三方四正"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会文昌或文曲");
	if (sanFangSet.has("天魁") || sanFangSet.has("天钺")) bonus.push("魁钺贵人加照");
	if (getStarSiHua(ming, "紫微") === "权") bonus.push("紫微化权");
	if (sanFangShaCount(chart, SHA_KONG) >= 2) breaking.push("地空地劫双夹会照（紫微忌空劫）");

	patterns.push({
		name: "君臣庆会",
		level: breaking.length ? "good" : "excellent",
		description:
			"紫微入命，左辅右弼同会，帝王得贤臣辅佐，主大富大贵、统御之命。一生贵人不绝，宜走政商高位、跨界领袖之途。",
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·君臣庆会格》",
	});
}

/** 紫府同宫：紫微+天府于命宫（限寅、申宫） */
function detectZiFu(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const ziwei = findStarPalace(chart, "紫微");
	const tianfu = findStarPalace(chart, "天府");
	if (!ziwei || !tianfu || ziwei.branch !== tianfu.branch) return;

	const inMing = ziwei.branch === chart.mingGongBranch;
	const required = inMing ? ["紫微天府同入命宫"] : ["紫微天府同宫（不在命宫，会照减力）"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	const sanFangSet = sanFangAllStars(chart);
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("左辅右弼同会");
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会昌曲");
	if (hasShaInPalace(ziwei, SHA_KONG)) breaking.push("紫府宫坐空劫（破紫府之贵气）");
	if (shaCountInPalace(ziwei, SHA_HARD) >= 2) breaking.push("紫府宫见双煞同坐");

	patterns.push({
		name: "紫府同宫",
		level: inMing && !breaking.length ? "excellent" : "good",
		description: inMing
			? "紫微天府同入命宫，帝相并临，尊贵之命。主品行端正、衣食无忧、有领导才能，宜担任要职。需要左右辅弼来配合方为完整大格。"
			: "紫微天府同宫但未坐命，主一生有贵人贵气依托，但本身不一定大富贵，需看会照吉煞而定。",
		palaces: [ziwei.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·紫府同宫格》",
	});
}

/** 府相朝垣：天府、天相分别坐守命宫的三方四正 */
function detectFuXiangChaoYuan(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const tianfu = findStarPalace(chart, "天府");
	const tianxiang = findStarPalace(chart, "天相");
	if (!tianfu || !tianxiang) return;
	if (!isInSanFang(chart, tianfu.branch) || !isInSanFang(chart, tianxiang.branch)) return;
	if (tianfu.branch === chart.mingGongBranch && tianxiang.branch === chart.mingGongBranch) return;
	if (tianfu.branch === tianxiang.branch) return;

	const required = ["天府坐命三方", "天相坐命三方", "两星不同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (hasStar(ming, "禄存") || palaceHasSiHua(ming, "禄")) bonus.push("命宫见禄");
	if (sanFangAllStars(chart).has("左辅")) bonus.push("再会左辅");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命宫坐煞星");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("三方四正煞星过多");

	patterns.push({
		name: "府相朝垣",
		level: breaking.length ? "good" : "excellent",
		description:
			'天府天相分守命宫三方四正，文武并济、权印双辉，主一生衣食丰足、地位崇高。古书云"府相朝垣千钟食禄"，常见于政界、企业管理者。',
		palaces: [tianfu.name, tianxiang.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·府相朝垣格》",
	});
}

/** 阳梁昌禄：太阳+天梁+文昌+禄存四星会命宫，大贵格 */
function detectYangLiangChangLu(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (
		!sanFangSet.has("太阳") ||
		!sanFangSet.has("天梁") ||
		!sanFangSet.has("文昌") ||
		!sanFangSet.has("禄存")
	)
		return;

	const sun = findStarPalace(chart, "太阳")!;
	const liang = findStarPalace(chart, "天梁")!;
	const required = ["太阳会命宫三方", "天梁会命宫三方", "文昌会命宫三方", "禄存会命宫三方"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (isBright(sun, "太阳")) bonus.push("太阳庙旺");
	if (isBright(liang, "天梁")) bonus.push("天梁庙旺");
	if (sanFangHasSiHua(chart, "科")) bonus.push("再会化科");
	if (isDim(sun, "太阳")) breaking.push("太阳落陷（阳梁失辉）");
	if (sanFangShaCount(chart, SHA_HARD) >= 2) breaking.push("三方煞重");

	patterns.push({
		name: "阳梁昌禄",
		level: breaking.length ? "good" : "excellent",
		description:
			'太阳、天梁、文昌、禄存四星齐会命宫三方，号称"科举之星"，主清贵显达、考运极佳，宜走学术、文教、研究、专业认证之路，一生功名易就。',
		palaces: [sun.name, liang.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·阳梁昌禄格》",
	});
}

/** 火贪格 / 铃贪格：贪狼+火星 或 贪狼+铃星 同宫或会照 */
function detectHuoTanLingTan(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const tan = findStarPalace(chart, "贪狼");
	if (!tan) return;
	const huo = findStarPalace(chart, "火星");
	const ling = findStarPalace(chart, "铃星");

	for (const [shaName, shaPalace] of [
		["火星", huo],
		["铃星", ling],
	] as const) {
		if (!shaPalace) continue;
		const sameOrTrine =
			tan.branch === shaPalace.branch ||
			(tan.branch + 4) % 12 === shaPalace.branch ||
			(tan.branch + 8) % 12 === shaPalace.branch ||
			(tan.branch + 6) % 12 === shaPalace.branch;
		if (!sameOrTrine) continue;
		if (!isInSanFang(chart, tan.branch)) continue;

		const required = [
			`贪狼${tan.branch === shaPalace.branch ? "同宫" : "会照"}${shaName}`,
			"贪狼会照命宫三方",
		];
		const bonus: string[] = [];
		const breaking: string[] = [];
		if (isBright(tan, "贪狼")) bonus.push("贪狼庙旺");
		if (getStarSiHua(tan, "贪狼") === "禄" || getStarSiHua(tan, "贪狼") === "权")
			bonus.push("贪狼化禄/化权");
		if (hasShaInPalace(tan, ["擎羊", "陀罗"])) breaking.push("贪狼宫又见羊陀（破横发之力）");
		if (hasShaInPalace(tan, SHA_KONG)) breaking.push("贪狼遇空劫（财来财去）");

		patterns.push({
			name: shaName === "火星" ? "火贪格" : "铃贪格",
			level: breaking.length ? "good" : "excellent",
			description: `贪狼遇${shaName}${tan.branch === shaPalace.branch ? "同宫" : "三方会照"}，主突发横财、突如其来的机遇。古书云“贪狼遇火铃，必发横财”，但来得快去得也快，宜见好就收。${breaking.length ? "本盘破格条件已触发，发力打折。" : ""}`,
			palaces: [tan.name, shaPalace.name],
			conditions: { required, bonus, breaking },
			source: "《紫微斗数骨髓赋》",
		});
	}
}

/** 武贪格：武曲+贪狼 同宫（丑、未） 或 对照 */
function detectWuTan(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const wu = findStarPalace(chart, "武曲");
	const tan = findStarPalace(chart, "贪狼");
	if (!wu || !tan) return;
	const sameOrOppose = wu.branch === tan.branch || (wu.branch + 6) % 12 === tan.branch;
	if (!sameOrOppose) return;
	if (!isInSanFang(chart, wu.branch) && !isInSanFang(chart, tan.branch)) return;

	const required = [
		wu.branch === tan.branch ? "武曲贪狼同宫（丑/未）" : "武曲贪狼对宫拱照",
		"会照命宫三方",
	];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("火星") || sanFangAllStars(chart).has("铃星"))
		bonus.push("再遇火星/铃星（火贪/铃贪叠加）");
	if (getStarSiHua(wu, "武曲") === "禄") bonus.push("武曲化禄");
	if (hasShaInPalace(wu, ["擎羊", "陀罗"])) breaking.push("武贪宫见羊陀");
	if (hasShaInPalace(wu, SHA_KONG)) breaking.push("武贪宫遇空劫");

	patterns.push({
		name: "武贪格",
		level: breaking.length ? "good" : "excellent",
		description:
			'武曲贪狼会命，财星与桃花欲望星交辉，古书云"武贪不发少年人"——三十岁后方能厚积薄发。主中年以后大富大贵，财源由人脉、应酬、欲望管理而来，适合金融、投机、销售、娱乐业。',
		palaces: [wu.name, tan.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数骨髓赋》",
	});
}

/** 杀破狼：七杀、破军、贪狼三方齐聚 */
function detectShaPoLang(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	const has = ["七杀", "破军", "贪狼"].filter(s => sanFangSet.has(s));
	if (has.length < 3) return;

	const required = ["七杀、破军、贪狼三星齐入命宫三方四正"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangHasSiHua(chart, "禄") || sanFangHasSiHua(chart, "权"))
		bonus.push("三方有化禄或化权（动得有力）");
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("辅弼同会（变动中得贵人）");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("煞星过重（动而无成）");
	if (hasShaInPalace(ming, SHA_KONG)) breaking.push("命坐空劫（动得辛苦）");

	patterns.push({
		name: "杀破狼",
		level: breaking.length ? "caution" : "good",
		description:
			"七杀、破军、贪狼三星会命，开创闯荡之命格。一生变动多、不甘平凡，宜创业、军警、业务、销售。中年后才能稳定守成，年轻时易因冲动失利。",
		palaces: getSanFangPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·杀破狼》",
	});
}

/** 机月同梁：天机、太阴、天同、天梁四星齐入命迁财官 */
function detectJiYueTongLiang(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	const has = ["天机", "太阴", "天同", "天梁"].filter(s => sanFangSet.has(s));
	if (has.length < 4) return;

	const required = ["天机、太阴、天同、天梁四星齐入命宫三方四正"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会昌曲");
	if (sanFangHasSiHua(chart, "科")) bonus.push("再会化科");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("煞星过多（机月同梁忌煞）");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命宫坐煞");

	patterns.push({
		name: "机月同梁",
		level: breaking.length ? "good" : "excellent",
		description:
			"天机太阴天同天梁四星齐入命迁财官，文质彬彬、聪慧善谋。最适合公职、学术、文艺、医疗、服务等需稳定累积的行业，不宜大冒险大投机。",
		palaces: getSanFangPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·机月同梁格》",
	});
}

/** 廉贞天相：同宫 */
function detectLianXiang(chart: ZiweiChart, patterns: Pattern[]) {
	const lian = findStarPalace(chart, "廉贞");
	const xiang = findStarPalace(chart, "天相");
	if (!lian || !xiang || lian.branch !== xiang.branch) return;

	const inMing = lian.branch === chart.mingGongBranch;
	const required = ["廉贞天相同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (hasStar(lian, "禄存") || getStarSiHua(lian, "廉贞") === "禄")
		bonus.push("见禄存或廉贞化禄");
	if (sanFangAllStars(chart).has("左辅")) bonus.push("左辅会照");
	if (hasShaInPalace(lian, ["擎羊"])) breaking.push("廉相宫坐擎羊（廉杀羊倾向）");
	if (getStarSiHua(lian, "廉贞") === "忌") breaking.push("廉贞化忌");

	patterns.push({
		name: "廉贞天相格",
		level: breaking.length ? "caution" : inMing ? "good" : "neutral",
		description:
			"廉贞天相同宫，印绶格局，主秉公处事、清廉之名，宜任公职、行政管理、法务、企划。怕见擎羊化忌，则反主官非。",
		palaces: [lian.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书》",
	});
}

/** 武曲七杀：同宫，将星配财星 */
function detectWuQiSha(chart: ZiweiChart, patterns: Pattern[]) {
	const wu = findStarPalace(chart, "武曲");
	const qi = findStarPalace(chart, "七杀");
	if (!wu || !qi || wu.branch !== qi.branch) return;

	const inMing = wu.branch === chart.mingGongBranch;
	const required = ["武曲七杀同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (getStarSiHua(wu, "武曲") === "权") bonus.push("武曲化权");
	if (getStarSiHua(wu, "武曲") === "禄") bonus.push("武曲化禄");
	if (getStarSiHua(wu, "武曲") === "忌") breaking.push("武曲化忌（武曲化忌为财劫之兆）");
	if (hasShaInPalace(wu, ["擎羊", "陀罗", "火星", "铃星"])) breaking.push("武杀宫煞星过多");

	patterns.push({
		name: "武曲七杀",
		level: breaking.length ? "caution" : inMing ? "excellent" : "good",
		description:
			"武曲七杀同宫，将星配财星，主果决刚毅、理财能力强，适合金融、军警、创业。但忌见化忌煞星，否则凶险。一生奋斗、积财但操心。",
		palaces: [wu.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书》",
	});
}

/** 天同天梁：同宫 */
function detectTongLiang(chart: ZiweiChart, patterns: Pattern[]) {
	const tong = findStarPalace(chart, "天同");
	const liang = findStarPalace(chart, "天梁");
	if (!tong || !liang || tong.branch !== liang.branch) return;

	const required = ["天同天梁同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("文昌")) bonus.push("文昌会照");
	if (getStarSiHua(tong, "天同") === "禄") bonus.push("天同化禄");
	if (hasShaInPalace(tong, SHA_HARD)) breaking.push("煞星同坐");

	patterns.push({
		name: "天同天梁格",
		level: breaking.length ? "neutral" : "good",
		description:
			"天同天梁同宫，福星与荫星共会，主宽厚和善、乐于助人，宜医疗、教育、宗教、社会公益。但偏温和保守，难成大富大贵之局。",
		palaces: [tong.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书》",
	});
}

/** 日月同宫：太阳太阴丑或未宫同宫 */
function detectRiYueTongGong(chart: ZiweiChart, patterns: Pattern[]) {
	const sun = findStarPalace(chart, "太阳");
	const moon = findStarPalace(chart, "太阴");
	if (!sun || !moon || sun.branch !== moon.branch) return;
	if (sun.branch !== 1 && sun.branch !== 7) return; // 必须丑(1) 或 未(7)

	const inMing = sun.branch === chart.mingGongBranch;
	const required = [`太阳太阴同入${BRANCH_NAMES[sun.branch]}宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sun.branch === 7) bonus.push("未宫日月同辉（古书云未宫日月双美）");
	if (sanFangAllStars(chart).has("文昌") && sanFangAllStars(chart).has("文曲"))
		bonus.push("昌曲会照");
	if (hasShaInPalace(sun, SHA_HARD)) breaking.push("日月宫煞星同坐");

	patterns.push({
		name: "日月同宫",
		level: breaking.length ? "good" : inMing ? "excellent" : "good",
		description: `太阳太阴于${BRANCH_NAMES[sun.branch]}宫同宫，阴阳平衡，文武兼备。主异性缘佳、事业顺遂、名声远播。${sun.branch === 7 ? "未宫日月双美尤佳。" : "丑宫日月同宫力量较平。"}`,
		palaces: [sun.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书》",
	});
}

/** 日月夹命：太阳太阴在命宫前后两宫 */
function detectRiYueJiaMing(chart: ZiweiChart, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const prevHasSun = hasStar(prev, "太阳");
	const prevHasMoon = hasStar(prev, "太阴");
	const nextHasSun = hasStar(next, "太阳");
	const nextHasMoon = hasStar(next, "太阴");
	const ok = (prevHasSun && nextHasMoon) || (prevHasMoon && nextHasSun);
	if (!ok) return;

	const sunPalace = prevHasSun ? prev : next;
	const moonPalace = prevHasMoon ? prev : next;
	const required = ["太阳太阴分居命宫前后两宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (isBright(sunPalace, "太阳")) bonus.push("太阳庙旺");
	if (isBright(moonPalace, "太阴")) bonus.push("太阴庙旺");
	if (isDim(sunPalace, "太阳") || isDim(moonPalace, "太阴"))
		breaking.push("日月落陷（夹命无光）");

	patterns.push({
		name: "日月夹命",
		level: breaking.length ? "good" : "excellent",
		description:
			"太阳太阴分居命宫两侧夹照，光明磊落，一生贵人相助，事业蓬勃。男主官贵，女主旺夫兴家。日月须不落陷方为真夹。",
		palaces: [sunPalace.name, moonPalace.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·日月夹命》",
	});
}

/** 巨日同宫：巨门太阳同入寅或申 */
function detectJuRiTongGong(chart: ZiweiChart, patterns: Pattern[]) {
	const ju = findStarPalace(chart, "巨门");
	const sun = findStarPalace(chart, "太阳");
	if (!ju || !sun || ju.branch !== sun.branch) return;
	if (ju.branch !== 2 && ju.branch !== 8) return; // 必须寅(2) 或 申(8)

	const inMing = ju.branch === chart.mingGongBranch;
	const required = [`巨门太阳同入${BRANCH_NAMES[ju.branch]}宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (ju.branch === 2) bonus.push("寅宫太阳庙旺，巨门得日光化解是非");
	if (getStarSiHua(ju, "巨门") === "禄" || getStarSiHua(ju, "巨门") === "权")
		bonus.push("巨门化禄/化权（口才生财）");
	if (getStarSiHua(ju, "巨门") === "忌") breaking.push("巨门化忌（口舌官非）");
	if (ju.branch === 8) breaking.push("申宫太阳偏西，巨门暗曜更显");

	patterns.push({
		name: "巨日同宫",
		level: breaking.length ? "caution" : inMing && ju.branch === 2 ? "excellent" : "good",
		description: `巨门太阳同${BRANCH_NAMES[ju.branch]}宫，太阳化解巨门暗曜，主以口才、传媒、外语、专业立业。寅宫为佳，申宫力减。怕巨门化忌则官非。`,
		palaces: [ju.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·巨日同宫》",
	});
}

/** 石中隐玉：巨门入命于子午宫 */
function detectShiZhongYinYu(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	if (!hasStar(ming, "巨门")) return;
	if (ming.branch !== 0 && ming.branch !== 6) return; // 子(0) 或 午(6)

	const required = [`巨门入命于${BRANCH_NAMES[ming.branch]}宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (getStarSiHua(ming, "巨门") === "禄" || getStarSiHua(ming, "巨门") === "权")
		bonus.push("巨门化禄/化权");
	if (sanFangAllStars(chart).has("文昌")) bonus.push("文昌会照（石中隐玉得明）");
	if (getStarSiHua(ming, "巨门") === "忌") breaking.push("巨门化忌（玉藏深泥）");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命坐煞星");

	patterns.push({
		name: "石中隐玉",
		level: breaking.length ? "caution" : "excellent",
		description:
			'巨门坐命子午，外表平凡而内蕴才学。早年默默无闻、中年方显贵气，宜走专业、研究、口才、传媒。需有禄权或文昌相助方能"凿石见玉"。',
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数骨髓赋·石中隐玉》",
	});
}

/** 明珠出海：命宫在未空宫，对宫丑宫为太阳太阴 */
function detectMingZhuChuHai(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	if (ming.branch !== 7) return; // 命在未
	if (getMajorStarNames(ming).length > 0) return; // 命宫为空宫
	const dui = getDuiGong(chart, ming.branch);
	if (!dui) return;
	if (!hasStar(dui, "太阳") || !hasStar(dui, "太阴")) return;

	const required = ["命宫在未为空宫", "对宫丑宫为太阳太阴同度"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("文昌") || sanFangAllStars(chart).has("文曲"))
		bonus.push("再会昌曲");
	if (sanFangAllStars(chart).has("左辅") || sanFangAllStars(chart).has("右弼"))
		bonus.push("辅弼相助");
	if (sanFangShaCount(chart, SHA_HARD) >= 2) breaking.push("煞星会照（珠光黯淡）");

	patterns.push({
		name: "明珠出海",
		level: breaking.length ? "good" : "excellent",
		description:
			'命未空宫，对宫丑宫日月同辉拱照，号"明珠出海"。主出生平凡、后天努力出头，宜远赴他乡、学术研究或大公司高位，主大富大贵。',
		palaces: ["命宫", dui.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全集·明珠出海》",
	});
}

/** 紫微独坐入命 */
function detectZiWeiInMing(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	if (!hasStar(ming, "紫微") || hasStar(ming, "天府")) return;

	const required = ["紫微独坐命宫（无天府同坐）"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	const sanFangSet = sanFangAllStars(chart);
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("左辅右弼同会");
	if (sanFangSet.has("文昌") && sanFangSet.has("文曲")) bonus.push("文昌文曲同会");
	if (!sanFangSet.has("左辅") && !sanFangSet.has("右弼")) breaking.push("无辅弼（孤君无臣）");
	if (hasShaInPalace(ming, SHA_KONG)) breaking.push("紫微遇空劫（古书最忌）");

	patterns.push({
		name: "紫微入命",
		level: breaking.length ? "caution" : bonus.length ? "excellent" : "good",
		description:
			'紫微独坐命宫，帝王之星，自尊心强、有领导魅力。但紫微最忌"在野孤君"——若无左右辅弼相会，反成孤高自傲、易招毁谤。',
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书》",
	});
}

/** 辅弼夹命 */
function detectFuBiJiaMing(chart: ZiweiChart, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const prevHasZuo = hasStar(prev, "左辅");
	const prevHasYou = hasStar(prev, "右弼");
	const nextHasZuo = hasStar(next, "左辅");
	const nextHasYou = hasStar(next, "右弼");
	if (!((prevHasZuo && nextHasYou) || (prevHasYou && nextHasZuo))) return;

	const required = ["左辅右弼分居命宫前后两宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("天魁") || sanFangAllStars(chart).has("天钺"))
		bonus.push("再会魁钺");

	patterns.push({
		name: "辅弼夹命",
		level: "excellent",
		description:
			'左辅右弼夹命，一生贵人不断、逢凶化吉。适合走仕途、大企业管理，有贵人提携之命。古书云"左辅右弼，终身福厚"。',
		palaces: ["命宫", prev.name, next.name],
		conditions: { required, bonus, breaking },
		source: "《紫微斗数全书·辅弼夹命》",
	});
}

/** 昌曲夹命 */
function detectChangQuJiaMing(chart: ZiweiChart, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const prevHasChang = hasStar(prev, "文昌");
	const prevHasQu = hasStar(prev, "文曲");
	const nextHasChang = hasStar(next, "文昌");
	const nextHasQu = hasStar(next, "文曲");
	if (!((prevHasChang && nextHasQu) || (prevHasQu && nextHasChang))) return;

	patterns.push({
		name: "昌曲夹命",
		level: "excellent",
		description:
			'文昌文曲夹命宫，主聪明俊秀、文采斐然，宜走文教、学术、艺术、写作。古书云"昌曲夹命主科甲"，最利考运。',
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["文昌文曲分居命宫前后两宫"] },
		source: "《紫微斗数全书》",
	});
}

/** 魁钺夹命 */
function detectKuiYueJiaMing(chart: ZiweiChart, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "天魁") && hasStar(next, "天钺");
	const okB = hasStar(prev, "天钺") && hasStar(next, "天魁");
	if (!okA && !okB) return;

	patterns.push({
		name: "魁钺夹命",
		level: "good",
		description:
			"天魁天钺夹命，男称天乙、女称玉堂，一生贵人提携。考试、求职、关键时刻常有意外贵人相助。",
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["天魁天钺分居命宫前后两宫"] },
		source: "《紫微斗数全书》",
	});
}

/** 双禄朝垣：化禄 + 禄存 同会三方 */
function detectShuangLuChaoYuan(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const sanFang = getSanFangPalaces(chart);
	let huaLuFound = false;
	let luCunFound = false;
	for (const p of sanFang) {
		if (p.stars.some(s => s.siHua === "禄")) huaLuFound = true;
		if (hasStar(p, "禄存")) luCunFound = true;
	}
	if (!huaLuFound || !luCunFound) return;

	patterns.push({
		name: "双禄朝垣",
		level: "excellent",
		description:
			'化禄、禄存同会命宫三方四正，财源涌动、衣食丰足。古书云"双禄朝垣，富比陶朱"，主一生不愁财，多有正财横财兼得。',
		palaces: sanFang.map(p => p.name),
		conditions: {
			required: ["化禄会照三方四正", "禄存会照三方四正"],
			breaking: hasShaInPalace(ming, SHA_KONG)
				? ["命坐空劫（双禄遇空，财来财去）"]
				: undefined,
		},
		source: "《紫微斗数全书·双禄朝垣》",
	});
}

/** 三奇加会：化禄 化权 化科 同会三方 */
function detectSanQiJiaHui(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangPalaces = getSanFangPalaces(chart);
	let lu = false,
		quan = false,
		ke = false;
	for (const p of sanFangPalaces) {
		for (const s of p.stars) {
			if (s.siHua === "禄") lu = true;
			if (s.siHua === "权") quan = true;
			if (s.siHua === "科") ke = true;
		}
	}
	if (!(lu && quan && ke)) return;

	patterns.push({
		name: "三奇加会",
		level: "excellent",
		description:
			'化禄、化权、化科三吉化齐会命宫三方四正，号称"三奇加会"。主一生功名、财富、贵人三全，是紫微斗数最高吉格之一。',
		palaces: sanFangPalaces.map(p => p.name),
		conditions: { required: ["化禄、化权、化科三吉化齐会命宫三方四正"] },
		source: "《紫微斗数全书·三奇加会》",
	});
}

/** 化禄入命/官/财 */
function detectHuaLuRuMing(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const huaLuStar = ming.stars.find(s => s.siHua === "禄" && s.type === "major");
	if (!huaLuStar) return;

	patterns.push({
		name: `${huaLuStar.name}化禄入命`,
		level: "good",
		description: `${huaLuStar.name}化禄坐命，主生财顺利、人缘佳、机缘多。${huaLuStar.name === "武曲" ? "武曲化禄属正财，宜实业、金融。" : huaLuStar.name === "太阴" ? "太阴化禄属阴财、不动产。" : huaLuStar.name === "贪狼" ? "贪狼化禄属人脉财、桃花财。" : ""}`,
		palaces: ["命宫"],
		conditions: { required: [`${huaLuStar.name}化禄坐命宫`] },
		source: "《紫微斗数全书》",
	});
}

// ────────────────── 恶格识别器 ──────────────────

/** 化忌入命/迁 */
function detectHuaJiRuMingQian(chart: ZiweiChart, patterns: Pattern[]) {
	const qianBranch = (chart.mingGongBranch + 6) % 12;
	for (const palace of chart.palaces) {
		if (palace.branch !== chart.mingGongBranch && palace.branch !== qianBranch) continue;
		const jiStar = palace.stars.find(s => s.siHua === "忌" && s.type === "major");
		if (!jiStar) continue;

		const inMing = palace.branch === chart.mingGongBranch;
		patterns.push({
			name: `${jiStar.name}化忌入${inMing ? "命" : "迁"}`,
			level: "caution",
			description: inMing
				? `${jiStar.name}化忌坐命宫，需留意自身固执、心理障碍或健康隐患，凡事退一步思考。化忌不一定坏，代表此星能量需要特别关注。`
				: `${jiStar.name}化忌坐迁移宫，外出、远行、人际关系易有波折，宜守不宜动。`,
			palaces: [palace.name],
			conditions: { required: [`${jiStar.name}化忌坐${inMing ? "命" : "迁"}宫`] },
			source: "《紫微斗数全书》",
		});
	}
}

/** 羊陀夹忌：化忌坐宫，左右被擎羊陀罗夹 */
function detectYangTuoJiaJi(chart: ZiweiChart, patterns: Pattern[]) {
	for (const palace of chart.palaces) {
		const jiStar = palace.stars.find(s => s.siHua === "忌");
		if (!jiStar) continue;
		if (palace.branch !== chart.mingGongBranch) continue; // 只看命宫被夹

		const { prev, next } = getJiaPalaces(chart, palace.branch);
		if (!prev || !next) continue;
		const aPrev = hasStar(prev, "擎羊") && hasStar(next, "陀罗");
		const aNext = hasStar(prev, "陀罗") && hasStar(next, "擎羊");
		if (!aPrev && !aNext) continue;

		patterns.push({
			name: "羊陀夹忌",
			level: "caution",
			description:
				'化忌坐命，左右擎羊陀罗夹命，古书云"羊陀夹忌为败局"，主一生劳碌奔波、坎坷不顺、身心俱疲。需以德行修养与积极做事化解，凡事谨慎为上。',
			palaces: ["命宫", prev.name, next.name],
			conditions: { required: ["化忌坐命", "擎羊陀罗分居命宫前后两宫"] },
			source: "《紫微斗数骨髓赋·羊陀夹忌》",
		});
		return;
	}
}

/** 火铃夹命：火星铃星分居命宫前后 */
function detectHuoLingJiaMing(chart: ZiweiChart, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "火星") && hasStar(next, "铃星");
	const okB = hasStar(prev, "铃星") && hasStar(next, "火星");
	if (!okA && !okB) return;

	patterns.push({
		name: "火铃夹命",
		level: "caution",
		description:
			"火星铃星分居命宫前后两宫夹命，主性急、易冲动、突发意外或纠纷。需培养耐性、避免冲动决策。",
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["火星铃星分居命宫前后两宫"] },
		source: "《紫微斗数全书》",
	});
}

/** 空劫夹命：地空地劫分居命宫前后 */
function detectKongJieJiaMing(chart: ZiweiChart, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "地空") && hasStar(next, "地劫");
	const okB = hasStar(prev, "地劫") && hasStar(next, "地空");
	if (!okA && !okB) return;

	patterns.push({
		name: "空劫夹命",
		level: "caution",
		description:
			'地空地劫夹命，主财来财去、思想脱俗、易遁入宗教哲学。古书云"空劫夹命，财不聚"。宜技艺、宗教、研究等不重物质之业。',
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["地空地劫分居命宫前后两宫"] },
		source: "《紫微斗数全书》",
	});
}

/** 廉杀羊：廉贞、七杀、擎羊三星会照（流年大限最凶） */
function detectLianShaYang(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!(sanFangSet.has("廉贞") && sanFangSet.has("七杀") && sanFangSet.has("擎羊"))) return;

	patterns.push({
		name: "廉杀羊",
		level: "caution",
		description:
			"廉贞、七杀、擎羊三星会照命宫三方，古书警示之凶格。主血光、官非、意外。本命有此格不必惊慌，但流年大限再触发时需特别谨慎驾驶、避免冲突、注意手术风险。",
		palaces: ["命宫"],
		conditions: { required: ["廉贞、七杀、擎羊三星会照三方四正"] },
		source: "《紫微斗数全书·廉杀羊》",
	});
}

/** 巨火羊：巨门、火星、擎羊会照 */
function detectJuHuoYang(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!(sanFangSet.has("巨门") && sanFangSet.has("火星") && sanFangSet.has("擎羊"))) return;

	patterns.push({
		name: "巨火羊",
		level: "caution",
		description:
			'巨门、火星、擎羊三星会照，古书云"巨火羊，终身缢死"——古时凶格。现代理解为：易因口舌、激烈冲突而招大祸。需修身养性、慎言慎行，避免极端情绪。',
		palaces: ["命宫"],
		conditions: { required: ["巨门、火星、擎羊三星会照三方四正"] },
		source: "《紫微斗数骨髓赋·巨火羊》",
	});
}

/** 铃昌陀武：铃星、文昌、陀罗、武曲会照（限至投河） */
function detectLingChangTuoWu(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!(
		sanFangSet.has("铃星") &&
		sanFangSet.has("文昌") &&
		sanFangSet.has("陀罗") &&
		sanFangSet.has("武曲")
	))
		return;

	patterns.push({
		name: "铃昌陀武",
		level: "caution",
		description:
			'铃星、文昌、陀罗、武曲四星齐会，古书云"铃昌陀武，限至投河"——古时大凶格。本命有此组合本身不必恐慌，但流年大限触发时需高度警觉重大决策、情绪起伏、水边活动。',
		palaces: ["命宫"],
		conditions: { required: ["铃星、文昌、陀罗、武曲四星会照三方四正"] },
		source: "《紫微斗数骨髓赋·铃昌陀武》",
	});
}

/** 马头带箭：擎羊在午宫坐命 */
function detectMaTouDaiJian(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	if (ming.branch !== 6) return; // 必须午
	if (!hasStar(ming, "擎羊")) return;

	const required = ["擎羊于午宫坐命"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("七杀") || sanFangAllStars(chart).has("破军"))
		bonus.push("再会七杀或破军（武职大贵）");
	if (sanFangAllStars(chart).has("天魁") || sanFangAllStars(chart).has("天钺"))
		bonus.push("魁钺加照");

	patterns.push({
		name: "马头带箭",
		level: bonus.length ? "good" : "caution",
		description:
			'擎羊于午宫坐命，号"马头带箭"。古书云"威镇边疆"——主刚毅果决、有冲杀之力，宜军警武职、运动员、外科医师。但同时主危险与意外，需配合杀破狼或贵人方为大格，否则反主血光。',
		palaces: ["命宫"],
		conditions: { required, bonus },
		source: "《紫微斗数骨髓赋·马头带箭》",
	});
}

// ────────────────── 基础格局（提升识别覆盖率）──────────────────
// 设计：让普通命盘也能识别出 1-3 个常见格局，而不是 30+ 严格古书格局都不匹配。
// 这些都是单一条件触发的轻量识别，level 多为 neutral / good。

/** 禄存守身：禄存入身宫（或命宫与身宫同宫） */
function detectLuCunShouShen(chart: ZiweiChart, patterns: Pattern[]) {
	const luCunPalace = findStarPalace(chart, "禄存");
	if (!luCunPalace) return;
	const inMing = luCunPalace.branch === chart.mingGongBranch;
	const inShen = luCunPalace.branch === chart.shenGongBranch;
	if (!inMing && !inShen) return;
	patterns.push({
		name: inMing ? "禄存守命" : "禄存守身",
		level: "good",
		description: inMing
			? "禄存坐命，主一生衣食无忧、财禄稳定。性格保守，善积累，但羊陀夹禄须防小人。最宜配化禄、左辅右弼方为大格。"
			: "禄存入身宫，主中年后财源稳定、得禄自享。倪师说「禄存入身，财气近身」——配偶或事业方向能带来稳定财禄。",
		palaces: [inMing ? "命宫" : "身宫"],
		conditions: { required: [inMing ? "禄存入命宫" : "禄存入身宫"] },
		source: "《紫微斗数全书·禄存星》",
	});
}

/** 天马入命/迁：驿马星动 */
function detectTianMaRuMing(chart: ZiweiChart, patterns: Pattern[]) {
	const tianMaPalace = findStarPalace(chart, "天马");
	if (!tianMaPalace) return;
	const inMing = tianMaPalace.branch === chart.mingGongBranch;
	const inQian = tianMaPalace.branch === (chart.mingGongBranch + 6) % 12;
	if (!inMing && !inQian) return;
	patterns.push({
		name: inMing ? "天马入命" : "天马在迁",
		level: "neutral",
		description: inMing
			? "天马坐命，主一生奔波、动中得财，宜走商旅、外勤、跨界发展。倪师说「天马入命，无禄不发」——若再会禄存或化禄即「禄马交驰」之富格。"
			: "天马在迁移宫，主外出有利、远行得财，宜异乡发展。配化禄主异地生财，配煞星则旅途多波折。",
		palaces: [tianMaPalace.name],
		conditions: { required: [inMing ? "天马入命宫" : "天马入迁移宫"] },
		source: "《紫微斗数全书·天马星》",
	});
}

/** 化禄入财：财帛宫主星化禄 */
function detectHuaLuRuCai(chart: ZiweiChart, patterns: Pattern[]) {
	const cai = chart.palaces.find(p => p.name === "财帛宫");
	if (!cai) return;
	const luStar = cai.stars.find(s => s.type === "major" && s.siHua === "禄");
	if (!luStar) return;
	patterns.push({
		name: "化禄入财",
		level: "good",
		description: `${luStar.name}化禄入财帛宫，主财源畅通、收入稳定。倪师讲化禄是「正财」象征——这个化禄星所代表的能力（${luStar.name}的核心特质）是你赚钱的主轴。配禄存或天马则财源更广。`,
		palaces: ["财帛宫"],
		conditions: { required: [`${luStar.name}化禄入财帛宫`] },
		source: "《紫微斗数全书·四化论》",
	});
}

/** 化权入官：官禄宫主星化权 */
function detectHuaQuanRuGuan(chart: ZiweiChart, patterns: Pattern[]) {
	const guan = chart.palaces.find(p => p.name === "官禄宫");
	if (!guan) return;
	const quanStar = guan.stars.find(s => s.type === "major" && s.siHua === "权");
	if (!quanStar) return;
	patterns.push({
		name: "化权入官",
		level: "good",
		description: `${quanStar.name}化权入官禄宫，主事业有掌控力、能担当独当一面的职位。化权代表权力与执行力——${quanStar.name}化权说明你在事业上能成为决策者或核心执行者，宜走管理或技术权威路线。`,
		palaces: ["官禄宫"],
		conditions: { required: [`${quanStar.name}化权入官禄宫`] },
		source: "《紫微斗数全书·四化论》",
	});
}

/** 化科入命/身：科名加身 */
function detectHuaKeRuMingShen(chart: ZiweiChart, patterns: Pattern[]) {
	const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
	const shen = chart.palaces.find(p => p.branch === chart.shenGongBranch);
	const target = [ming, shen].filter((p): p is Palace => Boolean(p));
	for (const p of target) {
		const keStar = p.stars.find(s => s.type === "major" && s.siHua === "科");
		if (!keStar) continue;
		const isMing = p.branch === chart.mingGongBranch;
		patterns.push({
			name: isMing ? "化科入命" : "化科入身",
			level: "good",
			description: `${keStar.name}化科入${isMing ? "命" : "身"}宫，主名声、文书、学术运。倪师讲化科是「贵人星」——${keStar.name}化科带来的是被人看重的特质，宜从事文书、教育、研究、咨询、文创等“以名取利”的方向。`,
			palaces: [isMing ? "命宫" : "身宫"],
			conditions: { required: [`${keStar.name}化科入${isMing ? "命" : "身"}宫`] },
			source: "《紫微斗数全书·四化论》",
		});
		return; // 命和身重复时只识别一次
	}
}

/**
 * 机月同梁三星会（降级版）：天机/太阴/天同/天梁 任 3 星齐入三方四正。
 *
 * @remarks
 * 与 `detectJiYueTongLiang` 互补：四星齐由那个识别器处理，本函数只在**恰好 3 星**时触发
 * （`has.length !== 3` 即返回），两者不会重复产出。
 *
 * ⚠️ `ming` 形参**未被使用**，函数体末尾以 `void ming;` 显式吞掉 —— 判定只依赖三方四正，
 * 不需要命宫本身。保留形参是为了与其它识别器的调用签名一致，改动时别当成漏用。
 */
function detectJiYueTongLiangPartial(chart: ZiweiChart, ming: Palace, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	const has = ["天机", "太阴", "天同", "天梁"].filter(s => sanFangSet.has(s));
	if (has.length !== 3) return; // 4 星齐由 detectJiYueTongLiang 处理
	// 避免和上面 detectJiYueTongLiang 重复（4 星齐的不进这里）
	const missing = ["天机", "太阴", "天同", "天梁"].filter(s => !sanFangSet.has(s));
	patterns.push({
		name: "机月同梁三星会",
		level: "neutral",
		description: `三方四正会齐${has.join("、")}，差${missing.join("、")}未会。机月同梁不全格，文质带谋，但稳定度不如四星齐。仍宜公职、教研、医疗、服务等需要积累与稳定的行业，关键看缺位星与四化的配合。`,
		palaces: getSanFangPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: {
			required: [`三方四正会${has.join("、")}（机月同梁缺${missing.join("、")}）`],
		},
		source: "《紫微斗数全书·机月同梁格》（降级版）",
	});
	void ming;
}

/** 昌曲同会：文昌+文曲都在命三方四正 */
function detectChangQuTongHui(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("文昌") || !sanFangSet.has("文曲")) return;
	const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
	if (!ming) return;
	const inMing = hasStar(ming, "文昌") && hasStar(ming, "文曲");
	patterns.push({
		name: inMing ? "昌曲坐命" : "昌曲同会",
		level: "good",
		description: inMing
			? "文昌文曲同入命宫，主聪明俊秀、文采斐然，宜文学、教育、写作、咨询。最忌化忌——昌曲化忌主文书契约暗亏。"
			: "文昌文曲同会三方四正，主才华横溢、口才文笔俱佳。宜走需要表达与文采的行业，化科加持则名声大显。",
		palaces: ["命宫"],
		conditions: { required: ["文昌、文曲同会命宫三方四正"] },
		source: "《紫微斗数全书·文星论》",
	});
}

/** 辅弼同会：左辅+右弼都在命三方四正 */
function detectFuBiTongHui(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("左辅") || !sanFangSet.has("右弼")) return;
	patterns.push({
		name: "辅弼同会",
		level: "good",
		description:
			"左辅右弼同会命宫三方四正，主一生贵人不绝、人缘极佳。最宜领导岗位与团队合作型工作。倪师说「辅弼夹命，平生贵人多」——你不是单打独斗的命，要善用人际网络。",
		palaces: ["命宫"],
		conditions: { required: ["左辅、右弼同会命宫三方四正"] },
		source: "《紫微斗数全书·辅弼论》",
	});
}

/** 魁钺同会：天魁+天钺都在命三方四正 */
function detectKuiYueTongHui(chart: ZiweiChart, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("天魁") || !sanFangSet.has("天钺")) return;
	patterns.push({
		name: "魁钺同会",
		level: "good",
		description:
			'天魁天钺同会命宫三方四正，主"天乙贵人"加持，关键时刻总有贵人提携。倪师说「魁钺夹命，必为贵人」——遇到困难时身边会出现得力相助者，宜主动维护人脉。',
		palaces: ["命宫"],
		conditions: { required: ["天魁、天钺同会命宫三方四正"] },
		source: "《紫微斗数全书·魁钺论》",
	});
}

/** 科权双会：化科 + 化权 同会三方四正 */
function detectKeQuanShuangHui(chart: ZiweiChart, patterns: Pattern[]) {
	const sfPalaces = getSanFangPalaces(chart);
	let hasKe = false,
		hasQuan = false;
	for (const p of sfPalaces) {
		for (const s of p.stars) {
			if (s.type === "major" && s.siHua === "科") hasKe = true;
			if (s.type === "major" && s.siHua === "权") hasQuan = true;
		}
	}
	if (!hasKe || !hasQuan) return;
	patterns.push({
		name: "科权双会",
		level: "good",
		description:
			'化科 + 化权 同会三方四正，主名权双美——既有学识/名声（科），又有掌控力（权），宜走"专业权威"路线（如医生、律师、教授、技术骨干），名利双收且根基扎实。',
		palaces: ["命宫"],
		conditions: { required: ["化科、化权同会命宫三方四正"] },
		source: "《紫微斗数全书·四化会照》",
	});
}

// ────────────────── 主入口 ──────────────────
/**
 * 识别一张命盘命中的全部格局。
 *
 * @param chart - 已排好的命盘（{@link ZiweiChart}）
 * @returns 命中的格局清单，按识别器的**调用顺序**排列（上格 → 中格 → 助力格 → 恶格 →
 *   基础格局）；无命中时为**空数组**
 *
 * @remarks
 * 本模块的唯一主入口，也是解读层的数据源头：`cli/commands.ts` 的 `analyze` 把它同时放进
 * 文本输出（`【格局识别】共 N 个`）与 `--json` 的 `patterns` 字段；`purple-star.ts` 的
 * `REQUIRED_EXPORTS` 自检盯着本导出存在。
 *
 * **实现是"全量扫描 + 累积推入"**：顺序调用 41 个 `detect*` 识别器，每个自行判条件、
 * 命中就往同一个数组推入 —— 识别器之间**互不排斥**，同一张盘可以同时命中多条，
 * 甚至是互相矛盾的格局（如既有"君臣庆会"又有"紫微入命"）。这与"取最高分格局"的思路不同，
 * 是刻意的：判词交给解读层权衡，判定层不替它做取舍。
 *
 * 格局名**可能带星名**：`detectHuaLuRuMing` 产出 `${星名}化禄入命`、
 * `detectHuaJiRuMingQian` 产出 `${星名}化忌入命/迁`，故返回条目的 `name` 不全是固定表；
 * 按名字做查表比对的调用方需注意（见 `test/invariants.test.ts` 的预言机口径）。
 *
 * ⚠️ **命宫缺失即空手而归**：开头的 `if (!ming) return patterns;` 让整轮识别直接跳过，
 * 返回空数组而非报错。正常命盘必有命宫，此分支只在 `chart` 数据不完整时触发。
 *
 * ⚠️ **顺序即语义**：识别器按"上格 → 中格 → 助力格 → 恶格 → 基础格局"分组调用，改动调用
 * 顺序会改变输出的排列（`test/invariants.test.ts` 有断言按名集合比对，不按序）。
 *
 * @example
 * ```ts
 * const patterns = detectPatterns(chart);
 * for (const p of patterns) {
 *   console.log(p.name, p.level, p.palaces.join("、"));
 *   if (p.conditions?.breaking?.length) console.log("  破格：", p.conditions.breaking.join("；"));
 * }
 * ```
 */
export function detectPatterns(chart: ZiweiChart): Pattern[] {
	const patterns: Pattern[] = [];
	const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
	if (!ming) return patterns;

	// 上格
	detectJunChenQingHui(chart, ming, patterns);
	detectZiFu(chart, ming, patterns);
	detectFuXiangChaoYuan(chart, ming, patterns);
	detectYangLiangChangLu(chart, ming, patterns);
	detectHuoTanLingTan(chart, ming, patterns);
	detectWuTan(chart, ming, patterns);
	detectShaPoLang(chart, ming, patterns);
	detectJiYueTongLiang(chart, ming, patterns);

	// 中格
	detectLianXiang(chart, patterns);
	detectWuQiSha(chart, patterns);
	detectTongLiang(chart, patterns);
	detectRiYueTongGong(chart, patterns);
	detectRiYueJiaMing(chart, patterns);
	detectJuRiTongGong(chart, patterns);
	detectShiZhongYinYu(chart, ming, patterns);
	detectMingZhuChuHai(chart, ming, patterns);
	detectZiWeiInMing(chart, ming, patterns);

	// 助力格
	detectFuBiJiaMing(chart, patterns);
	detectChangQuJiaMing(chart, patterns);
	detectKuiYueJiaMing(chart, patterns);
	detectShuangLuChaoYuan(chart, ming, patterns);
	detectSanQiJiaHui(chart, patterns);
	detectHuaLuRuMing(chart, ming, patterns);

	// 恶格
	detectHuaJiRuMingQian(chart, patterns);
	detectYangTuoJiaJi(chart, patterns);
	detectHuoLingJiaMing(chart, patterns);
	detectKongJieJiaMing(chart, patterns);
	detectLianShaYang(chart, patterns);
	detectJuHuoYang(chart, patterns);
	detectLingChangTuoWu(chart, patterns);
	detectMaTouDaiJian(chart, ming, patterns);

	// 基础格局（提升识别覆盖率，让普通命盘也能识别 1-3 个）
	detectLuCunShouShen(chart, patterns);
	detectTianMaRuMing(chart, patterns);
	detectHuaLuRuCai(chart, patterns);
	detectHuaQuanRuGuan(chart, patterns);
	detectHuaKeRuMingShen(chart, patterns);
	detectJiYueTongLiangPartial(chart, ming, patterns);
	detectChangQuTongHui(chart, patterns);
	detectFuBiTongHui(chart, patterns);
	detectKuiYueTongHui(chart, patterns);
	detectKeQuanShuangHui(chart, patterns);

	return patterns;
}

// ────────────────── 命宫摘要（保持向后兼容）──────────────────
/**
 * 取命宫主星的简要概括：星名、关键词、星性。
 *
 * @param chart - 已排好的命盘
 * @returns `stars` 为命宫主星名列表（按宫内星序），`keywords` 为关键词（最多 5 个），
 *   `nature` 为星性；命宫缺失时三项皆空
 *
 * @remarks
 * 为**向后兼容**保留的轻量摘要：两张大表（`keywordMap` / `natureMap`）是按 14 主星硬编码
 * 的中文词条，故与 `patterns.ts` 其余部分不同 —— 这里**不判条件，只做映射**，属纯文案层。
 * `cli/commands.ts` 的 `analyze`（文本与 `--json` 的 `mingGongSummary`）都取它，与
 * `detectPatterns` 的输出拼成完整解读素材。
 *
 * 三处口径需要注意：
 *
 * 1. **只看主星**：`keywordMap` 与 `natureMap` 都只覆盖 14 主星，吉煞杂耀一概不参与
 * 2. **空宫给"空宫"**：`stars` 为空（命宫无主星）时 `nature` 直接是字面量 `"空宫"`，
 *    `keywords` 为空数组 —— 此时调用方需改为从**借入的对宫主星**取释义，
 *    `cli/commands.ts` 就是这么处理的（见 `Palace.borrowedStars`）
 * 3. **`nature` 与 `keywords` 都锚在首颗主星**：`nature` 取 `starNames[0]`，而
 *    `keywords` 把**所有**主星的词条摊平后 `slice(0, 5)` —— 命宫坐双主星时，
 *    首星决定星性、两星共同贡献关键词
 *
 * 未收录的星名（表外键）不会报错：`keywordMap[n] ?? []` 跳过，`nature` 兜底为空串。
 *
 * @example
 * ```ts
 * const { stars, keywords, nature } = getMingGongSummary(chart);
 * // 空宫时 stars = []、nature = "空宫"，改用 chart 里该宫的 borrowedStars 取释义
 * ```
 */
export function getMingGongSummary(chart: ZiweiChart): {
	stars: string[];
	keywords: string[];
	nature: string;
} {
	const mingPalace = chart.palaces.find(p => p.branch === chart.mingGongBranch);
	if (!mingPalace) return { stars: [], keywords: [], nature: "" };

	const majorStars = mingPalace.stars.filter(s => s.type === "major");
	const starNames = majorStars.map(s => s.name);

	const keywordMap: Record<string, string[]> = {
		紫微: ["尊贵", "独立", "领导"],
		天机: ["智慧", "机变", "善谋"],
		太阳: ["阳刚", "官贵", "慷慨"],
		武曲: ["财富", "刚毅", "果断"],
		天同: ["温和", "享福", "随缘"],
		廉贞: ["才艺", "桃花", "多变"],
		天府: ["财库", "稳重", "保守"],
		太阴: ["柔美", "财富", "细腻"],
		贪狼: ["欲望", "桃花", "多才"],
		巨门: ["善辩", "多思", "口才"],
		天相: ["辅佐", "行政", "稳健"],
		天梁: ["荫护", "医药", "长辈"],
		七杀: ["将星", "果决", "孤克"],
		破军: ["开创", "变动", "破旧"],
	};

	const natureMap: Record<string, string> = {
		紫微: "帝王星",
		天机: "智慧星",
		太阳: "贵人星",
		武曲: "财帛星",
		天同: "福德星",
		廉贞: "桃花星",
		天府: "财库星",
		太阴: "财富星",
		贪狼: "桃花星",
		巨门: "是非星",
		天相: "印绶星",
		天梁: "荫庇星",
		七杀: "将帅星",
		破军: "变动星",
	};

	const keywords = starNames.flatMap(n => keywordMap[n] ?? []).slice(0, 5);
	const nature = starNames.length > 0 ? (natureMap[starNames[0]] ?? "") : "空宫";

	return { stars: starNames, keywords, nature };
}
