/** @file 生成物托管清单。非生成器「自报」（生成器 import 即写盘，闸门 import 会跑整流程）；
 * 两侧都消费本单，消弭「生成器加托管面、闸门不知道」的 miss，改托管面即改本单、
 * 生成器自证对齐（不对齐当场炸，宁炸不漂）。路径相对仓库根，手写件 docs/manual/README.md 不列；
 * 60-方法另有手写页不清空，无本地生成器按名拦截。
 */
/** 基线。 */
export const MANUAL_MANAGED_PATHS = [
	"docs/manual/combo-frequency.md",
	"docs/manual/geju-audit.md",
] as const;
/** 分区。 */
export const NOTES_MANAGED_DIRS = [
	"10-星曜",
	"20-宫位",
	"30-格局",
	"40-四化",
	"50-疾厄",
	"55-古籍",
	"70-课程笔记",
	"75-主星论断",
	"85-合盘断语",
] as const;
/** 60-方法。 */
export const NOTES_MANAGED_METHOD_FILES = ["引文真伪分级.md", "已核对论断"] as const;
/** 语料。 */
export const TIANJI_MANAGED_PATHS = ["scripts/corpus/data/tianji.ts"] as const;
/** 登记。 */
export const REGISTERED_GENERATED = ["scripts/data/wenmo-tables.ts"] as const;
