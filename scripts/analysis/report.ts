/**
 * 全盘报告编排层 —— 与 {@link ./index|getTopicAnalysis} 平级的第二编排器（Markdown 形态）。
 *
 * ⚠️ 本模块**只编排、不算命**：建一次 {@link makeContext} 上下文，把各 `renderXxx` 的行
 *    按报告小节序拼接，最后整体过一遍性别过滤（跨行内子句只能作用在整篇文本上）。
 * ⚠️ 「经典出处」引文由 CLI 层查古籍后从 `options.citations` 递入，本模块不引古籍库 ——
 *    保持「排盘内核不依赖古籍域」的分层。
 *
 * 剥头口径、报告小节流与 html 版两节省略的理由，见 docs/code/analysis.md。
 *
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";
import {
	STAR_BRIEF,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type AnalysisOptions,
	type TopicKey,
} from "../analysis/data";
import { makeContext } from "../analysis/context";
import { buildOverviewMaterial, starBadge } from "../analysis/overview-material";
import { descPalaceStars } from "../analysis/palace-query";
import { buildTopicSuggestions } from "../analysis/suggestions";
import { BRANCHES } from "@/data/ganzhi";
import { renderDecadal } from "../analysis/views/decadal";
import { renderHealth } from "../analysis/views/health";
import { renderKuiYue } from "../analysis/views/patron";
import { renderSanFang } from "../analysis/views/surround";
import { renderMutagen } from "../analysis/views/mutagen";

/** 一条经典出处引文：`loc` 是「书名·章节名」，`text` 是段落原文。 */
export interface ReportCitation {
	loc: string;
	text: string;
}

/** {@link getTopicReport} 的可选参数：在 {@link AnalysisOptions} 上叠加引文与装配状态。 */
export type ReportOptions = AnalysisOptions & {
	citations?: ReportCitation[];
	/**
	 * 报告装配层的跨节去重状态：键 = 论断全文文本，值 = 该文的首现 / 主场板块名。
	 * 三方联动的 fullContent 渲染前查此表，命中即降级为「徽标 + 指引行」；缺省
	 * （`--topic` 单主题路径）为 `undefined`，输出与不去重时逐字节一致。
	 * 主场登记由装配层经 {@link getTopicMainContentText} 预扫描完成 —— 见其注释。
	 */
	dedupe?: Map<string, string>;
	/**
	 * `--report` 装配时置 true：板块内不再渲染「当前大限」小节（大限与主题无关，
	 * 由文档头区的独立大限节承接，见 {@link getDecadalSection}）。缺省不省略，
	 * 单主题路径行为不变。
	 */
	omitDecadal?: boolean;
};

/**
 * 把叶子 view 输出装配成报告的 Markdown 块。
 *
 * @remarks
 * 剥掉**首个** `**【…】**` 头，view 内部的子块头转成 `####` 标题（Markdown 文档里
 * 强调行不能当标题）。
 *
 * ⚠️ 无头输出按原行装配：报告标题会与它自带的头并存 —— 那是应当被看见的漂移。
 * 完整口径见 docs/code/analysis.md。
 */
function asMarkdownBlock(lines: string[]): string[] {
	let i = 0;
	while (i < lines.length && lines[i] === "") {
		i++;
	}
	if (i < lines.length && /^\*\*【[^】]+】\*\*$/.test(lines[i])) {
		i += 1;
		while (i < lines.length && lines[i] === "") {
			i++;
		}
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
	while (start < end && lines[start] === "") {
		start++;
	}
	while (end > start && lines[end - 1] === "") {
		end--;
	}
	return lines.slice(start, end);
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
	if (!ctx) {
		return null;
	}
	return {
		palaceName: ctx.palaceName,
		primaryStarName: ctx.primaryStar?.name ?? null,
		isLoan: ctx.isLoan,
	};
}

/**
 * 单主题核心论断需登记主场的全文集合（第一主星 `m.content` + 双主星的
 * `m.secondStarContent`，与 {@link getTopicReport} 同源同投影，同走
 * {@link buildOverviewMaterial}）—— 供 `--report` 装配层**预登记**主场板块。
 *
 * @remarks
 * 为什么必须预扫描而非渲染时登记：渲染按板块序进行，更早板块的三方联动会先遇到
 * 「渲染在后的板块核心论断」同文文本并抢走首现，导致主场板块的核心论断降级、
 * 同文出现两次。预扫描把全部主场登记完后，三方联动的 fullContent 查表命中主场
 * 即降级指引回主场板块 —— 全文恰出现一次，且永远落在其主场。第二主星全文同样
 * 在本板块展开（双主星主场展开），故一并登记——改前它只能靠别的板块三方联动
 * 抢走首现，指引指错主场（天相→财富运势、巨门→健康状况）。空宫等无内容的
 * 主题返回空数组，调用方跳过登记。
 */
export function getTopicMainContentTexts(chart: ZiweiChart, topic: TopicKey): string[] {
	const ctx = makeContext(chart, topic, {});
	if (!ctx) {
		return [];
	}
	const m = buildOverviewMaterial(ctx);
	return [m.content, m.secondStarContent].filter((t): t is string => !!t);
}

/**
 * 「当前大限」独立节的正文（剥 view 自带的 `**【…】**` 头，年龄区间与宫名由
 * 装配层的节标题承载）—— 大限与主题无关（{@link renderDecadal} 只读 currentDx），
 * 13 个板块各渲染一遍是纯重复，`--report` 改为全报告一处，板块内以
 * `omitDecadal` 省略。
 *
 * 未起运（renderDecadal 返回空）时返回童限提示句，文案与 {@link getTopicReport}
 * 的未起运分支逐字一致。
 */
export function getDecadalSection(chart: ZiweiChart): string {
	const ctx = makeContext(chart, "overview", {});
	if (!ctx) {
		return "";
	}
	const decadal = renderDecadal(ctx);
	if (decadal.length === 0) {
		return "（尚未起运 —— 虚岁小于五行局数时不入大限，按命宫论，见 SKILL「童限」口径。）";
	}
	return asMarkdownBlock(decadal).join("\n").trim();
}

/**
 * 生成单个主题的 Markdown 报告节。
 *
 * @param chart - 已排好的命盘
 * @param topic - 主题键（14 个之一）
 * @param options - 视角等 {@link AnalysisOptions} + `citations`（经典出处引文，
 *   缺省时该小节整体省略）
 * @returns 一节 Markdown 文本（以 `## 主题名（主宫 · 主星）` 开头）；主宫找不到时
 *   返回兜底提示 —— 与 `getTopicAnalysis` 同一提前返回口径
 *
 * @remarks
 * 小节序参照 html 版主题报告（定调 → 总览 → 核心论断 → 命盘推演 → 三方四正联动 →
 * 四化路径分析 → 当前大限 → 主题专属补充 → 命盘依据 → 经典出处 → 综合建议）。
 *
 * ⚠️ html 版另有「主辅煞组合精细论断」「天纪溯源·时间码」两节，其数据不在本仓知识源内，
 *    不臆造、整体省略。完整小节流见 docs/code/analysis.md。
 */
export function getTopicReport(
	chart: ZiweiChart,
	topic: TopicKey,
	options: ReportOptions = {}
): string {
	const ctx = makeContext(chart, topic, options);
	if (!ctx) {
		return `无法找到${TOPIC_PALACE_NAME[topic]}相关信息。`;
	}

	const { citations = [] } = options;
	const lines: string[] = [];
	const m = buildOverviewMaterial(ctx);

	// ── 节标题：主题名（主宫 · 主星徽标）──
	const loanTag = ctx.isLoan ? "借对宫" : "";
	lines.push(`## ${TOPIC_LABEL[topic]}（${ctx.palaceName} · ${loanTag}${m.mainBadge}）`);
	lines.push("");

	// ── 一句话定调：主星一句简述（STAR_BRIEF），空宫给借宫提示 ──
	if (ctx.primaryStar) {
		const brief = STAR_BRIEF[ctx.primaryStar.name];
		if (brief) {
			lines.push(`> **定调 · ${ctx.primaryStar.name}**：${brief}`);
		}
	} else {
		lines.push(`> **定调**：${ctx.palaceName}无主星，借对宫与三方四正综合定调。`);
	}
	lines.push("");

	// ── 总览：命盘关键定制 + 特殊格局 + 星曜深层特质 ──
	// 取材住 `../overview-material`（与 views/overview.ts 同一单点），但不加【】小节头
	// —— 报告里它们是同一段「总览」的三个层次。辅助宫主题（兄弟/子女/迁移/交友/
	// 田宅/福德/父母）三样都没有 —— 整段省略，不留空标题（view 层同口径）。
	// ⚠️ personality 板块跳过 mods/geju：它与命格总览板块同主宫（命宫），注入行
	//    逐字相同——报告连续阅读场景纯冗余（板块总览唯一，spec report-assembly）。
	//    本函数仅服务 --report，--topic 终端路径（getTopicAnalysis）不受影响。
	const overviewLines: string[] = [];
	if (!m.emptyFallback) {
		if (topic !== "personality") {
			overviewLines.push(...m.mods, ...m.geju);
		}
		if (m.summary) {
			overviewLines.push(m.summary);
		}
	} else {
		overviewLines.push(m.emptyFallback);
	}
	if (overviewLines.length > 0) {
		lines.push("### 总览");
		lines.push("");
		lines.push(...overviewLines, "");
	}

	// ── 核心论断：本宫主星的该宫语境全文 + 亮度补充 + 同宫第二主星（简述 + 全文）──
	const verdictLines: string[] = [];
	if (!m.emptyFallback) {
		if (m.content) {
			verdictLines.push(m.content);
			// 主场登记（不查询）：本板块核心论断全文恒输出（spec「本宫核心论断」豁免），
			// 登记让后续板块的三方联动把同文降级指引回此处。装配层已预登记同值，此
			// set 对未预扫描的调用方兜底，对已登记者是幂等重写。
			options.dedupe?.set(m.content, TOPIC_LABEL[topic]);
		}
		if (m.brightNote) {
			verdictLines.push(m.brightNote);
		}
		if (m.secondStar) {
			verdictLines.push(m.secondStar);
		}
		if (m.secondStarContent) {
			// 双主星主场展开：第二主星全文在本板块（语义主场）首现并登记，三方联动
			// 的指引指回正确板块（改前全文漂移到别的板块三方联动，指引指错主场）。
			verdictLines.push(m.secondStarContent);
			options.dedupe?.set(m.secondStarContent, TOPIC_LABEL[topic]);
		}
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
			`${m.mainBadge}` +
			`${topic === "overview" ? `，${chart.fiveElementsClassName}` : ""}`
	);
	lines.push("");

	// ── 三方四正联动（叶子 view，剥头）──
	lines.push("### 三方四正联动");
	lines.push("");
	lines.push(...asMarkdownBlock(renderSanFang(ctx, options.dedupe)));

	// ── 四化路径分析：本命四化会照 + 魁钺贵人 ──
	// 注句经去重表全报告首现一次（四化注首现原则），落点行恒出（renderMutagen 内）。
	lines.push("### 四化路径分析");
	lines.push("");
	lines.push(...asMarkdownBlock(renderMutagen(ctx, options.dedupe)));
	const kuiYue = renderKuiYue(ctx);
	if (kuiYue.length > 0) {
		lines.push("");
		lines.push(...asMarkdownBlock(kuiYue));
	}

	// ── 当前大限（未起运时给童限提示；--report 装配省略，由文档头区独立节承接）──
	if (!options.omitDecadal) {
		lines.push("### 当前大限");
		lines.push("");
		const decadal = renderDecadal(ctx);
		if (decadal.length > 0) {
			lines.push(...asMarkdownBlock(decadal));
		} else {
			lines.push(
				"（尚未起运 —— 虚岁小于五行局数时不入大限，按命宫论，见 SKILL「童限」口径。）"
			);
		}
	}

	// ── 主题专属补充：疾厄取象（health）──
	// personality 不渲染「性格深描」：其内容与核心论断逐字同源（同一 personality 键），
	// 板块总览唯一（spec report-assembly）；--topic 终端路径（getTopicAnalysis）不受影响。
	const extra = topic === "health" ? renderHealth(ctx) : [];
	if (extra.length > 0) {
		lines.push("");
		lines.push("### 健康取象（宫位主轴 · 倪师原法）");
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
	if (sanFangDesc) {
		lines.push(`- 三方四正：${sanFangDesc}`);
	}
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
		for (const c of citations) {
			lines.push(`- 《${c.loc}》：「${c.text}」`);
		}
		lines.push("");
	}

	// ── 综合建议（按盘推算；「继续深度追问」是交互尾巴，报告不带）──
	lines.push("### 综合建议");
	lines.push("");
	for (const s of buildTopicSuggestions(ctx)) {
		lines.push(
			s.basis === "无命中信号"
				? `→ ${s.text}（本盘无此主题的直接信号，此为通用收束）`
				: `→ ${s.text}`
		);
	}
	lines.push("");

	// view 之间的多空行在 Markdown 里与单个空行同义，统一压平成规范形态；
	// 性别过滤与 getTopicAnalysis 同口径：作用在整篇文本上（跨行内子句）
	const text = trimBlanks(lines)
		.join("\n")
		.replace(/\n{3,}/g, "\n\n");
	return text;
}
