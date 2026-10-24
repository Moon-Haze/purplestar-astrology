/**
 * knowledge 的 **stars 域**：星曜释义（实现即插件：渲染逻辑与注册形态同址，无转发壳）。
 *
 * 数据是内核轻表（`STAR_DESCRIPTIONS`），静态 import 不影响启动。`--search` 三态与
 * `--limit` 校验由命令入口守卫单点承担（`cli/knowledge/index.ts`），本域只做
 * 检索词 → 释义渲染。
 */

import type { CliArgs } from "@/cli/args";
import type { KnowledgeSource } from "../types";
import { STAR_DESCRIPTIONS } from "@/data/stars";

/** stars 域：无关键词列全部星曜，有关键词出该星的「关键词 · 星性 · 五行」。 */
export const starsSource: KnowledgeSource = {
	id: "stars",
	label: "星曜释义",
	search(args: CliArgs): string {
		const names = Object.keys(STAR_DESCRIPTIONS);
		// 位置参数与 --search 等价（与 books 域同款回退）。
		const q = String(args.search ?? args._.join(" "));
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

// 四域的「实现即插件」形态与懒加载纪律见 docs/code/knowledge.md。
