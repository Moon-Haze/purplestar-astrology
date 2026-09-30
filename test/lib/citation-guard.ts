/**
 * 引文守卫 —— 源码里凡以「倪海夏 / 倪师…说」带出的引文，不得与核对记录对不上。
 *
 * **位置**：本文件住在仓库的 `test/lib/` 下（2026-09-27 从排盘解读 skill 的
 * `scripts/ziwei/citation-guard.ts` 移出，扫描逻辑一字未改）。移出的理由有三条：
 *
 * 1. **守卫的受众是改内核的开发者，不是拷贝走 skill 的用户。** 分发一个 skill 时只带走
 *    `SKILL.md + scripts/ + package.json`，`test/` 不带走 —— 一处收拢即可，不必每个
 *    skill 背一份。
 * 2. **一处扫全仓，覆盖面反而扩大。** 从前是「源扫自己的内核树」「合盘扫自己的断语库」，
 *    各扫各的：源扫不到合盘的断语、合盘扫不到源的格局库。现在由 `test/citations.test.ts`
 *    对**每个 skill 的 `scripts/`** 各跑一次，两个盲区一并消失。
 * 3. **它本来就不是产品代码。** 一个只在测试里被调用的函数住在内核里，等于给每个 skill
 *    增加一份分发重量。
 *
 * ⚠️ **它不自己决定扫哪里** —— {@link scanCitations} 收一个根，扫哪个根是调用方的事。
 * 本模块只提供「怎么扫」与「怎么判违例」。
 *
 * ## 守卫在防什么
 *
 * `annotations.ts` 是对本仓源码中「倪师 / 倪海夏」引用的文献核对记录，标了四级
 * verified / traditional / methodology / suspect。此前清修时把全部 suspect / fabricated
 * 引文或删、或改归属（如「古诀云」「紫微斗数有云」）。本守卫锁住那次清修：**改归属保留
 * 引文是合法处置，把未核实的引文继续挂在倪师名下则不是。**
 *
 * ## 为什么扫描范围是**推导**出来的
 *
 * 范围 = 给定根下**所有** `.ts`（递归），而不是某份手写的目录/文件清单。这不是洁癖，
 * 是踩过的坑：2026-09-27 的声明分离拆分把引文拆进了新文件，硬编码清单只跟上了一部分，
 * 另一部分成了盲区 —— **而那条断言照旧变绿**。往盲区文件里写一句未核实引文，没有任何
 * 东西会拦。扫全树让「新增 / 拆分 / 移动的带引文模块」自动纳入覆盖，不再依赖有人记得
 * 改清单。
 *
 * ## 唯一被排除的文件
 *
 * `annotations.ts` 自己。它存的就是 suspect 引文的原文，扫进去必然自我命中（实测 11~14 条
 * 误报）。这不是重蹈硬编码清单的覆辙 —— 排除的是唯一一个**语义上不该被扫**的文件
 * （它是核对表，不是被核对的对象）；判断依据是**它声明了 `ANNOTATIONS`**，而不是它的
 * 文件名，故改名或拆分后如果仍导出这张表，仍会被正确排除。见 {@link isChecklistSource}。
 *
 * @packageDocumentation
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
// ⚠️ 字面相对路径 + 写全 `.ts` 扩展名：本模块靠 Node 的原生类型擦除加载，不走解析钩子。
//    核对表是**唯一一份数据资产**，它留在内核里（`ziwei/annotations.ts`）——
//    全仓的引文都对照它，故本模块 import 它而不是自存一份。
import { ANNOTATIONS } from "../../scripts/ziwei/annotations.ts";

/** 一次扫描的结果。 */
export interface CitationScan {
	/** 违例的引文核心（已截断到 40 字），按出现顺序 */
	violations: string[];
	/** 参与比对的源码文件，相对扫描根、已排序 —— 供调用方交代覆盖面，也是防「扫了个空」的证据 */
	checked: string[];
	/**
	 * 因是核对表自身而被跳过的文件。
	 *
	 * @remarks
	 * 扫**单个** skill 的 `scripts/` 时正常恰好 1 个（源 skill 的 `ziwei/annotations.ts`），
	 * 其余 skill 为 0 个（它们不持有核对表）。**两者都不是异常**，故调用方不该断言它非零 ——
	 * 该断言的是「所有根合计至少有 1 个」，见 `test/citations.test.ts`。
	 *
	 * 但某一栏为空仍有诊断价值：`checked` 为空说明根写歪或递归坏了；`skipped` 全仓为空
	 * 说明 {@link isChecklistSource} 失配 —— 核对表已进比对集，那些 suspect 引文会把自己
	 * 报成违例。两种都是调用方该立刻发现的状态，故单独记一栏而不是并进 `checked` 里。
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
 * 递归收集给定根下所有 `.ts` 文件。
 *
 * @param root - 扫描根（各 skill 的 `scripts/`）
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
 * 扫描一棵源码树，找出仍以倪师名义出现的未核实引文。
 *
 * @param root - 扫描根（一个 skill 的 `scripts/`）
 * @returns 违例列表、参与比对的文件清单、被跳过的核对表
 *
 * @remarks
 * 比对方式：把 `ANNOTATIONS` 里 suspect / fabricated 条目的**引文核心**（书名号 / 引号内的
 * 部分）收成一个黑名单，再看源码里所有「倪海夏 / 倪师…说 / 言 / 警示…：『引文』」的引文核心
 * 是否落在其中。
 *
 * ⚠️ **`violations` 为空不等于没问题**：目录为空、路径写歪、递归写坏，都会得到零违例。
 * 调用方必须同时检查 `checked` 非空 —— 那样的「零违例」是假绿。`test/citations.test.ts`
 * 盯着这一条。
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
