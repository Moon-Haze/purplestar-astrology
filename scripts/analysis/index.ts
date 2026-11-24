/**
 * ⚠️ 知识四级（verified / traditional / methodology / suspect）；「倪师…说」引句多转述，CLI 末尾披露见 `./grades`。
 * ⚠️ 各 view 只读 ctx 只出自己行，不互调不写回；跨节状态 `mutagenInSanFang` 已进 `./context`。
 * 理由见 docs/code/analysis.md。
 * @file 主题论断库装配点（倪海厦《天纪》正统口径）
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
// 元数据与文案在 ./data（STAR_CONTENT_MAP，含「倪师…说」引文）。

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
	getTopicMainContentTexts,
	getDecadalSection,
	type ReportCitation,
	type ReportOptions,
} from "../analysis/report";

/**
 * @param chart - 已排好的命盘
 * @param topic - 主题键（14 个之一，见 `./data` 的 `TOPIC_KEYS`）
 * @param options - 视角 / 流年年月 / 大限下标
 * @returns 报告全文
 * @remarks
 * 编排层：建一次 ctx 按小节序拼接各 `renderXxx`。
 * ⚠️ ① 顺序即小节序勿改；② 性别已在各 view 经 `selectGender` 投影，仅拼接不过滤；理由见 docs/code/analysis.md。
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

	// 条目化是 views 内部形态，不构成公开 interface（2026-11-05 第二投影降级）。

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

	return lines.join("\n");
}

// 导出 8 个值见下方 export。

// ⚠️ TOPIC_KEYS / TOPIC_DEFS 是主题注册表单一真相源（Phase 2 的 8 张平行表已派生），新增主题只加此表。

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
export type { AnalysisOptions, AnalysisView, TopicKey, ReportCitation, ReportOptions };
