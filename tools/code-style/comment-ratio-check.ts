#!/usr/bin/env node
/**
 * @file 注释占比度量器：定义 A 字符口径的正式检查器。
 */
// ── 注释占比度量器（code-style spec「注释占比上限」的度量报告面）──
//
// 阈值不写死：从 openspec/specs/code-style/spec.md 的「注释占比上限」requirement 解析
// 登记值（spec 场景「度量口径可复现」的承诺）。算法与归档变更
// 2026-11-22-comment-ratio-reduction 的临时真相源 .script_test/analyze-lib.cjs +
// verify.cjs 计数逐字同源——该目录是 gitignored 证据脚本，此文件是其持久化落点。
// 之所以自写字符级 lexer 而不用 TS scanner：TS7 scanner 在模板插值 `${}` 之后不续扫
// 模板正文，会把 `.../*.jsonl.gz` 误判为块注释起点吞掉余下文件（旧口径占比虚低，
// 取证见该变更的 proposal）。
// 判定语义（spec 存量条款）：超标文件若 HEAD 版本同样超标 → 存量超标，列报后 exit 0；
// HEAD 达标而工作区超标 → 本次改动把达标文件改超标（回归），exit 1。
// 用法：npm run code-style:ratio [file.ts ...]（无参扫全仓 scripts/ test/ tools/）

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const SPEC_PATH = "openspec/specs/code-style/spec.md";
/** 生成物不属手写面：走「改生成器重导」，不手改、不参与占比（同 plan.cjs 口径） */
const GENERATED = new Set(["scripts/data/wenmo-tables.ts", "scripts/corpus/data/tianji.ts"]);

/** 单文件占比度量行 */
export interface RatioRow {
	/** 文件路径（相对仓库根） */
	file: string;
	/** 注释纯文字字符数（去语法标记、去空白） */
	m: number;
	/** 代码字符数（剥注释、去空白） */
	d: number;
	/** 注释纯文字占比（百分比，一位小数，先取整后比较） */
	pct: number;
}

/** 超标判定：存量（HEAD 同样超标，spec 存量条款列报）或回归（HEAD 达标、本次改超标） */
export type Verdict = "存量" | "回归";

/** 超标行附带判定 */
export interface OverRow extends RatioRow {
	/** 存量 / 回归判定 */
	verdict: Verdict;
	/** HEAD 版占比（新文件无 HEAD 值，记 null） */
	headPct: number | null;
}

/**
 * 上一 token 是否允许正则字面量起点（除法歧义的消解启发式）。
 *
 * @param prev - 最近一个有效 token 文本（标识符 / 单字符）
 * @returns true 表示此处 `/` 应当按正则起点处理
 */
function prevTokenSuggestsRegex(prev: string): boolean {
	if (!prev) {
		return true;
	}
	if (
		/^(return|throw|case|delete|void|typeof|instanceof|in|of|new|yield|await|const|let|var|if|while|for|with|switch|else|do|then)$/.test(
			prev
		)
	) {
		return true;
	}
	return /[({[,;:=!&|?+\-*%^~<>]$/.test(prev);
}

/**
 * 定义 A 字符级 lexer：扫描全文，产出每个注释区间的 [start, end)。
 * 字符串、模板插值（含嵌套与插值内注释）、正则字面量内的 `/` 均不误判为注释。
 *
 * @param text - 源文件全文
 * @returns 注释区间清单（按起点升序）
 */
function scanCommentRanges(text: string): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	let i = 0;
	const n = text.length;
	let prev = "";
	const isId = (c: string): boolean => /[A-Za-z0-9_$]/.test(c);
	const skipString = (q: string): void => {
		i++;
		while (i < n) {
			const c = text[i];
			if (c === "\\") {
				i += 2;
				continue;
			}
			if (c === q) {
				i++;
				return;
			}
			i++;
		}
	};
	const skipTemplate = (): void => {
		i++;
		while (i < n) {
			const c = text[i];
			if (c === "\\") {
				i += 2;
				continue;
			}
			if (c === "`") {
				i++;
				return;
			}
			if (c === "$" && text[i + 1] === "{") {
				i += 2;
				let depth = 1;
				while (i < n && depth > 0) {
					const d = text[i];
					if (d === "\\") {
						i += 2;
						continue;
					}
					if (d === "'" || d === '"') {
						skipString(d);
						continue;
					}
					if (d === "`") {
						skipTemplate();
						continue;
					}
					if (d === "/" && text[i + 1] === "/") {
						const st = i;
						while (i < n && text[i] !== "\n") {
							i++;
						}
						out.push([st, i]);
						continue;
					}
					if (d === "/" && text[i + 1] === "*") {
						const st = i;
						i += 2;
						while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
							i++;
						}
						i += 2;
						out.push([st, i]);
						continue;
					}
					if (d === "{") {
						depth++;
					} else if (d === "}") {
						depth--;
					}
					prev = d;
					i++;
				}
				continue;
			}
			prev = c;
			i++;
		}
	};
	const skipRegex = (): void => {
		i++;
		let inClass = false;
		while (i < n) {
			const c = text[i];
			if (c === "\\") {
				i += 2;
				continue;
			}
			if (c === "[") {
				inClass = true;
			} else if (c === "]") {
				inClass = false;
			} else if (c === "/" && !inClass) {
				i++;
				return;
			} else if (c === "\n") {
				return;
			}
			i++;
		}
	};
	while (i < n) {
		const c = text[i];
		if (c === "/" && text[i + 1] === "/") {
			const st = i;
			while (i < n && text[i] !== "\n") {
				i++;
			}
			out.push([st, i]);
			continue;
		}
		if (c === "/" && text[i + 1] === "*") {
			const st = i;
			i += 2;
			while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
				i++;
			}
			i += 2;
			out.push([st, i]);
			continue;
		}
		if (c === "'" || c === '"') {
			skipString(c);
			prev = "str";
			continue;
		}
		if (c === "`") {
			skipTemplate();
			prev = "tpl";
			continue;
		}
		if (c === "/" && prevTokenSuggestsRegex(prev)) {
			skipRegex();
			prev = "re";
			continue;
		}
		if (isId(c)) {
			const st = i;
			while (i < n && isId(text[i])) {
				i++;
			}
			prev = text.slice(st, i);
			continue;
		}
		if (/[0-9]/.test(c)) {
			while (i < n && /[0-9._a-fA-FxX]/.test(text[i])) {
				i++;
			}
			prev = "num";
			continue;
		}
		prev = c;
		i++;
	}
	out.sort((a, b) => a[0] - b[0]);
	return out;
}

/**
 * 剥语法标记：去起始标记（两种块注释与行注释起手）、续行前导星号、块注释收尾标记
 * （即 spec 定义的「注释纯文字」；文档注释内不写字面收尾标记，避免提前闭合本块）。
 *
 * @param comment - 单个注释区间原文
 * @returns 纯文字（保留空白，后续统一去空白计数）
 */
function stripMarks(comment: string): string {
	return comment
		.replace(/^\/\*\*?\s*/, "")
		.replace(/\*\/\s*$/, "")
		.split("\n")
		.map(l =>
			l
				.trim()
				.replace(/^\*\s?/, "")
				.replace(/^\/\/\s?/, "")
		)
		.join(" ");
}

/**
 * 度量单文件：注释纯文字字符数、代码字符数与占比（先取整一位小数，与归档证据同口径）。
 *
 * @param text - 源文件全文
 * @returns m / d / pct（pct = m / (m + d) × 100）
 */
export function measureRatio(text: string): { m: number; d: number; pct: number } {
	const ws = (s: string): string => s.replace(/\s/g, "");
	const ranges = scanCommentRanges(text);
	let code = text;
	for (let k = ranges.length - 1; k >= 0; k--) {
		code = code.slice(0, ranges[k][0]) + code.slice(ranges[k][1]);
	}
	const m = ranges.reduce((a, [s, e]) => a + ws(stripMarks(text.slice(s, e))).length, 0);
	const d = ws(code).length;
	const pct = +((m / (m + d)) * 100).toFixed(1);
	return { m, d, pct };
}

/**
 * 从 spec 解析占比阈值登记值（「SHALL NOT 超过 **N%**」必须恰有一处，否则宁可失败）。
 *
 * @returns 阈值百分数（当前 31）
 * @throws spec 文件缺失或登记值不可解析 / 出现多处时 throw，拒绝带猜测运行
 */
function readThresholdFromSpec(): number {
	const spec = readFileSync(resolve(REPO_ROOT, SPEC_PATH), "utf8");
	const hits = [...spec.matchAll(/超过 \*\*(\d+)%\*\*/g)].map(m => Number(m[1]));
	if (hits.length !== 1) {
		throw new Error(`无法从 ${SPEC_PATH} 解析出唯一的占比阈值登记值（命中 ${hits.length} 处）`);
	}
	return hits[0];
}

/**
 * 取 HEAD 版文件全文，用于存量 / 回归二分。
 *
 * @param rel - 相对仓库根的 posix 路径
 * @returns HEAD 内容；文件不在 HEAD（新增）时返回 null
 */
function headContent(rel: string): string | null {
	try {
		return execFileSync("git", ["show", `HEAD:${rel}`], {
			cwd: REPO_ROOT,
			maxBuffer: 64 * 1024 * 1024,
		}).toString("utf8");
	} catch {
		return null;
	}
}

/**
 * 库入口：对传入清单度量并给出超标判定（不打印、不退出，处置交调用方）。
 *
 * @param files - 待扫描 `.ts` 绝对/相对路径清单（生成物不豁免，调用方自行过滤）
 * @param threshold - 占比阈值百分数（读自 spec）
 * @returns 超标行清单（存量 / 回归已判定），按占比降序
 */
export function checkCommentRatio(files: string[], threshold: number): OverRow[] {
	const over: OverRow[] = [];
	for (const f of files) {
		const rel = relative(REPO_ROOT, resolve(REPO_ROOT, f));
		const { m, d, pct } = measureRatio(readFileSync(resolve(REPO_ROOT, rel), "utf8"));
		if (pct <= threshold) {
			continue;
		}
		const head = headContent(rel.split("\\").join("/"));
		if (head === null) {
			// HEAD 无此文件 = 新增文件直接超标，属「新改文件须达标」违反
			over.push({ file: rel, m, d, pct, verdict: "回归", headPct: null });
			continue;
		}
		const headPct = measureRatio(head).pct;
		over.push({
			file: rel,
			m,
			d,
			pct,
			verdict: headPct > threshold ? "存量" : "回归",
			headPct,
		});
	}
	return over.sort((a, b) => b.pct - a.pct);
}

/**
 * 递归收集目录下的 `.ts` 绝对路径。
 *
 * @param dir - 递归起点（绝对路径）
 * @param out - 累积数组（就地追加）
 * @returns 无返回值；`.ts` 绝对路径追加进 `out`
 */
function walkTs(dir: string, out: string[]): void {
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (ent.isDirectory()) {
			walkTs(resolve(dir, ent.name), out);
		} else if (ent.name.endsWith(".ts")) {
			out.push(resolve(dir, ent.name));
		}
	}
}

// ── CLI：无参扫全仓 scripts/ test/ tools/（生成物除外），有参按清单扫 ──
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	const args = process.argv.slice(2);
	const files: string[] = args.length
		? args
		: ["scripts", "test", "tools"]
				.flatMap(d => {
					const out: string[] = [];
					walkTs(resolve(REPO_ROOT, d), out);
					return out;
				})
				.filter(f => !GENERATED.has(relative(REPO_ROOT, f)));
	let threshold: number;
	try {
		threshold = readThresholdFromSpec();
	} catch (e) {
		console.error(`✖ ${(e as Error).message}`);
		process.exit(2);
	}
	const handwritten = files.length;
	const over = checkCommentRatio(files, threshold);
	const legacy = over.filter(r => r.verdict === "存量");
	const regressions = over.filter(r => r.verdict === "回归");
	console.log(
		`手写 .ts ${handwritten} 个 · 阈值 ${threshold}%（读自 ${SPEC_PATH}「注释占比上限」）· ` +
			`超标 ${over.length}（存量 ${legacy.length} · 回归 ${regressions.length}）`
	);
	if (over.length) {
		console.log("占比   注释字  代码字  HEAD%  判定  文件");
		for (const r of over) {
			const head = r.headPct === null ? "  新增" : String(r.headPct).padStart(5);
			console.log(
				String(r.pct).padStart(5) +
					"% " +
					String(r.m).padStart(6) +
					" " +
					String(r.d).padStart(6) +
					" " +
					head +
					"  " +
					r.verdict +
					"  " +
					r.file
			);
		}
	}
	if (regressions.length) {
		console.log(
			`✖ ${regressions.length} 个文件由达标改超标（回归）——本次改动须收敛占比，不得把 ≤${threshold}% 的文件改过线`
		);
		process.exit(1);
	}
	if (legacy.length) {
		// spec 存量条款：不设豁免条目，未改动期间由度量报告如实列报，不伪装达标
		console.log(`ⓘ 全部为存量超标（HEAD 同样超标），按 spec「存量超标文件」条款列报。`);
	}
	process.exit(0);
}
