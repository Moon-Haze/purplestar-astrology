/**
 * @file knowledge 的 stars 域：星曜释义（「实现即插件」：渲染与注册同址）。
 * 数据为内核轻表 `STAR_DESCRIPTIONS`，静态 import 不影响启动；
 * `--search` 三态与 `--limit` 校验由 `cli/knowledge/index.ts` 守卫。
 */

import type { KnowledgeQuery, KnowledgeSource } from "../types";
import { STAR_DESCRIPTIONS } from "@/data/stars";

/** stars 域：无关键词列全部星曜，有关键词出该星的「关键词 · 星性 · 五行」 */
export const starsSource: KnowledgeSource = {
	id: "stars",
	label: "星曜释义",
	/** 检索星曜释义。 */
	search(query: KnowledgeQuery): string {
		const names = Object.keys(STAR_DESCRIPTIONS);
		// 位置参数与 --search 等价（同 books 域）
		const q = query.term ?? query.positional.join(" ");
		if (q) {
			const s = STAR_DESCRIPTIONS[q];
			if (!s) {
				return `未收录星曜「${q}」。已收录：${names.join("、")}`;
			}
			return `${q}：关键词 ${s.keywords} · 星性 ${s.nature} · 五行 ${s.element}`;
		}
		return [
			"已收录星曜释义：",
			...names.map(n => {
				const s = STAR_DESCRIPTIONS[n];
				return `  ${n}：${s.keywords} · ${s.nature} · ${s.element}`;
			}),
		].join("\n");
	},
};

// 三域「实现即插件」与懒加载纪律见 docs/code/knowledge.md
