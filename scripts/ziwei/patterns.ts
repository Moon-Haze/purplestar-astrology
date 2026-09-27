/**
 * 紫微斗数格局识别（v2 严格化版本）。
 *
 * 本模块是解读层的主体：由一张已排好的 {@link ZiweiChart} 判出命中的格局清单，
 * 每条含名称、分级、判词、涉及宫位与**分层的成立条件**。51 个 `detect*` 识别器各推入
 * 0 或 1 条 {@link Pattern}（其中火贪/铃贪、化忌入命/冲命等可推入多条），合计覆盖约 82 个
 * 格局名。
 *
 * ## 两模块分工
 *
 * 格局层拆成两个文件，本模块**只放函数**（29 个辅助函数 + 51 个识别器 + `detectPatterns`）：
 *
 * - `patterns-defs.ts` —— **静态声明**：结构体、识别器入参 `DetectContext`、常量、名字裁决表，
 *   以及判词表 `PATTERN_VERDICTS`（键为判词条目名，多数即格局名，少数是按变体或一族共用的
 *   条目，口径见该文件的「判词」分区）+ 占位符填充 `fillVerdict`
 * - `patterns.ts`（本文件） —— **行为**：怎么判、判完推入什么
 *
 * 每个识别器的收尾统一是：先把名字算进局部 `name`，再 `patterns.push({ name, level,
 * palaces, conditions, ...PATTERN_VERDICTS[name] })` —— 判词**一律**从表里取，
 * 本模块不再出现 `description` / `topicDescription` / `source` 字面量。
 * `level` / `palaces` / `conditions` 的值是盘上算出来的，故留在识别器里。
 *
 * 拆分前就对外公开的类型与裁决表在本模块**原处 re-export**，故公开面逐名未变
 * （见下方 import 区的说明）。
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
 * `test/invariants.test.ts` 的层 3 为全部约 82 个格局名建了**独立预言机**（按定义复算，
 * 不看实现），另有「化禄入财 / 化权入官」两条按偏移算术核对的断言；`cli/selftest.ts`
 * 只断言返回结构与条目必备字段。⚠️ 该预言机复刻的是**实现当前的口径**，不是照命理理想
 * 口径重写，且 `level` 分级、`description` / `conditions` 文案均不在其覆盖范围内 ——
 * 详见 `test/README.md`。
 *
 * @packageDocumentation
 */

import type { ZiweiChart, Palace, Star, SiHua } from "./types";
import type { Pattern, DetectContext } from "./patterns-defs";
import {
	SHA_NAMES,
	SHA_HARD,
	SHA_KONG,
	CHANG_QU,
	BRANCH_NAMES,
	PATTERN_VERDICTS,
	PATTERN_ASIDES,
	fillVerdict,
} from "./patterns-defs";

// 静态层（结构体 / 识别器入参 / 常量 / 名字裁决表 / 判词表）已拆到 `patterns-defs.ts`；
// 本模块只留函数。
// **原处 re-export** 拆分前就对外公开的三个类型与裁决表，使 `db-analysis.ts`（`type Pattern`）、
// `test/invariants.test.ts`（`GEJU_NAME_ALIASES`）的既有 import 一行都不用改 ——
// 本模块的公开面与拆分前**逐名一致**（原先 module-private 的 `DetectContext` 不在此列）。
export type { Pattern, PatternCondition, GejuNameAlias } from "./patterns-defs";
export { GEJU_NAME_ALIASES } from "./patterns-defs";

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

// ────────────────── 正格识别器 ──────────────────

/** 君臣庆会：紫微入命，左辅右弼同会（同宫或三方） */
function detectJunChenQingHui({ chart, ming }: DetectContext, patterns: Pattern[]) {
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

	const name = "君臣庆会";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 紫府同宫：紫微+天府同宫，且该宫为命宫或迁移宫 */
function detectZiFu({ chart }: DetectContext, patterns: Pattern[]) {
	const ziwei = findStarPalace(chart, "紫微");
	const tianfu = findStarPalace(chart, "天府");
	if (!ziwei || !tianfu || ziwei.branch !== tianfu.branch) return;

	// 判定域：同宫的那一宫必须是命宫或迁移宫。
	//
	// ⚠️ 2026-09-26 由「任一同宫皆可」收窄，取 topic 侧（db-analysis.ts 的 detectGeJu）口径 ——
	// 它只认 `hasStar('命宫'|'迁移', …)`。旧口径下紫府同宫在任何宫都成格（只把未坐命的降为 75），
	// 与 topic 侧实测 44/300 盘判定相反（如紫府坐财帛：这边报格、那边不报）。
	// 代价：紫微天府同宫于它宫时不再产出「紫府同宫」，那类盘在这两处都不再有此格局。
	// ✓ 迁移宫即命宫对宫（`(命宫 + 6) % 12`），与 `isInSanFang` 的第 4 个偏移同源。
	const inMing = ziwei.branch === chart.mingGongBranch;
	const inQianYi = ziwei.branch === (chart.mingGongBranch + 6) % 12;
	if (!inMing && !inQianYi) return;

	const required = [inMing ? "紫微天府同入命宫" : "紫微天府同入迁移宫（照命，力减）"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	const sanFangSet = sanFangAllStars(chart);
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("左辅右弼同会");
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会昌曲");
	if (hasShaInPalace(ziwei, SHA_KONG)) breaking.push("紫府宫坐空劫（破紫府之贵气）");
	if (shaCountInPalace(ziwei, SHA_HARD) >= 2) breaking.push("紫府宫见双煞同坐");

	const name = "紫府同宫";
	patterns.push({
		name,
		level: inMing && !breaking.length ? 90 : 75,
		palaces: [ziwei.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[inMing ? "紫府同宫·坐命" : "紫府同宫·照命"],
	});
}

/** 府相朝垣：天府、天相分别坐守命宫的三方四正 */
function detectFuXiangChaoYuan({ chart, ming }: DetectContext, patterns: Pattern[]) {
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

	const name = "府相朝垣";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: [tianfu.name, tianxiang.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 阳梁昌禄：太阳+天梁+文昌+禄存四星会命宫，大贵格 */
function detectYangLiangChangLu({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "阳梁昌禄";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: [sun.name, liang.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 火贪格 / 铃贪格：贪狼与火星或铃星**同宫**（不含会照） */
function detectHuoTanLingTan({ chart }: DetectContext, patterns: Pattern[]) {
	const tan = findStarPalace(chart, "贪狼");
	if (!tan) return;

	// 判定域：火/铃与贪狼**同宫**。
	//
	// ⚠️ 2026-09-26 由「同宫或三方四正会照 + 贪狼须会照命宫三方」收窄，取 topic 侧
	// （db-analysis.ts 的 detectGeJu）口径 —— 它只要求 `贪狼宫内有火铃`。
	// 旧口径的两个毛病：① 三方四正**不可传递**，`sameOrTrine` 比的是**贪狼的**三方，
	// 而 `isInSanFang` 只约束贪狼本身，于是命中盘里有一部分煞星其实照不到命宫
	// （旧断言实测 32 次命中里 12 次如此）；② 判词写「主突发横财」，但贪狼在命宫三方
	// 之外（如田宅宫）逢火铃也算，与命格无关。
	// 代价：格局不再锚定命宫，贪狼在田宅/夫妻等宫逢火铃同样成格 —— `required` 如实写出这一点。
	//
	// 火铃**同时**同宫于贪狼时只出「火贪格」：沿用 topic 的 `else if` 语义，不并列两条。
	const hasFire = hasStar(tan, "火星");
	const hasLing = hasStar(tan, "铃星");
	if (!hasFire && !hasLing) return;
	const shaName = hasFire ? "火星" : "铃星";

	const required = [`贪狼与${shaName}同宫`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (isBright(tan, "贪狼")) bonus.push("贪狼庙旺");
	if (getStarSiHua(tan, "贪狼") === "禄" || getStarSiHua(tan, "贪狼") === "权")
		bonus.push("贪狼化禄/化权");
	if (hasShaInPalace(tan, ["擎羊", "陀罗"])) breaking.push("贪狼宫又见羊陀（破横发之力）");
	if (hasShaInPalace(tan, SHA_KONG)) breaking.push("贪狼遇空劫（财来财去）");

	const name = shaName === "火星" ? "火贪格" : "铃贪格";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: [tan.name],
		conditions: { required, bonus, breaking },
		...fillVerdict(PATTERN_VERDICTS[name], { 破格: breaking.length ? "本盘破格条件已触发，发力打折。" : "" }),
	});
}

/** 武贪格：武曲+贪狼 同宫（丑、未） 或 对照 */
function detectWuTan({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "武贪格";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: [wu.name, tan.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 杀破狼：七杀、破军、贪狼三方齐聚 */
function detectShaPoLang({ chart, ming }: DetectContext, patterns: Pattern[]) {
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

	const name = "杀破狼";
	patterns.push({
		name,
		level: breaking.length ? 40 : 75,
		palaces: getSanFangPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 机月同梁：天机、太阴、天同、天梁会入命宫三方四正（四星齐为上格，只齐三星为不全格） */
function detectJiYueTongLiang({ chart, ming }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	const has = ["天机", "太阴", "天同", "天梁"].filter(s => sanFangSet.has(s));
	if (has.length < 3) return;

	// 「四星齐」与「恰好三星」原是两个格局名（机月同梁 / 机月同梁三星会），2026-09-26 合并为一个：
	// 判定域放宽到 `>= 3`，缺星时把「不全格」记进 breaking 并把 level 降为 60。
	//
	// ⚠️ 域是**三方四正**（含迁移宫），不是「命宫三方」—— topic 侧的 detectGeJu 用的是三方
	// （`[m, m+4, m+8]`），但那会丢掉全部三星盘：实测四星落在命宫三方的个数恒为 **0/1/2/4**
	// （永不为 3），故 topic 侧的 ≥3 与「三方四正四星齐」在 300 条基准上是**同一组 26 盘**。
	// 也就说那 55 张三星盘本来就是 analyze 独有的降级覆盖，topic 从不报它们、无矛盾可消；
	// 照 topic 的域收窄只会让这 55 盘彻底没有机月同梁。此处取并集（26 + 55 = 81 盘）。
	const full = has.length === 4;
	const required = [`${has.join("、")}会入命宫三方四正${full ? "（四星齐）" : `（四星中 ${has.length} 星）`}`];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangSet.has("文昌") || sanFangSet.has("文曲")) bonus.push("再会昌曲");
	if (sanFangHasSiHua(chart, "科")) bonus.push("再会化科");
	if (sanFangShaCount(chart, SHA_HARD) >= 3) breaking.push("煞星过多（机月同梁忌煞）");
	if (hasShaInPalace(ming, SHA_HARD)) breaking.push("命宫坐煞");
	if (!full) breaking.push(`三方四正只齐 ${has.length} 星（机月同梁不全格）`);

	const name = "机月同梁";
	patterns.push({
		name,
		level: full ? (breaking.length ? 75 : 90) : 60,
		palaces: getSanFangPalaces(chart)
			.filter(p => has.some(s => getMajorStarNames(p).includes(s)))
			.map(p => p.name),
		conditions: { required, bonus, breaking },
		...fillVerdict(PATTERN_VERDICTS[full ? "机月同梁·满格" : "机月同梁·不全格"], { 星: has.join("、") }),
	});
}

/** 廉贞天相：同宫 */
function detectLianXiang({ chart }: DetectContext, patterns: Pattern[]) {
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

		// 名字取古籍用语：全集·卷四「廉贞与天相同宫为『廉相格』」。全称「廉贞天相格」
		// 古籍零见，2026-09-27 按「古文优先」裁决为简称（见 GEJU_NAME_ALIASES）。
	const name = "廉相格";
	patterns.push({
		name,
		level: breaking.length ? 40 : inMing ? 75 : 60,
		palaces: [lian.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 武曲七杀：同宫，将星配财星 */
function detectWuQiSha({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "武曲七杀";
	patterns.push({
		name,
		level: breaking.length ? 40 : inMing ? 90 : 75,
		palaces: [wu.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 天同天梁：同宫 */
function detectTongLiang({ chart }: DetectContext, patterns: Pattern[]) {
	const tong = findStarPalace(chart, "天同");
	const liang = findStarPalace(chart, "天梁");
	if (!tong || !liang || tong.branch !== liang.branch) return;

	const required = ["天同天梁同宫"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("文昌")) bonus.push("文昌会照");
	if (getStarSiHua(tong, "天同") === "禄") bonus.push("天同化禄");
	if (hasShaInPalace(tong, SHA_HARD)) breaking.push("煞星同坐");

	const name = "天同天梁格";
	patterns.push({
		name,
		level: breaking.length ? 60 : 75,
		palaces: [tong.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 日月同宫：太阳太阴丑或未宫同宫 */
function detectRiYueTongGong({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "日月同宫";
	patterns.push({
		name,
		level: breaking.length ? 75 : inMing ? 90 : 75,
		palaces: [sun.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[sun.branch === 7 ? "日月同宫·未" : "日月同宫·丑"],
	});
}

/** 日月夹命：太阳太阴在命宫前后两宫 */
function detectRiYueJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "日月夹命";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: [sunPalace.name, moonPalace.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 巨日同宫：巨门太阳同入寅或申 */
function detectJuRiTongGong({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "巨日同宫";
	patterns.push({
		name,
		level: breaking.length ? 40 : inMing && ju.branch === 2 ? 90 : 75,
		palaces: [ju.name],
		conditions: { required, bonus, breaking },
		...fillVerdict(PATTERN_VERDICTS[name], { 宫: BRANCH_NAMES[ju.branch] }),
	});
}

/** 石中隐玉：巨门入命于子午宫 */
function detectShiZhongYinYu({ chart, ming }: DetectContext, patterns: Pattern[]) {
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

	const name = "石中隐玉";
	patterns.push({
		name,
		level: breaking.length ? 40 : 90,
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 明珠出海：命宫在未空宫，对宫丑宫为太阳太阴 */
function detectMingZhuChuHai({ chart, ming }: DetectContext, patterns: Pattern[]) {
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

	const name = "明珠出海";
	patterns.push({
		name,
		level: breaking.length ? 75 : 90,
		palaces: ["命宫", dui.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 紫微独坐入命 */
function detectZiWeiInMing({ chart, ming }: DetectContext, patterns: Pattern[]) {
	if (!hasStar(ming, "紫微") || hasStar(ming, "天府")) return;

	const required = ["紫微独坐命宫（无天府同坐）"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	const sanFangSet = sanFangAllStars(chart);
	if (sanFangSet.has("左辅") && sanFangSet.has("右弼")) bonus.push("左辅右弼同会");
	if (sanFangSet.has("文昌") && sanFangSet.has("文曲")) bonus.push("文昌文曲同会");
	if (!sanFangSet.has("左辅") && !sanFangSet.has("右弼")) breaking.push("无辅弼（孤君无臣）");
	if (hasShaInPalace(ming, SHA_KONG)) breaking.push("紫微遇空劫（古书最忌）");

	const name = "紫微入命";
	patterns.push({
		name,
		level: breaking.length ? 40 : bonus.length ? 90 : 75,
		palaces: ["命宫"],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 辅弼夹命 */
function detectFuBiJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "辅弼夹命";
	patterns.push({
		name,
		level: 90,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required, bonus, breaking },
		...PATTERN_VERDICTS[name],
	});
}

/** 昌曲夹命 */
function detectChangQuJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const prevHasChang = hasStar(prev, "文昌");
	const prevHasQu = hasStar(prev, "文曲");
	const nextHasChang = hasStar(next, "文昌");
	const nextHasQu = hasStar(next, "文曲");
	if (!((prevHasChang && nextHasQu) || (prevHasQu && nextHasChang))) return;

	const name = "昌曲夹命";
	patterns.push({
		name,
		level: 90,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["文昌文曲分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 魁钺夹命 */
function detectKuiYueJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "天魁") && hasStar(next, "天钺");
	const okB = hasStar(prev, "天钺") && hasStar(next, "天魁");
	if (!okA && !okB) return;

	const name = "魁钺夹命";
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["天魁天钺分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 双禄朝垣：化禄 + 禄存 同会三方 */
function detectShuangLuChaoYuan({ chart, ming }: DetectContext, patterns: Pattern[]) {
	const sanFang = getSanFangPalaces(chart);
	let huaLuFound = false;
	let luCunFound = false;
	for (const p of sanFang) {
		if (p.stars.some(s => s.siHua === "禄")) huaLuFound = true;
		if (hasStar(p, "禄存")) luCunFound = true;
	}
	if (!huaLuFound || !luCunFound) return;

	const name = "双禄朝垣";
	patterns.push({
		name,
		level: 90,
		palaces: sanFang.map(p => p.name),
		conditions: {
			required: ["化禄会照三方四正", "禄存会照三方四正"],
			breaking: hasShaInPalace(ming, SHA_KONG)
			? ["命坐空劫（双禄遇空，财来财去）"]
			: undefined,
			},
		...PATTERN_VERDICTS[name],
	});
}

/** 三奇加会：化禄 化权 化科 同会三方 */
function detectSanQiJiaHui({ chart }: DetectContext, patterns: Pattern[]) {
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

	const name = "三奇加会";
	patterns.push({
		name,
		level: 90,
		palaces: sanFangPalaces.map(p => p.name),
		conditions: { required: ["化禄、化权、化科三吉化齐会命宫三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 化禄入命/官/财 */
function detectHuaLuRuMing({ chart, ming }: DetectContext, patterns: Pattern[]) {
	const huaLuStar = ming.stars.find(s => s.siHua === "禄" && s.type === "major");
	if (!huaLuStar) return;

	const name = `${huaLuStar.name}化禄入命`;
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: [`${huaLuStar.name}化禄坐命宫`] },
		...fillVerdict(PATTERN_VERDICTS["化禄入命"], { 星: huaLuStar.name, 注: PATTERN_ASIDES["化禄入命"]?.[huaLuStar.name] ?? "" }),
	});
}

// ────────────────── 恶格识别器 ──────────────────

/** 化忌入命（坐命宫）/ 化忌冲命（坐迁移宫，对冲命宫） */
function detectHuaJiRuMingQian({ chart }: DetectContext, patterns: Pattern[]) {
	const qianBranch = (chart.mingGongBranch + 6) % 12;
	for (const palace of chart.palaces) {
		if (palace.branch !== chart.mingGongBranch && palace.branch !== qianBranch) continue;
		const jiStar = palace.stars.find(s => s.siHua === "忌" && s.type === "major");
		if (!jiStar) continue;

		const inMing = palace.branch === chart.mingGongBranch;
			// 迁移分支取名「冲命」而**不是**「入迁」：后者在本仓古籍库零见，前者有 1 处
			// （《紫微斗数全书·十二宫论·夫妻宫》）。裁决依据见 {@link GEJU_NAME_ALIASES}。
		const name = `${jiStar.name}化忌${inMing ? "入命" : "冲命"}`;
		patterns.push({
			name,
			level: 40,
			palaces: [palace.name],
			conditions: { required: [`${jiStar.name}化忌坐${inMing ? "命" : "迁"}宫`] },
			...fillVerdict(PATTERN_VERDICTS[inMing ? "化忌入命" : "化忌冲命"], { 星: jiStar.name }),
		});
	}
}

/** 羊陀夹忌：化忌坐宫，左右被擎羊陀罗夹 */
function detectYangTuoJiaJi({ chart }: DetectContext, patterns: Pattern[]) {
	for (const palace of chart.palaces) {
		const jiStar = palace.stars.find(s => s.siHua === "忌");
		if (!jiStar) continue;
		if (palace.branch !== chart.mingGongBranch) continue; // 只看命宫被夹

		const { prev, next } = getJiaPalaces(chart, palace.branch);
		if (!prev || !next) continue;
		const aPrev = hasStar(prev, "擎羊") && hasStar(next, "陀罗");
		const aNext = hasStar(prev, "陀罗") && hasStar(next, "擎羊");
		if (!aPrev && !aNext) continue;

		const name = "羊陀夹忌";
		patterns.push({
			name,
			level: 40,
			palaces: ["命宫", prev.name, next.name],
			conditions: { required: ["化忌坐命", "擎羊陀罗分居命宫前后两宫"] },
			...PATTERN_VERDICTS[name],
		});
		return;
	}
}

/** 火铃夹命：火星铃星分居命宫前后 */
function detectHuoLingJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "火星") && hasStar(next, "铃星");
	const okB = hasStar(prev, "铃星") && hasStar(next, "火星");
	if (!okA && !okB) return;

	const name = "火铃夹命";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["火星铃星分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 空劫夹命：地空地劫分居命宫前后 */
function detectKongJieJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "地空") && hasStar(next, "地劫");
	const okB = hasStar(prev, "地劫") && hasStar(next, "地空");
	if (!okA && !okB) return;

	const name = "空劫夹命";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["地空地劫分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 廉杀羊：廉贞、七杀、擎羊三星会照（流年大限最凶） */
function detectLianShaYang({ chart }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!(sanFangSet.has("廉贞") && sanFangSet.has("七杀") && sanFangSet.has("擎羊"))) return;

	const name = "廉杀羊";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["廉贞、七杀、擎羊三星会照三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 巨火羊：巨门、火星、擎羊会照 */
function detectJuHuoYang({ chart }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!(sanFangSet.has("巨门") && sanFangSet.has("火星") && sanFangSet.has("擎羊"))) return;

	const name = "巨火羊";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["巨门、火星、擎羊三星会照三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 铃昌陀武：铃星、文昌、陀罗、武曲会照（限至投河） */
function detectLingChangTuoWu({ chart }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!(
		sanFangSet.has("铃星") &&
		sanFangSet.has("文昌") &&
		sanFangSet.has("陀罗") &&
		sanFangSet.has("武曲")
	))
		return;

	const name = "铃昌陀武";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["铃星、文昌、陀罗、武曲四星会照三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 马头带箭：擎羊在午宫坐命 */
function detectMaTouDaiJian({ chart, ming }: DetectContext, patterns: Pattern[]) {
	if (ming.branch !== 6) return; // 必须午
	if (!hasStar(ming, "擎羊")) return;

	const required = ["擎羊于午宫坐命"];
	const bonus: string[] = [];
	const breaking: string[] = [];
	if (sanFangAllStars(chart).has("七杀") || sanFangAllStars(chart).has("破军"))
		bonus.push("再会七杀或破军（武职大贵）");
	if (sanFangAllStars(chart).has("天魁") || sanFangAllStars(chart).has("天钺"))
		bonus.push("魁钺加照");

	const name = "马头带箭";
	patterns.push({
		name,
		level: bonus.length ? 75 : 40,
		palaces: ["命宫"],
		conditions: { required, bonus },
		...PATTERN_VERDICTS[name],
	});
}

// ────────────────── 基础格局（提升识别覆盖率）──────────────────
// 设计：让普通命盘也能识别出 1-3 个常见格局，而不是 30+ 严格古书格局都不匹配。
// 这些都是单一条件触发的轻量识别，level 多为 neutral / good。

/** 禄存守身：禄存入身宫（或命宫与身宫同宫） */
function detectLuCunShouShen({ chart }: DetectContext, patterns: Pattern[]) {
	const luCunPalace = findStarPalace(chart, "禄存");
	if (!luCunPalace) return;
	const inMing = luCunPalace.branch === chart.mingGongBranch;
	const inShen = luCunPalace.branch === chart.shenGongBranch;
	if (!inMing && !inShen) return;
	const name = inMing ? "禄存守命" : "禄存守身";
	patterns.push({
		name,
		level: 75,
		palaces: [inMing ? "命宫" : "身宫"],
		conditions: { required: [inMing ? "禄存入命宫" : "禄存入身宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 天马入命/迁：驿马星动 */
function detectTianMaRuMing({ chart }: DetectContext, patterns: Pattern[]) {
	const tianMaPalace = findStarPalace(chart, "天马");
	if (!tianMaPalace) return;
	const inMing = tianMaPalace.branch === chart.mingGongBranch;
	const inQian = tianMaPalace.branch === (chart.mingGongBranch + 6) % 12;
	if (!inMing && !inQian) return;
	const name = inMing ? "天马入命" : "天马在迁";
	patterns.push({
		name,
		level: 60,
		palaces: [tianMaPalace.name],
		conditions: { required: [inMing ? "天马入命宫" : "天马入迁移宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 化禄入财：财帛宫主星化禄 */
function detectHuaLuRuCai({ chart }: DetectContext, patterns: Pattern[]) {
	const cai = chart.palaces.find(p => p.name === "财帛宫");
	if (!cai) return;
	const luStar = cai.stars.find(s => s.type === "major" && s.siHua === "禄");
	if (!luStar) return;
	const name = "化禄入财";
	patterns.push({
		name,
		level: 75,
		palaces: ["财帛宫"],
		conditions: { required: [`${luStar.name}化禄入财帛宫`] },
		...fillVerdict(PATTERN_VERDICTS[name], { 星: luStar.name }),
	});
}

/** 化权入官：官禄宫主星化权 */
function detectHuaQuanRuGuan({ chart }: DetectContext, patterns: Pattern[]) {
	const guan = chart.palaces.find(p => p.name === "官禄宫");
	if (!guan) return;
	const quanStar = guan.stars.find(s => s.type === "major" && s.siHua === "权");
	if (!quanStar) return;
	const name = "化权入官";
	patterns.push({
		name,
		level: 75,
		palaces: ["官禄宫"],
		conditions: { required: [`${quanStar.name}化权入官禄宫`] },
		...fillVerdict(PATTERN_VERDICTS[name], { 星: quanStar.name }),
	});
}

/** 化科入命/身：科名加身 */
function detectHuaKeRuMingShen({ chart, ming }: DetectContext, patterns: Pattern[]) {
	const shen = chart.palaces.find(p => p.branch === chart.shenGongBranch);
	const target = [ming, shen].filter((p): p is Palace => Boolean(p));
	for (const p of target) {
		const keStar = p.stars.find(s => s.type === "major" && s.siHua === "科");
		if (!keStar) continue;
		const isMing = p.branch === chart.mingGongBranch;
		const name = isMing ? "化科入命" : "化科入身";
		patterns.push({
			name,
			level: 75,
			palaces: [isMing ? "命宫" : "身宫"],
			conditions: { required: [`${keStar.name}化科入${isMing ? "命" : "身"}宫`] },
			...fillVerdict(PATTERN_VERDICTS[name], { 星: keStar.name }),
		});
		return; // 命和身重复时只识别一次
	}
}


/** 昌曲同会：文昌+文曲都在命三方四正 */
function detectChangQuTongHui({ chart, ming }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("文昌") || !sanFangSet.has("文曲")) return;
	const inMing = hasStar(ming, "文昌") && hasStar(ming, "文曲");
	const name = inMing ? "昌曲坐命" : "昌曲同会";
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: ["文昌、文曲同会命宫三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 辅弼同会：左辅+右弼都在命三方四正 */
function detectFuBiTongHui({ chart }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("左辅") || !sanFangSet.has("右弼")) return;
	const name = "辅弼同会";
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: ["左辅、右弼同会命宫三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 魁钺同会：天魁+天钺都在命三方四正 */
function detectKuiYueTongHui({ chart }: DetectContext, patterns: Pattern[]) {
	const sanFangSet = sanFangAllStars(chart);
	if (!sanFangSet.has("天魁") || !sanFangSet.has("天钺")) return;
	const name = "魁钺同会";
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: ["天魁、天钺同会命宫三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 科权双会：化科 + 化权 同会三方四正 */
function detectKeQuanShuangHui({ chart }: DetectContext, patterns: Pattern[]) {
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
	const name = "科权双会";
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: ["化科、化权同会命宫三方四正"] },
		...PATTERN_VERDICTS[name],
	});
}

// ────────────────── 收敛自 db-analysis 的格局（2026-09-27）──────────────────
// 以下 11 个识别器（产出 13 个格局名）原先**只**存在于 `db-analysis.ts` 的 `detectGeJu` 里 ——
// 那是 topic 命令展示判词时另写一遍的判定，与本文件同名格局构成两套实现。2026-09-27 起判定
// 收敛到本文件，`detectGeJu` 只按名字取用这里的产出、保留自己的倪师口吻长判词。
//
// **口径照搬，不趁迁移"顺手修正"**：判定条件逐字对齐原 `detectGeJu`（含它偏宽或偏窄之处），
// 差异要改就两侧一起改 —— `test/invariants.test.ts` 里这 13 个名字都有独立预言机盯着。
//
// `source` 照实标注：本仓古籍库（`classics --search`）查得到直接出处的写书名与篇名，
// 查不到的写「传统口诀（本仓古籍库无直接出处）」—— **不编造篇名**，等将来补录古籍再换。

/** 七杀朝斗格：七杀居寅或申，且落命宫或迁移宫（对宫紫微天府相照） */
function detectQiShaChaoDou({ chart }: DetectContext, patterns: Pattern[]) {
	const qisha = findStarPalace(chart, "七杀");
	if (!qisha) return;
	if (qisha.branch !== 2 && qisha.branch !== 8) return; // 寅=2、申=8
	const inMing = qisha.branch === chart.mingGongBranch;
	const inQianYi = qisha.branch === (chart.mingGongBranch + 6) % 12;
	if (!inMing && !inQianYi) return;

	const name = "七杀朝斗格";
	patterns.push({
		name,
		level: 90,
		palaces: [qisha.name],
		conditions: { required: ["七杀居寅宫或申宫", "七杀坐命宫或迁移宫"] },
		...fillVerdict(PATTERN_VERDICTS[name], { 宫: inMing ? "命宫" : "迁移宫" }),
	});
}

/** 日月并明格：太阳与太阴**同时**入庙（不限宫位，也不要求同宫——后者是「日月同宫」） */
function detectRiYueBingMing({ chart }: DetectContext, patterns: Pattern[]) {
	const sun = findStarPalace(chart, "太阳");
	const moon = findStarPalace(chart, "太阴");
	if (!sun || !moon) return;
	if (!isBright(sun, "太阳") || !isBright(moon, "太阴")) return;

	const name = "日月并明格";
	patterns.push({
		name,
		level: 90,
		palaces: [sun.name, moon.name],
		conditions: { required: ["太阳入庙（bright）", "太阴入庙（bright）"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 英星入庙格：破军居子或午守命 */
function detectYingXingRuMiao({ chart, ming }: DetectContext, patterns: Pattern[]) {
	if (ming.branch !== 0 && ming.branch !== 6) return; // 子=0、午=6
	if (!hasStar(ming, "破军")) return;

	const name = "英星入庙格";
	patterns.push({
		name,
		level: 90,
		palaces: ["命宫"],
		conditions: { required: ["破军居子宫或午宫", "破军坐命宫"] },
		...PATTERN_VERDICTS[chart.birthInfo?.gender === "male" ? "英星入庙格·男" : "英星入庙格·女"],
	});
}

/** 日丽中天格：太阳居午守命，光芒最盛 */
function detectRiLiZhongTian({ ming }: DetectContext, patterns: Pattern[]) {
	if (ming.branch !== 6) return; // 必须午
	if (!hasStar(ming, "太阳")) return;

	const name = "日丽中天格";
	patterns.push({
		name,
		level: 90,
		palaces: ["命宫"],
		conditions: { required: ["太阳居午宫", "太阳坐命宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 昌曲守命：文昌或文曲坐命宫（两星俱在时只出「文昌守命」，与 db-analysis 的取值一致） */
function detectChangQuShouMing({ ming }: DetectContext, patterns: Pattern[]) {
	const hasChang = hasStar(ming, "文昌");
	const hasQu = hasStar(ming, "文曲");
	if (!hasChang && !hasQu) return;
	const starName = hasChang ? "文昌" : "文曲";

	const name = `${starName}守命`;
	patterns.push({
		name,
		level: 75,
		palaces: ["命宫"],
		conditions: { required: [`${starName}坐命宫`] },
		...PATTERN_VERDICTS[name],
	});
}

/** 擎羊入命：擎羊坐命宫（刑克之星。擎羊在午守命另有更专门的「马头带箭」，两者可同时命中） */
function detectQingYangRuMing({ ming }: DetectContext, patterns: Pattern[]) {
	if (!hasStar(ming, "擎羊")) return;

	const name = "擎羊入命";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫"],
		conditions: { required: ["擎羊坐命宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 禄马交驰格：禄存与天马同宫，或同会命宫三方四正 */
function detectLuMaJiaoChi({ chart }: DetectContext, patterns: Pattern[]) {
	const lu = findStarPalace(chart, "禄存");
	const ma = findStarPalace(chart, "天马");
	if (!lu || !ma) return;
	const samePalace = lu.branch === ma.branch;
	const bothInSanFang = isInSanFang(chart, lu.branch) && isInSanFang(chart, ma.branch);
	if (!samePalace && !bothInSanFang) return;

	const name = "禄马交驰格";
	patterns.push({
		name,
		level: 90,
		palaces: samePalace ? [lu.name] : [lu.name, ma.name],
		conditions: { required: [samePalace ? "禄存与天马同宫" : "禄存与天马同会命宫三方四正"] },
		...fillVerdict(PATTERN_VERDICTS[name], { 会: samePalace ? "禄存与天马同宫" : "禄存与天马同会命宫三方四正" }),
	});
}

/** 羊陀夹命：擎羊陀罗分居命宫前后两宫（煞格） */
function detectYangTuoJiaMing({ chart }: DetectContext, patterns: Pattern[]) {
	const { prev, next } = getJiaPalaces(chart, chart.mingGongBranch);
	if (!prev || !next) return;
	const okA = hasStar(prev, "擎羊") && hasStar(next, "陀罗");
	const okB = hasStar(prev, "陀罗") && hasStar(next, "擎羊");
	if (!okA && !okB) return;

	// ⚠️ 本格与「禄存守命」在 300 条基准上**完全同盘**（安星法里擎羊恒在禄存前一位、
	// 陀罗恒在后一位），两个名字都报是照倪师侧的展示口径，不是判定分歧。
	const name = "羊陀夹命";
	patterns.push({
		name,
		level: 40,
		palaces: ["命宫", prev.name, next.name],
		conditions: { required: ["擎羊陀罗分居命宫前后两宫"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 紫府朝垣格：紫微、天府分居三方四正朝拱，而命宫本身不坐紫府 */
function detectZiFuChaoYuan({ chart, ming }: DetectContext, patterns: Pattern[]) {
	const sanFang = sanFangAllStars(chart);
	if (!sanFang.has("紫微") || !sanFang.has("天府")) return;
	if (hasStar(ming, "紫微") || hasStar(ming, "天府")) return;

	const name = "紫府朝垣格";
	patterns.push({
		name,
		level: 90,
		palaces: getSanFangPalaces(chart)
			.filter(p => hasStar(p, "紫微") || hasStar(p, "天府"))
			.map(p => p.name),
		conditions: { required: ["紫微与天府同会命宫三方四正", "命宫不坐紫微、天府"] },
		...PATTERN_VERDICTS[name],
	});
}

/** 天马落空：天马与地空、地劫、旬空或截路同宫 */
function detectTianMaLuoKong({ chart }: DetectContext, patterns: Pattern[]) {
	const ma = findStarPalace(chart, "天马");
	if (!ma) return;
	const spoilers = ["地空", "地劫", "旬空", "截路"].filter(n => hasStar(ma, n));
	if (!spoilers.length) return;

	const name = "天马落空";
	patterns.push({
		name,
		level: 40,
		palaces: [ma.name],
		conditions: { required: [`天马与${spoilers.join("、")}同宫`] },
		...fillVerdict(PATTERN_VERDICTS[name], { 煞: spoilers.join("、") }),
	});
}

/** 昌曲化忌：文昌或文曲带生年化忌（文星受伤，不限宫位） */
function detectChangQuHuaJi({ chart }: DetectContext, patterns: Pattern[]) {
	for (const starName of CHANG_QU) {
		const palace = findStarPalace(chart, starName);
		if (!palace) continue;
		if (getStarSiHua(palace, starName) !== "忌") continue;

		const name = `${starName}化忌`;
		patterns.push({
			name,
			level: 40,
			palaces: [palace.name],
			conditions: { required: [`${starName}带生年化忌`] },
			...PATTERN_VERDICTS[name],
		});
	}
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
 * **实现是"全量扫描 + 累积推入"**：按函数内的 `DETECTORS` 注册表依次调用 51 个 `detect*` 识别器，每个自行判条件、
 * 命中就往同一个数组推入 —— 识别器之间**互不排斥**，同一张盘可以同时命中多条，
 * 甚至是互相矛盾的格局（如既有"君臣庆会"又有"紫微入命"）。这与"取最高分格局"的思路不同，
 * 是刻意的：判词交给解读层权衡，判定层不替它做取舍。
 *
 * 格局名**可能带星名**：`detectHuaLuRuMing` 产出 `${星名}化禄入命`、
 * `detectHuaJiRuMingQian` 产出 `${星名}化忌入命/冲命`，故返回条目的 `name` 不全是固定表；
 * 按名字做查表比对的调用方需注意（见 `test/invariants.test.ts` 的预言机口径）。
 *
 * ⚠️ **命宫缺失即空手而归**：开头的 `if (!ming) return patterns;` 让整轮识别直接跳过，
 * 返回空数组而非报错。正常命盘必有命宫，此分支只在 `chart` 数据不完整时触发。
 *
 * ⚠️ **顺序即语义**：识别器全部登记在函数内的 `DETECTORS` 表里，按"上格 → 中格 → 助力格 →
 * 恶格 → 基础格局 → 收敛组"分组排列。增删条目、调整组序或组内次序，都会改变输出的排列
 * （`test/invariants.test.ts` 有断言按名集合比对，不按序）。
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

	// 识别器注册表。**顺序即语义** —— 分组与组内次序都影响输出排列（见函数头说明）。
	// 签名统一为 ({ chart, ming }: DetectContext, patterns)；各识别器按需解构，
	// 因此「谁依赖命宫」在下表里仍然一眼可见。
	const DETECTORS: ReadonlyArray<(ctx: DetectContext, patterns: Pattern[]) => void> = [
		// 上格
		detectJunChenQingHui,
		detectZiFu,
		detectFuXiangChaoYuan,
		detectYangLiangChangLu,
		detectHuoTanLingTan,
		detectWuTan,
		detectShaPoLang,
		detectJiYueTongLiang,

		// 中格
		detectLianXiang,
		detectWuQiSha,
		detectTongLiang,
		detectRiYueTongGong,
		detectRiYueJiaMing,
		detectJuRiTongGong,
		detectShiZhongYinYu,
		detectMingZhuChuHai,
		detectZiWeiInMing,

		// 助力格
		detectFuBiJiaMing,
		detectChangQuJiaMing,
		detectKuiYueJiaMing,
		detectShuangLuChaoYuan,
		detectSanQiJiaHui,
		detectHuaLuRuMing,

		// 恶格
		detectHuaJiRuMingQian,
		detectYangTuoJiaJi,
		detectHuoLingJiaMing,
		detectKongJieJiaMing,
		detectLianShaYang,
		detectJuHuoYang,
		detectLingChangTuoWu,
		detectMaTouDaiJian,

		// 基础格局（提升识别覆盖率，让普通命盘也能识别 1-3 个）
		detectLuCunShouShen,
		detectTianMaRuMing,
		detectHuaLuRuCai,
		detectHuaQuanRuGuan,
		detectHuaKeRuMingShen,
		detectChangQuTongHui,
		detectFuBiTongHui,
		detectKuiYueTongHui,
		detectKeQuanShuangHui,

		// 2026-09-27 由 db-analysis 侧收敛进来的判定（原先那边另写一遍，见本组识别器的段首说明）
		detectQiShaChaoDou,
		detectRiYueBingMing,
		detectYingXingRuMiao,
		detectRiLiZhongTian,
		detectChangQuShouMing,
		detectQingYangRuMing,
		detectLuMaJiaoChi,
		detectYangTuoJiaMing,
		detectZiFuChaoYuan,
		detectTianMaLuoKong,
		detectChangQuHuaJi,
	];

	for (const detect of DETECTORS) detect({ chart, ming }, patterns);

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
