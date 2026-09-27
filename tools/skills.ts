// ── 派生 skill 的切片声明（唯一源）──
//
// 本仓是**多个自包含 skill 的源**：`skills/purplestar-astrology`（排盘解读）是唯一的内核来源，
// 其余 skill 由它派生。派生 skill 里凡是「与 skill 无关的整文件」，都与源**逐字节一致** ——
// 手工维护这种一致性必然漂移，故由本文件声明、由 `tools/sync-skills.ts` 执行、
// 由 `test/repo.test.ts` 的断言守卫。
//
// ## 为什么切片是**算出来的**
//
// 每个 skill 的内核切片 = **入口清单的 import 闭包**，不是写死的文件清单。理由：
// 日后往 `classics/data/` 添一部古籍、往 `patterns/` 加一个识别器，那份文件会自动落进
// 正确的 skill，不需要谁记得回来补一行。写死的清单会在这种时候静默漏掉新文件 ——
// 而漏掉的症状是运行时报模块找不到，只有真跑到那条路径才暴露。
//
// ## 副本边界（本方案最要紧的一条）
//
// 「逐字节副本」只适用于**与 skill 无关的整文件**。下面 `ownFiles` 里列的文件是按 skill
// 裁开的（`commands.ts` 在古籍 skill 里只该有 `classics` 一个命令），它们**不是副本**，
// 硬套逐字节断言只会生产一条永远为假的守卫。
//
// | 类别 | 守卫 |
// | --- | --- |
// | 闭包 + sharedFiles（逐字节副本） | sync 同步 + `repo.test.ts` 逐字节断言 |
// | ownFiles（各 skill 自己写） | 各自的 `selftest` + 仓库 `test/cli.test.ts` |
//
// ## 用法
//
// `tools/` 由 tsx 直接执行，不走 CLI 的解析钩子 —— 故本文件对内核一律用**字面相对路径**，
// 不用 `@/` 别名（同 `tools/db/db.ts` 的约定）。本文件**不 import 任何内核代码**：
// 它只读文本、算路径，因此与内核的演化解耦。

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 仓库根 —— 本文件在 `<仓库根>/tools/` 下。 */
export const REPO_ROOT = resolve(HERE, "..");

/** 各 skill 所在目录（源与派生同处一层，靠 `DERIVED_SKILLS` 区分）。 */
export const SKILLS_DIR = resolve(REPO_ROOT, "skills");

/** 源 skill 的目录名。其余 skill 的副本全部由它派生。 */
export const SOURCE_SKILL = "purplestar-astrology";

/** 源 skill 的内核根（`@/` 别名在运行期指向这里）。 */
export const SOURCE_SCRIPTS = resolve(SKILLS_DIR, SOURCE_SKILL, "scripts");

/**
 * 一个派生 skill 的切片声明。
 *
 * @remarks
 * 三张清单的分工必须分清，否则守卫会失效：
 * - `kernelEntries` 是**内核闭包根**（该 skill 需要哪些内核模块），不是文件清单 ——
 *   实际要复制的文件由遍历算出
 * - `sharedFiles` 是**CLI 基础设施**（整份副本，不按 skill 裁）。它同样进闭包 ——
 *   一处也不该例外：`cli/render.ts` 自己 import `@/ziwei/algorithm`，若只复制它而不遍历，
 *   副本会在运行时崩在「找不到模块」，而同步器与断言都看不见
 * - `ownFiles` 是**同步器不碰**的文件。它们必须被显式列出，否则「扫到的多余文件」
 *   判定会把它们当成残留副本删掉
 */
export interface SkillSpec {
	/** 目录名（也是 skill 名，对应 `<仓库根>/skills/<name>/`）。 */
	readonly name: string;
	/** 一行说明，出现在 `sync-skills --check` 的输出里。 */
	readonly summary: string;
	/** 内核闭包根（相对 `<skill>/scripts/`）。 */
	readonly kernelEntries: readonly string[];
	/** CLI 基础设施的闭包根（相对 `<skill>/scripts/`），与 `kernelEntries` 同等对待。 */
	readonly sharedFiles: readonly string[];
	/**
	 * 本 skill 手写、同步器不碰的文件（相对 `<skill>/`）。
	 *
	 * @remarks
	 * 项可以是**单文件**（`"scripts/cli/commands.ts"`）或**整个目录**（以 `/` 结尾，
	 * 如 `"scripts/classics/"`）。目录形态是给「自有内核」用的：某个模块源里不再持有、
	 * 只存在于这一个 skill 里（如古籍 skill 的 `classics/`），就没有可比的副本对象，
	 * 逐字节断言无从谈起 —— 那是**定义**，不是遗漏。判定统一走 {@link isOwned}。
	 */
	readonly ownFiles: readonly string[];
	/**
	 * 这个 skill 是否「排盘类」。
	 *
	 * @remarks
	 * 为 `true` 时，`test/repo.test.ts` 会断言它的 `SKILL.md` 含那几条底座哨兵句
	 * （晚子时 / 体系硬约束 / 虚岁…）。这些是**整节漏抄**的探针，不是逐字校对 ——
	 * 排盘类 skill 的 `SKILL.md` 各有一份手抄的底座，而它们**不能**逐字节相同
	 * （合盘的性别栏是 `--a-gender` / `--b-gender`），故只能用哨兵。
	 *
	 * 缺失（`undefined`）等同 `false`。**必须真有 `true` 的条目，否则断言空转** ——
	 * 一条恒真的守卫比没有守卫更坏，它会被当成保障。
	 */
	readonly chartLike?: boolean;
}

/**
 * 全部派生 skill 的切片声明。
 *
 * @remarks
 * 源 skill（{@link SOURCE_SKILL}）不在此列 —— 它就是副本的来源，不存在「同步自己」。
 * 顺序不影响结果（各 skill 独立同步），但保持与 `skills/` 下的目录序一致便于对照。
 */
export const DERIVED_SKILLS: readonly SkillSpec[] = [
	{
		name: "purplestar-classics",
		summary: "古籍原文检索 —— 三部古籍全文，零排盘内核",
		// ⚠️ 空数组是**刻意**的，不是漏写：古籍内核已是本 skill 的**自有**文件
		// （2026-09-27 源删去 scripts/classics/，该目录只剩这一份）。没有可比的副本对象，
		// 就不该进闭包 —— 它能进来只因为本 skill 手写的 cli/commands.ts 里那条
		// `@/classics/index`，而手写文件不在闭包根里。守卫交给它自己的 selftest
		// 与仓库的 test/cli.test.ts（见 test/repo.test.ts 的分工表）。
		kernelEntries: [],
		// args.ts 只依赖 `cac`（实测），故古籍 skill 不需要 render.ts / birth-info.ts，
		// 更不需要 ziwei/ —— 这是唯一真正零排盘内核的一个。不排盘，故无 chartLike。
		sharedFiles: ["boot-hooks.ts", "cli/args.ts"],
		ownFiles: [
			"SKILL.md",
			"package.json",
			"scripts/purple-star.ts",
			"scripts/classics/",
			"scripts/cli/commands.ts",
			"scripts/cli/flag-scope.ts",
			"scripts/cli/selftest.ts",
		],
	},
	{
		name: "purplestar-synastry",
		summary: "合盘与合婚 —— 双宫联参（夫妻宫 × 福德宫），零排盘引擎",
		// ⚠️ 本 skill **不排盘**（2026-09-27 起）：命盘由源 skill 产出，它只读
		// `analyze --json` 的输出。故 `ziwei/algorithm.ts` 等六个排盘模块**整个不在切片里**
		// —— 它们不是被裁掉，是这里根本不需要（与 classics 同构的「零排盘引擎」形态）。
		//
		// 只剩两个闭包根，各管一件事：
		//
		// `citation-guard.ts` 是为了**引文守卫的覆盖面不静默收缩**：synastry-knowledge
		// 里那些「倪师说」引文，此前靠源的 selftest 扫源内核树时顺带扫到；它一旦离开
		// 源的 scripts/，就脱离了那个扫描根。本 skill 的 selftest 因此要扫自己的根。
		// 这道守卫当初正是为「拆分把引文挪进新文件而清单没跟上」建的 —— 同一个故障
		// 类别不该在它自己身上重演。（`ziwei/annotations.ts` 由它的闭包自动带出，
		// 不显式列 —— 显式列等于多维护一份真相。）
		//
		// ⚠️ `ziwei/types.ts` 是**唯一一个不靠闭包也得显式列**的条目，删它之前请读完这段：
		// 本 skill 的纯类型导入（`cli/chart-view.ts` 的 `import type { ZiweiChart }`）指向
		// 它，而 `chart-view.ts` 住在 **ownFiles** 里 —— ownFiles 不是闭包根，那条 import
		// **不会被遍历到**（与 classics 的 `@/classics/index` 同一种情况）。所以它进不了
		// wanted，除非在这里点名。它是零依赖的纯 interface 文件，带一份的代价只是 294 行文本。
		kernelEntries: ["ziwei/types.ts", "ziwei/citation-guard.ts"],
		// ⚠️ 只剩解析骨架与引导机制。`cli/render.ts` / `cli/birth-info*.ts` 已随排盘职责
		// 一并移出（它们自己 import `@/ziwei/algorithm`，留着会把整个排盘内核拖回闭包）；
		// 合盘真正用到的那几个格式化与查宫函数改住在自写的 `cli/chart-view.ts` 里。
		sharedFiles: ["boot-hooks.ts", "cli/args.ts"],
		ownFiles: [
			"SKILL.md",
			"package.json",
			"scripts/purple-star.ts",
			"scripts/ziwei/synastry-knowledge.ts",
			"scripts/cli/chart-view.ts",
			"scripts/cli/commands.ts",
			"scripts/cli/flag-scope.ts",
			"scripts/cli/selftest.ts",
		],
		// 仍为 `true`：本 skill 输出的是一张**盘**（借源 skill 排的），`SKILL.md` 里那几条
		// 底座哨兵（铁律不猜 / 晚子时 / 三合派 / 虚岁）照样成立。拿掉它会触发
		// `test/repo.test.ts` 层 6 内嵌的「必须真有 chartLike 条目」保护而变红。
		chartLike: true,
	},
];

// ── import 闭包遍历 ──

/**
 * 从一份 TS 源码里抽出它引用的**本地**说明符。
 *
 * @param source - `.ts` 文件全文
 * @returns 相对路径（`./x`）与别名（`@/x`）说明符；裸包名也在返回值里，由
 *   {@link resolveSpec} 过滤
 *
 * @remarks
 * 一条正则同时覆盖四种写法：`import ... from "x"`、`export ... from "x"`、
 * 副作用 `import "x"`、动态 `import("x")`。刻意**不区分 `import type`** ——
 * 类型导入在运行时被擦除（副本其实用不到那个文件），但 `tsconfig.json` 的
 * `include` 是 `skills/**\/*.ts`，**副本会真的被类型检查**，缺文件就报模块找不到。
 * 故闭包按「类型检查需要什么」算，而不是按「运行时需要什么」算。
 */
function localSpecifiers(source: string): string[] {
	const out: string[] = [];
	const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
	for (const m of source.matchAll(re)) out.push(m[1]);
	return out;
}

/**
 * 把一个说明符解析成内核根下的真实文件；裸包名与非 TS 目标返回 `null`。
 *
 * @param spec - 说明符，如 `./types` / `@/ziwei/types` / `cac`
 * @param fromDir - 发起该 import 的文件所在目录（相对说明符的解析基准）
 * @returns 命中的绝对路径；解析不到时 `null`
 *
 * @remarks
 * 候选序与 `boot-hooks.ts` 的解析钩子**必须一致**（`.ts` 优先，再兜底 `<spec>/index.ts`，
 * 最后是字面路径）。这条一致性有 `test/repo.test.ts` 的「解析钩子候选序」一组断言盯着，
 * 但那条断言盯的是钩子本身，**盯不到本函数** —— 两者分叉的症状是：CLI 跑得好好的，
 * 而同步器漏收（或错收）文件。故此处照抄钩子的候选序，改动时两处一起改。
 */
function resolveSpec(spec: string, fromDir: string): string | null {
	const isRel = spec.startsWith(".");
	const isAlias = spec.startsWith("@/");
	if (!isRel && !isAlias) return null; // 裸包名：由 node_modules 解析，不进切片
	const base = isAlias ? resolve(SOURCE_SCRIPTS, spec.slice(2)) : resolve(fromDir, spec);
	for (const cand of [`${base}.ts`, resolve(base, "index.ts"), base]) {
		if (existsSync(cand) && statSync(cand).isFile()) return cand;
	}
	return null;
}

/**
 * 算出入口清单的 import 闭包。
 *
 * @param entries - 入口文件（相对 {@link SOURCE_SCRIPTS}）
 * @returns 闭包内每个文件相对 {@link SOURCE_SCRIPTS} 的路径（`/` 分隔、已排序）
 * @throws 任一入口不存在时（清单写错名会让闭包静默变小，宁可当场失败）
 *
 * @remarks
 * 深度优先、带 visited 去重，故循环依赖不会死循环。排序是为了让输出稳定 ——
 * 调用方（同步器与断言）都按同一顺序遍历，diff 才读得懂。
 */
export function importClosure(entries: readonly string[]): string[] {
	const seen = new Set<string>();
	const queue: string[] = [];
	for (const e of entries) {
		const abs = resolve(SOURCE_SCRIPTS, e);
		if (!existsSync(abs)) throw new Error(`入口不存在：${e}（内核根 ${SOURCE_SCRIPTS}）`);
		queue.push(abs);
	}
	while (queue.length) {
		const f = queue.pop() as string;
		if (seen.has(f)) continue;
		seen.add(f);
		for (const spec of localSpecifiers(readFileSync(f, "utf8"))) {
			const r = resolveSpec(spec, dirname(f));
			if (r) queue.push(r);
		}
	}
	return [...seen].map(f => relative(SOURCE_SCRIPTS, f).split(sep).join("/")).sort();
}

/**
 * 一个派生 skill 需要与源逐字节一致的全部文件（相对 `<skill>/scripts/`）。
 *
 * @param spec - 切片声明
 * @returns 两类闭包根的**并集闭包**，已排序去重
 *
 * @remarks
 * `sharedFiles` 与 `kernelEntries` 一起进闭包（而非直接并入结果）：基础设施自己也会
 * import 内核（`cli/render.ts` → `ziwei/algorithm.ts`），只复制它本身而不遍历，
 * 副本会在运行时崩在「找不到模块」—— 而那时的报错指向的是派生 skill，不是这份声明。
 * 遍历对它们无害：裸包名（`cac`）与 `node:` 内置由 {@link resolveSpec} 直接滤掉。
 */
export function syncedFiles(spec: SkillSpec): string[] {
	// ⚠️ 必须减去自有文件。`sharedFiles` 里的 `cli/args.ts` 静态 import 了 `./flag-scope`，
	// 于是闭包会顺着它把**源**的 `cli/flag-scope.ts` 算进来 —— 而那一份是排盘解读的作用域。
	// 不滤掉，同步器就会拿它覆盖合盘 / 古籍自己的那份，且事后没有任何断言看得出。
	return importClosure([...spec.kernelEntries, ...spec.sharedFiles]).filter(
		f => !isOwned(spec, `scripts/${f}`)
	);
}

/** 目录分隔符统一成 `/` —— 清单里一律是 `/`，前缀比对不能带平台差异。 */
export function toPosix(p: string): string {
	return p.split("\\").join("/");
}

/**
 * `ownFiles` 里是否有项覆盖 `rel`。
 *
 * @param spec - 切片声明
 * @param rel - 相对 **`<skill>/`** 的路径（`/` 分隔），如 `"scripts/cli/commands.ts"`
 * @returns 命中单文件项（精确相等）或目录项（以该项为前缀）
 *
 * @remarks
 * **这是唯一的实现**：`tools/sync-skills.ts` 的残留判定与 `test/repo.test.ts` 层 6 的
 * 守卫都调它。两处各存一份匹配逻辑会让它们对「什么算残留」各说各话 —— 同步器删掉的
 * 文件，守卫可能认为合法（或反之），而两种症状都只在下次同步时才看得见。
 *
 * 目录项的判定按**路径段**而非裸字符串前缀：`"scripts/classics"` 不该命中
 * `"scripts/classics-extra.ts"`，故比的是 `e + "/"`。尾斜杠可有可无，两种写法等价。
 */
export function isOwned(spec: SkillSpec, rel: string): boolean {
	const r = toPosix(rel);
	return spec.ownFiles.some(f => {
		const e = toPosix(f).replace(/\/+$/, "");
		return r === e || r.startsWith(e + "/");
	});
}

/**
 * 列出某个 skill 的 `scripts/` 下实际存在的全部 `.ts` 文件（相对 `<skill>/scripts/`）。
 *
 * @param spec - 切片声明
 * @returns 实际文件路径，已排序；目录不存在时返回空数组
 *
 * @remarks
 * 用于「多余文件」判定：清单缩小时（如某文件不再被引用），上一次同步留下的副本不会被
 * 任何逐字节断言发现 —— 断言只会检查「清单里的都在且一致」，清单外的它不看。
 * 走读实际目录是唯一能发现残留的方式，`sync-skills.ts` 据此清理。
 */
export function actualFiles(spec: SkillSpec): string[] {
	const root = resolve(SKILLS_DIR, spec.name, "scripts");
	const out: string[] = [];
	const walk = (dir: string): void => {
		if (!existsSync(dir)) return;
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const p = resolve(dir, e.name);
			if (e.isDirectory()) {
				// node_modules 不该出现在 skill 里，但真出现了也不能遍历进去
				if (e.name !== "node_modules") walk(p);
			} else if (e.name.endsWith(".ts")) {
				out.push(relative(root, p).split(sep).join("/"));
			}
		}
	};
	walk(root);
	return out.sort();
}

/** 某个 skill 的根目录。 */
export function skillDir(spec: SkillSpec): string {
	return resolve(SKILLS_DIR, spec.name);
}

/** 某个文件在源 skill 里的绝对路径（清单项一律相对 `<skill>/scripts/`）。 */
export function sourcePathOf(rel: string): string {
	return resolve(SOURCE_SCRIPTS, rel);
}
