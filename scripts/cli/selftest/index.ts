/**
 * 回归自检 —— 内核或 iztro 升级后，用一组不变量快速验证 CLI 正确。
 *
 * ⚠️ 留在 `scripts/` 而非 `test/`：分发含 `SKILL.md + scripts/ + package.json`，
 *    自检须在包内，否则无法自证。
 * ⚠️ 本文件即 `@/cli/selftest` 落点（解析候选序「同名 `.ts` 优先于同名目录」，现为目录 index）。
 * ⚠️ 由引导层在 `registerHooks` **之后**动态加载，可静态 import 内核。
 *
 * 断言本体按主题住在 `./` 八组（calc / birth / chart / render / args / commands /
 * astrology-shapes / guard），本文件只编排。
 *
 * @file 回归自检 —— 升级后验证 CLI 正确
 */

import type { CliContext } from "../args";
import { parseArgs } from "../args";
import { setCacheBypassAll } from "../chart/chart-cache";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { asserts as classicAsserts } from "@/corpus/selftest-asserts";
import { asserts as synastryAsserts } from "@/synastry/selftest-asserts";
import { createHarness, callDirect, type SelftestDeps } from "./kit";
import { unknownCommandMessage } from "../host/dispatch";
import { runLunar, runTrueSolar, runLateZi } from "./calc";
import { runCityTolerance, runGenderGuard, runBirthInfoShape } from "./birth";
import {
	runChartInvariants,
	runFortuneData,
	runSchoolGuard,
	runPatternMutagen,
	runFortuneLocator,
	runMutagenCaliber,
} from "./chart";
import { runKnowledgeSource, runTopicRender } from "./render";
import { runParseEngine, runArgSurface, runDeclarationTable, runSkillArgsAudit } from "./args";
import {
	runCommandSurface,
	runHelpPrune,
	runContractProbe,
	runCommandSplit,
	runHelpEnrich,
} from "./commands";
import { runAstrologyShapes } from "./astrology-shapes";
import {
	runSmoke,
	runSkillCommandAudit,
	runDocConsistency,
	runGradeRegistry,
	runDispatchProbe,
} from "./guard";

/**
 * `selftest` 命令：跑排盘不变量与知识源断言，返回逐项报告。
 *
 * @param ctx - 运行期上下文（内核根与其来源）—— 输出交代用哪份内核排盘
 * @returns 报告文本；首行「通过 N/N」，第二行内核根
 *
 * @remarks
 * 覆盖：农历换算、真太阳时、晚子时、城市容错、性别护栏、排盘不变量、三合派约束、格局与知识源。
 * 首行自报项数；内核根从 `ctx` 取。
 *
 * ⚠️ 失败项**不抛错，先 `console.error` 报告再 `process.exit(1)`** ——
 *    `test/cli.test.ts` 依赖该码判全绿（见 docs/code/cli-selftest.md）。
 */
export async function cmdSelftest(ctx: CliContext): Promise<string> {
	// 全程**直排、绕过缓存**：回归验「当前内核排出来的盘」，命中改动前
	// 条目让回归拿旧盘全绿 —— 比没回归更坏（假绿）。旁路走缓存模块显式
	// API：本行覆盖全部进程内直调排盘。
	setCacheBypassAll(true);
	// harness（Assertion / eq / ok）抽在 ./selftest-kit，原与 classics / synastry
	// 两断言组逐字同形的三份本地定义由此归一。
	const { results, ok } = createHarness();

	// 命令表键集：动态 import 打断「commands → selftest → commands」静态环，取代旧
	// 「读源码文本、正则抽键」让物理排版成为 load-bearing 契约的第三条路。
	// 取 COMMANDS 视图非裸表（表不导出）；组文件不静态 import commands，
	// 需要命令表 / 键集 / 直调的经 deps 注入（见 docs/code/cli-selftest.md）。
	const { COMMANDS } = await import("../commands");
	const commandNames = Object.keys(COMMANDS);

	// 子进程探针留给文末冒烟（守「入口 → 解析 → 命令表 → 渲染 + 错误出口」真链路）；
	// 输出形态断言用进程内直调：子进程约 3.2 秒 vs 直调约 25ms，判据同构
	//（见 docs/code/cli-selftest.md）。
	// 子进程模块旁路过不去：排盘命令 argv 显式携带 --no-cache
	//（synastry / knowledge 不排盘、不识别该旗标，只加 astrology）。
	/** 进程内跑一次 CLI，返回退出码与输出。 */
	const runCli = (args: string[]): { code: number; out: string; err: string } => {
		const argv = [...args, ...(args[0] === "astrology" ? ["--no-cache"] : [])];
		const r = spawnSync(process.execPath, [resolve(ctx.root, "purple-star.ts"), ...argv], {
			encoding: "utf8",
		});
		return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
	};
	/** 直调版：与 runCli 同形。help / <cmd> --help 不走命令表分发，由 help 渲染函数直调。 */
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

	// ── 断言主体：按报告顺序逐组调用（见 selftest/ 各文件）──
	runLunar(deps);
	runTrueSolar(deps);
	runLateZi(deps);
	runCityTolerance(deps);
	runGenderGuard(deps);
	runChartInvariants(deps);
	runFortuneData(deps);
	runSchoolGuard(deps);
	runPatternMutagen(deps);
	runMutagenCaliber(deps);
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

	// 古籍 / 合盘断言组在此执行（async，在 ok 断言体外 await），并入主报告。
	const classics = await classicAsserts(deps);
	const synastry = await synastryAsserts(deps);

	ok("合并自检：古籍 / 合盘断言组并入（三段合计）", () => {
		// corpus 与 synastry 的自检断言各自住在
		// scripts/corpus/selftest-asserts.ts 与 scripts/synastry/selftest-asserts.ts，
		// 本命令汇总执行 —— 报告三段（排盘 / 古籍 / 合盘），首行「通过 N/N」为合计。
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
	// 先报内核根：通常是本 skill 目录（SKILL.md 上一级）
	const srcNote = ctx.rootLabel === "技能自带内核" ? "" : `（来源：${ctx.rootLabel}）`;
	const out = [
		`紫微斗数 skill 回归自检 —— 通过 ${passed}/${results.length}`,
		`内核根：${ctx.root} ${srcNote}`,
		"",
	];
	for (const r of results) {
		// ⚠️ 跳过项**前置 ⏭**：记 pass 但断言**没跑**，与「跑过且通过」是两回事
		// —— 不标出来就是恒真守卫伪装成通过（最坏假绿，见 docs/code/cli-selftest.md）。
		const mark = r.skipped ? "⏭" : r.pass ? "✅" : "❌";
		out.push(`${mark} ${r.name}${r.detail ? `\n     ${r.detail}` : ""}`);
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
