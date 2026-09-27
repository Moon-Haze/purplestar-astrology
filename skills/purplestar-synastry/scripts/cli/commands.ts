/**
 * 命令实现 —— 合盘 skill 的命令表。
 *
 * ⚠️ **本文件是手写的，不是副本**（见 `CLAUDE.md` 的「副本边界与同步流程」）。
 * 排盘解读 skill 的 `cli/commands.ts` 里有 9 个命令，本 skill 只该有 3 个 ——
 * `analyze` / `topic` 之类出现在这里，只会让 Claude 照着一个跑不通的命令名去敲。
 * 裁过的文件无法逐字节守卫，这是拆 skill 的固有代价；它的正确性由
 * `cli/selftest.ts`（命令表 ↔ SKILL.md 双向一致）与仓库的 `test/cli.test.ts` 负责。
 *
 * 下面两个 `cmdXxx` 的函数体与源 skill 的同名函数**逐行相同**（本次拆分时用脚本整段搬过来，
 * 只改了 import 列表）。它们不是同步来的，**改源时要记得同步改这里** —— 或更好的做法：
 * 把共用的渲染逻辑下沉到内核，两个 skill 各自只留命令壳。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliArgs, CliContext } from "./args";
import { buildBirthInfo } from "./birth-info";
import { fmtDate, genderCN, locateSihua, mustPalace, palaceAtBranch } from "./render";
import { cmdSelftest } from "./selftest";
import type { Palace } from "@/ziwei/types";
import { generateChart } from "@/ziwei/algorithm";
import { getSiHuaByStem } from "@/ziwei/sihua";
import { STEMS, BRANCHES } from "@/ziwei/constants";
import {
	STAR_IN_FUQI_GU,
	SIHUA_IN_FUQI_GU,
	MARRIAGE_STARS_BRIEF,
	// ⚠️ 合盘内核用**相对路径**而非 `@/`：`@/` 在 tsc 眼里只映到**源** skill 的内核根
	//    （见 tsconfig 的 paths），而 synastry-knowledge.ts 已不住在源里（2026-09-27 起归本 skill），
	//    写 `@/` 会让 `npm run typecheck` 报「找不到模块」。相对路径在两侧都对：运行期由钩子的
	//    `.` 分支按**本文件**所在目录补 `.ts`，tsc 也按文件位置解析。
} from "../ziwei/synastry-knowledge";

/**
 * `synastry` 命令：合盘（双宫联参 + 夫妻宫断语）。
 *
 * @param args - CLI 参数表；甲乙两方各一套出生信息参数，分别带 `a-` / `b-` 前缀
 * @returns 已渲染好的文本；带 `--json` 时返回两方命盘摘要 + 方法论 + 评分标准的原始 JSON 字符串
 *
 * @remarks
 * 遵循倪海夏的双宫联参口径：看婚姻不能只看夫妻宫，必须同时看福德宫。输出两方命宫 / 夫妻宫 /
 * 福德宫主星、天作之合对应关系判定、夫妻宫断语（空宫借对宫主星论）、生年四化入夫妻宫、
 * 夫妻宫桃花孤克星；方法论与评分标准**不在本命令输出里**，末尾留一行指针指向
 * `references/synastry-guide.md`（恒定静态文本，按需读取）。
 *
 * ⚠️ 任一方校正后的出生时刻落在 23:00–23:59 时单独提示：本次按**当日早子时**口径排，
 * 若改用 `--a-late-zi` / `--b-late-zi`（晚子时算次日），该方命盘会整体改变，合盘结论需重跑。
 */
function cmdsynastry(args: CliArgs) {
	const a = buildBirthInfo(args, "a-");
	const b = buildBirthInfo(args, "b-");
	const ca = generateChart(a.info);
	const cb = generateChart(b.info);

	const mingA = palaceAtBranch(ca, ca.mingGongBranch, "甲方命宫");
	const mingB = palaceAtBranch(cb, cb.mingGongBranch, "乙方命宫");
	const fuqiA = mustPalace(ca, "夫妻宫");
	const fuqiB = mustPalace(cb, "夫妻宫");
	const fudeA = mustPalace(ca, "福德宫");
	const fudeB = mustPalace(cb, "福德宫");

	const majors = (p: Palace): string[] =>
		p.stars.filter(s => s.type === "major").map(s => s.name);
	const mA = majors(mingA),
		mB = majors(mingB);
	const fA = majors(fuqiA),
		fB = majors(fuqiB);

	if (args.json) {
		return JSON.stringify(
			{
				a: { chart: ca, mingGong: mA, fuQiGong: fA, fuDeGong: majors(fudeA) },
				b: { chart: cb, mingGong: mB, fuQiGong: fB, fuDeGong: majors(fudeB) },
			},
			null,
			2
		);
	}

	const out: string[] = [];
	out.push("【合盘 · 双宫联参】倪海夏：看婚姻不能只看夫妻宫，必须同时看福德宫");
	out.push("");
	out.push(
		`甲方 ${a.info.name ?? ""} ${fmtDate(a.info)} ${a.note} · ${genderCN(a.info.gender)} · ${ca.wuxingJuName}`
	);
	out.push(`  命宫 ${BRANCHES[ca.mingGongBranch]}：${mA.join("、") || "（空宫借对宫）"}`);
	out.push(`  夫妻宫 ${BRANCHES[fuqiA.branch]}：${fA.join("、") || "（空宫借对宫）"}`);
	out.push(`  福德宫 ${BRANCHES[fudeA.branch]}：${majors(fudeA).join("、") || "（空宫借对宫）"}`);
	out.push("");
	out.push(
		`乙方 ${b.info.name ?? ""} ${fmtDate(b.info)} ${b.note} · ${genderCN(b.info.gender)} · ${cb.wuxingJuName}`
	);
	out.push(`  命宫 ${BRANCHES[cb.mingGongBranch]}：${mB.join("、") || "（空宫借对宫）"}`);
	out.push(`  夫妻宫 ${BRANCHES[fuqiB.branch]}：${fB.join("、") || "（空宫借对宫）"}`);
	out.push(`  福德宫 ${BRANCHES[fudeB.branch]}：${majors(fudeB).join("、") || "（空宫借对宫）"}`);
	out.push("");

	// 晚子时提醒（任一方命中都要提示，否则合盘基准可能是错的）
	for (const [label, side] of [
		["甲", a],
		["乙", b],
	] as const) {
		if (side.lateZiCandidate && !side.isLateZi) {
			out.push(`⚠️ ${label}方出生时间落在 23:00–23:59（晚子时），本次按当日早子时口径排盘。`);
			out.push(
				`   若改用 --${label === "甲" ? "a" : "b"}-late-zi（晚子时算次日），该方命盘会整体改变，合盘结论需重跑。`
			);
		}
	}
	out.push("");

	// 天作之合判定（方法论「二、天作之合的判断标准」，见 references/synastry-guide.md）
	out.push("【对应关系判定】");
	const crossA = fA.some(s => mB.includes(s));
	const crossB = fB.some(s => mA.includes(s));
	const both = crossA && crossB;
	out.push(
		`  甲方夫妻宫主星 ∩ 乙方命宫主星：${fA.filter(s => mB.includes(s)).join("、") || "无"}`
	);
	out.push(
		`  乙方夫妻宫主星 ∩ 甲方命宫主星：${fB.filter(s => mA.includes(s)).join("、") || "无"}`
	);
	out.push(
		`  → ${both ? "双向对应，符合「天作之合」最高级匹配" : crossA || crossB ? "单向对应，属「次级良配」" : "无主星对应，需结合四化与福德宫另判"}`
	);
	out.push("");

	// 夫妻宫断语（STAR_IN_FUQI_GU 为五字段对象；空宫借对宫主星论）
	out.push("【夫妻宫断语】");
	for (const [label, fuqi] of [
		["甲", fuqiA],
		["乙", fuqiB],
	] as const) {
		const stars = majors(fuqi);
		const borrowed = stars.length ? stars : (fuqi.borrowedStars ?? []);
		if (!borrowed.length) {
			out.push(`  ${label}方夫妻宫空宫且对宫亦无主星 —— 婚姻之事全看四化与大限引动`);
			continue;
		}
		if (!stars.length)
			out.push(`  ${label}方夫妻宫空宫，借对宫 ${fuqi.borrowedFromName ?? ""} 主星论：`);
		for (const s of borrowed) {
			const e = STAR_IN_FUQI_GU[s];
			if (!e) {
				out.push(`    ${s}：（无收录断语）`);
				continue;
			}
			out.push(`    ${s}：${e.summary}`);
			out.push(`      吉象：${e.good}`);
			out.push(`      凶象：${e.bad}`);
			out.push(`      配偶特质：${e.spouse_traits}`);
			out.push(`      婚期：${e.timing}`);
			if (e.ni_quote) out.push(`      倪师原话：「${e.ni_quote}」`);
		}
	}
	out.push("");

	// 四化入夫妻宫：SIHUA_IN_FUQI_GU 的键是「化禄/化权/化科/化忌」，需先定位生年四化落宫
	out.push("【生年四化入夫妻宫】");
	let sihuaHit = 0;
	for (const [label, chart, fuqi] of [
		["甲", ca, fuqiA],
		["乙", cb, fuqiB],
	] as const) {
		// 生年四化取农历年干（与盘面 Star.siHua 的 mutagen 同源），不用公历取模 —— 理由见 cmdAnalyze
		const stem = chart.lunarInfo.yearStem;
		for (const x of locateSihua(chart, getSiHuaByStem(stem))) {
			if (x.palace !== fuqi.name) continue;
			sihuaHit++;
			out.push(`  ${label}方 生年${STEMS[stem]}干 化${x.hua}（${x.star}）入夫妻宫：`);
			out.push(`    ${SIHUA_IN_FUQI_GU[`化${x.hua}`] ?? ""}`);
		}
	}
	if (!sihuaHit)
		out.push("  双方夫妻宫均无生年四化落入 —— 婚姻非先天格局的着力点，随大限流年引动。");
	out.push("");

	// 夫妻宫桃花 / 孤克星
	out.push("【夫妻宫桃花·孤克星】");
	let marriageHit = 0;
	for (const [label, fuqi] of [
		["甲", fuqiA],
		["乙", fuqiB],
	] as const) {
		for (const s of fuqi.stars) {
			if (MARRIAGE_STARS_BRIEF[s.name]) {
				marriageHit++;
				out.push(`  ${label}方 ${s.name}：${MARRIAGE_STARS_BRIEF[s.name]}`);
			}
		}
	}
	if (!marriageHit) out.push("  双方夫妻宫无收录的桃花/孤克星。");
	out.push("");
	// 评分标准与完整方法论是**恒定静态文本** —— 与「这一对是谁」无关，排谁的盘都是同一份，
	// 曾在此处无条件重印（实测占本命令输出 78%）。现住在 `references/synastry-guide.md`，
	// 按需读取，此处只留指针。
	// ⚠️ 指针文案**不得**出现「【评分标准】」/「【完整方法论】」这两个块标题：test/cli.test.ts
	// 的绊线正是盯这两个字面量，引用了就是自己踩自己。
	out.push("评分标准与方法论已移至 references/synastry-guide.md（按需读取，不由本命令输出）。");

	return out.join("\n");
}

// ══════════════════════ 命令表 ══════════════════════

/** 命令实现的签名：返回**已渲染好的文本**，由引导层统一 `console.log`。 */
type Cmd = (args: CliArgs, ctx: CliContext) => string;

/**
 * 命令名 → 实现。
 *
 * @remarks
 * 刻意**不导出**这张裸表：导出的是下面两个视图（{@link COMMANDS} 供分发、
 * {@link COMMAND_DESC} 供渲染 HELP）。调用方拿不到「键集与描述可能对不上」的中间态。
 *
 * 用 `satisfies` 而非 `: Record<...>` 标注，是为了保住字面量键集 ——
 * `CommandName` 与 `COMMAND_DESC` 的完备性都建立在它之上。
 */
const COMMAND_TABLE = {
	synastry: cmdsynastry,
	selftest: (_args: CliArgs, ctx: CliContext) => cmdSelftest(ctx),
} satisfies Record<string, Cmd>;

/** 合法命令名。 */
export type CommandName = keyof typeof COMMAND_TABLE;

/**
 * 分发用的命令表：命令名 → 实现。
 *
 * @remarks
 * 值类型显式写出 `| undefined`：命令名来自 argv，查表必然未命中，
 * 这里让「未命中」在类型上就成立，而不是靠断言把 undefined 抹掉。
 *
 * `help` 不在表内 —— 引导层单独处理，见 `purple-star.ts` 的 `main()`。
 */
export const COMMANDS: Record<string, Cmd | undefined> = COMMAND_TABLE;

/**
 * 命令名 → 一行说明，HELP 的命令段据此派生。
 *
 * @remarks
 * 类型写成 `Record<CommandName, string>` 而非 `Record<string, string>`：**新增命令忘了
 * 写说明就编译不过**。
 */
export const COMMAND_DESC: Record<CommandName, string> = {
	synastry: "合盘（双宫联参 + 夫妻宫断语 + 四化入夫妻宫）",
	selftest: "回归自检（命令冒烟 / 参数面 / SKILL.md 一致）",
};
