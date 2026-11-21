/**
 * 生成物托管清单 —— 生成器与 review 闸门的**共同真相源**（评审候选 3）。
 *
 * ⚠️ 为什么是独立清单而不是从生成器模块「自报」：三个生成器脚本都是 import 即执行
 *    （顶层 `main()` / 写盘），闸门 import 它们会触发整个生成流程。清单住本模块、
 *    两侧消费——「生成器加托管面、闸门不知道」的 miss 类仍结构性消失：生成器改托管
 *    面必须改本单，各生成器在运行时自证与本单对齐（不对齐当场炸，宁炸不漂）。
 *
 * 路径一律仓库根相对。手写文件（如 docs/manual/README.md）刻意不在列。
 */

/** `export-manual` 托管的格局基线产物。 */
export const MANUAL_MANAGED_PATHS = [
	"docs/manual/combo-frequency.md",
	"docs/manual/geju-audit.md",
] as const;

/** `export-notes` 清空重建的 vault 分区目录（notes/ 下，产物不入库、按需再生）。 */
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

/** `export-notes` 在 60-方法 下托管的文件（该目录另有手写页，不能整目录清空）。 */
export const NOTES_MANAGED_METHOD_FILES = ["引文真伪分级.md", "已核对论断"] as const;

/** `import-tianji` 生成并覆写的语料快照。 */
export const TIANJI_MANAGED_PATHS = ["scripts/corpus/data/tianji.ts"] as const;

/** 无本地生成器的生成物（wenmo SB 表由上游仓提取脚本产出）——登记于此，闸门按名拦截。 */
export const REGISTERED_GENERATED = ["scripts/data/wenmo-tables.ts"] as const;
