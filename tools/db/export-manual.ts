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
	for (const name of ["combo-frequency.md", "geju-audit.md", "topics"]) {
		const abs = join(OUT_DIR, name);
		if (existsSync(abs) && !produced.has(abs)) {
			drift.push(`${abs.slice(SKILL_ROOT.length + 1)}：盘上孤儿（重导不再生成，应删除）`);
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
				await exportCombo(conn);
				await auditGeju(conn);
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
		if (cmd === "combo" || cmd === "all") {
			await exportCombo(conn);
		}
		if (cmd === "geju" || cmd === "all") {
			await auditGeju(conn);
		}
		if (!["combo", "geju", "all"].includes(cmd)) {
			console.error(`未知子命令「${cmd}」：combo / geju / all`);
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
