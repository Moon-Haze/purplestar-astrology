/**
 * @file 流派注册表。@remarks ADR-002；加流派=写源文件+加行，typecheck 兜底，selftest 等查表；见 docs/code/school.md。
 */

import type { SchoolAdapter, SchoolId } from "./types";
import { wenmoNishiSchool } from "./schools/wenmo-nishi.ts";

/** 流派表（键=id），键序即列出/报错序。 */
export const SCHOOLS: Record<SchoolId, SchoolAdapter> = {
	"wenmo-nishi": wenmoNishiSchool,
};

/** 键集合（稳定序）；断言复用不抄。 */
export const SCHOOL_IDS: readonly SchoolId[] = Object.keys(SCHOOLS) as SchoolId[];

/** 默认流派；取首键。 */
export const DEFAULT_SCHOOL_ID: SchoolId = SCHOOL_IDS[0];
