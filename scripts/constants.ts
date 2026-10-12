/**
 * 紫微斗数常量门面 —— 保持 `@/constants` 的历史导入路径不变。
 *
 * ## 为什么存在
 *
 * 本文件原有 410 行、14 张互不相关的查表。2026-10-11 按领域拆进 `data/`：
 * - `data/ganzhi.ts` —— 干支与宫名
 * - `data/wuxing.ts` —— 纳音与五行局
 * - `data/sihua.ts`  —— 四化与安星表
 * - `data/stars.ts`  —— 星曜释义与亮度
 *
 * 这里**只做 re-export**，不含任何数据或逻辑，使约 20 处外部 `@/constants`
 * 导入零改动（见 `docs/plans/2026-10-11-ziwei-three-layer-split.md` 的决策 D2）。
 *
 * ## ⚠️ 过渡期文件
 *
 * **新代码请直接 import `@/data/<域>`**，不要继续走本门面。
 * 待 `@/constants` 的引用归零后本文件删除。
 *
 * ## ⚠️ 数据目录为什么叫 `data/` 而不是 `constants/`
 *
 * `boot-hooks.ts` 的解析候选序是「同名 `.ts` 文件优先于同名目录」
 * （`test/repo.test.ts` 有断言钉死）。若 `constants/` 目录与本门面并存，
 * `./constants` 会静默解析到本门面而非目录 —— **typecheck 全绿、真跑解析错目标**。
 * 命名为 `data/` 从根上规避该歧义。
 *
 * @packageDocumentation
 */
export {
	STEMS,
	BRANCHES,
	SHICHEN,
	PALACE_NAMES_ORDER,
	IZTRO_TO_PROJECT_PALACE,
} from "./data/ganzhi";
export { NAYIN_ELEMENTS, ELEMENT_TO_JU, JU_NAMES } from "./data/wuxing";
export { SI_HUA_TABLE, TIANKUI_TABLE, LUCUN_TABLE, TIANMA_TABLE } from "./data/sihua";
export { STAR_BRIGHTNESS, STAR_DESCRIPTIONS } from "./data/stars";