/**
 * 命令层断言组：命令面、help 裁剪/强化、契约对拍、命令拆分、astrology 输出形态
 * （原 `cli/selftest.ts` 的命令面区块与 astrology 融合输出形态断言组）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入；直调探针
 * `call` 由主 selftest 构造后经 deps 传入 —— 组文件不静态 import cli/commands.ts，
 * 命令表键集判断一律走 `commandNames`）。「astrology 输出形态」「help 强化」等组
 * 在主 selftest 的调用序里与源码顺序一致。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { generateChart } from "@/ziwei/algorithm";
import { readAnalyzeJson } from "@/synastry/chart-view";
import { buildBirthInfo } from "../birth-info";
import { OPTION_GROUPS } from "../args-table";
import { parseArgs } from "../args";
import { cmdStars } from "../stars";
import { cmdClassics } from "../classics";
import { cmdAstrology, buildAnalyzeJson } from "../astrology";
import { cmdOracle } from "../oracle";
import { cmdSynastry } from "../synastry";
import { renderCommandHelp, renderOverviewHelp } from "../help";
import { SAMPLE } from "./sample";
import { eq, type SelftestDeps } from "../selftest-kit";

/** 命令面：stars / classics / oracle 的形态与指路、astrology 参数纪律、合盘交付。 */
export function runCommandSurface({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("命令面：stars 位置参数与 --search 等价（SYNOPSIS 承诺的检索形态）", () => {
		const s = cmdStars(parseArgs(["紫微"], "stars"));
		if (!s.includes("紫微：关键词") || s.includes("天机"))
			throw new Error(`位置参数未生效，输出开头：${s.slice(0, 40)}`);
	});
	ok("命令面：--search 末尾缺值（裸开关 true）必须指路，不把 true 当检索词", () => {
		// 值域非法走 throw（引导层打「错误：」上 stderr 并 exit 1），
		// 不 return——return 会把报错当正常输出打 stdout 且 exit 0，机器路径无法感知。
		let msg = "";
		try {
			cmdStars(parseArgs(["--search"], "stars"));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg.includes("需要一个检索词"))
			throw new Error(`缺值未指路（应 throw），实得：${msg || "未报错"}`);
	});
	ok("命令面：classics --search 末尾缺值同样指路", () => {
		const s = cmdClassics(parseArgs(["--limit", "3", "--search"], "classics"));
		if (!s.includes("需要一个检索词")) throw new Error(`缺值未指路，输出：${s.slice(0, 40)}`);
	});
	ok("命令面：oracle 三形态（列主题 / 主题概览 / 单星展开）与非法主题指路", async () => {
		const list = await cmdOracle(parseArgs([], "oracle"));
		if (!list.includes("career") || !list.includes("用法")) throw new Error("列主题形态缺项");
		const overview = await cmdOracle(parseArgs(["career"], "oracle"));
		if (!overview.includes("七杀") || !overview.includes("断语"))
			throw new Error(`概览形态缺项：${overview.slice(0, 40)}`);
		const star = await cmdOracle(parseArgs(["career", "七杀"], "oracle"));
		for (const key of ["命盘关键定制", "星曜深层特质", "本宫论断", "三方四正联动", "知识来源"])
			if (!star.includes(key)) throw new Error(`单星展开缺「${key}」节`);
		let msg = "";
		try {
			await cmdOracle(parseArgs(["nope"], "oracle"));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg.includes("13 个之一")) throw new Error(`非法主题未指路：${msg || "未报错"}`);
	});
	ok("命令面：--monthly 不带 --mutagen 必须指路（流月四化随四化专题输出）", () => {
		// 文本路径约束：--json 的 liuYueSiHua 是独立顶层键，不带 --mutagen 合法（基准对拍依赖）。
		const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
		let msg: string | null = null;
		try {
			cmdAstrology(parseArgs([...base, "--monthly", "6"], "astrology"));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg || !msg.includes("--mutagen"))
			throw new Error(`缺 --mutagen 未指路：${msg ?? "未报错"}`);
		const withMutagen = cmdAstrology(
			parseArgs([...base, "--mutagen", "--monthly", "6"], "astrology")
		);
		if (!withMutagen.includes("流月四化")) throw new Error("带 --mutagen 后流月节缺失");
	});
	ok("命令面：独占分支激活时被吞的功能参数必须指路（不静默）", () => {
		const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
		for (const [argv, keyword] of [
			[[...base, "--palaces", "--pattern"], "--pattern"],
			[[...base, "--palaces", "--mutagen"], "--mutagen"],
			[[...base, "--topic", "love", "--pattern"], "--pattern"],
			[[...base, "--topic", "love", "--report"], "--report"],
			[[...base, "--report", "--pattern"], "--pattern"],
			[[...base, "--report", "--json"], "--json"],
			[[...base, "--json", "--info"], "--info"],
			[[...base, "--json", "--topic", "love"], "--topic"],
			// --info 自身也是独占分支（面板单独输出）：其余功能参数同给必须指路，
			// 不能静默吞参只出面板（终审 C1；SKILL.md / options.md 均有此承诺）。
			[[...base, "--info", "--pattern"], "--pattern"],
			[[...base, "--info", "--mutagen"], "--mutagen"],
		] as const) {
			let msg: string | null = null;
			try {
				cmdAstrology(parseArgs(argv as unknown as string[], "astrology"));
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg || !msg.includes("独占") || !msg.includes(keyword as string))
				throw new Error(`独占分支未指路（${keyword}）：${msg ?? "未报错且静默输出"}`);
		}
		// 组合边界：--json + --palaces 是 synastry 契约，必须保留且出合法 JSON
		const json = cmdAstrology(parseArgs([...base, "--palaces", "--json"], "astrology"));
		JSON.parse(json);
		return "--palaces/--topic/--report/--json 四组独占语义全部指路；--palaces --json 契约保留";
	});
	ok("命令面：--report 产出 13 板块 Markdown 且为纯本命静态口径", () => {
		const t = cmdAstrology(
			parseArgs(
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--report"],
				"astrology"
			)
		);
		if (!t.startsWith("# 紫微斗数全盘报告")) throw new Error("报告应以一级标题开头");
		const h2 = t.split("\n").filter(l => l.startsWith("## ")).length;
		if (h2 !== 13) throw new Error(`## 二级标题应为 13 个板块，实得 ${h2}`);
		if (!t.includes("知识来源分级")) throw new Error("报告尾注缺知识来源分级");
		// 本命静态口径：--view / 运限参数同给必须指路，不静默切视角
		for (const extra of [
			["--view", "daxian"],
			["--yearly", "2027"],
			["--monthly", "6"],
		]) {
			let msg: string | null = null;
			try {
				cmdAstrology(
					parseArgs(
						[
							"--date",
							"1990-05-15",
							"--branch",
							"5",
							"--gender",
							"male",
							"--report",
							...extra,
						],
						"astrology"
					)
				);
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) throw new Error(`--report + ${extra.join(" ")} 未指路且静默输出`);
		}
		return "13 板块齐全；--view / --yearly / --monthly 同给全部指路";
	});
	ok("命令面：--gender 报错文案与 help 值域承认中文（男|女 实际合法）", () => {
		let msg = "";
		try {
			buildBirthInfo(parseArgs(["--date", "1990-05-15", "--branch", "5", "--gender", "abc"]));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg.includes("男") || !msg.includes("女"))
			throw new Error(`报错文案未承认中文值域：${msg}`);
	});
	ok("命令面：参数描述不再引用已删除的 cities 命令", () => {
		const descs = OPTION_GROUPS.flatMap(g => g.options.map(o => `${o.name} ${o.desc}`)).join(
			"\n"
		);
		if (descs.includes("cities"))
			throw new Error("desc 仍提 cities —— 该命令已删（spec §3.1），文案要跟上");
	});
	ok("命令面：合盘抬头不因缺省 --name 残留双空格（astrology 抬头无此问题）", () => {
		// 用真 CLI JSON 产物喂合盘（astrology --json 的输出是合法输入，进程内直调更轻）
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-synastry-hdr-"));
		try {
			const json = (d: string, g: string) =>
				cmdAstrology(
					parseArgs(["--date", d, "--branch", "5", "--gender", g, "--json"], "astrology")
				);
			const a = join(tmp, "a.json");
			const b = join(tmp, "b.json");
			writeFileSync(a, json("1990-05-15", "male"), "utf8");
			writeFileSync(b, json("1992-08-01", "female"), "utf8");
			const s = cmdSynastry(parseArgs(["--charts", `${a},${b}`], "synastry"));
			const bad = s.split("\n").filter(l => /^(甲方|乙方) {2}/.test(l));
			if (bad.length) throw new Error(`抬头双空格：${bad[0]}`);
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
	ok("合盘交付：输出含双盘四化互参节（五步法第 4 步的数据缺口补齐）", () => {
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-synastry-hucan-"));
		try {
			const json = (d: string, g: string) =>
				cmdAstrology(
					parseArgs(["--date", d, "--branch", "5", "--gender", g, "--json"], "astrology")
				);
			const a = join(tmp, "a.json");
			const b = join(tmp, "b.json");
			writeFileSync(a, json("1990-05-15", "male"), "utf8");
			writeFileSync(b, json("1992-08-01", "female"), "utf8");
			const out = cmdSynastry(parseArgs(["--charts", `${a},${b}`], "synastry"));
			if (!out.includes("【双盘四化互参】")) throw new Error("缺【双盘四化互参】节");
			if (
				!out.includes("甲方") ||
				!out.includes("落乙方") ||
				!out.includes("乙方") ||
				!out.includes("落甲方")
			)
				throw new Error("互参节缺双向对照行");
			// 自盘对照：两路径相同时不得崩溃
			const self2 = cmdSynastry(parseArgs(["--charts", `${a},${a}`], "synastry"));
			if (!self2.includes("【双盘四化互参】")) throw new Error("自盘对照缺互参节");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
	ok("命令面：help 的 OPTIONS 组标题与参数行同步输出（分组语义不失效）", () => {
		const lines = renderCommandHelp("astrology").split("\n");
		const i = lines.findIndex(l => l.includes("出生日期（二选一）"));
		if (i < 0) throw new Error("找不到组标题");
		const next = lines[i + 1] ?? "";
		if (next.trim() && !next.includes("--"))
			throw new Error(`组标题堆叠：标题后紧跟另一标题「${next.trim()}」`);
	});
}

/** help 裁剪：命令级 NOTES 只带本命令相关的铁律，全量保留在总览。 */
export function runHelpPrune({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("help 裁剪：命令级 NOTES 只带本命令相关的铁律，全量保留在总览", () => {
		const syn = renderCommandHelp("synastry");
		if (syn.includes("排盘四必问") || syn.includes("--late-zi"))
			throw new Error("synastry --help 仍在教排盘铁律 —— 它不排盘");
		for (const cmd of ["stars", "classics"] as const) {
			if (renderCommandHelp(cmd).includes("晚子时"))
				throw new Error(`${cmd} --help 带着排盘 NOTES —— 应裁剪`);
		}
		const overview = renderOverviewHelp();
		if (!overview.includes("排盘四必问") || !overview.includes("--late-zi"))
			throw new Error("总览 help 的全量铁律被误裁 —— 排盘铁律只在总览保底");
	});
}

/** 契约对拍：buildAnalyzeJson 的生产端产物过 readAnalyzeJson 消费方校验。 */
export function runContractProbe({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("契约对拍：buildAnalyzeJson 的生产端产物过 readAnalyzeJson 消费方校验", () => {
		// 生产端纯函数化后可在进程内直测：真盘一次，产物写临时文件喂消费方契约 ——
		// 「一处生产（buildAnalyzeJson）、一处消费（readAnalyzeJson）、一处对拍（这里）」，
		// 与子进程端的合盘契约闭环互补。
		const chart = generateChart(SAMPLE);
		const json = buildAnalyzeJson({
			chart,
			liuNianYear: 2026,
			liuYueMonth: null,
			basis: {
				note: "钟表 → 巳时（对拍样例）",
				notes: ["自检对拍产物"],
				lateZiCandidate: false,
				isLateZi: false,
			},
		});
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-analyze-json-"));
		try {
			const p = join(tmp, "out.json");
			writeFileSync(p, json, "utf8");
			const parsed = readAnalyzeJson(p, "甲");
			if (!parsed.chart?.palaces?.length)
				throw new Error("对拍产物缺宫位 —— 契约校验形同虚设");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
}

/** 命令拆分收敛：cities 已删、analyze 改名、chart/topic 融合为参数。 */
export function runCommandSplit({
	ok,
	ctx,
	commandNames,
}: Pick<SelftestDeps, "ok" | "ctx" | "commandNames">): void {
	ok("命令拆分：cities 命令已删（数据表保留）；analyze → astrology 改名；stars 仍可检索", () => {
		// 命令面（spec §3.1）：cities 只删查询命令（ziwei/cities.ts 数据表
		// 仍是 --city 容错解析的依据，保留）；analyze 拆进 cli/astrology.ts 并改名 cmdAstrology。
		// 键集取自主 selftest 的动态 import（见彼处注释）。
		const defined = commandNames;
		if (defined.includes("cities"))
			throw new Error("cities 仍在 COMMAND_TABLE —— 应删（spec §3.1）");
		if (defined.includes("analyze"))
			throw new Error("analyze 仍在 COMMAND_TABLE —— 应改名 astrology");
		// Task 6 融合后 chart/topic 也退役（职责成为 astrology 的 --palaces / --topic 参数）
		if (defined.includes("chart") || defined.includes("topic"))
			throw new Error("chart/topic 仍在 COMMAND_TABLE —— 已融合为 astrology 参数（Task 6）");
		if (!defined.includes("astrology"))
			throw new Error(`拆位不完整（应含 astrology），实得：${defined.join("、")}`);
		// cities 删除后的数据表仍在（--city 容错解析在用）
		const cities = readFileSync(resolve(ctx.root, "ziwei", "cities.ts"), "utf8");
		if (!/export const PROVINCES/.test(cities))
			throw new Error("ziwei/cities.ts 的 PROVINCES 不在了");
		// stars 检索不受拆分影响（直调拆出的 cmdStars）
		const s = cmdStars({ _: [], search: "紫微" });
		if (!s.includes("紫微") || !s.includes("关键词"))
			throw new Error(`stars --search 紫微 的释义不见了，实得：${s.slice(0, 60)}`);
		return "命令面收敛中间态就位";
	});
}

/** astrology 输出形态：未深入/深入/零输入/--palaces/--topic/--focus/--config/--template。 */
export function runAstrologyShapes({
	ok,
	call,
	commandNames,
}: Pick<SelftestDeps, "ok" | "call" | "commandNames">): void {
	ok("astrology：概览与 --info 带面板 + 运限速览 + 专题指路；给了专题参数则只出专题详版", () => {
		// 未深入形态（无功能参数概览 / 仅 --info）输出三节；给了具体专题参数的
		// 输出 = 口径提示 + 专题详版 —— 面板与速览/指路均不带。
		// 任何形态都不出现【命盘总览】抬头。
		for (const argv of [
			["astrology", "1990-5-15", "9:30", "男", "北京"],
			[
				"astrology",
				"--date",
				"1990-5-15",
				"--time",
				"9:30",
				"--gender",
				"男",
				"--city",
				"北京",
				"--info",
			],
		]) {
			const r = call(argv);
			if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			for (const want of [
				"【基本信息】",
				"公历生日 : 1990-05-15",
				"命宫:",
				"三方四正:",
				"子年斗君",
				"【运限速览】",
				"【专题深入】",
			])
				if (!r.out.includes(want)) throw new Error(`${argv.join(" ")} 缺 ${want}`);
			for (const gone of ["【命盘总览】", "【格局识别】", "【生年四化】"])
				if (r.out.includes(gone)) throw new Error(`${argv.join(" ")} 不应出现 ${gone}`);
		}
		const deep = call([
			"astrology",
			"1990-5-15",
			"9:30",
			"男",
			"北京",
			"--pattern",
			"--mutagen",
		]);
		if (deep.code !== 0) throw new Error(`退出码 ${deep.code}，stderr：${deep.err.trim()}`);
		for (const want of ["【格局识别】", "【生年四化】"])
			if (!deep.out.includes(want)) throw new Error(`专题叠加缺 ${want}`);
		for (const gone of ["【命盘总览】", "【基本信息】", "【运限速览】", "【专题深入】"])
			if (deep.out.includes(gone))
				throw new Error(`专题叠加不应出现 ${gone}（已在深入，基底与指路是噪声）`);
		return "未深入形态带三节（无总览抬头）；专题形态只出专题详版";
	});
	ok(
		"astrology：零输入默认输出虚构示例面板 + 运限速览 + 专题指路；--json/部分输入仍守纪律",
		() => {
			// 契约：出生信息一项不给且未表达其他输出意图 → 不报「缺少出生日期」，
			// 以虚构样例（与 help 示例同源）演示【基本信息】面板、运限速览与专题指路并附
			// 用法指路。--json 是机器接口不喂虚构数据；部分输入（给了一半）继续按
			// 「缺一问一」报错。
			for (const argv of [["astrology"], ["astrology", "--info"]]) {
				const r = call(argv);
				if (r.code !== 0)
					throw new Error(
						`零输入 ${argv.join(" ")} 应演示面板，实得 code ${r.code}：${r.err.trim()}`
					);
				for (const want of [
					"【基本信息】",
					"公历生日 : 2011-06-24",
					"虚构",
					"--date",
					"【运限速览】",
					"【专题深入】",
				])
					if (!r.out.includes(want)) throw new Error(`零输入输出缺 ${want}`);
			}
			const json = call(["astrology", "--json"]);
			if (json.code === 0 || !json.err.includes("出生"))
				throw new Error("--json 零输入必须报错指路（机器接口不喂虚构数据）");
			const partial = call(["astrology", "1990-5-15"]);
			if (partial.code === 0 || !partial.err.includes("时辰"))
				throw new Error(`部分输入应报缺时辰（缺一问一），实得：${partial.err.trim()}`);
			return "零输入示例面板在；--json 与部分输入仍报错";
		}
	);
	ok("astrology：--palaces 出十二宫逐宫详表", () => {
		const r = call(["astrology", "1990-5-15", "9:30", "男", "--palaces"]);
		if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		// 十二宫逐宫详表：每宫名一块 + renderPalace 形态（星曜行）
		for (const palace of ["命宫", "夫妻宫", "官禄宫", "福德宫", "田宅宫"])
			if (!r.out.includes(palace)) throw new Error(`缺宫位块 ${palace}`);
		if (!r.out.includes("大限")) throw new Error("缺大限一览");
		if (!/(化禄|化权|化科|化忌)/.test(r.out)) throw new Error("详表应含四化标注");
		return "十二宫详表在";
	});
	ok("astrology：--topic love 出主题论断；--view 英文取值与拼音等价；--view 越界报错", () => {
		const r = call(["astrology", "1990-5-15", "9:30", "男", "--topic", "love"]);
		if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		if (!r.out.includes("【主题论断")) throw new Error("缺主题论断标题");
		if (!r.out.includes("知识来源分级")) throw new Error("缺知识来源分级披露");
		// 英文取值与拼音逐一等价（输出应完全一致）
		for (const [en, py] of [
			["decadal", "daxian"],
			["yearly", "liunian"],
			["monthly", "liuyue"],
		] as const) {
			const byEn = call([
				"astrology",
				"1990-5-15",
				"9:30",
				"男",
				"--topic",
				"love",
				"--view",
				en,
			]);
			const byPy = call([
				"astrology",
				"1990-5-15",
				"9:30",
				"男",
				"--topic",
				"love",
				"--view",
				py,
			]);
			if (byEn.code !== 0) throw new Error(`--view ${en} 应可用，stderr：${byEn.err.trim()}`);
			if (byEn.out !== byPy.out) throw new Error(`--view ${en} 与 ${py} 输出应逐字一致`);
		}
		const bad = call([
			"astrology",
			"1990-5-15",
			"9:30",
			"男",
			"--topic",
			"love",
			"--view",
			"xxx",
		]);
		if (bad.code === 0 || !bad.err.includes("--view"))
			throw new Error("--view 越界应报错并点名");
		return "主题论断、view 英文等价与越界校验在";
	});
	ok("astrology：旧命令名已删（命令表键集层面；stderr/exit 指路由冒烟断言覆盖）", () => {
		for (const old of ["analyze", "chart", "topic", "insight", "cities"]) {
			if (commandNames.includes(old))
				throw new Error(`${old} 不应仍在命令表里 —— 应已收敛到 astrology`);
		}
		return "5 个旧命令名已全部出表";
	});
	ok("astrology：--focus 四项深化（全星曜/对宫详表/涉及格局/运限引动）", () => {
		const r = call(["astrology", "1990-5-15", "9:30", "男", "--focus", "命宫"]);
		if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		for (const want of ["会照", "对宫", "格局", "小限"])
			if (!r.out.includes(want)) throw new Error(`focus 深化缺 ${want}`);
		return "四项深化在";
	});
	ok("astrology：不存在的公历日期全链路报错（--json 机器路径同受校验）", () => {
		// 进程内 buildBirthInfo 断言在「出生信息」区；这条补的是**用户与机器真正走的路**：
		// --json 分支（先 buildBirthInfo 再 stringify）不许把 throw 吞成正常 JSON 输出。
		// 载体是进程内直调：throw → code 1 / out 空 / err 含原文；「stderr 前缀 + exit 1」
		// 的子进程真链路由文末冒烟覆盖。
		for (const bad of ["2011-02-30", "2011-02-29"]) {
			const r = call([
				"astrology",
				"--date",
				bad,
				"--time",
				"07:45",
				"--city",
				"杭州",
				"--gender",
				"male",
				"--json",
			]);
			if (r.code === 0) throw new Error(`${bad} 未报错（退出码 0）—— 静默归一化又回来了`);
			if (r.out.trim())
				throw new Error(
					`${bad} 报错时 stdout 应为空（不许输出半截 JSON），实得：${r.out.slice(0, 60)}`
				);
			if (!(r.err.includes(bad) || r.err.includes("不存在")))
				throw new Error(`${bad} 的报错未回显原始输入，实得：${r.err.trim()}`);
		}
		// 闰年边界不得误伤：2012-02-29 必须正常排出整盘
		const leap = call([
			"astrology",
			"--date",
			"2012-02-29",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
		]);
		if (leap.code !== 0) throw new Error(`2012-02-29（闰年）被误伤：${leap.err.trim()}`);
		if (!leap.out.includes("【基本信息】"))
			throw new Error("2012-02-29 应正常排出基本信息面板");
		return "非法日期 code1/out空/err回显（--json 同）；闰年 2-29 放行";
	});
	ok("--config：JSON 配置应用，命令行同名键覆盖，排盘正确", () => {
		// spec §3.3：配置是基底，命令行更明确必须赢。未知键与命令行同规则中文报错。
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-config-"));
		try {
			// ① 纯配置：排出虚构样例盘
			const cfg = join(tmp, "a.json");
			writeFileSync(
				cfg,
				JSON.stringify({ date: "2011-06-24", time: "07:45", gender: "male", city: "杭州" }),
				"utf8"
			);
			const viaCfg = call(["astrology", "--config", cfg]);
			if (viaCfg.code !== 0) throw new Error(`--config 排盘失败：${viaCfg.err.trim()}`);
			if (!viaCfg.out.includes("2011-6-24") && !viaCfg.out.includes("2011-06-24"))
				throw new Error("配置里的日期没生效");
			// ② 命令行覆盖：同键以命令行为准（换城市 → 经度行不同）
			const mixed = call(["astrology", "--config", cfg, "--city", "成都"]);
			if (mixed.code !== 0) throw new Error(`覆盖运行失败：${mixed.err.trim()}`);
			if (!mixed.out.includes("成都") && !mixed.out.includes("104.1"))
				throw new Error("命令行 --city 未覆盖配置的同名键");
			// ③ 配置内未知键报错（与命令行同规则）
			const bad = join(tmp, "bad.json");
			writeFileSync(bad, JSON.stringify({ date: "2011-06-24", noSuchKey: 1 }), "utf8");
			const r = call(["astrology", "--config", bad]);
			if (r.code === 0) throw new Error("未知键未报错");
			if (!r.err.includes("noSuchKey"))
				throw new Error(`报错未点名未知键，实得：${r.err.trim()}`);
			return "应用 / 覆盖 / 未知键三面成立";
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
	ok("--template：模板可被 --config 吃回并排出示例盘（闭环）", () => {
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-tpl-"));
		try {
			const tpl = call(["astrology", "--template"]);
			if (tpl.code !== 0) throw new Error(`--template 失败：${tpl.err.trim()}`);
			if (!tpl.out.includes("_")) throw new Error("模板缺注释性 _ 前缀键");
			// 落盘后直接 --config 吃回（模板必须是合法可跑的配置）
			const f = join(tmp, "my.json");
			writeFileSync(f, tpl.out, "utf8");
			const back = call(["astrology", "--config", f]);
			if (back.code !== 0) throw new Error(`模板吃回失败：${back.err.trim()}`);
			// 模板自带 pattern/yearly/focus → 吃回即专题叠加形态（不带
			// 面板），以格局详版在场证明配置吃回成功。
			if (!back.out.includes("【格局识别】")) throw new Error("吃回后应排出示例盘专题详版");
			return "模板闭环成立";
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
}

/** help 强化：总览节序、每命令归属参数子集、虚构示例注记。 */
export function runHelpEnrich({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("help 强化：总览含 man 七节标题且节序固定（总览另含 COMMANDS 节）", () => {
		// help 不走命令表分发（main 特判），直调渲染函数即可 —— 断言对象是渲染产物本身。
		const out = renderOverviewHelp();
		const SECTIONS = [
			"NAME",
			"SYNOPSIS",
			"DESCRIPTION",
			"COMMANDS",
			"OPTIONS",
			"EXAMPLES",
			"NOTES",
			"SEE ALSO",
		];
		let last = -1;
		for (const sec of SECTIONS) {
			// 节标题独占一行：首节顶行，其余前置换行
			const idx = out.startsWith(`${sec}\n`) ? 0 : out.indexOf(`\n${sec}\n`);
			if (idx < 0) throw new Error(`help 缺节标题 ${sec}`);
			if (idx < last) throw new Error(`节序错乱：${sec} 出现在前一节之前`);
			last = idx;
		}
		return `${SECTIONS.length} 节齐全且有序`;
	});
	ok("help 强化：每命令 --help 出归属参数子集（astrology 无 --search，stars 反之）", () => {
		const astro = renderCommandHelp("astrology");
		for (const want of ["NAME", "OPTIONS", "EXAMPLES"])
			if (!astro.includes(want)) throw new Error(`astrology --help 缺 ${want}`);
		for (const own of ["--pattern", "--mutagen", "--yearly", "--palaces", "--topic"])
			if (!astro.includes(own)) throw new Error(`astrology --help 应列 ${own}`);
		if (astro.includes("--search"))
			throw new Error("astrology --help 不该列 --search（归属过滤）");
		const stars = renderCommandHelp("stars");
		if (!stars.includes("--search")) throw new Error("stars --help 应列 --search");
		if (stars.includes("--pattern"))
			throw new Error("stars --help 不该列 --pattern（归属过滤）");
		return "归属过滤双向成立";
	});
	ok("help 强化：示例用新虚构组合且注明「示例数据为虚构」", () => {
		const out = renderOverviewHelp();
		if (!out.includes("2011-06-24") || !out.includes("杭州"))
			throw new Error("缺甲方虚构样例 2011-06-24 杭州");
		if (!out.includes("1999-11-03") || !out.includes("成都"))
			throw new Error("缺乙方虚构样例 1999-11-03 成都");
		if (!out.includes("虚构")) throw new Error("缺「示例数据为虚构」注记");
		// 旧组合清退：help 里不再出现 1990-05-15 / 1993-08-22 示例
		for (const old of ["1990-05-15", "1993-08-22"])
			if (out.includes(old)) throw new Error(`旧示例组合 ${old} 仍在 help 里`);
		return "虚构示例 + 注记在，旧组合已清退";
	});
}
