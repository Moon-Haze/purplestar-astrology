/**
 * @file 宫位地支关系：对宫与三方四正（全仓偏移单点）。
 * @remarks 「为什么单独成模块 / 刻意不收敛的三处 / 偏移序与 `palaces` 序之争 / 依赖方向」见 docs/code/chart-kernel.md。
 */

import type { ZiweiChart, Palace } from "./types";
import { BRANCHES } from "./data/ganzhi";

/**
 * 取对宫地支。
 * @param branch - 基准地支索引 0–11
 * @returns 隔六位者（子↔午、丑↔未…）
 * @remarks `algorithm.ts` 填 `Palace.oppositeBranch` 用本函数；入参恒 0–11，不取模，越界由调用方负责，详见 docs/code/chart-kernel.md。
 */
export function oppositeBranch(branch: number): number {
	return (branch + 6) % 12;
}

/**
 * 三方四正偏移：本宫/官禄/财帛/迁移。
 * @remarks 十二宫逆行，官禄 +4、财帛 +8、迁移 +6；校验见 `test/invariants.test.ts`「宫名与相对命宫的逆行偏移一致」。迁移与 {@link oppositeBranch} 同事实写表内可一眼看全，详见 docs/code/chart-kernel.md。
 */
export const SAN_FANG_OFFSETS: readonly number[] = [0, 4, 8, 6];

/**
 * 取某宫三方四正四地支。
 * @param branch - 本宫地支索引 0–11
 * @returns 四地支，序同 {@link SAN_FANG_OFFSETS}
 */
export function surroundBranches(branch: number): number[] {
	return SAN_FANG_OFFSETS.map(o => (branch + o) % 12);
}

/** ────────────────── 按地支取宫（候选 8 收敛）────────────────── */
/** 两函数语义各半是历史包袱，原样保留； */
/** @remarks 来龙去脉见 docs/code/chart-kernel.md。 */

/**
 * 按地支取宫，取不到 `undefined`（两步取模，入参可任意整数）。
 * @param chart - 命盘
 * @param branch - 地支索引，可任意整数
 * @returns 该地支宫位；无匹配 `undefined`
 * @remarks 规整 0–11；与 {@link mustPalaceAtBranch} 分工见 docs/code/chart-kernel.md。
 */
export function palaceAtBranch(chart: ZiweiChart, branch: number): Palace | undefined {
	return chart.palaces.find(p => p.branch === ((branch % 12) + 12) % 12);
}

/**
 * 按地支取宫，取不到抛错（不取模，入参 0–11）。
 * @param chart - 命盘
 * @param branch - 地支索引 0–11（0=子…11=亥）
 * @param what - 该地支语义（「命宫」「身宫」「甲方命宫」…），仅用于错误文案
 * @returns 该地支宫位
 * @throws 地支不在 `chart.palaces` 时，文案与旧 `cli/render.palaceAtBranch` 逐字一致
 * @remarks 命宫/身宫必落盘上，取不到即内核损坏，宁失败不渲染缺宫盘；与 {@link palaceAtBranch} 不同，本函数不取模。详见 docs/code/chart-kernel.md。
 */
export function mustPalaceAtBranch<P extends { branch: number }>(
	chart: { palaces: P[] },
	branch: number,
	what: string
): P {
	const p = chart.palaces.find(x => x.branch === branch);
	if (!p) {
		throw new Error(`排盘异常：${what}（地支 ${BRANCHES[branch] ?? branch}）不在十二宫内`);
	}
	return p;
}

/** ────────────────── 按宫名取宫（必得）────────────────── */

/**
 * 按项目口径宫名取宫，取不到抛错。
 * @param chart - 命盘
 * @param palaceName - 宫名全名，如 `"夫妻宫"`/`"福德宫"`
 * @returns 该宫名宫位
 * @throws 无此宫名时列出该盘实际十二宫
 * @remarks 只认全名（第 8 宫「交友宫」）；iztro「仆役宫」及去宫字简写归参数层 FOCUS_ALIAS，不渗进取宫层——静默取「最像的那个宫」正是要防的错盘。取不到须说清名字与实际十二宫。详见 docs/code/chart-kernel.md。
 */
export function mustPalaceByName<P extends { name: string }>(
	chart: { palaces: P[] },
	palaceName: string
): P {
	const p = chart.palaces.find(x => x.name === palaceName);
	if (!p) {
		throw new Error(
			`找不到「${palaceName}」宫 —— 宫名口径与 data/ganzhi.ts 的 IZTRO_TO_PROJECT_PALACE 不一致？\n` +
				`  该盘实际十二宫：${chart.palaces.map(x => x.name).join("、")}`
		);
	}
	return p;
}
