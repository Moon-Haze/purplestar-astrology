/**
 * 倪海厦 天纪 / 地纪 / 人纪 — 共享类型定义
 *
 * 三纪的分册数据（`tianji.ts` / `renji.ts` / `diji.ts`）与本模块同一层，
 * 统一由 `./index` 转出。
 *
 * @packageDocumentation
 */

/** 三纪分类：`tianji` 天纪 / `diji` 地纪 / `renji` 人纪 */
export type SanJiCategory = "tianji" | "diji" | "renji";

/**
 * 课程/模块 —— 三纪数据的基本单元。
 *
 * @remarks
 * `TIANJI_MODULES` / `RENJI_MODULES` / `DIJI_MODULES` 三个数组的元素类型都是它，
 * 故 `nihai` 命令可以不分纪地统一遍历输出。
 */
export interface NiModule {
	/** 模块 id，形如 `tj-ziwei` / `rj-zhenjiu` / `dj-guojiadili`（纪前缀 + 模块简写） */
	id: string;
	/** 所属纪，决定本模块落在 `TIANJI_MODULES` 还是另两份数组里 */
	category: SanJiCategory;
	/** 中文名 */
	name: string;
	/** 英文名 */
	nameEn: string;
	/** 简短副标题 */
	subtitle: string;
	/** 简要描述 */
	description: string;
	/** 详细介绍（多段） */
	details: string[];
	/** 学派归属 */
	school?: string;
	/** 课时信息 */
	lessons?: string;
	/** 参考书目 */
	references: string[];
	/** 核心概念/关键词 */
	keywords: string[];
	/** 图标字符 */
	icon: string;
	/** 状态 */
	status: "active" | "preview" | "coming";
	/** 排序权重 */
	order: number;
	/** 路由 slug */
	slug: string;
	/** 子章节 */
	chapters: NiChapter[];
}

/** 章节 —— 模块下的子单元，承载讲义要点与倪师语录。 */
export interface NiChapter {
	/** 章节 id，形如 `tj-zw-01`（模块 id + 两位序号） */
	id: string;
	/** 章节标题 */
	title: string;
	/** 章节副标题（可选） */
	subtitle?: string;
	/** 章节介绍 */
	description: string;
	/** 核心要点 */
	keyPoints: string[];
	/** 倪师语录 */
	quotes?: string[];
	/** 排序 */
	order: number;
}

/** 易经六十四卦 —— 天纪「易经」模块的细目数据（见 `tianji.ts` 的 `HEXAGRAMS`）。 */
export interface Hexagram {
	/** 卦序 1–64 */
	number: number;
	/** 卦名，如「履」「乾」 */
	name: string;
	/** 卦象描述 如「天泽履」 */
	composition: string;
	/** 上卦 */
	upper: string;
	/** 下卦 */
	lower: string;
	/** 卦辞要点 */
	meaning: string;
	/** 倪师讲解要点 */
	niInterpretation: string;
	/** 断事要诀 */
	divination: string;
}

/** 堪舆条目 —— 天纪「堪舆」模块的细目数据（见 `tianji.ts` 的 `FENGSHUI_ENTRIES`）。 */
export interface FengShuiEntry {
	/** 条目 id */
	id: string;
	/** 条目标题 */
	title: string;
	/** 类别：`yangzhai` 阳宅 / `yinzhai` 阴宅 / `theory` 理论 */
	category: "yangzhai" | "yinzhai" | "theory";
	/** 条目说明 */
	description: string;
	/** 核心要点 */
	keyPoints: string[];
}

/**
 * 人纪中医条目 —— 归入某人纪模块下的细目（`moduleId` 对应 `NiModule.id`）。
 *
 * @remarks
 * 当前仓库内没有它的数据表，也没有消费方 —— 保留类型以备续补细目数据。
 */
export interface MedicalEntry {
	/** 条目 id */
	id: string;
	/** 所属人纪模块的 id（对应 `NiModule.id`） */
	moduleId: string;
	/** 条目标题 */
	title: string;
	/** 条目说明 */
	description: string;
	/** 核心要点 */
	keyPoints: string[];
	/** 相关药材（可选） */
	relatedHerbs?: string[];
	/** 相关穴位（可选） */
	relatedAcupoints?: string[];
}

/** 针灸经验穴位 —— 见 `renji.ts` 的 `ACU_EXPERIENCES`。 */
export interface AcuExperience {
	/** 序号 */
	id: number;
	/** 适应症/疾病 */
	condition: string;
	/** 穴位组合 */
	acupoints: string;
	/** 分类 */
	category: string;
	/** 补充说明 */
	note?: string;
}

/** 透针透穴法 —— 见 `renji.ts` 的 `TRANS_NEEDLING`。 */
export interface TransNeedling {
	/** 序号 */
	id: number;
	/** 透穴组合：A透B */
	combo: string;
	/** 治疗症状 */
	indication: string;
	/** 配穴 */
	supporting?: string;
	/** 来源 */
	source: string;
}

/** 汉唐方剂 —— 见 `renji.ts` 的 `HANTANG_FORMULAS`。 */
export interface HantangFormula {
	/** 方号 */
	id: number;
	/** 方名（如「白带丸」、「大禹丸」） */
	name: string;
	/** 主治疾病 */
	indication: string;
	/** 核心理论（一句话） */
	theory?: string;
	/** 主要成分（公开部分） */
	ingredients?: string;
}

/** 经典经方 —— 见 `renji.ts` 的 `CLASSIC_FORMULAS`。 */
export interface ClassicFormula {
	/** 条目 id */
	id: string;
	/** 方名 */
	name: string;
	/** 出处 */
	source: string;
	/** 组成药物 */
	composition: string;
	/** 主治 */
	indication: string;
	/** 倪师用法要点 */
	niUsage?: string;
}

/** 天纪课程集数结构 —— 见 `tianji.ts` 的 `TIANJI_EPISODES`。 */
export interface TianjiEpisode {
	/** DVD编号 1-24 */
	dvd: number;
	/** 前半段主题 */
	firstHalf: string;
	/** 后半段主题 */
	secondHalf: string;
	/** 关键内容 */
	highlights: string[];
}
