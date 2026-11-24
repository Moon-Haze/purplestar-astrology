/**
 * @file 流派适配器接口
 */

import type { AnnotationEntry } from "../corpus/data/annotations";

/**
 * 流派 id；不设 `(string & {})`，否则「忘了在类型层声明」不可见。
 */
export type SchoolId = "wenmo-nishi";

/**
 * 禁用特征闭集；新增走「types 联合加分支 + guard 补真检查」。
 */
export type ForbiddenFeature = "self-mutagen" | "lai-yin";

/**
 * @remarks 各流派只对自己负责；docs/code/school.md。
 */
export interface CitationRoot {
	/** 扫描根 */
	scanRoot: string;
	/** 核对表引用 */
	checklist: readonly AnnotationEntry[];
}

/** 声明式口径与禁区 */
export interface SchoolAdapter {
	/** 流派 id */
	id: SchoolId;
	/** 可读名 */
	label: string;
	/** 禁用特征 */
	forbiddenFeatures?: readonly ForbiddenFeature[];
	/** 核对表引用 */
	citationRoots: readonly CitationRoot[];
}
