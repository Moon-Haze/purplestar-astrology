// 用法: npm run verify:db [-- --out=DIR] [-- --src=DIR]
//      参数同时支持 --key=value 与 --key value 两种写法
// --out 只给目录，库名与字典副本名固定（与 build:db / query 同一套规则）
// spec §8：总量 / 维度覆盖 / 抽样深度比对 / 四化一致性 / 报告
import { createReadStream, existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import type { DuckDBConnection, JS } from "@duckdb/node-api";
import { DuckDBInstance } from "@duckdb/node-api";
import {
	DATASET_TOTAL_LIMIT,
	dbPathIn,
	datasetDirIn,
	datasetSchemaSql,
	deletedArgHint,
	detectLayout,
	dictPathFor,
	openReadOnly,
	sqlLiteral,
	TOPIC_KEYS,
	type DbLayout,
} from "./db";
import { decodeSampleId, sampleId, sqlSampleIdExpr } from "./sample-id";
import { extractSihua, type ZiweiChartLike } from "./sihua";

// skipped 与 ok 正交：SKIP 表示「这项在当前形态下不适用」，它既不是通过也不是失败。
// 必须单独成一态——把「其实没跑」渲染成 PASS，读的人会当成「这项验过了」。
export interface CheckResult {
	name: string;
	ok: boolean;
	detail: string;
	skipped?: boolean;
}

// skill 根（仓库根）：本文件在 <skill 根>/tools/db/ 下，故退两层。
// 与 build-duckdb.ts 同一处约定，改一个必须改另一个。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArg(name: string, fallback: string): string {
	const argv = process.argv.slice(2);
	const eqHit = argv.find(a => a.startsWith(`--${name}=`));
	if (eqHit) return path.resolve(eqHit.split("=")[1]);
	const i = argv.indexOf(`--${name}`);
	if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
	return fallback;
}

// 本脚本的参数解析是宽松的——只找自己要的名字，其余静默忽略（新增可选参数时是有意的）。
// 对**已删除**的参数这就成了陷阱：`--db=/x` 被忽略后脚本安静地读默认位置的库，
// 用户以为验的是自己那份，要等到报告里出现意外的行数才可能察觉；
// `--dict=...` 更糟，字典自证会拿默认位置那份去比，结论直接失真。
// 故废弃名字在入口处显式报错（与 rejectLegacyModeEnv 同一模式）。
export function rejectDeletedArgs(argv: string[] = process.argv.slice(2)): void {
	for (const a of argv) {
		const eq = a.indexOf("=");
		const key = eq >= 0 ? a.slice(0, eq) : a;
		if (key === "--db" || key === "--dict" || key === "--topics-dir") {
			throw new Error(deletedArgHint(key));
		}
	}
}

// BIGINT 聚合归一化为 Number；list/struct 由 getRowsJS 转为纯 JS 值
function normalize(v: JS): JS {
	return typeof v === "bigint" ? Number(v) : v;
}
async function one(conn: DuckDBConnection, sql: string): Promise<JS[]> {
	const rows = await (await conn.run(sql)).getRowsJS();
	return (rows[0] ?? []).map(normalize);
}

// 库侧数据的唯一权威来源：topics 视图的定义 SQL。
// 视图不存在时返回 null，由调用方决定是报错还是走别的分支。
async function topicsViewSqlOf(conn: DuckDBConnection): Promise<string | null> {
	const rows = await (
		await conn.run("SELECT sql FROM duckdb_views() WHERE view_name = 'topics'")
	).getRowsJS();
	return rows.length === 0 ? null : String(rows[0][0] ?? "");
}

// 从 topics 视图定义里取出 read_parquet 的**完整 glob**（不是目录）：
// dataset 形态是 <dataset>/topics-*.parquet。
// 必须保留 glob 本身——dataset 目录里还有 samples.parquet / palaces.parquet，
// 若把目录拼上 *.parquet 会把它们也卷进来（union by name 后列对不上）。
function parquetPathFromViewSql(viewSql: string): string | null {
	const m = /read_parquet\(\s*'((?:[^']|'')*)'\s*\)/.exec(viewSql);
	return m ? m[1].replace(/''/g, "'") : null;
}

// 1. 总量与三表结构不变量（spec §8.1）
//    palaces 每样本恰 12 行、topic_lines 每样本恰 13 行、三表 id 集合一致。
//    配合 verifyDimensions 的全空间覆盖，等价锁定 spec 的 518400 / 6220800 / 6739200。
export async function verifyCounts(
	conn: DuckDBConnection,
	layout: DbLayout = "inline"
): Promise<CheckResult> {
	const nSamples = await one(conn, "SELECT count(*) FROM samples");
	const nPalaces = await one(conn, "SELECT count(*) FROM palaces");
	const n = Number(nSamples[0]);
	if (layout === "parquet") {
		// parquet 的 topics 视图是 read_parquet，没有聚合，全量 count 不会 OOM
		const nTopics = await one(conn, "SELECT count(*) FROM topics");
		const nDiff = await one(
			conn,
			`
      SELECT (SELECT count(*) FROM (SELECT sample_id FROM samples EXCEPT SELECT sample_id FROM topics))
           + (SELECT count(*) FROM (SELECT sample_id FROM samples EXCEPT SELECT DISTINCT sample_id FROM palaces))`
		);
		const ok = nDiff[0] === 0 && Number(nTopics[0]) === n && Number(nPalaces[0]) === n * 12;
		return {
			name: "总量",
			ok,
			detail:
				`samples=${nSamples[0]} palaces=${nPalaces[0]}（应为 ${n * 12}）` +
				`topics=${nTopics[0]}（应为 ${n}）id差异=${nDiff[0]}`,
		};
	}
	// inline：断言落在 topic_lines 上。不能写 count(*) FROM topics——
	// 那会强制重建全部文本，极慢且可能 OOM（spec §7.4 / §8）
	const nLines = await one(conn, "SELECT count(*) FROM topic_lines");
	const nDistinct = await one(conn, "SELECT count(DISTINCT sample_id) FROM topic_lines");
	const nDiff = await one(
		conn,
		`
    SELECT (SELECT count(*) FROM (SELECT sample_id FROM samples EXCEPT SELECT DISTINCT sample_id FROM topic_lines))
         + (SELECT count(*) FROM (SELECT sample_id FROM samples EXCEPT SELECT DISTINCT sample_id FROM palaces))`
	);
	const ok =
		nDiff[0] === 0 &&
		Number(nDistinct[0]) === n &&
		Number(nLines[0]) === n * 13 &&
		Number(nPalaces[0]) === n * 12;
	return {
		name: "总量",
		ok,
		detail:
			`samples=${nSamples[0]} palaces=${nPalaces[0]}（应为 ${n * 12}）` +
			`topic_lines=${nLines[0]}（应为 ${n * 13}，覆盖 ${nDistinct[0]} 个样本）id差异=${nDiff[0]}`,
	};
}

// 2. 维度覆盖：引擎内生成全集比对（spec §8.2）
// 全空间覆盖（缺失=0）只在完整构建下成立：60 年全集共 60×12×30×12×2 = 518,400 行。
// 范围构建（--from-year/--to-year）与测试迷你库必然"缺失"，故只在完整构建时断言缺失为 0，
// 任何规模下都断言「维度无重复」。
const FULL_BUILD_SAMPLES = 518_400;
export async function verifyDimensions(conn: DuckDBConnection): Promise<CheckResult> {
	const missing = await one(
		conn,
		`
    WITH expected AS (
      SELECT 1924 + y AS year, m + 1 AS month, d + 1 AS day, h AS hour, gidx
      FROM range(60) t1(y), range(12) t2(m), range(30) t3(d), range(12) t4(h), (VALUES (0),(1)) t5(gidx)
    )
    SELECT count(*) FROM expected e
    LEFT JOIN samples s ON s.year=e.year AND s.month=e.month AND s.day=e.day AND s.hour=e.hour
      AND s.gender = CASE WHEN e.gidx=0 THEN 'male' ELSE 'female' END
    WHERE s.sample_id IS NULL`
	);
	const dup = await one(
		conn,
		`
    SELECT count(*) FROM (SELECT year,month,day,hour,gender FROM samples GROUP BY ALL HAVING count(*)>1)`
	);
	// 任何规模都断言：sample_id 必须等于五维自然键重算值（spec §5.1）。
	// 该式是三表 join 的基石，一旦漂移，palaces/topics 会静默错配到别的样本上。
	const drift = await one(
		conn,
		`
    SELECT count(*) FROM samples s WHERE s.sample_id <> (${sqlSampleIdExpr("s")})`
	);
	const n = Number((await one(conn, "SELECT count(*) FROM samples"))[0]);
	const isFullBuild = n === FULL_BUILD_SAMPLES;
	const ok = dup[0] === 0 && drift[0] === 0 && (!isFullBuild || missing[0] === 0);
	return {
		name: "维度覆盖",
		ok,
		detail:
			`缺失=${missing[0]} 重复=${dup[0]} id漂移=${drift[0]}` +
			(isFullBuild ? "" : `（非完整构建 ${n} 行，缺失量不作判定）`),
	};
}

// 4. 四化一致性：palaces.sihua_stars 重算 vs samples 摘要，全量（spec §8.4）
export async function verifySihuaConsistency(conn: DuckDBConnection): Promise<CheckResult> {
	const bad = await one(
		conn,
		`
    WITH agg AS (
      SELECT sample_id,
        max(CASE WHEN split_part(pair,':',2)='禄' THEN split_part(pair,':',1) END) AS lu_star,
        max(CASE WHEN split_part(pair,':',2)='权' THEN split_part(pair,':',1) END) AS quan_star,
        max(CASE WHEN split_part(pair,':',2)='科' THEN split_part(pair,':',1) END) AS ke_star,
        max(CASE WHEN split_part(pair,':',2)='忌' THEN split_part(pair,':',1) END) AS ji_star
      FROM palaces, UNNEST(sihua_stars) AS u(pair) GROUP BY sample_id
    )
    SELECT count(*) FROM agg a JOIN samples s USING (sample_id)
    WHERE a.lu_star  IS DISTINCT FROM s.sihua_lu_star
       OR a.quan_star IS DISTINCT FROM s.sihua_quan_star
       OR a.ke_star  IS DISTINCT FROM s.sihua_ke_star
       OR a.ji_star  IS DISTINCT FROM s.sihua_ji_star`
	);
	return { name: "四化一致性", ok: bad[0] === 0, detail: `不一致=${bad[0]}` };
}

// 3. 抽样深度比对（spec §8.3）：确定性等距抽样 max 50 条（可复现），逐字段对源文件
//    取样含 sample_id=1（首样本），且 n ≥ 总行数时取全量（小库全查）
export async function verifySampling(conn: DuckDBConnection, src: string): Promise<CheckResult> {
	// 源不存在即降级为 SKIP 而非 FAIL：samples-out/ 不入库，clone 后必然无源。
	// 但无源时证明力确实更低（只能证明数据集自洽，不能证明它与源一致），
	// 故 detail 里写明，且由 main 汇总进末行结论。
	if (!existsSync(src)) {
		return {
			name: "抽样深度比对",
			ok: true,
			skipped: true,
			detail: `SKIP（源目录不存在：${src}。无源时只能证明数据集自洽，不能证明它与源一致）`,
		};
	}
	const total = Number((await one(conn, "SELECT count(*) FROM samples"))[0]);
	const n = Math.min(50, total);
	const step = Math.max(1, Math.floor(total / n));
	const ids = (
		await (
			await conn.run(
				`SELECT sample_id FROM samples WHERE (sample_id - 1) % ${step} = 0 ORDER BY sample_id LIMIT ${n}`
			)
		).getRowsJS()
	).map(r => Number(r[0]));
	const mismatches: string[] = [];
	for (const id of ids) {
		const row = (
			await (await conn.run(`SELECT * FROM samples WHERE sample_id=${id}`)).getRowObjectsJS()
		)[0];
		const tRow = (
			await (await conn.run(`SELECT * FROM topics WHERE sample_id=${id}`)).getRowObjectsJS()
		)[0];
		const pRows = await (
			await conn.run(`SELECT * FROM palaces WHERE sample_id=${id} ORDER BY branch`)
		).getRowObjectsJS();
		const rec = await readSourceRecord(src, id);
		if (!rec) {
			mismatches.push(`id=${id}: 源文件中找不到对应记录`);
			continue;
		}
		mismatchDetail(id, { samples: row, topics: tRow, palaces: pRows }, rec, mismatches);
	}
	return {
		name: "抽样深度比对",
		ok: mismatches.length === 0,
		detail:
			mismatches.length === 0
				? `${ids.length} 条全部一致`
				: mismatches.slice(0, 5).join("; "),
	};
}

// 源文件定位：id → year/month → 分片；流式解压扫描匹配 birthInfo 的行
async function readSourceRecord(src: string, id: number): Promise<Record<string, any> | null> {
	const { year, month, day, hour, gender } = decodeSampleId(id);
	const file = path.join(
		src,
		`year-${year}`,
		`${year}-${String(month).padStart(2, "0")}.jsonl.gz`
	);
	const rl = readline.createInterface({ input: createReadStream(file).pipe(createGunzip()) });
	try {
		for await (const line of rl) {
			if (!line.trim()) continue;
			const r = JSON.parse(line) as Record<string, any>;
			const b = r.birthInfo;
			if (
				b.year === year &&
				b.month === month &&
				b.day === day &&
				b.hour === hour &&
				b.gender === gender
			)
				return r;
		}
	} finally {
		rl.close();
	}
	return null;
}

function starNames(stars: Array<{ name: string; type: string }>, type: string): string[] {
	return stars.filter(s => s.type === type).map(s => s.name);
}

// 按列名取值（而非列下标），避免与 DDL 列序耦合
function mismatchDetail(
	id: number,
	db: {
		samples: Record<string, JS>;
		topics?: Record<string, JS>;
		palaces: Array<Record<string, JS>>;
	},
	rec: Record<string, any>,
	out: string[]
): void {
	const b = rec.birthInfo,
		ch = rec.chart,
		si = extractSihua(ch as unknown as ZiweiChartLike);
	const S = db.samples;
	const checks: Array<[boolean, string]> = [
		[
			S.year === b.year &&
				S.month === b.month &&
				S.day === b.day &&
				S.hour === b.hour &&
				S.gender === b.gender,
			"出生信息",
		],
		[Number(S.longitude) === b.longitude, "经度"],
		[
			S.lunar_year === ch.lunarInfo.lunarYear &&
				S.lunar_day === ch.lunarInfo.lunarDay &&
				S.is_leap_month === ch.lunarInfo.isLeapMonth,
			"农历",
		],
		[
			S.ming_gong_branch === ch.mingGongBranch &&
				S.wuxing_ju === ch.wuxingJu &&
				S.wuxing_ju_name === ch.wuxingJuName,
			"命盘概要",
		],
		[
			S.sihua_lu_star === si.lu_star &&
				S.sihua_lu_palace === si.lu_palace &&
				S.sihua_ji_star === si.ji_star &&
				S.sihua_ji_palace === si.ji_palace,
			"四化摘要",
		],
	];
	for (const [ok, label] of checks) if (!ok) out.push(`id=${id}: ${label}不一致`);

	// 12 宫
	const byName = new Map(db.palaces.map(p => [p.palace_name as string, p]));
	for (const p of ch.palaces) {
		const row = byName.get(p.name);
		if (!row) {
			out.push(`id=${id}: 缺宫 ${p.name}`);
			continue;
		}
		const exp = {
			major: starNames(p.stars, "major"),
			lucky: starNames(p.stars, "lucky"),
			sha: starNames(p.stars, "sha"),
			minor: starNames(p.stars, "minor"),
		};
		const got = {
			major: row.major_stars,
			lucky: row.lucky_stars,
			sha: row.sha_stars,
			minor: row.minor_stars,
		};
		if (
			JSON.stringify(got.major) !== JSON.stringify(exp.major) ||
			JSON.stringify(got.lucky) !== JSON.stringify(exp.lucky) ||
			JSON.stringify(got.sha) !== JSON.stringify(exp.sha) ||
			JSON.stringify(got.minor) !== JSON.stringify(exp.minor)
		) {
			out.push(`id=${id}: 宫 ${p.name} 星曜不一致`);
		}
	}

	// 13 主题。db.topics 可能整体缺失（该样本在 topic_lines 里根本没有行），
	// 此时按「不一致」记录，而不是让 undefined 下标把整个校验脚本炸掉。
	const T = db.topics;
	if (!T) out.push(`id=${id}: 主题行缺失（topic_lines 中无该样本）`);
	else
		for (const k of TOPIC_KEYS) {
			if (T[k] !== rec.topics[k]) out.push(`id=${id}: 主题 ${k} 不一致`);
		}
}

// 5. 体积报告（spec §9 第 3 项）：单文件后只统计库文件本身，
//    并断言视图内没有外部文件依赖——库被单独复制到别处后仍可查询，是本次的核心收益。
export async function verifySize(
	conn: DuckDBConnection,
	dbPath: string,
	layout: DbLayout = "inline",
	outDir: string = path.dirname(dbPath)
): Promise<CheckResult> {
	const dbSize = existsSync(dbPath) ? statSync(dbPath).size : 0;
	const datasetDir = datasetDirIn(outDir);
	if (layout === "parquet") {
		const files = existsSync(datasetDir)
			? (await readdir(datasetDir)).filter(f => f.endsWith(".parquet"))
			: [];
		if (files.length === 0) {
			return {
				name: "体积报告",
				ok: false,
				detail: `dataset 目录内没有 parquet：${datasetDir}`,
			};
		}
		const sizes = files.map(f => statSync(path.join(datasetDir, f)).size);
		return {
			name: "体积报告",
			...(await datasetVolumeVerdict(
				sizes.reduce((a, b) => a + b, 0),
				sizes
			)),
		};
	}
	const views = await one(conn, "SELECT count(*) FROM duckdb_views() WHERE view_name = 'topics'");
	if (views[0] === 0) {
		return {
			name: "体积报告",
			ok: false,
			detail: "库内没有 topics 视图（改动前的旧格式库，或构建未收尾），请用 build:db --force 重建",
		};
	}
	// search_topic 宏的定义体无法从 SQL 目录读回，其无外部依赖由 tools/db/db.ts 的构造代码
	// 保证（tests/db.test.ts 覆盖）；这里只能扫视图定义。
	const external = await one(
		conn,
		"SELECT count(*) FROM duckdb_views() WHERE sql ILIKE '%read_parquet%'" +
			" OR sql ILIKE '%read_json%' OR sql ILIKE '%read_csv%'"
	);
	const gb = (n: number) => (n / 1024 ** 3).toFixed(3);
	return {
		name: "体积报告",
		ok: dbSize <= 1.7 * 1024 ** 3 && external[0] === 0,
		detail: `单库文件 ${gb(dbSize)}GiB（目标 ≤1.7GiB，spec §11）外部文件依赖=${external[0]}（须为 0）`,
	};
}

// dataset 形态的体积判据：合计上限 + 每个 parquet 的 GitHub 单文件硬限。
// 两条缺一不可——只看合计的话，一个 500MB 的单片会被其余小片「平均」掉。
export async function datasetVolumeVerdict(
	datasetBytes: number,
	partSizes: number[]
): Promise<{ ok: boolean; detail: string }> {
	const mb = (n: number) => (n / 1024 ** 2).toFixed(0);
	const over = partSizes.filter(s => s > 100 * 1024 ** 2);
	const bad =
		over.length > 0
			? `；有 ${over.length} 个文件超过 GitHub 的 100MB 单文件硬限（最大 ${mb(Math.max(...over))}MB）`
			: "";
	return {
		ok: datasetBytes <= DATASET_TOTAL_LIMIT && over.length === 0,
		detail:
			`dataset 合计 ${mb(datasetBytes)}MiB（目标 ≤${mb(DATASET_TOTAL_LIMIT)}MiB），` +
			`${partSizes.length} 个 parquet，最大 ${mb(Math.max(0, ...partSizes))}MB${bad}`,
	};
}

// 第 1 层 · 字典自证（spec §9.1）：库内 topic_dict 与构建期权威副本逐条比对。
// 后两条断言是第 2 层「由上下界推出无悬空 id」的前提——
// line_id 必须密集覆盖 [1, count] 且 line 无重复，否则区间内的 id 未必存在。
export async function verifyDictSelfCheck(
	conn: DuckDBConnection,
	dictPath: string
): Promise<CheckResult> {
	if (!existsSync(dictPath)) {
		return {
			name: "字典自证",
			ok: false,
			detail:
				`缺少字典副本 ${dictPath}（构建期产物）。它与库一同产出、名字固定，` +
				`把库复制到别处时须连它一起复制`,
		};
	}
	const file = new Map<number, string>();
	for (const ln of (await readFile(dictPath, "utf8")).split("\n")) {
		if (!ln.trim()) continue;
		const o = JSON.parse(ln) as { line_id: number; line: string };
		file.set(Number(o.line_id), o.line);
	}
	// one() 返回的已是「首行的各列」（内部取 rows[0]），故这里拿到的是标量而非行数组，
	// 直接当数字用，不能再取 [0]（那样恒为 undefined，密集性判定会永远为假）
	const [n, maxId, nUniqLine] = await one(
		conn,
		"SELECT count(*), coalesce(max(line_id), 0), count(DISTINCT line) FROM topic_dict"
	);
	const dbRows = await (await conn.run("SELECT line_id, line FROM topic_dict")).getRowsJS();
	const db = new Map(dbRows.map(r => [Number(r[0]), String(r[1])]));
	const diff: string[] = [];
	for (const [id, line] of file) if (db.get(id) !== line) diff.push(`line_id=${id}`);
	for (const id of db.keys()) if (!file.has(id)) diff.push(`line_id=${id}（副本中不存在）`);
	// 密集无空洞：id ∈ [1, count]。第 2 层的上下界推论依赖此性质
	const dense = Number(n) === Number(maxId);
	const ok = diff.length === 0 && dense && Number(nUniqLine) === Number(n);
	return {
		name: "字典自证",
		ok,
		detail:
			`字典 ${n} 条（副本 ${file.size} 条）最大 id=${maxId} 唯一行=${nUniqLine} 差异=${diff.length}` +
			(dense ? "" : `（id 不密集，存在空洞；首个差异：${diff[0] ?? "无"}）`),
	};
}

// 第 2 层 · 引用完整性（spec §9.1）：不展开数组。
// 逐元素检查要 unnest 约 5.7 亿个 id（6,739,200 行 × 平均约 85 行），代价远超它要证明的结论；
// 而「第 1 层已证 id 密集 + 本层的上下界」即可推出无悬空 id。
export async function verifyReferentialIntegrity(conn: DuckDBConnection): Promise<CheckResult> {
	const [nSamples] = await one(conn, "SELECT count(*) FROM samples");
	const [nDistinct, nRows] = await one(
		conn,
		"SELECT count(DISTINCT sample_id), count(*) FROM topic_lines"
	);
	const [nDup] = await one(
		conn,
		"SELECT count(*) FROM (SELECT sample_id, topic FROM topic_lines GROUP BY ALL HAVING count(*) <> 1)"
	);
	const [maxDict] = await one(conn, "SELECT coalesce(max(line_id), 0) FROM topic_dict");
	// 空数组的 list_min/list_max 为 NULL，coalesce 成 1 后不构成越界，故「文本为 NULL」不会被误判
	const [outOfRange] = await one(
		conn,
		`
    SELECT count(*) FROM topic_lines
    WHERE coalesce(list_max(line_ids), 1) > ${maxDict} OR coalesce(list_min(line_ids), 1) < 1`
	);
	const ok =
		Number(nDistinct) === Number(nSamples) &&
		Number(nRows) === Number(nSamples) * 13 &&
		Number(nDup) === 0 &&
		Number(outOfRange) === 0;
	return {
		name: "引用完整性",
		ok,
		detail:
			`样本覆盖 ${nDistinct}/${nSamples} topic_lines=${nRows}（应为 ${Number(nSamples) * 13}）` +
			`「样本×主题」重复=${nDup} id越界=${outOfRange}`,
	};
}

// 第 3 层 · 文本逐字节对账（spec §9.1）：按分片分块，块内两侧都归约为
// (sample_id, topic, md5(文本)) 后**一次比对抓两个方向**。md5 对整段文本计算，
// 故行序错乱同样会抓到。
//
// 比对用 FULL OUTER JOIN + IS DISTINCT FROM，不用 EXCEPT（实测）：
// 两个含 unnest 的**视图**做 EXCEPT，即使只取 6,000 个样本、只比 2 个主题列，
// 在 4GB 内存上限下也直接 OOM；把四个 EXCEPT 计数写成同一个 SELECT 的四个兄弟标量子
// 查询同样 OOM。EXCEPT 两侧必须是已物化且行数已被分块限住的临时表才可行，
// 而一旦两侧都是临时表，FULL OUTER JOIN 就是更省的选择：实测 2,160 样本 / 28,080 行
// 上 2ms 完成，且能同时报告「仅源有」「仅库有」与「哈希不同」三种差异。
//
// 源侧取构建时的输入 .jsonl.gz——源文件是构建真正读入的原始数据，比库侧视图更强。
// 源侧必须是单次扫描 + 对齐 unnest：13 路 UNION ALL
// 在同规模下直接 OOM（实测 3 分片 / 2GB）。
//
// 分块按「库里实际有哪些月份」推导，故范围构建（--from-year/--to-year）也能正确对账，
// 不会把库里没有的月份算成差异。实测 3 分片 / 2,160 样本 / 28,080 行：232ms 通过，
// 差异 0；12 分片 / 8,640 样本在 2GB 下 OOM。块的约束来自文本总量而非样本数。
export async function verifyTopicText(
	conn: DuckDBConnection,
	src: string,
	chunkShards = 3,
	layout: DbLayout = "inline"
): Promise<CheckResult> {
	// 源不存在即降级为 SKIP 而非 FAIL：samples-out/ 不入库，clone 后必然无源。
	// 但无源时证明力确实更低（只能证明数据集自洽，不能证明它与源一致），
	// 故 detail 里写明，且由 main 汇总进末行结论。
	if (!existsSync(src)) {
		return {
			name: "文本对账",
			ok: true,
			skipped: true,
			detail: `SKIP（源目录不存在：${src}。无源时只能证明数据集自洽，不能证明它与源一致）`,
		};
	}
	// 'parquet' 布局（dataset 载体库）的库侧数据来自 topics 视图定义里的 read_parquet 路径。
	// 这里不接受 dbPath：从库路径推导只对「按当前固定名规则建出的库」成立，规则改动前建出的库
	// 会把数据放在别处，推出一个不存在的目录，让对账读错数据却报 PASS。视图里写的才是库实际读的那一个。
	const topicsParquetPath =
		layout === "parquet" ? parquetPathFromViewSql((await topicsViewSqlOf(conn)) ?? "") : null;
	if (layout === "parquet" && topicsParquetPath === null) {
		throw new Error(
			"结构表-only 形态的文本对账读不出 read_parquet 路径：" +
				"topics 视图不是 read_parquet 字面量形态，无法确定库侧数据来自哪里"
		);
	}
	// 与构建期同一套结构声明，避免两侧 schema 分叉
	const { READ_JSON_COLUMNS } = await import("./build-duckdb");
	// 分块是为了把峰值内存压在 2GB 以内；本层注册在所有检查之后，故这两个会话级设置
	// 不会影响其它检查（它们此前已经跑完）
	await conn.run("SET memory_limit='2GB'");
	await conn.run("SET preserve_insertion_order=false");
	const months = (
		await (await conn.run("SELECT DISTINCT year, month FROM samples ORDER BY 1, 2")).getRowsJS()
	).map(r => ({ year: Number(r[0]), month: Number(r[1]) }));
	if (months.length === 0) return { name: "文本对账", ok: false, detail: "库内 samples 为空" };

	const topicNames = TOPIC_KEYS.map(k => `'${k}'`).join(", ");
	const topicCols = TOPIC_KEYS.map(k => `r.topics.${k}`).join(", ");
	// 'parquet' 布局的库侧取 Parquet 的平铺列（不是 r.topics.xxx）：13 列直接以列名引用。
	// TOPIC_KEYS 顺序与构建期 topicsTo 的列序一致，共用同一常量不会漂移。
	const topicColsParquet = TOPIC_KEYS.join(", ");
	let compared = 0;
	const problems: string[] = [];
	const totalChunks = Math.ceil(months.length / chunkShards);
	for (let i = 0; i < months.length; i += chunkShards) {
		const chunk = months.slice(i, i + chunkShards);
		// 进度走 stderr：真实的 720 分片对账要跑几分钟、期间毫无输出，看起来像卡住。
		// 不走 stdout 是因为 stdout 必须与验收版逐项一致（spec §9.1），容不下进度行；
		// 副作用是 `verify:db | tee` 之类的管道仍能得到干净的报告。
		console.error(
			`文本对账: [${i / chunkShards + 1}/${totalChunks}] ` +
				`${chunk[0].year}-${chunk[0].month} 起 ${chunk.length} 个月`
		);
		const files = chunk.map(m =>
			path.join(
				src,
				`year-${m.year}`,
				`${m.year}-${String(m.month).padStart(2, "0")}.jsonl.gz`
			)
		);
		const absent = files.filter(f => !existsSync(f));
		if (absent.length > 0) {
			problems.push(`源分片缺失 ${absent[0]}`);
			continue;
		}
		const lo = sampleId(chunk[0].year, chunk[0].month, 1, 0, "male");
		const last = chunk[chunk.length - 1];
		const hi = sampleId(last.year, last.month, 30, 11, "female");
		// read_json 不接受 LIST 绑定参数（实测 "Cannot create values of type ANY"），
		// 故文件列表必须拼成 SQL 列表字面量，路径按规范转义单引号
		await conn.run(`CREATE OR REPLACE TEMP TABLE src_h AS
      SELECT sample_id, topic, md5(txt) AS h FROM (
        SELECT ${sqlSampleIdExpr("r.birthInfo")} AS sample_id,
               unnest([${topicNames}]) AS topic,
               unnest([${topicCols}])  AS txt
        FROM read_json([${files.map(sqlLiteral).join(", ")}],
                       format='newline_delimited', columns=${READ_JSON_COLUMNS}) AS r
      )`);
		// 视图侧必须用 LEFT JOIN 展开：空 line_ids（源侧为 NULL 文本）在逗号连接下会整行消失，
		// 于是「源有一行 NULL、库无此行」被误报成差异。LEFT JOIN 下该行保留、string_agg 无输入
		// → NULL，与源侧 md5(NULL) 相同，IS DISTINCT FROM 判为一致（实测确认）。
		if (layout === "parquet") {
			// 'parquet' 布局：库侧改读库外 Parquet（dataset 载体库）。视图本身没有 sample_id 范围过滤的下推问题，
			// 但仍按块限定范围，让两侧的物化规模一致（块大小是内存约束，不是正确性约束）。
			await conn.run(`CREATE OR REPLACE TEMP TABLE view_h AS
        SELECT sample_id, topic, md5(txt) AS h FROM (
          SELECT sample_id,
                 unnest([${topicNames}])       AS topic,
                 unnest([${topicColsParquet}]) AS txt
          FROM read_parquet(${sqlLiteral(topicsParquetPath as string)})
          WHERE sample_id BETWEEN ${lo} AND ${hi}
        )`);
		} else {
			await conn.run(`CREATE OR REPLACE TEMP TABLE view_h AS
        SELECT tl.sample_id, tl.topic, md5(string_agg(d.line, chr(10) ORDER BY u.ord)) AS h
        FROM topic_lines tl
        LEFT JOIN unnest(tl.line_ids) WITH ORDINALITY AS u(id, ord) ON TRUE
        LEFT JOIN topic_dict d ON d.line_id = u.id
        WHERE tl.sample_id BETWEEN ${lo} AND ${hi}
        GROUP BY tl.sample_id, tl.topic`);
		}
		const [nSrc] = await one(conn, "SELECT count(*) FROM src_h");
		const [diff] = await one(
			conn,
			`
      SELECT count(*) FROM src_h s FULL OUTER JOIN view_h v USING (sample_id, topic)
      WHERE s.h IS DISTINCT FROM v.h`
		);
		compared += Number(nSrc);
		if (Number(diff) !== 0) {
			problems.push(
				`${chunk[0].year}-${chunk[0].month} 起 ${chunk.length} 个月：` +
					`源 ${nSrc} 行，${diff} 个「样本×主题」不一致（哈希不同或一侧整行缺失）`
			);
		}
	}
	return {
		name: "文本对账",
		ok: problems.length === 0,
		detail:
			problems.length === 0
				? `${months.length} 个月分 ${totalChunks} 块，逐字节一致（${compared} 行）`
				: problems.slice(0, 3).join("; "),
	};
}

// read_json 的文件列表无法用绑定参数传（实测 "Cannot create values of type ANY"），
// 只能拼 SQL 字面量；sqlLiteral 从 tools/db/db 导入（与构建期同一份实现）。

// 逐项求值：任一检查抛异常只作废该项，不能让整份报告消失。
// 校验脚本最需要说话的时刻（数据损坏）恰恰是最容易抛异常的时刻——
// 此前主题行缺失会在此处抛 TypeError，用户看到的是「脚本坏了」而非「数据集坏了」。
async function guard(name: string, fn: () => Promise<CheckResult>): Promise<CheckResult> {
	try {
		return await fn();
	} catch (e) {
		return {
			name,
			ok: false,
			detail: `检查未能完成：${e instanceof Error ? e.message : String(e)}`,
		};
	}
}

// 校验目标（spec §6.1）：有 dataset/ 就用 dataset，库只在没有 dataset/ 时才用。
// 顺序不能反——库在 dataset 形态下只是构建载体，库内 topics 视图烧死了构建时的绝对路径：
// 走库会让「产物被搬到别处」的校验去读**旧目录**（旧目录还在时报 PASS，校验的根本不是这份
// 产物；旧目录没了则报路径错误）。dataset 路径下视图按当次 --out 现建，路径永远指向本次目录。
// viaDb 表示**实际走了哪条路**（不是「文件是否存在」），形态判定与末行措辞都用它。
export async function openVerifyTarget(
	outDir: string
): Promise<{ conn: DuckDBConnection; viaDb: boolean; datasetDir: string }> {
	const datasetDir = datasetDirIn(outDir);
	const dbPath = dbPathIn(outDir);
	if (existsSync(datasetDir)) {
		const instance = await DuckDBInstance.create(":memory:");
		const conn = await instance.connect();
		await conn.run("SET threads=4");
		await conn.run("SET memory_limit='4GB'");
		for (const stmt of datasetSchemaSql(datasetDir)) await conn.run(stmt);
		return { conn, viaDb: false, datasetDir };
	}
	return { conn: await openReadOnly(dbPath), viaDb: true, datasetDir };
}

async function main() {
	rejectDeletedArgs();
	const src = parseArg("src", path.join(ROOT, "samples-out"));
	const outDir = parseArg("out", ROOT);
	const datasetDir = datasetDirIn(outDir);
	const dbPath = dbPathIn(outDir);
	const dictPath = dictPathFor(dbPath);
	const hasDb = existsSync(dbPath);
	const hasDataset = existsSync(datasetDir);
	const hasSrc = existsSync(src);

	// 两者都没有时必须在**打开连接之前**退出：无库时 openVerifyTarget 会去建
	// read_parquet 视图，而 dataset/ 不存在的话那条语句直接抛错，报错会指向
	// 「文件找不到」，与真实原因（分发物缺失）差得很远。
	if (!hasDb && !hasDataset) {
		console.error(`既无库 ${dbPath}，也无 dataset 目录 ${datasetDir}`);
		process.exitCode = 1;
		return;
	}

	const { conn, viaDb } = await openVerifyTarget(outDir);
	// 形态判定：走库时从库结构判；走 dataset 时（视图按当次 --out 现建）必定是 parquet 形态——
	// 库不参与，唯一能建出 topics 的途径就是 dataset/ 下的 parquet。
	// detectLayout 的三态含 'unknown'，它不在 DbLayout 里，故先接住再收窄。
	const detected: "inline" | "parquet" | "unknown" = viaDb ? await detectLayout(conn) : "parquet";
	if (detected === "unknown") {
		conn.closeSync();
		console.error(
			`无法识别的库格式：${dbPath}（既无 topic_dict/topic_lines，` +
				`也无 read_parquet 形态的 topics 视图），请用 build:db --force 重建`
		);
		process.exitCode = 1;
		return;
	}
	const layout: DbLayout = detected;
	const parquetLayout = layout === "parquet";
	const skipNoDict = (name: string): CheckResult => ({
		name,
		ok: true,
		skipped: true,
		detail: "SKIP（原文形态无字典表，行字典的变号与悬空 id 在本形态不存在）",
	});
	const results: CheckResult[] = [
		await guard("总量", () => verifyCounts(conn, layout)),
		await guard("维度覆盖", () => verifyDimensions(conn)),
		await guard("四化一致性", () => verifySihuaConsistency(conn)),
		await guard("抽样深度比对", () => verifySampling(conn, src)),
		await guard("体积报告", () => verifySize(conn, dbPath, layout, outDir)),
		parquetLayout
			? skipNoDict("字典自证")
			: await guard("字典自证", () => verifyDictSelfCheck(conn, dictPath)),
		parquetLayout
			? skipNoDict("引用完整性")
			: await guard("引用完整性", () => verifyReferentialIntegrity(conn)),
		await guard("文本对账", () => verifyTopicText(conn, src, 3, layout)),
	];
	conn.closeSync();
	for (const r of results) {
		const tag = r.skipped ? "SKIP" : r.ok ? "PASS" : "FAIL";
		console.log(`${tag}  ${r.name}: ${r.detail}`);
	}
	const failed = results.some(r => !r.ok);
	if (failed) {
		// 用 exitCode 而非 process.exit(1)：避免管道下 stdout 未及刷新就被截断
		process.exitCode = 1;
		return;
	}
	const skipped = results.filter(r => r.skipped).length;
	if (layout === "inline" && skipped === 0) {
		// spec §9 标准 1：inline 完整校验的末行必须与验收版逐字节一致（恰好「全部校验通过」）
		console.log("全部校验通过");
	} else {
		// 无源时末行必须说明证明力边界：4 PASS 与 6 PASS 不等价
		// 措辞按**实际校验目标**分岔（viaDb），不是按文件存在性：走 dataset 路径时校验的
		// 就是分发物本身，库在不在都不改变这一点；只有确实没有库文件时才标注「无库」。
		const label = viaDb
			? layout === "inline"
				? "inline"
				: "dataset 形态"
			: hasDb
				? "dataset 形态"
				: "dataset 形态（无库）";
		console.log(
			skipped > 0
				? `全部可执行的校验通过（${label}，${skipped} 项 SKIP${hasSrc ? "" : "，其中含缺源项——未与源比对"}）`
				: `全部校验通过（${label}）`
		);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(e => {
		console.error(e);
		process.exitCode = 1;
	});
}
