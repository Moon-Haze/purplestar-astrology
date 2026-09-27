/**
 * 格局层的**类型**：结构体、识别器入参、识别器签名。
 *
 * @remarks
 * 本模块只放「是什么形状」，既不放数据也不放判定 —— 常量、名字裁决表与判词表在同目录的
 * `data.ts`，识别器按分组散在 `shang-ge.ts` / `zhong-ge.ts` / `zhu-li-ge.ts` / `e-ge.ts` /
 * `ji-chu-ge.ts` / `shou-lian-ge.ts`，装配在 `index.ts`。
 * 分工是**形状 / 数据 / 判定**，改哪一层就只需读哪个文件。
 *
 * 本文件里的 `{@link}` 一律只指向**本文档内**的符号 —— 跨文件 TSDoc 解析不到，
 * 指向其他模块的符号时直呼其名，不加链接。
 *
 * @packageDocumentation
 */

import type { ZiweiChart, Palace } from "../types";

// ────────────────── 类型 ──────────────────
/**
 * 格局的成立条件分层（v2 结构）。
 *
 * @remarks
 * ⚠️ 这三个数组是**回填已判定项**的结果记录，**不是判定依据**：识别器先用代码判完条件，
 * 再把已命中的项写进来给文案层展示。故"某条件不在 `required` 里"不等于"该条件不成立"，
 * 只是那个识别器没有把它列进去。
 *
 * 三层语义：`required` 全部成立格局才被推入；`bonus` 与 `breaking` 只影响
 * {@link Pattern.level} 的取值（有 `breaking` 通常降级）。
 */
export interface PatternCondition {
	required: string[]; // 必须满足条件（已通过的）
	bonus?: string[]; // 加分项（已触发）
	breaking?: string[]; // 破格警示（已触发）
}

/**
 * 一条已命中的格局。
 *
 * @remarks
 * 由各 `detect*` 识别器在条件成立时推入 `detectPatterns` 的累积数组。
 */
export interface Pattern {
	name: string; // 格局名；部分识别器会拼入星名（如「武曲化禄入命」「太阴化忌冲命」）
	level: 90 | 75 | 60 | 40; // 等级分数：90 上格 / 75 吉格 / 60 平格 / 40 凶格警示。触发破格条件时**降档**（如 90 → 75、75 → 40）
	description: string; // 判词文案，由 cli/commands.ts 直接输出给用户（短判词 + level，analyze 用）
	/**
	 * topic 侧（`overview` / `personality` 两个主题）用的**倪师口吻长判词**。
	 *
	 * @remarks
	 * 两种文风是**有意的分工**，不是重复：analyze 要的是「一句话 + 等级」，topic 要的是
	 * 倪师讲课式的展开。缺省表示该格局**不在 topic 侧展示**（82 个格局名里只有约 25 个有），
	 * 不影响判定、也不影响 analyze。
	 *
	 * 用**纯字符串**而非函数：所有条件分支（坐命/照命、满格/不全格、男命/女命、从 name
	 * 剥星名）在各识别器内部都算得出来，填最终串即可。
	 */
	topicDescription?: string;
	palaces: string[]; // 涉及宫位（**宫名**，非地支索引；可能含"身宫"或格局定名宫位）
	conditions?: PatternCondition; // 成立条件分层（v2 新增）
	source?: string; // 古籍出处（v2 新增）
}
/**
 * 识别器上下文：`detectPatterns` 一次组装、传给全部 51 个识别器的公共入参。
 *
 * @remarks
 * 各识别器**按需解构** —— `{ chart }` / `{ chart, ming }` / `{ ming }`。
 * 这样既让注册表能是一张同签名函数数组（见 {@link Detector}），又保住
 * 「这个识别器依不依赖命宫」在签名处一眼可见。
 *
 * ⚠️ `ming` 由 `detectPatterns` 保证非空：无命宫时它已提前 `return`，
 * 识别器无须再判空。
 *
 * ⚠️ 本接口原先在 `patterns.ts` 内是 module-private，拆出后必须 export 才能被识别器引用。
 */
export interface DetectContext {
	chart: ZiweiChart;
	ming: Palace;
}

/**
 * 识别器签名 —— 一个格局一支判定函数。
 *
 * @remarks
 * 命中返回 `[one]`（多数识别器只可能产出一条），未命中返回 `[]`。
 * **返回数组而非 `Pattern | null`** 是为了让少数筛两个宫位的识别器
 * （如化忌入命 / 化忌冲命）能一次报两条，而不必把「我知道最多两条」写进类型。
 *
 * 各分组文件末尾的 `SHANG_GE` / `ZHONG_GE` / … 都是本类型的数组，
 * `index.ts` 按序拼接成总表 —— **拼接顺序即 `detectPatterns` 的输出顺序**。
 */
export type Detector = (ctx: DetectContext) => Pattern[];

/**
 * 格局名的「同现象异名」裁决表 —— 同一现象只留一个**显示名**。
 *
 * @remarks
 * 判定早已收敛到一处（`index.ts` 的 `detectPatterns`），但历史上两侧各叫各的：
 * `analyze` 用 A 名、`topic` 的 `detectGeJu` 用 B 名。2026-09-27 起做统一，两侧共用显示名；
 * 落选的名字留在本表备查，不再用于显示。
 *
 * 裁决依据分两种（见 {@link GejuNameAlias.basis}），**不可混为一谈**：
 *
 * - `corpus` —— **古籍词频裁决**：逐名统计三部古籍的出现次数，取高者。这几组是
 *   **真异名**（两个不同的词，如 `化禄入命` / `化禄守命`）。语料本体在
 *   `purplestar-classics` 技能里（`scripts/classics/`），2026-09-27 拆 skill 时从本
 *   skill 移出 —— **口径没变，只是换了个 skill 住**。
 * - `convention` —— **古籍不足以裁决**：两组都零见，或者两种写法古籍并用且样本量
 *   只有个位数（如 `紫府同宫` / `紫府同宫格` 实为一个词差一个「格」字，古籍里
 *   两种写法都在用）。这类改按书写约定统一，`note` 写明理由。
 *
 * ⚠️ **表里的数字是当时实测，语料一改就作废。** `test/invariants.test.ts` 有一条
 * 预言机从古籍库重算并与此表比对 —— 它变红时该**重新裁决**，不是把数字改大。
 *
 * ⚠️ 计数口径是**原文子串**，不区分语境、也不扣包含重叠：故 `紫府同宫` 的 2 次里
 * 有 1 次其实是写在「紫府同宫格」里的。本表只用来比大小，不用来断言语义。
 */
export interface GejuNameAlias {
	/** 现用显示名。带星名的家族写**后缀**形式（星名由识别器拼在前面） */
	canonical: string;
	/** 落选的同现象异名，保留备查，不再用于显示 */
	aliases: string[];
	/** 裁决依据：`corpus` = 古籍词频；`convention` = 书写约定（古籍不足以裁决） */
	basis: "corpus" | "convention";
	/** 实测词频，键为名字原文。`convention` 类如实照记，不参与比大小 */
	counts: Record<string, number>;
	/** 词频 > 0 的出处（书·篇） */
	sources: string;
	/** 需要额外说明的裁决理由（尤其词频悬殊不大、或非词频裁决时） */
	note?: string;
}

// ────────────────── 判词 ──────────────────

/**
 * 一条格局的判词。字段与同文件的 `Pattern` 同名同义，
 * 只是这里**只有文本**（识别器用展开运算把它们并进 `Pattern`）。
 *
 * @remarks
 * `description` / `topicDescription` 里可含 `{星}` / `{宫}` / `{煞}` / `{会}` 占位符，
 * 由 `helpers.ts` 的 `fillVerdict` 在调用点填。判词表的键口径、以及「为什么
 * level / palaces / conditions 不在这里」，见 `data.ts` 的「判词」分区注释。
 */
export interface PatternVerdict {
	/** analyze 侧短判词，一到两句 + 等级由 `level` 单独承载 */
	description: string;
	/** topic 侧倪师口吻长判词；缺省表示该格局不在 topic 侧展示 */
	topicDescription?: string;
	/** 古籍出处 */
	source?: string;
}
