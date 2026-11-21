/**
 * 天纪册代号 → 中文名（展示层映射，手写单点）。
 *
 * 册代号域 `TianjiBook` 引自生成物 `corpus/data/tianji.ts`（重导勿手改）——
 * `Record` 穷尽性由 typecheck 执行：语料重导新增册码而本表未跟时当场红，
 * 不再依赖消费点 `??` 兜底静默显原始代号。
 */
import type { TianjiBook } from "./tianji";

export const TIANJI_BOOK_NAMES: Record<TianjiBook, string> = {
	"01-stars": "主星",
	"02-palaces": "十二宫",
	"03-patterns": "格局",
	"04-sihua": "四化",
	"05-illness": "疾厄",
};
