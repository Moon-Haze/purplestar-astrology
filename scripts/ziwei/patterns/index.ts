/**
 * 紫微斗数格局识别（v2 严格化版本）。
 *
 * 本目录是解读层的主体：由一张已排好的 `ZiweiChart` 判出命中的格局清单，
 * 每条含名称、分级、判词、涉及宫位与**分层的成立条件**。各 `detect*` 识别器返回一个
 * `Pattern` **数组**，合计覆盖约 82 个格局名。
 *
 * ⚠️ **每个识别器当前最多产出 1 条**（0 或 1）—— 除下面点名的两个外，全部写成
 * 「命中即 `return`」，由代码结构直接保证；`detectHuaJiRuMingQian` / `detectChangQuHuaJi`
 * 按宫位/星曜逐个筛，写成累积数组，但**实测同样零多产**：生年四化由年干决定，一年只有一颗化忌星，
 * 而命宫与迁移宫互为对宫、文昌与文曲是两颗各只可能带一颗忌的星。
 * （一次性扫描实证：1950–2009 × 6 月 × 3 日 × 12 时辰 = 12960 张本命盘，两个
 * 识别器的产出条数分布均只有「0 条」与「1 条」两档。）
 *
 * 故返回类型写成 `Pattern[]` 而非 `Pattern | null`，是为了让那两个识别器在语义上表达
 * 「所有命中的都要报」，而不是「我知道会多条」。若 `mutagen` 的来源将来扩到流年 / 大限
 * 四化，它们会真的多产，届时不必改签名与调用点。
 *
 * ## 本目录的文件分工
 *
 * - `types.ts` —— **形状**：结构体、识别器入参 `DetectContext`、识别器签名 `Detector`
 * - `data.ts` —— **数据**：常量、名字裁决表，以及判词表 `PATTERN_VERDICTS`
 *   （键为判词条目名，多数即格局名，少数是按变体或一族共用的条目，口径见该文件的「判词」分区）
 * - `helpers.ts` —— **底座**：宫位 / 星曜查询与判词填充 `fillVerdict`
 * - `superior.ts` / `medium.ts` / `enhancing.ts` / `e-ge.ts` / `basic.ts` /
 *   `converged.ts` —— **判定**：各分组识别器，每组末尾导出自己的 `Detector` 数组
 * - `soul-summary.ts` —— **命宫摘要**：与判定零耦合，独立一刀
 * - `index.ts`（本文件） —— **装配**：`DETECTORS` 总表 + `detectPatterns` + 公开面 re-export
 *
 * 每个识别器的收尾统一是：先把名字算进局部 `name`，再 `return [{ name, level,
 * palaces, conditions, ...PATTERN_VERDICTS[name] }]` —— 判词**一律**从表里取，
 * 识别器文件不再出现 `description` / `topicDescription` / `source` 字面量。
 * `level` / `palaces` / `conditions` 的值是盘上算出来的，故留在识别器里。
 *
 * 识别器**不接触**任何累积数组：`Pattern[]` 是它的全部输出，并进总表的事只发生在本文件
 * 的 `detectPatterns` 里那一行 for。故「这个识别器会不会产出多条」在它的签名与 return 处
 * 直接可读 —— 从前靠"块末有没有 return"隐式表达，是看漏过的地方。
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
 *   `Star.brightness`、`Star.mutagen` 四项，不读 `description` 文本
 * - **定位宫位走地支算术**：三方四正是 `[m, (m+4), (m+8), (m+6)]`、夹宫是 `(b±1)`、
 *   对宫是 `(b+6)`（见 `helpers.ts` 的 `getSurroundPalaces` / `getJiaPalaces` / `getDuiGong`）。
 *   少数例外按**宫名**查找（`detectHuaLuRuCai` 找「财帛宫」、`detectHuaQuanRuGuan`
 *   找「官禄宫」），依赖 `algorithm.ts` 的宫名口径，见 `../constants` 的
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

import type { ZiweiChart } from "../types";
import type { Pattern, DetectContext, Detector } from "./types";

import { SHANG_GE } from "./superior";
import { ZHONG_GE } from "./medium";
import { ZHU_LI_GE } from "./enhancing";
import { E_GE } from "./malefic";
import { JI_CHU_GE } from "./basic";
import { SHOU_LIAN_GE } from "./converged";

// **原处 re-export** 拆分前就对外公开的三个类型与裁决表，使 `analysis/`（`type Pattern`）、
// `test/invariants.test.ts`（`GEJU_NAME_ALIASES`）的既有 import 一行都不用改 ——
// 本模块的公开面与拆分前**逐名一致**（原先 module-private 的 `DetectContext` 不在此列）。
export type { Pattern, PatternCondition, GejuNameAlias } from "./types";
export { GEJU_NAME_ALIASES } from "./data";
export { getMingGongSummary } from "./soul-summary";

/**
 * 识别器注册表。**顺序即语义** —— 分组与组内次序都影响 `detectPatterns` 的输出排列。
 *
 * @remarks
 * 此前这张表写在 `detectPatterns` 函数体内，拆分后提到模块作用域：它现在由各分组文件
 * 末尾的数组拼成，是**跨文件的装配点**，留在函数里反而让「一共有哪些分组」看不出来。
 *
 * 签名统一为 `Detector`（`(ctx: DetectContext) => Pattern[]`）；各识别器按需解构 ctx，
 * 因此「谁依赖命宫」在各分组文件里仍然一眼可见。
 *
 * 识别器**返回**命中结果，不碰共用数组：命中的返回 `[one]`，未命中一律返回 `[]`，
 * 并进总表只发生在下面那行 for 里。
 */
const DETECTORS: ReadonlyArray<Detector> = [
	...SHANG_GE, // 上格
	...ZHONG_GE, // 中格
	...ZHU_LI_GE, // 助力格
	...E_GE, // 恶格
	...JI_CHU_GE, // 基础格局（提升识别覆盖率，让普通命盘也能识别 1-3 个）
	...SHOU_LIAN_GE, // 由 db-analysis 侧收敛进来的判定
];

// ────────────────── 主入口 ──────────────────
/**
 * 识别一张命盘命中的全部格局。
 *
 * @param chart - 已排好的命盘（`ZiweiChart`）
 * @returns 命中的格局清单，按识别器的**调用顺序**排列（上格 → 中格 → 助力格 → 恶格 →
 *   基础格局 → 收敛组）；无命中时为**空数组**
 *
 * @remarks
 * 本模块的唯一主入口，也是解读层的数据源头：`cli/commands.ts` 的 `analyze` 把它同时放进
 * 文本输出（`【格局识别】共 N 个`）与 `--json` 的 `patterns` 字段；`purple-star.ts` 的
 * `REQUIRED_EXPORTS` 自检盯着本导出存在。
 *
 * **实现是"全量扫描 + 累积"**：按模块级的 `DETECTORS` 注册表依次调用各 `detect*` 识别器，
 * 每个自行判条件并**返回**本次命中的格局（0 条 / 1 条 / 多条），由本函数依次并进结果 ——
 * 识别器之间**互不排斥**，同一张盘可以同时命中多条，
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
 * ⚠️ **顺序即语义**：识别器分组登记在各 `*-ge.ts` 文件末尾的数组里，由本文件按
 * "上格 → 中格 → 助力格 → 恶格 → 基础格局 → 收敛组"拼接。增删条目、调整组序或组内次序，
 * 都会改变输出的排列（`test/invariants.test.ts` 有断言按名集合比对，不按序）。
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
	const ming = chart.palaces.find(p => p.branch === chart.soulBranch);
	if (!ming) return patterns;

	const ctx: DetectContext = { chart, ming };
	for (const detect of DETECTORS) patterns.push(...detect(ctx));

	return patterns;
}
