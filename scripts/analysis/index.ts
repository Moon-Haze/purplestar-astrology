/**
 * 紫微斗数分析数据库 v3 — 倪海厦《天纪》正统口径：主题论断库装配点。
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
import { filterGenderContent } from "../analysis/lookups";
import { renderDecadal } from "../analysis/views/decadal";
import { renderHealth } from "../analysis/views/health";
import { renderKuiYue } from "../analysis/views/patron";
import { renderLiuNian } from "../analysis/views/yearly";
import { renderOverview } from "../analysis/views/overview";
import { renderPersonality } from "../analysis/views/personality";
import { renderSanFang } from "../analysis/views/surround";
import { renderMutagen } from "../analysis/views/mutagen";
import { renderSuggestions } from "../analysis/views/suggestions";
import { renderYearStem } from "../analysis/views/year-stem";
import {
	getTopicReport,
	getTopicReportMeta,
	type ReportCitation,
	type ReportOptions,
} from "../analysis/report";

// ─── 核心分析函数（总分结构 + 三方四正 + 本命四化会照 + 大限）───────────────────

/**
 * 生成某个主题的完整论断报告。
 *
 * @param chart - 已排好的命盘
 * @param topic - 主题键（13 个之一，见 `./data` 的 `TOPIC_KEYS`）
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
	const ctx = makeContext(chart, topic, options);
	if (!ctx) {
		return `无法找到${TOPIC_PALACE_NAME[topic]}相关信息。`;
	}

	const lines: string[] = [
		...renderOverview(ctx), // 一、总论
		...renderSanFang(ctx), // 二、三方四正联动分析
		...renderMutagen(ctx), // 三、本命四化会照
		...renderYearStem(ctx), // 三点五、年干四化·全局关键宫位解读
		...renderDecadal(ctx), // 四、当前大限分析
		...renderLiuNian(ctx), // 四点五、流年 + 四点六、流月
		...renderPersonality(ctx), // 五、性格专属补充
		...renderHealth(ctx), // 五点五、疾厄宫
		...renderKuiYue(ctx), // 五点六、魁钺贵人倾向细分
		...renderSuggestions(ctx), // 六、综合建议
	];

	// 过滤与当前性别无关的内容（男命不显示女命专属句，女命不显示男命专属句）
	const rawText = lines.join("\n");
	return filterGenderContent(rawText, chart.birthInfo.gender);
}

// ─── 公开面 re-export ────────────────────────────────────────────────────────
// 本公开面导出 7 个值：拆分前即有的 4 个转发（TOPIC_LABEL / TOPIC_PALACE_NAME /
// getTopicReport / getTopicReportMeta）+ filterGenderContent（候选 7 新增）
// + TOPIC_KEYS / TOPIC_DEFS（Phase 4 新增）。
// ⚠️ filterGenderContent 上公开面**只为外部可直测**（selftest 的性别过滤断言必须经这里
//    import，直插 lookups 即断言失效）；index ↔ report 两处调用都保持 import `./lookups`。
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
	filterGenderContent,
};
export type { AnalysisOptions, AnalysisView, TopicKey, ReportCitation, ReportOptions };
