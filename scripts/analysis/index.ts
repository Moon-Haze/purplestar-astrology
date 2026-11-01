/**
 * 紫微斗数分析数据库 — 倪海厦《天纪》正统口径：主题论断库装配点。
 *
 * ⚠️ 知识来源分四级（verified / traditional / methodology / suspect），「倪师…说」引句
 *    部分为传统口诀的风格化转述，CLI 在输出末尾固定披露 —— 登记表在 `./grades`。
 * ⚠️ 各 view **只读 ctx、只返回自己的行**：不互相调用、不写回 ctx；唯一的跨节状态
 *    `mutagenInSanFang` 已提升进 `./context`。
 *
 * 来源与三处口径适配、架构与文件分工、公开面 re-export 理由，见
 * docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
// 本目录的元数据表与论断文案在
// ./data（STAR_CONTENT_MAP，含「倪师…说」引文）。公开面由文末 re-export 兜住。
import {
	TOPIC_KEYS,
	TOPIC_DEFS,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type AnalysisOptions,
	type AnalysisView,
	type TopicKey,
} from "../analysis/data";
import { makeContext } from "../analysis/context";
import { renderDecadal, renderDecadalItems } from "../analysis/views/decadal";
import { renderHealth, renderHealthItems } from "../analysis/views/health";
import { renderKuiYue, renderKuiYueItems } from "../analysis/views/patron";
import { renderLiuNian, renderLiuNianItems } from "../analysis/views/yearly";
import { renderOverview, renderOverviewItems } from "../analysis/views/overview";
import { renderPersonality, renderPersonalityItems } from "../analysis/views/personality";
import { renderSanFang, renderSanFangItems } from "../analysis/views/surround";
import { renderMutagen, renderMutagenItems } from "../analysis/views/mutagen";
import { renderSuggestions, renderSuggestionsItems } from "../analysis/views/suggestions";
import { renderYearStem, renderYearStemItems } from "../analysis/views/year-stem";
import { formatItems, type AnalysisItem } from "../analysis/items";
import {
	getTopicReport,
	getTopicReportMeta,
	getTopicMainContentTexts,
	getDecadalSection,
	type ReportCitation,
	type ReportOptions,
} from "../analysis/report";

// ─── 核心分析函数（总分结构 + 三方四正 + 本命四化会照 + 大限）───────────────────

/**
 * 生成某个主题的完整论断报告。
 *
 * @param chart - 已排好的命盘
 * @param topic - 主题键（14 个之一，见 `./data` 的 `TOPIC_KEYS`）
 * @param options - 视角 / 流年年月 / 大限下标
 * @returns 报告全文（已按出生性别过滤掉无关性别的句子）
 *
 * @remarks
 * 本函数是**编排层**：建一次上下文，按小节序把十一个 `renderXxx` 的行首尾相接。
 *
 * ⚠️ 两点不要动：① 下面的拼接顺序即报告小节序，调整会改变输出；② 性别过滤作用在
 *    **整篇**文本上而非逐节（跨行内子句，逐节会漏掉跨节边界的句子）——
 *    理由见 docs/code/analysis.md。
 */
export function getTopicAnalysis(
	chart: ZiweiChart,
	topic: TopicKey,
	options: AnalysisOptions = {}
): string {
	const items = getTopicAnalysisItems(chart, topic, options);
	if (typeof items === "string") {
		return items;
	}
	// 性别已在各 view 经 selectGender 投影，此处仅拼接，不再做整篇正则过滤。
	return formatItems(items).join("\n");
}

/**
 * 生成某个主题的**结构化条目流**（一源双投影的数据面）。
 *
 * @returns 条目流；主宫找不到时返回与 {@link getTopicAnalysis} 同口径的兜底提示串
 *   （该形态无结构化面——调用方以 `typeof === "string"` 分流）。
 *
 * @remarks
 * 与 {@link getTopicAnalysis} 同一编排序（小节序即条目拼接序），各 view 的
 * `renderXxxItems` 产出条目、文本行由 `formatItems` 投影 —— 两个投影同源，
 * 文本形态由基线 diff=0 锚定（structure-analysis-outputs）。
 */
export function getTopicAnalysisItems(
	chart: ZiweiChart,
	topic: TopicKey,
	options: AnalysisOptions = {}
): AnalysisItem[] | string {
	const ctx = makeContext(chart, topic, options);
	if (!ctx) {
		return `无法找到${TOPIC_PALACE_NAME[topic]}相关信息。`;
	}

	return [
		...renderOverviewItems(ctx), // 一、总论
		...renderSanFangItems(ctx), // 二、三方四正联动分析
		...renderMutagenItems(ctx), // 三、本命四化会照
		...renderYearStemItems(ctx), // 三点五、年干四化·全局关键宫位解读
		...renderDecadalItems(ctx), // 四、当前大限分析
		...renderLiuNianItems(ctx), // 四点五、流年 + 四点六、流月
		...renderPersonalityItems(ctx), // 五、性格专属补充
		...renderHealthItems(ctx), // 五点五、疾厄宫
		...renderKuiYueItems(ctx), // 五点六、魁钺贵人倾向细分
		...renderSuggestionsItems(ctx), // 六、综合建议
	];
}

// ─── 公开面 re-export ────────────────────────────────────────────────────────
// 本公开面导出 8 个值：TOPIC_LABEL / TOPIC_PALACE_NAME / getTopicReport /
// getTopicReportMeta / getTopicMainContentTexts / getDecadalSection +
// TOPIC_KEYS / TOPIC_DEFS（Phase 4 新增）。
// ⚠️ TOPIC_KEYS / TOPIC_DEFS 是主题注册表的**单一真相源**（Phase 2 收编的 8 张平行表
//    已由它派生），新增主题只在此表加条目。
// 逐项理由见 docs/code/analysis.md。
export {
	TOPIC_KEYS,
	TOPIC_DEFS,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	getTopicReport,
	getTopicReportMeta,
	getTopicMainContentTexts,
	getDecadalSection,
};
export type { AnalysisOptions, AnalysisView, TopicKey, ReportCitation, ReportOptions, AnalysisItem };
