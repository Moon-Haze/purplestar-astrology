// 用法: npm run query -- "SELECT ..." [--json] [--out=DIR]
//      参数同时支持 --key=value 与 --key value 两种写法；第一个非 -- 开头的参数即 SQL
// 库存在时打开库；只有 dataset/ 时（clone 后的状态）起 :memory: 实例现建视图
// 只读打开（spec §6），不修改库
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';
import type { DuckDBConnection } from '@duckdb/node-api';
import { dbPathIn, deletedArgHint, openReadOnly, datasetDirIn, datasetSchemaSql } from './db';

// ROOT 是 **skill 根**（仓库根），不是 tools/：本文件在 <skill 根>/tools/db/ 下，
// 故上溯两级，与 build-duckdb.ts / verify-duckdb.ts 同。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = '用法: npm run query -- "SQL" [--json] [--out=DIR]';

interface Args { sql?: string; json: boolean; out: string }

export function parseArgs(argv: string[]): Args {
  const a: Args = { json: false, out: ROOT };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') { a.json = true; continue; }
    // --out 取值须先于「位置参数」判定消费掉，否则路径会被误当成 SQL
    if (arg === '--out') { a.out = path.resolve(argv[++i] ?? ''); continue; }
    if (arg.startsWith('--out=')) { a.out = path.resolve(arg.slice(6)); continue; }
    // 旧参数显式报错：落到下面的「未知参数」会丢掉「该改成什么」这半句
    if (arg === '--db' || arg.startsWith('--db=')) throw new Error(deletedArgHint('--db'));
    if (arg.startsWith('--')) throw new Error(`未知参数: ${arg}`);
    if (a.sql === undefined) a.sql = arg;
  }
  return a;
}

// 形态判定（spec §6.1）：有 dataset/ 就走 dataset，库只在没有 dataset/ 时才用。
//
// 顺序不能反。dataset 形态下视图与宏都是**每次查询时**按当次 --out 现建的，路径永远指向
// 本次目录；而库在 dataset 形态下只是构建载体——库内 topics 视图把构建时的绝对路径烧死
// 在定义里（搬到别处就查不了，原目录还在时更会静默读旧数据），且库里根本没有
// search_topic 宏。所以「库在就用库」会让本地 build:db --mode=dataset 之后这一最常见
// 状态既查不到 search_topic，又在搬运产物目录后读到旧数据。
//
// inline 形态不产 dataset/，仍然走库——本顺序对它没有影响。
export type QueryTarget =
  | { kind: 'db'; dbPath: string }
  | { kind: 'dataset'; datasetDir: string }
  | { kind: 'none' };

export function resolveQueryTarget(outDir: string): QueryTarget {
  const datasetDir = datasetDirIn(outDir);
  if (existsSync(datasetDir)) return { kind: 'dataset', datasetDir };
  const dbPath = dbPathIn(outDir);
  if (existsSync(dbPath)) return { kind: 'db', dbPath };
  return { kind: 'none' };
}

// dataset 形态没有库文件可开，只能起一个 :memory: 实例、按当次 --out 现建视图。
// 路径是**每次查询时**推出来的，故不存在 sidecar 那种「构建时的绝对路径写死在视图里、
// 换个位置就查不了」的问题（spec §6.1）。
async function openDataset(datasetDir: string): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();
  try {
    await conn.run('SET threads=4');
    await conn.run("SET memory_limit='4GB'");
    for (const stmt of datasetSchemaSql(datasetDir)) await conn.run(stmt);
  } catch (e) {
    // 目录存在但内容不齐备（缺件或 parquet 损坏）：把 DuckDB 的裸 IO Error 转成
    // 中文指引。原始消息附在后面，其中含具体文件路径，便于定位缺了哪一件。
    conn.closeSync();
    throw new Error(
      `dataset 目录不完整或损坏（${datasetDir}）：${e instanceof Error ? e.message : String(e)}。`
      + '请重新构建 dataset，或检查下载/克隆是否完整');
  }
  return conn;
}

// BigInt 无 toJSON，JSON.stringify 遇之直接抛 TypeError —— 库里所有 id/计数列都是 BIGINT。
// 值域最大 6,220,800，远低于 Number.MAX_SAFE_INTEGER，转 Number 无损。
const jsonReplacer = (_k: string, v: unknown): unknown => typeof v === 'bigint' ? Number(v) : v;

// 单元格渲染：NULL / 列表 / 结构体各有形态，统一转字符串后截断至 40 字符
const MAX_CELL = 40;
function cell(v: unknown): string {
  const s = v === null || v === undefined ? 'NULL'
    : Array.isArray(v) ? `[${v.join(', ')}]`
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v);
  return s.length > MAX_CELL ? s.slice(0, MAX_CELL - 3) + '...' : s;
}

// 库内容全为中文：CJK 等全角字符占 2 显示列，而 padEnd 按 UTF-16 码元计数，
// 直接用会让表头、分隔线、数据行三者宽度互不相等。故一律按显示宽度计算。
const isWide = (cp: number): boolean =>
  (cp >= 0x1100 && cp <= 0x115f)                     // 韩文字母
  || (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) // CJK 部首/假名/汉字
  || (cp >= 0xac00 && cp <= 0xd7a3)                  // 韩文音节
  || (cp >= 0xf900 && cp <= 0xfaff)                  // CJK 兼容汉字
  || (cp >= 0xfe30 && cp <= 0xfe6f)                  // CJK 兼容形式
  || (cp >= 0xff00 && cp <= 0xff60)                  // 全角 ASCII
  || (cp >= 0xffe0 && cp <= 0xffe6)                  // 全角符号
  || (cp >= 0x20000 && cp <= 0x3fffd);               // CJK 扩展 B 及以后
export const dispWidth = (s: string): number =>
  [...s].reduce((w, ch) => w + (isWide(ch.codePointAt(0) ?? 0) ? 2 : 1), 0);
const pad = (s: string, w: number): string => s + ' '.repeat(Math.max(0, w - dispWidth(s)));

export function renderTable(columns: string[], rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '(0 行)';
  const widths = columns.map(c => Math.max(dispWidth(c), ...rows.map(r => dispWidth(cell(r[c])))));
  const line = (cells: string[]) => cells.map((s, i) => pad(s, widths[i])).join('  |  ');
  const out = [line(columns), widths.map(w => '-'.repeat(w)).join('--+--')];
  for (const r of rows) out.push(line(columns.map(c => cell(r[c]))));
  out.push(`(${rows.length} 行)`);
  return out.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sql) { console.error(USAGE); process.exitCode = 2; return; }
  const target = resolveQueryTarget(args.out);
  if (target.kind === 'none') {
    console.error(`既无库 ${dbPathIn(args.out)}，也无 dataset 目录 ${datasetDirIn(args.out)}。`
      + `请先 npm run build:db -- --out=${args.out} --mode=dataset`);
    process.exitCode = 2;
    return;
  }

  let conn: DuckDBConnection;
  if (target.kind === 'db') {
    conn = await openReadOnly(target.dbPath);
  } else {
    try {
      conn = await openDataset(target.datasetDir);
    } catch (e) {
      // openDataset 已把残缺/损坏转成中文指引；按「入口缺失」而非「查询失败」以 exit 2 退出
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 2;
      return;
    }
  }
  try {
    // 单独计时「执行 + 物化结果」：墙钟还含 node/tsx 启动（约 1s），
    // 验收标准（点查 <100ms 等）针对的是查询本身，两者不能混为一谈。
    const t0 = performance.now();
    const result = await conn.run(args.sql);
    // columnNames() 为同步且不消耗结果集（空结果集亦可取表头）；
    // getRowObjectsJS() 把 list/struct 转为纯 JS 值，键序即列序，但 BIGINT 仍为 BigInt。
    const columns = result.columnNames();
    const rows = await result.getRowObjectsJS() as Array<Record<string, unknown>>;
    const ms = performance.now() - t0;
    if (args.json) {
      console.log(JSON.stringify(rows, jsonReplacer));
    } else {
      console.log(renderTable(columns, rows));
    }
    // 耗时走 stderr：不污染 stdout 的表格/JSON（可安全管道给 jq 等）
    console.error(`查询耗时 ${ms < 1 ? ms.toFixed(2) : ms.toFixed(0)}ms`);
  } finally {
    conn.closeSync();
  }
}

// 作为模块被导入时不执行（测试直接调 parseArgs/renderTable）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}
