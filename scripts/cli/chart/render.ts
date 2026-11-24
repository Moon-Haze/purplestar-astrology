/**
 * 拆自 purple-star.ts，只依赖 `@/` 内核（例外 `import type { CaliberBasis }` 运行时擦除）。
 * 晚子时对照盘取数在 `./late-zi`，作参数递入 `lateZiSection`；零排盘、零 IO。
 * ⚠️ 引导层在 `registerHooks` 后动态加载，可静态 import；勿让 purple-star.ts 反向静态引。
 * 详见 docs/code/cli-chart.md。
 * @file 命盘渲染层
 */

import type { Palace, Star, ZiweiChart, Mutagen } from "@/types";
import type { CaliberBasis } from "../birth/birth-info-defs";
import { STEMS, BRANCHES, IZTRO_TO_PROJECT_PALACE } from "@/data/ganzhi";
import { surroundBranches } from "@/palace-relations";

/**
 * 公历日期 → `"YYYY-MM-DD"`（月日补零）。
 * @param i - 带 `year` / `month` / `day` 的对象
 * @returns 补零日期串
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

/**
 * `--focus` 别名表：四种写法（全名 / 简称 / iztro 旧口径 / 旧口径加宫）→ 项目宫名。
 * 收老叫法免照原话聚焦失败；地支名不在此表，匹配处比对。
 * @remarks 从 `IZTRO_TO_PROJECT_PALACE` 派生，不漂移（见 docs/code/cli-chart.md）。
 */
export const FOCUS_ALIASES = new Map<string, string>();
for (const [iztroName, projectName] of Object.entries(IZTRO_TO_PROJECT_PALACE)) {
	FOCUS_ALIASES.set(projectName, projectName); // 交友宫
	FOCUS_ALIASES.set(projectName.replace(/宫$/, ""), projectName); // 交友
	FOCUS_ALIASES.set(iztroName, projectName); // 仆役
	FOCUS_ALIASES.set(iztroName + "宫", projectName); // 仆役宫
}

/**
 * 出生地解析提示（容错命中 / 省份近似 / 未给地点，均需告知）。
 * @param basis - 口径载体（只读 `lngNote` / `lngAmbiguous`），整包传入
 * @returns 待追加行，有内容时末尾空行分隔
 */
export function birthplaceSection(basis: Pick<CaliberBasis, "lngNote" | "lngAmbiguous">): string[] {
	const out: string[] = [];
	if (basis.lngNote) {
		out.push(`【出生地解析】${basis.lngNote}`);
	}
	if (basis.lngAmbiguous) {
		out.push(
			`  ⚠️ 存在同名候选：${basis.lngAmbiguous.join("、")} —— 已取最短名，如有误请直接用 --lng 指定经度`
		);
	}
	if (out.length) {
		out.push("");
	}
	return out;
}

/**
 * 四化星 → 落宫。
 * @param chart - 命盘
 * @param transforms - 「四化 → 星名」表，生年 / 流年 / 流月同形
 * @returns 按「禄 → 权 → 科 → 忌」四条（四化名、星名、宫、地支）；未上盘 `palace` / `branch` 为 `null`
 * @remarks 找宫两级：先**主星**席位再放宽；`isMajor` 记是否走前一级。
 */
export function locateSihua(chart: ZiweiChart, transforms: Record<Mutagen, string>) {
	const out: {
		hua: Mutagen;
		star: string;
		palace: string | null;
		branch: string | null;
		isMajor: boolean;
	}[] = [];
	const huaList: Mutagen[] = ["禄", "权", "科", "忌"];
	for (const hua of huaList) {
		const star = transforms[hua];
		const palace =
			chart.palaces.find(p => p.stars.some(s => s.name === star && s.type === "major")) ??
			chart.palaces.find(p => p.stars.some(s => s.name === star));
		out.push({
			hua,
			star,
			palace: palace ? palace.name : null,
			branch: palace ? BRANCHES[palace.branch] : null,
			isMajor: palace
				? !!palace.stars.find(s => s.name === star && s.type === "major")
				: false,
		});
	}
	return out;
}

/**
 * 三方四正：本宫 + 三合两宫 + 对宫。
 * @param chart - 命盘
 * @param branch - 本宫地支索引 0–11
 * @returns 四宫名 `[本宫, 三合(+4), 三合(+8), 对宫(+6)]`，查不到为 `"?"`
 */
export function surroundNames(chart: ZiweiChart, branch: number): string[] {
	return surroundBranches(branch).map(b => chart.palaces.find(p => p.branch === b)?.name ?? "?");
}

/**
 * 亮度枚举 → 中文。
 * @remarks 键取内核 `Star`，增删亮度档位立刻报错。
 */
const BRIGHTNESS_CN: Record<NonNullable<Star["brightness"]>, string> = {
	bright: "庙旺",
	normal: "平",
	dim: "落陷",
};

/**
 * 单星一行：「紫微化权庙旺」。
 * @param s - 单颗星曜
 * @returns 星名 + 四化 + 亮度，缺项省略
 */
export const starLine = (s: Star): string => {
	const parts = [s.name];
	if (s.mutagen) {
		parts.push(`化${s.mutagen}`);
	}
	if (s.brightness) {
		parts.push(BRIGHTNESS_CN[s.brightness]);
	}
	return parts.join("");
};

/**
 * 单宫渲染（多行）。
 * @param p - 待渲染宫位
 * @param chart - 所属命盘（三方四正跨全盘）
 * @returns 多行：首行「宫名【地支天干】+ 标记」，后接主星、吉星、煞星、杂曜、三方四正
 * @remarks 标记 = 命宫 / 身宫 / 当前大限（带年龄区间，非当前只写区间）。主星空改写
 *   「借对宫 X 的 Y」—— `borrowedFromName` / `borrowedStars` 内核算好，不现算。
 */
export function renderPalace(p: Palace, chart: ZiweiChart): string {
	const major = p.stars.filter(s => s.type === "major");
	const lucky = p.stars.filter(s => s.type === "soft");
	const sha = p.stars.filter(s => s.type === "tough");
	const minor = p.stars.filter(s => s.type === "minor");

	const head = `${p.name}【${BRANCHES[p.branch]}${STEMS[p.stem]}】`;
	const age = p.decadalRange ? `${p.decadalRange[0]}-${p.decadalRange[1]}岁` : "";
	const marks = [
		p.isSoulPalace ? "命宫" : "",
		p.isBodyPalace ? "身宫" : "",
		p.isCurrentDecadal ? `当前大限(${age})` : age,
	]
		.filter(Boolean)
		.join(" · ");

	const lines = [`${head}${marks ? "  — " + marks : ""}`];

	if (major.length) {
		lines.push(`  主星：${major.map(starLine).join("、")}`);
	} else {
		lines.push(
			`  主星：（空宫）借对宫 ${p.borrowedFromName ?? ""} 的 ${(p.borrowedStars ?? []).join("、")}`
		);
	}

	if (lucky.length) {
		lines.push(`  吉星：${lucky.map(s => s.name).join("、")}`);
	}
	if (sha.length) {
		lines.push(`  煞星：${sha.map(s => s.name).join("、")}`);
	}
	if (minor.length) {
		lines.push(`  杂曜：${minor.map(s => s.name).join("、")}`);
	}
	lines.push(`  三方四正：${surroundNames(chart, p.branch).join(" / ")}`);

	return lines.join("\n");
}

/**
 * 命盘指纹：宫名 + 地支 + 全星曜，比对两盘。
 * @param c - 命盘
 * @returns 指纹串（各宫 `|` 连接，宫内星名排序后 `,` 连接）
 * @remarks **唯一实现** —— `test/lib/compare.ts` 经 `loadRender()` 转出，CLI 与测试共用；
 *   旧 test/ 副本靠「必须同步」提醒却无断言，单侧加排序即分叉。
 *   先按 `branch` 排序再拼，与 `palaces` 顺序（寅起 `2,3,…,11,0,1`）无关。见 docs/code/cli-chart.md。
 */
export const chartSignature = (c: ZiweiChart): string =>
	[...c.palaces]
		.sort((x, y) => x.branch - y.branch)
		.map(
			p =>
				`${p.name}:${p.branch}:${p.stars
					.map(s => s.name)
					.sort()
					.join(",")}`
		)
		.join("|");

/**
 * 紫微星所在宫的地支名。
 * @param c - 命盘
 * @returns 地支名，如 `"午"`
 */
const ziweiBranchOf = (c: ZiweiChart): string => BRANCHES[c.ziweiPos];

/**
 * 命宫主星简述。
 * @param c - 命盘
 * @returns 主星名以「、」连接；空宫写 `空宫(借X：…)`；命宫地支取不到宫位时返回 `"—"`
 */
function mingMajorBrief(c: ZiweiChart): string {
	const m = c.palaces.find(p => p.branch === c.soulBranch);
	if (!m) {
		return "—";
	}
	const s = m.stars.filter(x => x.type === "major").map(x => x.name);
	return s.length
		? s.join("、")
		: `空宫(借${m.borrowedFromName ?? "?"}：${(m.borrowedStars ?? []).join("、") || "无主星"})`;
}

/**
 * 晚子时口径提醒。
 * @param chart - 本次排盘
 * @param basis - 口径载体（只读 `isLateZi` / `lateZiCandidate`），整包传入（候选 6）
 * @param alt - 对照盘（调用方经 `./late-zi` 排好）：`isLateZi` 为
 *   **当日早子时**，`lateZiCandidate` 为**晚子时·算次日**；都不涉及时 `null`（同判据，
 *   配对不变量见其注释）
 * @returns 命中时追加行，末尾空行分隔
 * @remarks 23:00–23:59 出生子时跨两日，两口径**两张不同的盘**，本函数并列两盘紫微位与命宫
 *   主星；对照盘**参数非本函数排的**（经 `./late-zi` 取数），零排盘、零 IO。
 *   ⚠️ 锚「校正后」非「你给的钟表时间」：开 `--eot` 或西部城市，落 23:00–23:59 的常是
 *   校正后真太阳时（喀什 02:30 → 前一日 23:37）。见 docs/code/cli-chart.md。
 */
export function lateZiSection(
	chart: ZiweiChart,
	basis: Pick<CaliberBasis, "isLateZi" | "lateZiCandidate">,
	alt: ZiweiChart | null
): string[] {
	const out: string[] = [];
	if (!alt) {
		return out;
	}
	if (basis.isLateZi) {
		out.push("【晚子时口径】");
		out.push("  本次按【晚子时·算次日】排盘（--late-zi / --branch 12）。");
		out.push(
			"  注意：安星依据的是次日的农历日数，故下方「农历」栏显示的是出生当日，与安星所用日相差一天，属正常。"
		);
		out.push(
			`  对照【当日早子时】口径：紫微落 ${ziweiBranchOf(alt)} · 命宫主星 ${mingMajorBrief(alt)}`
		);
		out.push("");
		return out;
	}
	out.push("【⚠️ 晚子时口径提醒】");
	out.push(
		"  校正后的真太阳时落在 23:00–23:59。子时横跨两日，两种口径排出的是**两张不同的盘**。"
	);
	out.push(
		`  本次按【当日早子时】排盘：紫微落 ${ziweiBranchOf(chart)} · 命宫主星 ${mingMajorBrief(chart)}`
	);
	out.push(
		`  传统三合派另有【晚子时·算次日】之说：紫微落 ${ziweiBranchOf(alt)} · 命宫主星 ${mingMajorBrief(alt)}`
	);
	out.push("  两盘差异可能极大（命宫主星、紫微位、格局组全变）。若命主确系 23:00 后出生，");
	out.push("  建议加 --late-zi 复核后再下断语，并向命主确认具体钟点。");
	out.push("");
	return out;
}
