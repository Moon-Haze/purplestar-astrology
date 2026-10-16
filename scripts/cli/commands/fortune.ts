/**
 * 运限专题模块的 re-export 面 —— 实现住在 `../fortune/`（按专题分文件）。
 *
 * 存在的理由与 selftest.ts 相同：它被 commands.ts 与 selftest.ts **两方**调用，而 selftest
 * 被 commands 静态引着 —— 专题渲染若留在 cmdAnalyze 里，selftest 就测不到它（静态环）。
 *
 * ⚠️ 口径基准（文墨排盘 + 倪师三合派论断的混合口径）：运限分析 = **宫位移动 + 三方四正 +
 *    生年 / 流年 / 大限宫干 / 流月 / 流日 / 流时四化**；宫干自化与来因宫仍然不做（飞星派禁列，
 *    见仓库根 `CLAUDE.md` 的「体系口径」）。目录八节分工见 docs/code/cli-commands.md。
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核与同层模块。
 */

export { yearlyBranchOf, agePalaceOf, parseAgesArg } from "../fortune/primitives";
export { overviewSection } from "../fortune/overview";
export { infoSection, type InfoClockOpts } from "../fortune/info";
export { patternSection } from "../fortune/pattern";
export { mutagenSection, type MutagenSectionOptions } from "../fortune/mutagen";
export { yearlySection } from "../fortune/yearly";
export { decadalSection } from "../fortune/decadal";
export { ageSection } from "../fortune/age";
export { focusSection } from "../fortune/focus";
