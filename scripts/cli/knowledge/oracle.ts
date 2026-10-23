/**
 * knowledge 的 **oracle 域**：断语手册检索（原独立 `oracle` 命令已并入，旧命令名不保留）。
 *
 * 数据（`corpus/data/manual/`，4.4MB 分类断语）在函数体内动态 import 懒加载。
 * 三形态：裸（列全部主题）/ 主题（十四主星概览）/ 主题+星（分类断语全展开）
 * —— 见 docs/code/cli-commands.md。
 */

import type { CliArgs } from "../args";
import { TOPIC_LABEL, type TopicKey } from "@/analysis";

type OracleStar = import("@/corpus/data/manual/types").OracleStar;

/** 手册尾注：数据口径说明（每次查询输出都带，防止把快照断语当排盘结论）。 */
const ORACLE_FOOTER = [
	"─".repeat(56),
	"⚠️ 知识来源：以上为断语手册（分析数据库在 51.84 万设计样本上的预计算快照，本命静态口径），",
	"   解读请结合具体命盘：astrology <出生信息> --topic <key>。数据修订走内核，勿改手册文件。",
];

/** 渲染层自带的标记行（格局/三方/四化/次星/贵人）顶格保留，其余缩进两格。 */
const MARKER_RE = /^(?:⭐|▍|🔴|🟡|🔵|🟢|✦|◇)/;

function renderOracleStar(star: string, o: OracleStar): string[] {
	const out: string[] = [`【断语手册 · ${star}】`];

	const pushSection = (title: string, ls: string[]): void => {
		if (ls.length === 0) {
			return;
		}
		out.push("", `▶ ${title}`);
		for (const l of ls) {
			out.push(MARKER_RE.test(l) ? l : `  ${l}`);
		}
	};

	pushSection("命盘关键定制", o.mods);
	pushSection("星曜深层特质", o.summary);
	pushSection(
		"特殊格局",
		o.patterns.flatMap(p => [`⭐ ${p.name}：`, ...p.text.split("\n").map(t => `  ${t}`)])
	);
	if (o.mainPalace.stars.length > 0 || o.mainPalace.content.length > 0) {
		out.push("", "▶ 本宫论断");
		// 行自带「本宫主星：」前缀（渲染层原文），直接顶格
		for (const l of o.mainPalace.stars) {
			out.push(`  ${l}`);
		}
		for (const l of o.mainPalace.content) {
			out.push(`  ${l}`);
		}
	}
	if (o.sanFang.length > 0) {
		out.push("", "▶ 三方四正联动");
		for (const sf of o.sanFang) {
			out.push(`  ▍${sf.palace}：${sf.stars.join("、")}`);
			for (const it of sf.items) {
				out.push(`    ${it}`);
			}
		}
	}
	pushSection(
		"四化",
		o.sihua.flatMap(s =>
			s.note ? [s.text, ...s.note.split("\n").map(n => `  ${n}`)] : [s.text]
		)
	);
	pushSection(
		"贵人倾向（魁钺）",
		o.kuiYue.map(k => `◇ ${k}`)
	);
	for (const [name, ls] of Object.entries(o.extras)) {
		pushSection(name, ls);
	}

	return out;
}

/** 渲染 oracle 域三形态。 */
export async function renderOracle(args: CliArgs): Promise<string> {
	// 主题：--topic 或首个位置参数（与 astrology --topic 的 key 集合一致）
	const topicPos = args._[0];
	const topicRaw =
		args.topic !== undefined && args.topic !== true ? String(args.topic) : topicPos;
	if (typeof args.topic === "boolean") {
		throw new Error("--topic 需要一个主题 key（如 --topic career），或直接写位置参数。");
	}

	const { loadTopicOracle } = await import("@/corpus/data/manual/index.ts");

	// 主题基数**派生**而非写死：加主题时文案自动跟上，不必回来改数字。
	const topicKeys = Object.keys(TOPIC_LABEL);
	const topicCount = topicKeys.length;

	// 无主题：列全部主题与用法
	if (!topicRaw) {
		return [
			`断语手册检索（${topicCount} 主题 × 十四主星，分析数据库预计算快照）：`,
			...topicKeys.map(k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k as TopicKey]}`),
			"",
			"用法：knowledge --source oracle [--topic <主题>] [--star <星名>]",
			"  knowledge --source oracle --topic career          # 事业主题 14 主星概览",
			"  knowledge --source oracle --topic career --star 七杀  # 七杀的事业分类断语全展开",
		].join("\n");
	}
	const topic = topicRaw as TopicKey;
	if (!TOPIC_LABEL[topic]) {
		throw new Error(
			`oracle 域的主题应为 ${topicCount} 个之一（${topicKeys.join("/")}），收到：${topicRaw}`
		);
	}
	const oracle = await loadTopicOracle(topic);

	// 星名：--star 或第二个位置参数
	const starRaw = args.star !== undefined ? String(args.star) : args._[1];

	// 无星名：14 主星概览
	if (!starRaw) {
		const rows = Object.entries(oracle).map(([star, o]) => {
			const total =
				o.mods.length +
				o.summary.length +
				o.mainPalace.content.length +
				o.sanFang.reduce((n, f) => n + f.items.length, 0) +
				o.sihua.length +
				o.kuiYue.length +
				Object.values(o.extras).reduce((n, ls) => n + ls.length, 0);
			return `  ${star}：格局 ${o.patterns.length} · 断语 ${total} 条`;
		});
		return [
			`【断语手册 · ${TOPIC_LABEL[topic]}】十四主星概览（查单星：knowledge --source oracle --topic ${topic} --star <星名>）`,
			"",
			...rows,
			"",
			...ORACLE_FOOTER,
		].join("\n");
	}

	const o = oracle[starRaw];
	if (!o) {
		throw new Error(`断语手册未收录「${starRaw}」。已收录：${Object.keys(oracle).join("、")}`);
	}
	return [
		`【断语手册 · ${TOPIC_LABEL[topic]}】`,
		"",
		...renderOracleStar(starRaw, o),
		"",
		...ORACLE_FOOTER,
	].join("\n");
}
