/**
 * 命盘视图层 —— 读排盘命令 `astrology --json` 的输出，并对其做只读访问。
 *
 * @remarks
 * ## 本 skill 不排盘
 *
 * 命盘由排盘解读 skill（`purplestar-astrology`）产出，本 skill 只**消费**它
 * `astrology --json` 的输出。故本文件里没有一行排盘逻辑、也没有 `iztro` 依赖 ——
 * 它做三件事：解析那份 JSON、按宫名 / 地支查宫、把宫位里的主星取出来。
 *
 * ## 为什么类型契约是**本文件自带的**，而不是 import 源的 `ziwei/types.ts`
 *
 * 本 skill 是纯消费方，不 import 源的 `ziwei/types.ts`，类型契约自带。整份全量类型副本有两个问题：
 *
 * 1. **它是内核的全量类型**（含 `Decadal` / `SelfMutagenMark` / `LunarInfo` 等本 skill
 *    一个字段都不读的类型），却要靠「与源逐字节相同」来维持 —— 而本 skill 只是**消费方**，
 *    消费方该声明的是「我依赖什么」，不是「上游有什么」。
 * 2. 内核里 `Palace.selfMutagen` / `Decadal.mutagen` 是**三合派硬约束的绊线字段**
 *    （刻意保留、由源与 `test/school.test.ts` 的断言盯着有没有被填回）。本 skill
 *    不排盘、不会填这两个字段，把绊线抄进来只会让「这里是消费方还是内核」变得含糊。
 *
 * 故现在按**实际读到的字段**重述一份子集，见 {@link ZiweiChart} 一组定义。
 * 这份契约窄而明确：上游若改了某个被读字段的名字或形状，`npm run typecheck` 会当场报错；
 * 上游若只是新增字段，这里**什么都不用改**（以前那份副本要跟着同步）。
 *
 * ## 为什么不去 import 源的 `cli/render.ts`
 *
 * `render.ts` 是排盘 CLI 的渲染层，它 import `@/ziwei/algorithm`（真排盘）。本 skill
 * 一旦引它，排盘内核就得整份跟过来 —— 那正是本次改造要消灭的东西。这里只重建合盘真正
 * 用到的几个小函数。
 *
 * ## 为什么地支名在这里自写一份
 *
 * 源的 `ziwei/constants.ts` 也有 `BRANCHES`，但那是**运行期**导入（值是数组）——
 * 引它会把 500 多行的常量表（四化表、星曜释义、时辰对照）整份拖进本 skill。
 * 地支名是**永不变化的宇宙常量**（子丑寅卯…），不是会漂移的排盘逻辑，故自带 12 个字
 * 比拖一整份内核划算。⚠️ 这是**自有的常量**，不是「漏了同步的副本」——
 * 改 `ziwei/constants.ts` 的 `BRANCHES` 时**不需要**同步这里（两者不会同时被读到：
 * 本 skill 的盘是从 JSON 来的，地支索引与名字的对应关系由排盘方保证）。
 */

import { readFileSync } from "node:fs";

/**
 * 十二地支，数组下标即全项目的**地支索引**（0=子、1=丑 … 11=亥）。
 *
 * @remarks
 * 与源的 `ziwei/constants.ts` 同名同值，理由见文件头。这里只用于把 `Palace.branch`
 * 渲染成「夫妻宫 卯」里的那个「卯」。
 */
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/**
 * 地支索引 → 地支名。
 *
 * @param branch - 地支索引 0–11（0=子 … 11=亥）
 * @returns 地支名；索引越界时退化成索引本身的字符串（渲染层不该因一个坏索引整个崩掉）
 */
export const branchName = (branch: number): string => BRANCHES[branch] ?? String(branch);

// ══════════════════════ 命盘类型契约 ══════════════════════
// ⚠️ 下面这组 interface 是**消费方声明**：只列本 skill 真的读到的字段。
//    它们由 `astrology --json` 产出（源头是 `ziwei/types.ts`），
//    但不是那份内核类型的副本 —— 见文件头「为什么类型契约是本文件自带的」。

/** 四化名。 */
export type Mutagen = "禄" | "权" | "科" | "忌";

/**
 * 出生信息 —— 只列本 skill 渲染抬头用得到的几项。
 *
 * @remarks
 * 这是排盘方**按真太阳时跨午夜调整过**的那一份（`chart.birthInfo`），不是用户敲进去的
 * 原始日期；本 skill 一个字都不重算，原样转述。
 */
export interface BirthInfo {
	year: number;
	month: number;
	day: number;
	/** 内核口径的性别 */
	gender: "male" | "female";
	/** 可选，只影响输出抬头 */
	name?: string;
}

/** 一颗星 —— 本 skill 只看名字与类别。 */
export interface Star {
	name: string;
	/** `"major"` 即十四主星；其余三类（minor / lucky / sha）本 skill 不区分 */
	type: "major" | "minor" | "soft" | "tough";
}

/** 一个宫位 —— 只列本 skill 用得到的字段。 */
export interface Palace {
	/** 项目口径的宫名，如 `"夫妻宫"` */
	name: string;
	/** 地支索引 0–11 */
	branch: number;
	stars: Star[];
	/** 空宫借对宫时，对宫的宫名 */
	borrowedFromName?: string;
	/** 空宫借对宫时，借来的主星名 */
	borrowedStars?: string[];
}

/** 命盘 —— 只列本 skill 用得到的字段。 */
export interface ZiweiChart {
	birthInfo: BirthInfo;
	/** 命宫所在地支索引 */
	soulBranch: number;
	/** 五行局名，如 `"水二局"` */
	fiveElementsClassName: string;
	palaces: Palace[];
}

// ══════════════════════ 格式化 ══════════════════════

/**
 * 公历日期 → `"YYYY-MM-DD"`（月日补零）。
 *
 * @param i - 任何带 `year` / `month` / `day` 的对象，故不必是完整 `BirthInfo`
 * @returns 补零后的日期字符串
 */
export const fmtDate = (i: { year: number; month: number; day: number }) =>
	`${i.year}-${String(i.month).padStart(2, "0")}-${String(i.day).padStart(2, "0")}`;

/**
 * 性别 → 中文。
 *
 * @param g - 内核口径的性别
 * @returns `"男"` / `"女"`
 */
export const genderCN = (g: "male" | "female") => (g === "male" ? "男" : "女");

// ══════════════════════ 查宫 ══════════════════════

/**
 * 按**项目口径**的宫名取宫位，取不到当场抛错。
 *
 * @param chart - 命盘（来自 `analyze --json` 的 `chart` 字段）
 * @param palaceName - 项目口径的宫名，如 `"夫妻宫"` / `"福德宫"`
 * @returns 该宫名的宫位
 * @throws 当十二宫内无此宫名时；错误信息里会列出该盘实际的十二宫
 *
 * @remarks
 * 找不到时**不返回 undefined**：调用点紧接着就读 `.branch`，返回 undefined 会让合盘
 * 以一句「Cannot read properties of undefined」崩掉，报错指不到真正的原因。宫名是与
 * 排盘方唯一的耦合点之一，取不到就该当场说清是哪个名字、这份盘里叫什么。
 */
export function mustPalace(chart: ZiweiChart, palaceName: string): Palace {
	const p = chart.palaces.find(x => x.name === palaceName);
	if (!p) {
		throw new Error(
			`命盘里找不到「${palaceName}」宫 —— 这份 JSON 是 purplestar-astrology 排的吗？\n` +
				`  该盘实际十二宫：${chart.palaces.map(x => x.name).join("、")}`
		);
	}
	return p;
}

/**
 * 按地支取宫，取不到直接抛错。
 *
 * @param chart - 命盘
 * @param branch - 地支索引 0–11（0=子 … 11=亥）
 * @param what - 该地支的语义（「甲方命宫」…），只用于错误文案
 * @returns 落在该地支上的宫位
 * @throws 当地支不在 `chart.palaces` 内时
 *
 * @remarks
 * 命宫 / 身宫地支必定落在 `palaces` 内，这是排盘不变量；取不到即说明这份 JSON 已损坏。
 * 此处遵循项目一贯立场：宁可当场失败，也不要渲染出一张缺了命宫的盘。
 */
export function palaceAtBranch(chart: ZiweiChart, branch: number, what: string): Palace {
	const p = chart.palaces.find(x => x.branch === branch);
	if (!p)
		throw new Error(
			`命盘异常：${what}（地支 ${BRANCHES[branch] ?? branch}）不在十二宫内 —— 这份 JSON 已损坏`
		);
	return p;
}

/**
 * 取一宫的**主星**名（`type === "major"`，即十四主星）。
 *
 * @param p - 宫位
 * @returns 主星名数组，空宫时为空数组（借对宫主星论是**调用点**的事，不在这里兜底）
 */
export const majorsOf = (p: Palace): string[] =>
	p.stars.filter(s => s.type === "major").map(s => s.name);

// ══════════════════════ 读入并校验 analyze --json ══════════════════════

/**
 * 一条四化落宫记录 —— 与 `purplestar-astrology` 的 `locateSihua()` 返回值同形。
 *
 * @remarks
 * 这份形状是**消费方声明**的：源里的 `locateSihua` 没有显式返回类型（靠推断），
 * 无法 `import type` 过来。故此处按它实际产出的字段重述一遍，只列本 skill 用得到的。
 */
export interface SihuaLocation {
	/** 四化名 */
	hua: Mutagen;
	/** 被化的星名 */
	star: string;
	/** 该星所在宫名；未上盘时为 `null` */
	palace: string | null;
	/** 该星所在宫的地支名；未上盘时为 `null` */
	branch: string | null;
}

/**
 * 本 skill 依赖的 `analyze --json` 字段子集。
 *
 * @remarks
 * **刻意只列用得到的字段**（`chart` / `nativeSiHua.located` / `lateZi` / `basis`），
 * 而不是把那份 JSON 的七个顶层键整个抄一遍：`patterns` / `mingGongSummary` /
 * `liuNianSiHua` / `liuYueSiHua` 是 `analyze` 与 `topic` 的事，合盘一个字都不读。
 * 消费方声明自己依赖什么，契约才看得出边界。
 */
export interface AnalyzeJson {
	/** 完整命盘（12 宫 + 农历信息 + 五行局；本 skill 只读 {@link ZiweiChart} 列出的字段） */
	chart: ZiweiChart;
	/** 生年四化 —— 只要 `located`（四化落宫），`transforms` 由 `located[].star` 覆盖 */
	nativeSiHua: { stem: string; located: SihuaLocation[] };
	/** 晚子时：`candidate` = 校正后的真太阳时落在 23:00–23:59；`applied` = 本次是否真按晚子时口径排 */
	lateZi: { candidate: boolean; applied: boolean };
	/** 排盘依据（农历换算 / 出生地解析 / 时辰校正三类说明），用于在输出里复述「这张盘怎么来的」 */
	basis: { note: string; notes: string[] };
}

/**
 * 读入一份 `analyze --json` 的输出并逐项校验本 skill 依赖的字段。
 *
 * @param file - JSON 文件路径
 * @param side - 是哪一方（`"甲"` / `"乙"`），只用于错误文案
 * @returns 校验过的、可直接当 {@link AnalyzeJson} 用的对象
 * @throws 文件读不到 / 不是合法 JSON / 缺关键字段时，均给出**指向成因**的报错
 *
 * @remarks
 * 校验是**逐项点名**的，且四项全为必需 —— 缺任何一项都说明这份 JSON 不是 `analyze --json`
 * 的输出（最容易踩的是拿 `chart --json` 的输出顶替：那份**顶层就是命盘本身**，没有
 * `chart` 键，更没有四化落宫与排盘依据）。按项目立场：宁可当场失败，也不要渲染出一张
 * 缺了「四化入夫妻宫」这一节的盘 —— 那属于**静默的结论缺失**，比报错危险得多。
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
				`      --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json > ${file}（示例数据为虚构）`
		);
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (err) {
		throw new Error(
			`${side}方命盘文件不是合法 JSON：${file}\n` +
				`  ${(err as Error).message}\n` +
				`  ⚠️ 生成时请确认重定向拿到的是 JSON 本身 —— 排盘失败时写进文件的是错误信息。`
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

	const located = (o.nativeSiHua as { located?: unknown } | undefined)?.located;
	if (!Array.isArray(located)) {
		throw new Error(
			`${side}方命盘文件缺 \`nativeSiHua.located\`（生年四化落宫）：${file}\n` +
				`  「四化入夫妻宫」一节依赖它，缺了会静默少一节结论。请用 \`astrology --json\` 重新生成。`
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
