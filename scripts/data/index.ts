/**
 * 紫微内核数据层门面 —— `scripts/data/` 的统一出口。
 *
 * 分层：`计算层（algorithm / mutagen / wenmo-brightness）→ 数据层（本目录）→ 契约层（types）`
 * 单向依赖，本目录**不得**反向 import 计算层。
 *
 * ⚠️ 本目录是**共享数据层**，判据是「被多个模块消费」：只服务单一消费者的数据表
 *    不该放这儿（`cli/birth/cities.ts` 曾单开 `cli/data/`，2026-10-13 已撤并回消费方）。
 *
 * 使用约定（优先 import 具体域文件而非本门面）与域名一览，见 docs/code/data-tables.md。
 *
 * @packageDocumentation
 */
export {
	STEMS,
	BRANCHES,
	SHICHEN,
	PALACE_NAMES_ORDER,
	IZTRO_TO_PROJECT_PALACE,
} from "../data/ganzhi";
export { NAYIN_ELEMENTS, ELEMENT_TO_JU, JU_NAMES } from "../data/wuxing";
export { SI_HUA_TABLE, TIANKUI_TABLE, LUCUN_TABLE, TIANMA_TABLE } from "../data/sihua";
export { STAR_BRIGHTNESS, STAR_DESCRIPTIONS } from "../data/stars";
export {
	WENMO_STAR_ID_TO_NAME,
	WENMO_NAME_TO_ID,
	SB_BY_SCHOOL,
	NUM_TO_CN_7,
	NUM_TO_CN_5,
	NUM_TO_CN_BY_SCHOOL,
	type BrightnessSchool,
	type SbTable,
} from "../data/wenmo-tables";
