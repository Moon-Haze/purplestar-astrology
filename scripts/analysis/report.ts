/**
 * 全盘报告编排层 —— 与 {@link ./index|getTopicAnalysis} 平级的第二编排器。
 *
 * @remarks
 * `--topic` 的单主题报告是终端文本形态（小节用 `【】` 加粗标记）；`astrology --report`
 * 需要的是**Markdown 文档形态**，且小节流参照 html 版主题报告（总览 → 一句话定调 →
 * 核心论断 → 命盘推演 → 三方四正联动 → 四化路径分析 → 命盘依据 → 经典出处 →
 * 综合建议）。两者共用同一套叶子 view 与数据表，差异只在编排与排版 —— 故本模块与
 * `getTopicAnalysis` 一样**只编排、不算命**：建一次 {@link makeContext} 上下文，
 * 把各 `renderXxx` 的行按报告小节序拼接，最后整体过一遍性别过滤（理由同
 * `getTopicAnalysis` 的第 2 点：跨行内子句的删除只能作用在整篇文本上）。
 *
 * 叶子 view 的行首带着自己的 `**【小节名】**` 头，报告里改用 Markdown 标题
 * （`### 三方四正联动`），故取用时经 {@link asMarkdownBlock} 装配 —— 剥掉**首个**
 * 匹配头，view 内部的子块头（如疾厄节的【星曜辅助】）转成 `####` 标题：Markdown
 * 文档里强调行不能充当标题，也靠它保证各标题前后有空行。
 *
 * 「经典出处」的引文主体在古籍库（`../../classics`，另一知识域），本模块不引它 ——
 * 由 CLI 层经 {@link getTopicReportMeta} 拿到主宫主星后自查古籍、把结果从
 * `options.citations` 递进来，保持「排盘内核不依赖古籍域」的分层。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
import {
	SIHUA_CHAR_TO_KEY,
	STAR_BRIEF,
	STAR_CONTENT_MAP,
	SUMMARY_TOPICS,
	TOPIC_CONTENT_KEY,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	TOPIC_SUMMARY_KEY,
	TOPIC_SUGGESTIONS,
	type AnalysisOptions,
	type StarContent,
	type TopicKey,
} from "../analysis/data";
import { makeContext } from "../analysis/context";
import { detectGeJu, filterGenderContent } from "../analysis/lookups";
import { descPalaceStars } from "../analysis/palace-query";
import { BRANCHES } from "../constants";
import { renderDecadal } from "../analysis/views/decadal";
import { renderHealth } from "../analysis/views/health";
import { renderKuiYue } from "../analysis/views/patron";
import { renderPersonality } from "../analysis/views/personality";
import { renderSanFang } from "../analysis/views/surround";
import { renderMutagen } from "../analysis/views/mutagen";

/** 一条经典出处引文：`loc` 是「书名·章节名」，`text` 是段落原文。 */
export interface ReportCitation {
	loc: string;
	text: string;
}

/** {@link getTopicReport} 的可选参数：在 {@link AnalysisOptions} 上叠加引文。 */
export type ReportOptions = AnalysisOptions & { citations?: ReportCitation[] };

/**
 * 把叶子 view 输出装配成报告的 Markdown 块。
 *
 * @remarks
 * 剥掉**首个**头：跳过开头的空行，若第一行非空行匹配 `**【…】**` 形态则删去它与其后
 * 的一个空行；view 内部的子块头（同样形态但不在行首）转成 `####` 标题并补足前后空行
 * —— Markdown 文档里强调行不能当标题。空数组与无头输出按原行装配（后者说明上游
 * view 改了排版，报告标题会与它自带的头并存 —— 那是应当被看见的漂移）。
 */
function asMarkdownBlock(lines: string[]): string[] {
	let i = 0;
	while (i < lines.length && lines[i] === "") i++;
	if (i < lines.length && /^\*\*【[^】]+】\*\*$/.test(lines[i])) {
		i += 1;
		while (i < lines.length && lines[i] === "") i++;
	}
	const out: string[] = [];
	for (; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith("**【") && line.endsWith("】**")) {
			out.push("", `#### ${line.slice(3, -3)}`, "");
		} else {
			out.push(line);
		}
	}
	return out;
}

/** 去掉行数组首尾的空行（拼接小节时统一由编排层控制间距）。 */
function trimBlanks(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start] === "") start++;
	while (end > start && lines[end - 1] === "") end--;
	return lines.slice(start, end);
}

/**
 * 主宫主星的亮度/四化展示后缀（`庙旺` / `落陷` / `化X`），报告标题徽标用。
 *
 * @remarks
 * 与 `views/overview.ts` 的 mainStarDesc 同一口径，但不带「（庙旺）」括号 —— 报告
 * 标题里用 `·` 分隔更紧凑（`命宫 · 紫微落陷、天相庙旺`）。
 */
function starBadge(star: { name: string; mutagen?: string; brightness?: string }): string {
	const hua = star.mutagen ? `化${star.mutagen}` : "";
	const bright = star.brightness === "bright" ? "庙旺" : star.brightness === "dim" ? "落陷" : "";
	return `${star.name}${hua}${bright}`;
}

/**
 * 主题报告的元信息 —— CLI 层为该主题查古籍引文的全部输入。
 *
 * @remarks
 * 单独成函数而非让 CLI 读 ctx：`AnalysisContext` 不在公开面上，而主宫主星这组
 * 派生值（含空宫借对宫）必须与报告本体同源，不能让调用方自己再找一遍宫。
 */
export function getTopicReportMeta(
	chart: ZiweiChart,
	topic: TopicKey
): { palaceName: string; primaryStarName: string | null; isLoan: boolean } | null {
	const ctx = makeContext(chart, topic, {});
	if (!ctx) return null;
	return {
		palaceName: ctx.palaceName,
		primaryStarName: ctx.primaryStar?.name ?? null,
		isLoan: ctx.isLoan,
	};
}

/**
 * 生成单个主题的 Markdown 报告节。
 *
 * @param chart - 已排好的命盘
 * @param topic - 主题键（13 个之一）
 * @param options - 视角等 {@link AnalysisOptions} + `citations`（经典出处引文，
 *   缺省时该小节整体省略）
 * @returns 一节 Markdown 文本（以 `## 主题名（主宫 · 主星）` 开头）；主宫找不到时
 *   返回兜底提示 —— 与 `getTopicAnalysis` 同一提前返回口径
 *
 * @remarks
 * 小节序参照 html 版主题报告：定调（引语）→ 总览 → 核心论断 → 命盘推演 →
 * 三方四正联动 → 四化路径分析（含魁钺贵人）→ 当前大限 → 主题专属补充（疾厄取象 /
 * 性格深描）→ 命盘依据 → 经典出处 → 综合建议。html 版另有「主辅煞组合精细论断」
 * 「天纪溯源·时间码」两节，其数据不在本仓知识源内，不臆造、整体省略。
 */
export function getTopicReport(
	chart: ZiweiChart,
	topic: TopicKey,
	options: ReportOptions = {}
): string {
	const ctx = makeContext(chart, topic, options);
	if (!ctx) return `无法找到${TOPIC_PALACE_NAME[topic]}相关信息。`;

	const { citations = [] } = options;
	const lines: string[] = [];

	// ── 节标题：主题名（主宫 · 主星徽标）──
	const badge = ctx.mainStars.length ? ctx.mainStars.map(s => starBadge(s)).join("、") : "空宫";
	const loanTag = ctx.isLoan ? "借对宫" : "";
	lines.push(`## ${TOPIC_LABEL[topic]}（${ctx.palaceName} · ${loanTag}${badge}）`);
	lines.push("");

	// ── 一句话定调：主星一句简述（STAR_BRIEF），空宫给借宫提示 ──
	if (ctx.primaryStar) {
		const brief = STAR_BRIEF[ctx.primaryStar.name];
		if (brief) lines.push(`> **定调 · ${ctx.primaryStar.name}**：${brief}`);
	} else {
		lines.push(`> **定调**：${ctx.palaceName}无主星，借对宫与三方四正综合定调。`);
	}
	lines.push("");

	// ── 总览：命盘关键定制 + 特殊格局 + 星曜深层特质 ──
	// 素材与 views/overview.ts 同源（topic_mods / detectGeJu / summary），
	// 但不加【】小节头 —— 报告里它们是同一段「总览」的三个层次。
	// 辅助宫主题（兄弟/子女/迁移/交友/田宅/福德/父母）三样都没有 —— 整段省略，
	// 不留空标题（view 层同口径：summary 只给核心 5 主题，避免与 overview 雷同）。
	const overviewLines: string[] = [];
	if (ctx.primaryStar && ctx.profile) {
		const summaryKey = TOPIC_SUMMARY_KEY[topic];
		const isCoreTopic = SUMMARY_TOPICS.has(topic) || topic === "personality";
		const gender: "male" | "female" = chart.birthInfo?.gender === "female" ? "female" : "male";

		if (isCoreTopic) {
			const topicMod =
				ctx.profile.topic_mods?.[summaryKey as keyof typeof ctx.profile.topic_mods];
			const brightnessKey =
				ctx.primaryStar.brightness === "bright"
					? "bright"
					: ctx.primaryStar.brightness === "dim"
						? "dim"
						: null;
			const sihuaKey = ctx.primaryStar.mutagen
				? (SIHUA_CHAR_TO_KEY[ctx.primaryStar.mutagen] ?? null)
				: null;
			if (brightnessKey && topicMod?.[brightnessKey])
				overviewLines.push(topicMod[brightnessKey]!);
			if (sihuaKey && topicMod?.[sihuaKey]) overviewLines.push(topicMod[sihuaKey]!);
		}

		if (topic === "overview" || topic === "personality") {
			for (const gj of detectGeJu(chart))
				overviewLines.push(`⭐ **${gj.name}**：${gj.description}`);
		}

		if (SUMMARY_TOPICS.has(topic)) {
			const summary = ctx.profile.summary?.[gender]?.[summaryKey];
			if (summary) overviewLines.push(summary);
		}
	} else {
		overviewLines.push(`${ctx.palaceName}空宫，需借对宫论事，整体以三方四正综合判断。`);
	}
	if (overviewLines.length > 0) {
		lines.push("### 总览");
		lines.push("");
		lines.push(...overviewLines, "");
	}

	// ── 核心论断：本宫主星的该宫语境全文 + 亮度补充 + 同宫第二主星 ──
	const verdictLines: string[] = [];
	if (ctx.primaryStar && ctx.profile) {
		const contentKey = TOPIC_CONTENT_KEY[topic];
		const content =
			topic === "overview"
				? ctx.profile.mingGong
				: (ctx.profile[contentKey as keyof StarContent] as string | undefined);
		if (content) verdictLines.push(content);
		const mod =
			ctx.primaryStar.brightness === "bright"
				? ctx.profile.brightMod
				: ctx.primaryStar.brightness === "dim"
					? ctx.profile.dimMod
					: undefined;
		if (mod) verdictLines.push(`▶ ${mod}`);
		const s2 = ctx.mainStars[1];
		if (s2)
			verdictLines.push(`同宫第二主星：**${starBadge(s2)}**——${STAR_BRIEF[s2.name] ?? ""}`);
	}
	if (verdictLines.length > 0) {
		lines.push("### 核心论断");
		lines.push("");
		lines.push(...verdictLines, "");
	}

	// ── 命盘推演：本宫主星一行（含借宫注明，overview 附五行局）──
	lines.push("### 命盘推演");
	lines.push("");
	lines.push(
		`本宫主星：${ctx.isLoan ? `（${ctx.palaceName}空宫，借对宫论事）` : ""}` +
			`${ctx.mainStars.map(s => starBadge(s)).join("、") || "空宫"}` +
			`${topic === "overview" ? `，${chart.fiveElementsClassName}` : ""}`
	);
	lines.push("");

	// ── 三方四正联动（叶子 view，剥头）──
	lines.push("### 三方四正联动");
	lines.push("");
	lines.push(...asMarkdownBlock(renderSanFang(ctx)));

	// ── 四化路径分析：本命四化会照 + 魁钺贵人 ──
	lines.push("### 四化路径分析");
	lines.push("");
	lines.push(...asMarkdownBlock(renderMutagen(ctx)));
	const kuiYue = renderKuiYue(ctx);
	if (kuiYue.length > 0) {
		lines.push("");
		lines.push(...asMarkdownBlock(kuiYue));
	}

	// ── 当前大限（未起运时给童限提示）──
	lines.push("### 当前大限");
	lines.push("");
	const decadal = renderDecadal(ctx);
	if (decadal.length > 0) {
		lines.push(...asMarkdownBlock(decadal));
	} else {
		lines.push("（尚未起运 —— 虚岁小于五行局数时不入大限，按命宫论，见 SKILL「童限」口径。）");
	}

	// ── 主题专属补充：疾厄取象（health）/ 性格深描（personality）──
	const extra =
		topic === "health"
			? renderHealth(ctx)
			: topic === "personality"
				? renderPersonality(ctx)
				: [];
	if (extra.length > 0) {
		lines.push("");
		lines.push(topic === "health" ? "### 健康取象（宫位主轴 · 倪师原法）" : "### 性格深描");
		lines.push("");
		lines.push(...asMarkdownBlock(extra));
	}

	// ── 命盘依据：事实层 —— 主宫星曜全列 / 三方四正 / 本命四化会照 / 全盘骨架 ──
	lines.push("### 命盘依据");
	lines.push("");
	const otherStars = ctx.mainPalace.stars.filter(s => s.type !== "major");
	if (otherStars.length > 0) {
		lines.push(
			`- 主宫${ctx.palaceName}（${BRANCHES[ctx.mainPalace.branch]}宫）星曜：${descPalaceStars(ctx.mainPalace)}` +
				`；同坐 ${otherStars.map(s => s.name).join("、")}`
		);
	} else {
		lines.push(
			`- 主宫${ctx.palaceName}（${BRANCHES[ctx.mainPalace.branch]}宫）星曜：${descPalaceStars(ctx.mainPalace) || "无主星"}`
		);
	}
	const sanFangDesc = ctx.sanFang
		.filter(p => p.name !== ctx.palaceName)
		.map(
			(p, i) => `${ctx.sanFangLabels[i] ?? ""}（${p.name}：${descPalaceStars(p) || "空宫"}）`
		)
		.join("、");
	if (sanFangDesc) lines.push(`- 三方四正：${sanFangDesc}`);
	if (ctx.mutagenInSanFang.length > 0) {
		lines.push(
			`- 本命四化会照：${ctx.mutagenInSanFang.map(m => `${m.starName}化${m.mutagen}（落${m.palaceName}）`).join("、")}`
		);
	} else {
		lines.push("- 本命四化会照：三方四正范围内无本命四化落入");
	}
	if (topic === "overview") {
		lines.push(
			`- 全盘骨架：命宫${BRANCHES[chart.soulBranch]} · 身宫${BRANCHES[chart.bodyBranch]} · ${chart.fiveElementsClassName} · 紫微落${BRANCHES[chart.ziweiPos]}`
		);
	}
	lines.push("");

	// ── 经典出处：引文由 CLI 层从古籍库查得后递入，无引文时整节省略 ──
	if (citations.length > 0) {
		lines.push("### 经典出处");
		lines.push("");
		for (const c of citations) lines.push(`- 《${c.loc}》：「${c.text}」`);
		lines.push("");
	}

	// ── 综合建议（TOPIC_SUGGESTIONS 三条；「继续深度追问」是交互尾巴，报告不带）──
	lines.push("### 综合建议");
	lines.push("");
	for (const s of TOPIC_SUGGESTIONS[topic]) lines.push(`→ ${s}`);
	lines.push("");

	// view 之间的多空行在 Markdown 里与单个空行同义，统一压平成规范形态；
	// 性别过滤与 getTopicAnalysis 同口径：作用在整篇文本上（跨行内子句）
	const text = trimBlanks(lines)
		.join("\n")
		.replace(/\n{3,}/g, "\n\n");
	return filterGenderContent(text, chart.birthInfo.gender);
}
