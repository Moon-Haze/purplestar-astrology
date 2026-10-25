/**
 * 流派适配器接口（Phase 3 · SchoolAdapter 接缝 · ADR-004）
 *
 * 架构文档 §4.3：把"文墨亮度 + 倪师论断框架 + 飞星禁用绊线"封成一个可注册、自包含的
 * 流派扩展点。加一个新流派 = 写一个 `schools/<id>.ts` + 在 `registry.ts` 加一行，
 * 不必改排盘内核（ADR-003），也不必改 CLI 分发。
 *
 * ⚠️ **引用而非迁移（守住 Phase 0 冻结内核契约 0C 的红线）**：
 * 本接口**不持有**任何亮度表 / 四化表 / 论断文案的副本——那些是冻结内核（`wenmo-brightness.ts` /
 * `mutagen.ts` / `corpus/data/*`）的专属数据，插件只**引用**它们：
 * - 冻结内核的默认亮度流派是内核侧事实，适配器不以镜像字段记录它、更不改内核状态；
 * - `citationRoots[].checklist` 直接引用内核的 `ANNOTATIONS`（全局唯一核对表），**不另存一份**，
 *   避免副本漂移——这正是 ADR-004「核对表随插件走」的落地方式（引用走，不是复制走）。
 * 适配器是**声明式口径**：声明自己是谁、禁什么、扫哪、对哪份核对表负责。
 *
 * 接缝由来（架构文档 §4.3）与多流派隔离设计，见 docs/code/school.md。
 */

import type { AnnotationEntry } from "../corpus/data/annotations";

/**
 * 流派 id。当前仅 `wenmo-nishi`（默认）。新流派 = types 联合加分支 + registry 加一行，
 * 两处显式（与清单注册同哲学），漏改由 typecheck 兜底——不设 `(string & {})` 逃生舱，
 * 它会让「忘了在类型层声明」变得合法而不可见。
 */
export type SchoolId = "wenmo-nishi";

/**
 * 体系禁用特征（继承绊线语义的声明式表达）——闭集，与 `SchoolId` 同纪律：不设
 * `(string & {})` 逃生舱，新禁用特征走「types 联合加分支 + guard 补真检查」两处显式。
 */
export type ForbiddenFeature = "self-mutagen" | "lai-yin";

/**
 * 一个扫描根 + 它对应的引文核对表（引用，不复制）。
 *
 * @remarks
 * `scanRoot` 是绝对路径（通常一个 skill 的 `scripts/`，或某流派插件自己的目录）；
 * `checklist` 是该根下权威语料的核对表（多流派隔离的关键：每个流派只对自己声明的
 * 核对表负责，不拿别人的核对表去审自己的内容）。
 */
export interface CitationRoot {
	/** 扫描根（绝对路径） */
	scanRoot: string;
	/** 该根下允许的权威语料核对表（引用内核 `ANNOTATIONS` 等，不另存一份） */
	checklist: readonly AnnotationEntry[];
}

/** 一个流派适配器：自包含、可注册、声明式表达口径与禁区。 */
export interface SchoolAdapter {
	/** 流派 id（注册表键） */
	id: SchoolId;
	/** 人类可读名（概览 / 报错用） */
	label: string;
	/** 禁用特征（继承绊线语义）：如 ["self-mutagen","lai-yin"] */
	forbiddenFeatures?: readonly ForbiddenFeature[];
	/** 该流派权威语料核对表引用（多流派隔离，不复制核对表） */
	citationRoots: readonly CitationRoot[];
}
