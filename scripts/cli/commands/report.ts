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
import {
	getDecadalSection,
	getTopicMainContentTexts,
	getTopicReport,
	getTopicReportMeta,
	TOPIC_LABEL,
	type ReportCitation,
	type TopicKey,
} from "@/analysis";
import { detectPatterns } from "@/patterns";
import { getMutagenByStem } from "@/mutagen";
import { BRANCHES, STEMS } from "@/data/ganzhi";
import { birthplaceSection, fmtDate, genderCN, lateZiSection, locateSihua } from "../chart/render";
import type { CaliberBasis } from "../birth/birth-info-defs";

/**
 * 报告的 13 个板块及顺序 —— 与 `TOPIC_KEYS` 的序不同；数据集物理列序归
 * `STORAGE_TOPIC_KEYS` 管（增删顺序等于改存储格式，动不得）：
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

/** 全局检索的候选池大小（过滤前）—— 过滤会淘汰无语境候选，池子须宽于上限。 */
const CITATION_POOL = 30;

/**
 * 引文语境词表（按宫名键）—— 全局检索的候选段落须同时含主星名与这里至少一词方可
 * 收录；宫位专章命中不受此限（章节标题含宫名即语境自证）。
 *
 * ⚠️ 单一角色：只服务「经典出处相关性」这一件事（spec report-assembly），不做格局
 *    判断、不做论断素材。词取宫名核心与十二宫主管领域词的古文用语，宁缺勿滥 ——
 *    查不到就省略，不凑数。
 */
const PALACE_CONTEXT_WORDS: Record<string, readonly string[]> = {
	命宫: ["命宫", "立命", "安命"],
	兄弟宫: ["兄弟", "昆仲", "手足", "合伙"],
	夫妻宫: ["夫妻", "婚姻", "配偶", "妻妾"],
	子女宫: ["子女", "子息", "儿孙", "后嗣"],
	财帛宫: ["财帛", "钱财", "财富"],
	疾厄宫: ["疾厄", "疾病", "身体", "灾病", "健康"],
	迁移宫: ["迁移", "外出", "出行", "远行", "离乡", "外乡"],
	交友宫: ["交友", "仆役", "朋友", "人际", "奴仆"],
	官禄宫: ["官禄", "事业", "仕途", "官职"],
	田宅宫: ["田宅", "家宅", "家业", "祖业", "田产"],
	福德宫: ["福德", "福气", "福分", "精神", "享受"],
	父母宫: ["父母", "长辈", "文书", "相貌"],
};

/**
 * 查一个主题的经典出处：先找该主题主宫的**宫位专章**（全书「十二宫论·X宫」只覆盖命 /
 * 财帛 / 官禄 / 夫妻四宫），取其中含主星的段落；再按主星名全局检索补足，候选段落须
 * 通过双通道相关性过滤之一：主题星判定（主星名出现 ≥2 次，段落以论述该星为主）或
 * 语境词共现（含 {@link PALACE_CONTEXT_WORDS} 的该宫语境词）。
 *
 * @remarks
 * 引文只出自本仓古籍库（公版古籍、已入库的定本），不做任何改写拼接 —— 查不到就少给，
 * 不凑数。纯子串召回会把「罗列多星的名句恰好含本盘主星」的段落（如机月同梁格句含
 * 「天同」）挂到无关宫位下；这类罗列段星名恰出现 1 次，两通道都拦住。星曜论段落
 * （「七杀为将星……七杀守命……」）是该星在任何宫的权威出处，天然不含宫名，靠
 * 主题星通道保留。
 */
export function topicCitations(meta: {
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
		const contextWords = PALACE_CONTEXT_WORDS[meta.palaceName] ?? [];
		for (const hit of searchClassics(star, CITATION_POOL)) {
			if (out.length >= CITATION_LIMIT) {
				break;
			}
			// 双通道：主题星（罗列段星名恰 1 次，被 ≥2 判据挡住）或宫位语境词
			const isThemeStar = hit.text.split(star).length - 1 >= 2;
			const hasContext = contextWords.some(w => hit.text.includes(w));
			if (!isThemeStar && !hasContext) {
				continue;
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

	// 主场预登记：13 板块核心论断全文（第一主星 + 双主星的第二主星）→ 板块名，
	// 先于任何渲染完成。三方联动的 fullContent 查此表命中即降级指引回主场板块 ——
	// 不预登记的话，渲染在后的板块核心论断会被更早板块的三方联动抢走首现，同文
	// 出现两次；第二主星全文不经预登记会漂移到别的板块（改前天相指财富、巨门指
	// 健康）。13 主题的 contentKey 互异（`study` 复用 `career` 但不在报告板块），
	// 预登记无同文冲突。
	const dedupe = new Map<string, string>();
	for (const topic of REPORT_TOPICS) {
		for (const text of getTopicMainContentTexts(chart, topic)) {
			if (!dedupe.has(text)) {
				dedupe.set(text, TOPIC_LABEL[topic]);
			}
		}
	}

	const sections = REPORT_TOPICS.map(topic => {
		const meta = getTopicReportMeta(chart, topic);
		const citations = meta ? topicCitations(meta) : [];
		return getTopicReport(chart, topic, { citations, dedupe, omitDecadal: true });
	});

	// 大限独立节：「当前大限」与主题无关（renderDecadal 只读 currentDx），从 13 板块
	// 抽出全报告只渲染一处，落在口径提示之后、首板块之前。
	const decadalBody = getDecadalSection(chart);
	const decadalBlock: string[] = [];
	if (decadalBody) {
		decadalBlock.push(
			dx ? `## 当前大限（${dx.startAge}–${dx.endAge}岁 · ${dx.palaceName}）` : "## 当前大限",
			"",
			decadalBody
		);
	}

	const footer = [
		"---",
		"",
		"⚠️ **知识来源分级**：以上论断出自分析数据库 —— 其中「倪师说」引号句部分为传统口诀的风格化转述，不一定是《天纪》逐字原话（verified / traditional / methodology / suspect 四级）；「经典出处」引文出自本仓古籍库（《骨髓赋》《紫微斗数全集》《紫微斗数全书》），公版定本。",
		"",
		"- 年龄一律**虚岁**（以农历年为界），与 CLI 各命令同口径，不要换算成周岁。",
		"- 本报告为**本命盘静态论断**；大限 / 流年 / 流月动态见 `--decadal`、`--yearly`、`--topic <key> --view daxian|liunian|liuyue`。",
	];

	// 末尾不带换行：引导层统一 console.log 输出时补上唯一一个，文件以单换行结尾
	return [
		...header,
		"",
		"---",
		"",
		...decadalBlock,
		"",
		"---",
		"",
		sections.join("\n\n---\n\n"),
		"",
		...footer,
	].join("\n");
}
