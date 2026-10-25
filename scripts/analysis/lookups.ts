/**
 * 文案查表与性别投影、格局投影 —— 把「星 × 宫 × 四化」翻成文案。
 *
 * ⚠️ 本文件读的是 `./data` 的表（四化语义 / 次星宫位文案 / 格局判词），不产生输出行；
 *    `selectGender` 是唯一不查表的，把 `string | GenderField` 投影为当前性别的文本。
 *
 * 与 `palace-query.ts` 的分层差别，见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
import {
	MINOR_STAR_PALACE_CONTENT,
	SIHUA_CHAR_TO_KEY,
	STAR_CONTENT_MAP,
	type GenderField,
} from "../analysis/data";
// 格局的**命中判定**统一由 patterns/ 负责（本文件只写判词），故这里引它的产出。
// 所有手写判定（含 12 个原先只在本文件存在的格局）都已收敛到 patterns/，
// `detectGeJu` 不含任何判定。
import { detectPatterns, type Pattern } from "../patterns";

/**
 * 性别投影：把 `string | GenderField` 字段投影为当前性别的文本。
 *
 * - 纯 `string`：无性别差异，原样返回；
 * - `GenderField`：`common` + 当前性别的专属段（`male` / `female`）+ `suffix` 拼接；
 * - `undefined`：可选字段缺省，返回空串。
 *
 * 这是取代 `filterGenderContent` 正则剥离的结构化投影——性别差异已在数据层拆进字段，
 * 消费方只做一次投影，不再对成稿跑正则。
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
 * 过滤与当前性别无关的内容（已废弃，保留语义说明供迁移对拍参考）。
 *
 * ⚠️ 本函数已被 {@link selectGender} 的结构化投影取代——性别差异在数据层拆进
 * `GenderField`（`common`/`male`/`female`/`suffix`），消费方只做投影，不再对成稿跑正则。
 * 保留此注释仅为记录旧三规则语义，供重构回归时逐字节对拍。
 */

/** 获取某颗星在某宫的四化modifier文字（按性别投影） */
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

/** 获取次星在某宫的详细文案 */
export function getMinorStarNote(starName: string, palaceName: string): string {
	return MINOR_STAR_PALACE_CONTENT[starName]?.[palaceName] ?? "";
}

/** 识别命盘中的重要格局 */
export function detectGeJu(chart: ZiweiChart): { name: string; description: string }[] {
	// ⚠️ 本函数只是**投影**：判定与判词全归 `patterns/`（82 个格局各有独立预言机盯着），
	//    这里把填了长判词的命中挑出来展示；**新增格局只要在识别器里填 `topicDescription`，
	//    这边自动就能展示**。展示顺序按 level 降序（同级保持识别器注册序）。
	return detectPatterns(chart)
		.filter((p): p is Pattern & { topicDescription: string } => !!p.topicDescription)
		.sort((a, b) => b.level - a.level)
		.map(p => ({ name: p.name, description: p.topicDescription }));
}
