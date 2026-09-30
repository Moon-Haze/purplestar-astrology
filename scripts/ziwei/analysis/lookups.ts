/**
 * 文案查表与两条过滤器 —— 把「星 × 宫 × 四化」翻成文案，另加性别过滤与格局投影。
 *
 * @remarks
 * 本文件与 `palace-query.ts` 同层，区别在于**它读的是 `./data` 的表**：
 * `getMutagenNote` 查四化语义、`getMinorStarNote` 查次星宫位文案、`detectGeJu` 取格局判词。
 * 都不产生输出行，被 `views/` 各节调用。
 *
 * `filterGenderContent` 是唯一一个不查表的：它在 `index.ts` 的末尾对**整篇成品文本**
 * 做一次性别过滤，故不属任何单节。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
import { MINOR_STAR_PALACE_CONTENT, SIHUA_CHAR_TO_KEY, STAR_CONTENT_MAP } from "./data";
// 格局的**命中判定**统一由 patterns/ 负责（本文件只写判词），故这里引它的产出。
// 2026-09-26 先对齐了 4 个口径分歧的格局（紫府同宫 / 火贪格 / 铃贪格 / 机月同梁）；
// 2026-09-27 把剩下 ~30 段手写判定**全部**收敛过去（含 12 个原先只在本文件存在的格局，
// 判定搬进 patterns.ts 的「收敛自 db-analysis 的格局」一组）。至此 `detectGeJu` 不含任何判定。
import { detectPatterns, type Pattern } from "../patterns";

/**
 * 过滤与当前性别无关的内容
 * 规则：
 *  1. 删除"；女命xxx"或"；男命xxx"格式的分号子句
 *  2. 删除以"女命"或"男命"开头的完整句子（到。！？结束）
 */
export function filterGenderContent(text: string, gender: "male" | "female"): string {
	const removeTag = gender === "male" ? "女命" : "男命";

	let result = text;

	// 规则1：删除 ；女命/男命 引导的子句（不跨句末标点）
	result = result.replace(new RegExp(`；${removeTag}[^；。！？]*`, "g"), "");

	// 规则3：删除整行以 （女命）/（男命） 开头的内容
	result = result
		.split("\n")
		.filter(line => {
			const t = line.trimStart();
			return !t.startsWith("（" + removeTag + "）");
		})
		.join("\n");

	// 规则2：按行处理，删除以 removeTag 开头的完整句子
	result = result
		.split("\n")
		.map(line => {
			if (!line.includes(removeTag)) return line;

			const kept: string[] = [];
			let rest = line;

			while (rest.length > 0) {
				const endIdx = rest.search(/[。！？]/);
				if (endIdx === -1) {
					// 无句末标点的剩余片段
					const trimmed = rest.trimStart();
					if (
						!trimmed.startsWith(removeTag) &&
						!trimmed.startsWith("（" + removeTag + "）")
					)
						kept.push(rest);
					break;
				}
				const sentence = rest.slice(0, endIdx + 1);
				rest = rest.slice(endIdx + 1);
				const trimmed = sentence.trimStart();
				if (!trimmed.startsWith(removeTag) && !trimmed.startsWith("（" + removeTag + "）"))
					kept.push(sentence);
			}

			return kept.join("");
		})
		.join("\n");

	return result;
}

/** 获取某颗星在某宫的四化modifier文字 */
export function getMutagenNote(starName: string, mutagen: string): string {
	const profile = STAR_CONTENT_MAP[starName];
	if (!profile?.sihua) return "";
	const key = SIHUA_CHAR_TO_KEY[mutagen];
	if (!key) return "";
	return profile.sihua[key] ?? "";
}

/** 获取次星在某宫的详细文案 */
export function getMinorStarNote(starName: string, palaceName: string): string {
	return MINOR_STAR_PALACE_CONTENT[starName]?.[palaceName] ?? "";
}

/** 识别命盘中的重要格局 */
export function detectGeJu(chart: ZiweiChart): { name: string; description: string }[] {
	// 格局的**命中事实层 + 两套判词**如今都归 `patterns/`：
	//   - 判定（唯一一处）：`detectPatterns`，82 个格局各有独立预言机盯着
	//   - analyze 侧短判词 + 等级：`Pattern.description` / `Pattern.level`
	//   - topic 侧倪师口吻长判词：`Pattern.topicDescription`
	//
	// 本函数只是**投影**：把填了长判词的命中挑出来，供 `overview` / `personality` 展示。
	// 2026-09-27 之前，25 段长判词散在本目录的前身 `analysis.ts` 里、按名字二次查表
	// （`hasAny` / `bySuffix` / `starOf` 三个 helper 就是为此而生）；现已搬进各识别器。
	// **新增格局只要在 patterns/ 的识别器里填 `topicDescription`，这边自动就能展示**，
	// 不会再有「判定加了、判词忘了补、topic 静默不显示」的漏。
	//
	// 展示顺序**按 level 降序**（同级保持识别器注册序）—— 不再维护一张 25 元素的手写
	// 顺序表：那张表每加一个格局都要同步，是纯粹的漂移源。（2026-09-27 之前的顺序是
	// 手写的 1–25，与判定无关，故这次变动不影响任何判定结果。）
	return detectPatterns(chart)
		.filter((p): p is Pattern & { topicDescription: string } => !!p.topicDescription)
		.sort((a, b) => b.level - a.level)
		.map(p => ({ name: p.name, description: p.topicDescription }));
}
