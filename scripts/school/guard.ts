/**
 * 流派禁用特征守卫（Phase 3 · SchoolAdapter 接缝 · ADR-004）
 *
 * 把"飞星派逻辑不得回流"的绊线语义从**硬编码字段检查**升级为**读 `SchoolAdapter.forbiddenFeatures`
 * 的声明式检查**（计划里程碑 3C）。同一份逻辑同时被两处消费：
 * - `test/school.test.ts`（用 300 条真实基准盘，覆盖面大）
 * - `scripts/cli/selftest/chart.ts`（CLI 启动期自检）
 *
 * ⚠️ 本模块**零运行时依赖**（只 import 类型）：`checkForbiddenFeatures` 是纯函数，
 * 输入一张盘与一个流派适配器，输出违例清单。它不 import 任何内核状态、不触发排盘，
 * 因此被 selftest 在启动期调用时几乎零成本。
 */

import type { ZiweiChart } from "../types";
import type { SchoolAdapter, ForbiddenFeature } from "./types";

/** 一条禁用特征违例。 */
export interface ForbiddenViolation {
	/** 触发的禁用特征名 */
	feature: ForbiddenFeature;
	/** 人类可读的违例详情 */
	detail: string;
}

/**
 * 检查一张盘是否触发某流派的任一禁用特征。
 *
 * @param chart - 已排好的命盘
 * @param school - 当前流派适配器（读其 `forbiddenFeatures`）
 * @returns 触发的违例清单；空数组表示合规
 *
 * @remarks
 * 关键在**数据驱动**：只有 `school.forbiddenFeatures` 里声明的特征才会被检查。
 * 一个不声明 `self-mutagen` 的空壳流派 → 返回空数组（即"加空壳新流派不报此错"，
 * 计划 Phase 3 退出标准之一）。这把原硬编码的"飞星派字段必须恒空"升级为可随流派增减的声明。
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
		// 来因宫：当前内核不产出该字段（飞星派追溯法未实现），故此处无可查；
		// 若未来某版本误加了来因宫字段，在此补判即可，无需改调用方。
	}

	return out;
}
