// 用法: npm run build:db [-- --out=DIR] [-- --force] [-- --mode=inline|dataset]
//                      [-- --from-year=N] [-- --to-year=N] [-- --src=DIR]
//      参数同时支持 --key=value 与 --key value 两种写法
// 默认 src=./samples-out out=仓库根（spec §6）；--mode 默认 inline。
// --out 只给一个目录，目录内的名字全部固定（唯一定义处：tools/db/db.ts 的 dbPathIn / datasetDirIn）：
//   <out>/ziwei.duckdb               库文件
//   <out>/dataset/                   分发 parquet 目录（仅 --mode=dataset）
//   <out>/dataset.staging/           重打包前的暂存（仅 --mode=dataset，收尾后删除）
//   <out>/ziwei.duckdb.dict.jsonl    行字典副本；<out>/ziwei.duckdb.progress.json 构建进度
import { existsSync, statSync } from "node:fs";
// readdir 仍被 listShards 用来枚举磁盘分片，不可删
import { readFile, writeFile, readdir, rm, statfs, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DuckDBConnection } from "@duckdb/node-api";
import { DuckDBInstance } from "@duckdb/node-api";
import {
	createDb,
	dbPathIn,
	deletedArgHint,
	detectLayout,
	dictPathFor,
	searchTopicMacroSql,
	sqlLiteral,
	topicsViewSql,
	TOPIC_KEYS,
	TOPIC_LINES_INDEX_SQL,
	datasetDirIn,
	datasetStagingDirIn,
	topicsPartName,
	topicsViewSqlDataset,
	DATASET_PART_SAMPLES,
	DATASET_PART_MAX_BYTES,
	type DbLayout,
} from "./db";
import { SQL_SAMPLE_ID_EXPR } from "./sample-id";

// ROOT 是 **skill 根**（仓库根），不是 tools/：本文件在 <skill 根>/tools/db/ 下，
// 故要退两层。少退一层会让默认 --src 落到 tools/samples-out（不存在）——
// 语料在 <skill 根>/samples-out，症状是启动即 ENOENT scandir，与「语料缺失」难以区分。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

interface Args {
	src: string;
	out: string;
	force: boolean;
	mode: "inline" | "dataset";
	fromYear?: number;
	toYear?: number;
	minFreeGb: number;
	batchShards: number;
}

function parseArgs(argv: string[]): Args {
	const a: Args = {
		src: path.join(ROOT, "samples-out"),
		out: ROOT,
		force: false,
		mode: "inline", // spec §3.1：不传 = 与已验收版本逐项一致
		minFreeGb: 40, // spec §9：默认 40GB 门槛
		batchShards: 24, // 见 main 中「按批提交」注释
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--force") {
			a.force = true;
			continue;
		}
		const eq = arg.indexOf("=");
		const key = eq >= 0 ? arg.slice(0, eq) : arg;
		const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;
		const value = (): string => {
			if (inline !== undefined) return inline;
			const next = argv[++i];
			if (next === undefined) throw new Error(`参数缺值: ${key}`);
			return next;
		};
		if (key === "--from-year") a.fromYear = Number(value());
		else if (key === "--to-year") a.toYear = Number(value());
		else if (key === "--src") a.src = path.resolve(value());
		else if (key === "--out") a.out = path.resolve(value());
		else if (key === "--mode") a.mode = parseMode(value());
		else if (key === "--min-free-gb") a.minFreeGb = Number(value());
		else if (key === "--batch-shards") a.batchShards = Math.max(1, Number(value()));
		else if (key === "--db" || key === "--topics-dir") throw new Error(deletedArgHint(key));
		else throw new Error(`未知参数: ${arg}`);
	}
	return a;
}

// spec §3.1（修订）：形态由 --mode 选择，默认 inline（不传 = 与已验收版本逐项一致）。
// 非法值必须报错而不是回退：用户传了旧形态却拿到 inline 库，是一种
// 无声的、事后才发现的错误。故只做精确匹配，不接受大小写或空白变体。
export function parseMode(raw: string): "inline" | "dataset" {
	if (raw === "inline") return "inline";
	if (raw === "dataset") return "dataset";
	if (raw === "parquet" || raw === "sidecar") {
		throw new Error(
			`--mode=${raw} 已删除：改用 --mode=dataset（dataset 形态取代了它，` +
				"产出从「库 + 边车目录」变为「无库，全部在 dataset/ 下」）"
		);
	}
	throw new Error(
		`--mode 取值非法: ${JSON.stringify(raw)}（合法值: inline | dataset，不传等同 inline）`
	);
}

// 形态选择已从环境变量迁到 --mode（spec §3.1 修订）。残留的旧变量必须报错而非静默
// 忽略：`ZIWEI_DB_MODE=parquet npm run build:db` 若被忽略，用户拿到的是一个自足的
// inline 库——形态与体积都与预期不符，却要等到下游找不到 dataset 目录时才暴露。
// 空值不表达任何形态意图（等同未设），不报错。
export function rejectLegacyModeEnv(env: NodeJS.ProcessEnv = process.env): void {
	const raw = env.ZIWEI_DB_MODE;
	if (raw === undefined || raw === "") return;
	throw new Error(
		`ZIWEI_DB_MODE 已废弃（当前值 ${JSON.stringify(raw)}），形态改用命令行参数：` +
			"--mode=inline 或 --mode=dataset（不传等同 inline）"
	);
}

// read_json 显式 schema（spec §3 字段；siHua 空串/字段缺失均合法，brightness 可缺失）
// columns 的 struct 形式要求「值」为 VARCHAR 类型串，嵌套类型须写成类型字符串而非嵌套 struct。
export const READ_JSON_COLUMNS = `{
  'birthInfo': 'STRUCT(year SMALLINT, month SMALLINT, day SMALLINT, hour SMALLINT, gender VARCHAR, longitude DOUBLE)',
  'chart': 'STRUCT(lunarInfo STRUCT(lunarYear SMALLINT, lunarMonth SMALLINT, lunarDay SMALLINT, yearStem TINYINT, yearBranch TINYINT, isLeapMonth BOOLEAN), mingGongBranch TINYINT, shenGongBranch TINYINT, wuxingJu TINYINT, wuxingJuName VARCHAR, ziweiPos TINYINT, palaces STRUCT(branch TINYINT, stem TINYINT, name VARCHAR, stars STRUCT(name VARCHAR, type VARCHAR, brightness VARCHAR, siHua VARCHAR)[], daXianAge SMALLINT[], isMingGong BOOLEAN, isShenGong BOOLEAN, isCurrentDaXian BOOLEAN)[], daXians STRUCT(startAge SMALLINT, endAge SMALLINT, palaceBranch TINYINT, palaceName VARCHAR)[], currentAge SMALLINT, currentDaXianIndex SMALLINT)',
  'topics': 'STRUCT(overview VARCHAR, personality VARCHAR, love VARCHAR, career VARCHAR, wealth VARCHAR, health VARCHAR, family VARCHAR, children VARCHAR, move VARCHAR, friends VARCHAR, home VARCHAR, spirit VARCHAR, parents VARCHAR)',
  'system': 'VARCHAR'
}`;

export function shardSql(): {
	temp: string;
	cleanPalaces: string;
	cleanSamples: string;
	cleanTopicLines: string;
	palaces: string;
	samples: string;
	topicPairs: string;
	dictInsert: string;
	dictMisses: string;
	topicLineRows: string;
	encodeTopicLines: string;
	topicsTo: (parquetPath: string) => string;
	dropTemps: string[];
} {
	const readJson = `read_json(?, format='newline_delimited', columns=${READ_JSON_COLUMNS})`;
	// 幂等插入：先按本分片的 sample_id 删掉旧行再插。这使「已提交但尚未记账」（进度
	// 未落盘即崩溃）的分片可以安全重做，而不必撞主键冲突后被永久跳过。
	// 正常路径上删 0 行，走主键索引，开销可忽略。
	const idInShard = `SELECT ${SQL_SAMPLE_ID_EXPR} FROM shard`;
	const topicNames = TOPIC_KEYS.map(k => `'${k}'`).join(", ");
	const topicCols = TOPIC_KEYS.map(k => `topics.${k}`).join(", ");
	return {
		temp: `CREATE OR REPLACE TEMP TABLE shard AS SELECT * FROM ${readJson}`,
		cleanPalaces: `DELETE FROM palaces WHERE sample_id IN (${idInShard})`,
		cleanSamples: `DELETE FROM samples WHERE sample_id IN (${idInShard})`,
		cleanTopicLines: `DELETE FROM topic_lines WHERE sample_id IN (${idInShard})`,
		palaces: `
      INSERT INTO palaces
      SELECT ${SQL_SAMPLE_ID_EXPR} AS sample_id,
        p.name AS palace_name, p.branch, p.stem,
        list_transform(list_filter(p.stars, s -> s.type='major'), s -> s.name) AS major_stars,
        list_transform(list_filter(p.stars, s -> s.type='lucky'),  s -> s.name) AS lucky_stars,
        list_transform(list_filter(p.stars, s -> s.type='sha'),    s -> s.name) AS sha_stars,
        list_transform(list_filter(p.stars, s -> s.type='minor'),  s -> s.name) AS minor_stars,
        list_transform(list_filter(p.stars, s -> s.type='major'),  s -> coalesce(s.brightness,'')) AS major_brightness,
        array_to_string(list_transform(list_filter(p.stars, s -> s.siHua IS NOT NULL AND s.siHua <> ''), s -> s.siHua), ',') AS sihua_flags,
        list_transform(list_filter(p.stars, s -> s.siHua IS NOT NULL AND s.siHua <> ''), s -> s.name || ':' || s.siHua) AS sihua_stars,
        p.isMingGong, p.isShenGong, p.isCurrentDaXian,
        p.daXianAge[1] AS daxian_start, p.daXianAge[2] AS daxian_end
      FROM shard, UNNEST(shard.chart.palaces) AS u(p)`,
		samples: `
      WITH sx AS (
        SELECT ${SQL_SAMPLE_ID_EXPR} AS sample_id, st.name AS star, st.siHua AS sihua, p.name AS palace
        FROM shard, UNNEST(shard.chart.palaces) AS u(p), UNNEST(p.stars) AS t(st)
        WHERE st.siHua IS NOT NULL AND st.siHua <> ''
      )
      INSERT INTO samples
      SELECT ${SQL_SAMPLE_ID_EXPR}, j.birthInfo.year, j.birthInfo.month, j.birthInfo.day, j.birthInfo.hour,
        j.birthInfo.gender, j.birthInfo.longitude,
        j.chart.lunarInfo.lunarYear, j.chart.lunarInfo.lunarMonth, j.chart.lunarInfo.lunarDay,
        j.chart.lunarInfo.yearStem, j.chart.lunarInfo.yearBranch, j.chart.lunarInfo.isLeapMonth,
        j.chart.mingGongBranch, j.chart.shenGongBranch, j.chart.wuxingJu, j.chart.wuxingJuName, j.chart.ziweiPos,
        j.chart.currentAge, j.chart.currentDaXianIndex,
        f.lu_star, f.quan_star, f.ke_star, f.ji_star, f.lu_palace, f.quan_palace, f.ke_palace, f.ji_palace
      FROM shard j
      LEFT JOIN (
        SELECT sample_id,
          max(CASE WHEN sihua='禄' THEN star END)   AS lu_star,   max(CASE WHEN sihua='禄' THEN palace END)   AS lu_palace,
          max(CASE WHEN sihua='权' THEN star END)   AS quan_star, max(CASE WHEN sihua='权' THEN palace END)   AS quan_palace,
          max(CASE WHEN sihua='科' THEN star END)   AS ke_star,   max(CASE WHEN sihua='科' THEN palace END)   AS ke_palace,
          max(CASE WHEN sihua='忌' THEN star END)   AS ji_star,   max(CASE WHEN sihua='忌' THEN palace END)   AS ji_palace
        FROM sx GROUP BY sample_id
      ) f ON f.sample_id = ${SQL_SAMPLE_ID_EXPR}`,
		// 13 个文本列展开成 (topic, txt) 行。必须写成「同一 SELECT 列表里两个 unnest」——
		// DuckDB 会按位置并行展开（zip），而不是笛卡尔积（实测 13 列 × 2,160 样本 = 28,080 行，
		// 而非 2,160²）。这也是唯一能容纳全量主题文本的写法：13 路 UNION ALL 在同规模下直接 OOM
		// （spec §9.1 第 3 层）。
		topicPairs: `CREATE OR REPLACE TEMP TABLE shard_pairs AS
      SELECT sample_id, topic, txt FROM (
        SELECT ${SQL_SAMPLE_ID_EXPR} AS sample_id,
               unnest([${topicNames}]) AS topic,
               unnest([${topicCols}])  AS txt
        FROM shard
      ) y`,
		// pass 1：把本分片里字典还没有的行追加进去。id 从 max(line_id)+1 起顺延，
		// 只追加、永不重排——重排会让已建分片的 line_ids 整片错配（spec §7.2）。
		// NULL 文本的 string_split 为 NULL、unnest 出 0 行，故不会写入任何行（spec §6.3）。
		dictInsert: `INSERT INTO topic_dict (line_id, line)
      SELECT (SELECT coalesce(max(line_id), 0) FROM topic_dict) + row_number() OVER (ORDER BY ln), ln
      FROM (SELECT DISTINCT ln FROM shard_pairs p, unnest(string_split(p.txt, chr(10))) AS u(ln)) d
      WHERE d.ln NOT IN (SELECT line FROM topic_dict)`,
		// pass 2 断言：展开出的每一行都必须命中字典。数据为程序生成，应当零失败；
		// 命中不了说明源与字典不一致，此时写下去的会是悬空 id，必须中止而非静默写入。
		dictMisses: `SELECT count(*) FROM shard_lines sl
      LEFT JOIN topic_dict d ON d.line = sl.ln WHERE d.line_id IS NULL`,
		// 拆行并对齐原文行序（ord 即行在原文中的位置）
		topicLineRows: `CREATE OR REPLACE TEMP TABLE shard_lines AS
      SELECT sample_id, topic, ord, ln FROM shard_pairs p,
        unnest(string_split(p.txt, chr(10))) WITH ORDINALITY AS u(ln, ord)`,
		// 编码：每个「样本 × 主题」一行。两个细节缺一不可（spec §6.3）——
		//   FILTER：list() 与 string_agg 不同，它保留 NULL 元素，不过滤会写成 [NULL]
		//   coalesce：NULL 文本（拆行 0 行）必须落成空数组，视图那边才会还原成 NULL
		//   而空串文本走 string_split('' , chr(10)) → ['']，自然落成一个空串行号，不受影响
		encodeTopicLines: `INSERT INTO topic_lines (sample_id, topic, line_ids)
      SELECT p.sample_id, p.topic,
             coalesce(list(d.line_id ORDER BY sl.ord) FILTER (WHERE d.line_id IS NOT NULL), []::INTEGER[])
      FROM shard_pairs p
      LEFT JOIN shard_lines sl ON sl.sample_id = p.sample_id AND sl.topic = p.topic
      LEFT JOIN topic_dict d ON d.line = sl.ln
      GROUP BY p.sample_id, p.topic`,
		// 库外 Parquet（dataset 逐源分片）：把本分片的 13 列主题文本直接写成 Parquet(zstd)。
		// 列序与 inline 的 topics 视图一致，故两份文档里的查询 SQL 完全相同。
		// 必须带上 sample_id：视图按 SELECT * 暴露，行必须能对回 samples。
		topicsTo: (parquetPath: string) => `
      COPY (
        SELECT ${SQL_SAMPLE_ID_EXPR} AS sample_id,
          topics.overview, topics.personality, topics.love, topics.career, topics.wealth,
          topics.health, topics.family, topics.children, topics.move, topics.friends,
          topics.home, topics.spirit, topics.parents
        FROM shard
      ) TO ${sqlLiteral(parquetPath)} (FORMAT PARQUET, COMPRESSION ZSTD)`,
		// 三个临时表都带 IF EXISTS，两趟各自调用同一份 dropTemps 也不会报错
		dropTemps: [
			"DROP TABLE IF EXISTS shard",
			"DROP TABLE IF EXISTS shard_pairs",
			"DROP TABLE IF EXISTS shard_lines",
		],
	};
}

// 分片级临时表清理：这里的失败绝不能顶替 try 里的原始异常。read_json 解析失败会把
// 事务置为 aborted，此后每条语句（含这几条 DROP）都只报 `Current transaction is
// aborted (please ROLLBACK)`，而 finally 抛出的次级异常会挤掉真正的错误——spec §9
// 要求透给用户的「第几行第几列解析失败」正因此从未到达过用户。三张临时表都带
// IF EXISTS，唯一会失败的情形就是事务已 aborted；临时表随连接消失，残留无害。
async function dropTempsQuietly(conn: DuckDBConnection, stmts: string[]): Promise<void> {
	for (const s of stmts) {
		try {
			await conn.run(s);
		} catch {
			/* 见上 */
		}
	}
}

// pass 1 单分片：只扫字典，不写任何样本数据（不含事务）
export async function scanShardDict(conn: DuckDBConnection, gzPath: string): Promise<void> {
	const sql = shardSql();
	try {
		await conn.run(sql.temp, [gzPath]);
		await conn.run(sql.topicPairs);
		await conn.run(sql.dictInsert);
	} finally {
		await dropTempsQuietly(conn, sql.dropTemps);
	}
}

// pass 2 单分片：palaces / samples（+ inline 的 topic_lines）入库（不含事务边界）。
// topicsParquetPath 给了就走 parquet：主题文本写库外 Parquet，不碰字典两表。
export async function encodeShard(
	conn: DuckDBConnection,
	gzPath: string,
	topicsParquetPath?: string
): Promise<void> {
	const sql = shardSql();
	try {
		await conn.run(sql.temp, [gzPath]);
		await conn.run(sql.cleanPalaces);
		await conn.run(sql.cleanSamples);
		await conn.run(sql.palaces);
		await conn.run(sql.samples);
		if (topicsParquetPath !== undefined) {
			await conn.run(sql.topicsTo(topicsParquetPath));
			return; // finally 里仍会 dropTemps
		}
		await conn.run(sql.cleanTopicLines);
		await conn.run(sql.topicPairs);
		await conn.run(sql.topicLineRows);
		const miss = Number((await (await conn.run(sql.dictMisses)).getRowsJS())[0][0]);
		if (miss > 0)
			throw new Error(`本分片有 ${miss} 行未命中字典（字典与源不一致，拒绝写入悬空 id）`);
		await conn.run(sql.encodeTopicLines);
	} finally {
		await dropTempsQuietly(conn, sql.dropTemps);
	}
}

// COMMIT 之后事务已经结束，此时再 ROLLBACK 会抛「cannot rollback - no transaction
// is active」。它是次级异常，绝不能顶掉原始错误（磁盘满/权限/跨设备都在原始错误里）。
async function rollbackQuietly(conn: DuckDBConnection): Promise<void> {
	try {
		await conn.run("ROLLBACK");
	} catch {
		/* 事务已结束或已回滚，忽略 */
	}
}

// 单分片写入（自带事务）：供需要独立提交的调用方使用。
// 单文件化后主题数据也在库内，三类行同受事务保护，不再需要「提交后才让文件对视图可见」
// 那种跨文件一致性机制。
export async function buildShard(
	conn: DuckDBConnection,
	gzPath: string,
	topicsParquetPath?: string
): Promise<void> {
	await conn.run("BEGIN TRANSACTION");
	try {
		await encodeShard(conn, gzPath, topicsParquetPath);
		await conn.run("COMMIT");
	} catch (e) {
		await conn.run("ROLLBACK");
		throw e;
	}
}

async function listShards(src: string, fromYear?: number, toYear?: number): Promise<string[]> {
	const out: string[] = [];
	for (const dir of (await readdir(src, { withFileTypes: true }))
		.filter(d => d.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name))) {
		const m = dir.name.match(/^year-(\d{4})$/);
		if (!m) continue;
		const y = Number(m[1]);
		if (fromYear !== undefined && y < fromYear) continue;
		if (toYear !== undefined && y > toYear) continue;
		for (const f of (await readdir(path.join(src, dir.name)))
			.filter(f => f.endsWith(".jsonl.gz"))
			.sort()) {
			out.push(path.join(dir.name, f));
		}
	}
	return out;
}

// 暂存里的逐源分片 → dataset/ 里按 sample_id 区间的片。
//
// 这条 SQL 的形态是实测过的（720 片 → 11 片，2 分 13 秒，无 OOM），
// 关键在于它**只做 WHERE 过滤、绝不含 GROUP BY**：inline 库的 topics 是聚合视图，
// 谓词推不穿 GROUP BY，任何分块都拦不住它物化全量文本（spec §3.3 记录的踩坑）。
//
// partSamples 可注入是为了让测试用 7 个样本验证边界，生产调用一律用默认值。
// totalSamples 语义上是「最大的 sample_id」（区间上界）：sample_id 由自然键按 1..518400
// 稠密生成，生产下等于样本总数；测试用稀疏 id 时二者才分叉，故调用方须传 max(sample_id)。
export async function repackDataset(
	conn: DuckDBConnection,
	stagingDir: string,
	datasetDir: string,
	totalSamples: number,
	partSamples: number = DATASET_PART_SAMPLES
): Promise<{ files: string[]; maxBytes: number }> {
	await conn.run("SET threads=4");
	await conn.run("SET memory_limit='4GB'");
	await conn.run("SET preserve_insertion_order=false");
	const glob = sqlLiteral(path.join(stagingDir, "*.parquet"));
	const files: string[] = [];
	let maxBytes = 0;
	for (let lo = 1; lo <= totalSamples; lo += partSamples) {
		const hi = Math.min(lo + partSamples - 1, totalSamples);
		const file = path.join(datasetDir, topicsPartName(lo));
		await conn.run(`COPY (
      SELECT * FROM read_parquet(${glob}) WHERE sample_id BETWEEN ${lo} AND ${hi}
    ) TO ${sqlLiteral(file)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
		const size = statSync(file).size;
		if (size > maxBytes) maxBytes = size;
		if (size > DATASET_PART_MAX_BYTES) {
			throw new Error(
				`片 ${path.basename(file)} 有 ${(size / 1024 ** 2).toFixed(1)}MB，` +
					`超过 ${DATASET_PART_MAX_BYTES / 1024 ** 2}MB 上限（GitHub 单文件限 100MB）。` +
					"请调小 DATASET_PART_SAMPLES 后重跑"
			);
		}
		files.push(file);
	}
	return { files, maxBytes };
}

// dataset 收尾：导出结构表、重打包、建视图、清暂存（spec §5.2）。
//
// 整段包在 try/finally 里：清理暂存放在 finally，任一处 throw（缺暂存、单片超限、
// 行数对账不通过）都不会把 dataset.staging/ 留在盘上——真实数据下它约 1.7GiB，
// 构建失败后残留不可接受（Review：Important）。
//
// done 是已入库的源分片 rel 列表，用于「缺暂存」对账。
export async function finalizeDataset(
	conn: DuckDBConnection,
	stagingDir: string,
	datasetDir: string,
	done: string[]
): Promise<void> {
	try {
		// 与 done 对账：每个已入库分片都必须有暂存 parquet，缺一个就重打包不出来
		const missing = done.filter(
			rel => !existsSync(path.join(stagingDir, path.basename(rel, ".jsonl.gz") + ".parquet"))
		);
		if (missing.length > 0) {
			// 报错必须给出可执行的动作。上一次**成功**的构建已在 finally 里清掉 dataset.staging/，
			// 所以「已完成之后不加 --force 再跑一次」必然落到这里，而缺掉的暂存是补不回来的。
			//
			// 这行 throw 排在 rm(datasetDir) 之前是有意的：此刻盘上那份 dataset/ 是上一次的
			// 完好产物，为一次注定失败的构建把它清掉，比原样留下它代价大得多（Final: Ruling）。
			throw new Error(
				`暂存缺失 ${missing.length} 个分片的 parquet，无法重打包` +
					"（上次构建成功后已清理暂存，直接重跑续不上）。" +
					"请加 --force 从源头重建；已有的 dataset 目录不会被本次失败的构建改动。"
			);
		}

		await rm(datasetDir, { recursive: true, force: true });
		await mkdir(datasetDir, { recursive: true });

		for (const t of ["samples", "palaces"]) {
			await conn.run(
				`COPY (SELECT * FROM ${t}) TO ` +
					`${sqlLiteral(path.join(datasetDir, t + ".parquet"))} (FORMAT PARQUET, COMPRESSION ZSTD)`
			);
		}

		// 重打包按 sample_id 区间切片，区间上界取 max(sample_id) 而非 count(*)：sample_id
		// 在真实数据里稠密（1..518400），二者相等；测试的迷你数据集 id 稀疏，count 会把
		// 大 id 的样本整个漏掉。行数对账单独用 count(*)。
		const sampleCount = Number(
			(await (await conn.run("SELECT count(*) FROM samples")).getRowsJS())[0][0]
		);
		const maxSampleId = Number(
			(await (await conn.run("SELECT max(sample_id) FROM samples")).getRowsJS())[0][0]
		);
		const { files, maxBytes } = await repackDataset(conn, stagingDir, datasetDir, maxSampleId);

		// 行数对账：重打包只做区间过滤，任何样本丢失或重复都必须在这里暴露。
		// 视图此刻尚未绑定 dataset 目录，故先重建再对账。
		await conn.run(topicsViewSqlDataset(datasetDir));
		const nTopics = Number(
			(await (await conn.run("SELECT count(*) FROM topics")).getRowsJS())[0][0]
		);
		if (nTopics !== sampleCount) {
			throw new Error(`重打包后 topics ${nTopics} 行与 samples ${sampleCount} 行不一致`);
		}

		console.log(
			`dataset 收尾：${files.length} 片，最大 ${(maxBytes / 1024 ** 2).toFixed(1)}MB`
		);
	} finally {
		await rm(stagingDir, { recursive: true, force: true });
	}
}

async function main() {
	rejectLegacyModeEnv();
	const args = parseArgs(process.argv.slice(2));
	const mode = args.mode;
	// 输出位置：命令行只给目录，名字固定。三个脚本共用同一组推导函数，
	// 「库在哪、dataset 在哪」因此不可能各推一份而漂移（tools/db/db.ts 的 dbPathIn / datasetDirIn）。
	const dbPath = dbPathIn(args.out);
	const datasetDir = datasetDirIn(args.out);
	const stagingDir = datasetStagingDirIn(args.out);
	const progressPath = dbPath + ".progress.json";
	const dictPath = dictPathFor(dbPath);

	// 「目录不存在」与「目录存在但没有分片」必须分开报，且都要给出可执行的动作。
	// 裸的 ENOENT scandir 只打系统路径，读的人分不出是参数打错还是语料真丢了 ——
	// 而这两者的处置完全相反（改路径 vs 去找/重建语料），误判代价最大。
	if (!existsSync(args.src)) {
		throw new Error(
			`语料目录不存在: ${args.src}\n` +
				`  --src 默认 <skill 根>/samples-out（60 个年份目录 / 720 个 jsonl.gz）。\n` +
				`  同一份语料的只读原始快照在 reference/ziwei-samples-toolkit/samples-out，\n` +
				`  加 --src=<目录> 指向它即可，不必复制。`
		);
	}

	// 只读校验一律排在破坏性操作之前：--force 会删掉旧库、旧进度与字典副本，
	// 若等到删除之后才发现 --src 打错，等于用一个拼错的路径毁掉一份完整构建的可用产物。
	const shards = await listShards(args.src, args.fromYear, args.toYear);
	if (shards.length === 0) {
		throw new Error(
			`目录下没有分片: ${args.src}\n` +
				`  期望 <目录>/year-<YYYY>/*.jsonl.gz；--from-year / --to-year 也会过滤掉全部年份。`
		);
	}

	// 输出目录一般还不存在（`--out=./db` 是最自然的用法），先建出来：紧接着的 statfs
	// 要对它取，DuckDB 建库文件也要求父目录存在。排在源校验之后，一个拼错的 --src
	// 就不会先留下一个空目录。
	await mkdir(args.out, { recursive: true });

	// spec §9：磁盘剩余空间门槛（检查输出库所在文件系统，即真正会增长的那块盘）
	const st = await statfs(path.dirname(dbPath));
	const freeGb = (Number(st.bavail) * Number(st.bsize)) / 1024 ** 3;
	if (freeGb < args.minFreeGb) {
		throw new Error(
			`磁盘剩余空间不足 ${args.minFreeGb}GB（当前 ${freeGb.toFixed(1)}GB），拒绝构建`
		);
	}

	// --force：先清掉旧库、旧进度与字典副本，之后的流程等同于全新构建
	if (args.force) {
		for (const p of [dbPath, dbPath + ".wal", progressPath, dictPath]) {
			if (existsSync(p)) await rm(p, { force: true });
		}
		// dataset 与它的暂存一并清掉。整体清空是必需的：上一次多出来的片若留下，
		// read_parquet 的 glob 会照读不误，重复样本不会报任何错（spec §5.3）。
		if (existsSync(datasetDir)) await rm(datasetDir, { recursive: true, force: true });
		if (existsSync(stagingDir)) await rm(stagingDir, { recursive: true, force: true });
	}

	const dbExists = existsSync(dbPath);
	const progressExists = existsSync(progressPath);
	if (dbExists && !progressExists) {
		throw new Error(`库已存在: ${dbPath}。使用 --force 重建，或删除后重跑`);
	}
	if (!dbExists && progressExists) {
		throw new Error("进度文件存在但库不存在，请删除进度文件后重跑");
	}

	const fresh = !dbExists;
	const done: string[] = fresh
		? []
		: (JSON.parse(await readFile(progressPath, "utf8")).done ?? []);

	// dataset：逐源分片的原文 Parquet 先写 tmp/、随事务提交后再原子改名就位，
	// 因为库外文件不受事务保护（spec §4.2）。暂存目录与 dataset/ 平级，收尾重打包后再清掉。
	const needParquetFiles = mode !== "inline";
	const fileTmpDir = path.join(stagingDir, "tmp");
	if (needParquetFiles) {
		await mkdir(stagingDir, { recursive: true });
		// 清掉上一轮的残留：改名协议保证只有 COMMIT 之后的文件才会进正式目录，
		// 留在 tmp/ 的一律作废（半截 parquet、被 Ctrl-C 打断的批）。不清会一直累积。
		// 并发构建不受影响：库文件的排他锁（DuckDB 单写者）在启动阶段就把第二个进程挡在外面。
		await rm(fileTmpDir, { recursive: true, force: true });
		await mkdir(fileTmpDir, { recursive: true });
	}

	// dataset 形态的库只有结构表，无字典两表（detectLayout 判为 'parquet' 态）。
	// 库在 dataset 形态下是构建载体与本地查询入口，不进分发（.gitignore 覆盖）。
	// 全新构建走 createDb（PRAGMA + 按形态选 DDL）；续建复用既有库，不能重复建表
	const dbLayout: DbLayout = mode === "inline" ? "inline" : "parquet";
	const conn = fresh
		? await createDb(dbPath, dbLayout)
		: await (await DuckDBInstance.create(dbPath)).connect();

	// 形态守卫：必须排在 pass 1 之前。续建路径若直接进 pass 1，会在 dictInsert 处
	// 逐分片报 `Catalog Error: Table topic_dict does not exist`，累计 10 个失败才中止——
	// 用户看到的是一串 Catalog Error，而不是「请用 --force」这一句可执行的提示。
	// 这是 3dd3af5 那条「旧格式库迁移守卫」的推广：两种形态互为对方的「旧格式」。
	if (!fresh) {
		const actual = await detectLayout(conn);
		if (actual === "unknown") {
			throw new Error(
				"库内既无 topic_dict/topic_lines，也没有 read_parquet 形态的 topics 视图" +
					"（改动前的旧格式，或构建未收尾），请用 --force 重建"
			);
		}
		if (actual !== dbLayout) {
			throw new Error(`库内形态是 ${actual}，与 --mode=${mode} 不符，请用 --force 重建`);
		}
	}

	const failures: Array<{ shard: string; error: string }> = [];
	const skipped = new Set<string>();
	const t0 = Date.now();

	// ---- pass 1：全局行字典（仅 inline）----
	// dataset 不需要行字典：主题文本由库外 Parquet 承载，构建因此少读一遍源。
	// 整段包进 inline 分支，dataset 下不写 dict.jsonl。
	if (mode === "inline") {
		// 扫描目标范围内的全部分片（含进度里已 done 的）：字典必须覆盖 pass 2 将要编码的
		// 每一行，而「已 done 的分片其行已在字典里」只是续建路径的巧合，不作依赖。
		// 代价是续建时多读一遍分片；全新构建本来就要读两遍，没有额外损失。
		// 失败分片计入 skipped，pass 2 不再尝试——pass 1 读不了的分片，pass 2 也读不了。
		//
		// 本趟逐分片独立提交，刻意不用 --batch-shards 分批：一批一个事务时无法定位是哪个分片
		// 失败，只能把整批都算作失败——一个坏分片会连坐 23 个正常分片，而 pass 2 只会跳过
		// 真正失败的那一个，两趟的 skipped 集合就此不一致（pass 1 多跳的那些分片会永远缺失，
		// 且构建仍以 exit 0 结束）。分片级事务让两趟的判定完全对齐。
		// topic_dict 全量不过万行，逐分片提交不构成体积问题（行组碎片的顾虑只针对 palaces/samples）。
		console.log(`pass 1/2：扫描 ${shards.length} 个分片建立行字典…`);
		for (const rel of shards) {
			try {
				await conn.run("BEGIN TRANSACTION");
				await scanShardDict(conn, path.join(args.src, rel));
				await conn.run("COMMIT");
			} catch (e) {
				await rollbackQuietly(conn);
				skipped.add(rel);
				failures.push({ shard: rel, error: String(e) });
				console.error(`字典扫描失败，跳过分片 ${rel}:\n${e}`);
				if (failures.length >= 10)
					throw new Error("失败分片达 10 个，中止构建（上游数据异常）");
			}
		}

		// 字典权威副本落盘。必须先比对再覆盖：若库内字典与既有副本不一致（变号），
		// 已建分片的 line_ids 已经指向错误的行，此时覆盖副本等于销毁唯一的证据。
		//
		// 判定的是「旧副本是库内字典的前缀」这一条不变式，含两半：
		//   1) 副本里每个 id 的文本必须一字不变（改写 = 重排，最危险）
		//   2) 库里新增的 id 必须严格大于副本的最大 id（追加，不回填空洞、不复用旧号）
		// 注意**不能**把「库里有、副本里没有」一律判为错：合法续建本来就该产生新行，
		// 那样写会让每一次增量构建都被误判成变号而中止。
		const dictRows = (
			await (
				await conn.run("SELECT line_id, line FROM topic_dict ORDER BY line_id")
			).getRowsJS()
		).map(r => ({ line_id: Number(r[0]), line: String(r[1]) }));
		if (existsSync(dictPath)) {
			const prev = new Map<number, string>();
			for (const ln of (await readFile(dictPath, "utf8")).split("\n")) {
				if (!ln.trim()) continue;
				const o = JSON.parse(ln) as { line_id: number; line: string };
				prev.set(Number(o.line_id), o.line);
			}
			const now = new Map(dictRows.map(r => [r.line_id, r.line]));
			const maxPrev = prev.size > 0 ? Math.max(...prev.keys()) : 0;
			const diff: string[] = [];
			for (const [id, line] of prev) {
				const cur = now.get(id);
				if (cur !== line)
					diff.push(
						cur === undefined ? `line_id=${id} 丢失` : `line_id=${id} 文本被改写`
					);
			}
			for (const id of now.keys())
				if (!prev.has(id) && id <= maxPrev) diff.push(`line_id=${id} 复用了旧号`);
			if (diff.length > 0) {
				throw new Error(
					`行字典与既有副本不一致（${diff.length} 条），已有分片的 line_ids 可能已失效；` +
						`确要重建请用 --force。首个差异：${diff[0]}`
				);
			}
		}
		await writeFile(dictPath, dictRows.map(r => JSON.stringify(r)).join("\n") + "\n");
		console.log(`行字典：${dictRows.length} 条（副本 ${dictPath}）`);
	}

	// 按批提交（而非逐分片提交）：每张表每次提交追加一个新行组，逐分片提交会让行组
	// 碎到每 720 行一个，压缩失效且构建慢 3.3 倍（720 分片实测每分片 100.9 → 51.9 MB；
	// 批次 ≥24 后趋于饱和）。
	// 一批失败则整批回滚，故用待处理队列而非下标推进，失败分片记入 skipped 以免死循环。
	const pending = shards.filter(s => !done.includes(s) && !skipped.has(s));
	const total = shards.length;
	while (pending.length > 0) {
		const batch = pending.splice(0, args.batchShards);
		// 本批已写出的库外 Parquet（尚在 tmp/）；inline 形态下恒为空
		const staged: Array<{ rel: string; tmp: string; final: string }> = [];
		let inserted = 0;
		let committed = false;
		try {
			await conn.run("BEGIN TRANSACTION");
			for (const rel of batch) {
				const stem = path.basename(rel, ".jsonl.gz");
				const stage = needParquetFiles
					? {
							rel,
							tmp: path.join(fileTmpDir, stem + ".parquet"),
							final: path.join(stagingDir, stem + ".parquet"),
						}
					: null;
				// 登记必须在 encodeShard **之前**：它内部先 COPY 再返回，若 COPY 中途抛错
				// （磁盘满、被中断），文件可能已经落在 tmp/ 里，而事后登记就漏掉了它。
				// rm 带 force，登记了但文件不存在的分支是无害的。
				if (stage) staged.push(stage);
				await encodeShard(conn, path.join(args.src, rel), stage?.tmp);
				done.push(rel);
				inserted++;
			}
			await conn.run("COMMIT");
			committed = true;
		} catch (e) {
			if (!committed) await rollbackQuietly(conn);
			// 本批未能全部入库，已写出的临时 Parquet 一并作废——否则它们会在下一轮
			// 被视图的 *.parquet glob 读进来，变成「库内没有对应样本」的孤儿行
			for (const s of staged) await rm(s.tmp, { force: true });
			done.splice(done.length - inserted, inserted); // 本批已记入的分片作废
			// COMMIT 本身失败时没有哪一片是「坏分片」（inserted === batch.length），
			// 此时不可跳过任何分片，只记整批失败并原样重排队。
			const bad = inserted < batch.length ? batch[inserted] : null;
			if (bad) skipped.add(bad);
			failures.push({ shard: bad ?? "(COMMIT)", error: String(e) }); // read_json 错误消息内含行/列位置（spec §9）
			console.error(bad ? `分片失败: ${bad}\n${e}` : `整批提交失败:\n${e}`);
			if (failures.length >= 10)
				throw new Error("失败分片达 10 个，中止构建（上游数据异常）");
			// 事务已回滚：失败者跳过，同批其余分片（失败之前 + 失败之后）全部放回队首重做。
			// 只放回「失败之后」会静默丢掉失败之前那批的数据（它们已从 done 里撤销，却无人重做）。
			pending.unshift(...batch.slice(0, inserted), ...batch.slice(inserted + 1));
			continue;
		}

		// 改名必须在 COMMIT 之后：视图的 glob 不匹配子目录，崩溃残留只会留在 tmp/，
		// 不会出现「视图看得见文件、库内却没有对应行」的错配窗口。
		// 改名失败不影响已提交的数据，但边车会缺该分片——撤回记账并放回队列让它重做
		// （插入已幂等），收尾的「进度 ↔ 边车文件」对账再兜一层。
		for (const s of staged) {
			try {
				await rename(s.tmp, s.final);
			} catch (e) {
				console.error(`分片边车改名失败: ${s.final}\n${e}`);
				failures.push({ shard: s.rel, error: String(e) });
				const at = done.lastIndexOf(s.rel);
				if (at >= 0) done.splice(at, 1);
				pending.push(s.rel);
				if (failures.length >= 10)
					throw new Error("失败分片达 10 个，中止构建（上游数据异常）");
			}
		}

		await writeFile(progressPath, JSON.stringify({ version: 1, done }, null, 0));
		const n = done.length;
		if (n % 20 < args.batchShards || n === total) {
			console.log(`[${n}/${total}] 完成，累计 ${((Date.now() - t0) / 1000) | 0}s`);
		}
	}
	if (mode === "inline") {
		await conn.run(TOPIC_LINES_INDEX_SQL);
	}
	await conn.run(
		"CREATE INDEX IF NOT EXISTS idx_birth ON samples(year, month, day, hour, gender)"
	);
	await conn.run("ANALYZE");

	// 建视图与宏（先 ANALYZE 再建，避免 ANALYZE 把视图也当作可分析对象）。
	// 旧格式库在进入 pass 1 之前就已被迁移守卫挡下，这里不再重复检测。
	// dataset 的 topics 视图由 finalizeDataset 在重打包后建立。
	if (mode === "inline") {
		await conn.run(topicsViewSql());
		await conn.run(searchTopicMacroSql());
	}

	// ---- dataset 收尾：导出结构表、重打包、建视图、清暂存（spec §5.2）----
	if (mode === "dataset") {
		await finalizeDataset(conn, stagingDir, datasetDir, done);
	}

	// 收尾对账：inline 直接对 topic_lines 断言三条不变量（不能写 `count(*) FROM topics`，
	// 那会强制重建全部文本，极慢且可能 OOM，spec §7.4）。dataset 的 topics 行数对账在
	// finalizeDataset 里做（topics 视图无聚合，count(*) 是廉价操作）。
	const one = async (sql: string) => Number((await (await conn.run(sql)).getRowsJS())[0][0]);
	const nSamples = await one("SELECT count(*) FROM samples");
	if (mode === "inline") {
		const nDistinct = await one("SELECT count(DISTINCT sample_id) FROM topic_lines");
		const nLines = await one("SELECT count(*) FROM topic_lines");
		const nDup = await one(
			"SELECT count(*) FROM (SELECT sample_id, topic FROM topic_lines GROUP BY ALL HAVING count(*) <> 1)"
		);
		if (nDistinct !== nSamples || nLines !== nSamples * 13 || nDup !== 0) {
			throw new Error(
				`主题行对账不通过：样本 ${nSamples} 行、topic_lines 覆盖 ${nDistinct} 个样本、` +
					`共 ${nLines} 行（应为 ${nSamples * 13}）、重复「样本×主题」${nDup} 条`
			);
		}
	}

	conn.closeSync();
	const dbSize = statSync(dbPath).size;
	// dataset 形态统计 dataset/ 目录总大小（samples.parquet + palaces.parquet + topics-*.parquet）
	const dsSize =
		mode === "dataset" && existsSync(datasetDir)
			? (await readdir(datasetDir))
					.filter(f => f.endsWith(".parquet"))
					.reduce((s, f) => s + statSync(path.join(datasetDir, f)).size, 0)
			: 0;
	console.log(
		`构建完成：${done.length} 分片，单库文件 ${(dbSize / 1024 ** 3).toFixed(2)}GiB，` +
			(mode === "dataset" ? `dataset ${(dsSize / 1024 ** 2).toFixed(0)}MiB，` : "") +
			`耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`
	);
	if (skipped.size > 0) console.error(`跳过失败分片 ${skipped.size} 个`);
	if (failures.length > 0) {
		console.error(`警告：${failures.length} 个分片失败未入库`);
		process.exitCode = 1;
	}
}

// 作为模块被导入时不执行（测试里直接调 buildShard/shardSql）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
