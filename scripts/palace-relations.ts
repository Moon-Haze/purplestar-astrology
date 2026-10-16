/**
 * 宫位之间的地支关系：对宫与三方四正 —— 全仓偏移算式的**单点**（其余模块一律引用）。
 *
 * ⚠️ `test/` 里两处内联的 `(branch + 6) % 12` 是刻意的独立预言机，**不要**顺手单点化；
 *    「为什么单独成模块 / 刻意不收敛的三处 / 偏移序与 `palaces` 序之争 / 依赖方向」
 *    一并见 docs/code/chart-kernel.md。
 */

import type { ZiweiChart, Palace } from "./types";
import { BRANCHES } from "@/data/ganzhi";

/**
 * 取对宫地支。
 *
 * @param branch - 基准地支索引（0–11）
 * @returns 相隔六个地支的那一个（子↔午、丑↔未 …）
 *
 * @remarks
 * `algorithm.ts` 填 `Palace.oppositeBranch` 用的就是本函数 —— 手里有 `Palace` 时直接读字段即可。
 *
 * ⚠️ 入参恒为 0–11，故**不做**两步取模 —— 越界入参返回越界值，由调用方负责。
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
 * ⚠️ 迁移那一项与 {@link oppositeBranch} 是同一个事实，此处按次序**写进表内**而非调用它
 *    —— 四个偏移同表可一眼看全。理由见 docs/code/chart-kernel.md。
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
// 两个函数的语义各半是历史包袱（一个两步取模可缺省、一个不取模必得），原样保留；
// 来龙去脉见 docs/code/chart-kernel.md。

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
	if (!p) {throw new Error(`排盘异常：${what}（地支 ${BRANCHES[branch] ?? branch}）不在十二宫内`);}
	return p;
}
