/**
 * @file DuckDB 库结构、布局与共享查询定义。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
import { DuckDBInstance } from "@duckdb/node-api";

// spec §5.4：全库 zstd；实测 1.5.5 VARCHAR 恒 Uncompressed（DOUBLE 对照生效），主题文本改「全局行字典 + 整数数组映射」（spec §5/§6）。
/** 建库时的 PRAGMA（全局 zstd）。 */
export const CREATE_DB_PRAGMAS = ["PRAGMA force_compression='zstd'"];

// 主题名唯一源：scripts/analysis/data.ts 的 TOPIC_KEYS，供视图/构建/校验共用，列序不漂移。
//
// ⚠️ TOPIC_KEYS 别名视图主题，拼 SQL 取列须用 STORAGE_TOPIC_KEYS，混用报 `column not found`（Phase 4）。
// ⚠️ 相对路径而非 `@/`：tools/ 由 tsx 直执行不走解析钩子；随内核位置（scripts/）改，漏改测试不红、实跑报找不到模块。
import { STORAGE_TOPIC_KEYS, TOPIC_KEYS, type TopicKey } from "../../scripts/analysis/data";
export { STORAGE_TOPIC_KEYS, TOPIC_KEYS, type TopicKey };

// spec §4.1：结构表两形态共用，主题文本仅 inline 建。
/** 结构表 DDL：samples / palaces。 */
export const DDL_STRUCTURE_STATEMENTS: string[] = [
	`CREATE TABLE samples (
    sample_id BIGINT PRIMARY KEY,
    year SMALLINT NOT NULL, month SMALLINT NOT NULL, day SMALLINT NOT NULL, hour SMALLINT NOT NULL,
    gender VARCHAR NOT NULL, longitude DOUBLE,
    lunar_year SMALLINT, lunar_month SMALLINT, lunar_day SMALLINT,
    year_stem TINYINT, year_branch TINYINT, is_leap_month BOOLEAN,
    ming_gong_branch TINYINT, shen_gong_branch TINYINT,
    wuxing_ju TINYINT, wuxing_ju_name VARCHAR, ziwei_pos TINYINT,
    current_age SMALLINT, current_daxian_index SMALLINT,
    sihua_lu_star VARCHAR, sihua_quan_star VARCHAR, sihua_ke_star VARCHAR, sihua_ji_star VARCHAR,
    sihua_lu_palace VARCHAR, sihua_quan_palace VARCHAR, sihua_ke_palace VARCHAR, sihua_ji_palace VARCHAR
  )`,
	`CREATE TABLE palaces (
    sample_id BIGINT NOT NULL,
    palace_name VARCHAR NOT NULL,
    branch TINYINT NOT NULL, stem TINYINT NOT NULL,
    major_stars VARCHAR[], lucky_stars VARCHAR[], sha_stars VARCHAR[], minor_stars VARCHAR[],
    major_brightness VARCHAR[],
    sihua_flags VARCHAR NOT NULL DEFAULT '',
    sihua_stars VARCHAR[] NOT NULL DEFAULT [],
    is_ming_gong BOOLEAN, is_shen_gong BOOLEAN, is_current_daxian BOOLEAN,
    daxian_start SMALLINT, daxian_end SMALLINT
  )`,
];

// 主题文本全局字典：同一行大量重复（实测 25,920 样本 336,960 段仅 12,626 唯一行），库一份；
// parquet 形态不建此二表，文本由库外 Parquet 承载。
/** 行级字典表 DDL（topic_dict / topic_lines），inline 建。 */
export const DDL_INLINE_STATEMENTS: string[] = [
	`CREATE TABLE topic_dict (
    line_id INTEGER PRIMARY KEY,
    line    VARCHAR NOT NULL
  )`,
	// 每「样本 × 主题」一行，值为按 chr(10) 拆行的行号数组（顺序=原文），全量 8,774,688 行。
	`CREATE TABLE topic_lines (
    sample_id BIGINT   NOT NULL,
    topic     VARCHAR  NOT NULL,
    line_ids  INTEGER[] NOT NULL
  )`,
];

// spec §5.1/5.2/5.3：inline 一次建全，逐字节同验收版。
/** inline DDL：结构表+字典表。 */
export const DDL_STATEMENTS: string[] = [...DDL_STRUCTURE_STATEMENTS, ...DDL_INLINE_STATEMENTS];

// 索引收尾才建，不进 DDL_STATEMENTS（批量插入拖慢构建，构建期不用）。
/** `topic_lines` 索引，收尾才建。 */
export const TOPIC_LINES_INDEX_SQL =
	"CREATE INDEX IF NOT EXISTS idx_topic_lines_sample ON topic_lines(sample_id)";

/**
 * 打开/创建库并应用 PRAGMA。
 * @param dbPath - 库路径
 * @param layout - 布局形态，parquet 只建结构表
 * @returns 可写连接
 */
export async function createDb(
	dbPath: string,
	layout: DbLayout = "inline"
): Promise<DuckDBConnection> {
	const instance = await DuckDBInstance.create(dbPath);
	const conn = await instance.connect();
	const ddl = layout === "parquet" ? DDL_STRUCTURE_STATEMENTS : DDL_STATEMENTS;
	for (const stmt of [...CREATE_DB_PRAGMAS, ...ddl]) {
		await conn.run(stmt);
	}
	return conn; // instance 由持有者 close
}

// 字典权威副本：与库同前缀（ziwei.duckdb → ziwei.duckdb.dict.jsonl）。
// 「变号检测」基准：库内 topic_dict 不一致即分片 line_ids 指错行，须停下（spec §7.2/§9.1）。
/**
 * 库旁字典路径（`<db>.dict.jsonl`），用于变号检测。
 * @param dbPath - 库文件路径
 * @returns 同前缀 `.dict.jsonl`
 */
export function dictPathFor(dbPath: string): string {
	return dbPath + ".dict.jsonl";
}

// 库内 topics 视图：13 列文本由行号数组拼回，列序同原 Parquet 版，SQL 无需改。
// ⚠️ unnest 展开与两处 LEFT JOIN 缺一不可（实测：数组变字面量、NULL 行消失），详见 docs/code/db-tools.md
/**
 * inline `topics` 视图 SQL：行字典→原文行。
 * @returns VIEW 语句
 */
export function topicsViewSql(): string {
	const cols = STORAGE_TOPIC_KEYS.map(
		k =>
			`      string_agg(CASE WHEN topic='${k}' THEN d.line END, chr(10) ORDER BY ord) AS ${k}`
	).join(",\n");
	return `CREATE OR REPLACE VIEW topics AS
    SELECT sample_id,
${cols}
    FROM (SELECT tl.sample_id, tl.topic, u.id, u.ord
          FROM topic_lines tl
          LEFT JOIN unnest(tl.line_ids) WITH ORDINALITY AS u(id, ord) ON TRUE) x
    LEFT JOIN topic_dict d ON d.line_id = x.id
    GROUP BY sample_id`;
}

// 全量文本检索按行匹配，比 contains() 快一数量级（spec §8，实测 27×）。
// 守卫须放 FROM 恒一行子查询，不能放 WHERE 的 CASE：后者仅在有行流经时求值，topic_lines 空时静默返回 0 行；g.guard=1 强制求值。
/**
 * inline `search_topic(t, p)` 宏：按主题列子串检索。
 * @returns MACRO 语句
 */
export function searchTopicMacroSql(): string {
	return `CREATE OR REPLACE MACRO search_topic(t, p) AS TABLE
    SELECT DISTINCT tl.sample_id
    FROM (SELECT CASE WHEN contains(p, chr(10))
                      THEN error('search_topic 不支持含换行的模式，请改用 topics 视图')
                      ELSE 1 END AS guard) g,
         topic_lines tl, unnest(tl.line_ids) AS u(id)
    JOIN topic_dict d ON d.line_id = u.id
    WHERE tl.topic = t AND contains(d.line, p) AND g.guard = 1`;
}

/**
 * 只读打开库文件。
 * @param p - 库路径
 * @returns 只读连接
 */
export async function openReadOnly(p: string): Promise<DuckDBConnection> {
	// 原生键名 access_mode（非 accessMode）；选项表 Record<string, string>
	const instance = await DuckDBInstance.create(p, { access_mode: "READ_ONLY" });
	return await instance.connect();
}

// 形态：inline=单库自足（文本在库内）；parquet=dataset 内部布局，三类数据在库外 dataset/，库只承载结构表（spec §6.1）。
// --mode 仅 inline|dataset；'parquet' 非独立形态，仅作内部布局名供 detectLayout 区分。
/** 库布局形态：inline（库内建表）或 parquet（库外 parquet+视图）。 */
export type DbLayout = "inline" | "parquet";

// ── 输出位置唯一定义处 ──
// build/verify/query 共用；固定文件名与 `..` 段拒收（⚠️ 校验须内联各函数体，抽公共函数断不了污点流），详见 docs/code/db-tools.md
/**
 * 目录内库文件路径；`--out` 含 `..` 段即报错。
 * @param outDir - 输出目录
 * @returns 库文件路径
 * @throws `--out` 含 `..` 段
 */
export function dbPathIn(outDir: string): string {
	if (outDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	return path.join(path.resolve(outDir), "ziwei.duckdb");
}

// ── dataset 形态：分发产物是库外一整套 parquet（spec §4）──
// 三类数据全导出到 dataset/，接收方无需库文件（spec §6.1）。
/** dataset 形态每片 samples 的行数上限。 */
export const DATASET_PART_SAMPLES = 50_000;

// 构建期逐片断言上限，比平台硬限严：超限前失败，不等 push 拒（spec §5.2）。
/** 单分片体积上限，超限前失败。 */
export const DATASET_PART_MAX_BYTES = 95 * 1024 * 1024;

// dataset 合计上限：实测 392MiB（主题 379.04+宫位 12.0+样本 0.8），留约 15% 余量；现切片 1.7GiB（spec §8）。
// 按日历口径分档（README「体积报告」节 1.1 倍实测口径）：synthetic（v3）450MiB / solar（v4）1GiB（实测 944MiB，留余量防漂移误报）。
/** dataset 合计体积预算（synthetic 口径）。 */
export const DATASET_TOTAL_LIMIT = 450 * 1024 * 1024;
/** dataset 合计体积预算（solar 日历口径）。 */
export const DATASET_TOTAL_LIMIT_SOLAR = 1024 * 1024 * 1024;

/**
 * 目录内 dataset 根路径；`--out` 含 `..` 段即报错。
 * @param outDir - 输出目录
 * @returns dataset 根路径
 * @throws `--out` 含 `..` 段
 */
export function datasetDirIn(outDir: string): string {
	if (outDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	return path.join(path.resolve(outDir), "dataset");
}

// 逐源分片原文 parquet 先落这里，收尾统一重打包成 11 片。须与 dataset/ 平级：收尾整体清空 dataset/ 再写（spec §5.3），
// 暂存在里面会被一并删掉，断点续建无从谈起。
/**
 * dataset 暂存目录，与 dataset/ 平级防收尾清空。
 * @param outDir - 输出目录
 * @returns 暂存目录路径
 * @throws `--out` 含 `..` 段
 */
export function datasetStagingDirIn(outDir: string): string {
	if (outDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	return path.join(path.resolve(outDir), "dataset.staging");
}

// 片名 topics-<起始 sample_id，补零 6 位>.parquet，补零保证字典序=数值序；变长名排序错，误导人眼与 git。
/**
 * 主题分片文件名；样本号补零 6 位，保证字典序与数值序一致。
 * @param startSampleId - 起始样本号
 * @returns 主题分片文件名
 */
export function topicsPartName(startSampleId: number): string {
	return `topics-${String(startSampleId).padStart(6, "0")}.parquet`;
}

// 只匹配 topics-*.parquet：同目录 samples.parquet/palaces.parquet 不能卷入（列异）。
/**
 * dataset 主题分片 glob（`topics-*.parquet`）。
 * @param outDir - 输出目录
 * @returns glob（`--out` 含 `..` 段时经 {@link datasetDirIn} 报错）
 */
export function topicsPartGlobIn(outDir: string): string {
	return path.join(datasetDirIn(outDir), "topics-*.parquet");
}

// dataset topics 视图同为无聚合 read_parquet：原文形态检索 232ms/正则 257ms/count 44ms 可用；行字典 GROUP BY 把这三项拖慢一数量级或 OOM（spec §3.2）。
/**
 * dataset `topics` 视图 SQL：read_parquet 分片。
 * @param datasetDir - dataset 目录
 * @returns VIEW 语句
 * @throws 路径含 `..` 段
 */
export function topicsViewSqlDataset(datasetDir: string): string {
	if (datasetDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	return `CREATE OR REPLACE VIEW topics AS
    SELECT * FROM read_parquet(${sqlLiteral(path.join(datasetDir, "topics-*.parquet"))})`;
}

// dataset 检索宏：每主题列完整，直接 contains，比 inline 短——不需「行号数组 → 行」还原，也不能照搬 inline 版
// （它 JOIN topic_dict/topic_lines，此处无此二表）。含换行守卫在 inline 版必需（行字典把多行拼一列，跨行匹配命中假边界），
// 原文相反：列即源文本，换行模式有明确定义。
/**
 * dataset `search_topic(t, p)` 宏：原文列 contains。
 * @returns MACRO 语句
 */
export function searchTopicMacroSqlDataset(): string {
	const arms = STORAGE_TOPIC_KEYS.map(k => `    WHEN '${k}' THEN contains(${k}, p)`).join("\n");
	return `CREATE OR REPLACE MACRO search_topic(t, p) AS TABLE
  SELECT sample_id FROM topics WHERE CASE t
${arms}
  END`;
}

// 无库文件时（clone）用 :memory: 现建全部对象。路径按当次 --out 现推，故无 parquet 那种
// 「视图里写死构建时绝对路径、
// 换个位置就查不了」问题（spec §6.1）。
/**
 * dataset 建视图与宏语句（路径按当次 `--out` 现推）。
 * @param datasetDir - dataset 目录
 * @returns 语句序列
 * @throws 路径含 `..` 段
 */
export function datasetSchemaSql(datasetDir: string): string[] {
	if (datasetDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	/** 拼 `CREATE VIEW <name> AS SELECT * FROM read_parquet(<file>)`。 */
	const view = (name: string, file: string) =>
		`CREATE VIEW ${name} AS SELECT * FROM read_parquet(${sqlLiteral(path.join(datasetDir, file))})`;
	return [
		view("samples", "samples.parquet"),
		view("palaces", "palaces.parquet"),
		topicsViewSqlDataset(datasetDir),
		searchTopicMacroSqlDataset(),
	];
}

// 已删除入口报错文案：--db/--topics-dir/--dict 表达「库放哪、边车放哪」，现 --out=DIR。
// 废弃入口须显式失败（verify 只找它要的名字），不拦就会「以为指定了库、
// 实际读的是默认位置」。
/**
 * 拦下已删参数名，避免静默落回默认。
 * @param key - 已删除参数名（如 `--db`）
 * @returns 报错文案（说明「改成什么」）
 */
export function deletedArgHint(key: string): string {
	return (
		`${key} 已删除：输出位置改由 --out=DIR 指定，` +
		"目录内的名字全部固定（库 ziwei.duckdb、数据集目录 dataset）"
	);
}

// 路径由本进程拼装（非用户输入），需转义单引号
/**
 * 转义 SQL 字面量（单引号翻倍）。
 * @param s - 待转义的字符串
 * @returns SQL 字面量
 */
export function sqlLiteral(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

// 结构表-only（detectLayout 的 'parquet' 态）的 topics 视图：读取给定目录下全部 *.parquet。
// 与 inline 版本的关键差别是**没有聚合**——因此 contains() 可以下推。
// dataset 的生产路径用 topicsViewSqlDataset（glob 精确到 topics-*.parquet，避免卷进
// samples/palaces）；本函数保留为 detectLayout 测试构造 'parquet' 态的最小构造器。
/**
 * 构造 `read_parquet` 形态的 `topics` 视图，供布局检测测试使用。
 *
 * @param topicsDir - 存放 parquet 的目录
 * @returns 读该目录全部 `*.parquet` 的 `topics` 视图语句
 */
export function topicsViewSqlParquet(topicsDir: string): string {
	return `CREATE OR REPLACE VIEW topics AS
    SELECT * FROM read_parquet(${sqlLiteral(path.join(topicsDir, "*.parquet"))})`;
}

// 形态探测（spec §3.2）：不新增元数据表，靠两种形态本来就互斥的结构特征判定。
// inline 的 schema 已验收锁定，为存一个 mode 字段而多建一张表，
// 会让「inline 与验收版逐字节一致」这条硬约束不再成立。
//
// 判据必须同时看两项：只看字典两表会把「改动前的旧格式库」误判成 parquet
// （它们同样没有字典表，但也没有 read_parquet 视图），那是 unknown。
/**
 * 探测库的布局；判据同时看字典表与 read_parquet 视图，判不出时为 unknown。
 *
 * @param conn - 已连接的库
 * @returns `inline` / `parquet`；两项判据都不成立时为 `unknown`
 */
export async function detectLayout(conn: DuckDBConnection): Promise<DbLayout | "unknown"> {
	const rows = await (
		await conn.run(`
    SELECT (SELECT count(*) FROM information_schema.tables
              WHERE table_schema = 'main'
                AND table_name IN ('topic_dict', 'topic_lines')) AS dict_tables,
           (SELECT sql FROM duckdb_views() WHERE view_name = 'topics')  AS topics_sql`)
	).getRowsJS();
	const [dictTables, topicsSql] = (rows[0] ?? []) as [bigint | number, string | null];
	if (Number(dictTables) === 2) {
		return "inline";
	}
	if (
		Number(dictTables) === 0 &&
		typeof topicsSql === "string" &&
		topicsSql.includes("read_parquet")
	) {
		return "parquet";
	}
	return "unknown";
}

// ── 读侧：查询目标解析与 dataset 形态的打开 ──
// 形态判定（spec §6.1）：有 dataset/ 就走 dataset，库只在没有 dataset/ 时才用。
// ⚠️ 顺序不能反（dataset 形态下视图/宏按次现建，库内定义烧死构建期路径、且无宏）：
// 详见 docs/code/db-tools.md
/** 查询目标的三种形态：库文件、dataset 目录，或两者都不存在。 */
export type QueryTarget =
	{ kind: "db"; dbPath: string } | { kind: "dataset"; datasetDir: string } | { kind: "none" };

/**
 * 按 `--out` 推断查询目标；dataset 优先于库文件。
 *
 * @param outDir - 输出目录
 * @returns 查询目标：dataset 优先于库文件，两者都不存在为 `none`
 * @throws `--out` 含 `..` 段
 */
export function resolveQueryTarget(outDir: string): QueryTarget {
	if (outDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	const datasetDir = datasetDirIn(outDir);
	if (existsSync(datasetDir)) {
		return { kind: "dataset", datasetDir };
	}
	const dbPath = dbPathIn(outDir);
	if (existsSync(dbPath)) {
		return { kind: "db", dbPath };
	}
	return { kind: "none" };
}

// dataset 形态没有库文件可开，只能起一个 :memory: 实例、按当次 --out 现建视图。
// 路径是**每次查询时**推出来的，故不存在 sidecar 那种「构建时的绝对路径写死在视图里、
// 换个位置就查不了」的问题（spec §6.1）。
/**
 * 以只读方式打开 dataset 目录（现建视图与宏后返回连接）。
 *
 * @param datasetDir - dataset 目录
 * @returns 已建好视图与宏的只读连接
 * @throws dataset 目录内容不齐备或 parquet 损坏（附中文指引与底层原因）
 */
export async function openDataset(datasetDir: string): Promise<DuckDBConnection> {
	if (datasetDir.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	const instance = await DuckDBInstance.create(":memory:");
	const conn = await instance.connect();
	try {
		await conn.run("SET threads=4");
		// v4 代（ziwei-interp）的解读文本约为 v3 代的 2 倍长。此限与 build-duckdb 的
		// 12GB 不同：导出/查询与 node 侧 collectTopic 同进程共存，须给宿主留物理内存
		// （30GB 机器上 node 10GB + DuckDB 6GB + 系统 ≈ 安全水位，物理 OOM killer 实测会杀 node）。
		await conn.run("SET memory_limit='6GB'");
		for (const stmt of datasetSchemaSql(datasetDir)) {
			await conn.run(stmt);
		}
	} catch (e) {
		// 目录存在但内容不齐备（缺件或 parquet 损坏）：把 DuckDB 的裸 IO Error 转成
		// 中文指引。原始消息附在后面，其中含具体文件路径，便于定位缺了哪一件。
		conn.closeSync();
		throw new Error(
			`dataset 目录不完整或损坏（${datasetDir}）：${e instanceof Error ? e.message : String(e)}。` +
				"请重新构建 dataset，或检查下载/克隆是否完整",
			{ cause: e }
		);
	}
	return conn;
}
