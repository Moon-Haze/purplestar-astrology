/**
 * 命盘视图层，只读消费 `astrology --json`。
 * @file 命盘视图层（消费方）
 * @remarks 不排盘/自带契约论证见 docs/code/synastry.md §0/§1（{@link ZiweiChart}）。
 */

import { readFileSync } from "node:fs";

/**
 * 十二地支（0=子…11=亥），「夫妻宫 卯」的「卯」由此取。
 * @remarks 同 `data/ganzhi.ts`。
 */
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/**
 * 地支索引 → 地支名。
 * @param branch - 0–11
 * @returns 地支名；越界退化成索引串
 */
export const branchName = (branch: number): string => BRANCHES[branch] ?? String(branch);

// ── 命盘类型契约 ──
// 消费方声明：只列本 skill 读到的字段，非内核副本。

/** 四化名。 */
export type Mutagen = "禄" | "权" | "科" | "忌";

/**
 * 出生信息（抬头子集）。
 * @remarks 排盘方跨午夜调整的 `chart.birthInfo`，原样转述。
 */
export interface BirthInfo {
	/** 公历年（已校正） */
	year: number;
	/** 公历月 1–12（已校正） */
	month: number;
	/** 公历日（已校正） */
	day: number;
	/** 内核性别 */
	gender: "male" | "female";
	/** 可选，仅抬头用 */
	name?: string;
}

/** 一颗星（只看名字与类别） */
export interface Star {
	/** 星名（如「紫微」「左辅」） */
	name: string;
	/** `"major"`=十四主星；其余三类本 skill 不区分 */
	type: "major" | "minor" | "soft" | "tough";
}

/** 宫位（只列用到的字段） */
export interface Palace {
	/** 宫名，如 `"夫妻宫"` */
	name: string;
	/** 地支索引 */
	branch: number;
	/** 本宫星曜（三类；主星见 {@link majorsOf}） */
	stars: Star[];
	/** 借对宫之名 */
	borrowedFromName?: string;
	/** 借来的主星名 */
	borrowedStars?: string[];
}

/** 命盘（只列用到的字段） */
export interface ZiweiChart {
	/** 出生信息（已校正） */
	birthInfo: BirthInfo;
	/** 命宫地支索引 */
	soulBranch: number;
	/** 五行局，如 `"水二局"` */
	fiveElementsClassName: string;
	/** 十二宫：按地支序排（寅起），按 `branch` 索引 */
	palaces: Palace[];
}

// ── 格式化 ──

/**
 * 公历日期 → `"YYYY-MM-DD"`（补零）。
 * @param i - 带 `year`/`month`/`day`
 * @returns 补零日期串
 */
export const fmtDate = (i: { year: number; month: number; day: number }) =>
	`${i.year}-${String(i.month).padStart(2, "0")}-${String(i.day).padStart(2, "0")}`;

/**
 * 性别 → 中文。
 * @param g - 内核口径性别
 * @returns `"男"` / `"女"`
 */
export const genderCN = (g: "male" | "female") => (g === "male" ? "男" : "女");

// ── 查宫 ──

// 查宫必得语义收进 `palace-relations`（mustPalaceByName/
// mustPalaceAtBranch），命令层经 `@/` 消费。

/**
 * 取宫**主星**名（`type === "major"`）。
 * @param p - 宫位
 * @returns 主星名数组，空宫为空（借对宫属调用点）
 */
export const majorsOf = (p: Palace): string[] =>
	p.stars.filter(s => s.type === "major").map(s => s.name);

// ── 读入并校验 analyze --json ──

/**
 * 四化落宫记录 —— 与 `purplestar-astrology` 的 `locateSihua()` 同形。
 * @remarks 源无显式返回类型，按产出字段重述。
 */
export interface SihuaLocation {
	/** 四化名 */
	hua: Mutagen;
	/** 被化的星名 */
	star: string;
	/** 所在宫名；未上盘 `null` */
	palace: string | null;
	/** 所在地支名；未上盘 `null` */
	branch: string | null;
}

/**
 * 依赖的 `analyze --json` 字段子集。
 * @remarks 只列读到的键；其余属 `analyze`/`topic`，合盘不读。消费方声明依赖，契约才有边界。
 */
export interface AnalyzeJson {
	/** 完整命盘（12宫+农历+五行局；只读 {@link ZiweiChart} 字段） */
	chart: ZiweiChart;
	/** 生年四化：只用 `located`；`transforms` 由 `located[].star` 覆盖 */
	nativeSiHua: { stem: string; located: SihuaLocation[] };
	/** 晚子时：`candidate`=校正时落 23:00–23:59；`applied`=本次是否按晚子时排 */
	lateZi: { candidate: boolean; applied: boolean };
	/** 排盘依据（农历/出生地/时辰），复述「这张盘怎么来的」 */
	basis: { note: string; notes: string[] };
}

/**
 * 读并校验 `analyze --json`。
 * @param file - JSON 路径
 * @param side - `"甲"`/`"乙"`，错误文案
 * @returns 校验后的 {@link AnalyzeJson}
 * @throws 读不到/非法JSON/缺字段
 * @remarks 四项必需；宁可失败不渲染缺「四化入夫妻宫」的盘（**静默缺失**更危险）。
 */
export function readAnalyzeJson(file: string, side: string): AnalyzeJson {
	let raw: string;
	try {
		raw = readFileSync(file, "utf8");
	} catch (err) {
		throw new Error(
			`读不到${side}方命盘文件：${file}\n` +
				`  ${(err as Error).message}\n` +
				`  请先用本 CLI 的 astrology 排出命盘，再把它交给本命令：\n` +
				`    node scripts/purple-star.ts astrology \\\n` +
				`      --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json > ${file}（示例数据为虚构）`,
			{ cause: err }
		);
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (err) {
		throw new Error(
			`${side}方命盘文件不是合法 JSON：${file}\n` +
				`  ${(err as Error).message}\n` +
				`  ⚠️ 生成时请确认重定向拿到的是 JSON 本身 —— 排盘失败时写进文件的是错误信息。`,
			{ cause: err }
		);
	}

	const o = (data ?? {}) as Record<string, unknown>;

	const chart = o.chart as ZiweiChart | undefined;
	if (!chart || !Array.isArray(chart.palaces) || !chart.birthInfo) {
		throw new Error(
			`${side}方命盘文件里没有命盘对象（顶层键 \`chart\`）：${file}\n` +
				`  顶层实际有：${Object.keys(o).join("、") || "（空对象）"}\n` +
				`  它应当是 \`astrology --json\` 的输出；\`astrology --palaces --json\` 的输出**顶层就是命盘**，\n` +
				`  没有 \`chart\` 键，也没有合盘需要的四化落宫与排盘依据。`
		);
	}

	const nativeSiHua = o.nativeSiHua as { stem?: unknown; located?: unknown } | undefined;
	const located = nativeSiHua?.located;
	if (typeof nativeSiHua?.stem !== "string" || !Array.isArray(located)) {
		throw new Error(
			`${side}方命盘文件缺 \`nativeSiHua\`（生年四化年干与落宫）：${file}\n` +
				`  「四化入夫妻宫」一节依赖落宫，年干用于口径提示；缺了会静默少结论。请用 \`astrology --json\` 重新生成。`
		);
	}

	const lateZi = o.lateZi as { candidate?: unknown; applied?: unknown } | undefined;
	if (!lateZi || typeof lateZi.candidate !== "boolean" || typeof lateZi.applied !== "boolean") {
		throw new Error(
			`${side}方命盘文件缺 \`lateZi\`（晚子时标记）：${file}\n` +
				`  晚子时口径会让该方整张盘改变，缺了这个标记就无法提示用户复核。`
		);
	}

	const basis = o.basis as { note?: unknown; notes?: unknown } | undefined;
	if (!basis || typeof basis.note !== "string" || !Array.isArray(basis.notes)) {
		throw new Error(
			`${side}方命盘文件缺 \`basis\`（排盘依据）：${file}\n` +
				`  真太阳时校正与出生地解析的说明由排盘方给出，本 skill 不重算 —— 缺了它，\n` +
				`  合盘输出会丢掉「这张盘是怎么来的」那段提示。`
		);
	}

	return {
		chart,
		nativeSiHua: { stem: (o.nativeSiHua as { stem: string }).stem, located },
		lateZi: { candidate: lateZi.candidate, applied: lateZi.applied },
		basis: { note: basis.note, notes: basis.notes as string[] },
	};
}
