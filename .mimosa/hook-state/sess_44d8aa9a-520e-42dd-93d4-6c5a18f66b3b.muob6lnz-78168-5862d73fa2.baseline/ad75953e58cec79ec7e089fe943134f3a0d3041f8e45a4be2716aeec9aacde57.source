/**
 * 主题分析的共享上下文 —— 十一个小节共读的状态，在此**一次算好**。
 *
 * @remarks
 * 各小节原先平铺在 `getTopicAnalysis` 一个函数体里，靠闭包共享十几个局部变量。
 * 拆成 `views/` 之后闭包没了，这些变量改由本文件的 `makeContext()` 统一产出，
 * 于是每个 `renderXxx` 都退化成「读 ctx → 返回若干行」的纯函数。
 *
 * ⚠️ **这里故意多算一样东西**：`mutagenInSanFang`（三方四正范围内的本命四化）。
 * 它原本在「三、本命四化会照」小节现算，又被「三点五、年干四化」读去做去重集合 ——
 * 是全篇**唯一一条真实的跨小节依赖**。若留在 `views/mutagen.ts` 里现算，
 * `views/year-stem.ts` 就无从判断哪些四化已经报过，会把三方四正内已展示的
 * **再报一遍**。提到这里算一次，两节共读同一份结果。
 *
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
} from "./data";
import { getPalaceMutagen, getPalaceStars, getSanFangSiZheng } from "./palace-query";
import { getMutagenNote } from "./lookups";

/** 三方四正范围内的一条本命四化（即 {@link AnalysisContext.mutagenInSanFang} 的元素）。 */
export interface MutagenInSanFang {
	/** 该四化落在哪个宫（`Palace.name`） */
	palaceName: string;
	/** 带四化的星名 */
	starName: string;
	/** 四化字：禄 / 权 / 科 / 忌 */
	mutagen: string;
	/** 该星该化的语义补充，查不到时为空串 */
	note: string;
}

/**
 * 十一个小节共读的状态。
 *
 * @remarks
 * 全部字段由 {@link makeContext} 一次算好，各 `renderXxx(ctx)` 只读不写 ——
 * 唯一例外是各节**自己产出的输出行**（各自 `return string[]`，由 `index.ts` 拼接），
 * 故 ctx 内不含 `lines`。
 */
export interface AnalysisContext {
	chart: ZiweiChart;
	topic: TopicKey;
	view: AnalysisView;
	liunianYear: number;
	liuyueMonth: number;

	/** 本主题的主宫名（`TOPIC_PALACE_NAME[topic]`，带「宫」字的本项目口径） */
	palaceName: string;
	/** 本主题的展示名（`TOPIC_LABEL[topic]`） */
	topicLabel: string;

	/** 主宫本体 */
	mainPalace: Palace;
	/** 主宫的主星；空宫时是**借自对宫**的那几颗（见 `isLoan`） */
	mainStars: Star[];
	/** 首颗主星；空宫且对宫也无主星时为 `undefined` */
	primaryStar: Star | undefined;
	/** 首颗主星的论断档案；无主星时为 `null` */
	profile: StarContent | null;
	/** `mainStars` 是否借自对宫 */
	isLoan: boolean;

	/** 三方四正（4 个宫位，含本宫） */
	sanFang: Palace[];
	/** 三方四正里除本宫外三宫的展示标签 */
	sanFangLabels: [string, string, string];

	/** 当前大限 */
	currentDx: Decadal | undefined;

	/**
	 * 三方四正范围内落的所有本命四化。
	 *
	 * @remarks
	 * 由 {@link makeContext} 一次算好，供 `views/mutagen.ts`（展示）与
	 * `views/year-stem.ts`（去重）共读 —— 理由见本文件头部「故意多算一样东西」。
	 */
	mutagenInSanFang: MutagenInSanFang[];
}

/**
 * 建上下文：把十一节共读的状态一次算好。
 *
 * @param chart - 已排好的命盘
 * @param topic - 主题键
 * @param options - 视角 / 流年年月 / 大限下标，缺省值与拆分前一致
 * @returns 上下文；**主宫在盘里找不到时为 `null`** —— 调用方据此回落到
 *   「无法找到 xx 相关信息。」（这是拆分前 `getTopicAnalysis` 的提前返回分支）
 *
 * @remarks
 * 缺省值刻意**保持与拆分前逐字一致**：`view` 缺省 `"mingpan"`、流年取系统当前年、
 * 流月取系统当前月、大限下标取 `chart.currentDecadalIndex`。它们读的是 `new Date()`，
 * 故本函数是 `analysis/` 里唯一一处非纯函数（只影响缺省，不影响给定 options 的调用）。
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
	if (!result) return null;

	const { palace: mainPalace, mainStars, isLoan } = result;
	const primaryStar = mainStars[0];
	const profile = primaryStar ? STAR_CONTENT_MAP[primaryStar.name] : null;

	// 获取三方四正
	const sanFang = getSanFangSiZheng(chart, palaceName);
	const sanFangLabels = TOPIC_SANFANG_LABELS[topic];

	// 当前大限
	const currentDx = chart.decadals[dxIndex];

	// 三方四正范围内的本命四化：原先在「三、本命四化会照」现算、被「三点五」读作
	// 去重集，现提前到这里算一次（见文件头）。算式与拆分前逐字一致。
	const mutagenInSanFang: MutagenInSanFang[] = [];
	sanFang.forEach(p => {
		getPalaceMutagen(p).forEach(({ name, mutagen }) => {
			const note = getMutagenNote(name, mutagen);
			mutagenInSanFang.push({ palaceName: p.name, starName: name, mutagen, note });
		});
	});

	return {
		chart,
		topic,
		view,
		liunianYear,
		liuyueMonth,
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
