/**
 * 引文守卫 —— 内核源码里凡以「倪海夏 / 倪师…说」带出的引文，不得与核对记录对不上。
 *
 * 抽取自 `cli/selftest.ts`，为的是让**扫描范围本身**也能被测：守卫失效的方式不是「报错」，
 * 而是「什么都没扫到却一片绿」—— 那种失效只有把守卫摆在测试里、喂给它一棵构造的目录树
 * 才看得见（见 `test/citation-guard.test.ts`）。
 *
 * ## 守卫在防什么
 *
 * `annotations.ts` 是对本仓内核中「倪师 / 倪海夏」引用的文献核对记录，标了四级
 * verified / traditional / methodology / suspect。此前清修时把全部 suspect / fabricated
 * 引文或删、或改归属（如「古诀云」「紫微斗数有云」）。本守卫锁住那次清修：**改归属保留
 * 引文是合法处置，把未核实的引文继续挂在倪师名下则不是。**
 *
 * ## 为什么扫描范围是**推导**出来的
 *
 * 范围 = 内核根下**所有** `.ts`（递归），而不是某份手写的目录/文件清单。这不是洁癖，
 * 是踩过的坑：2026-09-27 的声明分离拆分把引文拆进了新文件，硬编码清单只跟上了一部分，
 * 另一部分成了盲区 —— **而那条断言照旧变绿**。往盲区文件里写一句未核实引文，没有任何
 * 东西会拦。扫全树让「新增 / 拆分 / 移动的带引文模块」自动纳入覆盖，不再依赖有人记得改清单。
 *
 * ## 唯一被排除的文件
 *
 * `annotations.ts` 自己。它存的就是 suspect 引文的原文，扫进去必然自我命中（实测 11~14 条
 * 误报）。这不是重蹈硬编码清单的覆辙 —— 排除的是唯一一个**语义上不该被扫**的文件
 * （它是核对表，不是被核对的对象）；判断依据是**它声明了 `ANNOTATIONS`**，而不是它的文件名，
 * 故改名或拆分后如果仍导出这张表，仍会被正确排除。见 {@link isChecklistSource}。
 *
 * @packageDocumentation
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ANNOTATIONS } from "./annotations";

/** 一次扫描的结果。 */
export interface CitationScan {
	/** 违例的引文核心（已截断到 40 字），按出现顺序 */
	violations: string[];
	/** 参与比对的源码文件，相对内核根、已排序 —— 供调用方交代覆盖面，也是防「扫了个空」的证据 */
	checked: string[];
	/**
	 * 因是核对表自身而被跳过的文件。
	 *
	 * @remarks
	 * 正常恰好 1 个（`ziwei/annotations.ts`）。**为 0 说明 {@link isChecklistSource} 失配**——
	 * 核对表已进比对集，那些 suspect 引文会把自己报成违例；大于 1 则说明有第二份核对表。
	 * 两种都是调用方该立刻发现的状态，故单独记一栏而不是并进 `checked` 里。
	 */
	skipped: string[];
}

/**
 * 该文件是否是核对表自身。
 *
 * @param source - 文件内容
 * @returns 导出 `ANNOTATIONS` 则为 `true`
 *
 * @remarks
 * 判据取「导出 ANNOTATIONS」这个**语义特征**而非文件名：文件改了名、挪到别的子目录，
 * 只要它仍是那张核对表，就仍会被排除；反过来，一个叫 `annotations.ts` 却不再持有核对表的
 * 文件不会白白逃过扫描。这与「扫描范围由推导得出」是同一条原则的两面 —— 名字会漂移，
 * 语义不会。
 */
function isChecklistSource(source: string): boolean {
	return /export\s+const\s+ANNOTATIONS\b/.test(source);
}

/**
 * 递归收集内核根下所有 `.ts` 文件。
 *
 * @param root - 内核根（`scripts/`）
 * @param dir - 当前递归到的目录，相对 `root`（首次调用省略）
 * @returns 相对 `root` 的文件路径，已排序
 *
 * @remarks
 * 跳过 `node_modules` 与点开头的目录：前者不该出现在内核根下（依赖装在 skill 根），
 * 后者是工具目录，都不属于被核对的源码。
 */
function collectTsFiles(root: string, dir = ""): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
		const rel = dir ? `${dir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
			out.push(...collectTsFiles(root, rel));
		} else if (entry.name.endsWith(".ts")) {
			out.push(rel);
		}
	}
	return out.sort();
}

/**
 * 扫描内核源码，找出仍以倪师名义出现的未核实引文。
 *
 * @param root - 内核根（`scripts/`）
 * @returns 违例列表、参与比对的文件清单、被跳过的核对表
 *
 * @remarks
 * 比对方式：把 `ANNOTATIONS` 里 suspect / fabricated 条目的**引文核心**（书名号 / 引号内的
 * 部分）收成一个黑名单，再看源码里所有「倪海夏 / 倪师…说 / 言 / 警示…：『引文』」的引文核心
 * 是否落在其中。
 *
 * ⚠️ **`violations` 为空不等于没问题**：目录为空、路径写歪、递归写坏，都会得到零违例。
 * 调用方必须同时检查 `checked` 与 `skipped` 是否非空 —— 那样的「零违例」是假绿。
 * `cli/selftest.ts` 与 `test/citation-guard.test.ts` 都盯着这一条。
 */
export function scanCitations(root: string): CitationScan {
	const checked: string[] = [];
	const skipped: string[] = [];
	const chunks: string[] = [];
	for (const rel of collectTsFiles(root)) {
		const src = readFileSync(resolve(root, rel), "utf8");
		if (isChecklistSource(src)) skipped.push(rel);
		else {
			checked.push(rel);
			chunks.push(src);
		}
	}

	// suspect/fabricated 条目的引文核心（书名号/引号内的部分）
	const banned = new Set(
		ANNOTATIONS.filter(e => e.status === "suspect" || e.status === "fabricated").flatMap(e =>
			[...e.text.matchAll(/[「"『]([^」"』]{4,})[」"』]/g)].map(m => m[1])
		)
	);
	// 源码中所有「倪海夏/倪师…说/言/警示…：『引文』」的引文核心
	const citeRe =
		/倪(?:海夏|师)[^。\n]{0,10}(?:说|言|称|警示|警告|明言|强调|描述|提醒)[：:]?\s*[「"『]([^」"』]{4,})[」"』]/g;
	const violations = [...chunks.join("\n").matchAll(citeRe)]
		.filter(m => banned.has(m[1]))
		.map(m => m[1].slice(0, 40));

	return { violations, checked, skipped };
}
