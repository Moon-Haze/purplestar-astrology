/**
 * 星曜数据 —— 主星亮度表与十四主星释义（2026-10-11 从 `constants.ts` 拆出，逐字迁移）。
 *
 * ⚠️ 两张表**都无消费者**：`STAR_BRIGHTNESS` 未被运行期读取（亮度走 iztro 原文），
 *    `STAR_DESCRIPTIONS` 只影响文案、不参与安星与格局判定。
 *
 * 完整口径见 docs/code/data-tables.md。
 *
 * @packageDocumentation
 */

/**
 * 主星亮度表：星名 → `{ 地支索引 0–11 → 亮度档 }`。
 *
 * 值域是 `algorithm.ts` 的 `mapBrightness` 的**输出域**（`"bright"` / `"normal"` / `"dim"`），
 * 不是 iztro 的中文原文。中英对照：庙/旺 = `bright`、利/平 = `normal`、不利/陷 = `dim`。
 *
 * 只覆盖 **6 颗**主星（紫微、天机、太阳、武曲、天同、廉贞）—— 十四主星里的另外 8 颗不在表内。
 *
 * ⚠️ 当前 `scripts/` 与 `test/` 中**无消费者** —— 运行时的 `Star.brightness` 对**全部**
 * 主星都是直接取 iztro 的亮度字、经 `mapBrightness` 归并得来，**未走本表**。
 * 仅为数据留存，改它不会影响现有输出。
 */
export const STAR_BRIGHTNESS: Record<string, Record<number, string>> = {
	紫微: {
		2: "bright",
		5: "bright",
		8: "bright",
		11: "bright",
		1: "normal",
		4: "normal",
		7: "bright",
		10: "normal",
		0: "normal",
		3: "dim",
		6: "dim",
		9: "normal",
	},
	天机: {
		5: "bright",
		11: "bright",
		3: "bright",
		9: "bright",
		1: "normal",
		7: "normal",
		2: "dim",
		8: "dim",
		0: "normal",
		4: "normal",
		6: "normal",
		10: "normal",
	},
	太阳: {
		3: "bright",
		4: "bright",
		5: "bright",
		6: "bright",
		7: "normal",
		8: "normal",
		9: "normal",
		10: "dim",
		11: "dim",
		0: "dim",
		1: "dim",
		2: "normal",
	},
	武曲: {
		2: "bright",
		5: "bright",
		8: "bright",
		11: "bright",
		0: "normal",
		3: "normal",
		6: "normal",
		9: "normal",
		1: "dim",
		4: "dim",
		7: "dim",
		10: "dim",
	},
	天同: {
		0: "bright",
		3: "bright",
		6: "bright",
		9: "bright",
		2: "normal",
		5: "normal",
		8: "normal",
		11: "normal",
		1: "dim",
		4: "dim",
		7: "dim",
		10: "dim",
	},
	廉贞: {
		2: "bright",
		5: "bright",
		8: "bright",
		11: "bright",
		0: "normal",
		3: "normal",
		6: "normal",
		9: "normal",
		1: "dim",
		4: "dim",
		7: "dim",
		10: "dim",
	},
};

/**
 * 十四主星释义（倪海厦体系）：星名 → `{ keywords, nature, element }`。
 *
 * 消费者：`cli/commands/index.ts` 的「主星释义」查询与关键词展示；`cli/selftest/index.ts` 的完整性
 * 断言（要求恰 14 条，且键集合与 iztro 的十四主星一致）。
 *
 * ⚠️ 本表**不参与安星，也不参与格局判定**，只影响文案。增删条目会让 `selftest` 的
 * 「星曜释义条数」断言变红。注意：线上站点的 14 主星 × 主题论断库（`STAR_DB`）
 * **不在本 skill 内**，别把它和本表混为一谈。
 */
export const STAR_DESCRIPTIONS: Record<
	string,
	{
		/** 关键词，以「·」分隔（`cli/commands/index.ts` 按「·」切开后逐条展示） */
		keywords: string;
		/** 星性（如「吉星」「凶星」「中性」「中性偏吉」「凶中带吉」） */
		nature: string;
		/** 五行（「木」「火」「土」「金」「水」之一） */
		element: string;
	}
> = {
	紫微: { keywords: "帝王·尊贵·独立", nature: "中性偏吉", element: "土" },
	天机: { keywords: "智慧·机变·谋略", nature: "吉星", element: "木" },
	太阳: { keywords: "阳刚·官贵·慷慨", nature: "吉星", element: "火" },
	武曲: { keywords: "财富·刚毅·果断", nature: "中性", element: "金" },
	天同: { keywords: "温和·享福·随缘", nature: "吉星", element: "水" },
	廉贞: { keywords: "才艺·刑囚·桃花", nature: "凶中带吉", element: "火" },
	天府: { keywords: "财库·稳重·保守", nature: "吉星", element: "土" },
	太阴: { keywords: "柔美·财富·阴柔", nature: "吉星", element: "水" },
	贪狼: { keywords: "欲望·桃花·多才", nature: "中性", element: "木" },
	巨门: { keywords: "口舌·是非·善辩", nature: "凶中带吉", element: "水" },
	天相: { keywords: "辅佐·行政·印绶", nature: "吉星", element: "水" },
	天梁: { keywords: "荫护·医药·长辈", nature: "吉星", element: "土" },
	七杀: { keywords: "将星·果决·孤克", nature: "凶星", element: "金" },
	破军: { keywords: "开创·变动·破坏", nature: "凶星", element: "水" },
};
