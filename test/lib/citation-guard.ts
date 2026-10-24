/**
 * 引文守卫 —— 源码里凡以「倪海厦 / 倪师…说」带出的引文，不得与核对记录对不上。
 *
 * **位置**：本文件住在仓库的 `test/lib/` 下。移出的理由有三条：
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
 * `annotations.ts` 是对本仓源码中「倪师 / 倪海厦」引用的文献核对记录，标了四级
 * verified / traditional / methodology / suspect。此前清修时把全部 suspect / fabricated
 * 引文或删、或改归属（如「古诀云」「紫微斗数有云」）。本守卫锁住那次清修：**改归属保留
 * 引文是合法处置，把未核实的引文继续挂在倪师名下则不是。**
 *
 * ## 为什么扫描范围是**推导**出来的
 *
 * 范围 = 给定根下**所有** `.ts`（递归），而不是某份手写的目录/文件清单。这不是洁癖，
 * 是踩过的坑：一次声明分离拆分把引文拆进了新文件，硬编码清单只跟上了一部分，
 * 另一部分成了盲区 —— **而那条断言照旧变绿**。往盲区文件里写一句未核实引文，没有任何
 * 东西会拦。扫全树让「新增 / 拆分 / 移动的带引文模块」自动纳入覆盖，不再依赖有人记得
 * 改清单。
 *
 * ## 被排除的两类对象
 *
 * `annotations.ts` 自己。它存的就是 suspect 引文的原文，扫进去必然自我命中（实测 11~14 条
 * 误报）。这不是重蹈硬编码清单的覆辙 —— 排除的是唯一一个**语义上不该被扫**的文件
 * （它是核对表，不是被核对的对象）；判断依据是**它声明了 `ANNOTATIONS`**，而不是它的
 * 文件名，故改名或拆分后如果仍导出这张表，仍会被正确排除。见 {@link isChecklistSource}。
 *
 * 另一类是 `corpus/data/manual/`（生成快照目录，见 {@link collectTsFiles}）——
 * 内容是内核表的渲染镜像而非手写断语，同样「不是被核对的对象」。
 *
 * ## `.md` 侧：{@link scanMarkdownCitations}
 *
 * 源码树之外，本仓还有一捆**手写文档**带着倪师引文：`SKILL.md` / `references/`（skill 的
 * 规范面，LLM 解读时真正读到的文本）、`docs/code/`（源码长注释的搬迁目的地，引文从源码
 * 原文照搬而来）、`README.md` / `CLAUDE.md` 等。它们与源码受**同一条纪律**约束，故由
 * {@link scanMarkdownCitations} 按仓库根再扫一遍，与 {@link scanCitations} 共用同一份
 * 黑名单构造与同一套形态正则（见 {@link buildBannedSet} / {@link findViolations}）——
 * 不出现「文档一份判据、源码一份判据」的分叉。
 *
 * `.md` 侧排除 `docs/manual/`（`tools/db/export-manual.ts` 的生成导出），理由与 `.ts` 侧
 * 排除 `corpus/data/manual/` 同源：源头 `analysis/data.ts` 本就在 `.ts` 扫描范围内，
 * 镜像可能带着旧版库的历史引文形态，那是 db 版本问题、重建即消，不是新写的未核实引文。
 *
 * ⚠️ 两个函数的分工是**收集面**不同，不是严格程度不同：`scanCitations` 只扫 `.ts`
 * （供流派适配器的 `citationRoots` 用），`scanMarkdownCitations` 只扫 `.md`。
 * 把 `.md` 塞进前者会让「扫哪个根」变难推理，也会破坏现存那条记录职责边界的元测试。
 *
 * @packageDocumentation
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
// ⚠️ 字面相对路径 + 写全 `.ts` 扩展名：本模块靠 Node 的原生类型擦除加载，不走解析钩子。
//    核对表是**唯一一份数据资产**，它留在内核里（`corpus/data/annotations.ts`）——
//    全仓的引文都对照它，故本模块 import 它而不是自存一份。
import { ANNOTATIONS, type AnnotationEntry } from "../../scripts/corpus/data/annotations.ts";

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
	 * 扫**单个** skill 的 `scripts/` 时正常恰好 1 个（源 skill 的 `corpus/data/annotations.ts`），
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
 *
 * 还跳过 `corpus/data/manual/`：那里是**生成快照**（`tools/db/export-manual.ts`
 * 把样本库的主题文本转印成 TS 数据），全部内容是内核数据表的渲染镜像，不含任何手写
 * 断语 —— 源头（`data.ts` 等）本就在扫描范围内。镜像可能带着旧版库的历史引文形态
 * （库落后于内核清修时），那是 db 版本问题、重建即消，不是新写的未核实引文。
 */
function collectTsFiles(root: string, dir = ""): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
		const rel = dir ? `${dir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) {
				continue;
			}
			// 生成快照（tools/db/export-manual.ts 转印）随知识数据聚拢迁至 corpus/data/manual。
			// 按相对路径**后缀**判断而非整段相等：本收集器既被以 `scripts/` 为根调用
			// （流派 citationRoots，dir = "corpus/data"），也被以仓库根调用
			// （test/citations.test.ts 的仓库级组，dir = "scripts/corpus/data"）——
			// 写死整段会让换根时排除静默失效，快照里的历史引文形态会把真违例淹没。
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
 * 黑名单：核对表里 suspect / fabricated 条目的**引文核心**（书名号 / 引号内的部分）。
 *
 * @remarks
 * `.ts` 侧与 `.md` 侧共用这一个构造 —— 判据只有一份，改口径时两边同时变，
 * 不会出现「文档放行了、源码还拦着」的分叉。
 */
function buildBannedSet(checklist: readonly AnnotationEntry[]): Set<string> {
	return new Set(
		checklist
			.filter(e => e.status === "suspect" || e.status === "fabricated")
			.flatMap(e => [...e.text.matchAll(/[「"『]([^」"』]{4,})[」"』]/g)].map(m => m[1]))
	);
}

/**
 * 在给定的文本块里找出仍以倪师名义出现的未核实引文。
 *
 * @param chunks - 参与比对的文本（源码或文档），由调用方收集
 * @param banned - 黑名单（见 {@link buildBannedSet}）
 * @returns 违例的引文核心（已截断到 40 字），按出现顺序
 *
 * @remarks
 * 形态正则与 `.ts` 侧**逐字相同**：`倪(海厦|师)` + 最多 10 个非句号非换行字符 +
 * 说 / 言 / 称 / 警示 / 警告 / 明言 / 强调 / 描述 / 提醒 + 可选冒号 + 引号内 4 字以上。
 * 不为 `.md` 放松任何一项 —— 放宽的那天就是失效的那天。
 */
function findViolations(chunks: readonly string[], banned: ReadonlySet<string>): string[] {
	// 源码 / 文档中所有「倪海厦/倪师…说/言/警示…：『引文』」的引文核心
	const citeRe =
		/倪(?:海厦|师)[^。\n]{0,10}(?:说|言|称|警示|警告|明言|强调|描述|提醒)[：:]?\s*[「"『]([^」"』]{4,})[」"』]/g;
	return [...chunks.join("\n").matchAll(citeRe)]
		.filter(m => banned.has(m[1]))
		.map(m => m[1].slice(0, 40));
}

/**
 * 扫描一棵源码树，找出仍以倪师名义出现的未核实引文。
 *
 * @param root - 扫描根（一个 skill 的 `scripts/`）
 * @returns 违例列表、参与比对的文件清单、被跳过的核对表
 *
 * @remarks
 * 比对方式：把 `ANNOTATIONS` 里 suspect / fabricated 条目的**引文核心**（书名号 / 引号内的
 * 部分）收成一个黑名单，再看源码里所有「倪海厦 / 倪师…说 / 言 / 警示…：『引文』」的引文核心
 * 是否落在其中。
 *
 * ⚠️ **`violations` 为空不等于没问题**：目录为空、路径写歪、递归写坏，都会得到零违例。
 * 调用方必须同时检查 `checked` 非空 —— 那样的「零违例」是假绿。`test/citations.test.ts`
 * 盯着这一条。
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
 * 递归收集给定根下所有 `.md` 文件。
 *
 * @param root - 扫描根（仓库根）
 * @param dir - 当前递归到的目录，相对 `root`（首次调用省略）
 * @returns 相对 `root` 的文件路径，已排序
 *
 * @remarks
 * 跳过 `node_modules` / 点目录 / `dist`：同 {@link collectTsFiles} 的理由，且 `dist/`
 * 是打包产物。收集面同样是**推导**的——新增的手写子目录自动纳入，不依赖有人记得改清单。
 *
 * ⚠️ 跳过 `docs/manual`：那是 `tools/db/export-manual.ts` 的**生成导出**（Markdown 镜像），
 * 与 `.ts` 侧跳过 `corpus/data/manual` 同源同理——源头 `analysis/data.ts` 本就在 `.ts`
 * 扫描范围内，镜像可能带着旧版库的历史引文形态，是 db 版本问题、重建即消，
 * **不是新写的未核实引文**。按路径排除而非按语义：生成目录没有可识别的语义特征
 * （它的文件不导出任何东西），故理由必须写在注释里，并由元测试钉住排除范围不扩大。
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
			out.push(...collectMdFiles(root, rel));
		} else if (entry.name.endsWith(".md")) {
			out.push(rel);
		}
	}
	return out.sort();
}

/**
 * 扫描一棵文档树，找出仍以倪师名义出现的未核实引文 —— `docs/code/` 搬迁、`SKILL.md` /
 * `references/` 规范面等手写 `.md` 的守门人。
 *
 * @param root - 扫描根（仓库根）
 * @param checklist - 核对表（默认全局唯一那份，见 {@link buildBannedSet}）
 * @returns 违例列表、参与比对的文档清单、被跳过的文件（恒为空，见下）
 *
 * @remarks
 * 与 {@link scanCitations} **共用**黑名单构造与形态正则，差异只在收集面（`.md` 而非 `.ts`）
 * 与扫描根（仓库根而非某 skill 的 `scripts/`）。
 *
 * `skipped` 恒为空数组：核对表住在 `scripts/corpus/data/annotations.ts`，是 `.ts` 不是
 * `.md`，文档侧没有「核对表自身」需要排除。保留该字段是为了与 {@link CitationScan} 同构 —
 * 调用方可以不加分支地合并两种扫描的结果。
 *
 * ⚠️ 与 `.ts` 侧同一条假绿防护：`violations` 为空时必须另看 `checked` 非空。
 */
export function scanMarkdownCitations(
	root: string,
	checklist: readonly AnnotationEntry[] = ANNOTATIONS
): CitationScan {
	const checked = collectMdFiles(root);
	const chunks = checked.map(rel => readFileSync(resolve(root, rel), "utf8"));
	return { violations: findViolations(chunks, buildBannedSet(checklist)), checked, skipped: [] };
}

/** {@link scanCitations} 的多根分派入参（结构化子集，避免与 `SchoolAdapter` 成环）。 */
export interface CitationRootLike {
	scanRoot: string;
	checklist: readonly AnnotationEntry[];
}

/**
 * 按多个 (扫描根, 核对表) 对逐一扫描并合并结果 —— 多流派引文守卫的分派入口。
 *
 * @remarks
 * 每个流派只审自己声明的核对表（ADR-004）：新增流派不得复用倪师核对表，
 * 反之倪师内容也不该被别的流派的核对表放过。合并而非首个命中，是为了
 * 「覆盖面非空 / 零违例」这类断言能一次看到全流派结果。
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
