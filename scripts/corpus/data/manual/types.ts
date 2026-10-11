/**
 * ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。
 * 结构定义与 `tools/db/export-manual.ts` 的 classifyOracle 对应：
 * 字段序即渲染序，各数组内行保首现序去重（跨盘变体保留）。
 */
export interface SanFangEntry {
	/** ▍ 标签最后一个「·」之后的段（真实宫名；旧库错位标签前缀已丢弃） */
	palace: string;
	/** 该宫跨盘的星曜概览变体（去重：「破军（庙旺)」/「破军」/「空宫借对宫」等） */
	stars: string[];
	/** 该宫断语：语境段落 / 缩进简述 / 借宫提示 / ✦ 次星（原行） */
	items: string[];
}
export interface SihuaEntry {
	/** 四化主行（emoji 后的原文，含星名/落宫；年干节行带「→ 意义」尾巴） */
	text: string;
	/** 主行下的缩进说明（同星同化的语义补充） */
	note?: string;
}
export interface OracleStar {
	/** 【命盘关键定制】亮度/化曜专属开场 */
	mods: string[];
	/** 【星曜深层特质】第二人称白话总述 */
	summary: string[];
	/** ⭐ 特殊格局（同名格局跨盘判词变体已换行合并） */
	patterns: { name: string; text: string }[];
	/** 【命盘推演】本宫主星行（多盘亮度变体）+ 宫语境段落 / ▶ 亮度补充 / 同宫第二主星 */
	mainPalace: { stars: string[]; content: string[] };
	/** 【三方四正联动】按宫聚合 */
	sanFang: SanFangEntry[];
	/** 四化（本命四化会照 + 年干关键宫位两节） */
	sihua: SihuaEntry[];
	/** 【贵人倾向·魁钺细分】◇ 行原文（去前缀） */
	kuiYue: string[];
	/** 主题专属节（性格深描 / 疾厄取象 / 女命妇科保养 …）—— 节名 → 行 */
	extras: Record<string, string[]>;
	/** 未归类兜底（正常为空；非空 = 渲染层出现分类器不认识的新形态，须排查） */
	other: string[];
}