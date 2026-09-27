/**
 * 格局层的**辅助底座**：宫位 / 星曜查询与判词填充。
 *
 * @remarks
 * 这里的函数只回答「盘上有什么」，不做任何格局判定 —— 判定在各 `<分组>-ge.ts` 里。
 * 它们被识别器重度共享（`hasStar` / `sanFangAllStars` / `findStarPalace` 各有十几到二十几处调用点），
 * 故必须先于识别器独立成文件，否则每个分组文件都要反向 import 母文件。
 *
 * 本文件在同目录内**全部导出**，但**不属于格局层的公开面**：`./index` 只对外暴露
 * `detectPatterns` / `getMingGongSummary` 与类型名，不转发这里的任何一个。
 *
 * ## 定位宫位走地支算术
 *
 * 三方四正是 `[m, (m+4), (m+8), (m+6)]`、夹宫是 `(b±1)`、对宫是 `(b+6)`
 * （见 `getSanFangPalaces` / `getJiaPalaces` / `getDuiGong`）。
 * 偏移算式**全仓单点**在 `../palace-relations`，本文件只做「按宫取星」。
 *
 * @packageDocumentation
 */

import type { ZiweiChart, Palace, Star, SiHua } from "../types";
import type { PatternVerdict } from "./types";
import { SHA_NAMES, SHA_HARD, SHA_KONG } from "./data";
import { duiGongBranch, sanFangBranches } from "../palace-relations";

// ────────────────── 辅助函数 ──────────────────

// ── 本模块用到的宫位关系，全部取自 `./palace-relations` ──
//
// 对宫与三方四正的偏移算式原先在**全仓多处各写一遍**（本模块内对宫 6 处、三方四正 2 处，
// 另有 `algorithm.ts` / `analysis.ts` / `cli/` 各处），且多数副本没有名字、只靠注释声明
// 「与某处同源」维持一致。现统一由 `./palace-relations` 单点提供，本模块只负责把
// 「命宫」这一上下文代入 —— 格局判定看的恒是**命宫**的三方四正。

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
export function getMajorStarNames(palace: Palace): string[] {
	return palace.stars.filter(s => s.type === "major").map(s => s.name);
}
/**
 * 在一宫内按星名取星。
 *
 * @param palace - 目标宫位
 * @param name - 星曜中文名
 * @returns 命中的 `Star`；该宫无此星时返回 `undefined`
 *
 * @remarks
 * 与 {@link hasStar} 的差别是返回值：需要读亮度 / 四化时用本函数，只问有无时用 `hasStar`。
 * 同名星同宫出现多次时只取首个（`find` 语义）。
 */
export function findStar(palace: Palace, name: string): Star | undefined {
	return palace.stars.find(s => s.name === name);
}
/**
 * 判断一宫内是否有某星。
 *
 * @param palace - 目标宫位
 * @param name - 星曜中文名
 * @returns 该宫含此星则为 `true`
 */
export function hasStar(palace: Palace, name: string): boolean {
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
export function findStarPalace(chart: ZiweiChart, name: string): Palace | undefined {
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
 * `(branch + 11) % 12` 这类偏移算式而不必再判界（对宫偏移另见 `duiGongBranch`）。
 */
export function getPalaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
	return chart.palaces.find(p => p.branch === ((branch % 12) + 12) % 12);
}
/**
 * 数一宫内的煞星个数。
 *
 * @param palace - 目标宫位
 * @param list - 煞星名单，默认 `SHA_HARD`（四煞）
 * @returns 该宫中属于 `list` 的星数
 *
 * @remarks
 * 逐星计数，故一宫同时坐羊、陀会返回 2。默认口径是四煞而非六煞 —— 空劫要单独数时
 * 显式传 `SHA_KONG`。
 */
export function shaCountInPalace(palace: Palace, list: string[] = SHA_HARD): number {
	return palace.stars.filter(s => list.includes(s.name)).length;
}
/**
 * 判断一宫内是否坐着煞星。
 *
 * @param palace - 目标宫位
 * @param list - 煞星名单，默认 `SHA_NAMES`（六煞，含空劫）
 * @returns 命中名单中任意一颗即为 `true`
 *
 * @remarks
 * ⚠️ 默认口径与 {@link shaCountInPalace} **不同**：这里默认六煞（含空劫），那里默认四煞。
 * 需要"坐四煞"而非"坐六煞"时显式传 `SHA_HARD`（如 `detectWuQiSha`、
 * `detectTongLiang` 就是这么调的）。
 */
export function hasShaInPalace(palace: Palace, list: string[] = SHA_NAMES): boolean {
	return palace.stars.some(s => list.includes(s.name));
}
/**
 * 取命宫的三方四正。
 *
 * @param chart - 命盘
 * @returns 命宫、官禄宫、财帛宫、迁移宫四个宫位
 *
 * @remarks
 * 偏移表见 `./palace-relations` 的 `SAN_FANG_OFFSETS`，本函数是其「取宫位」视图
 * （`sanFangBranches` 取地支，本函数再映射成 `Palace`，基准一律是**命宫**）。
 * 偏移方向以 `test/invariants.test.ts` 的
 * 「宫名与相对命宫的逆行偏移一致」为准 —— 十二宫由命宫**逆行**排布，别想当然写成顺行。
 *
 * ⚠️ 返回顺序是 **`chart.palaces` 的地支序**（`filter` 保持原数组序），不是偏移表的偏移序，
 * 也不是宫位顺序；需要稳定顺序时请自行排序。正常命盘恒返回 4 个宫位。
 */
export function getSanFangPalaces(chart: ZiweiChart): Palace[] {
	const branches = sanFangBranches(chart.mingGongBranch);
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
 * 与 {@link getSanFangPalaces} 同一来源（`sanFangBranches`），只是直接判地支、
 * 不取 `Palace` 对象 —— 识别器里高频调用（如火贪/武贪的"会照命宫三方"关卡）。
 *
 * ⚠️ 入参不做 `% 12` 规整，与 {@link getPalaceByBranch} 不同：传入越界值一律判 `false`，
 * 不会误命中。
 */
export function isInSanFang(chart: ZiweiChart, branch: number): boolean {
	return sanFangBranches(chart.mingGongBranch).includes(branch);
}
/**
 * 取对宫。
 *
 * @param chart - 命盘
 * @param branch - 基准地支索引
 * @returns 相隔六个地支的那个宫位；无匹配时返回 `undefined`
 *
 * @remarks
 * 偏移算式见 `duiGongBranch`（与 `algorithm.ts` 填的 `Palace.oppositeBranch` 同源）。
 * 手里已经有 `Palace` 对象时，直接读它的 `oppositeBranch` 字段即可，不必绕本函数。
 */
export function getDuiGong(chart: ZiweiChart, branch: number): Palace | undefined {
	return getPalaceByBranch(chart, duiGongBranch(branch));
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
 * 一律先 `if (!prev || !next) return [];`，因为缺一宫就构不成"夹"。
 */
export function getJiaPalaces(chart: ZiweiChart, branch: number): { prev?: Palace; next?: Palace } {
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
export function sanFangAllStars(chart: ZiweiChart): Set<string> {
	return new Set(getSanFangPalaces(chart).flatMap(p => p.stars.map(s => s.name)));
}
/**
 * 数命宫三方四正内的煞星个数。
 *
 * @param chart - 命盘
 * @param list - 煞星名单，默认 `SHA_HARD`（四煞）
 * @returns 四宫煞星数之和
 *
 * @remarks
 * 逐宫累加（`reduce` + {@link shaCountInPalace}），故**保留重复计数** —— 与
 * {@link sanFangAllStars} 的去重语义相反，这正是"三方煞重"类破格条件所需。
 */
export function sanFangShaCount(chart: ZiweiChart, list: string[] = SHA_HARD): number {
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
export function isBright(palace: Palace, starName: string): boolean {
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
export function isDim(palace: Palace, starName: string): boolean {
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
export function getStarSiHua(palace: Palace, starName: string): Star["siHua"] | undefined {
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
export function palaceHasSiHua(palace: Palace, hua: SiHua): boolean {
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
export function sanFangHasSiHua(chart: ZiweiChart, hua: SiHua): boolean {
	return getSanFangPalaces(chart).some(p => palaceHasSiHua(p, hua));
}


// ────────────────── 判词填充 ──────────────────
/**
 * 把判词里的 `{占位符}` 换成实参。没给值的占位符**原样保留** —— 这样漏填会以
 * `{星}化禄坐命` 这种可见的畸形判词暴露出来，而不是静默产出空串。
 *
 * @param verdict - 判词表里的一条（`data.ts` 的 `PATTERN_VERDICTS`）
 * @param vars - 占位符名 → 实参，键**不含**花括号（`{ 星: "武曲" }`）
 * @returns 替换后的**新对象**；入参不被修改
 *
 * @remarks
 * 占位符约定与表键口径见 `data.ts` 的「判词」分区注释。本函数原先住在格局层的
 * 静态声明文件里，2026-09-27 拆出「形状 / 数据」两个文件时，按声明与实现分离的
 * 立场移回实现侧 —— 它是纯函数，且只被同目录的识别器调用点使用。
 */
export function fillVerdict(verdict: PatternVerdict, vars: Record<string, string>): PatternVerdict {
	const sub = (s: string): string => s.replace(/\{([^{}]+)\}/g, (m, k: string) => vars[k] ?? m);
	const out: PatternVerdict = { description: sub(verdict.description) };
	if (verdict.topicDescription !== undefined)
		out.topicDescription = sub(verdict.topicDescription);
	if (verdict.source !== undefined) out.source = sub(verdict.source);
	return out;
}
