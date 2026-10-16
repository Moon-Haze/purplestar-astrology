/**
 * `astrology --report` 的文档装配层：把 13 个主题的 Markdown 报告节拼成一份全盘报告。
 *
 * 内核侧（`analysis/report.ts` 的 getTopicReport）只管**单主题内容**；本文件管文档级的事：
 * 报告顺序、文档头、口径提示、经典出处的古籍检索与知识来源分级尾注。
 * ⚠️ 经典出处在本层查（`corpus` 是独立知识域、经 `knowledge` 命令出面，内核不反向依赖它），
 *    引文经 `options.citations` 递给内核逐节渲染 —— 见 docs/code/cli-commands.md。
 */

import type { BirthInfo, ZiweiChart } from "@/types";
import { ALL_BOOKS, searchClassics } from "@/corpus";
import { getTopicReport, getTopicReportMeta, type ReportCitation, type TopicKey } from "@/analysis";
import { detectPatterns } from "@/patterns";
import { getMutagenByStem } from "@/mutagen";
import { BRANCHES, STEMS } from "@/data/ganzhi";
import { birthplaceSection, fmtDate, genderCN, lateZiSection, locateSihua } from "../chart/render";
import type { CaliberBasis } from "../birth/birth-info-defs";

/**
 * 报告的 13 个板块及顺序 —— 与 `TOPIC_KEYS` 的存储序不同（那份数序是 parquet 列序，动不得）：
 * 财运提到事业前、性格放在感情后，其余按「先核心五项、后十二宫顺次」（见 docs/code/cli-commands.md）。
 */
const REPORT_TOPICS: TopicKey[] = [
	"overview",
	"wealth",
	"career",
	"love",
	"personality",
	"health",
	"family",
	"children",
	"move",
	"friends",
	"home",
	"spirit",
	"parents",
];

/** 每个主题的经典出处条数上限（宫位专章优先，全局检索补足）。 */
const CITATION_LIMIT = 3;

/**
 * 查一个主题的经典出处：先找该主题主宫的**宫位专章**（全书「十二宫论·X宫」只覆盖命 /
 * 财帛 / 官禄 / 夫妻四宫），取其中含主星的段落；再按主星名全局检索补足。
 *
 * @remarks
 * 引文只出自本仓古籍库（公版古籍、已入库的定本），不做任何改写拼接 —— 查不到就少给，不凑数。
 */
function topicCitations(meta: {
	palaceName: string;
	primaryStarName: string | null;
}): ReportCitation[] {
	const out: ReportCitation[] = [];
	const seen = new Set<string>();
	const push = (loc: string, text: string): void => {
		if (!seen.has(text)) {
			seen.add(text);
			out.push({ loc, text });
		}
	};

	const star = meta.primaryStarName;
	if (star) {
		for (const book of ALL_BOOKS) {
			for (const ch of book.chapters) {
				if (!ch.title.includes(meta.palaceName)) {
					continue;
				}
				for (const p of ch.paragraphs) {
					if (p.text.includes(star)) {
						push(`${book.title}·${ch.title}`, p.text);
					}
				}
			}
		}
		for (const hit of searchClassics(star, CITATION_LIMIT * 2)) {
			if (out.length >= CITATION_LIMIT) {
				break;
			}
			push(`${hit.bookTitle}·${hit.chapterTitle}`, hit.text);
		}
	}
	return out.slice(0, CITATION_LIMIT);
}

/**
 * 装配全盘 Markdown 报告。
 *
 * @param chart - 已排好的命盘
 * @param info - 出生信息（真太阳时校正后的口径）
 * @param basis - 口径载体（候选 6：整包 CaliberBasis；内部只读 lngNote /
 *   lngAmbiguous / isLateZi / lateZiCandidate 四字段），有内容时以引用块附在文档头 ——
 *   口径提示必须随报告走，不能只在终端概览里出现
 */
export function buildReport(chart: ZiweiChart, info: BirthInfo, basis: CaliberBasis): string {
	const yearStem = chart.lunarInfo.yearStem;
	const native = getMutagenByStem(yearStem);
	const sihuaLine = locateSihua(chart, native)
		.map(l => `${l.star}化${l.hua}${l.palace ? `（落${l.palace}）` : ""}`)
		.join(" ｜ ");
	const patterns = detectPatterns(chart);
	const dx = chart.decadals[chart.currentDecadalIndex];

	const header: string[] = [
		"# 紫微斗数全盘报告",
		"",
		`- 出生：${fmtDate(info)} · ${genderCN(info.gender)}`,
		`- 农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
		`- 命宫：${BRANCHES[chart.soulBranch]} · 身宫：${BRANCHES[chart.bodyBranch]} · 五行局：${chart.fiveElementsClassName} · 紫微落：${BRANCHES[chart.ziweiPos]}`,
		`- 生年四化（${STEMS[yearStem]}干）：${sihuaLine}`,
	];
	if (patterns.length > 0) {
		header.push(`- 已入格局：${patterns.map(p => `${p.name}（${p.level}）`).join("、")}`);
	}
	header.push(
		`- 当前虚岁：${chart.currentAge} · 当前大限：${dx ? `${dx.palaceName}（${dx.startAge}–${dx.endAge}岁）` : "—（尚未起运）"}`
	);

	// 口径提示（出生地 / 晚子时）—— 有则随报告，作为引用块紧跟文档头
	const basisNotes = [...birthplaceSection(basis), ...lateZiSection(chart, info, basis)].filter(
		l => l.trim() !== ""
	);
	if (basisNotes.length > 0) {
		header.push("", "> **口径提示**");
		header.push(...basisNotes.map(l => `> ${l}`));
	}

	const sections = REPORT_TOPICS.map(topic => {
		const meta = getTopicReportMeta(chart, topic);
		const citations = meta ? topicCitations(meta) : [];
		return getTopicReport(chart, topic, { citations });
	});

	const footer = [
		"---",
		"",
		"⚠️ **知识来源分级**：以上论断出自分析数据库 v3 —— 其中「倪师说」引号句部分为传统口诀的风格化转述，不一定是《天纪》逐字原话（verified / traditional / methodology / suspect 四级）；「经典出处」引文出自本仓古籍库（《骨髓赋》《紫微斗数全集》《紫微斗数全书》），公版定本。",
		"",
		"- 年龄一律**虚岁**（以农历年为界），与 CLI 各命令同口径，不要换算成周岁。",
		"- 本报告为**本命盘静态论断**；大限 / 流年 / 流月动态见 `--decadal`、`--yearly`、`--topic <key> --view daxian|liunian|liuyue`。",
	];

	// 末尾不带换行：引导层统一 console.log 输出时补上唯一一个，文件以单换行结尾
	return [...header, "", "---", "", sections.join("\n\n---\n\n"), "", ...footer].join("\n");
}
