/**
 * @file 数据库记录与星曜字段的格式化工具。
 */
// 库内编码值译码：干支序、亮度归并、samples 字段名与列展示格式。
import { cell } from "./render";

// 干支码 = iztro 枚举序：甲=0…癸=9、子=0…亥=11
// （对账样本 1：农历癸亥年 → year_stem=9 / year_branch=11，与库一致）。
/** 十天干（iztro 序：甲=0…癸=9）。 */
export const GAN = "甲乙丙丁戊己庚辛壬癸".split("");
/** 十二地支（iztro 序：子=0…亥=11）。 */
export const ZHI = "子丑寅卯辰巳午未申酉戌亥".split("");
// 亮度 = 上游语料三级归并（reference/ziwei-samples-toolkit 的 STAR_BRIGHTNESS：
// 庙/旺→bright、利/平→normal、不利/陷→dim），非 iztro 七级原值。
const BRIGHTNESS_LABEL: Record<string, string> = { bright: "庙旺", normal: "利平", dim: "陷" };

// 键序即展示序（SELECT * 列序同源，见 db.ts DDL）。
/** samples 字段中文展示名，键序即展示序。 */
export const SAMPLE_LABELS: Record<string, string> = {
	sample_id: "样本 ID",
	year: "公历年",
	month: "公历月",
	day: "公历日",
	hour: "公历小时",
	gender: "性别",
	longitude: "经度",
	lunar_year: "农历年",
	lunar_month: "农历月",
	lunar_day: "农历日",
	is_leap_month: "农历闰月",
	year_stem: "年干",
	year_branch: "年支",
	ming_gong_branch: "命宫支",
	shen_gong_branch: "身宫支",
	wuxing_ju: "五行局数",
	wuxing_ju_name: "五行局",
	ziwei_pos: "紫微落支",
	current_age: "虚岁",
	current_daxian_index: "当前大限序",
	sihua_lu_star: "生年禄星",
	sihua_quan_star: "生年权星",
	sihua_ke_star: "生年科星",
	sihua_ji_star: "生年忌星",
	sihua_lu_palace: "禄落宫",
	sihua_quan_palace: "权落宫",
	sihua_ke_palace: "科落宫",
	sihua_ji_palace: "忌落宫",
};

// 干支码译成「码（名）」，其余走 cell。
/**
 * 渲染单个样本字段：干支码译成「码（名）」，其余走 cell。
 *
 * @param key - 列名，决定译码方式
 * @param v - 该列的原始取值
 * @returns 展示字符串；未登记列原样交 {@link cell}
 */
export function formatSampleValue(key: string, v: unknown): string {
	if (v === null || v === undefined) {
		return cell(v);
	}
	if (key === "gender") {
		return v === "male" ? "男" : v === "female" ? "女" : cell(v);
	}
	if (
		key === "year_stem" ||
		key === "year_branch" ||
		key === "ming_gong_branch" ||
		key === "shen_gong_branch" ||
		key === "ziwei_pos"
	) {
		const n = Number(v);
		const names = key === "year_stem" ? GAN : ZHI;
		return `${n}（${names[n] ?? "?"}）`;
	}
	return cell(v);
}

/** 空值渲染为「—」，其余转字符串。 */
export const dash = (v: unknown): string => (v === null || v === undefined ? "—" : String(v));

// 星曜列表：空数组/NULL 出 —，多项以空格分隔。
/**
 * 星曜列表：空数组或 NULL 出「—」，多项以空格分隔。
 *
 * @param v - 星曜名数组
 * @param brightness - 与 `v` 下标对齐的亮度码数组（缺省或非数组则只列星名）
 * @returns 渲染结果；空数组为 `—`
 */
export function starList(v: unknown, brightness?: unknown): string {
	if (!Array.isArray(v) || v.length === 0) {
		return "—";
	}
	const bs = Array.isArray(brightness) ? brightness : [];
	return v
		.map((s, i) => {
			const b =
				bs[i] === null || bs[i] === undefined
					? ""
					: (BRIGHTNESS_LABEL[String(bs[i])] ?? String(bs[i]));
			return b ? `${s}（${b}）` : String(s);
		})
		.join(" ");
}

// 四化：sihua_stars 形如 ["贪狼:忌"]，还原为「化曜（星）」；无化出 —。
/**
 * 四化渲染：把 `["贪狼:忌"]` 还原为「化曜（星）」，无化出「—」。
 *
 * @param flags - 四化标记串（如 `禄`）
 * @param stars - 四化星条目（形如 `星名:四化`，取冒号前部分）
 * @returns `标记（星名）`；两者皆空时为 `—`
 */
export function sihuaCell(flags: unknown, stars: unknown): string {
	const f = typeof flags === "string" ? flags.trim() : "";
	const names =
		Array.isArray(stars) && stars.length > 0
			? stars.map(s => String(s).split(":")[0]).join("、")
			: "";
	if (!f && !names) {
		return "—";
	}
	return names ? `${f}（${names}）` : f;
}
