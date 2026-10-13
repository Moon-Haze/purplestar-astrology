/**
 * 回归自检 —— 内核或 iztro 升级后，用一组不变量快速验证 CLI 仍然正确。
 *
 * 拆自 purple-star.ts。独立成文件的两个理由：
 *   1. 它占原文件四分之一（489 行），且**性质是测试代码**，不是产品代码；
 *   2. 它的依赖是单向的 —— 它调用解析层与渲染层，但没有任何东西调用它（除了命令表）。
 *      抽一个叶子出去，是所有重构里最安全的一种。
 *
 * ⚠️ 它留在 `scripts/` 而非 `test/`，是有意的：skill 分发时只带走
 *    `SKILL.md + scripts/ + package.json`，`test/` 不带走。自检必须在交付包内，
 *    否则装到别人机器上就没法自证。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 *
 * 断言本体按主题住在 `./selftest/` 子目录（calc / birth / chart / render / args /
 * commands / guard 七组），本文件只做编排：构造 harness 与直调/子进程探针，按
 * 报告顺序逐组调用，再把 classics / synastry 断言组并入并渲染分段报告。
 */

import type { CliContext } from "./args";
import { parseArgs } from "./args";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { asserts as classicAsserts } from "@/corpus/selftest-asserts";
import { asserts as synastryAsserts } from "@/synastry/selftest-asserts";
import { createHarness, callDirect, type SelftestDeps } from "./selftest-kit";
import { unknownCommandMessage } from "./dispatch";
import { runLunar, runTrueSolar, runLateZi } from "./selftest/calc";
import { runCityTolerance, runGenderGuard, runBirthInfoShape } from "./selftest/birth";
import {
	runChartInvariants,
	runFortuneData,
	runSchoolGuard,
	runPatternMutagen,
	runFortuneLocator,
} from "./selftest/chart";
import { runKnowledgeSource, runTopicRender } from "./selftest/render";
import {
	runParseEngine,
	runArgSurface,
	runDeclarationTable,
	runSkillArgsAudit,
} from "./selftest/args";
import {
	runCommandSurface,
	runHelpPrune,
	runContractProbe,
	runCommandSplit,
	runAstrologyShapes,
	runHelpEnrich,
} from "./selftest/commands";
import {
	runSmoke,
	runSkillCommandAudit,
	runDocConsistency,
	runGradeRegistry,
	runDispatchProbe,
} from "./selftest/guard";

/**
 * `selftest` 命令：跑一组排盘不变量与知识源可用性断言，返回逐项报告。
 *
 * @param ctx - 运行期上下文（内核根与其来源）—— 自检要在输出里交代这张盘是用哪一份内核排的
 * @returns 已渲染好的报告文本；首行为「通过 N/N」，第二行是内核根
 *
 * @remarks
 * 覆盖：农历换算、真太阳时、晚子时等价性、城市容错、性别护栏、排盘不变量、三合派约束、
 * 格局与知识源可用性。首行自报项数，故此处不写死数字。
 *
 * 内核根从 `ctx` 取而非自己推导：那是引导层 `pickRoot()` 的职责，自检只负责把它交代出来。
 *
 * ⚠️ 有失败项时**不抛错，而是先 `console.error` 全量报告再 `process.exit(1)`** ——
 * `test/cli.test.ts` 依赖这个退出码判定自检是否全绿。
 */
export async function cmdSelftest(ctx: CliContext): Promise<string> {
	// 自检全程**强制直排、绕过排盘缓存**：回归要验的是「当前内核排出来的盘」，
	// 若允许命中 .cache/charts 里改动前写下的条目，改完内核的回归会拿着旧盘全绿 ——
	// 那比没有回归更坏（假绿）。本行同时覆盖下方 runCli 的子进程（env 随进程继承）。
	process.env.ZIWEI_NO_CACHE = "1";
	// harness（Assertion / eq / ok）抽在 ./selftest-kit —— 原先与 classics / synastry
	// 两个断言组逐字同形的三份本地定义由此归一。
	const { results, ok } = createHarness();

	// 命令表键集：动态 import 打断「commands → selftest → commands」静态环（Cmd 已
	// 放宽为可返回 Promise），取代旧「读 commands.ts 源码文本、正则抽键」的第三条路 ——
	// 那条路让命令表的物理排版成了 load-bearing 契约（连「键上双引号可选」都要注释防踩）。
	// 取 COMMANDS 视图而非裸表：表本身刻意不导出（防止键集/描述对不上的中间态外泄），
	// 而断言要的正是运行期真实键集。selftest/ 下组文件一律不静态 import commands，
	// 需要命令表/键集/直调的经下方 deps 注入。
	const { COMMANDS } = await import("./commands");
	const commandNames = Object.keys(COMMANDS);

	// 子进程探针只留给文末的冒烟（守住「入口 → 解析 → 命令表 → 渲染 + 错误出口」真链路）；
	// 输出形态断言用进程内直调（call）—— 每次子进程约 3.2 秒（iztro 冷启动），直调约
	// 25ms，判据同构（code/out/err 三元组，错误路径同一「错误：」前缀文案）。
	const runCli = (args: string[]): { code: number; out: string; err: string } => {
		const r = spawnSync(process.execPath, [resolve(ctx.root, "purple-star.ts"), ...args], {
			encoding: "utf8",
		});
		return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
	};
	/** 直调版：与 runCli 同形返回。help / <cmd> --help 不走命令表分发，由 help 模块渲染函数直调。 */
	const call = (argv: string[]): { code: number; out: string; err: string } => {
		const [cmd, ...rest] = argv;
		const fn = COMMANDS[cmd as keyof typeof COMMANDS];
		if (!fn) {
			return {
				code: 1,
				out: "",
				err: unknownCommandMessage(cmd, commandNames),
			};
		}
		return callDirect(cmd, rest, fn, parseArgs, ctx);
	};

	const deps: SelftestDeps = { ctx, ok, call, runCli, commandNames };

	// ── 断言主体：按报告顺序逐组调用（组函数与断言条目见 selftest/ 各文件）──
	runLunar(deps);
	runTrueSolar(deps);
	runLateZi(deps);
	runCityTolerance(deps);
	runGenderGuard(deps);
	runChartInvariants(deps);
	runFortuneData(deps);
	runSchoolGuard(deps);
	runPatternMutagen(deps);
	runKnowledgeSource(deps);
	runParseEngine(deps);
	runBirthInfoShape(deps);
	runArgSurface(deps);
	runCommandSurface(deps);
	runDeclarationTable(deps);
	runHelpPrune(deps);
	runContractProbe(deps);
	runFortuneLocator(deps);
	runTopicRender(deps);
	runSkillArgsAudit(deps);
	runCommandSplit(deps);
	runAstrologyShapes(deps);
	runHelpEnrich(deps);
	runSmoke(deps);
	runSkillCommandAudit(deps);
	runDocConsistency(deps);
	await runGradeRegistry(deps);
	await runDispatchProbe(deps);

	// 古籍 / 合盘断言组在断言流此处执行（async，故在 ok 断言体之外 await），并入主报告。
	const classics = await classicAsserts(deps);
	const synastry = await synastryAsserts(deps);

	ok("合并自检：古籍 / 合盘断言组并入（三段合计）", () => {
		// corpus 与 synastry 的自检断言各自住在
		// scripts/corpus/selftest-asserts.ts 与 scripts/synastry/selftest-asserts.ts，
		// 由本命令汇总执行 —— 报告分三段（排盘 / 古籍 / 合盘），首行「通过 N/N」为合计。
		if (!classics.length || !synastry.length) {
			throw new Error("断言组为空——搬移未完成");
		}
		results.push({ pass: true, name: "── 古籍 ──", detail: "" });
		for (const r of classics) {
			results.push(r);
		}
		results.push({ pass: true, name: "── 合盘 ──", detail: "" });
		for (const r of synastry) {
			results.push(r);
		}
		return `古籍 ${classics.filter(x => x.pass).length}/${classics.length} · 合盘 ${
			synastry.filter(x => x.pass).length
		}/${synastry.length}`;
	});

	// ── 输出 ──
	const passed = results.filter(r => r.pass).length;
	const failed = results.length - passed;
	// 先报内核根：正常情况下就是本 skill 目录（SKILL.md 的上一级）
	const srcNote = ctx.rootLabel === "技能自带内核" ? "" : `（来源：${ctx.rootLabel}）`;
	const out = [
		`紫微斗数 skill 回归自检 —— 通过 ${passed}/${results.length}`,
		`内核根：${ctx.root} ${srcNote}`,
		"",
	];
	for (const r of results) {
		out.push(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? `\n     ${r.detail}` : ""}`);
	}
	if (failed) {
		out.push(
			"",
			`❌ ${failed} 项未通过。若为内核或 iztro 升级所致，请核对 scripts/cli/ 各模块顶部的 import 列表与换算公式。`
		);
	} else {
		out.push("", "✅ 全部通过。");
	}
	const text = out.join("\n");
	if (failed) {
		console.error(text);
		process.exit(1);
	}
	return text;
}
