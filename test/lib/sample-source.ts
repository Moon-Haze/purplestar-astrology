// ── 基准样本数据源：db/ziwei.duckdb ──
//
// 全项目**唯一**懂 DuckDB 与表结构的地方。三个手工工具（test/tools/full-corpus.ts、
// test/tools/build-fixtures.ts、test/tools/verify-source.ts）都从这里取样本，
// 它们自己不写 SQL、不碰连接。
//
// ⚠️ 本模块**不进 `npm test` 的断言** —— `npm test` 必须继续在「无 db/ziwei.duckdb、
//    无 DuckDB 依赖、无 jsonl 语料」的环境下跑通（见 test/README.md）。
//    test/sample-source.test.ts 只用**合成行**与**不存在的路径**测纯函数，不碰数据文件。
//
// 表结构（`ziwei` 库，`main` schema）：
//   samples  518,400 行 —— 出生信息 + 农历 + 盘级标量
//   palaces  6,220,800 行 —— 每样本恒 12 行：宫位 + 星曜 + 大限区间
//   topics / topic_dict / topic_lines —— 本次不用（论断文本，单条占原语料 90% 体积）
//
// 为什么数据源是单文件而非 720 个 jsonl.gz 分片：
//   · `--year` / `--month` 从「拼路径 + 判文件存在」变成 SQL 谓词，中间状态消失
//   · 1.7 GB 对 5.5 GB
//   · 可直接 SQL 探查，核对排盘不变量不必再写一次性脚本
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DuckDBConnection } from "@duckdb/node-api";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/lib
const SKILL_ROOT = resolve(HERE, "../..");

/** 数据文件路径：<skill 根>/db/ziwei.duckdb */
export const SAMPLE_DB: string = resolve(SKILL_ROOT, "db/ziwei.duckdb");

/** 过滤条件。对应 CLI 的 `--year` / `--month`；`limit` 对应 `--limit`。 */
export interface SampleFilter {
	year?: number;
	month?: number;
	/** 已读取的样本数上限；达到即停止。省略或 `Infinity` 表示不限。 */
	limit?: number;
}

/** 数据源不可用（缺文件 / 缺依赖）。`message` 已是可直接打印给用户的完整指引。 */
export class SourceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SourceError";
	}
}

/**
 * `@duckdb/node-api` 未安装时的指引。
 *
 * 它是 devDependency，只有三个**手工执行**的构建/验收工具用到它 —— 运行 skill 本身
 * （`node scripts/purple-star.ts ...`）完全不需要。所以「没装」是正常状态，不是故障。
 */
export function missingDepHint(err: unknown): string {
	return (
		`缺少依赖 @duckdb/node-api（${err instanceof Error ? err.message : String(err)}）\n` +
		`  它是 devDependency，只有三个手工执行的测试工具用到它 —— 运行 skill 本身不需要。\n` +
		`  处理：在 skill 根执行 npm install`
	);
}

/**
 * `db/ziwei.duckdb` 不存在时的指引。
 *
 * ⚠️ 措辞要挡住一个真实的误判：该库不入版本控制，克隆仓库后它必然缺失，很容易被读成
 *    「语料丢了」。它不是唯一副本 —— `reference/` 下的 jsonl 语料是同一份数据的原始形态，
 *    可以重建出这个库。2026-09-25 曾因 `ls` 是带 `--git-ignore` 的 eza 别名而误判语料已失，
 *    见 docs/superpowers/specs/ 下的设计文档。
 */
export function missingDbHint(path: string = SAMPLE_DB): string {
	return (
		`找不到样本数据库：${path}\n` +
		`  该文件**不入版本控制**（1.7 GB，超出 GitHub 单文件上限 100 MB）。\n` +
		`  它不是唯一副本，所以这里**不是**数据丢失：\n` +
		`    reference/ziwei-samples-toolkit/samples-out  是同一份语料的原始形态\n` +
		`    （5.5 GB / 720 个 jsonl.gz / 60 个年份目录 1924-1983），可由其重建本库。\n` +
		`  日常回归不需要它 —— 跑 npm test 即可，fixtures 已入库。`
	);
}

/** 惰性单例：路径 → 已建立的连接。进程退出时自然释放。 */
const connections = new Map<string, Promise<DuckDBConnection>>();

/**
 * 建立（或复用）到样本库的只读连接。
 *
 * @param dbPath 库文件路径。**仅供测试注入一个不存在的路径**；生产调用一律走默认值，
 *               三个工具都不传这个参数。
 * @throws {SourceError} 缺依赖或库文件不存在时，`message` 已是可直接打印的完整指引。
 */
export async function openSource(dbPath: string = SAMPLE_DB): Promise<DuckDBConnection> {
	const cached = connections.get(dbPath);
	if (cached) return cached;

	const pending = (async (): Promise<DuckDBConnection> => {
		// ⚠️ 动态 import 而非顶层静态 import：它是 devDependency，可能没装。
		//    静态 import 会让整个模块加载失败，连错误指引都打不出来。
		let DuckDBInstance: typeof import("@duckdb/node-api").DuckDBInstance;
		try {
			({ DuckDBInstance } = await import("@duckdb/node-api"));
		} catch (err) {
			throw new SourceError(missingDepHint(err));
		}

		if (!existsSync(dbPath)) throw new SourceError(missingDbHint(dbPath));

		// READ_ONLY：基准工具的立场是「只读语料」。写坏了这个库，两个验收层会一起失真。
		const inst = await DuckDBInstance.create(dbPath, { access_mode: "READ_ONLY" });
		return inst.connect();
	})();

	// 失败的不缓存：否则一次瞬时失败会让后续所有调用都拿到同一个 rejected promise。
	pending.catch(() => connections.delete(dbPath));
	connections.set(dbPath, pending);
	return pending;
}

/** 关闭全部已建立的连接（手工工具收尾用）。 */
export function closeSource(): void {
	for (const pending of connections.values()) {
		pending.then(conn => conn.closeSync()).catch(() => {});
	}
	connections.clear();
}
