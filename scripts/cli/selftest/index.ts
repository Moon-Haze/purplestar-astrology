/**
 * 回归自检 —— 内核或 iztro 升级后，用一组不变量快速验证 CLI 仍然正确（拆自 purple-star.ts）。
 *
 * ⚠️ 它留在 `scripts/` 而非 `test/` 是有意的：skill 分发只带走
 *    `SKILL.md + scripts/ + package.json`，自检必须在交付包内，否则装到别人机器上没法自证。
 * ⚠️ 本文件即 `@/cli/selftest` 的落点（原 `cli/selftest.ts` 与 `selftest/` 同名并存过，
 *    而解析候选序是「同名 `.ts` 优先于同名目录」—— 现为目录 index，隐患已消）。
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 *
 * 断言本体按主题住在 `./` 八组（calc / birth / chart / render / args / commands /
 * astrology-shapes / guard），本文件只做编排。完整理由与三条运行期纪律见 docs/code/cli-selftest.md。
 */

import type { CliContext } from "../args";
import { parseArgs } from "../args";
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
 * `selftest` 命令：跑一组排盘不变量与知识源可用性断言，返回逐项报告。
 *
 * @param ctx - 运行期上下文（内核根与其来源）—— 自检要在输出里交代这张盘是用哪一份内核排的
 * @returns 已渲染好的报告文本；首行为「通过 N/N」，第二行是内核根
 *
 * @remarks
 * 覆盖：农历换算、真太阳时、晚子时等价性、城市容错、性别护栏、排盘不变量、三合派约束、
 * 格局与知识源可用性。首行自报项数，故此处不写死数字。内核根从 `ctx` 取而非自己推导。
 *
 * ⚠️ 有失败项时**不抛错，而是先 `console.error` 全量报告再 `process.exit(1)`** ——
 *    `test/cli.test.ts` 依赖这个退出码判定自检是否全绿（见 docs/code/cli-selftest.md）。
 */
export async function cmdSelftest(ctx: CliContext): Promise<string> {
	// 自检全程**强制直排、绕过排盘缓存**：回归要验的是「当前内核排出来的盘」，命中改动前
	// 写下的条目会让回归拿着旧盘全绿 —— 那比没有回归更坏（假绿）。
	// 本行同时覆盖下方 runCli 的子进程（env 随进程继承）；见 docs/code/cli-selftest.md。
	process.env.ZIWEI_NO_CACHE = "1";
	// harness（Assertion / eq / ok）抽在 ./selftest-kit —— 原先与 classics / synastry
	// 两个断言组逐字同形的三份本地定义由此归一。
	const { results, ok } = createHarness();

	// 命令表键集：动态 import 打断「commands → selftest → commands」静态环，取代旧
	// 「读源码文本、正则抽键」那条让物理排版成为 load-bearing 契约的第三条路。
	// 取 COMMANDS 视图而非裸表（表刻意不导出）；组文件一律不静态 import commands，
	// 需要命令表 / 键集 / 直调的经 deps 注入（见 docs/code/cli-selftest.md）。
	const { COMMANDS } = await import("../commands");
	const commandNames = Object.keys(COMMANDS);

	// 子进程探针只留给文末的冒烟（守「入口 → 解析 → 命令表 → 渲染 + 错误出口」真链路）；
	// 输出形态断言用进程内直调：子进程约 3.2 秒 vs 直调约 25ms，判据同构
	//（见 docs/code/cli-selftest.md）。
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
		// ⚠️ 跳过项**前置 ⏭**：它记 pass 但那条断言**根本没跑**，与「跑过且通过」是两件事
		// —— 不标出来就是恒真守卫伪装成通过（最坏的那种假绿，见 docs/code/cli-selftest.md）。
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
