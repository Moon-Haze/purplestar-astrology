// query 工具的命令行解析（tools/db）：旗标 + 位置参数 → 结构化 QueryCommand。
// 纯逻辑模块，不碰 DuckDB，错误路径可独立测试。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STORAGE_TOPIC_KEYS, TOPIC_LABEL, type TopicKey } from "../../scripts/analysis/data";
import { deletedArgHint } from "./db";

// ROOT 是 **skill 根**（仓库根），不是 tools/：本文件在 <skill 根>/tools/db/ 下，
// 故上溯两级，与 build-duckdb.ts / verify-duckdb.ts 同。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// 数据住在 <skill 根>/db 子目录里（dataset/ 与库皆然，test/lib/sample-source.ts 的
// DB_DIR 同源），默认即指向它；--out 可覆盖为任意构建产物目录。
export const DEFAULT_OUT = path.join(ROOT, "db");

const USAGE = [
	"用法: npm run query -- <子命令> [参数...] [--json] [--out=DIR]",
	'      npm run query -- "SELECT ..."        # 原样 SQL 透传',
	"子命令: sample <id> | palaces <id> | topic <id> [主题...] | search <主题> <模式> [上限] | count",
].join("\n");

// 用法错误（拼错子命令、缺参、id 非法）与运行错误分开：前者 exit 2 且只打消息不打栈，
// 与「没给 SQL」的旧约定一致。
export class UsageError extends Error {}

export type QueryCommand =
	| { kind: "sql"; sql: string }
	| { kind: "sample"; id: number }
	| { kind: "palaces"; id: number }
	| { kind: "topic"; id: number; keys: string[] }
	| { kind: "search"; topic: string; pattern: string; limit: number }
	| { kind: "count" };

export interface ParsedArgs {
	json: boolean;
	out: string;
	command: QueryCommand;
}

const SUBCOMMANDS = new Set(["sample", "palaces", "topic", "search", "count"]);
// search 输出量的默认上限与可调上限；runSearch 的提示文案也要引用它
export const SEARCH_MAX_LIMIT = 10_000;

// 旗标解析与位置参数收集分离：--out 取值须先于「位置参数」判定消费掉，
// 否则路径会被误当成 SQL / 子命令参数。
export function parseArgs(argv: string[]): ParsedArgs {
	const a: ParsedArgs = { json: false, out: DEFAULT_OUT, command: { kind: "count" } };
	const positionals: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--json") {
			a.json = true;
			continue;
		}
		if (arg === "--out") {
			// resolve 之前先校验原始值：resolve 会把 .. 归一化掉，过了这一步就无从识别
			const v = argv[++i] ?? "";
			if (v.split(/[\\/]/).includes("..")) {throw new UsageError("--out 路径不允许包含 .. 段");}
			a.out = path.resolve(v);
			continue;
		}
		if (arg.startsWith("--out=")) {
			const v = arg.slice(6);
			if (v.split(/[\\/]/).includes("..")) {throw new UsageError("--out 路径不允许包含 .. 段");}
			a.out = path.resolve(v);
			continue;
		}
		// 旧参数显式报错：落到「未知参数」会丢掉「该改成什么」这半句
		if (arg === "--db" || arg.startsWith("--db=")) {throw new UsageError(deletedArgHint("--db"));}
		if (arg.startsWith("--")) {throw new UsageError(`未知参数: ${arg}`);}
		positionals.push(arg);
	}
	a.command = parsePositionals(positionals);
	return a;
}

// 第一个位置参数决定形态：命中子命令名走封装查询，否则整串当原样 SQL。
// 只有**完整等于**子命令名才触发（一个以 "count" 开头的 SQL 字符串不会误入）。
function parsePositionals(p: string[]): QueryCommand {
	const head = p[0];
	if (head === undefined) {throw new UsageError(USAGE);}
	if (!SUBCOMMANDS.has(head)) {
		if (p.length > 1) {
			throw new UsageError(
				`SQL 模式只接受一个位置参数（SQL 本身），多余的: ${p.slice(1).join(" ")}`
			);
		}
		return { kind: "sql", sql: head };
	}
	switch (head) {
		case "sample":
		case "palaces":
			return { kind: head, id: parseId(p[1], head) };
		case "topic": {
			const id = parseId(p[1], head);
			const keys = p.slice(2);
			for (const k of keys) {
				if (!STORAGE_TOPIC_KEYS.includes(k as TopicKey)) {throw new UsageError(topicKeysHint(k));}
			}
			return { kind: "topic", id, keys };
		}
		case "search": {
			if (p[1] === undefined || p[2] === undefined) {
				throw new UsageError(
					'search 需要主题与匹配模式两个参数，示例: search wealth "偏财"'
				);
			}
			if (!STORAGE_TOPIC_KEYS.includes(p[1] as TopicKey)) {throw new UsageError(topicKeysHint(p[1]));}
			let limit = 100;
			if (p[3] !== undefined) {
				const n = Number(p[3]);
				if (!/^\d+$/.test(p[3]) || n < 1 || n > SEARCH_MAX_LIMIT) {
					throw new UsageError(`上限须为 1–${SEARCH_MAX_LIMIT} 的整数，收到: ${p[3]}`);
				}
				limit = n;
			}
			return { kind: "search", topic: p[1], pattern: p[2], limit };
		}
		case "count":
			if (p.length > 1) {throw new UsageError("count 不接受参数");}
			return { kind: "count" };
		// head 已过 SUBCOMMANDS 白名单，此分支不可达；补上只为 switch 穷尽性
		default:
			throw new UsageError(USAGE);
	}
}

function parseId(v: string | undefined, cmd: string): number {
	const n = v === undefined ? NaN : Number(v);
	if (v === undefined || !/^\d+$/.test(v) || n < 1 || n > Number.MAX_SAFE_INTEGER) {
		throw new UsageError(
			`${cmd} 需要一个正整数样本 id，收到: ${v ?? "（缺省）"}（示例: ${cmd} 1）`
		);
	}
	return n;
}

function topicKeysHint(got: string): string {
	const valid = STORAGE_TOPIC_KEYS.map(k => `${k}（${TOPIC_LABEL[k]}）`).join(" ");
	return `未知主题 "${got}"。可选: ${valid}`;
}
