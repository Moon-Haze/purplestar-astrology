/**
 * 总览取材单点 —— 「总览段取什么材」的唯一实现。
 *
 * @remarks
 * 两编排器（`views/overview.ts` / `report.ts`）原各写取材规则，七个决策点重复
 * 且已文案漂移；本模块收为纯函数，编排器只做版式装配。决策点语义与基准逐字
 * 对齐，见 docs/code/analysis.md。
 * @file 总览取材单点
 */

import {
	SIHUA_CHAR_TO_KEY,
	STAR_BRIEF,
	STAR_CONTENT_MAP,
	SUMMARY_TOPICS,
	TOPIC_CONTENT_KEY,
	TOPIC_SUMMARY_KEY,
	type GenderField,
	type PalaceContent,
	type StarContent,
} from "./data";
import type { AnalysisContext } from "./context";
import { detectGeJu, selectBranches, selectGender, starBadge } from "./lookups";

/** 总览取材结果：各字段已是可直接入行的文本（版式层管头与行距）。
 * @remarks `mainStarLine` 是「本宫主星」行唯一成文形态；`mainBadge` / `loanTag`
 * 仅供标题徽标与借宫标记，SHALL NOT 用部件重建拼式。
 */
export interface OverviewMaterial {
	/** 命盘关键定制（topic_mods 亮度/四化双键注入），仅核心主题（含 personality）非空 */
	mods: string[];
	/** 格局行（`⭐ **名**：描述`），仅 overview / personality 主题非空 */
	geju: string[];
	/** 星曜深层特质（summary），仅核心 5 主题（不含 personality）非空 */
	summary: string | undefined;
	/** 本宫主星徽标串（多星顿号相连），空宫为「空宫」 */
	mainBadge: string;
	/**
	 * 「本宫主星」整行（本宫主星： + 借宫注 + 徽标 + overview 五行局尾）。
	 * @remarks `views/overview.ts` / `report.ts` 共用此字段，原各拼一遍已实测
	 * 分叉（借宫时报告侧丢星名）；编排器不得重建拼式。
	 */
	mainStarLine: string;
	/** 借宫徽标（借宫为「借对宫」，否则空串）—— 供 `--report` 板块标题用 */
	loanTag: string;
	/** 星曜详解全文（overview 用 mingGong，其余按 contentKey） */
	content: string | undefined;
	/** 亮度补充行（`▶ …` 前缀已带） */
	brightNote: string | undefined;
	/** 同宫第二主星行（`同宫第二主星：**徽标**——简述`） */
	secondStar: string | undefined;
	/**
	 * 第二主星语境全文（按 contentKey 取该星 profile 分支投影）。核心论断节
	 * 「第二主星」由简述升级为简述 + 全文，全文在本板块首现，装配层预扫描登记
	 * 三方联动指引；无语境数据时 `undefined`，维持简述。
	 */
	secondStarContent: string | undefined;
	/** 空宫兜底句；主宫无主星时非空，编排器整节退化为此句 */
	emptyFallback: string;
}

/**
 * 取「总览段」素材：核心主题判定、topic_mods 双键注入、格局清单、summary 条件、
 * contentKey 全文选择、亮度补充、第二主星——一次取齐。
 *
 * @param ctx - 主题上下文（{@link AnalysisContext}）：读命盘、主题键、主宫名、主星/借宫标记、profile、性别等中间量；不重算盘面
 * @returns 总览段素材（{@link OverviewMaterial}）：各字段可直接入行。主宫（含借宫）无主星走兜底——`mainBadge` 为「空宫」、`emptyFallback` 给借宫说明，余为 `undefined` / 空数组
 */
export function buildOverviewMaterial(ctx: AnalysisContext): OverviewMaterial {
	const { chart, topic, palaceName, mainStars, primaryStar, profile, isLoan, gender } = ctx;
	// 五行局尾：仅 overview 追加，两编排器原各写一遍（同 derivation 第二处复写）
	const fiveTail = topic === "overview" ? `，${chart.fiveElementsClassName}` : "";

	if (!(primaryStar && profile)) {
		// 兜底分支（主宫与对宫俱无主星）：借宫注按 isLoan 单独算（无星名），逐字保持形态。
		const loanText = isLoan ? `（${palaceName}空宫，借对宫论事）` : "";
		const mainBadge = "空宫";
		return {
			mods: [],
			geju: [],
			summary: undefined,
			mainBadge,
			mainStarLine: `本宫主星：${loanText}${mainBadge}${fiveTail}`,
			loanTag: isLoan ? "借对宫" : "",
			content: undefined,
			brightNote: undefined,
			secondStar: undefined,
			secondStarContent: undefined,
			emptyFallback: `${palaceName}空宫，需借对宫论事，命格整体以三方四正综合判断。`,
		};
	}

	const summaryKey = TOPIC_SUMMARY_KEY[topic];
	const isCoreTopic = SUMMARY_TOPICS.has(topic) || topic === "personality";

	// ── 动态内容优先：命盘关键定制（亮度 + 四化的 topic_mods，仅核心主题）──
	const mods: string[] = [];
	if (isCoreTopic) {
		const topicMod = profile.topic_mods?.[summaryKey as keyof typeof profile.topic_mods];
		const brightnessKey =
			primaryStar.brightness === "bright"
				? "bright"
				: primaryStar.brightness === "dim"
					? "dim"
					: null;
		const sihuaKey = primaryStar.mutagen
			? (SIHUA_CHAR_TO_KEY[primaryStar.mutagen] ?? null)
			: null;
		if (brightnessKey && topicMod?.[brightnessKey]) {
			mods.push(selectGender(topicMod[brightnessKey], gender));
		}
		if (sihuaKey && topicMod?.[sihuaKey]) {
			mods.push(selectGender(topicMod[sihuaKey], gender));
		}
	}

	// 格局识别（仅 overview / personality 展示）
	const gejuDetected = topic === "overview" || topic === "personality" ? detectGeJu(chart) : [];
	const geju = gejuDetected.map(gj => `⭐ **${gj.name}**：${gj.description}`);

	// 静态白话总论（summary，核心 5 主题；personality 跳过避免与 overview 雷同）
	const summary = SUMMARY_TOPICS.has(topic) ? profile.summary?.[gender]?.[summaryKey] : undefined;

	const mainBadge = mainStars.map(s => starBadge(s)).join("、") || "空宫";
	const loanText = isLoan ? `（${palaceName}空宫，借对宫${primaryStar.name}论事）` : "";
	const mainStarLine = `本宫主星：${loanText}${mainBadge}${fiveTail}`;

	const contentKey = TOPIC_CONTENT_KEY[topic];
	const contentRaw =
		topic === "overview"
			? profile.mingGong
			: (profile[contentKey as keyof StarContent] as PalaceContent | undefined);
	const content =
		contentRaw === undefined ? undefined : selectBranches(contentRaw, primaryStar, gender);

	const modRaw =
		primaryStar.brightness === "bright"
			? profile.brightMod
			: primaryStar.brightness === "dim"
				? profile.dimMod
				: undefined;
	const mod = modRaw === undefined ? undefined : selectGender(modRaw, gender);
	const brightNote = mod ? `▶ ${mod}` : undefined;

	const s2 = mainStars[1];
	const secondStar = s2
		? `同宫第二主星：**${starBadge(s2)}**——${STAR_BRIEF[s2.name] ?? ""}`
		: undefined;

	// 第二主星的同宫语境全文：取该星自己 profile 的同一 contentKey，经分支投影。
	// 无该键数据（可选键缺省）时 undefined，核心论断维持一句简述。
	const s2Profile = s2 ? STAR_CONTENT_MAP[s2.name] : undefined;
	const s2Raw = s2Profile
		? (s2Profile[contentKey as keyof StarContent] as PalaceContent | undefined)
		: undefined;
	const secondStarContent =
		s2Raw === undefined ? undefined : selectBranches(s2Raw, s2, gender) || undefined;

	return {
		mods,
		geju,
		summary,
		mainBadge,
		mainStarLine,
		loanTag: isLoan ? "借对宫" : "",
		content,
		brightNote,
		secondStar,
		secondStarContent,
		emptyFallback: "",
	};
}
