/**
 * 文案查表与性别投影、格局投影 —— 把「星 × 宫 × 四化」翻成文案。
 *
 * ⚠️ 本文件读的是 `./data` 的表（四化语义 / 次星宫位文案 / 格局判词），不产生输出行；
 *    `selectGender` 是唯一不查表的，把 `string | GenderField` 投影为当前性别的文本。
 *
 * 与 `palace-query.ts` 的分层差别，见 docs/code/analysis.md。
 *
 * @file 文案查表与性别投影、格局投影 —— 把「星 × 宫 × 四化」翻成文案
 *
 * @packageDocumentation
 */

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

/**
 * 星曜徽标：`星名` + `化X`（有四化时）+ `（庙旺）/（落陷）`（有亮度时）。
 * 全仓唯一的徽标拼式；亮度用全角括号与星名、化象视觉分离。
 * 自 overview-material 挪入——query 与 material 双侧共用的格式化件，原驻地使
 * query 层反向引 material 层、构成类型级环。
 *
 * @param star - 星曜的三项展示因子：`name` 星名（原样输出）、`mutagen` 四化字（`禄`/`权`/`科`/`忌`，省略即不拼化象）、`brightness` 亮度键（只认 `bright`/`dim`，其余值按无亮度处理，省略即不拼亮度括号）
 * @returns 单行徽标文本；无四化无亮度时就是星名本身
 */
export function starBadge(star: { name: string; mutagen?: string; brightness?: string }): string {
	const hua = star.mutagen ? `化${star.mutagen}` : "";
	const bright =
		star.brightness === "bright" ? "（庙旺）" : star.brightness === "dim" ? "（落陷）" : "";
	return `${star.name}${hua}${bright}`;
}

/**
 * 性别投影：把 `string | GenderField` 字段投影为当前性别的文本。
 *
 * - 纯 `string`：无性别差异，原样返回；
 * - `GenderField`：`common` + 当前性别的专属段（`male` / `female`）+ `suffix` 拼接；
 * - `undefined`：可选字段缺省，返回空串。
 *
 * 这是取代 `filterGenderContent` 正则剥离的结构化投影——性别差异已在数据层拆进字段，
 * 消费方只做一次投影，不再对成稿跑正则。
 *
 * @param field - 待投影字段：纯 `string` 原样返回；{@link GenderField} 按 `common`+性别段+`suffix` 拼接；`undefined` 视为缺省
 * @param gender - 当前命盘性别，只用于在 `GenderField` 的 `male` / `female` 两段间取舍
 * @returns 投影后的文本；`field` 为 `undefined`、或 `GenderField` 缺对应性别段与 suffix 时返回 `""`
 */
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

/**
 * {@link BranchedContent} 判别：它与 {@link GenderField} 都有 `common`，按四化 / 亮度分支键区分。
 *
 * @param raw - 任一形态的宫位语境条目（字符串 / {@link GenderField} / {@link BranchedContent}）
 * @returns 带 `sihua` 或 `brightness` 分支键时为 `true`，即该条目可走分支投影
 */
function isBranched(raw: PalaceContent): raw is BranchedContent {
	return typeof raw === "object" && ("sihua" in raw || "brightness" in raw);
}

/**
 * 命中分支句的句读补齐：子句文本逐字保留，缺尾句读时由投影层补「。」。
 *
 * @param text - 已按性别投影的单条分支子句
 * @returns 原文逐字保留；尾字不是 `。；！？` 之一时补一个「。」，是则原样返回
 */
function branchPiece(text: string): string {
	return /[。；！？]$/.test(text) ? text : text + "。";
}

/**
 * 宫位语境条目投影：按该星实际四化与亮度拼接「common + 命中分支」。
 *
 * - 纯 `string` / `GenderField`（未迁移条目）：原投影输出，行为与迁移前逐字节一致
 *   （双形态兼容，见 spec interpretation-content「未迁移条目逐字节不变」）；
 * - `BranchedContent`（已迁移）：只拼命中分支——亮度条件在前、四化条件在后（随原
 *   散文次序），未命中分支不出现在交付文本。命中子句逐字保留，句读由本函数补齐。
 *
 * 条件句为**中段穿插**（拆分会破坏行文）或性别专属段内嵌的条目不迁移，见
 * `data.ts` 的显式豁免清单。
 *
 * @param raw - 该星在该宫的条目：`undefined` 无文案；`string` / {@link GenderField} 走原投影；{@link BranchedContent} 走分支投影
 * @param star - 该星在盘上的实际状态：`mutagen` 四化字（决定 `sihua` 命中哪条）、`brightness` 亮度键（只认 `bright`/`dim`，决定 `brightness` 命中哪条）；都省略则只输出 `common`
 * @param gender - 当前命盘性别，用于投影 `common` 与命中分支里的 `GenderField`
 * @returns 拼接后的文案；无条目、或条目中无任何命中分支且 `common` 为空时返回 `""`，否则保证以句读收尾
 */
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

/**
 * 过滤与当前性别无关的内容（已废弃，保留语义说明供迁移对拍参考）。
 *
 * ⚠️ 本函数已被 {@link selectGender} 的结构化投影取代——性别差异在数据层拆进
 * `GenderField`（`common`/`male`/`female`/`suffix`），消费方只做投影，不再对成稿跑正则。
 * 保留此注释仅为记录旧三规则语义，供重构回归时逐字节对拍。
 */

/**
 * 获取某颗星在某宫的四化modifier文字（按性别投影）
 *
 * @param starName - 星名（`STAR_CONTENT_MAP` 的键域，即内核星表口径）
 * @param mutagen - 四化字（`禄`/`权`/`科`/`忌`）；经 `SIHUA_CHAR_TO_KEY` 归一，非法字按无文案处理
 * @param gender - 当前命盘性别，用于投影该四化条目的 `GenderField`
 * @returns 该星该四化的文案；星无 `sihua` 表或四化字非法时返回 `""`
 */
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

/**
 * 获取次星在某宫的详细文案
 *
 * @param starName - 次星名（`MINOR_STAR_PALACE_CONTENT` 的一级键）
 * @param palaceName - 宫名（二级键；展开形带「宫」字，与运行时宫名域同域）
 * @returns 该次星该宫的文案；星或宫任一未收录时返回 `""`
 */
export function getMinorStarNote(starName: string, palaceName: string): string {
	return MINOR_STAR_PALACE_CONTENT[starName]?.[palaceName] ?? "";
}

/**
 * 识别命盘中的重要格局
 *
 * @param chart - 已排好的命盘（判定全由 `patterns/` 的识别器完成）
 * @returns 命中且填了长判词的格局列表，按格局等级 `level` 降序（同级保持识别器注册序）；元素为格局名与判词。无命中时为空数组
 */
export function detectGeJu(chart: ZiweiChart): { name: string; description: string }[] {
	// ⚠️ 本函数只是**投影**：判定与判词全归 `patterns/`（82 个格局各有独立预言机盯着），
	//    这里把填了长判词的命中挑出来展示；**新增格局只要在识别器里填 `topicDescription`，
	//    这边自动就能展示**。展示顺序按 level 降序（同级保持识别器注册序）。
	return detectPatterns(chart)
		.filter((p): p is Pattern & { topicDescription: string } => !!p.topicDescription)
		.sort((a, b) => b.level - a.level)
		.map(p => ({ name: p.name, description: p.topicDescription }));
}
