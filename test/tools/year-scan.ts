#!/usr/bin/env node
// ── 年份段恒等式扫描：把层 3 的安星法不变量压到 1900–2100 全域 ──
//
// 与 full-corpus.ts 的分工：
//   full-corpus.ts → 1924–1983 有外部基准，逐字段对标（验「行为没变」）
//   本脚本         → 1900–2100 **无基准**（数据集止于 1983，而实际来排盘的用户
//                    几乎都生于 1984 之后），只能压**与年份无关的恒等式**（验「排得自洽」）。
//
// 恒等式全部取自安星法本身（十二宫偏移、十四主星各一、大限结构、生年四化表），
// 加一条 lunar-typescript 的**公历↔农历往返**（此前只记录过 lunar-lite 有往返缺陷，
// 同源的 lunar-typescript 未经全谱验证）。
//
// 用法（在 skill 根执行）：
//   node test/tools/year-scan.ts                    # 全量 1900–2100，约 87,000 条
//   node test/tools/year-scan.ts --year 1990        # 只扫 1990 年
//   node test/tools/year-scan.ts --start 1984 --end 2010
//   node test/tools/year-scan.ts --limit 5000       # 只扫前 5,000 条
//   node test/tools/year-scan.ts --quiet            # 不打印进度，只出报告
//
// 退出码：0 = 零违例；1 = 有违例或依赖缺失。
//
// ⚠️ 这是**自洽性**扫描，不是正确性基准 —— 它抓「排出了结构上不可能的盘」，
//    不抓「结构合法但安错了星」（那只能靠外部基准，见 full-corpus.ts）。
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Solar, Lunar } from "lunar-typescript";

import type { BirthInfo, ZiweiChart } from "@/ziwei/types";
import { loadAlgorithm, loadConstants, loadSihua } from "../lib/loader.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <skill 根>/test/tools
const SKILL_ROOT = resolve(HERE, "../..");

const YEAR_ALL = { start: 1900, end: 2100 }; // iztro 的支持域
const DAYS_OF_MONTH = [5, 15, 25]; // 每月取 3 日 × 12 时辰 × 201 年 ≈ 87,000 条
const PROGRESS_EVERY = 7200;
const MAX_DETAIL = 20;

// ── 参数 ──
const argv = process.argv.slice(2);
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
const optOf = (name: string): string | null => {
	const i = argv.indexOf(`--${name}`);
	if (i < 0) return null;
	const v = argv[i + 1];
	return v && !v.startsWith("--") ? v : null;
};

const QUIET = hasFlag("quiet");
const YEAR = optOf("year") ? Number(optOf("year")) : null;
const START = YEAR ?? (optOf("start") ? Number(optOf("start")) : YEAR_ALL.start);
const END = YEAR ?? (optOf("end") ? Number(optOf("end")) : YEAR_ALL.end);
const LIMIT = optOf("limit") ? Number(optOf("limit")) : Infinity;

function range(a: number, b: number): number[] {
	const out: number[] = [];
	for (let i = a; i <= b; i++) out.push(i);
	return out;
}

const label = (b: BirthInfo): string =>
	`${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} ${b.hour}时 ${b.gender}`;

// ── 恒等式检查：全部返回违例描述（空数组 = 通过）──
// 口径照 test/invariants.test.ts（层 3）复刻 —— 那里的断言绑在 300 条 fixtures 上，
// 这里把同一组口径压到无基准的年份段。

const MAJOR_STARS = [
	"紫微", "天机", "太阳", "武曲", "天同", "廉贞",
	"天府", "太阴", "贪狼", "巨门", "天相", "天梁",
	"七杀", "破军",
];

interface Ctx {
	PALACE_NAMES_ORDER: string[];
	STEMS: string[];
	BRANCHES: string[];
	getSiHuaByStem(stemIndex: number): Record<string, string>;
}

function checkChart(chart: ZiweiChart, ctx: Ctx): string[] {
	const errs: string[] = [];
	const { PALACE_NAMES_ORDER, BRANCHES } = ctx;

	// 1. 十二宫必齐，宫名集合 === PALACE_NAMES_ORDER
	const names = chart.palaces.map(p => p.name);
	if (names.length !== 12 || new Set(names).size !== 12)
		errs.push(`十二宫不齐：${names.length} 宫 / ${new Set(names).size} 个不同名`);
	if ([...names].sort().join() !== [...PALACE_NAMES_ORDER].sort().join())
		errs.push(`宫名集合与 PALACE_NAMES_ORDER 不符：${[...names].sort().join("、")}`);

	// 2. 偏移恒等式：k = (命宫支 − 本宫支 + 12) % 12，宫名 = PALACE_NAMES_ORDER[k]
	for (const p of chart.palaces) {
		const k = (chart.mingGongBranch - p.branch + 12) % 12;
		if (p.name !== PALACE_NAMES_ORDER[k])
			errs.push(`偏移恒等式：${BRANCHES[p.branch]} 宫应为 ${PALACE_NAMES_ORDER[k]}，实得 ${p.name}`);
	}

	// 3. 十四主星各恰一颗
	const majors = chart.palaces.flatMap(p => p.stars.filter(s => s.type === "major").map(s => s.name)).sort();
	if (majors.join() !== [...MAJOR_STARS].sort().join())
		errs.push(`主星集合不符（${majors.length} 颗）：${majors.join("、")}`);

	// 4. 生年四化：恰 4 颗带 siHua、禄权科忌各一、与农历年干四化表逐颗一致
	const marked = chart.palaces.flatMap(p => p.stars).filter(s => s.siHua);
	if (marked.length !== 4) errs.push(`带四化标记的星应恰 4 颗，实得 ${marked.length}`);
	if (new Set(marked.map(s => s.siHua)).size !== 4)
		errs.push(`四化应禄权科忌各一，实得 ${marked.map(s => s.siHua).join("")}`);
	const transforms = ctx.getSiHuaByStem(chart.lunarInfo.yearStem);
	const expectByStar: Record<string, string> = {};
	for (const [hua, star] of Object.entries(transforms)) expectByStar[star] = hua;
	for (const s of marked) {
		if (expectByStar[s.name] !== s.siHua)
			errs.push(`${s.name} 的四化标记为 ${s.siHua}，年干（${ctx.STEMS[chart.lunarInfo.yearStem]}）四化表却给 ${expectByStar[s.name] ?? "无"}`);
	}

	// 5. 大限：12 步、12 支、跨度 10 年首尾相接、palaceName 与宫位一致
	if (chart.daXians.length !== 12) errs.push(`大限应 12 步，实得 ${chart.daXians.length}`);
	if (new Set(chart.daXians.map(d => d.palaceBranch)).size !== 12)
		errs.push("大限 12 步应覆盖 12 个不同宫支");
	const dx = [...chart.daXians].sort((a, b) => a.startAge - b.startAge);
	for (let i = 0; i < dx.length - 1; i++) {
		if (dx[i].endAge - dx[i].startAge !== 9)
			errs.push(`大限第 ${i} 步跨度应为 10 年（${dx[i].startAge}-${dx[i].endAge}）`);
		if (dx[i + 1].startAge !== dx[i].endAge + 1)
			errs.push(`大限第 ${i} 步与第 ${i + 1} 步应相接（${dx[i].endAge} → ${dx[i + 1].startAge}）`);
	}
	for (const d of chart.daXians) {
		const palace = chart.palaces.find(p => p.branch === d.palaceBranch);
		if (!palace || palace.name !== d.palaceName)
			errs.push(`大限宫名 ${d.palaceName} 与宫位 ${BRANCHES[d.palaceBranch]} 的实际宫名 ${palace?.name ?? "无"} 不符`);
	}

	// 6. 空宫借宫：主星空宫必有借星，且借自对宫
	for (const p of chart.palaces) {
		const hasMajor = p.stars.some(s => s.type === "major");
		if (!hasMajor) {
			if (!p.borrowedStars?.length) errs.push(`${p.name} 空宫却无 borrowedStars`);
			const opp = chart.palaces.find(q => q.branch === (p.branch + 6) % 12);
			if (opp && p.borrowedFromName !== opp.name)
				errs.push(`${p.name} 借宫来源 ${p.borrowedFromName ?? "无"} ≠ 对宫 ${opp.name}`);
		} else if (p.borrowedStars?.length) {
			errs.push(`${p.name} 有主星却带 borrowedStars`);
		}
	}

	return errs;
}

/** 公历 → 本项目农历信息 → lunar-typescript 回到公历，须回到同一日（闰月用负月序）。 */
function checkLunarRoundTrip(birth: BirthInfo, chart: ZiweiChart, stems: string[], branches: string[]): string[] {
	const li = chart.lunarInfo;
	const back = Lunar.fromYmd(li.lunarYear, li.isLeapMonth ? -li.lunarMonth : li.lunarMonth, li.lunarDay).getSolar();
	const [y, m, d] = [back.getYear(), back.getMonth(), back.getDay()];
	if (y !== birth.year || m !== birth.month || d !== birth.day)
		return [
			`农历往返失败：公历 ${birth.year}-${birth.month}-${birth.day} → 农历 ${li.lunarYear}-${li.isLeapMonth ? "闰" : ""}${li.lunarMonth}-${li.lunarDay} → 公历 ${y}-${m}-${d}`,
		];
	// 年柱双向核对：用**出生日当天**取年柱。lunar-typescript 的 getYearInGanZhi() 按
	// 正月初一切年（与本项目同口径；立春界是另一个 API getYearInGanZhiByLiChun）。
	// 不能用「年中日期取年柱」的技巧 —— 那只适用于问「某一年的年干」，此处核对的是
	// 出生日的农历年归属；首版脚本正是在这里误报了一片（探针口径错 ≠ 被测对象错）。
	const gz = Solar.fromYmd(birth.year, birth.month, birth.day).getLunar().getYearInGanZhi();
	if (stems.indexOf(gz[0]!) !== li.yearStem || branches.indexOf(gz[1]!) !== li.yearBranch)
		return [
			`年柱分叉：lunar 年柱 ${gz} vs lunarInfo ${stems[li.yearStem] ?? li.yearStem}${branches[li.yearBranch] ?? li.yearBranch}`,
		];
	return [];
}

interface Violation {
	birth: BirthInfo;
	check: string;
	message: string;
}

async function main(): Promise<void> {
	if (!existsSync(resolve(SKILL_ROOT, "node_modules/iztro"))) {
		console.error("缺少依赖：请先在 skill 根 npm install");
		process.exit(1);
	}

	const { generateChart } = await loadAlgorithm();
	const { PALACE_NAMES_ORDER, STEMS, BRANCHES } = await loadConstants();
	const { getSiHuaByStem } = await loadSihua();
	const ctx: Ctx = { PALACE_NAMES_ORDER, STEMS, BRANCHES, getSiHuaByStem };

	let checked = 0;
	const violations: Violation[] = [];
	const byCheck = new Map<string, number>();
	const t0 = Date.now();

	outer: for (const y of range(START, END)) {
		for (const m of range(1, 12)) {
			for (const d of DAYS_OF_MONTH) {
				for (const h of range(0, 11)) {
					if (checked >= LIMIT) break outer;
					const gender = (y + m + d + h) % 2 === 0 ? "male" : "female";
					const birth: BirthInfo = { year: y, month: m, day: d, hour: h, gender, longitude: 120 };
					checked++;

					let chart: ZiweiChart;
					try {
						chart = generateChart(birth);
					} catch (err) {
						push(violations, byCheck, birth, "排盘抛错", String(err));
						continue;
					}
					for (const msg of checkChart(chart, ctx)) push(violations, byCheck, birth, "安星法恒等式", msg);
					for (const msg of checkLunarRoundTrip(birth, chart, STEMS, BRANCHES))
						push(violations, byCheck, birth, "农历往返", msg);

					if (!QUIET && checked % PROGRESS_EVERY === 0)
						console.log(`  已检查 ${checked} 条（${y}-${String(m).padStart(2, "0")}），违例 ${violations.length}`);
				}
			}
		}
	}

	const secs = ((Date.now() - t0) / 1000).toFixed(1);
	console.log("");
	console.log("══ 年份段恒等式扫描汇总 ══");
	console.log(`  范围　　　　　　　　　　${START}–${END}（每月 ${DAYS_OF_MONTH.length} 日 × 12 时辰，性别交替）`);
	console.log(`  检查条数　　　　　　　　${checked}`);
	console.log(`  违例　　　　　　　　　　${violations.length}`);
	if (byCheck.size) {
		console.log("  按类别：");
		for (const [k, v] of [...byCheck.entries()].sort((a, b) => b[1] - a[1]))
			console.log(`    ${k}　　　${v}`);
	}
	if (violations.length) {
		console.log(`  明细（前 ${MAX_DETAIL} 条）：`);
		for (const v of violations.slice(0, MAX_DETAIL))
			console.log(`    [${label(v.birth)}] ${v.check}：${v.message}`);
		if (violations.length > MAX_DETAIL) console.log(`    …… 其余 ${violations.length - MAX_DETAIL} 条略`);
	}
	console.log(`  耗时　　　　　　　　　　${secs} 秒（${((Date.now() - t0) / checked).toFixed(1)} ms/条）`);
	console.log("");
	console.log(violations.length ? "✘ 有违例。" : "✔ 零违例（自洽性通过；这证明排得自洽，不证明排得对）。");
	process.exit(violations.length ? 1 : 0);
}

function push(
	violations: Violation[],
	byCheck: Map<string, number>,
	birth: BirthInfo,
	check: string,
	message: string
): void {
	violations.push({ birth, check, message });
	byCheck.set(check, (byCheck.get(check) ?? 0) + 1);
}

void main();
