/** @file 册名；类型引 `corpus/data/tianji.ts`。`Record` 由 typecheck 穷尽：新增册码未跟即红，不靠 `??` 兜底。 */
import type { TianjiBook } from "./tianji";

/** 册名表。 */
export const TIANJI_BOOK_NAMES: Record<TianjiBook, string> = {
	"01-stars": "主星",
	"02-palaces": "十二宫",
	"03-patterns": "格局",
	"04-sihua": "四化",
	"05-illness": "疾厄",
};
