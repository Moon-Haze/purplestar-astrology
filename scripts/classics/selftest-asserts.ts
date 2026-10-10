/**
 * 古籍检索自检断言组 —— 从 classics 自带的 selftest.ts 抽出。
 *
 * 断言体基本原样；适配点只有一类：**参数面断言改跑合并后的根 CLI**
 * （`node scripts/purple-star.ts classics …`），因为 classics 不再有独立入口。
 * 合并引擎（cac 底座）在 `--limit -3` 贪婪取值与取值参数裸写拒收上与 classics
 * 原自研解析器不同 —— 那两条断言按 `util.parseArgs` 引擎的真实行为钉死
 * （见各断言注释）。
 *
 * 与 `cli/selftest.ts` 的接口：导出 {@link asserts}，逐条结果由主 selftest 汇总
 * （报告分三段：排盘 / 古籍 / 合盘）。
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "./index";
import { createHarness, eq, callDirect, type Assertion } from "../cli/selftest-kit";

/** 本内核目录（`scripts/classics`）。 */
const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * 古籍断言组：数据源可用性、检索行为、参数面（进程内直调 + 一条子进程冒烟）与合并接线。
 *
 * @returns 逐条结果；由 `cli/selftest.ts` 并入主报告
 */
export async function asserts(): Promise<Assertion[]> {
	// harness（Assertion / eq / ok）共用 cli/selftest-kit，此处不再有本地定义。
	const { results, ok } = createHarness();
	// 命令表与作用域键集：动态 import 打断「commands → selftest → 本文件」静态环
	//（Cmd 已放宽为可返回 Promise），取代旧的「读源码文本做正则匹配」——
	// 那会让 commands.ts 与 option-scope.ts 的物理排版成为契约。
	const { COMMANDS } = await import("../cli/commands");
	const { OPTION_NAMES, parseArgs } = await import("../cli/args");

	/**
	 * 子进程探针：只留给文末的成功链路冒烟（守「入口 → 解析 → 命令表 → 渲染」真链路）。
	 */
	const run = (args: string[]): { code: number; out: string; err: string } => {
		const r = spawnSync(process.execPath, [resolve(ROOT, "..", "purple-star.ts"), ...args], {
			encoding: "utf8",
		});
		return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
	};

	/**
	 * 进程内直调（与 run 同形返回）：输出形态断言的主力载体 —— 子进程每次约 3.2 秒
	 * （iztro 冷启动），直调约 25ms 且判据同构；「stderr 前缀 + exit 1」真链路由
	 * run 的冒烟与主 selftest 的冒烟共同覆盖。
	 */
	const call = (argv: string[]): { code: number; out: string; err: string } => {
		const [cmd, ...rest] = argv;
		const fn = COMMANDS[cmd as keyof typeof COMMANDS];
		if (!fn) return { code: 1, out: "", err: `未知命令「${cmd}」。` };
		return callDirect(cmd, rest, fn, parseArgs, {
			root: resolve(ROOT, ".."),
			rootLabel: "技能自带内核",
		});
	};

	// ── 1. 数据源可用性 ──

	ok("古籍数据源：三部古籍全部可加载，段落总数为正", () => {
		// 判据是**逐部点名**而不是「数组长度等于 3」：长度断言在「少了一部、多了一部」
		// 两种故障上都只能给出一句「不等于 3」，指不到缺的是哪一部。
		const want = ["gusuifu", "quanji", "quanshu"];
		const got = ALL_BOOKS.map(b => b.slug);
		for (const s of want) {
			if (!got.includes(s)) throw new Error(`缺少古籍 ${s}，实得 ${got.join("、")}`);
		}
		if (!(TOTAL_PARAGRAPHS > 0)) throw new Error("段落总数为 0 —— 古籍数据可能未加载");
		return `${ALL_BOOKS.length} 部 / ${TOTAL_PARAGRAPHS} 段`;
	});

	ok("古籍数据源：每部书都有章节，每章都有段落", () => {
		// 上面那条只看总数，这条看结构：某部书 chapters 为空时总数仍可能为正（别的书贡献的），
		// 而检索会静默跳过它 —— 用户搜那部书里的词，得到的是「未找到」。
		for (const b of ALL_BOOKS) {
			if (!b.chapters?.length) throw new Error(`${b.slug} 没有章节`);
			const empty = b.chapters.filter(c => !c.paragraphs?.length).map(c => c.title);
			if (empty.length) throw new Error(`${b.slug} 下有空章节：${empty.join("、")}`);
		}
		return ALL_BOOKS.map(b => `${b.slug} ${b.chapters.length} 章`).join(" / ");
	});

	// ── 2. 检索行为 ──

	ok("古籍检索：命中已知词，且结果带书名 / 章节 / 摘要", () => {
		const hits = searchClassics("机月同梁");
		if (!hits.length) throw new Error("「机月同梁」零命中 —— 数据源或匹配逻辑可能已失效");
		const bad = hits.filter(h => !h.bookTitle || !h.chapterTitle || !h.snippet);
		if (bad.length) throw new Error(`${bad.length} 条命中缺书名/章节/摘要`);
		if (!hits.some(h => String(h.snippet).includes("<mark>")))
			throw new Error("摘要里没有 <mark> 高亮 —— snippet 的拼装可能已失效");
		return `${hits.length} 条命中，均带书名/章节/摘要`;
	});

	ok("古籍检索：未收录的词返回空数组，而不是抛错或全量返回", () => {
		const hits = searchClassics("这句话在古籍里绝不可能出现zzzq");
		eq(hits.length, 0, "生僻词应零命中，");
		return "零命中";
	});

	ok("古籍检索：空/纯空白关键词返回空数组", () => {
		eq(searchClassics("").length, 0, "空串应零命中，");
		eq(searchClassics("   ").length, 0, "纯空白应零命中，");
		return "空串与纯空白均零命中";
	});

	ok("古籍检索：limit 是硬上限，且非法值不给出结果", () => {
		const one = searchClassics("紫微", 1);
		eq(one.length, 1, "limit=1 应恰好 1 条，");
		const many = searchClassics("紫微", 3);
		eq(many.length, 3, "limit=3 应恰好 3 条，");
		eq(searchClassics("紫微", 0).length, 0, "limit=0 应零命中，");
		eq(searchClassics("紫微", Number.NaN).length, 0, "limit=NaN 应零命中，");
		return "上限生效，0 / NaN 归空";
	});

	ok("古籍检索：命中数不受 limit 之外的隐式截断（Infinity = 无上限）", () => {
		const all = searchClassics("紫微", Number.POSITIVE_INFINITY);
		const capped = searchClassics("紫微", 2);
		if (all.length <= capped.length)
			throw new Error(`无上限应多于有上限，实得 ${all.length} vs ${capped.length}`);
		return `无上限 ${all.length} 条 > 上限 2 条`;
	});

	// ── 3. 参数面（子进程跑合并后的根 CLI，测用户真正敲的那条链）──

	ok("古籍参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 合并引擎的校验与 classics 原自研解析器同一立场：未知旗标一律报错。
		const probes: Array<[string, string]> = [
			["--serch", "search"], // 漏字
			["--limt", "limit"], // 漏字
			["--searches", "search"], // 多字
		];
		for (const [bad, want] of probes) {
			const r = call(["classics", bad, "x"]);
			if (r.code === 0)
				throw new Error(`${bad} 未报错（退出码 0）—— 未知旗标又变成静默忽略了`);
			if (!r.err.includes(`--${want}`))
				throw new Error(`${bad} 的提示应指向 --${want}，实得：${r.err.trim()}`);
		}
		return `${probes.length} 个拼写错误均被拦下`;
	});

	ok("古籍参数面：非法 --limit 的值到达命令层，由它给出中文报错", () => {
		// 三个探针全覆盖：`0` / `abc` 走常规值校验；`-3` 走**贪婪取值**
		//（`-3` 是 `--limit` 的值，不是短参数）。
		// 值域非法由命令层 throw：报错走 stderr 且退出码非零
		//（参照 synastry-asserts 的 r.err 先例）。
		for (const bad of ["0", "abc", "-3"]) {
			const r = call(["classics", "--search", "紫微", "--limit", bad]);
			if (r.code === 0)
				throw new Error(`--limit ${bad} 未报错（退出码 0）—— 值域非法必须非零退出`);
			if (!r.err.includes("--limit"))
				throw new Error(`--limit ${bad} 的报错未提到 --limit，实得：${r.err.trim()}`);
		}
		return "0 / abc / -3 均被命令层拦下（code1 + err 回显）";
	});

	ok("冒烟（子进程）：classics 成功链路 入口→解析→命令表→渲染 一次走通", () => {
		const r = run(["classics", "--search", "紫微"]);
		if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		if (!r.out.includes("紫微")) throw new Error("检索结果缺关键词");
		return "子进程成功链路在";
	});

	ok("合并接线：classics 在主命令表有实现，其参数在主作用域已声明", () => {
		// 三 skill 合一的接线守卫：命令进了 COMMAND_TABLE、参数进了 OPTION_NAMES，
		// 任何一侧漏接，用户敲 `classics` 就是「未知命令」或 `--limit` 就是「未知参数」。
		// 键集来自函数顶部的动态 import（见彼处注释）。
		if (!("classics" in COMMANDS))
			throw new Error("cli/commands.ts 的命令表里没有 classics 条目 —— 合并接线断了");
		for (const f of ["search", "limit"]) {
			if (!OPTION_NAMES.has(f))
				throw new Error(`cli 的 OPTION_NAMES 里没有 ${f} —— classics 参数未声明`);
		}
		return "命令表与作用域双侧接线在";
	});

	return results;
}
