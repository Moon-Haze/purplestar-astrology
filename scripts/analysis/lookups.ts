/** @file 查表与投影
 * @packageDocumentation */

import type { ZiweiChart } from "../types";
import {
	MINOR_STAR_PALACE_CONTENT,
	SIHUA_CHAR_TO_KEY,
	STAR_CONTENT_MAP,
	type BranchedContent,
	type GenderField,
	type PalaceContent,
} from "../analysis/data";
// 格局的**命中判定**统一由 patterns/ 负责（本文件只写判词），故这里引它的产出。
// 所有手写判定（含 12 个原先只在本文件存在的格局）都已收敛到 patterns/，
// `detectGeJu` 不含任何判定。
import { detectPatterns, type Pattern } from "../patterns";

/** 星徽，全仓唯一
 * @param star - 星
 * @returns 文本 */
export function starBadge(star: { name: string; mutagen?: string; brightness?: string }): string {
	const hua = star.mutagen ? `化${star.mutagen}` : "";
	const bright =
		star.brightness === "bright" ? "（庙旺）" : star.brightness === "dim" ? "（落陷）" : "";
	return `${star.name}${hua}${bright}`;
}

/** 投影，取代`filterGenderContent`正则
 * @param field - string原样；{@link GenderField}拼common+性别段+suffix
 * @param gender - 性别
 * @returns 文本 */
export function selectGender(
	field: string | GenderField | undefined,
	gender: "male" | "female"
): string {
	if (field === undefined) {
		return "";
	}
	if (typeof field === "string") {
		return field;
	}
	return (
		field.common +
		(gender === "male" ? (field.male ?? "") : (field.female ?? "")) +
		(field.suffix ?? "")
	);
}

/** {@link BranchedContent}判别：与 {@link GenderField} 同有common，按四化/亮度键分
 * @param raw - 字符串/{@link GenderField}/{@link BranchedContent}
 * @returns 布尔 */
function isBranched(raw: PalaceContent): raw is BranchedContent {
	return typeof raw === "object" && ("sihua" in raw || "brightness" in raw);
}

/** 补句读，子句逐字留
 * @param text - 子句
 * @returns 尾非`。；！？`补「。」 */
function branchPiece(text: string): string {
	return /[。；！？]$/.test(text) ? text : text + "。";
}

/** 「未迁移条目逐字节不变」，亮度先四化后、子句逐字留；中段穿插/性别内嵌不迁移
 * @param raw - 空/string/{@link GenderField}原/{@link BranchedContent}分支
 * @param star - 星
 * @param gender - 性别
 * @returns 文本 */
export function selectBranches(
	raw: PalaceContent | undefined,
	star: { mutagen?: string; brightness?: string },
	gender: "male" | "female"
): string {
	if (raw === undefined) {
		return "";
	}
	if (typeof raw === "string" || !isBranched(raw)) {
		return selectGender(raw as string | GenderField, gender);
	}
	// 分号兜底清洗：原散文「X；化忌则Y。」拆走分支后 common 可能残留尾分号，
	// 数据侧已批量清洗（存量），此处防未来新增条目再犯（增量）——两层互指。
	let out = selectGender(raw.common, gender).replace(/；$/, "。");
	if (out && !/[。；！？]$/.test(out)) {
		out += "。";
	}
	const bKey = star.brightness === "bright" ? "bright" : star.brightness === "dim" ? "dim" : null;
	const brightPiece = bKey ? raw.brightness?.[bKey] : undefined;
	if (brightPiece) {
		out += branchPiece(selectGender(brightPiece, gender));
	}
	const huaKey = star.mutagen ? SIHUA_CHAR_TO_KEY[star.mutagen] : undefined;
	const huaPiece = huaKey ? raw.sihua?.[huaKey] : undefined;
	if (huaPiece) {
		out += branchPiece(selectGender(huaPiece, gender));
	}
	return out;
}

/** @remarks 废弃，由 {@link selectGender} 取代；详 docs/code/analysis.md。 */

/** 四化文案
 * @param starName - 星名
 * @param mutagen - 四化
 * @param gender - 性别
 * @returns 文本 */
export function getMutagenNote(
	starName: string,
	mutagen: string,
	gender: "male" | "female"
): string {
	const profile = STAR_CONTENT_MAP[starName];
	if (!profile?.sihua) {
		return "";
	}
	const key = SIHUA_CHAR_TO_KEY[mutagen];
	if (!key) {
		return "";
	}
	return selectGender(profile.sihua[key], gender);
}

/** 次星文案
 * @param starName - 星名
 * @param palaceName - 宫名
 * @returns 文本 */
export function getMinorStarNote(starName: string, palaceName: string): string {
	return MINOR_STAR_PALACE_CONTENT[starName]?.[palaceName] ?? "";
}

/** 格局（判定归patterns/）
 * @param chart - 盘
 * @returns 列表 */
export function detectGeJu(chart: ZiweiChart): { name: string; description: string }[] {
	// ⚠️ 本函数只是**投影**：判定与判词全归 `patterns/`（82 个格局各有独立预言机盯着），
	//    这里把填了长判词的命中挑出来展示；**新增格局只要在识别器里填 `topicDescription`，
	//    这边自动就能展示**。展示顺序按 level 降序（同级保持识别器注册序）。
	return detectPatterns(chart)
		.filter((p): p is Pattern & { topicDescription: string } => !!p.topicDescription)
		.sort((a, b) => b.level - a.level)
		.map(p => ({ name: p.name, description: p.topicDescription }));
}
