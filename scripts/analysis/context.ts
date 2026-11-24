/**
 * ⚠️「故意多算一样东西」：`mutagenInSanFang` 唯一跨节依赖，「三点五」拿它去重；
 *    views 现算会重报。见 docs/code/analysis.md。
 * @file 主题分析共享上下文：十一节共读状态，一次算好
 * @packageDocumentation
 */

import type { Decadal, Palace, Star, ZiweiChart } from "../types";
import {
	STAR_CONTENT_MAP,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	TOPIC_SANFANG_LABELS,
	type AnalysisOptions,
	type AnalysisView,
	type StarContent,
	type TopicKey,
} from "../analysis/data";
import { getPalaceStars, getSanFangSiZheng, mutagenInPalaces } from "../analysis/palace-query";
import { getMutagenNote } from "../analysis/lookups";

/** 三方四正内一条本命四化（{@link AnalysisContext.mutagenInSanFang} 元素）。 */
export interface MutagenInSanFang {
	/** 四化落宫（`Palace.name`）。 */
	palaceName: string;
	/** 带四化星名。 */
	starName: string;
	/** 四化字：禄 / 权 / 科 / 忌。 */
	mutagen: string;
	/** 语义补充，查不到空串。 */
	note: string;
}

/**
 * 十一节共读状态。
 * @remarks 字段由 {@link makeContext} 算好，各 `renderXxx(ctx)` 只读不写；
 * 输出行各节自产（`string[]`），故不含 `lines`。
 */
export interface AnalysisContext {
	/** 已排好的本命盘，只读。 */
	chart: ZiweiChart;
	/** 主题键：定主宫 / 展示名 / 三方标注。 */
	topic: TopicKey;
	/** 视角：本命 / 大限 / 流年 / 流月（缺省 `"mingpan"`）。 */
	view: AnalysisView;
	/** 流年公历年；缺省取系统当年。 */
	liunianYear: number;
	/** 流月（农历 1–12）；缺省取系统当前月。 */
	liuyueMonth: number;
	/** 出生性别：性别投影单一入口。 */
	gender: "male" | "female";

	/** 主宫名（`TOPIC_PALACE_NAME[topic]`）。 */
	palaceName: string;
	/** 展示名（`TOPIC_LABEL[topic]`）。 */
	topicLabel: string;

	/** 主宫本体。 */
	mainPalace: Palace;
	/** 主宫主星；空宫借对宫（`isLoan`）。 */
	mainStars: Star[];
	/** 首星；空宫且对宫无主星为 `undefined`。 */
	primaryStar: Star | undefined;
	/** 首星论断档案；无主星为 `null`。 */
	profile: StarContent | null;
	/** `mainStars` 是否借自对宫。 */
	isLoan: boolean;

	/** 三方四正（4 宫含本宫）。 */
	sanFang: Palace[];
	/** 三方四正另三宫展示标签。 */
	sanFangLabels: [string, string, string];

	/** 当前大限。 */
	currentDx: Decadal | undefined;

	/**
	 * 三方四正内所有本命四化。
	 * @remarks {@link makeContext} 算好，各节共读；算式同拆分前。
	 */
	mutagenInSanFang: MutagenInSanFang[];
}

/**
 * 建上下文：十一节状态算好。
 * @param chart - 已排好的命盘
 * @param topic - 主题键
 * @param options - 视角 / 年月 / 大限
 * @returns 上下文；主宫找不到为 `null`（回落「无法找到 xx 相关信息。」）
 * @remarks 缺省沿用拆分前（`"mingpan"` / 系统当前 / `chart.currentDecadalIndex`）；
 * 读 `new Date()`，`analysis/` 唯一非纯函数。
 */
export function makeContext(
	chart: ZiweiChart,
	topic: TopicKey,
	options: AnalysisOptions = {}
): AnalysisContext | null {
	const view: AnalysisView = options.view ?? "mingpan";
	const liunianYear = options.liunianYear ?? new Date().getFullYear();
	const liuyueMonth = options.liuyueMonth ?? new Date().getMonth() + 1;
	const dxIndex = options.daXianIndex ?? chart.currentDecadalIndex;

	const palaceName = TOPIC_PALACE_NAME[topic];
	const topicLabel = TOPIC_LABEL[topic];

	// 获取主宫
	const result = getPalaceStars(chart, palaceName);
	if (!result) {
		return null;
	}

	const { palace: mainPalace, mainStars, isLoan } = result;
	const primaryStar = mainStars[0];
	const profile = primaryStar ? STAR_CONTENT_MAP[primaryStar.name] : null;

	// 获取三方四正
	const sanFang = getSanFangSiZheng(chart, palaceName);
	const sanFangLabels = TOPIC_SANFANG_LABELS[topic];

	// 当前大限
	const currentDx = chart.decadals[dxIndex];

	const mutagenInSanFang: MutagenInSanFang[] = [];
	for (const { palace, starName, mutagen } of mutagenInPalaces(sanFang)) {
		const note = getMutagenNote(starName, mutagen, chart.birthInfo.gender);
		mutagenInSanFang.push({ palaceName: palace.name, starName, mutagen, note });
	}

	return {
		chart,
		topic,
		view,
		liunianYear,
		liuyueMonth,
		gender: chart.birthInfo.gender,
		palaceName,
		topicLabel,
		mainPalace,
		mainStars,
		primaryStar,
		profile,
		isLoan,
		sanFang,
		sanFangLabels,
		currentDx,
		mutagenInSanFang,
	};
}
