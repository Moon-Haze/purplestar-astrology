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
 * {@link surroundBranches} 返回**偏移序**（本宫 → 官禄 → 财帛 → 迁移），而
 * `ZiweiChart.palaces` 的数组序是地支序（实测寅起，见 `types.ts`）。两者在本仓都有真实
 * 用途，且都**逐字进了输出**（`analysis/` 的「大限三方四正会照的本命四化」就是一个
 * 按 `palaces` 序 push 的字符串数组），故本模块只给地支、不替调用方选顺序 ——
 * 要 `palaces` 序的自行 `chart.palaces.filter(p => surroundBranches(b).includes(p.branch))`。
 *
 * ## 依赖
 *
 * 偏移函数**纯算术**（入参与返回值全是 `number`，无任何 import）；按地支取宫的
 * 两个查询函数（{@link palaceAtBranch} / {@link mustPalaceAtBranch}，候选 8 新增）
 * 引 `./types` 的类型（type-only，运行时擦除）与 `./constants` 的 `BRANCHES`
 * （纯表零依赖）—— 无环，本模块仍处内核依赖图叶子附近。
 */

import type { ZiweiChart, Palace } from "./types";
import { BRANCHES } from "./constants";

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
 * ⚠️ 入参恒为 0–11（`Palace.branch` 与 `ZiweiChart.soulBranch` 的定义域），故**不做**
 * 两步取模 —— 越界入参会返回越界值，由调用方负责。
 */
export function oppositeBranch(branch: number): number {
	return (branch + 6) % 12;
}

/**
 * 三方四正相对本宫的地支偏移：本宫、官禄宫、财帛宫、迁移宫。
 *
 * @remarks
 * 十二宫由命宫**逆行**排布，故官禄在 `+4`、财帛在 `+8`、迁移在 `+6`（**不是**顺行）。
 * 校验见 `test/invariants.test.ts` 的「宫名与相对命宫的逆行偏移一致」。
 *
 * ⚠️ 迁移那一项与 {@link oppositeBranch} 是同一个事实（对宫），此处按三方四正的次序写进
 * 表里而非调 `oppositeBranch(+6)` —— 四个偏移同表可一眼看全，`+6` 在本表内不会再变。
 */
export const SAN_FANG_OFFSETS: readonly number[] = [0, 4, 8, 6];

/**
 * 取某宫三方四正的四个地支。
 *
 * @param branch - 本宫的地支索引（0–11）
 * @returns 本宫、官禄宫、财帛宫、迁移宫的地支，顺序即 {@link SAN_FANG_OFFSETS} 的偏移序
 */
export function surroundBranches(branch: number): number[] {
	return SAN_FANG_OFFSETS.map(o => (branch + o) % 12);
}

// ────────────────── 按地支取宫（候选 8 收敛）──────────────────
//
// 此前同一查表写在两处且语义各半：`patterns/helpers.getPalaceByBranch` 两步取模、
// 可缺省返回；`cli/render.palaceAtBranch` 不取模、取不到必得（抛错文案含 `what`）。
// 两函数现收进本模块，各自的语义原样保留 —— 薄壳留在原处，调用方一行不用改。

/**
 * 按地支取宫，取不到返回 `undefined`（两步取模，入参可为任意整数）。
 *
 * @param chart - 命盘
 * @param branch - 地支索引；可为任意整数（含负数、超出 0–11）
 * @returns 该地支对应的宫位；无匹配时返回 `undefined`
 *
 * @remarks
 * `((branch % 12) + 12) % 12` 把入参规整到 0–11。调用点因此可以直接写
 * `(branch + 11) % 12` 这类偏移算式而不必再判界。
 *
 * 与 {@link mustPalaceAtBranch} 的分工：**可能缺席**的查询用本函数（对宫/夹宫的
 * 极端输入），**必在盘上**的语义用必得版（命宫/身宫的排盘不变量）。
 */
export function palaceAtBranch(chart: ZiweiChart, branch: number): Palace | undefined {
	return chart.palaces.find(p => p.branch === ((branch % 12) + 12) % 12);
}

/**
 * 按地支取宫，取不到直接抛错（**不取模**，入参应在 0–11）。
 *
 * @param chart - 命盘
 * @param branch - 地支索引 0–11（0=子 … 11=亥）
 * @param what - 该地支的语义（「命宫」「身宫」「甲方命宫」…），只用于错误文案
 * @returns 落在该地支上的宫位
 * @throws 当地支不在 `chart.palaces` 内时，文案与旧 `cli/render.palaceAtBranch` 逐字一致
 *
 * @remarks
 * 命宫 / 身宫地支必定落在 `palaces` 内，这是排盘不变量；取不到即说明内核输出已损坏。
 * 项目一贯立场：宁可当场失败，也不要渲染出一张缺了命宫的盘。
 *
 * ⚠️ 与 {@link palaceAtBranch} 不同，本函数**不做取模**：越界入参会按原样匹配不到
 * 而抛错（文案里 `BRANCHES[branch]` 越界时回退显示数字），与旧 render 实现一致。
 */
export function mustPalaceAtBranch(chart: ZiweiChart, branch: number, what: string): Palace {
	const p = chart.palaces.find(x => x.branch === branch);
	if (!p) throw new Error(`排盘异常：${what}（地支 ${BRANCHES[branch] ?? branch}）不在十二宫内`);
	return p;
}
