/**
 * knowledge 的 **stars 域**：星曜释义（原独立 `stars` 命令已并入，旧命令名不保留）。
 *
 * 数据是内核轻表（`STAR_DESCRIPTIONS`），静态 import 不影响启动（见 docs/code/cli-commands.md）。
 */

import type { CliArgs } from "../args";
import { STAR_DESCRIPTIONS } from "@/data/stars";

/** 渲染 stars 域：无关键词列全部星曜，有关键词出该星的「关键词 · 星性 · 五行」。 */
export function renderStars(args: CliArgs): string {
	const names = Object.keys(STAR_DESCRIPTIONS);
	// 裸开关（--search 落在参数末尾）会被解析层存成 true（可选值形态），先拦下指路，
	// 否则 String(true) = "true" 被当成星名，静默产出错结果。
	if (typeof args.search === "boolean")
		{throw new Error(
			"--search 需要一个检索词（如 --search 紫微），也可直接写位置参数：knowledge --source stars 紫微。"
		);}
	// 位置参数与 --search 等价（与 books 域同款回退）。
	const q = String(args.search ?? args._.join(" "));
	if (q) {
		const s = STAR_DESCRIPTIONS[q];
		if (!s) {return `未收录星曜「${q}」。已收录：${names.join("、")}`;}
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
