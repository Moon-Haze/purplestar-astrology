/**
 * 与 {@link ./index|getTopicAnalysis} 平级（Markdown）。
 * ⚠️ 只编排不算命：建一次 {@link makeContext}，各 `renderXxx` 行按小节序拼；性别经各 view `selectGender` 投影。
 * ⚠️「经典出处」引文由 CLI 查古籍经 `options.citations` 递入，不引古籍库 —— 保持「排盘内核不依赖古籍域」。
 * 剥头 / 小节流 / html 两节省略理由见 docs/code/analysis.md。
 * @file 与 {@link ./index|getTopicAnalysis} 平级的第二编排器（Markdown）
 * @packageDocumentation
 */

import type { ZiweiChart } from "../types";

/** 童限未起运占位行——`getDecadalSection` / `getTopicReport` 未起运分支同句（单点收口）。 */
const CHILD_LIMIT_NOTE =
	"（尚未起运 —— 虚岁小于五行局数时不入大限，按命宫论，见 SKILL「童限」口径。）";
import {
	STAR_BRIEF,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type AnalysisOptions,
	type TopicKey,
} from "../analysis/data";
import { makeContext } from "../analysis/context";
import { buildOverviewMaterial } from "../analysis/overview-material";
import { descPalaceStars } from "../analysis/palace-query";
import { buildTopicSuggestions, suggestionLine } from "../analysis/suggestions";
import { BRANCHES } from "@/data/ganzhi";
import { renderDecadal } from "../analysis/views/decadal";
import { renderHealth } from "../analysis/views/health";
import { renderKuiYue } from "../analysis/views/patron";
import { renderSanFang } from "../analysis/views/surround";
import { renderMutagen } from "../analysis/views/mutagen";

/** 经典出处引文：`loc` 为「书名·章节名」，`text` 为段落原文。 */
export interface ReportCitation {
	/** 出处定位串：`书名·章节名`。 */
	loc: string;
	/** 该出处段落原文。 */
	text: string;
}

/** {@link getTopicReport} 可选参数：在 {@link AnalysisOptions} 上叠加引文与装配状态。 */
export type ReportOptions = AnalysisOptions & {
	/** 经典出处引文列表：CLI 查古籍递入，只按序拼进「经典出处」节，缺省空。 */
	citations?: ReportCitation[];
	/**
	 * 跨节去重状态：键 = 论断全文，值 = 首现 / 主场板块名。
	 * 三方联动 fullContent 前查表，命中降级「徽标 + 指引行」；缺省（`--topic`）与不去重逐字节一致。
	 * 主场登记由 {@link getTopicMainContentTexts} 预扫描。
	 */
	dedupe?: Map<string, string>;
	/** `--report` 置 true 时不渲染「当前大限」节（大限与主题无关，文档头独立节承接，见 {@link getDecadalSection}）；缺省不省略。 */
	omitDecadal?: boolean;
};

/**
 * 叶子 view 行 → 报告块。
 * @remarks 剥首 `**【…】**` 头，子块头转 `####`（强调行不能当标题）。
 * ⚠️ 无头输出按原行装配（标题与自带头并存是应被看见的漂移）。
 * @param lines - 叶子 view 输出行
 * @returns 新行数组：剥首空行与首节头，其余 `**【…】**` 改 `####`；不改入参
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

/**
 * 去首尾空行（间距由编排层控制）。
 * @param lines - 待裁剪行
 * @returns 新数组：只裁首尾 `""`，中间原样；不改入参
 */
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
 * 主题报告元信息（CLI 查古籍引文输入）。
 * @remarks 单列而非读 ctx：`AnalysisContext` 不在公开面，主宫主星派生值须同源，不让调用方再找宫。
 * @param chart - 已排好的命盘
 * @param topic - 主题键
 * @returns 主宫名 / 主星名（空宫借对宫）/ 是否借宫；主宫找不到返 `null`
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
 * 「本板块哪些全文登记主场」唯一实现（spec report-assembly「主场登记单一
 * 权威」）：登记 = 第一主星 `m.content` + 双主星 `m.secondStarContent`，与 {@link getTopicReport} 同源，同走 {@link buildOverviewMaterial}；供 `--report` 预登记，渲染（{@link getTopicReport}）不另登记。
 * @remarks 须预扫描：否则早板块三方联动先遇「渲染在后的板块核心论断」同文抢首现，致主场降级、同文两次；预登记后命中主场即降级。
 * @param chart - 已排好的命盘
 * @param topic - 主题键
 * @returns 主场全文数组（第一主星在前、第二主星在后，空剔除）；无内容为空
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
 * 「当前大限」独立节正文（剥 `**【…】**` 头）—— 大限与主题无关（{@link renderDecadal} 只读 currentDx），13 板块重复，`--report` 改一处，`omitDecadal` 省略。
 * 未起运给童限提示，与 {@link getTopicReport} 分支逐字一致。
 * @param chart - 已排好的命盘
 * @returns 大限节正文（已剥头、trim）；主宫找不到返空串
 */
export function getDecadalSection(chart: ZiweiChart): string {
	const ctx = makeContext(chart, "overview", {});
	if (!ctx) {
		return "";
	}
	const decadal = renderDecadal(ctx);
	if (decadal.length === 0) {
		return CHILD_LIMIT_NOTE;
	}
	return asMarkdownBlock(decadal).join("\n").trim();
}

/**
 * 生成单个主题 Markdown 报告节。
 * @param chart - 已排好的命盘
 * @param topic - 主题键
 * @param options - 视角等 {@link AnalysisOptions} + `citations`（缺省该节省略）
 * @returns 一节 Markdown（`## 主题名（主宫 · 主星）` 开头）；主宫找不到返兜底提示
 * @remarks 小节序参照 html 版。
 * ⚠️ html 版「主辅煞组合精细论断」「天纪溯源·时间码」两节数据不在本仓，不臆造、省略。
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

	// 节标题：主题名（主宫 · 主星徽标）
	lines.push(`## ${TOPIC_LABEL[topic]}（${ctx.palaceName} · ${m.loanTag}${m.mainBadge}）`);
	lines.push("");

	// 定调：主星简述，空宫借宫提示
	if (ctx.primaryStar) {
		const brief = STAR_BRIEF[ctx.primaryStar.name];
		if (brief) {
			lines.push(`> **定调 · ${ctx.primaryStar.name}**：${brief}`);
		}
	} else {
		lines.push(`> **定调**：${ctx.palaceName}无主星，借对宫与三方四正综合定调。`);
	}
	lines.push("");

	// 总览：定制 + 格局 + 星曜特质
	// 取材 ../overview-material（同 views/overview.ts 单点），不加【】头
	// 即「总览」三层次；辅助宫（兄弟/子女/迁移/交友/田宅/福德/父母）三样都没有则整段省略

	// ⚠️ personality 跳过 mods/geju：与命格总览同主宫（命宫），注入行逐字相同——报告连续读纯冗余（板块总览唯一，spec report-assembly）；仅 --report

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

	// 核心论断：主星该宫全文 + 亮度 + 第二主星
	const verdictLines: string[] = [];
	if (!m.emptyFallback) {
		if (m.content) {
			verdictLines.push(m.content);
		}
		if (m.brightNote) {
			verdictLines.push(m.brightNote);
		}
		if (m.secondStar) {
			verdictLines.push(m.secondStar);
		}
		if (m.secondStarContent) {
			verdictLines.push(m.secondStarContent);
		}
	}
	if (verdictLines.length > 0) {
		lines.push("### 核心论断");
		lines.push("");
		lines.push(...verdictLines, "");
	}

	// 命盘推演：主星一行（借宫注明，取 material）
	lines.push("### 命盘推演");
	lines.push("");
	lines.push(m.mainStarLine);
	lines.push("");

	// 三方四正联动（叶子 view，剥头）
	lines.push("### 三方四正联动");
	lines.push("");
	lines.push(...asMarkdownBlock(renderSanFang(ctx, options.dedupe)));

	// 四化路径：四化会照 + 魁钺
	// 注句经去重表全报告首现一次（四化注首现），落点行恒出（renderMutagen）
	lines.push("### 四化路径分析");
	lines.push("");
	lines.push(...asMarkdownBlock(renderMutagen(ctx, options.dedupe)));
	const kuiYue = renderKuiYue(ctx);
	if (kuiYue.length > 0) {
		lines.push("");
		lines.push(...asMarkdownBlock(kuiYue));
	}

	// 当前大限（--report 省略，文档头独立节承接）
	if (!options.omitDecadal) {
		lines.push("### 当前大限");
		lines.push("");
		const decadal = renderDecadal(ctx);
		if (decadal.length > 0) {
			lines.push(...asMarkdownBlock(decadal));
		} else {
			lines.push(CHILD_LIMIT_NOTE);
		}
	}

	// 疾厄取象（health）
	// personality 不渲染「性格深描」：与核心论断逐字同源（同一 personality 键），
	// 板块总览唯一（spec report-assembly）；--topic 不受影响
	const extra = topic === "health" ? renderHealth(ctx) : [];
	if (extra.length > 0) {
		lines.push("");
		lines.push("### 健康取象（宫位主轴 · 倪师原法）");
		lines.push("");
		lines.push(...asMarkdownBlock(extra));
	}

	// 命盘依据：主宫星曜 / 三方四正 / 四化 / 骨架
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

	// 经典出处：CLI 递入引文，无则省略
	if (citations.length > 0) {
		lines.push("### 经典出处");
		lines.push("");
		for (const c of citations) {
			lines.push(`- 《${c.loc}》：「${c.text}」`);
		}
		lines.push("");
	}

	// 综合建议（按盘推算；「继续深度追问」交互尾巴不带）
	lines.push("### 综合建议");
	lines.push("");
	for (const s of buildTopicSuggestions(ctx)) {
		lines.push(suggestionLine(s));
	}
	lines.push("");

	// view 间多空行与单空行同义，压平；
	// 性别已各 view selectGender 投影，编排层仅拼接不过滤
	const text = trimBlanks(lines)
		.join("\n")
		.replace(/\n{3,}/g, "\n\n");
	return text;
}
