/**
 * @file node:test 事件流的结构化聚合 reporter。
 */
// ── npm test 的聚合 reporter ──
// ⚠️ 由 test/lib/run.ts 以 `--test-reporter` 绝对路径挂载；只依赖单事件自带的可靠字段，
// 不依赖「测试树形状」。原理与挂载细节见 docs/code/test-infra.md。
import { Transform } from "node:stream";

/** 一条测试事件的精简形态 —— run.ts 聚合的唯一输入。 */
export interface TestEventRecord {
	/** 归一后的四类事件，其余丢弃 */
	type: "pass" | "fail" | "diagnostic" | "summary";
	/** 用例名 */
	name: string;
	/** 事件来源文件（分层依据：test/chart.test.ts → 层 1） */
	file: string | null;
	/** 耗时（毫秒）；诊断与 summary 为 null */
	durationMs: number | null;
	/** 诊断消息 */
	message: string | null;
	/** 失败详情 */
	errorMessage: string | null;
	/** 仅 summary：文件级官方计数 */
	counts: { total: number; passed: number; failed: number } | null;
}

/** node:test 事件流里我们关心的那部分。 */
interface RawTestEvent {
	/** node:test 的事件类型原文 */
	type?: string;
	/** 事件负载；各键按事件类型出现或缺失 */
	data?: {
		name?: string;
		file?: string;
		details?: { duration_ms?: number; error?: { message?: string; stack?: string } };
		message?: string;
		/** summary 事件的耗时在 data 顶层 */
		duration_ms?: number;
		counts?: { tests?: number; passed?: number; failed?: number };
	};
}

/** 自定义 reporter：把 node:test 事件流聚合成逐行 JSON 供 run.ts 汇总。 */
export default function aggregateReporter(): Transform {
	return new Transform({
		objectMode: true,
		/** Transform 流实现：把 node:test 事件压成一行一条 JSON。 */
		transform(event: RawTestEvent, _enc, cb) {
			const t = event.type;
			const type =
				t === "test:pass"
					? "pass"
					: t === "test:fail"
						? "fail"
						: t === "test:diagnostic"
							? "diagnostic"
							: t === "test:summary"
								? "summary"
								: null;
			if (!type) {
				cb(); // enqueue/dequeue/start/plan 等与聚合无关，跳过不转发
				return;
			}
			const d = event.data ?? {};
			const rec: TestEventRecord = {
				type,
				name: d.name ?? d.message ?? "",
				file: d.file ?? null,
				durationMs:
					type === "pass" || type === "fail"
						? (d.details?.duration_ms ?? null)
						: type === "summary"
							? (d.duration_ms ?? null)
							: null,
				message: type === "diagnostic" ? (d.message ?? null) : null,
				errorMessage: type === "fail" ? (d.details?.error?.message ?? null) : null,
				counts:
					type === "summary" && d.counts
						? {
								// node 26 实测：summary.counts 的项数字段名是 tests（不是 total）
								total: d.counts.tests ?? 0,
								passed: d.counts.passed ?? 0,
								failed: d.counts.failed ?? 0,
							}
						: null,
			};
			cb(null, JSON.stringify(rec) + "\n");
		},
	});
}
