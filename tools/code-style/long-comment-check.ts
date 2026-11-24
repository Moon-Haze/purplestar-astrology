#!/usr/bin/env node
/**
 * @file 连续长注释的 code-style 规范检查器。
 */
// ── code-style 长注释检查器（openspec/specs/code-style 硬条款执行面）──
//
// 规则：单个连续注释块 > 10 行即违规；阈值 10 是 spec 单一登记值，调整先改 spec。
// 排除三类：文件头/许可证块（起始行 ≤ 5）、`/**` JSDoc 块、`test/` 目录——
// 头注释与 API 文档有其存在理由，测试的场景描述长注释是 spec 的一部分。
// 扫描面：`scripts/` 与 `tools/` 下的 `.ts`；存量注释不追究（见 change proposal）。

import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 与 code-style spec 登记阈值同值；两处须一致，改动先改 spec。 */
const MAX_COMMENT_LINES = 10;

/** 一处超长注释块命中：文件、起始行与行数。 */
export interface LongCommentHit {
	/** 命中文件路径，原样取自传入清单 */
	file: string;
	/** 块首行行号（1-based；起始行 ≤ 5 的头块不算违规） */
	line: number; // 块起始行（1-based）
	/** 块内连续注释行数，超过 MAX_COMMENT_LINES 即违规 */
	lines: number; // 连续注释行数
}

/**
 * 清单里只认 `scripts/` 与 `tools/` 路径段下的 `.ts`，`test/` 段一律排除。
 *
 * @param p - 待判路径（相对或绝对）
 * @returns 是否属于扫描面（`scripts/` 或 `tools/` 下的 `.ts`，且不在 `test/` 段）
 */
function isScannable(p: string): boolean {
	if (!p.endsWith(".ts")) {
		return false;
	}
	const segs = p.split(/[\\/]/);
	return !segs.includes("test") && (segs.includes("scripts") || segs.includes("tools"));
}

/**
 * 逐行状态机：`//` 行、块起手行、块内 `*` 续行与收尾行，连续者计为一次「运行」；
 * `/**` JSDoc 整块跳过并切断当前运行（两侧隔着 API 文档，不算连续）。
 * 运行结束时行数 > 阈值且起始行 > 5（非头块）即记违规。
 *
 * @param file - 文件路径（原样写进违规记录）
 * @param content - 文件全文
 * @returns 该文件的违规项：起始行号与行数
 */
function scanFile(file: string, content: string): LongCommentHit[] {
	const hits: LongCommentHit[] = [];
	let inBlock = false;
	let jsdocBlock = false;
	let runStart = 0;
	let runLen = 0;
	/** 结束当前连续注释运行，超阈值且非头块时记一项违规。 */
	const closeRun = (): void => {
		if (runLen > MAX_COMMENT_LINES && runStart > 5) {
			hits.push({ file, line: runStart, lines: runLen });
		}
		runStart = 0;
		runLen = 0;
	};
	content.split("\n").forEach((raw, idx) => {
		const t = raw.trim();
		const no = idx + 1;
		if (inBlock) {
			if (!jsdocBlock) {
				runLen++;
			}
			if (t.endsWith("*/")) {
				inBlock = false;
				jsdocBlock = false;
			}
			return;
		}
		if (t.startsWith("/**")) {
			closeRun();
			if (!t.endsWith("*/")) {
				inBlock = true;
				jsdocBlock = true;
			}
			return;
		}
		if (t.startsWith("//") || t.startsWith("/*")) {
			if (runLen === 0) {
				runStart = no;
			}
			runLen++;
			if (t.startsWith("/*") && !t.endsWith("*/")) {
				inBlock = true;
			}
			return;
		}
		closeRun();
	});
	closeRun();
	return hits;
}

/**
 * 库入口：扫描传入清单并返回违规（相对/绝对路径皆可，按路径段过滤）。
 * 不打印、不退出——处置由调用方决定（review 转 finding，CLI 打印并定退出码）。
 *
 * @param files - 待扫描文件清单
 * @returns 违规项清单
 */
export function checkLongComments(files: string[]): LongCommentHit[] {
	const hits: LongCommentHit[] = [];
	for (const f of files) {
		if (!isScannable(f)) {
			continue;
		}
		hits.push(...scanFile(f, readFileSync(f, "utf8")));
	}
	return hits;
}

// ── CLI：无参扫全仓 `scripts/`+`tools/`，有参按清单扫；有违规退出码 1 ──
/**
 * 递归收集目录下的 `.ts`，跳过 test 与 node_modules。
 *
 * @param dir - 递归起点
 * @param out - 累积数组（就地追加绝对路径）
 * @returns 无返回值
 */
function walkTs(dir: string, out: string[]): void {
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (ent.isDirectory()) {
			// `test` 排除口径同 isScannable；node_modules 不属扫描面，防误入
			if (ent.name === "test" || ent.name === "node_modules") {
				continue;
			}
			walkTs(resolve(dir, ent.name), out);
		} else if (ent.name.endsWith(".ts")) {
			out.push(resolve(dir, ent.name));
		}
	}
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	const args = process.argv.slice(2);
	const files: string[] = args.length
		? args
		: ["scripts", "tools"].flatMap(d => {
				const out: string[] = [];
				walkTs(resolve(REPO_ROOT, d), out);
				return out;
			});
	const hits = checkLongComments(files);
	if (hits.length) {
		console.log(
			`连续注释 > ${MAX_COMMENT_LINES} 行（code-style spec 硬条款，处置：外置 docs/code/）：`
		);
		for (const h of hits) {
			const shown = h.file.startsWith(REPO_ROOT) ? relative(REPO_ROOT, h.file) : h.file;
			console.log(`  ${shown}:${h.line}（${h.lines} 行）`);
		}
		console.log(`共 ${hits.length} 处 · 扫描 ${files.length} 个 .ts`);
		process.exitCode = 1;
	} else {
		console.log(
			`无违规 · 扫描 ${files.length} 个 .ts · 阈值 ${MAX_COMMENT_LINES} 行（头块/JSDoc/test/ 除外）`
		);
	}
}
