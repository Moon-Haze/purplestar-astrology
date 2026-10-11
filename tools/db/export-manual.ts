/**
 * 手册导出工具（tools/db）—— 从样本库（db/ziwei.duckdb 或 dataset/ parquet）
 * 导出可归档的资料产物到 docs/manual/：
 *
 *   npx tsx tools/db/export-manual.ts topics   # 4 号：13 主题 × 十四主星断语全集
 *   npx tsx tools/db/export-manual.ts combo    # 5 号：主星 × 辅煞同宫频率全表
 *   npx tsx tools/db/export-manual.ts geju     # 格局名目对拍（db 渲染集 vs patterns 现库）
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
 * 另过滤 `▍` 开头的三方四正标签行 —— 那是渲染层拼的**结构行**（标签宫名配对），
 * 不是断语；且旧库（三合标签修复 407bc06 之前建）里带错位标签，不进册。
 */
function staticLines(text: string): string[] {
	const out: string[] = [];
	let keep = false;
	for (const line of text.split("\n")) {
		const head = line.match(SECTION_HEAD_RE);
		if (head) {
			keep = !DYNAMIC_SECTION_RE.test(head[1]);
			continue;
		}
		if (keep && line.trim() !== "" && !line.startsWith("▍")) out.push(line);
	}
	return out;
}

async function exportTopics(conn: DuckDBConnection): Promise<void> {
	mkdirSync(TOPICS_DIR, { recursive: true });
	for (const topic of TOPIC_KEYS) {
		const palace = TOPIC_PALACE_COMPACT[topic];
		// 主星取该主题主宫的首颗主星（major_stars[1]，DuckDB 列表 1-based）；空宫（空列表）不计
		const sql = `SELECT major_stars[1] AS star, ${topic} AS text
FROM topics JOIN palaces USING (sample_id)
WHERE palace_name = '${palace}' AND len(major_stars) > 0`;
		const result = await conn.run(sql);
		const rows = (await result.getRowObjectsJS()) as Array<{ star: string; text: string }>;

		// star → 行 → 频次（按首现序聚合）
		const byStar = new Map<string, Map<string, number>>();
		for (const r of rows) {
			let lines = byStar.get(r.star);
			if (!lines) {
				lines = new Map();
				byStar.set(r.star, lines);
			}
			for (const l of staticLines(r.text)) lines.set(l, (lines.get(l) ?? 0) + 1);
		}

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
			const sampleCount = rows.filter(r => r.star === star).length;
			body.push(`## ${star}（${sampleCount.toLocaleString("en-US")} 盘）`, "");
			for (const [line] of lines) body.push(line, "");
		}
		writeFileSync(join(TOPICS_DIR, `${topic}.md`), [...head, ...body].join("\n"));
		console.error(
			`topics/${topic}.md：${byStar.size} 星 × 共 ${[...byStar.values()].reduce((n, m) => n + m.size, 0)} 行`
		);
	}
}

async function exportCombo(conn: DuckDBConnection): Promise<void> {
	mkdirSync(OUT_DIR, { recursive: true });
	const sql = `SELECT s.star, a.aux, COUNT(*)::INT AS cnt
FROM (SELECT sample_id, palace_name, UNNEST(major_stars) AS star FROM palaces) s
JOIN (SELECT sample_id, palace_name, UNNEST(list_concat(lucky_stars, sha_stars)) AS aux FROM palaces) a
  ON s.sample_id = a.sample_id AND s.palace_name = a.palace_name
GROUP BY 1, 2 ORDER BY 1, 3 DESC`;
	const rows = (await (await conn.run(sql)).getRowObjectsJS()) as Array<{
		star: string;
		aux: string;
		cnt: number;
	}>;
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
		if (!["topics", "combo", "geju", "all"].includes(cmd)) {
			console.error(`未知子命令「${cmd}」：topics / combo / geju / all`);
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
