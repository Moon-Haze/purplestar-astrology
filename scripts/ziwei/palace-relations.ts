/**
 * 宫位之间的地支关系：对宫与三方四正。
 *
 * ## 为什么单独成模块
 *
 * 这两组偏移在本仓曾被**多处各写一遍**，且绝大多数副本没有名字，只靠注释声明「与某处
 * 同源」维持一致 —— 改一处不会有任何东西发现：
 *
 * - **对宫** `(x + 6) % 12`：`algorithm.ts`（填 `Palace.oppositeBranch` 字段）、
 *   `patterns.ts` 6 处、`analysis.ts` 6 处、`cli/commands.ts` 1 处
 * - **三方四正** `[b, (b+4)%12, (b+8)%12, (b+6)%12]`：`patterns.ts` 2 处、
 *   `analysis.ts` 3 处（本命借对宫 / 大限会照 / 流年会照）、`cli/render.ts` 1 处
 *
 * 本模块是它们的单点：偏移算式**只在这里出现**，其余模块一律引用。
 *
 * ## ⚠️ 刻意**不**收敛的三处
 *
 * `test/invariants.test.ts`（验 `Palace.oppositeBranch` 与 `borrowedFromBranch`）与
 * `test/tools/year-scan.ts`（空宫借宫恒等式）里各有**内联**的 `(branch + 6) % 12`。
 * 那是有意为之的**独立预言机** —— 用「内核之外的重算」去验内核填的字段对不对；
 * 改成引用本模块就成了拿内核验内核，恒真、失去验证力。见到那几处**不要**顺手单点化。
 *
 * 判据是「这份重算是在**产出**结果还是在**核对**结果」：产出的一律收敛到本模块，
 * 核对的必须留在原地。
 *
 * ## 顺序：偏移序，不是 `palaces` 序
 *
 * {@link sanFangBranches} 返回**偏移序**（本宫 → 官禄 → 财帛 → 迁移），而
 * `ZiweiChart.palaces` 的数组序是地支序（实测寅起，见 `types.ts`）。两者在本仓都有真实
 * 用途，且都**逐字进了输出**（`analysis/` 的「大限三方四正会照的本命四化」就是一个
 * 按 `palaces` 序 push 的字符串数组），故本模块只给地支、不替调用方选顺序 ——
 * 要 `palaces` 序的自行 `chart.palaces.filter(p => sanFangBranches(b).includes(p.branch))`。
 *
 * ## 依赖
 *
 * **无**（连 `./types` 都不引，入参与返回值全是 `number`）—— 可独立成型、可单测。
 */

/**
 * 取对宫地支。
 *
 * @param branch - 基准地支索引（0–11）
 * @returns 相隔六个地支的那一个（子↔午、丑↔未 …）
 *
 * @remarks
 * `algorithm.ts` 填 `Palace.oppositeBranch` 字段用的就是本函数 —— 字段与算式同源，
 * 手里已经有 `Palace` 对象时直接读字段即可，不必绕本函数。
 *
 * ⚠️ 入参恒为 0–11（`Palace.branch` 与 `ZiweiChart.mingGongBranch` 的定义域），故**不做**
 * 两步取模 —— 越界入参会返回越界值，由调用方负责。
 */
export function duiGongBranch(branch: number): number {
	return (branch + 6) % 12;
}

/**
 * 三方四正相对本宫的地支偏移：本宫、官禄宫、财帛宫、迁移宫。
 *
 * @remarks
 * 十二宫由命宫**逆行**排布，故官禄在 `+4`、财帛在 `+8`、迁移在 `+6`（**不是**顺行）。
 * 校验见 `test/invariants.test.ts` 的「宫名与相对命宫的逆行偏移一致」。
 *
 * ⚠️ 迁移那一项与 {@link duiGongBranch} 是同一个事实（对宫），此处按三方四正的次序写进
 * 表里而非调 `duiGongBranch(+6)` —— 四个偏移同表可一眼看全，`+6` 在本表内不会再变。
 */
export const SAN_FANG_OFFSETS: readonly number[] = [0, 4, 8, 6];

/**
 * 取某宫三方四正的四个地支。
 *
 * @param branch - 本宫的地支索引（0–11）
 * @returns 本宫、官禄宫、财帛宫、迁移宫的地支，顺序即 {@link SAN_FANG_OFFSETS} 的偏移序
 */
export function sanFangBranches(branch: number): number[] {
	return SAN_FANG_OFFSETS.map(o => (branch + o) % 12);
}
