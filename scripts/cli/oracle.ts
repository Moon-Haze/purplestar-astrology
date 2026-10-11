/**
 * `oracle` 命令：断语手册检索（analysis/manual 的生成数据）。
 *
 * 与 `classics` 同类的**离线知识域**命令：不排盘，直接查分析数据库预计算出的
 * 「主题 × 主星」分类断语（mods / summary / patterns / mainPalace / sanFang /
 * sihua / kuiYue / extras）。数据由 `tools/db/export-manual.ts code` 生成，
 * 修订断语改内核 `ziwei/analysis/` 后重建库重导，本命令只消费。
 *
 * 数据**懒加载**：命令实现会被 `commands.ts` 静态 import，manual 数据（3.4MB）
 * 必须在函数体内动态 import，保证 CLI 主链路零启动开销。
 */

import type { CliArgs } from "./args";
import { TOPIC_LABEL, type TopicKey } from "@/ziwei/analysis";
import type { OracleStar } from "@/ziwei/analysis/manual/types.ts";

/** 手册尾注：数据口径说明（每次查询输出都带，防止把快照断语当排盘结论）。 */
const FOOTER = [
	"─".repeat(56),
	"⚠️ 知识来源：以上为断语手册（分析数据库在 51.84 万设计样本上的预计算快照，本命静态口径），",
	"   解读请结合具体命盘：astrology <出生信息> --topic <key>。数据修订走内核，勿改手册文件。",
];

/** 主题 key 归一 + 校验：非法值报错并列出全部主题。 */
function parseTopic(pos: string[]): TopicKey {
	const key = pos[0] as TopicKey;
	if (!TOPIC_LABEL[key])
		throw new Error(
			`oracle 的主题应为 13 个之一（${Object.keys(TOPIC_LABEL).join("/")}），收到：${pos[0] ?? "（缺省）"}`
		);
	return key;
}

/** 单星断语集的渲染（分类小节按 OracleStar 字段序，空节跳过）。 */
const MARKER_RE = /^(?:⭐|▍|🔴|🟡|🔵|🟢|✦|◇)/;

function renderStar(star: string, o: OracleStar): string[] {
	const out: string[] = [`【断语手册 · ${star}】`];

	const pushSection = (title: string, lines: string[]): void => {
		if (lines.length === 0) return;
		out.push("", `▶ ${title}`);
		// 渲染层自带的标记行（格局/三方/四化/次星/贵人）顶格保留，其余缩进两格
		for (const l of lines) out.push(MARKER_RE.test(l) ? l : `  ${l}`);
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
		for (const l of o.mainPalace.stars) out.push(`  ${l}`);
		for (const l of o.mainPalace.content) out.push(`  ${l}`);
	}
	if (o.sanFang.length > 0) {
		out.push("", "▶ 三方四正联动");
		for (const sf of o.sanFang) {
			out.push(`  ▍${sf.palace}：${sf.stars.join("、")}`);
			for (const it of sf.items) out.push(`    ${it}`);
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
	for (const [name, ls] of Object.entries(o.extras)) pushSection(name, ls);

	return out;
}

/**
 * `oracle` 命令：断语手册检索。
 *
 * @param args - CLI 参数表；位置参数 `<主题> [星名]`
 * @returns 已渲染好的文本
 *
 * @remarks
 * - `oracle`：列 13 主题与用法；
 * - `oracle <主题>`：该主题 14 主星概览（格局数 + 断语行数，供选星）；
 * - `oracle <主题> <星名>`：该星分类断语全展开。
 *
 * 数据在函数体内动态 import（懒加载，见文件头）。
 */
export async function cmdOracle(args: CliArgs): Promise<string> {
	const pos = args._;
	const { loadTopicOracle } = await import("@/ziwei/analysis/manual/index.ts");

	// 无位置参数：列主题与用法
	if (pos.length === 0) {
		return [
			"断语手册检索（13 主题 × 十四主星，分析数据库预计算快照）：",
			...Object.keys(TOPIC_LABEL).map(k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k as TopicKey]}`),
			"",
			"用法：oracle <主题> [星名]",
			"  oracle career          # 事业主题 14 主星概览",
			"  oracle career 七杀      # 七杀的事业分类断语全展开",
		].join("\n");
	}

	const topic = parseTopic(pos);
	const oracle = await loadTopicOracle(topic);

	// 单主题概览：14 主星 ×（格局数 / 断语行数）
	if (pos.length === 1) {
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
			`【断语手册 · ${TOPIC_LABEL[topic]}】十四主星概览（查单星：oracle ${topic} <星名>）`,
			"",
			...rows,
			"",
			...FOOTER,
		].join("\n");
	}

	// 单星全展开
	const star = pos[1];
	const o = oracle[star];
	if (!o) throw new Error(`断语手册未收录「${star}」。已收录：${Object.keys(oracle).join("、")}`);
	return [`【断语手册 · ${TOPIC_LABEL[topic]}】`, "", ...renderStar(star, o), "", ...FOOTER].join(
		"\n"
	);
}
