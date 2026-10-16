/**
 * 兜底守护断言组：子进程冒烟、SKILL.md 命令对拍、文档一致性、知识分级
 * （原 `cli/selftest.ts` 的冒烟区块与文档/知识库守护断言）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入）；
 * 冒烟五条走 deps.runCli（守「入口 → 解析 → 命令表 → 渲染 + 错误出口」真链路），
 * 知识分级组的 grades 动态 import 保持在 ok 断言流之外（ok 断言体是同步回调）。
 */

import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { eq, skipUnlessRepo, type SelftestDeps } from "./kit";

/** 子进程冒烟（仅这五条用 runCli）：成功链路、错误出口、未知命令、--out 落盘与穿越防护。 */
export function runSmoke({ ok, runCli }: Pick<SelftestDeps, "ok" | "runCli">): void {
	ok("冒烟（子进程）：成功链路 入口→解析→命令表→渲染 一次走通", () => {
		const r = runCli(["astrology", "1990-5-15", "9:30", "男", "北京"]);
		if (r.code !== 0) {
			throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		}
		if (!r.out.includes("【基本信息】")) {
			throw new Error("缺基本信息面板");
		}
		return "子进程成功链路在";
	});
	ok("冒烟（子进程）：错误链路 stderr「错误：」前缀 + exit 1 + stdout 空（--json 路径）", () => {
		const r = runCli([
			"astrology",
			"--date",
			"2011-02-30",
			"--time",
			"07:45",
			"--gender",
			"male",
			"--json",
		]);
		if (r.code === 0 || !r.err.startsWith("错误：")) {
			throw new Error(
				`应 stderr「错误：」前缀 + 非零退出，实得 code=${r.code} err=${r.err.slice(0, 60)}`
			);
		}
		if (r.out.trim()) {
			throw new Error("stdout 应为空");
		}
		return "子进程错误出口在";
	});
	ok("冒烟（子进程）：未知命令 stderr + exit 1 并指路", () => {
		const r = runCli(["analyze", "--date", "1990-05-15"]);
		if (r.code === 0 || !r.err.includes("未知命令") || !r.err.includes("astrology")) {
			throw new Error(`实得：${r.err.trim()}`);
		}
		return "未知命令指路在";
	});
	ok("冒烟（子进程）：--out 落盘 —— 末尾恰一个换行、正文不占 stdout、stderr 有落盘提示", () => {
		const p = resolve(tmpdir(), `ziwei-selftest-out-${process.pid}.md`);
		try {
			const r = runCli(["astrology", "1990-5-15", "9:30", "男", "北京", "--out", p]);
			if (r.code !== 0) {
				throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			}
			const written = readFileSync(p, "utf8");
			if (!written.includes("【基本信息】")) {
				throw new Error("落盘内容缺基本信息面板");
			}
			if (!written.endsWith("\n") || written.endsWith("\n\n")) {
				throw new Error("文件末尾应恰一个换行");
			}
			if (r.out.trim()) {
				throw new Error("stdout 应为空（正文已落盘）");
			}
			if (!r.err.includes("已写入")) {
				throw new Error("stderr 缺落盘提示");
			}
		} finally {
			rmSync(p, { force: true });
		}
		return "--out 落盘链路在";
	});
	ok("冒烟（子进程）：--out 路径含 .. 段被拒（stderr「错误：」前缀 + exit 1）", () => {
		const r = runCli(["astrology", "1990-5-15", "9:30", "男", "北京", "--out", "a/../out.md"]);
		if (r.code === 0 || !r.err.startsWith("错误：") || !r.err.includes("..")) {
			throw new Error(`实得 code=${r.code} err=${r.err.slice(0, 60)}`);
		}
		if (r.out.trim()) {
			throw new Error("stdout 应为空");
		}
		return "--out 穿越防护在";
	});
}

/** SKILL.md 行为规范对拍：命令速查表提到的命令都在命令表里。 */
export function runSkillCommandAudit({
	ok,
	ctx,
	commandNames,
}: Pick<SelftestDeps, "ok" | "ctx" | "commandNames">): void {
	ok("参数面：SKILL.md 命令速查表提到的命令都在 commands.ts 的命令表里", () => {
		// 与「SKILL.md 旗标 → 声明表」同源：SKILL.md 是给助手读的**行为规范**，它提到的
		// 命令若不存在，助手会照着敲一条必然失败的命令行。键集取自主 selftest 的动态
		// import（真模块的键集，不再有「正则漏抽」的失效模式，物理排版随之退出契约）。
		const defined = commandNames;

		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
		const at = md.indexOf("## 命令速查");
		if (at < 0) {
			throw new Error("SKILL.md 里找不到「## 命令速查」小节");
		}
		// 只取该小节里的表格：正文提到命令名的散文（如「`analyze` 会自动输出两盘差异」）
		// 不构成「速查表说这个命令存在」的声明，卷进来只会产生误报。
		// 先跳过标题行与其后的空行，否则下面第一个 `\n\n` 就是标题后的空行，切出个空表。
		const body = md.slice(at + md.slice(at).indexOf("\n\n") + 2);
		const rows = body
			.slice(0, body.indexOf("\n\n"))
			.split("\n")
			.filter(l => l.startsWith("|"));
		// 字符类必须含数字与连字符：写成 `[a-z]+` 时 `` `synastry2` `` 会被**截断**成 `synastry`
		// 而 synastry 恰好是真实命令 —— 于是「真名 + 后缀」这类假命令全部溜过（实测踩过）。
		const mentioned = rows
			.map(l => l.match(/^\|\s*`([a-z][a-z0-9-]*)/)?.[1])
			.filter(n => n !== undefined);
		if (!mentioned.length) {
			throw new Error("未从命令速查表扫到命令 —— 表格格式已变");
		}

		const unknown = mentioned.filter(n => !defined.includes(n));
		if (unknown.length) {
			throw new Error(`SKILL.md 提到但 commands.ts 未定义的命令：${unknown.join("、")}`);
		}
		return `${mentioned.length} 个命令全部有实现`;
	});
}

/** 文档一致性：references 深层文件、Node 下限、独占分支、升级警告与实现同步。 */
export function runDocConsistency({ ok, ctx }: Pick<SelftestDeps, "ok" | "ctx">): void {
	ok("文档一致性：references 深层文件与单 skill 形态同步（合并遗留漂移盯防）", () => {
		// 三 skill 合一是「骨架先行」的改造：SKILL.md / options / troubleshooting 同步了，
		// 而 workflow 第 2 步与两份 synastry 细则曾被落下——骨架指路深入后读到的却是
		// 「classics/synastry 已搬去 sibling skill」，把助手往错误方向带。这些标记
		// 词（旧 skill 名 / 不存在的 sihua.ts / 旧自述句）一旦回潮就在这里变红。
		const read = (p: string) => readFileSync(resolve(ctx.root, "..", "references", p), "utf8");
		for (const [file, text] of [
			["workflow.md", read("workflow.md")],
			["synastry-troubleshooting.md", read("synastry-troubleshooting.md")],
			["synastry-guide.md", read("synastry-guide.md")],
		] as const) {
			for (const stale of [
				"purplestar-classics",
				"purplestar-synastry",
				"ziwei/sihua.ts",
				"本技能不排盘",
			]) {
				if (text.includes(stale)) {
					throw new Error(
						`${file} 仍含合并前口径「${stale}」——三 skill 已合一，请按现行 CLI 改写`
					);
				}
			}
		}
		return "workflow / synastry-troubleshooting / synastry-guide 三份与现行 CLI 口径一致";
	});
	ok(
		"文档一致性：Node 下限、独占分支、升级警告三处承诺与实现同步",
		() => {
			const readme = readFileSync(resolve(ctx.root, "..", "README.md"), "utf8");
			const claude = readFileSync(resolve(ctx.root, "..", "CLAUDE.md"), "utf8");
			const opts = readFileSync(resolve(ctx.root, "..", "references", "options.md"), "utf8");
			const testReadme = readFileSync(resolve(ctx.root, "..", "test", "README.md"), "utf8");
			// boot-hooks 的失败指引是**用户运行时真实看到**的报错文案——下限号写错（如仍写
			// 22.15）会把低版本用户引向一条裸跑必失败的路径，纳入机检钉死（终审 D-1）。
			const bootHooks = readFileSync(resolve(ctx.root, "boot-hooks.ts"), "utf8");
			for (const [name, text] of [
				["README.md", readme],
				["CLAUDE.md", claude],
				["scripts/boot-hooks.ts", bootHooks],
			] as const) {
				if (text.includes("22.15") && !text.includes("NODE_OPTIONS")) {
					throw new Error(
						`${name} 仍承诺 Node ≥ 22.15 —— 实测 22.15.0 裸跑 ERR_UNKNOWN_FILE_EXTENSION，下限应为 22.18`
					);
				}
			}
			if (!opts.includes("独占分支") || !opts.includes("--palaces` > `--topic")) {
				throw new Error("options.md 缺独占分支优先级链描述");
			}
			if (!testReadme.includes("npm install iztro@latest")) {
				throw new Error("test/README.md 缺升级 iztro 的 pin 改写警告");
			}
		},
		// ⚠️ README.md / CLAUDE.md / test/README.md 都是**仓库级**文档，不进分发包
		// （包只含 SKILL.md / package.json / references/ / scripts/ 四项），
		// 故在包形态下显式跳过 —— 判据与理由见 kit.skipUnlessRepo。
		{ skip: skipUnlessRepo(ctx, "仓库级文档（README/CLAUDE/test-README）不入分发包") }
	);
}

/** 知识分级登记表：data.ts 引句与 grades.ts 登记双向对拍（grades 动态 import）。 */
export async function runGradeRegistry({
	ok,
	ctx,
}: Pick<SelftestDeps, "ok" | "ctx">): Promise<void> {
	// 动态 import 在 ok 断言流之外 await（ok 断言体是同步回调，与 classics / synastry
	// 断言组同一既定模式）。
	const grades = await import("@/analysis/grades");

	ok("知识分级：data.ts 全部倪师引句在 grades.ts 有登记且档位合法（零缺失）", () => {
		const { NI_GRADES } = grades;
		const legal = new Set(["verified", "traditional", "suspect", "methodology"]);
		for (const e of NI_GRADES) {
			if (!legal.has(e.grade)) {
				throw new Error(`grades.ts 的「${e.quote}」档位非法：${e.grade}`);
			}
		}
		const src = readFileSync(resolve(ctx.root, "analysis", "data.ts"), "utf8");
		// 引句标记（与评估报告口径一致，按实测扩展）：「倪师 / 倪海厦」锚点
		// + 少量过渡（星名、出处「天纪 03」、动词「说·言·明言·将…列为」等）+「」或英文
		// 双引号内 ≥2 字引句；标记与引句须同在一行，注释行不参与；(?<!非) 排除「一说非
		// 倪师原话」散注里的倪师字样 —— 那一处恰恰声明**不是**倪师引句。
		// 过渡上限 18：L1724「倪师《天纪 06》原话：迁移化忌「半空折翅」」实测 14 字符踩
		// 满 14 上限，文案增一字即漏抽；排除集已含句读引号，放宽的误抽会先触发下方
		// missing 变红，安全。
		const QUOTE_RE =
			/((?<!非)倪师|倪海厦)[^「」"“”‘’；。—\n]{0,18}[：:]?[「"]([^「」"\n]{2,})[」"]/g;
		const marks = src
			.split("\n")
			.filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l))
			.flatMap(l => [...l.matchAll(QUOTE_RE)]);
		if (marks.length < 28) {
			throw new Error(
				`引句标记只抽到 ${marks.length} 条（评估基线 28）——标记正则或文案已变，先核对再改断言`
			);
		}
		const registered = new Set(NI_GRADES.map(e => e.quote));
		const missing = marks.map(m => m[2].slice(0, 12)).filter(q => !registered.has(q));
		if (missing.length) {
			throw new Error(
				`以下倪师引句未在 grades.ts 登记分级：${missing.map(q => `「${q}…」`).join("、")}`
			);
		}
		// 反向（grades.ts 头注释承诺的另一半）：登记的 quote 若在文案中抽不到对应引句
		// ——写错的定位串或文案已删的引句——这里是幽灵条目，必须点名变红。
		const inText = new Set(marks.map(m => m[2].slice(0, 12)));
		const ghosts = NI_GRADES.filter(e => !inText.has(e.quote));
		if (ghosts.length) {
			throw new Error(
				`grades.ts 以下登记在 data.ts 抽不到对应引句（quote 失配或引句已删）：${ghosts.map(e => `「${e.quote}…」（${e.star}·${e.field}）`).join("、")}`
			);
		}
		return `${marks.length} 条引句全部有分级登记`;
	});
}

/**
 * 分发 module 的进程内探针（候选 1）：未知命令文案与 help 拦截经同一 seam 可达。
 *
 * @remarks
 * dispatch 与文案函数都**先 await 再断言**：ok 的断言体是同步回调，rejected
 * Promise 不会被它捕获。两根桩的 loadCore 刻意返回空 COMMANDS —— 若 --help
 * 拦截不先于查表执行，这里就会掉进未知分支而拿不到 CMDHELP。
 */
export async function runDispatchProbe(deps: SelftestDeps): Promise<void> {
	const { dispatch, unknownCommandMessage } = await import("../host/dispatch");
	const NAMES = ["astrology", "knowledge", "synastry", "selftest", "help"] as const;
	const ports = {
		ctx: deps.ctx,
		// 键集必须与下方断言的 NAMES 同源：dispatch 的可用列表取自 Object.keys(COMMANDS)，
		// 空表会让「可用：」后为空串、与 unknownCommandMessage(NAMES) 的产出失配。
		loadCore: async () => ({
			COMMANDS: Object.fromEntries(NAMES.map(n => [n, undefined])),
			parseArgs: (() => ({})) as never,
		}),
		loadHelp: async () => ({
			renderOverviewHelp: () => "OVERVIEW",
			renderCommandHelp: () => "CMDHELP",
			commandNames: [...NAMES],
		}),
	};
	// ① 未知命令：code=1，且 err 必须 === 共享文案函数对同一列表的产出（同源断言）
	const unknown = await dispatch(["bogus"], ports);
	deps.ok("分发：未知命令 code=1 且文案出自共享函数", () => {
		if (unknown.code !== 1) {
			throw new Error(`code 应为 1，实得 ${unknown.code}`);
		}
		if (unknown.err !== unknownCommandMessage("bogus", NAMES)) {
			throw new Error(`文案不同源：${unknown.err}`);
		}
	});
	// ② help 拦截先于查表与 loadCore：桩的 COMMANDS 为空也能拿到 CMDHELP
	const help = await dispatch(["astrology", "--help"], ports);
	deps.ok("分发：--help 拦截在查表之前返回 code=0", () => {
		if (help.code !== 0 || help.out !== "CMDHELP") {
			throw new Error(`实得 code=${help.code} out=${help.out}`);
		}
	});
}
