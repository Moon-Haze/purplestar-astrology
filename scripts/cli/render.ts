/**
 * 命盘渲染层 —— 把排盘内核输出的结构化数据，渲染成给模型读的文本片段。
 *
 * 拆自 purple-star.ts。只依赖 `@/ziwei/` 内核，不依赖本目录的其他模块，
 * 因此处于依赖图底层（args / render 并列底层）。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故这里可以放心用
 *    静态 import 引内核与 `@/` 别名。但**不要**反过来让 purple-star.ts 静态引本文件。
 */

import type { BirthInfo, Palace, Star, ZiweiChart, SiHua } from "@/ziwei/types";
import { STEMS, BRANCHES, IZTRO_TO_PROJECT_PALACE } from "@/ziwei/constants";
import { generateChart } from "@/ziwei/algorithm";

// ══════════════════════ 共用格式化 ══════════════════════

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

// ══════════════════════ 宫名口径 ══════════════════════

// ── `--focus` 的宫名别名表 ──
/**
 * `--focus` 的宫名别名表：四种写法 → 项目口径宫名。
 *
 * @remarks
 * 宫名口径已改为项目本位（倪师《天纪》体系，见 `constants.ts` 的 `IZTRO_TO_PROJECT_PALACE`），
 * 但用户嘴里说的、别的排盘软件里写的仍是老叫法。这里把四种写法都收进来，
 * 免得模型照用户原话传参却聚焦失败：
 * 项目全名（交友宫）· 口语简称（交友，去「宫」字）· iztro 旧口径（仆役）· 旧口径加宫（仆役宫）。
 *
 * 地支名（子/丑/…）不在此表，由匹配处单独比对。
 *
 * 整张表从 `IZTRO_TO_PROJECT_PALACE` 派生，故不会与内核映射表漂移。
 */
export const FOCUS_ALIASES = new Map<string, string>();
for (const [iztroName, projectName] of Object.entries(IZTRO_TO_PROJECT_PALACE)) {
	FOCUS_ALIASES.set(projectName, projectName); // 交友宫
	FOCUS_ALIASES.set(projectName.replace(/宫$/, ""), projectName); // 交友
	FOCUS_ALIASES.set(iztroName, projectName); // 仆役
	FOCUS_ALIASES.set(iztroName + "宫", projectName); // 仆役宫
}

/**
 * 按地支取宫，取不到直接抛错。
 *
 * @param chart - 命盘
 * @param branch - 地支索引 0–11（0=子 … 11=亥）
 * @param what - 该地支的语义（「命宫」「身宫」「甲方命宫」…），只用于错误文案
 * @returns 落在该地支上的宫位
 * @throws 当地支不在 `chart.palaces` 内时
 *
 * @remarks
 * 命宫 / 身宫地支必定落在 `palaces` 内，这是排盘不变量；取不到即说明内核输出已损坏。
 * 此处遵循项目一贯立场：宁可当场失败，也不要渲染出一张缺了命宫的盘。
 */
export function palaceAtBranch(chart: ZiweiChart, branch: number, what: string): Palace {
	const p = chart.palaces.find(x => x.branch === branch);
	if (!p) throw new Error(`排盘异常：${what}（地支 ${BRANCHES[branch] ?? branch}）不在十二宫内`);
	return p;
}

/**
 * 按**项目口径**的宫名取宫位，取不到当场抛错。
 *
 * @param chart - 命盘
 * @param palaceName - 项目口径的宫名，如 `"夫妻宫"` / `"福德宫"`
 * @returns 该宫名的宫位
 * @throws 当十二宫内无此宫名时；错误信息里会列出该盘实际的十二宫
 *
 * @remarks
 * 这里原先写的是 `find(p => p.name === "夫妻")`（iztro 旧口径）。宫名改为项目口径后
 * 它会静默返回 undefined，而调用点紧接着就读 `.branch` —— 合盘会以 TypeError 崩掉，
 * 报错还指不到真正的原因（「Cannot read properties of undefined」）。宫名是耦合点，
 * 取不到就该当场说清是哪个名字、当前的十二宫叫什么。
 */
export function mustPalace(chart: ZiweiChart, palaceName: string): Palace {
	const p = chart.palaces.find(x => x.name === palaceName);
	if (!p) {
		throw new Error(
			`找不到「${palaceName}」宫 —— 宫名口径与 constants.ts 的 IZTRO_TO_PROJECT_PALACE 不一致？\n` +
				`  该盘实际十二宫：${chart.palaces.map(x => x.name).join("、")}`
		);
	}
	return p;
}

// ══════════════════════ 片段渲染 ══════════════════════

/**
 * 出生地解析提示（容错命中 / 省份近似 / 未给地点，三种都需让用户知道）。
 *
 * @param lngNote - 出生地解析说明；无需提示时为空串（如 `--lng` 直给、或 `--city` 精确命中且无同名候选）
 * @param lngAmbiguous - 同名候选城市的 `"名字(经度)"` 列表；无歧义时为 `null`
 * @returns 待追加进输出数组的若干行，有内容时末尾多一个空行作分隔
 */
export function birthplaceSection(lngNote: string, lngAmbiguous: string[] | null): string[] {
	const out: string[] = [];
	if (lngNote) out.push(`【出生地解析】${lngNote}`);
	if (lngAmbiguous) {
		out.push(
			`  ⚠️ 存在同名候选：${lngAmbiguous.join("、")} —— 已取最短名，如有误请直接用 --lng 指定经度`
		);
	}
	if (out.length) out.push("");
	return out;
}

/**
 * 四化星 → 落宫。
 *
 * @param chart - 命盘
 * @param transforms - 「四化 → 星名」表；生年 / 流年 / 流月三处是同一形状
 * @returns 按「禄 → 权 → 科 → 忌」固定顺序排好的四条记录，每条含四化名、星名、所在宫名与地支；
 *   该星未上盘时 `palace` 与 `branch` 为 `null`
 *
 * @remarks
 * 找宫分两级：先找**主星**席位命中该星的宫，找不到再放宽到任意席位；`isMajor` 记录是否
 * 走了前一级（即该星在此宫被作主星收录）。
 */
export function locateSihua(chart: ZiweiChart, transforms: Record<SiHua, string>) {
	const out: {
		hua: SiHua;
		star: string;
		palace: string | null;
		branch: string | null;
		isMajor: boolean;
	}[] = [];
	const huaList: SiHua[] = ["禄", "权", "科", "忌"];
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
 *
 * @param chart - 命盘
 * @param branch - 本宫的地支索引 0–11
 * @returns 四个宫名，顺序为 `[本宫, 三合(+4), 三合(+8), 对宫(+6)]`；查不到的宫位退化为 `"?"`
 */
export function sanFangSiZheng(chart: ZiweiChart, branch: number): string[] {
	const idx = [branch, (branch + 4) % 12, (branch + 8) % 12, (branch + 6) % 12];
	return idx.map(b => chart.palaces.find(p => p.branch === b)?.name ?? "?");
}

/**
 * 亮度枚举 → 中文。
 *
 * @remarks
 * 键类型取自内核 `Star`，内核若增删亮度档位这里会立刻报错。
 */
const BRIGHTNESS_CN: Record<NonNullable<Star["brightness"]>, string> = {
	bright: "庙旺",
	normal: "平",
	dim: "落陷",
};

/**
 * 单星一行：「紫微化权庙旺」。
 *
 * @param s - 单颗星曜
 * @returns 星名 + 四化 + 亮度拼接成的描述；后两项缺哪项就省哪项
 */
const starLine = (s: Star): string => {
	const parts = [s.name];
	if (s.siHua) parts.push(`化${s.siHua}`);
	if (s.brightness) parts.push(BRIGHTNESS_CN[s.brightness]);
	return parts.join("");
};

/**
 * 单宫渲染（多行）。
 *
 * @param p - 待渲染的宫位
 * @param chart - 所属命盘（三方四正要跨全盘取）
 * @returns 多行文本：首行为「宫名【地支天干】+ 标记」，其后依次是主星、吉星、煞星、杂曜、三方四正
 *
 * @remarks
 * 标记栏合并三种身份：命宫 / 身宫 / 当前大限（带年龄区间，非当前大限时只写区间）。
 * 主星为空时改写「借对宫 X 的 Y」—— `borrowedFromName` / `borrowedStars` 由内核算好，
 * 这里不现算。
 */
export function renderPalace(p: Palace, chart: ZiweiChart): string {
	const major = p.stars.filter(s => s.type === "major");
	const lucky = p.stars.filter(s => s.type === "lucky");
	const sha = p.stars.filter(s => s.type === "sha");
	const minor = p.stars.filter(s => s.type === "minor");

	const head = `${p.name}【${BRANCHES[p.branch]}${STEMS[p.stem]}】`;
	const age = p.daXianAge ? `${p.daXianAge[0]}-${p.daXianAge[1]}岁` : "";
	const marks = [
		p.isMingGong ? "命宫" : "",
		p.isShenGong ? "身宫" : "",
		p.isCurrentDaXian ? `当前大限(${age})` : age,
	]
		.filter(Boolean)
		.join(" · ");

	const lines = [`${head}${marks ? "  — " + marks : ""}`];

	if (major.length) lines.push(`  主星：${major.map(starLine).join("、")}`);
	else
		lines.push(
			`  主星：（空宫）借对宫 ${p.borrowedFromName ?? ""} 的 ${(p.borrowedStars ?? []).join("、")}`
		);

	if (lucky.length) lines.push(`  吉星：${lucky.map(s => s.name).join("、")}`);
	if (sha.length) lines.push(`  煞星：${sha.map(s => s.name).join("、")}`);
	if (minor.length) lines.push(`  杂曜：${minor.map(s => s.name).join("、")}`);
	lines.push(`  三方四正：${sanFangSiZheng(chart, p.branch).join(" / ")}`);

	return lines.join("\n");
}

/**
 * 单宫一行速览（供十二宫一览表用）。
 *
 * @param p - 待渲染的宫位
 * @returns 单行文本，各列以 `│` 分隔：宫名 │ 宫干支 │ 主星 │ 吉 │ 煞 │ 大限区间；
 *   末尾按需追加 `★身宫` / `←当前大限` 标记
 *
 * @remarks
 * 主星走 {@link starLine}（含四化与亮度），吉 / 煞两列只取星名，为空时显示 `—`，
 * 大限区间缺失时同样显示 `—`。主星为空写「空宫借X(…)」。
 */
export function palaceBrief(p: Palace): string {
	const major = p.stars.filter(s => s.type === "major");
	const lucky = p.stars.filter(s => s.type === "lucky");
	const sha = p.stars.filter(s => s.type === "sha");
	const main = major.length
		? major.map(starLine).join("、")
		: `空宫借${p.borrowedFromName ?? "?"}(${(p.borrowedStars ?? []).join("、") || "无主星"})`;
	const cols = [
		p.name,
		`${BRANCHES[p.branch]}${STEMS[p.stem]}`,
		main,
		`吉:${lucky.map(s => s.name).join("、") || "—"}`,
		`煞:${sha.map(s => s.name).join("、") || "—"}`,
		p.daXianAge ? `${p.daXianAge[0]}-${p.daXianAge[1]}岁` : "—",
	];
	const tags = [p.isShenGong ? "★身宫" : "", p.isCurrentDaXian ? "←当前大限" : ""]
		.filter(Boolean)
		.join(" ");
	return "  " + cols.join(" │ ") + (tags ? "  " + tags : "");
}

/**
 * 命盘指纹：宫名 + 地支 + 全星曜集合，用于比对两盘是否完全一致。
 *
 * @param c - 命盘
 * @returns 指纹字符串（各宫以 `|` 连接，宫内星曜名排序后以 `,` 连接）
 *
 * @remarks
 * ⚠️ 本函数与 `test/lib/compare.mjs` 的 `chartSignature` 是**两份必须行为一致的实现** ——
 * CLI 不能反向依赖 `test/`，故刻意不抽共享模块（与 `lib/loader.mjs` 同一处境）。
 * 两侧都先按 `branch` 排序再拼接，使指纹与 `palaces` 的数组顺序无关（该顺序实测为
 * 寅起的 `2,3,…,11,0,1`，不是 0-11）；只在一侧加排序，两边就会静默分叉。
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
 *
 * @param c - 命盘
 * @returns 地支名，如 `"午"`
 */
const ziweiBranchOf = (c: ZiweiChart): string => BRANCHES[c.ziweiPos];

/**
 * 命宫主星简述（空宫则写借宫）。
 *
 * @param c - 命盘
 * @returns 主星名以「、」连接；空宫写 `空宫(借X：…)`；命宫地支取不到宫位时返回 `"—"`
 */
function mingMajorBrief(c: ZiweiChart): string {
	const m = c.palaces.find(p => p.branch === c.mingGongBranch);
	if (!m) return "—";
	const s = m.stars.filter(x => x.type === "major").map(x => x.name);
	return s.length
		? s.join("、")
		: `空宫(借${m.borrowedFromName ?? "?"}：${(m.borrowedStars ?? []).join("、") || "无主星"})`;
}

/**
 * 晚子时口径提醒。
 *
 * @param chart - 本次实际排出的盘
 * @param info - 出生信息；重排对照盘时只改 `hour`，其余照用
 * @param isLateZi - 本次是否真的按晚子时口径（即 `hour === 12`）
 * @param lateZiCandidate - 校正后的真太阳时是否落在 23:00–23:59
 * @returns 待追加进输出数组的若干行；命中任一口径时末尾带一个空行作分隔
 *
 * @remarks
 * 23:00–23:59 出生时，子时横跨两日：「当日早子时」与「晚子时算次日」排出的是两张不同的盘。
 * 故这里会**另排一张对照盘**并把两张盘的紫微位与命宫主星并列出来（`isLateZi` 时对照当日早子时
 * `hour: 0`，否则对照晚子时 `hour: 12`）。对照盘靠 `generateChart` 现排，不缓存。
 *
 * 措辞锚在「校正后」而非「你给的钟表时间」：开 `--eot` 或西部城市时，落在 23:00–23:59 的
 * 往往是校正后的真太阳时，钟表时间可能在别处（如喀什 02:30 校正后是前一日 23:37）。
 */
export function lateZiSection(
	chart: ZiweiChart,
	info: BirthInfo,
	isLateZi: boolean,
	lateZiCandidate: boolean
): string[] {
	const out: string[] = [];
	if (isLateZi) {
		out.push("【晚子时口径】");
		out.push("  本次按【晚子时·算次日】排盘（--late-zi / --branch 12）。");
		out.push(
			"  注意：安星依据的是次日的农历日数，故下方「农历」栏显示的是出生当日，与安星所用日相差一天，属正常。"
		);
		const alt = generateChart({ ...info, hour: 0 });
		out.push(
			`  对照【当日早子时】口径：紫微落 ${ziweiBranchOf(alt)} · 命宫主星 ${mingMajorBrief(alt)}`
		);
		out.push("");
		return out;
	}
	if (!lateZiCandidate) return out;
	const alt = generateChart({ ...info, hour: 12 });
	out.push("【⚠️ 晚子时口径提醒】");
	out.push("  校正后的真太阳时落在 23:00–23:59。子时横跨两日，两种口径排出的是**两张不同的盘**。");
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
