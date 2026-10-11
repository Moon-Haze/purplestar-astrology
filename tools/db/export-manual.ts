/**
 * 手册导出工具（tools/db）—— 从样本库（db/ziwei.duckdb 或 dataset/ parquet）
 * 导出可归档的资料产物到 docs/manual/：
 *
 *   npx tsx tools/db/export-manual.ts topics   # 4 号：13 主题 × 十四主星断语全集（md）
 *   npx tsx tools/db/export-manual.ts combo    # 5 号：主星 × 辅煞同宫频率全表（md）
 *   npx tsx tools/db/export-manual.ts geju     # 格局名目对拍（db 渲染集 vs patterns 现库）
 *   npx tsx tools/db/export-manual.ts code     # 手册整理成 TS 数据，落 scripts/ziwei/analysis/manual/
 *   npx tsx tools/db/export-manual.ts all      # 以上全部
 *
 * 数据血缘（重要）：库里的主题文本是**本仓 analysis 内核在 518,400 个设计样本上的
 * 预计算产物**（`npm run build:db`），不是独立内容源 —— 本工具只做**导出与对拍**，
 * 不产新断语。断语的修订一律改内核（scripts/ziwei/analysis/），再重建库、再导出。
 *
 * 宫名口径：库内列值与 `./data` 散表同为紧凑口径（不带「宫」字、「仆役」），
 * 内核侧 `Palace.name` 是项目口径（带「宫」字）—— 本工具内的 `compactPalaceKey`
 * 负责这一处归一。
 *
 * 输出目录：docs/manual/（topics/ 子目录 + 两个独立 md）。只读库（spec §6），不落 SQL
 * 用户输入（全部固定字面量，与 query.ts 同纪律）。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DuckDBConnection } from "@duckdb/node-api";

import { resolveQueryTarget } from "./db";
import { TOPIC_KEYS, type TopicKey } from "../../scripts/ziwei/analysis/data";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/db
const SKILL_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(SKILL_ROOT, "docs/manual");
const TOPICS_DIR = join(OUT_DIR, "topics");

// 内核 patterns / 排盘模块 —— 相对导入，tools/ 不走 @/ 别名
const { generateChart } = await import("../../scripts/ziwei/algorithm");
const patterns = await import("../../scripts/ziwei/patterns/index");

/**
 * 项目口径宫名（`Palace.name`，带「宫」字）→ 库内紧凑键。
 * 库内列值（palace_name 等）与 `./data` 散表同为紧凑口径（不带「宫」字、「仆役」），
 * 本工具在「项目口径主题主宫 → 库内值」这一处需要归一 —— 12 宫显式映射，未知原样返回。
 */
const COMPACT_PALACE_KEY: Record<string, string> = {
	命宫: "命宫",
	兄弟宫: "兄弟",
	夫妻宫: "夫妻",
	子女宫: "子女",
	财帛宫: "财帛",
	疾厄宫: "疾厄",
	迁移宫: "迁移",
	交友宫: "仆役",
	官禄宫: "官禄",
	田宅宫: "田宅",
	福德宫: "福德",
	父母宫: "父母",
};
const compactPalaceKey = (palaceName: string): string =>
	COMPACT_PALACE_KEY[palaceName] ?? palaceName;

// 主题 → 紧凑口径主宫名（库内 palace_name 值域）
const TOPIC_PALACE_COMPACT: Record<TopicKey, string> = {
	overview: "命宫",
	personality: "命宫",
	love: "夫妻",
	career: "官禄",
	wealth: "财帛",
	health: "疾厄",
	family: "兄弟",
	children: "子女",
	move: "迁移",
	friends: "仆役",
	home: "田宅",
	spirit: "福德",
	parents: "父母",
};

/** 主题文本的静态节白名单/黑名单 —— 按节截取，动态节（大限/流年/流月）与交互尾巴不进手册。 */
const DYNAMIC_SECTION_RE = /当前大限|流年|流月|综合建议|继续深度追问/;
const SECTION_HEAD_RE = /^\*\*【(.+?)】\*\*$/;

/** 一条主题文本 → 静态节行数组（保首现序）。
 *
 * ▍ 结构行**保留**：`classifyOracle` 需要它做三方四正的宫位结构头（palace 取标签
 * 末段=真实宫名，旧库错位标签前缀自然丢弃）；md 渲染端（`exportTopics`）自行滤掉。
 */
function staticLines(text: string): string[] {
	const out: string[] = [];
	let keep = false;
	for (const line of text.split("\n")) {
		const head = line.match(SECTION_HEAD_RE);
		if (head) {
			keep = !DYNAMIC_SECTION_RE.test(head[1]);
			if (keep) out.push(line);
			continue;
		}
		if (keep && line.trim() !== "") out.push(line);
	}
	return out;
}

// ── 断语分类（code 模式）：把扁平行流解析成按情况归类的嵌套结构 ────────────────────

/** 三方四正的一个宫位条目：▍ 头（宫名 + 星曜概览变体）+ 其后的断语行（语境段落/简述/次星）。 */
export interface SanFangEntry {
	palace: string;
	/** 该宫跨盘的星曜概览变体（去重；「破军（庙旺）」/「破军」/「空宫借对宫」等） */
	stars: string[];
	items: string[];
}

/** 一条本命四化：主行（emoji 后的原文）+ 缩进说明（跨盘变体以换行合并）。 */
export interface SihuaEntry {
	text: string;
	note?: string;
}

/** 一个主星在某个主题下的分类断语集。字段序即渲染序（custom → summary → …）。 */
export interface OracleStar {
	/** 【命盘关键定制】—— 亮度/化曜的专属开场 */
	mods: string[];
	/** 【星曜深层特质】—— 第二人称白话总述 */
	summary: string[];
	/** ⭐ 特殊格局（同名格局跨盘变体已合并 text） */
	patterns: { name: string; text: string }[];
	/** 【命盘推演】—— 本宫主星行（多盘亮度变体，去重）+ 语境段落/亮度补充/同宫第二主星 */
	mainPalace: { stars: string[]; content: string[] };
	/** 【三方四正联动】—— 按宫位聚合（palace 取标签末段，即真实宫名；跨盘变体并入同条目） */
	sanFang: SanFangEntry[];
	/** 四化行（本命四化会照 + 年干关键宫位两节），缩进说明归 note */
	sihua: SihuaEntry[];
	/** 【贵人倾向·魁钺细分】—— ◇ 行原文（去前缀） */
	kuiYue: string[];
	/** 主题专属节（性格深描 / 疾厄取象 / 女命妇科保养 …）—— 节名 → 行 */
	extras: Record<string, string[]>;
	/** 未归类兜底（正常应为空；非空说明渲染层新形态未被分类器认识，须排查） */
	other: string[];
}

/**
 * 把「行 → 首现节名」的有序映射解析成分类断语集（三方四正节已由 {@link collectTopic}
 * 盘内解析并经 `sanFang` 聚合传入，此处的行流不含该节）。
 *
 * 状态机只做两件事：行模式识别（⭐/四化/本宫主星/◇/缩进）优先，其余按节名分派。
 * 节内行保首现序；四化 note 变体换行合并。
 */
function classifyOracle(
	lines: Map<string, string>,
	sanFang: Map<string, { stars: Set<string>; items: Set<string> }>
): OracleStar {
	const oracle = {
		mods: [] as string[],
		summary: [] as string[],
		patterns: [] as { name: string; text: string }[],
		mainPalace: { stars: [] as string[], content: [] as string[] },
		sihua: [] as SihuaEntry[],
		kuiYue: [] as string[],
		extras: new Map<string, string[]>(),
		other: [] as string[],
	};
	let lastSihua: SihuaEntry | null = null;
	const uniq = (arr: string[], line: string): void => {
		if (!arr.includes(line)) arr.push(line);
	};

	for (const [line, section] of lines) {
		const indent = line.match(/^\s+(.*)/);
		const body = indent ? indent[1] : line;

		// 缩进行：四化节的 note（同主行多变体换行合并）
		if (indent) {
			if ((section === "本命四化会照" || section === "年干四化·关键宫位影响") && lastSihua) {
				lastSihua.note =
					lastSihua.note === undefined
						? body
						: lastSihua.note.includes(body)
							? lastSihua.note
							: `${lastSihua.note}\n${body}`;
			} else {
				uniq(oracle.other, line);
			}
			continue;
		}

		let m: RegExpMatchArray | null;
		// ⭐ 格局：同名跨盘变体合并（追加判词）
		if ((m = line.match(/^⭐ \*\*(.+?)\*\*[：:](.*)$/))) {
			const found = oracle.patterns.find(p => p.name === m![1]);
			if (found) {
				if (m[2] && !found.text.includes(m[2])) found.text += `\n${m[2]}`;
			} else {
				oracle.patterns.push({ name: m[1], text: m[2] });
			}
			continue;
		}
		// 四化主行（本命四化节与年干节同构：emoji + **星化X**（落宫）[→ 意义]）
		if (/^[🔴🟡🔵🟢]/.test(line)) {
			const existing = oracle.sihua.find(s => s.text === body);
			lastSihua = existing ?? { text: body };
			if (!existing) oracle.sihua.push(lastSihua);
			continue;
		}
		if (line.startsWith("本宫主星")) {
			uniq(oracle.mainPalace.stars, body);
			continue;
		}
		if (line.startsWith("◇")) {
			uniq(oracle.kuiYue, body);
			continue;
		}

		// 节驱动的普通段落
		if (section === "命盘关键定制") uniq(oracle.mods, line);
		else if (section === "星曜深层特质") uniq(oracle.summary, line);
		else if (section === "命盘推演") uniq(oracle.mainPalace.content, line);
		else if (section === "本命四化会照" || section === "年干四化·关键宫位影响") {
			lastSihua = { text: line };
			oracle.sihua.push(lastSihua);
		} else if (section !== "") {
			if (!oracle.extras.has(section)) oracle.extras.set(section, []);
			uniq(oracle.extras.get(section)!, line);
		} else {
			uniq(oracle.other, line);
		}
	}

	return {
		mods: oracle.mods,
		summary: oracle.summary,
		patterns: oracle.patterns,
		mainPalace: oracle.mainPalace,
		sanFang: [...sanFang.entries()].map(([palace, { stars, items }]) => ({
			palace,
			stars: [...stars],
			items: [...items],
		})),
		sihua: oracle.sihua,
		kuiYue: oracle.kuiYue,
		extras: Object.fromEntries(oracle.extras),
		other: oracle.other,
	};
}

/** 收集一个主题的断语：star → (行 → 首现节名，按首现序) + star → 样本盘数。
 *
 * 行文本决定节归属（渲染是确定的：「本宫主星：X」永远在推演节），故**跨盘去重**
 * 时记下首现节名，后续盘的同文本变体行天然继承该节。
 *
 * 例外是**三方四正节**：✦ 次星与缩进简述不带宫信息，同文本行在不同盘可能属于不同
 * 宫 —— 行级去重会把宫归属搞错。故三方节在**盘内**解析（▍ 头与后续行的配对在单盘
 * 内是精确的），跨盘聚合到 `sanFangByStar`；行级收集跳过该节。
 */
async function collectTopic(
	conn: DuckDBConnection,
	topic: TopicKey
): Promise<{
	byStar: Map<string, Map<string, string>>;
	sanFangByStar: Map<string, Map<string, { stars: Set<string>; items: Set<string> }>>;
	starSamples: Map<string, number>;
}> {
	const palace = TOPIC_PALACE_COMPACT[topic];
	// 主星取该主题主宫的首颗主星（major_stars[1]，DuckDB 列表 1-based）；空宫（空列表）不计
	const sql = `SELECT major_stars[1] AS star, ${topic} AS text
FROM topics JOIN palaces USING (sample_id)
WHERE palace_name = '${palace}' AND len(major_stars) > 0`;
	const result = await conn.run(sql);
	const rows = (await result.getRowObjectsJS()) as Array<{ star: string; text: string }>;

	const byStar = new Map<string, Map<string, string>>();
	const sanFangByStar = new Map<
		string,
		Map<string, { stars: Set<string>; items: Set<string> }>
	>();
	const starSamples = new Map<string, number>();
	for (const r of rows) {
		starSamples.set(r.star, (starSamples.get(r.star) ?? 0) + 1);
		if (!byStar.has(r.star)) {
			byStar.set(r.star, new Map());
			sanFangByStar.set(r.star, new Map());
		}
		const lines = byStar.get(r.star)!;
		const sanFang = sanFangByStar.get(r.star)!;

		let section = "";
		let currentPalace: string | null = null;
		for (const l of staticLines(r.text)) {
			const head = l.match(SECTION_HEAD_RE);
			if (head) {
				section = head[1];
				currentPalace = null;
				continue;
			}
			// 三方节：盘内解析 ▍ 配对（宫归属只在单盘内精确）
			if (section === "三方四正联动") {
				const bar = l.match(/^▍\*\*(.+?)\*\*[：:](.*)$/);
				if (bar) {
					currentPalace = bar[1].includes("·")
						? bar[1].split("·").pop()!.trim()
						: bar[1].trim();
					const entry = sanFang.get(currentPalace) ?? {
						stars: new Set<string>(),
						items: new Set<string>(),
					};
					sanFang.set(currentPalace, entry);
					if (bar[2]) entry.stars.add(bar[2]);
					continue;
				}
				const kui = l.match(/^✦ \*\*(.+?)\*\*[：:](.*)$/);
				const body = l.replace(/^\s+/, "");
				if (!currentPalace) continue;
				const entry = sanFang.get(currentPalace)!;
				entry.items.add(kui ? `✦ ${kui[1]}：${kui[2]}` : body);
				continue;
			}
			if (!lines.has(l)) lines.set(l, section);
		}
	}
	return { byStar, sanFangByStar, starSamples };
}

async function exportTopics(conn: DuckDBConnection): Promise<void> {
	mkdirSync(TOPICS_DIR, { recursive: true });
	for (const topic of TOPIC_KEYS) {
		const { byStar, sanFangByStar, starSamples } = await collectTopic(conn, topic);

		const head = [
			`# ${topic} · 断语全集（十四主星）`,
			"",
			"> 自动生成自样本库（518,400 设计样本 × 本仓 analysis 内核）——只导出静态节",
			">（当前大限 / 流年 / 流月等动态节不进册）。每节一行不重复、按首现序，",
			"> 标注该主星在主宫的样本盘数。生成：`npx tsx tools/db/export-manual.ts topics`。",
			"> 修订断语请改内核 `scripts/ziwei/analysis/` 后重建库再导出，不要改本文件。",
			"",
		];
		const body: string[] = [];
		for (const [star, lines] of [...byStar.entries()].sort()) {
			body.push(
				`## ${star}（${(starSamples.get(star) ?? 0).toLocaleString("en-US")} 盘）`,
				""
			);
			// md 保持扁平可读版：节头行（分类用）在这里滤掉
			for (const line of lines.keys()) {
				if (SECTION_HEAD_RE.test(line)) continue;
				body.push(line, "");
			}
			// 三方四正（盘内已解析聚合）：按宫展开成「▍宫名：星曜概览 + 断语行」
			for (const [palace, { stars, items }] of sanFangByStar.get(star) ?? []) {
				body.push(`▍**${palace}**：${[...stars].join("、")}`, "");
				for (const it of items) body.push(it, "");
			}
		}
		writeFileSync(join(TOPICS_DIR, `${topic}.md`), [...head, ...body].join("\n"));
		console.error(
			`topics/${topic}.md：${byStar.size} 星 × 共 ${[...byStar.values()].reduce((n, m) => n + m.size, 0)} 行`
		);
	}
}

/** 196 组合频率行（md 与 ts 两种渲染共用的收集层）。 */
async function collectCombo(
	conn: DuckDBConnection
): Promise<Array<{ star: string; aux: string; cnt: number }>> {
	const sql = `SELECT s.star, a.aux, COUNT(*)::INT AS cnt
FROM (SELECT sample_id, palace_name, UNNEST(major_stars) AS star FROM palaces) s
JOIN (SELECT sample_id, palace_name, UNNEST(list_concat(lucky_stars, sha_stars)) AS aux FROM palaces) a
  ON s.sample_id = a.sample_id AND s.palace_name = a.palace_name
GROUP BY 1, 2 ORDER BY 1, 3 DESC`;
	return (await (await conn.run(sql)).getRowObjectsJS()) as Array<{
		star: string;
		aux: string;
		cnt: number;
	}>;
}

async function exportCombo(conn: DuckDBConnection): Promise<void> {
	mkdirSync(OUT_DIR, { recursive: true });
	const rows = await collectCombo(conn);
	const stars = [...new Set(rows.map(r => r.star))].sort();
	const auxes = [...new Set(rows.map(r => r.aux))];
	const cell = new Map(rows.map(r => [`${r.star}|${r.aux}`, r.cnt] as const));
	const total = rows.length ? Math.max(...rows.map(r => r.cnt)) : 0;

	const md = [
		"# 主星 × 辅煞 同宫频率全表",
		"",
		"> 518,400 设计样本 × 12 宫 = 6,220,800 宫次；辅煞口径 = 六吉 + 禄存天马（lucky_stars）",
		"> + 六煞（擎羊陀罗火星铃星地空地劫，sha_stars）。单元格 = 同宫样本盘数。",
		"> 用途：主辅煞组合断语矩阵的**口径与完备性基线** —— 表中每个组合在库内都有",
		"> 万级样本文本兜底，矩阵条目无冷门。生成：`npx tsx tools/db/export-manual.ts combo`。",
		"",
		`| 主星 | ${auxes.join(" | ")} |`,
		`| --- | ${auxes.map(() => "---").join(" | ")} |`,
		...stars.map(
			s =>
				`| ${s} | ${auxes.map(a => (cell.get(`${s}|${a}`) ?? 0).toLocaleString("en-US")).join(" | ")} |`
		),
		"",
		`全表 ${stars.length} 主星 × ${auxes.length} 辅煞 = ${rows.length} 组合，单格最大 ${total.toLocaleString("en-US")} 盘。`,
	];
	writeFileSync(join(OUT_DIR, "combo-frequency.md"), md.join("\n") + "\n");
	console.error(`combo-frequency.md：${rows.length} 组合`);
}

/** 生成 TS 数据文件的输出目录（内核域内 scripts/ziwei/analysis/manual）——**生成快照，不在 analysis/index.ts 公开面**（按需懒加载，不碰 CLI 启动）；引文守卫对它语义化排除（内容是内核表的渲染镜像）。 */
const CODE_DIR = resolve(SKILL_ROOT, "scripts/ziwei/analysis/manual");

/** 生成 TS 字符串字面量：JSON.stringify 的双引号形态即合法 TS 字面量（转义齐全）。 */
const lit = (s: string): string => JSON.stringify(s);

/**
 * `code` 子命令：把手册内容**解析分类**成 TS 数据文件合并进代码（scripts/ziwei/analysis/manual/）。
 *
 * 形态：每主题一个文件（`<topic>.ts`，`ORACLE: Record<主星, OracleStar>`——按
 * 定制/总述/格局/本宫/三方/四化/贵人/专属节归类，见 {@link OracleStar}）+ 组合频率 +
 * 懒加载索引。生成物带 DO-NOT-EDIT 头与生成命令；文档版（docs/manual/）继续并存 ——
 * md 供人读（扁平），ts 供代码查询（结构化）。
 */
async function exportCode(conn: DuckDBConnection): Promise<void> {
	mkdirSync(CODE_DIR, { recursive: true });

	// 共享类型文件（主题文件 import type，避免 index 与主题文件循环依赖）
	const typeLines = [
		"/**",
		" * ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。",
		" * 结构定义与 `tools/db/export-manual.ts` 的 classifyOracle 对应：",
		" * 字段序即渲染序，各数组内行保首现序去重（跨盘变体保留）。",
		" */",
		`export interface SanFangEntry {`,
		`\t/** ▍ 标签最后一个「·」之后的段（真实宫名；旧库错位标签前缀已丢弃） */`,
		`\tpalace: string;`,
		`\t/** 该宫跨盘的星曜概览变体（去重：「破军（庙旺)」/「破军」/「空宫借对宫」等） */`,
		`\tstars: string[];`,
		`\t/** 该宫断语：语境段落 / 缩进简述 / 借宫提示 / ✦ 次星（原行） */`,
		`\titems: string[];`,
		`}`,
		`export interface SihuaEntry {`,
		`\t/** 四化主行（emoji 后的原文，含星名/落宫；年干节行带「→ 意义」尾巴） */`,
		`\ttext: string;`,
		`\t/** 主行下的缩进说明（同星同化的语义补充） */`,
		`\tnote?: string;`,
		`}`,
		`export interface OracleStar {`,
		`\t/** 【命盘关键定制】亮度/化曜专属开场 */`,
		`\tmods: string[];`,
		`\t/** 【星曜深层特质】第二人称白话总述 */`,
		`\tsummary: string[];`,
		`\t/** ⭐ 特殊格局（同名格局跨盘判词变体已换行合并） */`,
		`\tpatterns: { name: string; text: string }[];`,
		`\t/** 【命盘推演】本宫主星行（多盘亮度变体）+ 宫语境段落 / ▶ 亮度补充 / 同宫第二主星 */`,
		`\tmainPalace: { stars: string[]; content: string[] };`,
		`\t/** 【三方四正联动】按宫聚合 */`,
		`\tsanFang: SanFangEntry[];`,
		`\t/** 四化（本命四化会照 + 年干关键宫位两节） */`,
		`\tsihua: SihuaEntry[];`,
		`\t/** 【贵人倾向·魁钺细分】◇ 行原文（去前缀） */`,
		`\tkuiYue: string[];`,
		`\t/** 主题专属节（性格深描 / 疾厄取象 / 女命妇科保养 …）—— 节名 → 行 */`,
		`\textras: Record<string, string[]>;`,
		`\t/** 未归类兜底（正常为空；非空 = 渲染层出现分类器不认识的新形态，须排查） */`,
		`\tother: string[];`,
		`}`,
	];
	writeFileSync(join(CODE_DIR, "types.ts"), typeLines.join("\n"));

	for (const topic of TOPIC_KEYS) {
		const { byStar, sanFangByStar } = await collectTopic(conn, topic);
		const lines: string[] = [
			"/**",
			" * ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。",
			` * 源：样本库 518,400 设计样本 × analysis 内核（${topic} 主题静态节，动态节不进数据）。`,
			" * 断语修订：改内核 `scripts/ziwei/analysis/` → `npm run build:db` → 重导本目录。",
			" * 查询入口：`analysis/manual/index.ts`（按主题懒加载，不在 CLI 主 import 链上）。",
			" */",
			`import type { OracleStar } from "./types.ts";`,
			"",
			`export const ORACLE: Readonly<Record<string, OracleStar>> = {`,
		];
		for (const [star, ls] of [...byStar.entries()].sort()) {
			const o = classifyOracle(ls, sanFangByStar.get(star)!);
			lines.push(`\t${lit(star)}: {`);
			lines.push(`\t\tmods: [${o.mods.map(lit).join(", ")}],`);
			lines.push(`\t\tsummary: [`);
			for (const l of o.summary) lines.push(`\t\t\t${lit(l)},`);
			lines.push(`\t\t],`);
			lines.push(`\t\tpatterns: [`);
			for (const p of o.patterns)
				lines.push(`\t\t\t{ name: ${lit(p.name)}, text: ${lit(p.text)} },`);
			lines.push(`\t\t],`);
			lines.push(`\t\tmainPalace: {`);
			lines.push(`\t\t\tstars: [${o.mainPalace.stars.map(lit).join(", ")}],`);
			lines.push(`\t\t\tcontent: [`);
			for (const l of o.mainPalace.content) lines.push(`\t\t\t\t${lit(l)},`);
			lines.push(`\t\t\t],`);
			lines.push(`\t\t},`);
			lines.push(`\t\tsanFang: [`);
			for (const sf of o.sanFang) {
				lines.push(
					`\t\t\t{ palace: ${lit(sf.palace)}, stars: [${sf.stars.map(lit).join(", ")}], items: [`
				);
				for (const it of sf.items) lines.push(`\t\t\t\t${lit(it)},`);
				lines.push(`\t\t\t] },`);
			}
			lines.push(`\t\t],`);
			lines.push(`\t\tsihua: [`);
			for (const s of o.sihua)
				lines.push(
					`\t\t\t{ text: ${lit(s.text)}${s.note !== undefined ? `, note: ${lit(s.note)}` : ""} },`
				);
			lines.push(`\t\t],`);
			lines.push(`\t\tkuiYue: [${o.kuiYue.map(lit).join(", ")}],`);
			const extraKeys = Object.keys(o.extras);
			if (extraKeys.length === 0) {
				lines.push(`\t\textras: {},`);
			} else {
				lines.push(`\t\textras: {`);
				for (const k of extraKeys) {
					lines.push(`\t\t\t${lit(k)}: [`);
					for (const l of o.extras[k]) lines.push(`\t\t\t\t${lit(l)},`);
					lines.push(`\t\t\t],`);
				}
				lines.push(`\t\t},`);
			}
			lines.push(`\t\tother: [${o.other.map(lit).join(", ")}],`);
			lines.push(`\t},`);
		}
		lines.push(`};`, "");
		writeFileSync(join(CODE_DIR, `${topic}.ts`), lines.join("\n"));
	}

	// 组合频率数据
	const combo = await collectCombo(conn);
	const comboLines = [
		"/**",
		" * ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。",
		" * 主星 × 辅煞同宫频率（196 组合，518,400 设计样本 × 12 宫）。",
		" * 用途：主辅煞组合断语矩阵的口径与完备性基线（每个组合都有万级样本兜底）。",
		" */",
		`export interface ComboFrequency {`,
		`\tstar: string;`,
		`\taux: string;`,
		`\tcount: number;`,
		`}`,
		`export const COMBO_FREQUENCY: readonly ComboFrequency[] = [`,
		...combo.map(r => `\t{ star: ${lit(r.star)}, aux: ${lit(r.aux)}, count: ${r.cnt} },`),
		`];`,
		"",
	];
	writeFileSync(join(CODE_DIR, "combo-frequency.ts"), comboLines.join("\n"));

	// 懒加载索引：显式 13 行映射（动态模板 import 在类型层拿不到形状）
	const indexLines = [
		"/**",
		" * 断语手册数据（analysis/manual/）的查询入口 —— 按主题懒加载。",
		" *",
		" * ⚠️ 本目录是**生成数据**（内核域 analysis/manual，不在 analysis/index.ts 公开面）：CLI 主链路不",
		" * import 这些文件（零启动开销），需要消费时经本入口动态引入。",
		" *",
		" * ⚠️ 生成文件 —— 由 `npx tsx tools/db/export-manual.ts code` 生成，**不要手改**。",
		" */",
		`import type { TopicKey } from "../data";`,
		`import type { OracleStar } from "./types.ts";`,
		"",
		`export type { OracleStar, SanFangEntry, SihuaEntry } from "./types.ts";`,
		`/** 一个主题的断语全集：主星 → 分类断语集（mods/summary/patterns/mainPalace/sanFang/…）。 */`,
		`export type StarTopicOracle = Readonly<Record<string, OracleStar>>;`,
		`export type { ComboFrequency } from "./combo-frequency.ts";`,
		`export { COMBO_FREQUENCY } from "./combo-frequency.ts";`,
		"",
		`const LOADERS: Record<TopicKey, () => Promise<{ ORACLE: StarTopicOracle }>> = {`,
		...TOPIC_KEYS.map(k => `\t${k}: () => import("./${k}.ts"),`),
		`};`,
		"",
		`/** 加载一个主题的断语全集；文件缺失（未导出）时抛带指引的错误。 */`,
		`export async function loadTopicOracle(topic: TopicKey): Promise<StarTopicOracle> {`,
		`\ttry {`,
		`\t\treturn (await LOADERS[topic]()).ORACLE;`,
		`\t} catch (e) {`,
		`\t\tthrow new Error(`,
		`\t\t\t\`断语数据 \${topic} 未生成。先 npx tsx tools/db/export-manual.ts code（前置：npm run build:db）。\` +`,
		`\t\t\t\t\` 原始错误：\${e instanceof Error ? e.message : String(e)}\`,`,
		`\t\t);`,
		`\t}`,
		`}`,
		"",
	];
	writeFileSync(join(CODE_DIR, "index.ts"), indexLines.join("\n"));

	console.error(
		`analysis/manual/：${TOPIC_KEYS.length} 主题数据 + combo-frequency + index（${combo.length} 组合）`
	);
}

/** 格局名目对拍：db 渲染集（⭐ 行）vs patterns 现库（多样本实测产出全集）。 */
async function auditGeju(conn: DuckDBConnection): Promise<void> {
	// db 侧：⭐ 行 → 名目
	const sql = `WITH l AS (${TOPIC_KEYS.map(k => `SELECT unnest(string_split(${k}, chr(10))) AS line FROM topics`).join(" UNION ALL ")})
SELECT DISTINCT line FROM l WHERE line LIKE '⭐%'`;
	const rows = (await (await conn.run(sql)).getRowObjectsJS()) as Array<{ line: string }>;
	const dbNameToLine = new Map<string, string>();
	for (const r of rows) {
		const m = r.line.match(/⭐ \*\*(.+?)\*\*/);
		if (m) dbNameToLine.set(m[1], r.line);
	}

	// patterns 侧：抽样 2000 盘实测 detectPatterns 全名目（跳过非法公历日期）
	const sampleSql = `SELECT year, month, day, hour, gender, longitude FROM samples WHERE sample_id % 259 = 0 LIMIT 2000`;
	const samples = (await (await conn.run(sampleSql)).getRowObjectsJS()) as Array<{
		year: number;
		month: number;
		day: number;
		hour: number;
		gender: string;
		longitude: number | null;
	}>;
	const produced = new Map<string, number>();
	let ok = 0;
	for (const s of samples) {
		let chart;
		try {
			chart = generateChart({
				year: Number(s.year),
				month: Number(s.month),
				day: Number(s.day),
				timeIndex: Number(s.hour),
				gender: s.gender === "female" ? "female" : "male",
				longitude: s.longitude == null ? 120 : Number(s.longitude),
			});
		} catch {
			continue;
		}
		ok++;
		for (const p of patterns.detectPatterns(chart))
			produced.set(p.name, (produced.get(p.name) ?? 0) + 1);
	}

	// 归一比对：去「格」字与括号注记；「守命→入命」按别名表裁决口径
	const norm = (s: string) =>
		s
			.replace(/格$/, "")
			.replace(/（.*?）/g, "")
			.replace(/守命/, "入命");
	const patNames = [...produced.keys()];
	const normPool = patNames.map(n => norm(n));
	const dbUnmatched: string[] = [];
	const patUnmatched: string[] = [];
	for (const n of dbNameToLine.keys()) if (!normPool.includes(norm(n))) dbUnmatched.push(n);
	for (const p of patNames)
		if (![...dbNameToLine.keys()].some(n => norm(n) === norm(p))) patUnmatched.push(p);

	const md = [
		"# 格局名目对拍（db 渲染集 vs patterns 现库）",
		"",
		`> 对拍样本：patterns 侧抽样 ${ok.toLocaleString("en-US")} 盘实测 \`detectPatterns\` 全名目；`,
		"> db 侧为 51.84 万盘 topic 输出实际渲染过的 ⭐ 行。归一规则：去「格」后缀与括号注记，",
		"> 「守命」按 `GEJU_NAME_ALIASES` 的古籍词频裁决统一为「入命」。",
		"> 生成：`npx tsx tools/db/export-manual.ts geju`。",
		"",
		`## 结论`,
		"",
		`- patterns 现库：${patNames.length} 名目（抽样全命中，即全部名目均可产出）`,
		`- db 渲染集：${dbNameToLine.size} 名目`,
		`- db 有而现库命名对不上：${dbUnmatched.length} 个（旧命名遗留，以现库为准）`,
		`- 现库有而 db 从不渲染：${patUnmatched.length} 个（db 建库后新增名目 / 未填 topicDescription）`,
		"",
		"## 现库有而 db 从不渲染（补判词/口径升级时的候选清单）",
		"",
		...patUnmatched
			.sort()
			.map(
				n =>
					`- **${n}**（抽样 ${ok.toLocaleString("en-US")} 盘中命中 ${produced.get(n)} 次）`
			),
		"",
		"## db 有而现库命名对不上（旧命名，不回收）",
		"",
		...dbUnmatched.sort().map(n => `- ${n}`),
	];
	writeFileSync(join(OUT_DIR, "geju-audit.md"), md.join("\n") + "\n");
	console.error(
		`geju-audit.md：现库 ${patNames.length} 名目，db ${dbNameToLine.size} 名目，差集 ${patUnmatched.length}/${dbUnmatched.length}`
	);
}

async function main() {
	const outDir = process.argv.includes("--out")
		? resolve(process.argv[process.argv.indexOf("--out") + 1])
		: join(SKILL_ROOT, "db");
	const target = resolveQueryTarget(outDir);
	if (target.kind === "none") {
		console.error(`既无库也无 dataset（--out ${outDir}）。先 npm run build:db。`);
		process.exitCode = 2;
		return;
	}
	const { openReadOnly, openDataset } = await import("./db");
	const conn =
		target.kind === "db"
			? await openReadOnly(target.dbPath)
			: await openDataset(target.datasetDir);
	try {
		const cmd = process.argv[2] ?? "all";
		if (cmd === "topics" || cmd === "all") await exportTopics(conn);
		if (cmd === "combo" || cmd === "all") await exportCombo(conn);
		if (cmd === "geju" || cmd === "all") await auditGeju(conn);
		if (cmd === "code" || cmd === "all") await exportCode(conn);
		if (!["topics", "combo", "geju", "code", "all"].includes(cmd)) {
			console.error(`未知子命令「${cmd}」：topics / combo / geju / code / all`);
			process.exitCode = 2;
		}
	} finally {
		conn.closeSync();
	}
}

main().catch(e => {
	console.error(e instanceof Error ? e.message : String(e));
	process.exitCode = 1;
});
