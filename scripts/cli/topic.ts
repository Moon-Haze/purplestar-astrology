/**
 * `topic` 命令：主题论断。拆自 commands.ts（各命令按文件拆分，spec §2.2）。
 */

import type { CliArgs } from "./args";
import { parseYearlyArg, parseMonthlyArg } from "./astrology";
import { buildBirthInfo } from "./birth-info";
import { fmtDate, genderCN } from "./render";
import { generateChart } from "@/ziwei/algorithm";
import {
	getTopicAnalysis,
	TOPIC_LABEL,
	TOPIC_PALACE_NAME,
	type TopicKey,
	type AnalysisView,
} from "@/ziwei/analysis";

/**
 * `topic` 命令：主题论断 —— 十四主星 × 13 主题的**动态推算**（分析数据库 v3）。
 *
 * @param args - CLI 参数表；出生信息参数与 `analyze` 相同，另认
 *   `--topic <key>`（13 主题之一）、`--view mingpan|daxian|liunian|liuyue`（默认 mingpan）、
 *   `--yearly` / `--monthly`（view 为流年/流月时的目标年月）
 * @returns 已渲染好的论断文本
 *
 * @remarks
 * 与静态文案库不同：`getTopicAnalysis` 基于**整张盘**动态推算 —— 主宫主星（空宫借对宫）、
 * 三方四正会照、本命四化（取 `Star.mutagen`，农历年干口径，与盘面同源）、格局、以及所选
 * view 的大限/流年/流月引动，逐层拼出论断。
 *
 * 不带 `--topic` 时列出 13 个主题清单（key · 标签 · 对应宫位）。
 *
 * ⚠️ 输出末尾固定披露**知识来源分级**（verified/traditional/methodology/suspect）：
 * 库中「倪师说」引号句部分为传统口诀的风格化转述，不一定是《天纪》逐字原话 ——
 * 引用下断语时须注明口径，防止把转述当原话。
 */
export function cmdTopic(args: CliArgs) {
	const { info, note } = buildBirthInfo(args);

	// 不带 --topic：列主题清单（--topic 裸开关也走这里，与「给了没值」的形态一致）
	if (args.topic === undefined || args.topic === true) {
		const rows = (Object.keys(TOPIC_LABEL) as TopicKey[]).map(
			k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k]}（看${TOPIC_PALACE_NAME[k]}）`
		);
		return [
			"13 个主题（--topic <key> 选其一）：",
			...rows,
			"",
			"view 可选：mingpan（本命，默认）/ daxian（当前大限）/ liunian（流年）/ liuyue（流月）",
			"示例：node scripts/purple-star.ts topic --date 1990-05-15 --branch 5 --gender male --topic love",
		].join("\n");
	}

	const topic = String(args.topic) as TopicKey;
	if (!TOPIC_LABEL[topic])
		throw new Error(
			`--topic 应为 13 个主题之一（${Object.keys(TOPIC_LABEL).join("/")}），收到：${args.topic}`
		);

	const viewRaw = args.view !== undefined ? String(args.view) : "mingpan";
	if (!["mingpan", "daxian", "liunian", "liuyue"].includes(viewRaw))
		throw new Error(`--view 应为 mingpan/daxian/liunian/liuyue，收到：${args.view}`);
	// 上行已限定四值，断言只影响类型层
	const view = viewRaw as AnalysisView;

	const chart = generateChart(info);
	const liuNianYear = parseYearlyArg(args);
	const liuYueMonth = parseMonthlyArg(args);
	const text = getTopicAnalysis(chart, topic, {
		view,
		liunianYear: liuNianYear,
		liuyueMonth: liuYueMonth ?? undefined,
	});

	return [
		`【主题论断 · ${TOPIC_LABEL[topic]}】${info.name ?? ""} ${fmtDate(info)} ${note} · ${genderCN(info.gender)}`,
		"",
		text,
		"",
		"⚠️ 知识来源分级：以上论断出自分析数据库 v3 —— 其中「倪师说」引号句部分为传统口诀的",
		"   风格化转述，不一定是《天纪》逐字原话（verified / traditional / methodology / suspect 四级），",
		"   引用下断语时请注明口径。",
	].join("\n");
}

