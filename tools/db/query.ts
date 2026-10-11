// 样本库只读查询入口（tools/db）。本文件只负责装配：命令行解析见 query-args.ts，
// 各子命令的查询与输出见 query-commands.ts，两形态目标的判定与打开见 db.ts。
// 用法: npm run query -- <子命令> [参数...] [--json] [--out=DIR]
//       npm run query -- "SELECT ..."      原样 SQL 透传（--json / --out 同样可用）
// 子命令:
//   sample <id>                  单个样本的结构信息（中文字段名键值表）
//   palaces <id>                 单个样本的十二宫（干支/主星亮度/四化/大限）
//   topic <id> [主题...]         单个样本的主题解读文本；主题缺省输出全部 13 个
//   search <主题> <模式> [上限]  主题文本全文检索（search_topic 宏），默认显示前 100 条
//   count                        samples / palaces / topics 三表行数
// 主题取值 = TOPIC_KEYS：overview personality love career wealth health family
//   children move friends home spirit parents
//
// 参数绑定: 子命令的外部输入（id/主题/模式/上限）一律走 DuckDB 具名参数
// （$id/$topic/$pattern/$limit），SQL 全部是固定字面量，没有任何字符串拼装；
// 主题名另经 TOPIC_KEYS 白名单校验后才用于展示过滤（SQL 侧固定 SELECT *）。
// --out 指定数据目录（默认 <skill 根>/db），目录内名字固定：
// 库 ziwei.duckdb、数据集目录 dataset/（spec §6.1）。
// 库存在时打开库；只有 dataset/ 时（clone 后的状态）起 :memory: 实例现建视图。
// 只读打开（spec §6），不修改库。
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DuckDBConnection } from "@duckdb/node-api";
import { dbPathIn, datasetDirIn, openDataset, openReadOnly, resolveQueryTarget } from "./db";
import { parseArgs, UsageError } from "./query-args";
import { dispatch } from "./query-commands";

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
