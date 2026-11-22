/**
 * 格局专题（--pattern / 别名 --geju）—— detectPatterns 全量输出。
 */

import type { ZiweiChart } from "@/types";
import { detectPatterns } from "@/patterns";

/**
 * `--geju`：格局识别专题 —— detectPatterns 全量输出。
 *
 * @param chart - 命盘
 *
 * @returns 格局专题的输出行（条数抬头 + 逐条名称 / 分数 / 涉及宫位 / 描述，再按需附成立条件与加分条件）；无命中时给一行兜底提示；只拼行，未 `join`
 */
export function patternSection(chart: ZiweiChart): string[] {
	const patterns = detectPatterns(chart);
	const out = [`【格局识别】共 ${patterns.length} 个`];
	if (!patterns.length) {
		out.push("  （未识别到已收录格局）");
	}
	for (const p of patterns) {
		out.push(`  ▸ ${p.name} [${p.level}分]  涉及：${p.palaces.join("、")}`);
		out.push(`    ${p.description}`);
		if (p.conditions) {
			if (p.conditions.required?.length) {
				out.push(`    成立：${p.conditions.required.join("；")}`);
			}
			if (p.conditions.bonus?.length) {
				out.push(`    加分：${p.conditions.bonus.join("；")}`);
			}
			if (p.conditions.breaking?.length) {
				out.push(`    破格：${p.conditions.breaking.join("；")}`);
			}
		}
		if (p.source) {
			out.push(`    出处：${p.source}`);
		}
	}
	return out;
}
