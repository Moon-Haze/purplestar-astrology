/**
 * @file 本盘信号确定性生成建议（dynamic-topic-suggestions）
 * 主星亮度/三方四化/大限关系；{@link AnalysisContext}→句+依据。
 * `views/suggestions.ts`/`--report` 仅装配。⚠️同盘同参一致；缺信号降 `TOPIC_SUGGESTION_FALLBACK`
 * 标「无命中信号」(spec「综合建议按盘推算」)，不虚构。
 * @packageDocumentation
 */

import {
	SIHUA_CHAR_TO_KEY,
	TOPIC_SUGGESTION_DECADAL,
	TOPIC_SUGGESTION_FALLBACK,
	TOPIC_SUGGESTION_TEMPLATES,
} from "./data";
import type { AnalysisContext } from "./context";

/** `basis`=依据。 */
export interface SuggestionLine {
	/** 成句 */
	text: string;
	/** 依据；无命中降级 */
	basis: "主星亮度" | "本命四化" | "当前大限" | "无命中信号";
}

/**
 * `basis`→括注(评审6)；编排器拼版式头。
 * @param s - 建议
 * @returns `→ `+正文；无命中加「（本盘无此主题的直接信号，此为通用收束）」
 */
export function suggestionLine(s: SuggestionLine): string {
	return s.basis === "无命中信号"
		? `→ ${s.text}（本盘无此主题的直接信号，此为通用收束）`
		: `→ ${s.text}`;
}

/**
 * 槽位 {star} {palace} {dxPalace} {huaStar} {huaPalace}；未给原样。
 * @param text - {槽名}句
 * @param slots - 槽名→值
 * @returns 填充句
 */
function fill(text: string, slots: Record<string, string>): string {
	return text.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);
}

/**
 * @param dxBranch - 大限地支(0–11)
 * @param palaceBranch - 宫地支(0–11)
 * @returns 差0→self、6→oppo、4/8→same、余→none（本宫/三合/对冲/无同气）
 */
function decadalKey(dxBranch: number, palaceBranch: number): "self" | "same" | "oppo" | "none" {
	const delta = (dxBranch - palaceBranch + 12) % 12;
	if (delta === 0) {
		return "self";
	}
	if (delta === 6) {
		return "oppo";
	}
	if (delta === 4 || delta === 8) {
		return "same";
	}
	return "none";
}

/**
 * 出句：亮度→bright/dim；四化首条→lu/ji；大限四选一；全缺→降级句。
 * @param ctx - {@link AnalysisContext}：只读主题/宫位/亮度/四化/大限，不重算
 * @returns 句+依据：按命中序，起运追大限；未命中返 {@link TOPIC_SUGGESTION_FALLBACK}
 */
export function buildTopicSuggestions(ctx: AnalysisContext): SuggestionLine[] {
	const slots: Record<string, string> = {
		star: ctx.primaryStar?.name ?? ctx.palaceName,
		palace: ctx.palaceName,
		dxPalace: ctx.currentDx?.palaceName ?? "",
	};
	const out: SuggestionLine[] = [];

	for (const t of TOPIC_SUGGESTION_TEMPLATES[ctx.topic]) {
		if (t.kind === "bright" && ctx.primaryStar?.brightness === "bright") {
			out.push({ text: fill(t.text, slots), basis: "主星亮度" });
		}
		if (t.kind === "dim" && ctx.primaryStar?.brightness === "dim") {
			out.push({ text: fill(t.text, slots), basis: "主星亮度" });
		}
		if (t.kind === "lu" || t.kind === "ji") {
			// ⚠️ `m.mutagen`=四化字，`kind`=lu/ji，须经 `SIHUA_CHAR_TO_KEY`；
			// 直比恒假，「本命四化」不命中，此处修复。
			const hit = ctx.mutagenInSanFang.find(m => SIHUA_CHAR_TO_KEY[m.mutagen] === t.kind);
			if (hit) {
				out.push({
					text: fill(t.text, {
						...slots,
						huaStar: hit.starName,
						huaPalace: hit.palaceName,
					}),
					basis: "本命四化",
				});
			}
		}
	}

	const dx = ctx.currentDx;
	if (dx) {
		out.push({
			text: fill(
				TOPIC_SUGGESTION_DECADAL[decadalKey(dx.palaceBranch, ctx.mainPalace.branch)],
				slots
			),
			basis: "当前大限",
		});
	}

	if (out.length === 0) {
		return [{ text: fill(TOPIC_SUGGESTION_FALLBACK[ctx.topic], slots), basis: "无命中信号" }];
	}
	return out;
}
