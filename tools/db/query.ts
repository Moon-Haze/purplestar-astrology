/**
 * @file DuckDB 基准库的交互式查询命令入口。
 */
// 交互式查询入口的用法、子命令与参数绑定详见 docs/code/db-tools.md §六。
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DuckDBConnection } from "@duckdb/node-api";
import { dbPathIn, datasetDirIn, openDataset, openReadOnly, resolveQueryTarget } from "./db";
import { parseArgs, UsageError } from "./query-args";
import { dispatch } from "./query-commands";

/** 查询入口：解析参数、打开目标并分发查询。 */
async function main() {
	const args = parseArgs(process.argv.slice(2));
	const target = resolveQueryTarget(args.out);
	if (target.kind === "none") {
		console.error(
			`既无库 ${dbPathIn(args.out)}，也无 dataset 目录 ${datasetDirIn(args.out)}。` +
				`请先 npm run build:db -- --out=${args.out} --mode=dataset`
		);
		process.exitCode = 2;
		return;
	}

	let conn: DuckDBConnection;
	if (target.kind === "db") {
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
		await dispatch(conn, args);
		const ms = performance.now() - t0;
		// 耗时走 stderr：不污染 stdout 的表格/JSON（可安全管道给 jq 等）
		console.error(`查询耗时 ${ms < 1 ? ms.toFixed(2) : ms.toFixed(0)}ms`);
	} finally {
		conn.closeSync();
	}
}

// 作为模块被导入时不执行（测试直接调各模块的导出函数）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(e => {
		if (e instanceof UsageError) {
			console.error(e.message);
			process.exitCode = 2;
		} else {
			console.error(e instanceof Error ? e.message : e);
			process.exitCode = 1;
		}
	});
}
