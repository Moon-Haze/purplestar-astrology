/**
 * `stars` 命令：星曜释义。拆自 commands.ts（各命令按文件拆分，spec §2.2）。
 */

import type { CliArgs } from "./args";
import { STAR_DESCRIPTIONS } from "@/ziwei/constants";

/**
 * `stars` 命令：星曜释义。
 *
 * @param args - CLI 参数表；`--search` 为星名
 * @returns 已渲染好的文本
 *
 * @remarks
 * 不给 `--search` 时列出全部已收录星曜的「关键词 · 星性 · 五行」；给定时只出该星一条，
 * 未收录则回列全部星名。
 */
export function cmdStars(args: CliArgs) {
	const names = Object.keys(STAR_DESCRIPTIONS);
	// 裸开关（--search 落在参数末尾）会被解析层存成 true（可选值形态），先拦下指路，
	// 否则 String(true) = "true" 被当成星名，静默产出错结果。
	if (typeof args.search === "boolean")
		return "--search 需要一个检索词（如 --search 紫微），也可直接写位置参数：stars 紫微。";
	// 位置参数与 --search 等价（SYNOPSIS 承诺的形态，与 cmdClassics 同款回退）。
	const q = String(args.search ?? args._.join(" "));
	if (q) {
		const s = STAR_DESCRIPTIONS[q];
		if (!s) return `未收录星曜「${q}」。已收录：${names.join("、")}`;
		return `${q}：关键词 ${s.keywords} · 星性 ${s.nature} · 五行 ${s.element}`;
	}
	return [
		"已收录星曜释义：",
		...names.map(n => {
			const s = STAR_DESCRIPTIONS[n];
			return `  ${n}：${s.keywords} · ${s.nature} · ${s.element}`;
		}),
	].join("\n");
}

