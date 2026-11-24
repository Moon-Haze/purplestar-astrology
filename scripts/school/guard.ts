/** @file 数据驱动守卫（零运行时依赖）。 */

import type { ZiweiChart } from "../types";
import type { SchoolAdapter, ForbiddenFeature } from "./types";

/** 违例 */
export interface ForbiddenViolation {
	/** 名 */
	feature: ForbiddenFeature;
	/** 详情 */
	detail: string;
}

/**
 * 查特征。
 * @param chart - 命盘
 * @param school - 适配器
 * @returns 违例；空即合规
 * @remarks 「空壳流派不报此错」，只查 `forbiddenFeatures` 项；见 docs/code/school.md。
 */
export function checkForbiddenFeatures(
	chart: ZiweiChart,
	school: { forbiddenFeatures?: readonly ForbiddenFeature[] }
): ForbiddenViolation[] {
	const out: ForbiddenViolation[] = [];
	const forbidden = new Set<ForbiddenFeature>(school.forbiddenFeatures ?? []);

	if (forbidden.has("self-mutagen")) {
		const dirty = chart.palaces.filter(p => p.selfMutagen);
		if (dirty.length) {
			out.push({
				feature: "self-mutagen",
				detail:
					`selfMutagen 被填充：${dirty.map(p => p.name).join("、")}` +
					`（飞星派宫干自化，本项目已下线）`,
			});
		}
	}

	if (forbidden.has("lai-yin")) {
		// 来因宫：内核从无该字段（飞星派追溯法未实现），「字段被填」式检查无从谈起。
		// 守护是绊线形态：test/school.test.ts 逐宫断言 laiYin 字段缺席（评审 N6(b)），
		// 语料文本另有 selftest/chart.ts 的飞星词白名单兜底；若未来真加了字段，在此补判。
	}

	return out;
}
