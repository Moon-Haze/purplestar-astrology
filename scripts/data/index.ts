/**
 * 紫微内核数据层门面 —— `scripts/data/` 的统一出口。
 *
 * ## 分层
 *
 * `计算层（algorithm / mutagen / wenmo-brightness）→ 数据层（本目录）→ 契约层（types）`
 * 单向依赖。本目录**不得**反向 import 计算层，`BrightnessSchool` 因此下沉而非上浮。
 *
 * ## 域名一览
 *
 * | 文件 | 内容 | 2026-10-11 前的位置 |
 * |---|---|---|
 * | `ganzhi.ts` | 十天干、十二地支、十二时辰、宫名序列与映射 | `constants.ts` |
 * | `wuxing.ts` | 纳音五行、五行局局数与局名 | `constants.ts` |
 * | `sihua.ts` | 生年四化、天魁天钺、禄存、天马 | `constants.ts` |
 * | `stars.ts` | 主星亮度表、十四主星释义 | `constants.ts` |
 * | `wenmo-tables.ts` | 文墨 SB 四流派亮度表（生成物，勿手改） | `wenmo-brightness.ts` |
 *
 * ## 使用约定
 *
 * **优先 import 具体域文件**（`import { STEMS } from "@/data/ganzhi"`），
 * 而非本门面 —— 具体到域能在某张表增删 `export` 时把编译错误定位得更准，
 * 也让「谁依赖了哪张表」在图上一目了然。本门面服务于需要一次性取多个域的场景
 * （引导层启动自检、测试加载器都走这里）。
 *
 * ⚠️ 本目录是**共享数据层**，判据是「被多个模块消费」。只服务单一消费者的数据表
 * 不该放这儿（`cli/birth/cities.ts` 那张城市经度表曾一度单开 `cli/data/`，
 * 只有一个消费者，已于 2026-10-13 撤并回它的消费方目录）。
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