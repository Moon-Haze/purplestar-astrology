/**
 * 单向依赖：计算层 → 数据层 → 契约层；不得反向 import 计算层。
 * ⚠️ 共享判据「被多个模块消费」：单一消费者表不收
 *    （`cli/birth/cities.ts` 曾单开 `cli/data/`，2026-10-13 撤并回消费方）。
 * 优先 import 具体域文件；域名见 docs/code/data-tables.md。
 * @file `scripts/data/` 数据层门面
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
