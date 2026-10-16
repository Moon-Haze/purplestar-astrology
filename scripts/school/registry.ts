/**
 * 流派注册表（Phase 3 · SchoolAdapter 接缝 · ADR-002：清单注册而非文件系统自动发现）
 *
 * 把各流派收成一张声明式注册表。CLI / 引文守卫 / selftest 只查这张表，不再写死"只有倪师"。
 * 新增一个流派 = 写一个 `schools/<id>.ts` + 下面加一行，不必改排盘内核（ADR-003），
 * 也不必改任何分发入口。typecheck 兜底：漏注册即报错。
 *
 * ⚠️ `SCHOOLS` 的**键序即概览列出与报错提示的顺序**；`SCHOOL_IDS` 是键集合的单一真相源，
 *    自检断言复用它，**不手抄字符串**。
 *
 * 清单注册的取舍（ADR-002）与新增流派的步骤，见 docs/code/school.md。
 */

import type { SchoolAdapter, SchoolId } from "./types";
import { wenmoNishiSchool } from "./schools/wenmo-nishi.ts";

/** 所有已注册流派（键 = 流派 id）。顺序即概览列出与报错提示的顺序。 */
export const SCHOOLS: Record<SchoolId, SchoolAdapter> = {
	"wenmo-nishi": wenmoNishiSchool,
};

/** 注册表键集合（稳定顺序）；自检断言复用，不手抄字符串。 */
export const SCHOOL_IDS: readonly SchoolId[] = Object.keys(SCHOOLS);

/** 当前生效的默认流派（单 skill 形态下即默认流派）。 */
export const DEFAULT_SCHOOL_ID: SchoolId = "wenmo-nishi";
