/**
 * @file 从源分片构建双日历口径 DuckDB 基准库的工具。
 */
// 用法: npm run build:db [-- --out=DIR] [-- --force] [-- --mode=inline|dataset]
//                      [-- --from-year=N] [-- --to-year=N] [-- --src=DIR]
//      参数支持 --key=value 与 --key value 两种写法
// 默认 src=./samples-out out=./db（与 query 的 DEFAULT_OUT 同址，读写同位）；--mode 默认 inline。
// --out 只给目录，目录内名字全固定（唯一定义处：tools/db/db.ts 的 dbPathIn / datasetDirIn）：
//   <out>/ziwei.duckdb             库文件
//   <out>/dataset/                 分发 parquet 目录（仅 --mode=dataset）
//   <out>/dataset.staging/         重打包暂存（仅 --mode=dataset，收尾后删除）
//   <out>/ziwei.duckdb.dict.jsonl  行字典副本；<out>/ziwei.duckdb.progress.json 进度
import { existsSync, statSync } from "node:fs";
// readdir 仍被 listShards 用来枚举磁盘分片，不可删
import { readFile, writeFile, readdir, rm, statfs, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
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
	STORAGE_TOPIC_KEYS,
	TOPIC_LINES_INDEX_SQL,
	datasetDirIn,
	datasetStagingDirIn,
	topicsPartName,
	topicsViewSqlDataset,
	DATASET_PART_SAMPLES,
	DATASET_PART_MAX_BYTES,
	type DbLayout,
} from "./db";
import { sqlSampleIdExpr, type Calendar } from "./sample-id";
import { materializeTarShards } from "./tar-source";

// ROOT 是 **skill 根**（仓库根）非 tools/：本文件在 <skill 根>/tools/db/ 下，故退两层。
// 少退一层会让默认 --src 落到 tools/samples-out（不存在）——语料实在 <skill 根>/samples-out，
// 症状是启动 ENOENT scandir，与「语料缺失」难区分。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

/** 建库命令行参数解析结果（未给出的项落回默认值）。 */
interface Args {
	/** 源分片根目录（含 year-<YYYY>/*.jsonl.gz 或分发 tar），默认 <仓库根>/samples-out */
	src: string;
	/** 输出目录，默认 <仓库根>/db；库、dataset/、进度与字典副本全落其下 */
	out: string;
	/** 清掉旧库 / 进度 / 字典副本 / dataset 后全新重建（对应 `--force`） */
	force: boolean;
	/** 构建形态：inline = 单库；dataset = 无库、全在 dataset/ 下 parquet（默认 inline） */
	mode: "inline" | "dataset";
	/** 分片筛选起始年（含）；省略即不限——只过滤 year-<YYYY> 目录 */
	fromYear?: number;
	/** 分片筛选结束年（含）；省略即不限 */
	toYear?: number;
	/** 磁盘剩余空间门槛（GB），默认 40；低于拒绝构建 */
	minFreeGb: number;
	/** 每批提交分片数，默认 24；小于 24 时行组过碎、压缩失效（须 ≥ 1） */
	batchShards: number;
}

/**
 * 解析建库命令行参数。
 *
 * @param argv - 命令行参数（不含 node 与脚本路径）
 * @returns 解析后的建库参数；未给项落回默认值
 */
function parseArgs(argv: string[]): Args {
	const a: Args = {
		src: path.join(ROOT, "samples-out"),
		// 默认与消费方同址（query-args 的 DEFAULT_OUT = <root>/db）：库/进度/staging
		// 全是 --out 伴生物，落 db/ 下，仓库根不出现构建产物。
		out: path.join(ROOT, "db"),
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
		/** 取当前项的值：优先 `=`，其次下一参数。 */
		const value = (): string => {
			if (inline !== undefined) {
				return inline;
			}
			const next = argv[++i];
			if (next === undefined) {
				throw new Error(`参数缺值: ${key}`);
			}
			return next;
		};
		if (key === "--from-year") {
			a.fromYear = Number(value());
		} else if (key === "--to-year") {
			a.toYear = Number(value());
		}
		// 路径参数在 resolve 前先校验原值：resolve 会把 .. 归一化，过这步就无从识别
		else if (key === "--src") {
			const v = value();
			if (v.split(/[\\/]/).includes("..")) {
				throw new Error("--src 路径不允许包含 .. 段");
			}
			a.src = path.resolve(v);
		} else if (key === "--out") {
			const v = value();
			if (v.split(/[\\/]/).includes("..")) {
				throw new Error("--out 路径不允许包含 .. 段");
			}
			a.out = path.resolve(v);
		} else if (key === "--mode") {
			a.mode = parseMode(value());
		} else if (key === "--min-free-gb") {
			a.minFreeGb = Number(value());
		} else if (key === "--batch-shards") {
			a.batchShards = Math.max(1, Number(value()));
		} else if (key === "--db" || key === "--topics-dir") {
			throw new Error(deletedArgHint(key));
		} else {
			throw new Error(`未知参数: ${arg}`);
		}
	}
	return a;
}

// spec §3.1（修订）：形态由 --mode 选择，默认 inline（不传 = 与验收版本逐项一致）。
// 非法值报错不回退：传旧形态却拿到 inline 库是无声的错。故只精确匹配，不接受大小写或空白。
/**
 * 解析 `--mode`：只接受精确 `inline` / `dataset`，非法值报错。
 *
 * @param raw - `--mode` 原始取值
 * @returns 归一后的形态
 * @throws 取值已删除的 `parquet` / `sidecar`，或不在 `inline | dataset` 内
 */
export function parseMode(raw: string): "inline" | "dataset" {
	if (raw === "inline") {
		return "inline";
	}
	if (raw === "dataset") {
		return "dataset";
	}
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

// 形态选择已从环境变量迁到 --mode（spec §3.1 修订）。残留旧变量须报错而非静默忽略：
// `ZIWEI_DB_MODE=parquet npm run build:db` 若被忽略，用户拿到 inline 库——形态与
// 体积都与预期不符，却要等下游找不到 dataset 目录才暴露。空值等同未设，不报错。
/**
 * 拒收退役的 `ZIWEI_DB_MODE` 环境变量，避免与命令行形态静默冲突。
 *
 * @param env - 环境变量表（默认 `process.env`，可注入）
 * @returns 无返回值；未设或空串静默通过
 * @throws 环境变量仍有 `ZIWEI_DB_MODE`
 */
export function rejectLegacyModeEnv(env: NodeJS.ProcessEnv = process.env): void {
	const raw = env.ZIWEI_DB_MODE;
	if (raw === undefined || raw === "") {
		return;
	}
	throw new Error(
		`ZIWEI_DB_MODE 已废弃（当前值 ${JSON.stringify(raw)}），形态改用命令行参数：` +
			"--mode=inline 或 --mode=dataset（不传等同 inline）"
	);
}

// read_json 显式 schema（spec §3 字段；siHua 空串/缺失合法，brightness 可缺失）。
// columns 的 struct 形式要求「值」为 VARCHAR 类型串，嵌套类型写成类型字符串而非嵌套 struct。
// 字段名 = toolkit samples-out **导出口径**（hour/mingGongBranch/siHua/daXianAge…，与 db-slim
// 逐字对齐）；入库列名是本仓 camelCase 口径，INSERT SELECT 按位置映射，两套命名不混用。
/** `read_json_auto` 的列类型契约，与 db-slim 基准实现逐字对齐。 */
export const READ_JSON_COLUMNS = `{
  'birthInfo': 'STRUCT(year SMALLINT, month SMALLINT, day SMALLINT, hour SMALLINT, gender VARCHAR, longitude DOUBLE)',
  'chart': 'STRUCT(lunarInfo STRUCT(lunarYear SMALLINT, lunarMonth SMALLINT, lunarDay SMALLINT, yearStem TINYINT, yearBranch TINYINT, isLeapMonth BOOLEAN), mingGongBranch TINYINT, shenGongBranch TINYINT, wuxingJu TINYINT, wuxingJuName VARCHAR, ziweiPos TINYINT, palaces STRUCT(branch TINYINT, stem TINYINT, name VARCHAR, stars STRUCT(name VARCHAR, type VARCHAR, brightness VARCHAR, siHua VARCHAR)[], daXianAge SMALLINT[], isMingGong BOOLEAN, isShenGong BOOLEAN, isCurrentDaXian BOOLEAN)[], daXians STRUCT(startAge SMALLINT, endAge SMALLINT, palaceBranch TINYINT, palaceName VARCHAR)[], currentAge SMALLINT, currentDaXianIndex SMALLINT)',
  'topics': 'STRUCT(overview VARCHAR, personality VARCHAR, love VARCHAR, career VARCHAR, wealth VARCHAR, health VARCHAR, family VARCHAR, children VARCHAR, move VARCHAR, friends VARCHAR, home VARCHAR, spirit VARCHAR, parents VARCHAR)',
  'system': 'VARCHAR'
}`;

/**
 * 分片入库用的临时与清洗 SQL（按日历口径生成）。
 *
 * @param calendar - 源数据集的日历口径
 * @returns 按口径生成的入库 SQL（临时表、清洗、三类行写入与收尾）
 */
export function shardSql(calendar: Calendar): {
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
	// 幂等插入：先按本分片 sample_id 删旧行再插。这使「已提交但尚未记账」即崩溃的分片
	// 可安全重做，不必撞主键冲突后被永久跳过。正常路径删 0 行，走索引。
	const idExpr = sqlSampleIdExpr("birthInfo", calendar);
	const idInShard = `SELECT ${idExpr} FROM shard`;
	const topicNames = STORAGE_TOPIC_KEYS.map(k => `'${k}'`).join(", ");
	const topicCols = STORAGE_TOPIC_KEYS.map(k => `topics.${k}`).join(", ");
	return {
		temp: `CREATE OR REPLACE TEMP TABLE shard AS SELECT * FROM ${readJson}`,
		cleanPalaces: `DELETE FROM palaces WHERE sample_id IN (${idInShard})`,
		cleanSamples: `DELETE FROM samples WHERE sample_id IN (${idInShard})`,
		cleanTopicLines: `DELETE FROM topic_lines WHERE sample_id IN (${idInShard})`,
		palaces: `
      INSERT INTO palaces
      SELECT ${idExpr} AS sample_id,
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
        SELECT ${idExpr} AS sample_id, st.name AS star, st.siHua AS sihua, p.name AS palace
        FROM shard, UNNEST(shard.chart.palaces) AS u(p), UNNEST(p.stars) AS t(st)
        WHERE st.siHua IS NOT NULL AND st.siHua <> ''
      )
      INSERT INTO samples
      SELECT ${idExpr}, j.birthInfo.year, j.birthInfo.month, j.birthInfo.day, j.birthInfo.hour,
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
      ) f ON f.sample_id = ${idExpr}`,
		// 13 个文本列展开成 (topic, txt) 行。必须写成「同一 SELECT 列表里两个 unnest」——
		// DuckDB 按位置并行展开（zip），不是笛卡尔积（实测 13 列 × 2,160 样本 = 28,080 行，
		// 非 2,160²）。这也是唯一能容纳全量主题文本的写法：13 路 UNION ALL 同规模直接 OOM
		// （spec §9.1 第 3 层）。
		topicPairs: `CREATE OR REPLACE TEMP TABLE shard_pairs AS
      SELECT sample_id, topic, txt FROM (
        SELECT ${idExpr} AS sample_id,
               unnest([${topicNames}]) AS topic,
               unnest([${topicCols}])  AS txt
        FROM shard
      ) y`,
		// pass 1：把本分片里字典还没有的行追加进去。id 从 max(line_id)+1 顺延，
		// 只追加、永不重排——重排会让已建分片 line_ids 整片错配（spec §7.2）。
		// NULL 文本的 string_split 为 NULL、unnest 出 0 行，故不写入任何行（spec §6.3）。
		dictInsert: `INSERT INTO topic_dict (line_id, line)
      SELECT (SELECT coalesce(max(line_id), 0) FROM topic_dict) + row_number() OVER (ORDER BY ln), ln
      FROM (SELECT DISTINCT ln FROM shard_pairs p, unnest(string_split(p.txt, chr(10))) AS u(ln)) d
      WHERE d.ln NOT IN (SELECT line FROM topic_dict)`,
		// pass 2 断言：展开每行都须命中字典。数据程序生成应零失败；命中不了说明源与字典
		// 不一致，写下的是悬空 id，必须中止而非静默写入。
		dictMisses: `SELECT count(*) FROM shard_lines sl
      LEFT JOIN topic_dict d ON d.line = sl.ln WHERE d.line_id IS NULL`,
		// 拆行并对齐原文行序（ord 即行在原文中的位置）
		topicLineRows: `CREATE OR REPLACE TEMP TABLE shard_lines AS
      SELECT sample_id, topic, ord, ln FROM shard_pairs p,
        unnest(string_split(p.txt, chr(10))) WITH ORDINALITY AS u(ln, ord)`,
		// 编码：每「样本 × 主题」一行。两细节缺一不可（spec §6.3）——
		//   FILTER：list() 不同于 string_agg，保留 NULL，不过滤写成 [NULL]
		//   coalesce：NULL 文本（拆行 0 行）须落空数组，视图才还原成 NULL；
		//   空串走 string_split('' , chr(10)) → ['']，落一空串行号，不受影响
		encodeTopicLines: `INSERT INTO topic_lines (sample_id, topic, line_ids)
      SELECT p.sample_id, p.topic,
             coalesce(list(d.line_id ORDER BY sl.ord) FILTER (WHERE d.line_id IS NOT NULL), []::INTEGER[])
      FROM shard_pairs p
      LEFT JOIN shard_lines sl ON sl.sample_id = p.sample_id AND sl.topic = p.topic
      LEFT JOIN topic_dict d ON d.line = sl.ln
      GROUP BY p.sample_id, p.topic`,
		// 库外 Parquet（dataset 逐源分片）：本分片 13 列主题文本直接写 Parquet(zstd)。
		// 列序与 inline topics 视图一致，故文档查询 SQL 完全相同。
		// 必带 sample_id：视图按 SELECT * 暴露，行须对回 samples。
		topicsTo: (parquetPath: string) => `
      COPY (
        SELECT ${idExpr} AS sample_id,
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

// 分片临时表清理：此处失败绝不能顶替 try 的原始异常。read_json 解析失败会把事务置为
// aborted，此后每条语句（含这些 DROP）只报 `Current transaction is aborted (please
// ROLLBACK)`，finally 的次级异常会挤掉真错误——spec §9 要透给用户的「第几行第几列解析失败」
// 因此从未到达用户。三表都带 IF EXISTS，唯一失败情形即事务已 aborted；临时表随连接消失，
// 残留无害。
/**
 * 尽力删除临时表；失败不抛出，避免掩盖真正的建库错误。
 *
 * @param conn - 已连接的库
 * @param stmts - 待删除的临时表语句
 * @returns 无返回值；单条失败被吞掉，不掩盖建库错误
 */
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
/**
 * pass 1：只扫描该分片的主题字典行，不写样本数据。
 *
 * @param conn - 已连接的库
 * @param gzPath - 分片 jsonl.gz 路径
 * @param calendar - 源数据集的日历口径
 * @returns 无返回值；字典行已并入 `topic_dict`
 */
export async function scanShardDict(
	conn: DuckDBConnection,
	gzPath: string,
	calendar: Calendar
): Promise<void> {
	const sql = shardSql(calendar);
	try {
		await conn.run(sql.temp, [gzPath]);
		await conn.run(sql.topicPairs);
		await conn.run(sql.dictInsert);
	} finally {
		await dropTempsQuietly(conn, sql.dropTemps);
	}
}

// pass 2 单分片：palaces / samples（+ inline 的 topic_lines）入库（不含事务边界）。
// topicsParquetPath 给了就走 parquet：主题文本写库外，不碰字典两表。
/**
 * pass 2：写入 palaces / samples 与 inline 主题行（不含事务边界）。
 *
 * @param conn - 已连接的库
 * @param gzPath - 分片 jsonl.gz 路径
 * @param topicsParquetPath - 主题文本库外 parquet 路径；给了写库外，否则库内
 * @param calendar - 源数据集日历口径
 * @returns 无返回值
 * @throws 本分片有行未命中字典（拒绝悬空 id）
 */
export async function encodeShard(
	conn: DuckDBConnection,
	gzPath: string,
	topicsParquetPath: string | undefined,
	calendar: Calendar
): Promise<void> {
	const sql = shardSql(calendar);
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
		if (miss > 0) {
			throw new Error(`本分片有 ${miss} 行未命中字典（字典与源不一致，拒绝写入悬空 id）`);
		}
		await conn.run(sql.encodeTopicLines);
	} finally {
		await dropTempsQuietly(conn, sql.dropTemps);
	}
}

// COMMIT 后事务已结束，再 ROLLBACK 会抛「cannot rollback - no transaction is active」。
// 它是次级异常，绝不顶掉原始错误（磁盘满/权限/跨设备都在原始错误里）。
/**
 * 尽力回滚事务；失败不抛出，收尾不中断。
 *
 * @param conn - 已连接的库
 * @returns 无返回值；失败被吞掉，不顶原始错误
 */
async function rollbackQuietly(conn: DuckDBConnection): Promise<void> {
	try {
		await conn.run("ROLLBACK");
	} catch {
		/* 事务已结束或已回滚，忽略 */
	}
}

// 单分片写入（自带事务）：供需独立提交的调用方用。
// 单文件化后主题数据也在库内，三类行同受事务保护，不再需要「提交后才让文件对视图可见」
// 的跨文件一致性机制。
/**
 * 单片完整入库：扫描字典后写样本，含事务边界。
 *
 * @param conn - 已连接的库
 * @param gzPath - 分片 jsonl.gz 路径
 * @param topicsParquetPath - 同 {@link encodeShard}
 * @param calendar - 源数据集日历口径
 * @returns 无返回值；事务已提交
 * @throws 写入失败时先回滚并抛原始错误
 */
export async function buildShard(
	conn: DuckDBConnection,
	gzPath: string,
	topicsParquetPath: string | undefined,
	calendar: Calendar
): Promise<void> {
	await conn.run("BEGIN TRANSACTION");
	try {
		await encodeShard(conn, gzPath, topicsParquetPath, calendar);
		await conn.run("COMMIT");
	} catch (e) {
		await conn.run("ROLLBACK");
		throw e;
	}
}

/**
 * 列出源分片路径，可按年份区间收窄。
 *
 * @param src - 源分片根目录
 * @param fromYear - 起始年（含）；省略不限
 * @param toYear - 结束年（含）；省略不限
 * @returns 相对 `src` 的分片路径，按年、月名排序
 * @throws `--src` 含 `..` 段
 */
async function listShards(src: string, fromYear?: number, toYear?: number): Promise<string[]> {
	if (src.split(/[\\/]/).includes("..")) {
		throw new Error("--src 路径不允许包含 .. 段");
	}
	const out: string[] = [];
	for (const dir of (await readdir(src, { withFileTypes: true }))
		.filter(d => d.isDirectory())
		.sort((a, b) => a.name.localeCompare(b.name))) {
		const m = dir.name.match(/^year-(\d{4})$/);
		if (!m) {
			continue;
		}
		const y = Number(m[1]);
		if (fromYear !== undefined && y < fromYear) {
			continue;
		}
		if (toYear !== undefined && y > toYear) {
			continue;
		}
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
// SQL 形态实测过（720 片 → 11 片，2 分 13 秒，无 OOM），关键是**只做 WHERE 过滤、绝不含
// GROUP BY**：inline 库的 topics 是聚合视图，谓词推不穿 GROUP BY，任何分块都拦不住它物化
// 全量文本（spec §3.3 踩坑）。
//
// partSamples 可注入让测试用 7 个样本验边界，生产用默认值。totalSamples 语义上是「最大的
// sample_id」（区间上界）：sample_id 由自然键 1..674976 稠密生成，生产下等于样本总数；
// 测试稀疏 id 时才分叉，故调用方须传 max(sample_id)。
/**
 * 把暂存分片重打成 dataset，逐片校验体积上限。
 *
 * @param conn - 已连接的库
 * @param stagingDir - 逐源分片暂存目录
 * @param datasetDir - dataset 输出目录
 * @param totalSamples - 区间上界（传 `max(sample_id)` 非 `count(*)`）
 * @param partSamples - 每片样本上限（测试可注入小值）
 * @returns 片名清单与最大单片字节数
 * @throws 单片体积超过 {@link DATASET_PART_MAX_BYTES}
 */
export async function repackDataset(
	conn: DuckDBConnection,
	stagingDir: string,
	datasetDir: string,
	totalSamples: number,
	partSamples: number = DATASET_PART_SAMPLES
): Promise<{ files: string[]; maxBytes: number }> {
	if (stagingDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	if (datasetDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	await conn.run("SET threads=4");
	// v4 代（ziwei-interp）的解读文本约为 v3 代的 2 倍长，收尾聚合的内存水位随之抬高
	// —— 4GB 在 924 分片收尾时 OOM（实测 3.7GiB 打满），提到 12GB（机器 30GB 物理内存）。
	await conn.run("SET memory_limit='12GB'");
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
		if (size > maxBytes) {
			maxBytes = size;
		}
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

// ── 数据集指纹登记（导出即自报） ──
//
// dataset 的两个 parquet 是**入库基准真值**，回归按 `MANIFEST.json` 的字节 sha256
// 对账（repo 层「数据集指纹对账」）——数据集被替换而未重新登记时当场红。
// 指纹由本工具导出收尾时自动写入，人工零协同：「改了数据忘了登记」的 miss 类
// 从结构上消失。对账只读文件字节（不查内容），回归不引入 DuckDB 依赖。
//
// 字节可复现性 2026-11-21 实证：同库重导两次与盘上现值三方哈希一致（含并行导出），
// 故字节哈希成立，无需逻辑指纹。血统叙事（note）由调用方按语境给出——
// 工具只知「何时、从哪个库导出」，历史结论不由它代言。
/** dataset 清单：文件哈希、样本数与血统说明。 */
export interface DatasetManifest {
	/** 清单用途（固定文案：本目录指纹由 build-duckdb --mode=dataset 自报） */
	description: string;
	/** 登记日期（UTC YYYY-MM-DD，取自导出时刻） */
	registeredAt: string;
	/** parquet 文件名 → 字节 sha256 与字节数；回归按此对账 */
	files: Record<string, { sha256: string; bytes: number }>;
	/** 样本总数（samples 表 count(*)，v4 全量 674,976） */
	sampleCount: number;
	/** 样本年份区间 [最小年, 最大年]（含两端；v4 为 1950–2026） */
	yearRange: [number, number];
	/** 血统说明：本次导出口径与语境，调用方传入（工具不代言历史结论） */
	note: string;
}

/**
 * 写出 dataset 清单文件并返回其内容。
 *
 * @param conn - 已连接的库
 * @param datasetDir - dataset 目录
 * @param note - 写进清单的说明（本次口径/血统）
 * @returns 已落盘的清单内容
 */
export async function writeDatasetManifest(
	conn: DuckDBConnection,
	datasetDir: string,
	note: string
): Promise<DatasetManifest> {
	const files: Record<string, { sha256: string; bytes: number }> = {};
	for (const t of ["samples", "palaces"]) {
		const buf = await readFile(path.join(datasetDir, `${t}.parquet`));
		files[`${t}.parquet`] = {
			sha256: createHash("sha256").update(buf).digest("hex"),
			bytes: buf.length,
		};
	}
	const rows = (
		await (
			await conn.run("SELECT count(*) AS c, min(year) AS lo, max(year) AS hi FROM samples")
		).getRowsJS()
	)[0];
	const manifest: DatasetManifest = {
		description:
			"db/dataset 指纹登记——由 build-duckdb --mode=dataset 导出时自报；日常回归按此对账，替换文件而不重登记即红",
		registeredAt: new Date().toISOString().slice(0, 10),
		files,
		sampleCount: Number(rows[0]),
		yearRange: [Number(rows[1]), Number(rows[2])],
		note,
	};
	await writeFile(
		path.join(datasetDir, "MANIFEST.json"),
		JSON.stringify(manifest, null, "\t") + "\n",
		"utf8"
	);
	return manifest;
}

// dataset 收尾：导出结构表、重打包、建视图、清暂存（spec §5.2）。
//
// 整段包在 try/finally：清理在 finally，任一处 throw（缺暂存、单片超限、行数对账不过）
// 都不会把 dataset.staging/ 留在盘上——真实数据下约 1.7GiB，失败残留不可接受（Review：Important）。
//
// done 是已入库源分片 rel 列表，用于「缺暂存」对账。
/**
 * 收尾：核对已入库分片、清暂存并落清单。
 *
 * @param conn - 已连接的库
 * @param stagingDir - 逐源分片暂存目录
 * @param datasetDir - dataset 输出目录
 * @param done - 已入库源分片相对路径
 * @param note - 写进清单的说明
 * @returns 无返回值；dataset/ 已重建、清单已落盘、暂存已清
 * @throws 暂存缺分片（须 `--force` 重建）、`..` 段路径、或行数对账不通过
 */
export async function finalizeDataset(
	conn: DuckDBConnection,
	stagingDir: string,
	datasetDir: string,
	done: string[],
	note: string
): Promise<void> {
	if (stagingDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	if (datasetDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	try {
		// 与 done 对账：每个已入库分片都必须有暂存 parquet，缺一个就重打包不出来
		const missing = done.filter(
			rel => !existsSync(path.join(stagingDir, path.basename(rel, ".jsonl.gz") + ".parquet"))
		);
		if (missing.length > 0) {
			// 报错须给可执行动作。上一次**成功**构建已在 finally 清掉 dataset.staging/，
			// 故「已完成之后不加 --force 再跑一次」必落此处，缺的暂存补不回来。
			//
			// throw 排在 rm(datasetDir) 之前是有意的：此刻盘上 dataset/ 是上一次完好产物，
			// 为注定失败的构建清掉它，比原样留下代价大得多（Final: Ruling）。
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

		// 指纹登记（导出即自报）：紧随两结构表落盘，与其余产物无关
		//（topics-* 增删不影响指纹面，MANIFEST 只覆盖两结构表）。
		await writeDatasetManifest(conn, datasetDir, note);

		// 重打包按 sample_id 区间切片，上界取 max(sample_id) 而非 count(*)：sample_id
		// 在真实数据里稠密（1..674976），二者相等；测试迷你数据集 id 稀疏，count 会漏掉
		// 大 id 样本。行数对账单独用 count(*)。
		const sampleCount = Number(
			(await (await conn.run("SELECT count(*) FROM samples")).getRowsJS())[0][0]
		);
		const maxSampleId = Number(
			(await (await conn.run("SELECT max(sample_id) FROM samples")).getRowsJS())[0][0]
		);
		const { files, maxBytes } = await repackDataset(conn, stagingDir, datasetDir, maxSampleId);

		// 行数对账：重打包只做区间过滤，样本丢失或重复都须在此暴露。
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

/** 建库入口：解析参数、按形态建库并报告结果。 */
async function main() {
	rejectLegacyModeEnv();
	const args = parseArgs(process.argv.slice(2));
	const mode = args.mode;
	// 输出位置：命令行只给目录，名字固定。三个脚本共用一组推导函数，
	// 「库在哪、dataset 在哪」不会各推一份而漂移（tools/db/db.ts 的 dbPathIn / datasetDirIn）。
	const dbPath = dbPathIn(args.out);
	const datasetDir = datasetDirIn(args.out);
	const stagingDir = datasetStagingDirIn(args.out);
	const progressPath = dbPath + ".progress.json";
	const dictPath = dictPathFor(dbPath);

	// 「目录不存在」与「目录存在但没有分片」须分开报且都给可执行动作。裸 ENOENT scandir
	// 只打系统路径，分不出参数打错还是语料真丢——处置相反（改路径 vs 重建语料），误判代价最大。
	//
	// tar 源（ziwei-interp 分发格式：--src=…tar）：先物化成月分片目录再走既有管线——
	// v3 行原样直通，v4 现场排盘补 chart（ms 交叉校验）。物化幂等（MANIFEST 作完成标记），
	// 重复构建不重付转换成本。calendar 由此定 sample_id 编码口径；目录源（v3）恒为 synthetic。
	let calendar: Calendar;
	if (args.src.endsWith(".tar")) {
		const materialized = await materializeTarShards(
			args.src,
			path.join(path.dirname(args.out), path.basename(args.out), "tar-shards")
		);
		args.src = materialized.shardDir;
		calendar = materialized.calendar;
	} else {
		if (!existsSync(args.src)) {
			throw new Error(
				`语料目录不存在: ${args.src}\n` +
					`  --src 接月分片目录（year-<YYYY>/*.jsonl.gz）或 ziwei-interp 分发 tar（内含 year-*.jsonl.zst）。`
			);
		}
		calendar = "synthetic";
	}

	// 只读校验一律排在破坏性操作之前：--force 会删旧库、旧进度与字典副本，若等删除后
	// 才发现 --src 打错，等于用拼错路径毁掉一份完整构建的可用产物。
	const shards = await listShards(args.src, args.fromYear, args.toYear);
	if (shards.length === 0) {
		throw new Error(
			`目录下没有分片: ${args.src}\n` +
				`  期望 <目录>/year-<YYYY>/*.jsonl.gz；--from-year / --to-year 也会过滤掉全部年份。`
		);
	}

	// 输出目录一般还不存在（`--out=./db` 最自然），先建：紧接着的 statfs 要对它取，
	// DuckDB 建库也要求父目录存在。排在源校验之后，拼错的 --src 就不会先留下空目录。
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
			if (existsSync(p)) {
				await rm(p, { force: true });
			}
		}
		// dataset 与暂存一并清掉：上一次多出的片若留下，read_parquet 的 glob 会照读，
		// 重复样本不报错（spec §5.3）。
		if (existsSync(datasetDir)) {
			await rm(datasetDir, { recursive: true, force: true });
		}
		if (existsSync(stagingDir)) {
			await rm(stagingDir, { recursive: true, force: true });
		}
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

	// dataset：逐源原文 Parquet 先写 tmp/、提交后原子改名就位，因库外文件不受事务保护
	// （spec §4.2）。暂存与 dataset/ 平级，收尾重打包后再清。
	const needParquetFiles = mode !== "inline";
	const fileTmpDir = path.join(stagingDir, "tmp");
	if (needParquetFiles) {
		await mkdir(stagingDir, { recursive: true });
		// 清上一轮残留：改名协议保证只有 COMMIT 后的文件才进正式目录，tmp/ 留的一律作废
		// （半截 parquet、被 Ctrl-C 打断的批）。并发不受影响：库排他锁（DuckDB 单写者）
		// 在启动阶段就挡住第二进程。
		await rm(fileTmpDir, { recursive: true, force: true });
		await mkdir(fileTmpDir, { recursive: true });
	}

	// dataset 形态的库只有结构表，无字典两表（detectLayout 判为 'parquet' 态）。
	// 库在 dataset 下是构建载体与本地查询入口，不进分发（.gitignore 覆盖）。
	// 全新构建走 createDb（PRAGMA + 按形态选 DDL）；续建复用既有库，不重复建表
	const dbLayout: DbLayout = mode === "inline" ? "inline" : "parquet";
	const conn = fresh
		? await createDb(dbPath, dbLayout)
		: await (await DuckDBInstance.create(dbPath)).connect();

	// 形态守卫须排在 pass 1 之前。续建直接进 pass 1 会在 dictInsert 处逐分片报
	// `Catalog Error: Table topic_dict does not exist`，累计 10 个失败才中止——用户看到一串
	// Catalog Error，而非「请用 --force」提示。这是 3dd3af5「旧格式库迁移守卫」的推广：
	// 两种形态互为对方的「旧格式」。
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
	// dataset 不需要行字典：主题文本由库外 Parquet 承载，少读一遍源；dataset 下不写 dict.jsonl。
	if (mode === "inline") {
		// 扫全部分片（含已 done 的）：字典须覆盖 pass 2 要编码的每行，
		// 「已 done 的分片其行已在字典里」只是续建巧合，不作依赖。续建多读一遍，全新本就读两遍。
		// 失败片计入 skipped，pass 2 不再试——pass 1 读不了的，pass 2 也读不了。
		//
		// 本趟逐片独立提交，不用 --batch-shards 分批：一批一事务无法定位哪个片失败，
		// 只能整批算失败——一个坏片连坐 23 个正常片，pass 2 却只跳过真失败的，两趟 skipped
		// 集合就不一致（pass 1 多跳的片永远缺失，且构建仍 exit 0）。
		// 分片级事务让两趟对齐。topic_dict 不过万行，逐片提交无体积问题
		// （行组碎片顾虑只针对 palaces/samples）。
		console.log(`pass 1/2：扫描 ${shards.length} 个分片建立行字典…`);
		for (const rel of shards) {
			try {
				await conn.run("BEGIN TRANSACTION");
				await scanShardDict(conn, path.join(args.src, rel), calendar);
				await conn.run("COMMIT");
			} catch (e) {
				await rollbackQuietly(conn);
				skipped.add(rel);
				failures.push({ shard: rel, error: String(e) });
				console.error(`字典扫描失败，跳过分片 ${rel}:\n${e}`);
				if (failures.length >= 10) {
					throw new Error("失败分片达 10 个，中止构建（上游数据异常）", { cause: e });
				}
			}
		}

		// 字典权威副本落盘。须先比对再覆盖：库内字典与副本不一致（变号）时，已建片
		// line_ids 已指向错行，覆盖即销毁唯一证据。
		//
		// 判「旧副本是库内字典的前缀」不变式，含两半：
		//   1) 副本每个 id 文本一字不变（改写 = 重排，最危险）
		//   2) 库里新增 id 严格大于副本最大 id（追加，不回填空洞、不复用旧号）
		// 注意**不能**把「库里有、副本里没有」一律判错：合法续建本就产生新行，
		// 否则每次增量构建都被误判变号中止。
		const dictRows = (
			await (
				await conn.run("SELECT line_id, line FROM topic_dict ORDER BY line_id")
			).getRowsJS()
		).map(r => ({ line_id: Number(r[0]), line: String(r[1]) }));
		if (existsSync(dictPath)) {
			const prev = new Map<number, string>();
			for (const ln of (await readFile(dictPath, "utf8")).split("\n")) {
				if (!ln.trim()) {
					continue;
				}
				const o = JSON.parse(ln) as { line_id: number; line: string };
				prev.set(Number(o.line_id), o.line);
			}
			const now = new Map(dictRows.map(r => [r.line_id, r.line]));
			const maxPrev = prev.size > 0 ? Math.max(...prev.keys()) : 0;
			const diff: string[] = [];
			for (const [id, line] of prev) {
				const cur = now.get(id);
				if (cur !== line) {
					diff.push(
						cur === undefined ? `line_id=${id} 丢失` : `line_id=${id} 文本被改写`
					);
				}
			}
			for (const id of now.keys()) {
				if (!prev.has(id) && id <= maxPrev) {
					diff.push(`line_id=${id} 复用了旧号`);
				}
			}
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

	// 按批提交：每表每次提交追加一个行组，逐片提交会让行组碎到每 720 行一个，压缩失效
	// 且构建慢 3.3 倍（720 片实测每片 100.9 → 51.9 MB；批次 ≥24 趋于饱和）。
	// 一批失败则整批回滚，故用待处理队列而非下标推进，失败片记入 skipped 免循环。
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
				// 登记须在 encodeShard **之前**：它先 COPY 再返回，COPY 中途抛错
				// （磁盘满、中断）时文件可能已落 tmp/，事后登记就漏掉。rm 带 force，
				// 登记了但文件不存在无害。
				if (stage) {
					staged.push(stage);
				}
				await encodeShard(conn, path.join(args.src, rel), stage?.tmp, calendar);
				done.push(rel);
				inserted++;
			}
			await conn.run("COMMIT");
			committed = true;
		} catch (e) {
			if (!committed) {
				await rollbackQuietly(conn);
			}
			// 本批未全部入库，已写临时 Parquet 一并作废——否则下轮被视图的
			// *.parquet glob 读进来，变成「库内没有对应样本」的孤儿行
			for (const s of staged) {
				await rm(s.tmp, { force: true });
			}
			done.splice(done.length - inserted, inserted); // 本批已记入的分片作废
			// COMMIT 失败时没有「坏分片」（inserted === batch.length），
			// 此时不跳片，只记整批失败并原样重排队。
			const bad = inserted < batch.length ? batch[inserted] : null;
			if (bad) {
				skipped.add(bad);
			}
			failures.push({ shard: bad ?? "(COMMIT)", error: String(e) }); // read_json 错误消息内含行/列位置（spec §9）
			console.error(bad ? `分片失败: ${bad}\n${e}` : `整批提交失败:\n${e}`);
			if (failures.length >= 10) {
				throw new Error("失败分片达 10 个，中止构建（上游数据异常）", { cause: e });
			}
			// 事务已回滚：失败者跳过，同批其余片（失败之前 + 之后）全放回队首重做。
			// 只放回「失败之后」会静默丢掉失败前那批数据（已从 done 撤销，无人重做）。
			pending.unshift(...batch.slice(0, inserted), ...batch.slice(inserted + 1));
			continue;
		}

		// 改名须在 COMMIT 之后：视图 glob 不匹配子目录，崩溃残留只留在 tmp/，
		// 不会出现「视图看得见文件、库内却没有对应行」的错配窗口。
		// 改名失败不影响已提交数据，但边车会缺该片——撤回记账并放回队列重做
		// （插入已幂等），收尾「进度 ↔ 边车文件」对账再兜一层。
		for (const s of staged) {
			try {
				await rename(s.tmp, s.final);
			} catch (e) {
				console.error(`分片边车改名失败: ${s.final}\n${e}`);
				failures.push({ shard: s.rel, error: String(e) });
				const at = done.lastIndexOf(s.rel);
				if (at >= 0) {
					done.splice(at, 1);
				}
				pending.push(s.rel);
				if (failures.length >= 10) {
					throw new Error("失败分片达 10 个，中止构建（上游数据异常）", { cause: e });
				}
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

	// 建视图与宏（先 ANALYZE 再建，避免 ANALYZE 把视图当可分析对象）。
	// 旧格式库进 pass 1 前已被迁移守卫挡下，这里不重复检测。
	// dataset 的 topics 视图由 finalizeDataset 重打包后建立。
	if (mode === "inline") {
		await conn.run(topicsViewSql());
		await conn.run(searchTopicMacroSql());
	}

	// ---- dataset 收尾：导出结构表、重打包、建视图、清暂存（spec §5.2）----
	if (mode === "dataset") {
		await finalizeDataset(
			conn,
			stagingDir,
			datasetDir,
			done,
			`由 build-duckdb --mode=dataset 从本库导出时自动登记（${new Date().toISOString().slice(0, 10)}）；` +
				"指纹只覆盖 samples / palaces 两个结构表，topics-* 不在其列"
		);
	}

	// 收尾对账：inline 直接对 topic_lines 断言三条不变量（不能写 `count(*) FROM topics`，
	// 那会重建全部文本，极慢且可能 OOM，spec §7.4）。dataset 的 topics 对账在
	// finalizeDataset 做（topics 视图无聚合，count(*) 廉价）。
	/** 取单值聚合结果并转 Number，供末段校验。 */
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
	// dataset 形态统计 dataset/ 总大小（samples.parquet + palaces.parquet + topics-*.parquet）
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
	if (skipped.size > 0) {
		console.error(`跳过失败分片 ${skipped.size} 个`);
	}
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
