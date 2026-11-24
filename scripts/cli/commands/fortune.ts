/**
 * 命令层 / selftest 两方消费；selftest 经注册层静态引入，留则测不到（静态环）。
 * ⚠️ 口径（文墨 + 倪师三合派）：宫位移动 + 三方四正 + 六层四化；
 *    宫干自化 / 来因宫不做（飞星派禁列，`AGENTS.md`「体系口径」）。
 * 八节见 docs/code/cli-commands.md。
 * ⚠️ `registerHooks` 后加载，可静态引内核。
 * @file 运限 re-export 面 —— 实现住 `../fortune/`
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
