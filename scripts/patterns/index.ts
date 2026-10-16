/**
 * 紫微斗数格局识别 —— 解读层的主体：由一张已排好的 `ZiweiChart` 判出命中的格局清单
 * （名称 / 分级 / 判词 / 涉及宫位 / 分层成立条件），合计约 82 个格局名。
 *
 * ⚠️ **每个识别器当前最多产出 1 条**（12960 张本命盘的实证见 docs/code/patterns.md）：
 *    返回类型写成 `Pattern[]` 是为了让那两个按宫位 / 星曜累积的识别器表达「所有命中的都要报」，
 *    而不是「我知道会多条」—— `mutagen` 将来扩到流年 / 大限四化时不必改签名。
 * ⚠️ 识别器**不接触**任何累积数组，并进总表只发生在本文件的 for 里；判词**一律**从
 *    `PATTERN_VERDICTS` 取，识别器文件不得出现 `description` / `source` 字面量。
 * ⚠️ **判定只看结构化字段**：`Palace.branch` / `Star.type` / `Star.brightness` /
 *    `Star.mutagen` 四项，不读 `description` 文本。
 *
 * 目录分工（形状 / 数据 / 判定 / 装配）、设计原则（古书条件优先、倪师立场、庙旺利陷、
 * 三方四正、夹宫）、判定实现口径、主要古籍出处与「回归与效力边界」，一并见
 * docs/code/patterns.md。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
import type { Pattern, DetectContext, Detector } from "../patterns/types";

import { SHANG_GE } from "../patterns/superior";
import { ZHONG_GE } from "../patterns/medium";
import { ZHU_LI_GE } from "../patterns/enhancing";
import { E_GE } from "../patterns/malefic";
import { JI_CHU_GE } from "../patterns/basic";
import { SHOU_LIAN_GE } from "../patterns/converged";

// **原处 re-export** 拆分前就对外公开的三个类型与裁决表，使 `analysis/`（`type Pattern`）、
// `test/invariants.test.ts`（`GEJU_NAME_ALIASES`）的既有 import 一行都不用改 ——
// 本模块的公开面与拆分前**逐名一致**（原先 module-private 的 `DetectContext` 不在此列）。
export type { Pattern, PatternCondition, GejuNameAlias } from "../patterns/types";
export { GEJU_NAME_ALIASES } from "../corpus/data/patterns";
export { getMingGongSummary } from "../patterns/soul-summary";

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
 * 本模块的唯一主入口，也是解读层的数据源头：`cli/commands/index.ts` 的 `analyze` 把它同时放进
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
	if (!ming) {return patterns;}

	const ctx: DetectContext = { chart, ming };
	for (const detect of DETECTORS) {patterns.push(...detect(ctx));}

	return patterns;
}
