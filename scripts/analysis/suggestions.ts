/**
 * 综合建议推算单点 —— 从本盘实际信号确定性生成建议（change dynamic-topic-suggestions）。
 *
 * 最小信号集（design D2）：主宫主星及亮度、主题三方内的本命四化、当前大限与主题宫的
 * 关系。纯函数、零渲染逻辑：输入 {@link AnalysisContext}，输出结构化建议条目
 * （句子 + 依据信号标注），渲染层（`views/suggestions.ts` 与 `--report`）只装配。
 *
 * ⚠️ 确定性是硬约束：同盘同参数多次调用输出逐字节一致；信号缺失时降级为
 *    `TOPIC_SUGGESTION_FALLBACK` 的通用收束句并**显式标注**「无命中信号」——
 *    降级可见、可数（spec interpretation-content「综合建议按盘推算」），不虚构信号。
 *
 * @file 综合建议推算单点 —— 从本盘实际信号确定性生成建议（change dynamic-topic-suggestions）
 *
 * @packageDocumentation
 */

import {
	SIHUA_CHAR_TO_KEY,
	TOPIC_SUGGESTION_DECADAL,
	TOPIC_SUGGESTION_FALLBACK,
	TOPIC_SUGGESTION_TEMPLATES,
} from "./data";
import type { AnalysisContext } from "./context";

/** 一条推算建议：`basis` 标注依据信号；「无命中信号」为显式降级（渲染层同句可见）。 */
export interface SuggestionLine {
	/** 建议正文（模板句已填充槽位后的成句） */
	text: string;
	/** 依据信号标注：取自哪类推算信号；「无命中信号」表示降级为通用收束句 */
	basis: "主星亮度" | "本命四化" | "当前大限" | "无命中信号";
}

/**
 * 建议行成文单点：`basis` → 括注的投影规则（评审候选 6——此前逐字双写在 `--report` 与
 * `views/suggestions.ts` 两个编排器，改措辞漏一处即两侧漂移）。两个编排器只拼各自的版式头。
 *
 * @param s - 一条推算建议：`text` 是建议正文，`basis` 是依据信号标注
 * @returns 成文行：`→ ` 前缀 + 建议正文；`basis` 为「无命中信号」时再追加括注「（本盘无此主题的直接信号，此为通用收束）」，其余依据不加括注
 */
export function suggestionLine(s: SuggestionLine): string {
	return s.basis === "无命中信号"
		? `→ ${s.text}（本盘无此主题的直接信号，此为通用收束）`
		: `→ ${s.text}`;
}

/**
 * 槽位填充：`{star}` `{palace}` `{dxPalace}` `{huaStar}` `{huaPalace}`；未知槽位保持原样（可断言兜底）。
 *
 * @param text - 含 `{槽名}` 占位符的模板句
 * @param slots - 槽名 → 填充值的映射；覆盖 `{star}` / `{palace}` / `{dxPalace}` / `{huaStar}` / `{huaPalace}`
 * @returns 填充后的句子；`slots` 里没有的槽位原样保留为 `{槽名}`，不静默清空
 */
function fill(text: string, slots: Record<string, string>): string {
	return text.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);
}

/**
 * 大限宫与本主题宫的地支关系：本宫 / 三合 / 对冲 / 无直接同气。
 *
 * @param dxBranch - 当前大限宫的地支索引（0–11）
 * @param palaceBranch - 本主题主宫的地支索引（0–11）
 * @returns 地支差为 0 → `self`（本宫）、6 → `oppo`（对冲）、4 或 8 → `same`（三合），其余 → `none`
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
 * 生成一个主题的综合建议。
 *
 * 出句规则（确定性）：亮度槽 bright / dim 按主宫主星亮度二选一；四化槽 lu / ji 按
 * 主题三方内命中的本命四化出句（取该四化的第一条命中）；大限句按大限宫与主题宫的
 * 地支关系四选一。全部未命中 → 单条降级收束句，`basis` 标「无命中信号」。
 *
 * @param ctx - 已建好的主题上下文（{@link AnalysisContext}）：本函数只读主题键、主宫名与地支、主星及其亮度、主题三方内的本命四化命中、当前大限；不重算盘面
 * @returns 结构化建议条目流（句子 + 依据信号标注）：亮度 / 四化模板按命中顺序出句，当前大限已起运时再追加一条大限句；一条都没命中时返回单条 {@link TOPIC_SUGGESTION_FALLBACK} 收束句，`basis` 为「无命中信号」
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
			// ⚠️ `m.mutagen` 是中文四化字（禄 / 权 / 科 / 忌），模板 `kind` 是 lu / ji ——
			//    两侧不同形，必须过 `SIHUA_CHAR_TO_KEY`；早年直接 `m.mutagen === t.kind` 恒假，
			//    「本命四化」槽**从未命中过**（主星、辅星都一样），本行即该缺陷的修复点。
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
