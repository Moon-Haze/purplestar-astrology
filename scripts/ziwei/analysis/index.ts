/**
 * 紫微斗数分析数据库 v3 — 倪海厦《天纪》正统口径
 *
 * 来源：自 reference/ziwei-samples-toolkit/lib/ziwei/db-analysis.ts 拷入本仓内核。
 * 拷入时做了三处口径适配（其余逐字保留）：
 *   1. TOPIC_PALACE_NAME 改用**本项目宫名口径**（`Palace.name` 带「宫」字、
 *      「仆役」→「交友宫」，见 constants.ts 的 IZTRO_TO_PROJECT_PALACE）——
 *      本目录按宫名**严格等值**找宫（`palace-query.ts` 的 `getPalaceStars` 等），
 *      旧口径会全部失配并静默落到「无法找到 xx」的兜底文案。
 *   2. detectGeJu 内 getPalace 加「去宫字」归一化 —— 内容区散布着旧口径名
 *      （如 '迁移'），归一化兜住它们，逻辑零改动。
 *      ⚠️ 2026-09-27 起格局判定整体搬去了 `../patterns/`，而该归一化只服务于
 *      **按宫名找宫**这条旧路径；新判定走地支算术（`../palace-relations` 的偏移 +
 *      按 branch 取宫），不再按宫名找宫，故它连同那个 `getPalace` 一并消失。
 *      本目录只剩第 1 条仍在生效。
 *   3. 删除了未使用的 getYearStemIndex 导入（那是公历取模口径，仅流年可用；
 *      生年四化必须用 chart.lunarInfo.yearStem，见 sihua.ts 的口径说明）。
 *      ⚠️ 该导入后来因「四点五、流年」需要年干而引回，现只在 `views/liunian.ts`；
 *      用途仍是那条唯一合法用途（流年干），生年四化依旧走 chart.lunarInfo.yearStem。
 *
 * ⚠️ 知识来源分级：
 *   - [verified]    倪师《天纪》讲稿原话（天纪 02-13 集已核对）
 *   - [traditional] 紫微斗数传统口诀（《紫微斗数全书》等古书，非倪师独创）
 *   - [methodology] 倪师体系的方法论概念（非原话摘录）
 *   - [suspect]     来源存疑，疑似其他流派或后人整理
 *
 *   以「倪海夏/倪师说」开头的引号句，部分为 traditional 口诀的风格化转述，不一定是
 *   倪师《天纪》逐字原话。CLI 的 topic 命令在输出末尾固定披露此点。
 *   2026-09-27 拆分后，引文主体随 STAR_CONTENT_MAP 移到了 `../analysis-data`，
 *   余下零星几处散在 `views/` 各节（如 `views/health.ts` 的疾厄论断）。
 *
 * 架构：
 * - 十四主星各自的详细命理内容（12 宫语境）
 * - 四化（禄权科忌）各自的语义补充
 * - getTopicAnalysis：动态推算三方四正、本命四化会照、大限、流年、流月
 *
 * ## 本目录的文件分工（2026-09-27 拆分）
 *
 * 拆分的分界线是**「算」与「写」**：状态算一次（`context.ts`），文案各节自己写（`views/`）。
 *
 *   index.ts          装配点：getTopicAnalysis 编排层 + 公开面 re-export
 *   context.ts        跨节共享状态的**唯一**产出点（`makeContext`）
 *   palace-query.ts   只读查询：按宫名取宫 / 取三方四正 / 渲染一行星曜
 *   lookups.ts        文案查表 + 性别过滤 + 格局投影
 *   views/            十一个小节，每节一个 `renderXxx(ctx) => string[]`
 *
 * ⚠️ 各 view **只读 ctx、只返回自己的行**：不互相调用、不写回 ctx。唯一的跨节状态
 * （`siHuaInSanFang`）已提升进 `context.ts`，理由见该文件头部。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
// 2026-09-27 拆分：本目录的前身 analysis.ts 原先自带的元数据表与论断文案已移出到
// ../analysis-data（STAR_CONTENT_MAP，含「倪师…说」引文）。公开面由文末 re-export 兜住。
import {
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type AnalysisOptions,
	type AnalysisView,
	type TopicKey,
} from "../analysis-data";
import { makeContext } from "./context";
import { filterGenderContent } from "./lookups";
import { renderDaXian } from "./views/daxian";
import { renderHealth } from "./views/health";
import { renderKuiYue } from "./views/kuiyue";
import { renderLiuNian } from "./views/liunian";
import { renderOverview } from "./views/overview";
import { renderPersonality } from "./views/personality";
import { renderSanFang } from "./views/sanfang";
import { renderSiHua } from "./views/sihua";
import { renderSuggestions } from "./views/suggestions";
import { renderYearStem } from "./views/year-stem";

// ─── 核心分析函数（总分结构 + 三方四正 + 本命四化会照 + 大限）───────────────────

/**
 * 生成某个主题的完整论断报告。
 *
 * @param chart - 已排好的命盘
 * @param topic - 主题键（13 个之一，见 `../analysis-data` 的 `TOPIC_KEYS`）
 * @param options - 视角 / 流年年月 / 大限下标
 * @returns 报告全文（已按出生性别过滤掉无关性别的句子）
 *
 * @remarks
 * 本函数是**编排层**：建一次上下文，按小节序把十一个 `renderXxx` 的行首尾相接，
 * 最后整体过一遍性别过滤。各节的实现与口径说明在 `views/` 各文件里。
 *
 * 两点不要动：
 *
 * 1. **下面的拼接顺序即报告的小节序**（一 → 六），调整顺序会改变输出
 * 2. 性别过滤作用在**拼接后的整篇文本**上，而不是逐节 —— 它的规则之一是删除
 *    「；女命…」这类**跨行内子句**，逐节过滤会把跨节边界的句子漏掉
 */
export function getTopicAnalysis(
	chart: ZiweiChart,
	topic: TopicKey,
	options: AnalysisOptions = {}
): string {
	const ctx = makeContext(chart, topic, options);
	if (!ctx) return `无法找到${TOPIC_PALACE_NAME[topic]}相关信息。`;

	const lines: string[] = [
		...renderOverview(ctx), // 一、总论
		...renderSanFang(ctx), // 二、三方四正联动分析
		...renderSiHua(ctx), // 三、本命四化会照
		...renderYearStem(ctx), // 三点五、年干四化·全局关键宫位解读
		...renderDaXian(ctx), // 四、当前大限分析
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
// 拆分前从本模块导出的 5 个名字，拆分后**逐名仍可从这里 import**。
// `../analysis-data` 是它们的实际归属地，此处只做转发，调用方一行不用改。
// 这 5 个名字本文件的实现也要用，故上方已 import，这里再 export 一次。
export { TOPIC_LABEL, TOPIC_PALACE_NAME };
export type { AnalysisOptions, AnalysisView, TopicKey };
