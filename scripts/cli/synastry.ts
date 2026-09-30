/**
 * `synastry` 命令：合盘（双宫联参 + 夫妻宫断语）。
 *
 * 2026-09-30 三 skill 合一时从 synastry 自带的 commands.ts 搬入 —— 实现逐字保留，
 * 只换 import 来源（`@/synastry` 内核）与命令注册（进 `./commands.ts` 的 COMMAND_TABLE）。
 */

import type { CliArgs } from "./args";
import {
	branchName,
	fmtDate,
	genderCN,
	majorsOf,
	mustPalace,
	palaceAtBranch,
	readAnalyzeJson,
} from "@/synastry/chart-view";
import { STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU, MARRIAGE_STARS_BRIEF } from "@/synastry/synastry-knowledge";

/**
 * @param args - CLI 参数表；`--a-chart` / `--b-chart` 各指一份 `analyze --json` 的输出文件
 * @returns 已渲染好的文本；带 `--json` 时返回两方命盘摘要的原始 JSON 字符串
 *
 * @remarks
 * 遵循倪海夏的双宫联参口径：看婚姻不能只看夫妻宫，必须同时看福德宫。输出两方命宫 / 夫妻宫 /
 * 福德宫主星、天作之合对应关系判定、夫妻宫断语（空宫借对宫主星论）、生年四化入夫妻宫、
 * 夫妻宫桃花孤克星；方法论与评分标准**不在本命令输出里**，末尾留一行指针指向
 * `references/synastry-guide.md`（恒定静态文本，按需读取）。
 *
 * ⚠️ 任一方 `lateZi.candidate` 为真且 `applied` 为假时单独提示：那份盘按**当日早子时**
 * 口径排，若改用晚子时（算次日）重排，该方命盘会整体改变，合盘结论需重跑。本命令
 * 只**转述**排盘方给的这两个标记，不自己重算真太阳时。
 *
 * ⚠️ 真实出生日期取自 `chart.birthInfo`（排盘方按真太阳时跨午夜调整过的那一份），
 * 真太阳时校正说明取自 `basis.note` —— 两者都来自那份 JSON，本命令一个字都不重算。
 */
export function cmdSynastry(args: CliArgs): string {
	// 两个旗标都必填：本命令不排盘，没有它们什么都做不了。
	// ⚠️ 缺失时报错，而**不是**回退去读出生信息旗标 —— 那种回退会让本命令悄悄又变成
	//    排盘方（且回退路径无人测，必然腐坏）。
	if (typeof args.aChart !== "string" || typeof args.bChart !== "string") {
		const missing = [
			...(typeof args.aChart === "string" ? [] : ["--a-chart"]),
			...(typeof args.bChart === "string" ? [] : ["--b-chart"]),
		];
		throw new Error(
			`缺少 ${missing.join(" / ")}：本命令不排盘，两方命盘都得由排盘命令给出。\n` +
				`  ① 先各排一张盘（注意是 analyze，不是 chart —— 后者没有四化落宫与排盘依据）：\n` +
				`     node scripts/purple-star.ts analyze \\\n` +
				`       --date 1990-05-15 --time 09:30 --city 北京 --gender male --json > /tmp/a.json\n` +
				`     node scripts/purple-star.ts analyze \\\n` +
				`       --date 1993-08-22 --time 14:00 --city 上海 --gender female --json > /tmp/b.json\n` +
				`  ② 再交给本命令：\n` +
				`     node scripts/purple-star.ts synastry --a-chart /tmp/a.json --b-chart /tmp/b.json`
		);
	}

	const A = readAnalyzeJson(args.aChart, "甲");
	const B = readAnalyzeJson(args.bChart, "乙");
	const ca = A.chart;
	const cb = B.chart;
	const biA = ca.birthInfo;
	const biB = cb.birthInfo;

	const mingA = palaceAtBranch(ca, ca.mingGongBranch, "甲方命宫");
	const mingB = palaceAtBranch(cb, cb.mingGongBranch, "乙方命宫");
	const fuqiA = mustPalace(ca, "夫妻宫");
	const fuqiB = mustPalace(cb, "夫妻宫");
	const fudeA = mustPalace(ca, "福德宫");
	const fudeB = mustPalace(cb, "福德宫");

	const mA = majorsOf(mingA),
		mB = majorsOf(mingB);
	const fA = majorsOf(fuqiA),
		fB = majorsOf(fuqiB);

	if (args.json) {
		return JSON.stringify(
			{
				a: { chart: ca, mingGong: mA, fuQiGong: fA, fuDeGong: majorsOf(fudeA) },
				b: { chart: cb, mingGong: mB, fuQiGong: fB, fuDeGong: majorsOf(fudeB) },
			},
			null,
			2
		);
	}

	const out: string[] = [];
	out.push("【合盘 · 双宫联参】倪海夏：看婚姻不能只看夫妻宫，必须同时看福德宫");
	out.push("");
	out.push(
		`甲方 ${biA.name ?? ""} ${fmtDate(biA)} ${A.basis.note} · ${genderCN(biA.gender)} · ${ca.wuxingJuName}`
	);
	out.push(`  命宫 ${branchName(ca.mingGongBranch)}：${mA.join("、") || "（空宫借对宫）"}`);
	out.push(`  夫妻宫 ${branchName(fuqiA.branch)}：${fA.join("、") || "（空宫借对宫）"}`);
	out.push(
		`  福德宫 ${branchName(fudeA.branch)}：${majorsOf(fudeA).join("、") || "（空宫借对宫）"}`
	);
	out.push("");
	out.push(
		`乙方 ${biB.name ?? ""} ${fmtDate(biB)} ${B.basis.note} · ${genderCN(biB.gender)} · ${cb.wuxingJuName}`
	);
	out.push(`  命宫 ${branchName(cb.mingGongBranch)}：${mB.join("、") || "（空宫借对宫）"}`);
	out.push(`  夫妻宫 ${branchName(fuqiB.branch)}：${fB.join("、") || "（空宫借对宫）"}`);
	out.push(
		`  福德宫 ${branchName(fudeB.branch)}：${majorsOf(fudeB).join("、") || "（空宫借对宫）"}`
	);
	out.push("");

	// 晚子时提醒（任一方命中都要提示，否则合盘基准可能是错的）
	for (const [label, side] of [
		["甲", A],
		["乙", B],
	] as const) {
		if (side.lateZi.candidate && !side.lateZi.applied) {
			out.push(`⚠️ ${label}方出生时间落在 23:00–23:59（晚子时），这份盘按当日早子时口径排。`);
			out.push(
				`   若该方确为 23:00 后出生、需按晚子时（算次日）口径，请回排盘命令` +
					`重排${label}方 —— 该方命盘会整体改变，合盘结论随之作废，须重跑本命令。`
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
		const stars = majorsOf(fuqi);
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

	// 四化入夫妻宫：SIHUA_IN_FUQI_GU 的键是「化禄/化权/化科/化忌」，落宫由排盘方给
	// （`nativeSiHua.located`，与盘面宫名同源，本命令不重算）
	out.push("【生年四化入夫妻宫】");
	let sihuaHit = 0;
	for (const [label, side, fuqi] of [
		["甲", A, fuqiA],
		["乙", B, fuqiB],
	] as const) {
		for (const x of side.nativeSiHua.located) {
			if (x.palace !== fuqi.name) continue;
			sihuaHit++;
			out.push(
				`  ${label}方 生年${side.nativeSiHua.stem}干 化${x.hua}（${x.star}）入夫妻宫：`
			);
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
