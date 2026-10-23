/**
 * 命令层断言组：命令面、help 裁剪/强化、契约对拍、命令拆分
 * （原 `cli/selftest.ts` 的命令面区块；astrology 输出形态组已拆至
 * `./astrology-shapes.ts`，各自单一职责）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入；直调探针
 * `call` 由主 selftest 构造后经 deps 传入 —— 组文件不静态 import cli/commands.ts，
 * 命令表键集判断一律走 `commandNames`）。各组在主 selftest 的调用序里与源码顺序一致。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { generateChart } from "@/algorithm";
import { TOPIC_LABEL } from "@/analysis";
import { readAnalyzeJson } from "@/synastry/chart-view";
import { buildBirthInfo } from "../birth/birth-info";
import { OPTION_GROUPS } from "../args/table";
import { parseArgs } from "../args";
import { cmdKnowledge } from "../knowledge";
import { cmdAstrology, buildAnalyzeJson } from "../commands/astrology";
import { cmdSynastry } from "../commands/synastry";
import { renderCommandHelp, renderOverviewHelp } from "../commands/help";
import { SAMPLE } from "./sample";
import type { SelftestDeps } from "./kit";

/** 命令面：knowledge 四域（books/stars/tianji/oracle）的形态与指路、astrology 参数纪律、合盘交付。 */
export function runCommandSurface({ ok }: Pick<SelftestDeps, "ok">): void {
	ok(
		"命令面：knowledge stars 域位置参数与 --search 等价（SYNOPSIS 承诺的检索形态）",
		async () => {
			const s = await cmdKnowledge(parseArgs(["--source", "stars", "紫微"], "knowledge"));
			if (!s.includes("紫微：关键词") || s.includes("天机")) {
				throw new Error(`位置参数未生效，输出开头：${s.slice(0, 40)}`);
			}
		}
	);
	ok("命令面：--search 末尾缺值（裸开关 true）必须指路，不把 true 当检索词", async () => {
		// 值域非法走 throw（引导层打「错误：」上 stderr 并 exit 1），
		// 不 return——return 会把报错当正常输出打 stdout 且 exit 0，机器路径无法感知。
		let msg = "";
		try {
			await cmdKnowledge(parseArgs(["--source", "stars", "--search"], "knowledge"));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg.includes("需要一个检索词")) {
			throw new Error(`缺值未指路（应 throw），实得：${msg || "未报错"}`);
		}
	});
	ok("命令面：knowledge books 域 --search 末尾缺值同样指路", async () => {
		const s = await cmdKnowledge(parseArgs(["--limit", "3", "--search"], "knowledge"));
		if (!s.includes("需要一个检索词")) {
			throw new Error(`缺值未指路，输出：${s.slice(0, 40)}`);
		}
	});
	ok("命令面：oracle 域三形态（列主题 / 主题概览 / 单星展开）与非法主题指路", async () => {
		const list = await cmdKnowledge(parseArgs(["--source", "oracle"], "knowledge"));
		if (!list.includes("career") || !list.includes("用法")) {
			throw new Error("列主题形态缺项");
		}
		const overview = await cmdKnowledge(
			parseArgs(["--source", "oracle", "--topic", "career"], "knowledge")
		);
		if (!overview.includes("七杀") || !overview.includes("断语")) {
			throw new Error(`概览形态缺项：${overview.slice(0, 40)}`);
		}
		const star = await cmdKnowledge(
			parseArgs(["--source", "oracle", "--topic", "career", "--star", "七杀"], "knowledge")
		);
		for (const key of [
			"命盘关键定制",
			"星曜深层特质",
			"本宫论断",
			"三方四正联动",
			"知识来源",
		]) {
			if (!star.includes(key)) {
				throw new Error(`单星展开缺「${key}」节`);
			}
		}
		let msg = "";
		try {
			await cmdKnowledge(parseArgs(["--source", "oracle", "--topic", "nope"], "knowledge"));
		} catch (e) {
			msg = (e as Error).message;
		}
		// 断言盯「自报数 == 实际键集长度」，不钉字面量（集合基数不写死）：
		// 写死 13、或干脆不给数，这两种退化都会被这条抓到。
		const topicKeys = Object.keys(TOPIC_LABEL);
		const reported = msg.match(/应为 (\d+) 个/);
		if (!reported || Number(reported[1]) !== topicKeys.length) {
			throw new Error(`非法主题未按实际键集自报：${msg || "未报错"}`);
		}
	});
	ok("命令面：tianji 域概览与检索（回放链接 + 来源声明）", async () => {
		const list = await cmdKnowledge(parseArgs(["--source", "tianji"], "knowledge"));
		if (!list.includes("01-stars") || !list.includes("CC BY-NC-SA")) {
			throw new Error("五册概览缺项");
		}
		const hit = await cmdKnowledge(parseArgs(["--source", "tianji", "半空折翅"], "knowledge"));
		for (const key of ["半空折翅", "bilibili.com/video", "§", "回放验证"]) {
			if (!hit.includes(key)) {
				throw new Error(`检索缺「${key}」`);
			}
		}
	});
	ok("命令面：--monthly 不带 --mutagen 必须指路（流月四化随四化专题输出）", () => {
		// 文本路径约束：--json 的 liuYueSiHua 是独立顶层键，不带 --mutagen 合法（基准对拍依赖）。
		// （组合层曾有一条同守卫的重复断言，已删——本条多一段正向断言且载体同源，
		// 见 architecture-review-20261016 候选 2。）
		const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
		let msg: string | null = null;
		try {
			cmdAstrology(parseArgs([...base, "--monthly", "6"], "astrology"));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg || !msg.includes("--mutagen")) {
			throw new Error(`缺 --mutagen 未指路：${msg ?? "未报错"}`);
		}
		const withMutagen = cmdAstrology(
			parseArgs([...base, "--mutagen", "--monthly", "6"], "astrology")
		);
		if (!withMutagen.includes("流月四化")) {
			throw new Error("带 --mutagen 后流月节缺失");
		}
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
			if (!msg || !msg.includes("独占") || !msg.includes(keyword as string)) {
				throw new Error(`独占分支未指路（${keyword}）：${msg ?? "未报错且静默输出"}`);
			}
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
		if (!t.startsWith("# 紫微斗数全盘报告")) {
			throw new Error("报告应以一级标题开头");
		}
		const h2 = t.split("\n").filter(l => l.startsWith("## ")).length;
		if (h2 !== 13) {
			throw new Error(`## 二级标题应为 13 个板块，实得 ${h2}`);
		}
		if (!t.includes("知识来源分级")) {
			throw new Error("报告尾注缺知识来源分级");
		}
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
			if (!msg) {
				throw new Error(`--report + ${extra.join(" ")} 未指路且静默输出`);
			}
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
		if (!msg.includes("男") || !msg.includes("女")) {
			throw new Error(`报错文案未承认中文值域：${msg}`);
		}
	});
	ok("命令面：参数描述不再引用已删除的 cities 命令", () => {
		const descs = OPTION_GROUPS.flatMap(g => g.options.map(o => `${o.name} ${o.desc}`)).join(
			"\n"
		);
		if (descs.includes("cities")) {
			throw new Error("desc 仍提 cities —— 该命令已删（spec §3.1），文案要跟上");
		}
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
			if (bad.length) {
				throw new Error(`抬头双空格：${bad[0]}`);
			}
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
			if (!out.includes("【双盘四化互参】")) {
				throw new Error("缺【双盘四化互参】节");
			}
			if (
				!out.includes("甲方") ||
				!out.includes("落乙方") ||
				!out.includes("乙方") ||
				!out.includes("落甲方")
			) {
				throw new Error("互参节缺双向对照行");
			}
			// 自盘对照：两路径相同时不得崩溃
			const self2 = cmdSynastry(parseArgs(["--charts", `${a},${a}`], "synastry"));
			if (!self2.includes("【双盘四化互参】")) {
				throw new Error("自盘对照缺互参节");
			}
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
	ok("命令面：help 的 OPTIONS 组标题与参数行同步输出（分组语义不失效）", () => {
		const lines = renderCommandHelp("astrology").split("\n");
		const i = lines.findIndex(l => l.includes("出生日期（二选一）"));
		if (i < 0) {
			throw new Error("找不到组标题");
		}
		const next = lines[i + 1] ?? "";
		if (next.trim() && !next.includes("--")) {
			throw new Error(`组标题堆叠：标题后紧跟另一标题「${next.trim()}」`);
		}
	});
}

/** help 裁剪：命令级 NOTES 只带本命令相关的铁律，全量保留在总览。 */
export function runHelpPrune({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("help 裁剪：命令级 NOTES 只带本命令相关的铁律，全量保留在总览", () => {
		const syn = renderCommandHelp("synastry");
		if (syn.includes("排盘四必问") || syn.includes("--late-zi")) {
			throw new Error("synastry --help 仍在教排盘铁律 —— 它不排盘");
		}
		for (const cmd of ["knowledge"] as const) {
			if (renderCommandHelp(cmd).includes("晚子时")) {
				throw new Error(`${cmd} --help 带着排盘 NOTES —— 应裁剪`);
			}
		}
		const overview = renderOverviewHelp();
		if (!overview.includes("排盘四必问") || !overview.includes("--late-zi")) {
			throw new Error("总览 help 的全量铁律被误裁 —— 排盘铁律只在总览保底");
		}
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
		const tmp = mkdtempSync(join(tmpdir(), "ziwei-astro-json-"));
		try {
			const p = join(tmp, "out.json");
			writeFileSync(p, json, "utf8");
			const parsed = readAnalyzeJson(p, "甲");
			if (!parsed.chart?.palaces?.length) {
				throw new Error("对拍产物缺宫位 —— 契约校验形同虚设");
			}
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
}

/** 命令拆分收敛：cities 已删、analyze 改名、chart/topic/insight 融合为参数。 */
export function runCommandSplit({
	ok,
	ctx,
	commandNames,
}: Pick<SelftestDeps, "ok" | "ctx" | "commandNames">): void {
	ok(
		"命令拆分：cities 命令已删（数据表保留）；analyze → astrology 改名；stars/oracle/classics 并入 knowledge",
		async () => {
			// 命令面（spec §3.1）：cities 只删查询命令（数据表仍是 --city 容错解析的依据，
			// 保留，现住 `cli/birth/cities.ts`）；analyze 拆进 cli/commands/astrology.ts
			// 并改名 cmdAstrology。
			// 键集取自主 selftest 的动态 import（见彼处注释）。
			// （astrology 形态组曾有一条重叠的旧名键集断言，已并入本清单 ——
			// insight 是其唯一独有键。）
			const defined = commandNames;
			if (defined.includes("cities")) {
				throw new Error("cities 仍在 COMMAND_TABLE —— 应删（spec §3.1）");
			}
			if (defined.includes("analyze")) {
				throw new Error("analyze 仍在 COMMAND_TABLE —— 应改名 astrology");
			}
			// Task 6 融合后 chart/topic/insight 也退役（职责成为 astrology 的 --palaces / --topic 参数）
			if (
				defined.includes("chart") ||
				defined.includes("topic") ||
				defined.includes("insight")
			) {
				throw new Error(
					"chart/topic/insight 仍在 COMMAND_TABLE —— 已融合为 astrology 参数（Task 6）"
				);
			}
			// stars / oracle 并入 --source 选域；classics 随四域合并改名 knowledge —— 三个旧命令名都退役
			for (const old of ["stars", "oracle", "classics"]) {
				if (defined.includes(old)) {
					throw new Error(
						`${old} 仍在 COMMAND_TABLE —— stars/oracle 已并入 --source ${old === "classics" ? "各域" : old}，classics 改名 knowledge`
					);
				}
			}
			for (const must of ["astrology", "knowledge"]) {
				if (!defined.includes(must)) {
					throw new Error(`拆位不完整（应含 ${must}），实得：${defined.join("、")}`);
				}
			}
			// cities 删除后的数据表仍在（--city 容错解析在用）
			// ⚠️ 读**真实定义处**：数据表现随其唯一消费者住进 `cli/birth/`（2026-10-13，
			// 原 `cli/data/` 单文件目录撤并）。断言若继续读旧路径，会 ENOENT 假红，
			// 且掩盖真正的丢失（PROVINCES 没了该报的是内容不符，不是读不到）。
			const cities = readFileSync(resolve(ctx.root, "cli", "birth", "cities.ts"), "utf8");
			if (!/export const PROVINCES/.test(cities)) {
				throw new Error("cli/birth/cities.ts 的 PROVINCES 不在了");
			}
			// stars 释义经 knowledge --source stars 仍可检索（域实现搬进 cli/knowledge/）
			const s = await cmdKnowledge(
				parseArgs(["--source", "stars", "--search", "紫微"], "knowledge")
			);
			if (!s.includes("紫微") || !s.includes("关键词")) {
				throw new Error(
					`knowledge --source stars --search 紫微 的释义不见了，实得：${s.slice(0, 60)}`
				);
			}
			return "命令面收敛中间态就位";
		}
	);
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
			if (idx < 0) {
				throw new Error(`help 缺节标题 ${sec}`);
			}
			if (idx < last) {
				throw new Error(`节序错乱：${sec} 出现在前一节之前`);
			}
			last = idx;
		}
		return `${SECTIONS.length} 节齐全且有序`;
	});
	ok("help 强化：每命令 --help 出归属参数子集（astrology 无 --search，knowledge 反之）", () => {
		const astro = renderCommandHelp("astrology");
		for (const want of ["NAME", "OPTIONS", "EXAMPLES"]) {
			if (!astro.includes(want)) {
				throw new Error(`astrology --help 缺 ${want}`);
			}
		}
		for (const own of ["--pattern", "--mutagen", "--yearly", "--palaces", "--topic"]) {
			if (!astro.includes(own)) {
				throw new Error(`astrology --help 应列 ${own}`);
			}
		}
		if (astro.includes("--search")) {
			throw new Error("astrology --help 不该列 --search（归属过滤）");
		}
		const knowledge = renderCommandHelp("knowledge");
		if (!knowledge.includes("--search") || !knowledge.includes("--source")) {
			throw new Error("knowledge --help 应列 --search 与 --source（四域）");
		}
		if (knowledge.includes("--pattern")) {
			throw new Error("knowledge --help 不该列 --pattern（归属过滤）");
		}
		return "归属过滤双向成立";
	});
	ok("help 强化：示例用新虚构组合且注明「示例数据为虚构」", () => {
		const out = renderOverviewHelp();
		if (!out.includes("2011-06-24") || !out.includes("杭州")) {
			throw new Error("缺甲方虚构样例 2011-06-24 杭州");
		}
		if (!out.includes("1999-11-03") || !out.includes("成都")) {
			throw new Error("缺乙方虚构样例 1999-11-03 成都");
		}
		if (!out.includes("虚构")) {
			throw new Error("缺「示例数据为虚构」注记");
		}
		// 旧组合清退：help 里不再出现 1990-05-15 / 1993-08-22 示例
		for (const old of ["1990-05-15", "1993-08-22"]) {
			if (out.includes(old)) {
				throw new Error(`旧示例组合 ${old} 仍在 help 里`);
			}
		}
		return "虚构示例 + 注记在，旧组合已清退";
	});
}
