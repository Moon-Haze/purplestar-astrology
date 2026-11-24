/**
 * 格局识别：`ZiweiChart` 判格局。
 * ⚠️ 每识别器最多 1 条（12960 盘实证）；判词取 `PATTERN_VERDICTS`，禁 `description`/`source`；只看结构化字段。
 * 「回归与效力边界」见 docs/code/patterns.md。
 * @file 格局识别
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

// 原处 re-export，公开面不变。
export type { Pattern, PatternCondition, GejuNameAlias } from "../patterns/types";
export { GEJU_NAME_ALIASES } from "../corpus/data/patterns";

/**
 * @remarks `Detector` 签名与「谁依赖命宫」「一共有哪些分组」见此（`*-ge.ts`）。
 */
const DETECTORS: ReadonlyArray<Detector> = [
	...SHANG_GE, // 上格
	...ZHONG_GE, // 中格
	...ZHU_LI_GE, // 助力格
	...E_GE, // 恶格
	...JI_CHU_GE, // 基础格局
	...SHOU_LIAN_GE, // 收敛组
];

// 主入口
/**
 * @param chart - 命盘（`ZiweiChart`）
 * @returns 命中格局清单
 * @remarks 依 `DETECTORS` 调用，识别器互不排斥；`name` 可带星名。⚠️ 命宫缺失返空数组；顺序即语义。
 * @example detectPatterns(chart)
 */
export function detectPatterns(chart: ZiweiChart): Pattern[] {
	const patterns: Pattern[] = [];
	const ming = chart.palaces.find(p => p.branch === chart.soulBranch);
	if (!ming) {
		return patterns;
	}

	const ctx: DetectContext = { chart, ming };
	for (const detect of DETECTORS) {
		patterns.push(...detect(ctx));
	}

	return patterns;
}
