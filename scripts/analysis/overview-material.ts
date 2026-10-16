/**
 * 总览取材单点 —— 「总览段取什么材」的唯一实现。
 *
 * @remarks
 * 两个编排器（`views/overview.ts` 的【】版式与 `report.ts` 的 ### 版式）此前各写
 * 一遍取材规则，七个决策点同构重复且已发生文案漂移；本模块把规则收为一份
 * 纯函数，编排器只做版式装配。`starBadge` 同时是星曜徽标（星名 + 化象 + 亮度
 * 全角括号）的全仓单点，`palace-query.ts` 的 `descPalaceStars` 同式引它。
 * 决策点语义与统一基准（原 views/overview.ts 版）逐字对齐，见 docs/code/analysis.md。
 */

import {
	SIHUA_CHAR_TO_KEY,
	STAR_BRIEF,
	SUMMARY_TOPICS,
	TOPIC_CONTENT_KEY,
	TOPIC_SUMMARY_KEY,
	type StarContent,
} from "./data";
import type { AnalysisContext } from "./context";
import { detectGeJu } from "./lookups";

/**
 * 星曜徽标：`星名` + `化X`（有四化时）+ `（庙旺）/（落陷）`（有亮度时）。
 * 全仓唯一的徽标拼式；亮度用全角括号与星名、化象视觉分离。
 */
export function starBadge(star: { name: string; mutagen?: string; brightness?: string }): string {
	const hua = star.mutagen ? `化${star.mutagen}` : "";
	const bright =
		star.brightness === "bright" ? "（庙旺）" : star.brightness === "dim" ? "（落陷）" : "";
	return `${star.name}${hua}${bright}`;
}

/** 总览取材结果：各字段已是可直接入行成文的文本（头与行距由版式层管）。 */
export interface OverviewMaterial {
	/** 命盘关键定制（topic_mods 的亮度 / 四化双键注入），仅核心主题（含 personality）非空 */
	mods: string[];
	/** 格局行（`⭐ **名**：描述`），仅 overview / personality 主题非空 */
	geju: string[];
	/** 星曜深层特质（summary），仅核心 5 主题（不含 personality）非空 */
	summary: string | undefined;
	/** 本宫主星徽标串（多星顿号相连），空宫为「空宫」 */
	mainBadge: string;
	/** 借宫注记（`（X空宫，借对宫Y论事）`），非借宫为空串 */
	loanNote: string;
	/** 技术性星曜详解全文（overview 用 mingGong，其余按 contentKey） */
	content: string | undefined;
	/** 亮度补充行（`▶ …` 前缀已带） */
	brightNote: string | undefined;
	/** 同宫第二主星行（`同宫第二主星：**徽标**——简述`） */
	secondStar: string | undefined;
	/** 空宫兜底句；主宫无主星时非空，编排器整节退化为这一句 */
	emptyFallback: string;
}

/**
 * 取「总览段」的素材：核心主题判定、topic_mods 双键注入、格局主题清单、
 * summary 段条件、contentKey 全文选择、亮度补充、第二主星——一次取齐。
 */
export function buildOverviewMaterial(ctx: AnalysisContext): OverviewMaterial {
	const { chart, topic, palaceName, mainStars, primaryStar, profile, isLoan } = ctx;

	if (!(primaryStar && profile)) {
		return {
			mods: [],
			geju: [],
			summary: undefined,
			mainBadge: "空宫",
			loanNote: "",
			content: undefined,
			brightNote: undefined,
			secondStar: undefined,
			emptyFallback: `${palaceName}空宫，需借对宫论事，命格整体以三方四正综合判断。`,
		};
	}

	const summaryKey = TOPIC_SUMMARY_KEY[topic];
	const gender: "male" | "female" = chart.birthInfo?.gender === "female" ? "female" : "male";
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
			mods.push(topicMod[brightnessKey]!);
		}
		if (sihuaKey && topicMod?.[sihuaKey]) {
			mods.push(topicMod[sihuaKey]!);
		}
	}

	// 格局识别（仅 overview / personality 展示）
	const geju =
		topic === "overview" || topic === "personality"
			? detectGeJu(chart).map(gj => `⭐ **${gj.name}**：${gj.description}`)
			: [];

	// 静态白话总论（summary，核心 5 主题；personality 跳过避免与 overview 雷同）
	const summary = SUMMARY_TOPICS.has(topic) ? profile.summary?.[gender]?.[summaryKey] : undefined;

	const mainBadge = mainStars.map(s => starBadge(s)).join("、") || "空宫";
	const loanNote = isLoan ? `（${palaceName}空宫，借对宫${primaryStar.name}论事）` : "";

	const contentKey = TOPIC_CONTENT_KEY[topic];
	const content =
		topic === "overview"
			? profile.mingGong
			: (profile[contentKey as keyof StarContent] as string | undefined);

	const mod =
		primaryStar.brightness === "bright"
			? profile.brightMod
			: primaryStar.brightness === "dim"
				? profile.dimMod
				: undefined;
	const brightNote = mod ? `▶ ${mod}` : undefined;

	const s2 = mainStars[1];
	const secondStar = s2
		? `同宫第二主星：**${starBadge(s2)}**——${STAR_BRIEF[s2.name] ?? ""}`
		: undefined;

	return {
		mods,
		geju,
		summary,
		mainBadge,
		loanNote,
		content,
		brightNote,
		secondStar,
		emptyFallback: "",
	};
}
