// ── npm test 的聚合 reporter ──
//
// 由 test/lib/run.ts 以 `--test-reporter <本文件绝对路径>` 挂载（相对路径会
// ERR_MODULE_NOT_FOUND，勿改回相对），与 spec reporter 并行：spec 照常输出到
// stdout（人看），本 reporter 把事件流过滤成「一行一条 JSON」落到临时文件。
//
// ⚠️ 只依赖**单事件自带**的可靠字段（file / name / details.duration_ms / message）。
//    实测（node 26）多文件并行下 classname / nesting / parentId 会部分丢失或错乱，
//    任何依赖「测试树形状」的聚合在这里都不可靠 —— 分层用 file（四个测试文件
//    天然对应层 1-4），项数与耗时用每个文件的 test:summary（官方口径）。
import { Transform } from "node:stream";

/** 一条测试事件的精简形态 —— run.ts 聚合的唯一输入。 */
export interface TestEventRecord {
	type: "pass" | "fail" | "diagnostic" | "summary";
	name: string;
	/** 事件来源文件（分层依据：test/chart.test.ts → 层 1，以此类推） */
	file: string | null;
	/** 该测试的耗时（毫秒）；诊断与 summary 事件为 null */
	durationMs: number | null;
	/** 诊断消息（test:diagnostic 才有） */
	message: string | null;
	/** 失败详情（test:fail 的 details.error） */
	errorMessage: string | null;
	/** 仅 summary 事件：文件级官方计数 */
	counts: { total: number; passed: number; failed: number } | null;
}

/** node:test 事件流里我们关心的那部分（其余事件整类丢弃）。 */
interface RawTestEvent {
	type?: string;
	data?: {
		name?: string;
		file?: string;
		details?: { duration_ms?: number; error?: { message?: string; stack?: string } };
		message?: string;
		/** summary 事件的耗时在 data 顶层（不在 details 里） */
		duration_ms?: number;
		counts?: { tests?: number; passed?: number; failed?: number };
	};
}

export default function aggregateReporter(): Transform {
	return new Transform({
		objectMode: true,
		transform(event: RawTestEvent, _enc, cb) {
			const t = event.type;
			const type =
				t === "test:pass" ? "pass"
				: t === "test:fail" ? "fail"
				: t === "test:diagnostic" ? "diagnostic"
				: t === "test:summary" ? "summary"
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
