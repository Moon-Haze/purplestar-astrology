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
	if (args.search) {
		// 用 String() 归一，与原先 obj[args.search] 的取值结果逐字等价：
		// 对象下标本就会把 true / 数组强制转成字符串（数组转成 join(",") 的结果）。
		const q = String(args.search);
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

