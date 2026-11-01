/**
 * 手册导出工具（tools/db）—— 从样本库（db/ziwei.duckdb 或 dataset/ parquet）
 * 导出可归档的资料产物到 docs/manual/：
 *
 *   npx tsx tools/db/export-manual.ts topics   # 4 号：13 主题 × 十四主星断语全集（md）
 *   npx tsx tools/db/export-manual.ts combo    # 5 号：主星 × 辅煞同宫频率全表（md）
 *   npx tsx tools/db/export-manual.ts geju     # 格局名目对拍（db 渲染集 vs patterns 现库）
 *   npx tsx tools/db/export-manual.ts db       # 手册物化为 SQLite 只读库（scripts/corpus/data/manual/oracle.db，
 *                                              #   行级规范化 + 字节可复现，运行时经 node:sqlite 查询）
 *   npx tsx tools/db/export-manual.ts all      # 以上全部
 *   npx tsx tools/db/export-manual.ts --check  # 漂移探针：内存重导对拍已提交产物，脏则非零退出
 *
 * 数据血缘（重要）：库里的主题文本是**本仓 analysis 内核在 518,400 个设计样本上的
 * 预计算产物**（`npm run build:db`），不是独立内容源 —— 本工具只做**导出与对拍**，
 * 不产新断语。断语的修订一律改内核（scripts/analysis/），再重建库、再导出。
 *
 * 漂移探针（--check，npm run manual:check）：生成物与「当前内核表 + 当前导出工具」
 * 的一致性守卫 —— 内核或工具改了而生成物未重导时非零退出报警（差异文件清单 + 每文件
 * 前 5 处差异行；盘上多出的孤儿生成物同样算漂移）。缺 db/dataset 或 DuckDB 依赖时
 * 显式 ⏭ 跳过（零退出，跳过必须可见），不进 npm test 日常回归（重导对拍耗时数十秒）。
 *
 * 宫名口径：库内列值与 `./data` 散表同为紧凑口径（不带「宫」字、「仆役」），
 * 内核侧 `Palace.name` 是项目口径（带「宫」字）—— 本工具内的 `compactPalaceKey`
 * 负责这一处归一。
 *
 * 输出目录：docs/manual/（topics/ 子目录 + 两个独立 md）。只读库（spec §6），不落 SQL
 * 用户输入（全部固定字面量，与 query.ts 同纪律）。
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DuckDBConnection } from "@duckdb/node-api";

import { resolveQueryTarget } from "./db";
import { compactPalaceKey } from "../../scripts/data/ganzhi";
import { findViolations } from "../../scripts/corpus/citation-core";
import {
	TOPIC_KEYS,
	TOPIC_DEFS,
	TOPIC_CONTENT_SOURCE,
	STORAGE_TOPIC_KEYS,
	type TopicKey,
} from "../../scripts/analysis/data";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/db
const SKILL_ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(SKILL_ROOT, "docs/manual");
const TOPICS_DIR = join(OUT_DIR, "topics");

// ── 落点双形态：写盘（默认）或收进内存（--check 对拍）──
// 产出函数只调 emit/ensureDir，「生成什么」与「落到哪」分离 —— check 模式因此跑的是
// 与真重导**同一份产出代码**，不引入第二套对拍实现（manual-drift-guard D1）。
const CHECK_MODE = process.argv.includes("--check");
/** check 模式的内存产物：绝对路径 → 内容（与 writeFileSync 收到的字符串逐字同源）。 */
const collected = new Map<string, string>();

/** 落一个生成物：写盘，或（--check）收进内存待对拍。 */
function emit(absPath: string, content: string): void {
	if (CHECK_MODE) {
		collected.set(absPath, content);
		return;
	}
	writeFileSync(absPath, content);
}

/** 建目录：写盘模式创建，check 模式跳过（不触碰磁盘）。 */
function ensureDir(absPath: string): void {
	if (!CHECK_MODE) {
		mkdirSync(absPath, { recursive: true });
	}
}

// 内核 patterns / 排盘模块 —— 相对导入，tools/ 不走 @/ 别名
const { generateChart } = await import("../../scripts/algorithm");
const patterns = await import("../../scripts/patterns/index");

// 宫名归一（项目口径 → 库内紧凑键）的表与函数住内核 scripts/data/ganzhi.ts
// （COMPACT_PALACE_KEY / compactPalaceKey），此处只引用 —— 见其注释的口径论证。

// 主题 → 紧凑口径主宫名（库内 palace_name 值域）。由 TOPIC_DEFS[topic].palace（项目口径）
// 经 compactPalaceKey 归一**派生**，不再手抄 —— 与 Phase 2 的单一真相源同一纪律：
// 加主题只改 TOPIC_DEFS 一处，此表自动跟上。
const TOPIC_PALACE_COMPACT: Record<TopicKey, string> = Object.fromEntries(
	TOPIC_KEYS.map(t => [t, compactPalaceKey(TOPIC_DEFS[t].palace)])
) as Record<TopicKey, string>;

/** 主题文本的静态节白名单/黑名单 —— 按节截取，动态节（大限/流年/流月）与交互尾巴不进手册。
 *
 * 黑名单的盘面定制四节（67 万盘全量节名分布甄别定案）：都是**第二人称/按盘枚举**形态，
 * 真实排盘时由 analysis 内核按当前盘现场生成，预计算枚举 67 万盘的变体是纯噪声——
 * 「针对你的命盘」一节即占生成物 90% 以上行数。「四化路径」前缀同时命中
 * 「四化路径 · 你这盘」与「四化路径分析 · 落到你这盘」两个变体；「年干四化·关键宫位影响」
 * 是本命静态内容（出生年干四化），不含「四化路径」子串、不受误伤。 */
const DYNAMIC_SECTION_RE =
	/当前大限|流年|流月|综合建议|继续深度追问|针对你的命盘|四化路径|风险提醒/;
const SECTION_HEAD_RE = /^\*\*【(.+?)】\*\*$/;
/**
 * md 二级标题行（`## ⚙ 主辅煞组合精细论断…` / `## ✦ 双星同宫…`）—— 手册库的节体系只有
 * `**【】**` 一族，这些标题是 html 渲染的块头泄漏进 md 文本：其块内容（盘面组合枚举、
 * 引导行）是内核 html 版专属节的渲染镜像（report.ts「主辅煞组合精细论断」不在本仓知识源），
 * 预计算枚举 67 万盘的变体是纯噪声（实测 16.5 万条「还同坐」引导行藏在【经典出处】节内）。
 * 遇到即置 keep=false，整块丢弃到下一个 **【】** 节头。
 */
const MD_SUBHEAD_RE = /^## /;

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
			if (keep) {
				out.push(line);
			}
			continue;
		}
		if (MD_SUBHEAD_RE.test(line)) {
			keep = false;
			continue;
		}
		if (keep && line.trim() !== "") {
			out.push(line);
		}
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
	/** 上一处理行是否 emoji 四化主行（缩进 note 的紧邻归属判据，v4 起按上下文而非节名） */
	let lastWasSihuaMain = false;
	const uniq = (arr: string[], line: string): void => {
		if (!arr.includes(line)) {
			arr.push(line);
		}
	};

	for (const [line, section] of lines) {
		const indent = line.match(/^\s+(.*)/);
		const body = indent ? indent[1] : line;

		// 缩进行：四化主行的 note（同主行多变体换行合并）。
		// 归属判据 v4 起（ziwei-interp 数据集）改为**紧邻上下文**：四化行不再有专属节
		// （挂在「事业总览」等主题大节下混排），按节名合并的 v3 白名单失效 —— 缩进
		// 即从属标记，上一行是 emoji 四化主行时缩进行就是它的说明，跨节成立。
		// v3 的两个专属节名下缩进行同样紧邻主行，行为不变。
		if (indent) {
			if (lastWasSihuaMain && lastSihua) {
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
			lastWasSihuaMain = false;
			const found = oracle.patterns.find(p => p.name === m![1]);
			if (found) {
				if (m[2] && !found.text.includes(m[2])) {
					found.text += `\n${m[2]}`;
				}
			} else {
				oracle.patterns.push({ name: m[1], text: m[2] });
			}
			continue;
		}
		// 四化主行（本命四化节与年干节同构：emoji + **星化X**（落宫）[→ 意义]）
		if (/^[🔴🟡🔵🟢]/u.test(line)) {
			const existing = oracle.sihua.find(s => s.text === body);
			lastSihua = existing ?? { text: body };
			lastWasSihuaMain = true;
			if (!existing) {
				oracle.sihua.push(lastSihua);
			}
			continue;
		}
		lastWasSihuaMain = false;
		if (line.startsWith("本宫主星")) {
			uniq(oracle.mainPalace.stars, body);
			continue;
		}
		if (line.startsWith("◇")) {
			uniq(oracle.kuiYue, body);
			continue;
		}

		// 节驱动的普通段落
		if (section === "命盘关键定制") {
			uniq(oracle.mods, line);
		} else if (section === "星曜深层特质") {
			uniq(oracle.summary, line);
		} else if (section === "命盘推演") {
			uniq(oracle.mainPalace.content, line);
		} else if (section === "本命四化会照" || section === "年干四化·关键宫位影响") {
			lastSihua = { text: line };
			lastWasSihuaMain = true;
			oracle.sihua.push(lastSihua);
		} else if (section !== "") {
			if (!oracle.extras.has(section)) {
				oracle.extras.set(section, []);
			}
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

	// 分段流式取数（内存护栏）：一次性 getRowObjectsJS 会把该主题**全部盘**的主题文本
	// 拉进 JS 内存 —— 数十万盘 × 每盘数十 KB 是 OOM 级（67 万盘规模实测被内核击杀）。
	// 按 sample_id 分批，批内 ORDER BY sample_id 保序，聚合语义与全量单次取数逐字一致；
	// 聚合器（byStar / sanFangByStar，行级去重后的有界结构）内存与主题总盘数无关，
	// 峰值由批次大小决定。与 build-duckdb 的 shard 分段同一模式。
	const BATCH = 10000;
	const rangeRow = (
		await (
			await conn.run(
				"SELECT min(sample_id)::INT AS lo, max(sample_id)::INT AS hi FROM topics"
			)
		).getRowObjectsJS()
	)[0] as { lo: number; hi: number };
	async function* batchedRows(): AsyncGenerator<Array<{ star: string; text: string }>> {
		// 主星取该主题主宫的首颗主星（major_stars[1]，DuckDB 列表 1-based）；空宫（空列表）不计
		// 文本列取自 contentKey 的首个主题（别名视图共用源列，见 TOPIC_CONTENT_SOURCE）
		for (let lo = rangeRow.lo; lo <= rangeRow.hi; lo += BATCH) {
			const hi = lo + BATCH - 1;
			const sql = `SELECT major_stars[1] AS star, ${TOPIC_CONTENT_SOURCE[topic]} AS text
FROM topics JOIN palaces USING (sample_id)
WHERE palace_name = '${palace}' AND len(major_stars) > 0 AND sample_id BETWEEN ${lo} AND ${hi}
ORDER BY sample_id`;
			yield (await (await conn.run(sql)).getRowObjectsJS()) as Array<{
				star: string;
				text: string;
			}>;
		}
	}

	const byStar = new Map<string, Map<string, string>>();
	const sanFangByStar = new Map<
		string,
		Map<string, { stars: Set<string>; items: Set<string> }>
	>();
	const starSamples = new Map<string, number>();
	for await (const rows of batchedRows())
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
						if (bar[2]) {
							entry.stars.add(bar[2]);
						}
						continue;
					}
					const kui = l.match(/^✦ \*\*(.+?)\*\*[：:](.*)$/);
					const body = l.replace(/^\s+/, "");
					if (!currentPalace) {
						continue;
					}
					const entry = sanFang.get(currentPalace)!;
					entry.items.add(kui ? `✦ ${kui[1]}：${kui[2]}` : body);
					continue;
				}
				if (!lines.has(l)) {
					lines.set(l, section);
				}
			}
		}
	return { byStar, sanFangByStar, starSamples };
}

async function exportTopics(conn: DuckDBConnection): Promise<void> {
	ensureDir(TOPICS_DIR);
	for (const topic of TOPIC_KEYS) {
		const { byStar, sanFangByStar, starSamples } = await collectTopic(conn, topic);

		const head = [
			`# ${topic} · 断语全集（十四主星）`,
			"",
			"> 自动生成自样本库（518,400 设计样本 × 本仓 analysis 内核）——只导出静态节",
			">（当前大限 / 流年 / 流月等动态节不进册）。每节一行不重复、按首现序，",
			"> 标注该主星在主宫的样本盘数。生成：`npx tsx tools/db/export-manual.ts topics`。",
			"> 修订断语请改内核 `scripts/analysis/` 后重建库再导出，不要改本文件。",
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
				if (SECTION_HEAD_RE.test(line)) {
					continue;
				}
				body.push(line, "");
			}
			// 三方四正（盘内已解析聚合）：按宫展开成「▍宫名：星曜概览 + 断语行」
			for (const [palace, { stars, items }] of sanFangByStar.get(star) ?? []) {
				body.push(`▍**${palace}**：${[...stars].join("、")}`, "");
				for (const it of items) {
					body.push(it, "");
				}
			}
		}
		emit(join(TOPICS_DIR, `${topic}.md`), [...head, ...body].join("\n"));
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
GROUP BY 1, 2 ORDER BY 1, 2, 3 DESC`;
	return (await (await conn.run(sql)).getRowObjectsJS()) as Array<{
		star: string;
		aux: string;
		cnt: number;
	}>;
}

async function exportCombo(conn: DuckDBConnection): Promise<void> {
	ensureDir(OUT_DIR);
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
	emit(join(OUT_DIR, "combo-frequency.md"), md.join("\n") + "\n");
	console.error(`combo-frequency.md：${rows.length} 组合`);
}

/** 断语手册库与手写契约文件的目录（内核域内 scripts/corpus/data/manual）：oracle.db 是唯一生成物，index.ts / types.ts 是手写契约；引文守卫对目录语义化排除（内容由建库管线统一校验）。 */
const CODE_DIR = resolve(SKILL_ROOT, "scripts/corpus/data/manual");

// ── 断语手册库（db 模式）：规范化 SQLite 物化 ────────────────────────────────────

/** 库产物落点：`scripts/` 分发面内，随 pack 四项自动进包。 */
const ORACLE_DB_PATH = join(CODE_DIR, "oracle.db");

/** --check 模式下内存重建的库字节（与文本产物的 emit/对拍同一双形态哲学）。 */
let collectedDb: Buffer | null = null;

/**
 * lines.section 的值域 —— 建库端与组装层（`corpus/data/manual/index.ts`）的唯一约定。
 *
 * 固定槽用裸名；开放集（三方四正宫名、主题专属节名）用前缀编码，节名是行数据的
 * 一部分而非表结构 —— 新增节零 DDL。组装层按固定前缀截取（`slice`），节名含冒号
 * 不破坏解析。
 */
const SECTION = {
	mods: "mods",
	summary: "summary",
	mainPalaceStars: "main_palace_stars",
	mainPalace: "main_palace",
	sanFangStars: "san_fang_stars:",
	sanFang: "san_fang:",
	kuiYue: "kui_yue",
	extra: "extra:",
	other: "other",
} as const;

/**
 * `db` 子命令：把手册内容整理物化为专用 SQLite 只读库
 * （`scripts/corpus/data/manual/oracle.db`，构建期过滤整理 + 运行时按需查询）。
 *
 * 形态：行级规范化（topics / stars / texts 字典 + lines 行表 + patterns / sihua 两张
 * 结构表）。**字节可复现**是本产物的硬契约：显式 INTEGER 主键（不用隐式 rowid）、
 * 无 AUTOINCREMENT、固定 PRAGMA、插入序完全确定（topic → star → 组装序）、收尾
 * VACUUM —— 同一输入两次建库 sha256 相同，`--check` 对拍以字节为锚。
 *
 * 入库闸门：每行文本先过引文比对核心（`corpus/citation-core`），核对表外的
 * 「倪师 + 引号句」形态不得入库；违例时统一报错、不产出库文件。
 *
 * 主题循环走 `STORAGE_TOPIC_KEYS`（13 实体主题）：`study` 是 `career` 的别名视图，
 * 库内不携带重复数据（组装层按 `TOPIC_CONTENT_SOURCE` 映射查询）。
 */
async function exportDb(conn: DuckDBConnection): Promise<void> {
	const { DatabaseSync } = await import("node:sqlite");
	const db = new DatabaseSync(":memory:");
	try {
		// PRAGMA 在建表前定死：页大小影响字节布局；journal/synchronous 关闭 ——
		// 纯构建产物无崩溃恢复需求，也避免 -journal 残留扰动可复现性。
		db.exec("PRAGMA page_size = 4096");
		db.exec("PRAGMA journal_mode = OFF");
		db.exec("PRAGMA synchronous = OFF");
		// 跨表引用完整性由建库管线保证（插入序 + 字典 id 单点分配）；SQLite 默认不
		// 强制外键，产物为只读构建物，不声明外键约束。
		db.exec("CREATE TABLE topics (id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE)");
		db.exec("CREATE TABLE stars (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");
		db.exec("CREATE TABLE sections (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)");
		// texts 不建 UNIQUE 索引：唯一性由建库端 textId 字典单点保证（同 body 只插一次），
		// 产物只读无并发写 —— 省一份 33MB 级的索引副本（索引对 17.6 万条随机序中文文本
		// 的 B-tree 开销与表本体等量级）。
		db.exec("CREATE TABLE texts (id INTEGER PRIMARY KEY, body TEXT NOT NULL)");
		db.exec(`CREATE TABLE lines (
			topic_id INTEGER NOT NULL,
			star_id  INTEGER NOT NULL,
			ord      INTEGER NOT NULL,
			section_id INTEGER NOT NULL,
			text_id  INTEGER NOT NULL,
			PRIMARY KEY (topic_id, star_id, ord)
		)`);
		db.exec(`CREATE TABLE patterns (
			topic_id INTEGER NOT NULL,
			star_id  INTEGER NOT NULL,
			ord      INTEGER NOT NULL,
			name     TEXT NOT NULL,
			text_id  INTEGER NOT NULL,
			PRIMARY KEY (topic_id, star_id, ord)
		)`);
		db.exec(`CREATE TABLE sihua (
			topic_id INTEGER NOT NULL,
			star_id  INTEGER NOT NULL,
			ord      INTEGER NOT NULL,
			text_id  INTEGER NOT NULL,
			note_id  INTEGER,
			PRIMARY KEY (topic_id, star_id, ord)
		)`);

		// 全部入库走预编译语句 + 参数绑定（值经 ? 占位符，无任何字符串内插）；
		// 主键显式赋值 —— 不依赖隐式 rowid 分配。
		const placeholders = (n: number): string => Array.from({ length: n }, () => "?").join(", ");
		const stmt = (table: string, cols: readonly string[]) =>
			db.prepare(
				`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders(cols.length)})`
			);
		const insTopic = stmt("topics", ["id", "key"]);
		const insStar = stmt("stars", ["id", "name"]);
		const insSection = stmt("sections", ["id", "name"]);
		const insText = stmt("texts", ["id", "body"]);
		const insLine = stmt("lines", ["topic_id", "star_id", "ord", "section_id", "text_id"]);
		const insPattern = stmt("patterns", ["topic_id", "star_id", "ord", "name", "text_id"]);
		const insSihua = stmt("sihua", ["topic_id", "star_id", "ord", "text_id", "note_id"]);

		/** 行文本字典：跨主题跨星共享的同一行只存一份，id 按首现序分配。 */
		const textIds = new Map<string, number>();
		const textId = (body: string): number => {
			const found = textIds.get(body);
			if (found !== undefined) {
				return found;
			}
			const id = textIds.size + 1;
			textIds.set(body, id);
			insText.run(id, body);
			return id;
		};

		/** 节名字典：lines 经 id 引用（25 万行 × 节名逐行重复，字典化省一份副本）。 */
		const sectionIds = new Map<string, number>();
		const sectionId = (name: string): number => {
			const found = sectionIds.get(name);
			if (found !== undefined) {
				return found;
			}
			const id = sectionIds.size + 1;
			sectionIds.set(name, id);
			insSection.run(id, name);
			return id;
		};

		// 建库期引文校验：违例收集到统一报错（不逐条中断，一次交代全貌）。
		const citationHits: string[] = [];
		const guard = (body: string, where: string): void => {
			for (const v of findViolations([body])) {
				citationHits.push(`${where}：${v}`);
			}
		};

		// 维表：topics = 13 实体主题，id = STORAGE_TOPIC_KEYS 声明序（确定性来源）。
		STORAGE_TOPIC_KEYS.forEach((k, i) => insTopic.run(i + 1, k));

		// 单遍写入（内存护栏）：star id 按**首现序**即时分配 —— 不预收全星集，免去
		// 同时持有 13 主题的聚合结构（去重行全集，JS 对象开销数倍于文本量）。遍历序
		// 固定（topic 声明序 × 星名字典序），id 分配因此确定。
		let nextStarId = 1;
		const starIds = new Map<string, number>();

		// 行写入：ord 为 per (topic, star) 的组装序 —— 组装层按它重建 OracleStar 的
		// 字段序与 sanFang 宫序（宫序 = 该宫首行的 ord）。写入顺序即分类器字段序。
		let lineCount = 0;
		for (const topic of STORAGE_TOPIC_KEYS) {
			const topicId = STORAGE_TOPIC_KEYS.indexOf(topic) + 1;
			const c = await collectTopic(conn, topic);
			for (const [star, ls] of [...c.byStar.entries()].sort()) {
				let starId = starIds.get(star);
				if (starId === undefined) {
					starId = nextStarId++;
					starIds.set(star, starId);
					insStar.run(starId, star);
				}
				const o = classifyOracle(ls, c.sanFangByStar.get(star)!);
				let ord = 0;
				const put = (section: string, body: string): void => {
					guard(body, `${topic}/${star}/${section}`);
					insLine.run(topicId, starId, ord++, sectionId(section), textId(body));
					lineCount++;
				};
				for (const l of o.mods) put(SECTION.mods, l);
				for (const l of o.summary) put(SECTION.summary, l);
				for (const l of o.mainPalace.stars) put(SECTION.mainPalaceStars, l);
				for (const l of o.mainPalace.content) put(SECTION.mainPalace, l);
				for (const sf of o.sanFang) {
					for (const s of sf.stars) put(`${SECTION.sanFangStars}${sf.palace}`, s);
					for (const it of sf.items) put(`${SECTION.sanFang}${sf.palace}`, it);
				}
				for (const l of o.kuiYue) put(SECTION.kuiYue, l);
				for (const [k, ls] of Object.entries(o.extras)) {
					for (const l of ls) put(`${SECTION.extra}${k}`, l);
				}
				for (const l of o.other) put(SECTION.other, l);
				o.patterns.forEach((p, i) => {
					guard(p.text, `${topic}/${star}/pattern:${p.name}`);
					insPattern.run(topicId, starId, i, p.name, textId(p.text));
				});
				o.sihua.forEach((s, i) => {
					guard(s.text, `${topic}/${star}/sihua`);
					if (s.note !== undefined) guard(s.note, `${topic}/${star}/sihua-note`);
					insSihua.run(
						topicId,
						starId,
						i,
						textId(s.text),
						s.note === undefined ? null : textId(s.note)
					);
				});
			}
		}

		if (citationHits.length > 0) {
			console.error(
				`✘ 建库期引文校验失败 ${citationHits.length} 处 —— 核对表外引文形态不得入库（先在 annotations.ts 登记档位再重建）：`
			);
			for (const h of citationHits.slice(0, 10)) {
				console.error(`  ${h}`);
			}
			process.exitCode = 1;
			return;
		}

		// 唯一性自检：texts 无 UNIQUE 约束（省随机序索引开销），唯一性由 textId 字典
		// 单点保证 —— 这里以查询钉住，字典失效当场爆而不是静默产出脏库。
		const dupTexts = db
			.prepare(
				"SELECT COUNT(*) AS n FROM (SELECT body FROM texts GROUP BY body HAVING COUNT(*) > 1)"
			)
			.get();
		if (dupTexts && Number(dupTexts.n) > 0) {
			throw new Error(`texts 出现 ${dupTexts.n} 组重复 body —— 建库端字典失效`);
		}

		db.exec("VACUUM");
		const buf = Buffer.from(db.serialize());
		if (CHECK_MODE) {
			collectedDb = buf;
		} else {
			writeFileSync(ORACLE_DB_PATH, buf);
		}
		console.error(
			`oracle.db：${STORAGE_TOPIC_KEYS.length} 主题 × ${starIds.size} 主星，` +
				`${lineCount} 行（texts 字典 ${textIds.size} 条）`
		);
	} finally {
		db.close();
	}
}

/** 格局名目对拍：db 渲染集（⭐ 行）vs patterns 现库（多样本实测产出全集）。 */
async function auditGeju(conn: DuckDBConnection): Promise<void> {
	// db 侧：⭐ 行 → 名目
	const sql = `WITH l AS (${STORAGE_TOPIC_KEYS.map(k => `SELECT unnest(string_split(${k}, chr(10))) AS line FROM topics`).join(" UNION ALL ")})
SELECT DISTINCT line FROM l WHERE line LIKE '⭐%'`;
	const rows = (await (await conn.run(sql)).getRowObjectsJS()) as Array<{ line: string }>;
	const dbNameToLine = new Map<string, string>();
	for (const r of rows) {
		const m = r.line.match(/⭐ \*\*(.+?)\*\*/);
		if (m) {
			dbNameToLine.set(m[1], r.line);
		}
	}

	// patterns 侧：抽样 2000 盘实测 detectPatterns 全名目（跳过非法公历日期）
	const sampleSql = `SELECT year, month, day, hour, gender, longitude FROM samples WHERE sample_id % 259 = 0 ORDER BY sample_id LIMIT 2000`;
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
		for (const p of patterns.detectPatterns(chart)) {
			produced.set(p.name, (produced.get(p.name) ?? 0) + 1);
		}
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
	for (const n of dbNameToLine.keys()) {
		if (!normPool.includes(norm(n))) {
			dbUnmatched.push(n);
		}
	}
	for (const p of patNames) {
		if (![...dbNameToLine.keys()].some(n => norm(n) === norm(p))) {
			patUnmatched.push(p);
		}
	}

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
	emit(join(OUT_DIR, "geju-audit.md"), md.join("\n") + "\n");
	console.error(
		`geju-audit.md：现库 ${patNames.length} 名目，db ${dbNameToLine.size} 名目，差集 ${patUnmatched.length}/${dbUnmatched.length}`
	);
}

// ── 漂移探针（--check）：内存重导 ↔ 磁盘已提交产物逐字对拍 ──────────────────────

/** 两文本的前 n 处差异行样例（定位用，不做完整 diff）。 */
function firstDiffs(onDisk: string, regen: string, n = 5): string[] {
	const a = onDisk.split("\n");
	const b = regen.split("\n");
	const out: string[] = [];
	for (let i = 0; i < Math.max(a.length, b.length) && out.length < n; i++) {
		const x = a[i] ?? "（无此行）";
		const y = b[i] ?? "（无此行）";
		if (x !== y) {
			out.push(`  第${i + 1}行：盘上「${x.slice(0, 60)}」↔ 重导「${y.slice(0, 60)}」`);
		}
	}
	return out;
}

/** 对拍内存产物与磁盘产物：内容差异与盘上孤儿（不可再生成的残留）都算漂移。 */
function compareArtifacts(): number {
	const drift: string[] = [];
	for (const [absPath, regen] of [...collected.entries()].sort()) {
		const rel = absPath.slice(SKILL_ROOT.length + 1);
		if (!existsSync(absPath)) {
			drift.push(`${rel}：盘上缺失（重导会新建）`);
			continue;
		}
		const onDisk = readFileSync(absPath, "utf8");
		if (onDisk !== regen) {
			drift.push(`${rel}：内容漂移`, ...firstDiffs(onDisk, regen));
		}
	}
	// 孤儿检测：产物目录里「盘上有、重导不再生成」的文件（如主题退役后的残留）。
	const produced = new Set(collected.keys());
	for (const [dir, ext] of [[TOPICS_DIR, ".md"]] as const) {
		if (!existsSync(dir)) {
			continue;
		}
		for (const f of readdirSync(dir)) {
			const abs = join(dir, f);
			if (f.endsWith(ext) && !produced.has(abs)) {
				drift.push(`${abs.slice(SKILL_ROOT.length + 1)}：盘上孤儿（重导不再生成，应删除）`);
			}
		}
	}
	for (const name of ["combo-frequency.md", "geju-audit.md"]) {
		const abs = join(OUT_DIR, name);
		if (existsSync(abs) && !produced.has(abs)) {
			drift.push(`${abs.slice(SKILL_ROOT.length + 1)}：盘上孤儿（重导不再生成，应删除）`);
		}
	}
	// 断语手册库：二进制产物不逐字 diff，以 sha256 为锚（可复现性见 exportDb）。
	if (collectedDb !== null) {
		if (!existsSync(ORACLE_DB_PATH)) {
			drift.push("scripts/corpus/data/manual/oracle.db：盘上缺失（重导会新建）");
		} else {
			const onDisk = readFileSync(ORACLE_DB_PATH);
			if (!onDisk.equals(collectedDb)) {
				drift.push(
					"scripts/corpus/data/manual/oracle.db：内容漂移（sha256 与内存重建不一致）"
				);
			}
		}
	}
	if (drift.length > 0) {
		console.error(
			`✘ 生成物漂移 ${drift.length} 处 —— 内核表或导出工具改了、产物未重导（改内核后重建库再重导）：`
		);
		for (const d of drift) {
			console.error(`  ${d}`);
		}
		return 1;
	}
	console.error(`✔ 生成物与当前内核表 / 导出工具一致（${collected.size} 个文件逐字对拍）`);
	return 0;
}

async function main() {
	// --check：漂移探针 —— 固定跑全量、固定用仓库默认库位（--out 与子命令均忽略）；
	// 产物走内存（emit/ensureDir 的 check 形态），生成完与盘上已提交产物对拍。
	if (CHECK_MODE) {
		const target = resolveQueryTarget(join(SKILL_ROOT, "db"));
		if (target.kind === "none") {
			// 环境缺失不是缺陷：显式 ⏭ 且零退出 —— 跳过必须可见，不得静默绿。
			console.error("⏭ 跳过生成物漂移探针：既无库也无 dataset（本机未建库时探针不适用）");
			return;
		}
		let db: typeof import("./db");
		try {
			db = await import("./db");
		} catch {
			console.error("⏭ 跳过生成物漂移探针：DuckDB 依赖不可用（npm install 后可启用）");
			return;
		}
		try {
			const conn =
				target.kind === "db"
					? await db.openReadOnly(target.dbPath)
					: await db.openDataset(target.datasetDir);
			try {
				await conn.run("SET memory_limit='4GB'");
				await exportTopics(conn);
				await exportCombo(conn);
				await auditGeju(conn);
				await exportDb(conn);
			} finally {
				conn.closeSync();
			}
		} catch (e) {
			// 生成阶段的失败是「环境不可用」（如 duckdb 中间物引用的 parquet 已移走、
			// 依赖残缺），不是漂移证据 —— 探针未执行必须显式说清，不得报红也不得静默绿。
			console.error(
				`⏭ 跳过生成物漂移探针：重导未完成（${e instanceof Error ? e.message.split("\n")[0] : String(e)}）—— 探针未执行，这不是绿`
			);
			return;
		}
		process.exitCode = compareArtifacts();
		return;
	}
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
		// DuckDB 侧内存护栏：分段流式已把 JS 峰值与主题总盘数解耦，这里再给引擎本身
		// 设上限（超限溢盘而非吃满机器），与 build-duckdb / verify-duckdb 的先例同款。
		await conn.run("SET memory_limit='4GB'");
		const cmd = process.argv[2] ?? "all";
		if (cmd === "topics" || cmd === "all") {
			await exportTopics(conn);
		}
		if (cmd === "combo" || cmd === "all") {
			await exportCombo(conn);
		}
		if (cmd === "geju" || cmd === "all") {
			await auditGeju(conn);
		}
		if (cmd === "db" || cmd === "all") {
			await exportDb(conn);
		}
		if (!["topics", "combo", "geju", "db", "all"].includes(cmd)) {
			console.error(`未知子命令「${cmd}」：topics / combo / geju / db / all`);
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
