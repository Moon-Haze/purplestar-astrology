/**
 * `chart` 命令：纯排盘十二宫。拆自 commands.ts（各命令按文件拆分，spec §2.2）。
 */

import type { CliArgs } from "./args";
import { buildBirthInfo } from "./birth-info";
import { birthplaceSection, fmtDate, genderCN, lateZiSection, renderPalace } from "./render";
import { generateChart } from "@/ziwei/algorithm";
import { STEMS, BRANCHES } from "@/ziwei/constants";

/**
 * `chart` 命令：纯排盘十二宫。
 *
 * @param args - CLI 参数表
 * @returns 已渲染好的文本；带 `--json` 时返回命盘的原始 JSON 字符串
 *
 * @remarks
 * 最小排盘：只要出生信息，不算流年、格局与四化。输出命盘头（姓名 / 日期 / 时辰 / 性别 / 农历 /
 * 命身宫 / 五行局 / 紫微位）、出生地与晚子时提示、逐宫详表，最后是大限一览与当前年龄大限。
 *
 * 返回字符串而不打印 —— `console.log` 由引导层统一负责（本文件命令皆然）。
 */
export function cmdChart(args: CliArgs) {
	const { info, note, lateZiCandidate, isLateZi, lngNote, lngAmbiguous } = buildBirthInfo(args);
	const chart = generateChart(info);

	if (args.json) return JSON.stringify(chart, null, 2);

	const out = [
		`命盘  ${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)}`,
		`农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
		`命宫：${BRANCHES[chart.soulBranch]} · 身宫：${BRANCHES[chart.bodyBranch]} · 五行局：${chart.fiveElementsClassName} · 紫微：${BRANCHES[chart.ziweiPos]}`,
		"",
	];
	out.push(...birthplaceSection(lngNote, lngAmbiguous));
	out.push(...lateZiSection(chart, info, isLateZi, lateZiCandidate));
	out.push("─".repeat(56));
	for (const p of chart.palaces) out.push(renderPalace(p, chart), "");
	out.push(
		"大限：" +
			chart.decadals
				.map(
					d => `${d.startAge}-${d.endAge}岁 ${d.palaceName}(${BRANCHES[d.palaceBranch]})`
				)
				.join(" | ")
	);
	out.push(
		`当前年龄：${chart.currentAge}岁 · 当前大限：${chart.decadals[chart.currentDecadalIndex]?.palaceName ?? "—"}`
	);
	return out.join("\n");
}

