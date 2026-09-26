import path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';

// spec §5.4：全库 zstd。
// 注意：实测 DuckDB 1.5.5 对 VARCHAR 列一律按 Uncompressed 存储，本开关对它无效
// （经 DOUBLE 列阳性对照确认开关本身生效）。主题文本因此不按原文入库，
// 改为「全局行字典 + 整数数组映射」，见 spec §5/§6。
export const CREATE_DB_PRAGMAS = [
  "PRAGMA force_compression='zstd'",
];

// 13 个主题名，顺序即 topics 视图的列序，也是编码时「主题名列」与「文本列」的配对顺序。
// 视图、构建、校验三处共用，避免各写一份后悄悄漂移。
export const TOPIC_KEYS = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health', 'family',
  'children', 'move', 'friends', 'home', 'spirit', 'parents',
] as const;
export type TopicKey = typeof TOPIC_KEYS[number];

// spec §4.1：结构表两形态共用；主题文本的两张表只有 inline 才建。
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

// 主题文本的行级全局字典。同一行在 518,400 个样本里大量重复（实测 25,920 样本
// 的 336,960 段文本只含 12,626 条唯一行），故整库只需存一份。
// parquet 形态不建这两张表——文本改由库外 Parquet 承载。
export const DDL_INLINE_STATEMENTS: string[] = [
  `CREATE TABLE topic_dict (
    line_id INTEGER PRIMARY KEY,
    line    VARCHAR NOT NULL
  )`,
  // 每个「样本 × 主题」一行，值为该段文本按 chr(10) 拆行后的行号数组（顺序即原文顺序）。
  // 全量 518,400 × 13 = 6,739,200 行；映射落在 DuckDB 确实会压缩的整数列上。
  `CREATE TABLE topic_lines (
    sample_id BIGINT   NOT NULL,
    topic     VARCHAR  NOT NULL,
    line_ids  INTEGER[] NOT NULL
  )`,
];

// spec §5.1/5.2/5.3：inline 形态一次建全（结构 + 字典），与验收版逐字节一致。
export const DDL_STATEMENTS: string[] = [...DDL_STRUCTURE_STATEMENTS, ...DDL_INLINE_STATEMENTS];

// 索引在建库收尾时才创建，故不放进 DDL_STATEMENTS：
// 批量插入期间维护 ART 索引会拖慢构建，而构建期的查询模式（按分片删旧行）用不到它。
export const TOPIC_LINES_INDEX_SQL =
  'CREATE INDEX IF NOT EXISTS idx_topic_lines_sample ON topic_lines(sample_id)';

export async function createDb(dbPath: string, layout: DbLayout = 'inline'): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(dbPath);
  const conn = await instance.connect();
  const ddl = layout === 'parquet'
    ? DDL_STRUCTURE_STATEMENTS
    : DDL_STATEMENTS;
  for (const stmt of [...CREATE_DB_PRAGMAS, ...ddl]) await conn.run(stmt);
  return conn; // 注：instance 由连接持有者负责最终 close（脚本退出时进程回收亦可）
}

// 构建期字典权威副本：与库同目录、同前缀（ziwei.duckdb → ziwei.duckdb.dict.jsonl）。
// 它是「变号检测」的基准——库内 topic_dict 与它不一致，说明已建分片的 line_ids
// 可能整片指向了错误的行，必须立刻停下（spec §7.2/§9.1 第 1 层）。
export function dictPathFor(dbPath: string): string {
  return dbPath + '.dict.jsonl';
}

// 库内 topics 视图：13 列文本由行号数组拼回。列序与原先的外置 Parquet 版本一致，
// 故所有既有查询 SQL 无需改动。
//
// 两处写法都是必需的（均为实测结论）：
//
// 1. 必须走 unnest 展开路径：string_agg 只在输入为多行标量时按行拼接，直接传数组会被
//    字符串化成 "[a, '']" 这样的字面量并返回，不报错但结果全错（spec §6.1）。
// 2. 两处都必须是 LEFT JOIN，不能写逗号连接 + JOIN：
//       FROM topic_lines tl, unnest(tl.line_ids) u(id)  →  空数组产生 0 行，
//     「该主题文本为 NULL」的 (样本, 主题) 对会整行消失；若某个样本 13 个主题全是 NULL，
//    该样本会从视图里凭空消失（实测 3 行输入只剩 2 行：[] 的那行没了）。
//    LEFT JOIN unnest(...) ON TRUE + LEFT JOIN topic_dict 让该行留下、string_agg 无输入
//    → 输出 NULL，正是源侧 NULL 的语义。
//    实测 25,920 样本上两种写法耗时无差（全量重建 0.313s vs 0.334s，点查 0.017s vs 0.014s）。
export function topicsViewSql(): string {
  const cols = TOPIC_KEYS.map(k =>
    `      string_agg(CASE WHEN topic='${k}' THEN d.line END, chr(10) ORDER BY ord) AS ${k}`).join(',\n');
  return `CREATE OR REPLACE VIEW topics AS
    SELECT sample_id,
${cols}
    FROM (SELECT tl.sample_id, tl.topic, u.id, u.ord
          FROM topic_lines tl
          LEFT JOIN unnest(tl.line_ids) WITH ORDINALITY AS u(id, ord) ON TRUE) x
    LEFT JOIN topic_dict d ON d.line_id = x.id
    GROUP BY sample_id`;
}

// 全量文本检索：按行匹配，比走视图的 contains() 快一个数量级（spec §8，实测 27×）。
//
// 守卫必须放在 FROM 的恒一行子查询里，不能写在 WHERE 的 CASE 里（实测）：
// 后者只在有行流经时求值，topic_lines 为空（或该主题一行都没有）时静默返回 0 行，
// 正是守卫要防的静默漏匹配。g.guard = 1 这个恒真条件用于强制求值。
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

export async function openReadOnly(p: string): Promise<DuckDBConnection> {
  // DuckDB 原生配置键名为 access_mode（非 accessMode）；选项表为 Record<string, string>
  const instance = await DuckDBInstance.create(p, { access_mode: 'READ_ONLY' });
  return await instance.connect();
}

// 形态：inline = 单库自足（文本在库内的行字典里）；
// parquet = dataset 载体库的内部布局：三类数据全在库外的 dataset/ 目录，库只承载结构表（spec §6.1）。
// 注意：--mode 只有 inline | dataset 两种，'parquet' 不再是独立形态，仅作为 --mode=dataset 产出库的
// 内部布局名（结构表 + read_parquet topics 视图），供 detectLayout 区分，不对外暴露。
export type DbLayout = 'inline' | 'parquet';

// ── 输出位置的唯一定义处 ──
// build / verify / query 三个脚本都从这里取名字，不各自拼装：路径规则只有一份，
// 改一次即三处同步，不会出现「build 写到 A、query 读 B」这类只在下游才暴露的漂移。
//
// 命令行只给一个目录（--out=DIR），名字全部固定：
//   <DIR>/ziwei.duckdb                 库文件（inline 与 dataset 的构建载体）
//   <DIR>/dataset/                     分发 parquet 目录（仅 --mode=dataset）
//   <DIR>/ziwei.duckdb.dict.jsonl      行字典副本（见 dictPathFor）
//   <DIR>/ziwei.duckdb.progress.json   构建进度（断点续跑）
export function dbPathIn(outDir: string): string {
  return path.join(path.resolve(outDir), 'ziwei.duckdb');
}

// ── dataset 形态：分发产物是库外的一整套 parquet（spec §4）──
// 三类数据全部导出到 dataset/ 目录，接收方不需要库文件即可查询（spec §6.1）。
export const DATASET_PART_SAMPLES = 50_000;

// 构建期逐片断言的上限，比 GitHub 的 100MB 硬限更严：在超限之前就失败，
// 而不是等到 push 被拒（spec §5.2 第 3 阶段）。
export const DATASET_PART_MAX_BYTES = 95 * 1024 * 1024;

// dataset 目录的合计上限。实测 392MiB（379.04 主题 + 12.0 宫位 + 0.8 样本），
// 留约 15% 余量；现状的切片方案是 1.7GiB（spec §8）。
export const DATASET_TOTAL_LIMIT = 450 * 1024 * 1024;

export function datasetDirIn(outDir: string): string {
  return path.join(path.resolve(outDir), 'dataset');
}

// 逐源分片写出的原文 parquet 先落这里，收尾统一重打包成 11 片。
// 必须与 dataset/ 平级而非其子目录：收尾要整体清空 dataset/ 再写（spec §5.3），
// 暂存放在里面会被那次清空一并删掉，断点续建也就无从谈起。
export function datasetStagingDirIn(outDir: string): string {
  return path.join(path.resolve(outDir), 'dataset.staging');
}

// 片名：topics-<本片起始 sample_id，补零 6 位>.parquet。
// 补零到 6 位是为了字典序与数值序一致——变长名会按字典序排错，
// 而 read_parquet 的 glob 读出来顺序虽不影响结果，人眼与 git 却会被误导。
export function topicsPartName(startSampleId: number): string {
  return `topics-${String(startSampleId).padStart(6, '0')}.parquet`;
}

// 只匹配 topics-*.parquet：同目录下的 samples.parquet / palaces.parquet 不能被卷进来，
// 它们的列与 topics 完全不同。
export function topicsPartGlobIn(outDir: string): string {
  return path.join(datasetDirIn(outDir), 'topics-*.parquet');
}

// dataset 形态的 topics 视图。与 parquet 版同为**无聚合**的 read_parquet——
// 这正是原文形态在检索（232ms）、正则（257ms）、全量 count（44ms）上可用的原因，
// 而行字典形态的 GROUP BY 会把这三项分别拖慢一个数量级或直接 OOM（spec §3.2）。
export function topicsViewSqlDataset(datasetDir: string): string {
  return `CREATE OR REPLACE VIEW topics AS
    SELECT * FROM read_parquet(${sqlLiteral(path.join(datasetDir, 'topics-*.parquet'))})`;
}

// dataset 形态的检索宏：每个主题列就是完整文本，直接 contains。
// 比 inline 版短得多，因为不需要「行号数组 → 行」的还原过程；也因此
// **不能**照搬 inline 版（它 JOIN topic_dict/topic_lines，那两张表此处不存在）。
//
// 含换行的守卫在 inline 版里是必需的（行字典把多行拼成一列，跨行匹配会命中
// 原本不存在的行边界），原文形态下则相反：列里就是源文本，含换行模式有明确定义，
// 报错才是错的。
export function searchTopicMacroSqlDataset(): string {
  const arms = TOPIC_KEYS.map(k => `    WHEN '${k}' THEN contains(${k}, p)`).join('\n');
  return `CREATE OR REPLACE MACRO search_topic(t, p) AS TABLE
  SELECT sample_id FROM topics WHERE CASE t
${arms}
  END`;
}

// 无库文件时（clone 后的真实状态）用 :memory: 实例现建的全部对象。
// 路径由调用方按当次 --out 现推，故不存在 parquet 那种「视图里写死构建时绝对路径、
// 换个位置就查不了」的问题（spec §6.1）。
export function datasetSchemaSql(datasetDir: string): string[] {
  const view = (name: string, file: string) =>
    `CREATE VIEW ${name} AS SELECT * FROM read_parquet(${sqlLiteral(path.join(datasetDir, file))})`;
  return [
    view('samples', 'samples.parquet'),
    view('palaces', 'palaces.parquet'),
    topicsViewSqlDataset(datasetDir),
    searchTopicMacroSqlDataset(),
  ];
}

// 已删除入口的报错文案。放在这里与 dbPathIn / datasetDirIn 同处，是因为它讲的正是
// 这些名字的由来：--db / --topics-dir / --dict 表达的是「库放哪、边车放哪」，
// 已被单一的 --out=DIR 取代，用户敲它们多半是照着旧用法。
// 与 rejectLegacyModeEnv 同一模式——废弃入口必须显式失败，不得静默忽略：
// 尤其 verify 的参数解析是宽松的（只找它要的名字），不显式拦就会「以为指定了库、
// 实际读的是默认位置」，是一种事后才暴露的错。
export function deletedArgHint(key: string): string {
  return `${key} 已删除：输出位置改由 --out=DIR 指定，`
    + '目录内的名字全部固定（库 ziwei.duckdb、数据集目录 dataset）';
}

// SQL 字面量转义：路径来自本进程拼装（非用户输入），仍按规范处理单引号
export function sqlLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

// 结构表-only（detectLayout 的 'parquet' 态）的 topics 视图：读取给定目录下全部 *.parquet。
// 与 inline 版本的关键差别是**没有聚合**——因此 contains() 可以下推。
// dataset 的生产路径用 topicsViewSqlDataset（glob 精确到 topics-*.parquet，避免卷进
// samples/palaces）；本函数保留为 detectLayout 测试构造 'parquet' 态的最小构造器。
export function topicsViewSqlParquet(topicsDir: string): string {
  return `CREATE OR REPLACE VIEW topics AS
    SELECT * FROM read_parquet(${sqlLiteral(path.join(topicsDir, '*.parquet'))})`;
}

// 形态探测（spec §3.2）：不新增元数据表，靠两种形态本来就互斥的结构特征判定。
// inline 的 schema 已在 2026-09-25 验收锁定，为存一个 mode 字段而多建一张表，
// 会让「inline 与验收版逐字节一致」这条硬约束不再成立。
//
// 判据必须同时看两项：只看字典两表会把「改动前的旧格式库」误判成 parquet
// （它们同样没有字典表，但也没有 read_parquet 视图），那是 unknown。
export async function detectLayout(conn: DuckDBConnection): Promise<DbLayout | 'unknown'> {
  const rows = await (await conn.run(`
    SELECT (SELECT count(*) FROM information_schema.tables
              WHERE table_schema = 'main'
                AND table_name IN ('topic_dict', 'topic_lines')) AS dict_tables,
           (SELECT sql FROM duckdb_views() WHERE view_name = 'topics')  AS topics_sql`)).getRowsJS();
  const [dictTables, topicsSql] = (rows[0] ?? []) as [bigint | number, string | null];
  if (Number(dictTables) === 2) return 'inline';
  if (Number(dictTables) === 0 && typeof topicsSql === 'string' && topicsSql.includes('read_parquet')) {
    return 'parquet';
  }
  return 'unknown';
}
