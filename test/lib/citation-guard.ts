/**
 * 「倪海厦 / 倪师…说」「扫哪里」「古诀云」「紫微斗数有云」；「倪师 / 倪海厦」未核实。
 * 「新增 / 拆分 / 移动的带引文模块」「扫描范围由推导得出」；「不是被核对的对象」；「文档一份判据、源码一份判据」；「扫哪个根」
 * {@link scanCitations} {@link scanMarkdownCitations} {@link scanCitationsForRoots} {@link isChecklistSource} {@link collectTsFiles} {@link scanMarkdownCitations} {@link scanCitations}
 * @packageDocumentation
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
// ⚠️ 相对路径写全 `.ts`：Node 类型擦除。
// 表 corpus/data/annotations.ts；import 不自存。

import {
	buildBannedSet,
	findViolations,
	type CitationScan,
} from "../../scripts/corpus/citation-core.ts";
import { ANNOTATIONS, type AnnotationEntry } from "../../scripts/corpus/data/annotations.ts";

export type { CitationScan };

/**
 * @remarks 判「导出 ANNOTATIONS」非文件名。
 * @param source - 内容
 * @returns 导出 `ANNOTATIONS` 则 `true`
 */
function isChecklistSource(source: string): boolean {
	return /export\s+const\s+ANNOTATIONS\b/.test(source);
}

/**
 * @param root - 根
 * @param dir - 当前目录
 * @returns 相对路径
 * @remarks 见 docs/code/corpus.md。
 */
function collectTsFiles(root: string, dir = ""): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
		const rel = dir ? `${dir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) {
				continue;
			}
			// 「corpus/data/manual」退役；排除分支防重现。

			// 后缀判断防换根失效。

			if (entry.name === "manual" && dir.endsWith("corpus/data")) {
				continue;
			}
			out.push(...collectTsFiles(root, rel));
		} else if (entry.name.endsWith(".ts")) {
			out.push(rel);
		}
	}
	return out.sort();
}

/**
 * @param root - 根
 * @returns 违例/已核对/跳过
 * @remarks 「倪海厦 / 倪师…说 / 言 / 警示…：『引文』」比对；scripts/corpus/citation-core.ts。⚠️「零违例」查 `checked`，test/citations.test.ts。
 */
export function scanCitations(
	root: string,
	checklist: readonly AnnotationEntry[] = ANNOTATIONS
): CitationScan {
	const checked: string[] = [];
	const skipped: string[] = [];
	const chunks: string[] = [];
	for (const rel of collectTsFiles(root)) {
		const src = readFileSync(resolve(root, rel), "utf8");
		if (isChecklistSource(src)) {
			skipped.push(rel);
		} else {
			checked.push(rel);
			chunks.push(src);
		}
	}

	return { violations: findViolations(chunks, buildBannedSet(checklist)), checked, skipped };
}

/**
 * @param root - 根
 * @param dir - 当前目录
 * @returns 相对路径
 * @remarks 同 {@link collectTsFiles}。
 */
function collectMdFiles(root: string, dir = ""): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
		const rel = dir ? `${dir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (
				entry.name === "node_modules" ||
				entry.name === "dist" ||
				entry.name.startsWith(".")
			) {
				continue;
			}
			if (dir === "docs" && entry.name === "manual") {
				continue;
			}
			if (dir === "" && entry.name === "notes") {
				// notes/ 素材。
				// 「倪师说「…」」原貌记录。

				// 元测试钉住范围。
				continue;
			}
			out.push(...collectMdFiles(root, rel));
		} else if (entry.name.endsWith(".md")) {
			out.push(rel);
		}
	}
	return out.sort();
}

/**
 * @param root - 根
 * @param checklist - 表（{@link buildBannedSet}）
 * @returns 违例/已核对/跳过
 * @remarks 同 {@link scanCitations}；表 scripts/corpus/data/annotations.ts；「核对表自身」排除，同 {@link CitationScan} 同构。
 */
export function scanMarkdownCitations(
	root: string,
	checklist: readonly AnnotationEntry[] = ANNOTATIONS
): CitationScan {
	const checked = collectMdFiles(root);
	const chunks = checked.map(rel => readFileSync(resolve(root, rel), "utf8"));
	return { violations: findViolations(chunks, buildBannedSet(checklist)), checked, skipped: [] };
}

/** // {@link scanCitations} 分派入参。 */
export interface CitationRootLike {
	/** // 流派根 `<内核根>/scripts`。 */
	scanRoot: string;
	/** // 流派自己表；禁复用（ADR-004）。 */
	checklist: readonly AnnotationEntry[];
}

/**
 * @remarks 各审己表（ADR-004）；「覆盖面非空 / 零违例」断言。
 * @param roots - (根, 表) 对
 * @returns 合并结果
 */
export function scanCitationsForRoots(roots: readonly CitationRootLike[]): CitationScan {
	const violations: string[] = [];
	const checked: string[] = [];
	const skipped: string[] = [];
	for (const r of roots) {
		const s = scanCitations(r.scanRoot, r.checklist);
		violations.push(...s.violations);
		checked.push(...s.checked);
		skipped.push(...s.skipped);
	}
	return { violations, checked, skipped };
}
