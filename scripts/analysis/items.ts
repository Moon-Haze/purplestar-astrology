/**
 * analysis 层 views 的内部条目模型 —— 渲染的实现形态（2026-11-05 第二投影降级：
 * 条目流不再作为公开 interface 导出，断语手册建库消费方已随 remove-manual-oracle 退役）。
 *
 * 各 `views/` 渲染器先产出 {@link AnalysisItem} 流再经 `formatItems` 投影为文本行：
 * `text` 是文本行内容（**含空行**，`text === ""` 的条目就是版式空行），其余字段是从
 * **生成该行的结构化中间量**直接携带的语义标注（不从行文本反解）——亮度来自
 * `topic_mods`、格局名来自格局检测、书证来自 `ReportCitation`。
 *
 * ⚠️ 语义字段（star/brightness/…）的前提是它有生成时的结构化来源——禁止为凑字段
 * 从 text 反解。空行条目与节头条目是渲染面专属。
 *
 * @file analysis 层 views 的内部条目模型 —— 渲染的实现形态（2026-11-05 第二投影降级：
 *
 * @packageDocumentation
 */

/** 一条结构化论断条目：一行文本 + 它的语义标注。 */
export interface AnalysisItem {
	/** 行文本内容；`""` = 版式空行（渲染面专属） */
	text: string;
	/**
	 * 条目形态：`head` = 节标题行（`**【…】**`，渲染面专属）；`content` = 内容行
	 * （空行条目也是 content——text 为空即空行）。
	 */
	kind: "head" | "content";
	/**
	 * 节槽：条目所属的语义节。固定槽用裸名（mods / geju / summary / main-palace /
	 * san-fang / sihua / year-stem / kui-yue…）；主题专属开放集用 `extra:<节名>`
	 * 前缀编码。
	 */
	slot: string;
	/** 条目主语主星（内核星表键域；节头/兜底行等无主语条目省略） */
	star?: string;
	/** 亮度（文墨 SB 口径：庙旺/得地/利益/平和/不得地/落陷） */
	brightness?: string;
	/** 化曜（禄/权/科/忌） */
	mutagen?: string;
	/** 落宫（PALACE_NAMES_ORDER 展开形） */
	palace?: string;
	/** 辅煞/次星名（✦ 行主语） */
	aux?: string;
	/** 格局名（⭐ 行，格局检测的结构化产出） */
	patternName?: string;
	/** 书证（书名·章节 与 条文原文分离；经典出处条目携带） */
	book?: { loc: string; text: string };
}

/**
 * 把一个条目流格式化成文本行序列（与行流一一对应，保真投影）。
 *
 * @param items - 条目流，按渲染顺序排列（节头 / 内容 / 版式空行混排）
 * @returns 与 `items` 等长、逐个对应的行文本；版式空行条目产出 `""`
 */
export function formatItems(items: readonly AnalysisItem[]): string[] {
	return items.map(it => it.text);
}

/**
 * 节头条目构造器（渲染面专属）。
 *
 * @param text - 节头行文本（调用方自带 `**【…】**` 标记，本函数不加工）
 * @param slot - 节槽名，决定该节头归属的语义节
 * @returns `kind` 为 `head` 的条目
 */
export function headItem(text: string, slot: string): AnalysisItem {
	return { text, slot, kind: "head" };
}

/**
 * 版式空行条目（slot 沿用所在节）。
 *
 * @param slot - 该空行所属的节槽名（调用方沿用所在节的槽，空行本身不携带语义）
 * @returns 文本为 `""`、`kind` 为 `content` 的条目
 */
export function blankItem(slot: string): AnalysisItem {
	return { text: "", slot, kind: "content" };
}

/**
 * 内容条目构造器（语义字段经 extra 携带；无版式行为——空行走 blankItem）。
 *
 * @param text - 内容行文本（可为普通断语句子）
 * @param slot - 节槽名，决定该行归属的语义节
 * @param extra - 可选的语义标注（star / brightness / mutagen / palace / aux / patternName / book 的子集）；省略时条目只带 text / slot / kind
 * @returns `kind` 为 `content` 的条目，`extra` 的字段原样并入
 */
export function contentItem(
	text: string,
	slot: string,
	extra?: Partial<Omit<AnalysisItem, "text" | "slot" | "kind">>
): AnalysisItem {
	return { text, slot, kind: "content", ...extra };
}
