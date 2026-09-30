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
 */

import type { CliContext } from "./args";
import { OPTION_NAMES, OPTION_ALIASES, SIDE_PREFIXES, parseArgs } from "./args";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	buildBirthInfo,
	calcTrueSolar,
	equationOfTime,
	findLongitude,
	shiftDate,
} from "./birth-info";
import { chartSignature, fmtDate } from "./render";
import {
	decadalSection,
	focusSection,
	patternSection,
	infoSection,
	yearlyBranchOf,
	yearlySection,
	overviewSection,
	parseAgesArg,
	mutagenSection,
	agePalaceOf,
	ageSection,
} from "./fortune";
import type { BirthInfo } from "@/ziwei/types";
import { generateChart } from "@/ziwei/algorithm";
import { detectPatterns } from "@/ziwei/patterns";
import { getMutagenByStem, getYearStemIndex, getMonthlyMutagen } from "@/ziwei/mutagen";
import { getTopicAnalysis, TOPIC_LABEL, type TopicKey, type AnalysisView } from "@/ziwei/analysis";
import { STEMS, BRANCHES, STAR_DESCRIPTIONS } from "@/ziwei/constants";
import { Lunar } from "lunar-typescript";
import { asserts as classicAsserts } from "@/classics/selftest-asserts";
import { asserts as synastryAsserts } from "@/synastry/selftest-asserts";
import { cmdStars } from "./stars";

/**
 * 排盘断言的固定样例盘：1990-05-15 巳时（时辰序号 5），男。
 *
 * @remarks
 * 虚构样本，无真实人物（换样本组时改这一处；各断言的期望值均按本样本盘校准）。
 */
const SAMPLE: BirthInfo = { year: 1990, month: 5, day: 15, timeIndex: 5, gender: "male" };

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
export function cmdSelftest(ctx: CliContext): string {
	/** 单条断言的结果 */
	interface Assertion {
		/** 是否通过 */
		pass: boolean;
		/** 断言名（本身即断言内容的描述，直接进报告） */
		name: string;
		/** 补充说明：通过时是断言体返回的 detail，失败时是抛出的错误信息 */
		detail: string;
	}
	const results: Assertion[] = [];
	/**
	 * 相等断言，不等即抛错。
	 *
	 * @param actual - 实得值
	 * @param expected - 期望值
	 * @param msg - 错误信息前缀，用来点明是哪一处比对失败
	 *
	 * @remarks
	 * 用 `!==` **严格相等**比较，不做深比较也不做类型转换；失败信息里用 `JSON.stringify` 展开两侧取值。
	 */
	const eq = (actual: unknown, expected: unknown, msg = "") => {
		if (actual !== expected)
			throw new Error(
				`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`
			);
	};
	/**
	 * 跑一条断言并登记结果。
	 *
	 * @param name - 断言名，直接进报告
	 * @param fn - 断言体：抛错即判失败；返回值若非空则作为该项的补充说明
	 *
	 * @remarks
	 * 断言体里的 `eq` 失败会抛错，异常在此被捕获并记为该条失败 —— 一条失败不影响其余断言继续跑。
	 */
	const ok = (name: string, fn: () => unknown) => {
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};

	/** 排盘不变量与三合派约束断言共用的样本盘（模块级 SAMPLE 的别名，见其注释） */
	const sample = SAMPLE;
	const sol = (y: number, m: number, d: number) => `${y}-${m}-${d}`;

	// ── 1. 农历 → 公历换算 ──
	ok("农历换算：1990年四月廿一 = 公历 1990-05-15", () => {
		const s = Lunar.fromYmd(1990, 4, 21).getSolar();
		eq(sol(s.getYear(), s.getMonth(), s.getDay()), "1990-5-15");
	});
	ok("农历换算：闰月用负数月份（2020年闰四月初一 = 2020-05-23）", () => {
		const s = Lunar.fromYmd(2020, -4, 1).getSolar();
		eq(sol(s.getYear(), s.getMonth(), s.getDay()), "2020-5-23");
	});
	ok("农历输入：--lunar 路径与 --date 路径产出同一命盘", () => {
		const viaLunar = buildBirthInfo(
			parseArgs(["--lunar", "1990-04-21", "--branch", "0", "--gender", "male"])
		);
		const viaSolar = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--branch", "0", "--gender", "male"])
		);
		eq(fmtDate(viaLunar.info), fmtDate(viaSolar.info));
		eq(
			chartSignature(generateChart(viaLunar.info)),
			chartSignature(generateChart(viaSolar.info))
		);
	});
	ok("农历输入：不存在的闰月必须报错（2021 年无闰四月）", () => {
		let msg: string | null = null;
		try {
			buildBirthInfo(
				parseArgs(["--lunar", "2021-04-01", "--leap", "--branch", "0", "--gender", "male"])
			);
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg) throw new Error("2021 年闰四月不存在，却未报错（静默滚动会让整盘皆错）");
		if (!msg.includes("闰")) throw new Error(`错误信息未点明闰月问题：${msg}`);
		return msg.split("。")[0];
	});
	ok("农历输入：合法的闰月可正常换算（2020 年闰四月初一）", () => {
		const b = buildBirthInfo(
			parseArgs(["--lunar", "2020-04-01", "--leap", "--branch", "0", "--gender", "male"])
		);
		eq(fmtDate(b.info), "2020-05-23");
	});
	ok("农历输入：闰月与非闰月是不同日期", () => {
		const leap = buildBirthInfo(
			parseArgs(["--lunar", "2020-04-01", "--leap", "--branch", "0", "--gender", "male"])
		);
		const plain = buildBirthInfo(
			parseArgs(["--lunar", "2020-04-01", "--branch", "0", "--gender", "male"])
		);
		if (fmtDate(leap.info) === fmtDate(plain.info))
			throw new Error("闰四月与四月被算成了同一天");
	});

	// ── 2. 真太阳时 ──
	ok("真太阳时：东经 120° 不校正，09:30 → 巳时(5)", () => {
		const t = calcTrueSolar(9, 30, 120);
		eq(t.branch, 5);
		eq(t.isLateZi, false);
		eq(t.offsetMinutes, 0);
	});
	ok("真太阳时：00:30 → 子时(0) 且非晚子时", () => {
		const t = calcTrueSolar(0, 30, 120);
		eq(t.branch, 0);
		eq(t.isLateZi, false);
	});
	ok("真太阳时：23:40 → 子时(0) 且标记晚子时", () => {
		const t = calcTrueSolar(23, 40, 120);
		eq(t.branch, 0);
		eq(t.isLateZi, true);
	});
	ok("真太阳时：经度偏移按 (lng-120)*4 分钟计（石家庄 = -22 分）", () => {
		const lx = findLongitude("石家庄");
		if (!lx) throw new Error("城市表查不到石家庄");
		const t = calcTrueSolar(12, 0, lx.longitude);
		eq(t.offsetMinutes, Math.round((lx.longitude - 120) * 4));
		if (t.offsetMinutes >= 0)
			throw new Error(`石家庄经度应小于 120，实得 offset=${t.offsetMinutes}`);
	});
	ok("真太阳时：默认口径只含经度项，不计均时差（--eot 关闭）", () => {
		// 若默认误开均时差，这里就会多出几十分钟的偏差。锁住「默认 = 传统口径」这一承诺。
		const t = calcTrueSolar(12, 0, 116.4);
		eq(t.eotMinutes, 0);
		eq(t.offsetMinutes, t.longitudeMinutes);
		eq(t.offsetMinutes, Math.round((116.4 - 120) * 4));
	});
	ok("真太阳时：--eot 开启时总校正 = 经度项 + 均时差", () => {
		const t = calcTrueSolar(12, 0, 116.4, { eot: true, year: 1990, month: 5, day: 15 });
		eq(t.longitudeMinutes, Math.round((116.4 - 120) * 4));
		eq(t.offsetMinutes, t.longitudeMinutes + t.eotMinutes);
		if (t.eotMinutes === 0) throw new Error("1990-05-15 的均时差不应为 0");
		// 均时差与经度无关：标准经线上经度项为 0，开了 --eot 照样有校正
		const onMeridian = calcTrueSolar(12, 0, 120, { eot: true, year: 1990, month: 5, day: 15 });
		eq(onMeridian.longitudeMinutes, 0);
		eq(onMeridian.offsetMinutes, onMeridian.eotMinutes);
	});
	ok("真太阳时：开启 eot 却缺 month / day 必须报错（不得静默产出 NaN）", () => {
		let msg: string | null = null;
		try {
			calcTrueSolar(12, 0, 116.4, { eot: true, year: 1990 });
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg)
			throw new Error(
				"缺 month/day 时未报错 —— NaN 会静默污染 branch / dayOffset 整条结果链"
			);
		return msg;
	});
	ok("真太阳时：均时差全年幅度落在 -15 ~ +17 分（实测 -14.6 ~ +16.5）", () => {
		// 区间同时卡住上下界：公式被改坏（符号反了、系数错了）都会掉出这个窗口
		let lo = Infinity,
			hi = -Infinity;
		for (let d = 0; d < 365; d++) {
			const dt = new Date(Date.UTC(1990, 0, 1) + d * 86400000);
			const v = equationOfTime(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		if (lo < -15 || lo > -14) throw new Error(`均时差下界异常：${lo.toFixed(1)} 分`);
		if (hi < 16 || hi > 17) throw new Error(`均时差上界异常：${hi.toFixed(1)} 分`);
	});
	ok("真太阳时：西部凌晨校正后跨天回退（喀什 00:30 → 前一日 21:38 亥时）", () => {
		// 喀什 75.99°E：经度项 (75.99-120)*4 = -176.04 分 + 均时差 +3.749 → 30-176.04+3.749 = -142.291
		// 未取整判定 dayOffset = floor(-142.291/1440) = -1；加回一天得 1297.709 → 显示 21:38
		const t = calcTrueSolar(0, 30, 75.99, { eot: true, year: 1990, month: 5, day: 15 });
		eq(t.dayOffset, -1, "跨天方向");
		eq(t.branch, 11, "亥时");
		eq(t.isLateZi, false, "21:38 不是晚子时");
		eq(t.solarMinutes, 1298, "前一日 21:38");
	});
	ok("真太阳时：东部深夜校正后跨天前进（哈尔滨 23:30 → 次日 00:00 子时）", () => {
		// 哈尔滨 126.6°E：经度项 +26.4 分 + 均时差约 +3.75 → 23:30 推到次日 00:00.1
		const t = calcTrueSolar(23, 30, 126.6, { eot: true, year: 1990, month: 5, day: 15 });
		eq(t.dayOffset, 1, "跨天方向");
		eq(t.branch, 0, "子时");
		eq(t.isLateZi, false, "校正后已过午夜，不再是晚子时");
	});
	ok("真太阳时：不跨天时 dayOffset 恒为 0（含东经 120° 与夏时制无关的边界）", () => {
		eq(calcTrueSolar(12, 0, 120).dayOffset, 0, "标准经线正午");
		eq(calcTrueSolar(0, 30, 120).dayOffset, 0, "标准经线凌晨");
		eq(calcTrueSolar(23, 30, 120).dayOffset, 0, "标准经线深夜");
		// 北京 116.4°E 经度项仅 -14.4 分：只有 00:00–00:29 的窗口会回退，正午不会
		eq(
			calcTrueSolar(12, 0, 116.4, { eot: true, year: 1990, month: 5, day: 15 }).dayOffset,
			0,
			"北京正午"
		);
	});
	ok("真太阳时：dayOffset 与 shiftDate 合起来指回出生时刻（自洽性）", () => {
		// 不变量：校正后时刻 = 钟表时刻 + 校正量，跨天成日只改变日期标签，不改变连续时间轴上的位置
		for (const [h, m, lng] of [
			[0, 30, 75.99],
			[23, 30, 126.6],
			[2, 30, 75.99],
			[12, 0, 120],
		]) {
			const t = calcTrueSolar(h, m, lng, { eot: true, year: 1990, month: 5, day: 15 });
			const shifted = shiftDate(1990, 5, 15, t.dayOffset);
			// 用未取整的校正量还原：shifted 日期的 t.solarMinutes 应等于钟表时刻 + 校正
			const clockMins = h * 60 + m;
			const corridor = t.longitudeMinutes + t.eotMinutes;
			const total = clockMins + corridor;
			const back = t.dayOffset * 1440 + t.solarMinutes;
			if (Math.abs(back - total) > 1.5)
				throw new Error(
					`${h}:${m} @${lng} → dayOffset=${t.dayOffset} solar=${t.solarMinutes}，还原得 ${back}，应为 ${total}`
				);
			// 日期确实跟着动了
			const expectDay = t.dayOffset === 0 ? 15 : t.dayOffset > 0 ? 16 : 14;
			eq(shifted.day, expectDay, `${h}:${m} @${lng} 的日期`);
		}
	});

	// ── 3. 晚子时等价性（本技能最易错处）──
	ok("晚子时：timeIndex 12 ≡ 次日 timeIndex 0（命盘完全一致）", () => {
		const late = generateChart({
			year: 1990,
			month: 5,
			day: 15,
			timeIndex: 12,
			gender: "male",
		});
		const nextEarly = generateChart({
			year: 1990,
			month: 5,
			day: 16,
			timeIndex: 0,
			gender: "male",
		});
		eq(chartSignature(late), chartSignature(nextEarly), "晚子时与次日早子时");
	});
	ok("晚子时：与当日早子时是两张不同的盘", () => {
		const early = generateChart({
			year: 1990,
			month: 5,
			day: 15,
			timeIndex: 0,
			gender: "male",
		});
		const late = generateChart({
			year: 1990,
			month: 5,
			day: 15,
			timeIndex: 12,
			gender: "male",
		});
		if (chartSignature(early) === chartSignature(late))
			throw new Error("两口径产出相同命盘，与「差异极大」的预期不符");
	});
	ok("晚子时：--branch 12 与 --late-zi 两条路径等价", () => {
		const viaBranch = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--branch", "12", "--gender", "male"])
		);
		const viaFlag = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--time", "23:40", "--late-zi", "--gender", "male"])
		);
		eq(viaBranch.info.timeIndex, 12);
		eq(viaFlag.info.timeIndex, 12);
		eq(
			chartSignature(generateChart(viaBranch.info)),
			chartSignature(generateChart(viaFlag.info))
		);
	});
	ok("晚子时：--time 23:40 默认走早子时口径并打上候选标记", () => {
		const b = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--time", "23:40", "--gender", "male"])
		);
		eq(b.info.timeIndex, 0);
		eq(b.lateZiCandidate, true);
		eq(b.isLateZi, false);
	});
	ok("时辰：--branch 13 应被拒绝", () => {
		let threw = false;
		try {
			buildBirthInfo(
				parseArgs(["--date", "1990-05-15", "--branch", "13", "--gender", "male"])
			);
		} catch {
			threw = true;
		}
		eq(threw, true, "--branch 13 ");
	});

	// ── 4. 城市容错 ──
	ok("城市容错：石家庄 / 石家庄市 / 河北省石家庄市 解析一致", () => {
		const a = findLongitude("石家庄"),
			b = findLongitude("石家庄市"),
			c = findLongitude("河北省石家庄市");
		if (!a || !b || !c) throw new Error("存在未解析的写法");
		eq(a.longitude, b.longitude, "石家庄 vs 石家庄市 ");
		eq(a.longitude, c.longitude, "石家庄 vs 河北省石家庄市 ");
	});
	ok("城市容错：未收录城市返回 null（不误匹配）", () => {
		eq(findLongitude("不存在的城市XYZ"), null);
		eq(findLongitude(""), null);
	});
	ok("城市容错：--city 石家庄市 能正常起盘", () => {
		const b = buildBirthInfo(
			parseArgs([
				"--date",
				"1990-05-15",
				"--time",
				"09:30",
				"--city",
				"石家庄市",
				"--gender",
				"male",
			])
		);
		if (!Number.isFinite(b.info.longitude)) throw new Error("经度未解析");
		eq(chartSignature(generateChart(b.info)).length > 0, true);
	});
	ok("城市容错：精确命中不提示，容错命中才提示（exact 标志）", () => {
		const exactHit = findLongitude("石家庄"),
			suffixHit = findLongitude("石家庄市");
		if (!exactHit || !suffixHit) throw new Error("城市表查不到石家庄 / 石家庄市");
		eq(exactHit.exact, true, "原名 "); // 表里就是「石家庄」，无需提示
		eq(suffixHit.exact, false, "带后缀 "); // 做了容错，需提示
		const exact = buildBirthInfo(
			parseArgs([
				"--date",
				"1990-05-15",
				"--branch",
				"0",
				"--city",
				"石家庄",
				"--gender",
				"male",
			])
		);
		const fuzzy = buildBirthInfo(
			parseArgs([
				"--date",
				"1990-05-15",
				"--branch",
				"0",
				"--city",
				"石家庄市",
				"--gender",
				"male",
			])
		);
		eq(exact.lngNote, "", "精确命中的 lngNote ");
		if (!fuzzy.lngNote) throw new Error("容错命中应给出 lngNote");
		return fuzzy.lngNote;
	});
	ok("出生地：未给地点时必须提示「按 120° 处理、未做校正」", () => {
		const b = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--branch", "0", "--gender", "male"])
		);
		eq(b.info.longitude, 120);
		if (!b.lngNote || !b.lngNote.includes("120"))
			throw new Error(`未给地点时 lngNote 应提醒，实得：${JSON.stringify(b.lngNote)}`);
		return b.lngNote;
	});

	// ── 4.5 性别护栏 ──
	// 性别决定大限顺逆：同一张盘男女的大限可差 80 年（26-35岁 ↔ 106-115岁）。
	// 缺失或非法若被静默兜底成 male，用户拿到的是一张没有任何异常信号的错盘，
	// 故按「宁可启动失败，也不静默产出错盘」处理：一律报错。
	ok("性别：缺少 --gender 必须报错（不得静默默认 male）", () => {
		let msg: string | null = null;
		try {
			buildBirthInfo(parseArgs(["--date", "1990-05-15", "--branch", "0"]));
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg) throw new Error("缺 --gender 时未报错");
		if (!msg.includes("--gender")) throw new Error(`报错文案应含 --gender，实得：${msg}`);
		return msg;
	});
	ok("性别：非法取值必须报错（不得静默落到 male）", () => {
		let threw = false;
		try {
			buildBirthInfo(parseArgs(["--date", "1990-05-15", "--branch", "0", "--gender", "xyz"]));
		} catch {
			threw = true;
		}
		eq(threw, true, "非法 --gender ");
	});
	ok("性别：别名等价（女 ≡ female，男 ≡ male）", () => {
		const g = (v: string) =>
			buildBirthInfo(parseArgs(["--date", "1990-05-15", "--branch", "0", "--gender", v])).info
				.gender;
		eq(g("女"), "female", "女 ");
		eq(g("female"), "female", "female ");
		eq(g("f"), "female", "f ");
		eq(g("男"), "male", "男 ");
		eq(g("male"), "male", "male ");
		eq(g("m"), "male", "m ");
	});
	// ⚠️ 这里原有「性别：heming 缺 --a-gender 时文案应指向 --a-gender」一条，已随合盘命令
	//    搬去 `purplestar-synastry` 的 selftest —— 本 skill 既无 `synastry` 命令，也不认
	//    `a-` / `b-` 前缀（`--a-chart` 在这里是**未知参数**，直接报错），那条文案护栏
	//    在本 skill 里没有可复现的入口。

	// ── 5. 排盘不变量 ──
	ok("排盘不变量：十二宫齐全 / 地支不重复 / 命宫唯一 / 五行局合法", () => {
		const c = generateChart(sample);
		eq(c.palaces.length, 12, "宫位数 ");
		eq(new Set(c.palaces.map(p => p.branch)).size, 12, "地支去重后 ");
		eq(c.palaces.filter(p => p.isSoulPalace).length, 1, "命宫数 ");
		if (![2, 3, 4, 5, 6].includes(c.fiveElementsClass)) throw new Error(`五行局异常：${c.fiveElementsClass}`);
		if (c.ziweiPos < 0 || c.ziweiPos > 11) throw new Error(`紫微位异常：${c.ziweiPos}`);
		if (c.decadals.length !== 12) throw new Error(`大限数异常：${c.decadals.length}`);
	});
	ok("排盘不变量：空宫均带借宫字段", () => {
		const c = generateChart(sample);
		for (const p of c.palaces.filter(x => x.isEmpty)) {
			if (p.borrowedFromName === undefined || p.borrowedStars === undefined) {
				throw new Error(`空宫 ${p.name} 缺 borrowedFromName / borrowedStars`);
			}
		}
	});

	// ── 5.5 运限数据面（小限 / 命主 / 身主 / 斗君）──
	ok("排盘不变量：随机样本自洽（伪随机 20 盘：十二宫 / ages 覆盖 / 斗君 / 星曜分类）", () => {
		// 随机性进测试覆盖、不进期望值（spec §3.4）：线性同余取**确定性伪随机**——
		// 「随机」的样本覆盖是可复现的，任何一次运行都不依赖真随机性。
		let seed = 20260930;
		const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
		for (let i = 0; i < 20; i++) {
			const year = 1950 + Math.floor(rnd() * 60),
				month = 1 + Math.floor(rnd() * 12),
				day = 1 + Math.floor(rnd() * 28);
			const c = generateChart({
				year,
				month,
				day,
				timeIndex: Math.floor(rnd() * 13),
				gender: rnd() > 0.5 ? "male" : "female",
			});
			if (c.palaces.length !== 12 || new Set(c.palaces.map(p => p.branch)).size !== 12)
				throw new Error(`${year}-${month}-${day} 十二宫不自洽`);
			const ages = [...new Set(c.palaces.flatMap(p => p.ages ?? []))].sort(
				(a, b) => a - b
			);
			if (ages.length !== 120 || ages[0] !== 1 || ages[119] !== 120)
				throw new Error(`${year}-${month}-${day} ages 覆盖不自洽`);
			if (c.douJunBranch < 0 || c.douJunBranch > 11) throw new Error("斗君越界");
			if (
				c.palaces.some(p =>
					p.stars.some(st => !["major", "minor", "soft", "tough"].includes(st.type))
				)
			)
				throw new Error("星曜类型值不自洽");
		}
		return "20 个伪随机盘全部自洽";
	});

	ok("术语对齐：iztro 字段名生效（fiveElementsClass / soulBranch / ages / mutagen）", () => {
		// 2026-09-30 术语五层对齐（spec §2.9）：类型值 lucky/sha→soft/tough、SiHua→Mutagen、
		// DaXian→Decadal；内核字段 wuxingJu→fiveElementsClass、mingGongBranch→soulBranch、
		// shenGongBranch→bodyBranch、xiaoXianAges→ages、isMingGong→isSoulPalace 等。
		const c = generateChart(SAMPLE);
		if (!("fiveElementsClass" in c) || !("soulBranch" in c) || !("bodyBranch" in c))
			throw new Error("chart 字段未对齐 iztro");
		const p = c.palaces.find(x => x.isSoulPalace);
		if (!p) throw new Error("isSoulPalace 不存在");
		// ⚠️ 探针拆串（"lu"+"cky"）：防止后续批量改名 sed 把断言探针连同实现一起替换，
		//    那会让这条断言变成恒真（Task 3 实测踩过）。
		const oldLucky = "lu" + "cky";
		const oldSha = "s" + "ha";
		if (c.palaces.some(x => x.stars.some(s => s.type === oldLucky || s.type === oldSha)))
			throw new Error("Star.type 仍有 lucky/sha 残留");
		if (c.palaces.some(x => x.stars.some(s => s.type === "soft" || s.type === "tough")) === false)
			throw new Error("soft/tough 未出现");
		return "字段/类型值对齐";
	});

	ok("运限数据：小限岁数表 1–120 连续、每宫恰 10 个（iztro ages 提取）", () => {
		const c = generateChart(sample);
		const all = c.palaces.flatMap(p => p.ages ?? []);
		const uniq = [...new Set(all)].sort((x, y) => x - y);
		eq(uniq.length, 120, "岁数去重后 ");
		for (let i = 0; i < 120; i++)
			if (uniq[i] !== i + 1)
				throw new Error(`岁数表不连续：第 ${i} 位是 ${uniq[i]}，应为 ${i + 1}`);
		for (const p of c.palaces)
			if ((p.ages ?? []).length !== 10)
				throw new Error(
					`${p.name} 的小限岁数不是 10 个：${(p.ages ?? []).join(",")}`
				);
		// 校准锚点：1990 样例命宫(子)的小限自虚岁 9 起
		const ming = c.palaces.find(p => p.isSoulPalace);
		if (!ming) throw new Error("找不到命宫");
		eq(ming.ages?.[0], 9, "命宫首岁 ");
	});
	ok("运限数据：命主 / 身主随盘输出（iztro soul / body）", () => {
		const c = generateChart(sample);
		eq(c.mingZhu, "贪狼", "1990 样例命主 ");
		eq(c.shenZhu, "火星", "1990 样例身主 ");
		// 外部参照样例（文墨天机排盘输出）：2000-4-6 子时男 = 命主廉贞 / 身主文昌
		const d = generateChart({ year: 2000, month: 4, day: 6, timeIndex: 0, gender: "male" });
		eq(d.mingZhu, "廉贞", "2000 样例命主 ");
		eq(d.shenZhu, "文昌", "2000 样例身主 ");
	});
	ok("运限数据：斗君 = 子起正月逆数生月，生月宫起子时顺数生时", () => {
		// 外部参照样例：2000-4-6 子时男，农历三月 → 子起正月逆数三月 = 戌，戌起子时至子时 = 戌
		const d = generateChart({ year: 2000, month: 4, day: 6, timeIndex: 0, gender: "male" });
		eq(BRANCHES[d.douJunBranch], "戌", "2000 样例斗君 ");
		// 1990-05-15 巳时男，农历四月 → 子起正月逆数四月 = 酉，酉起子时顺数至巳时 = 寅
		const c = generateChart(sample);
		eq(BRANCHES[c.douJunBranch], "寅", "1990 样例斗君 ");
	});

	// ── 6. 三合派硬约束守护（防止飞星派逻辑回流）──
	ok("三合派约束：宫干自化未被填充", () => {
		const c = generateChart(sample);
		const dirty = c.palaces.filter(p => p.selfMutagen);
		if (dirty.length)
			throw new Error(
				`检测到 selfMutagen 被填充：${dirty.map(p => p.name).join("、")}（飞星派逻辑疑似回流）`
			);
	});
	ok("三合派约束：大限未携带宫干四化字段", () => {
		const c = generateChart(sample);
		const dirty = c.decadals.filter(
			d => d.mutagen !== undefined || d.stemIndex !== undefined || d.stemName !== undefined
		);
		if (dirty.length)
			throw new Error(
				`检测到大限携带四化/宫干字段：${dirty.length} 条（飞星派逻辑疑似回流）`
			);
	});

	// ── 7. 格局与四化 ──
	ok("格局识别：返回数组且每条含 name / level", () => {
		const ps = detectPatterns(generateChart(sample));
		if (!Array.isArray(ps)) throw new Error("detectPatterns 未返回数组");
		for (const p of ps)
			if (!p.name || !p.level)
				throw new Error(`格局条目缺字段：${JSON.stringify(p).slice(0, 80)}`);
		return `样本盘识别到 ${ps.length} 个格局`;
	});
	ok("四化：甲干 = 廉贞禄 / 破军权 / 武曲科 / 太阳忌", () => {
		const t = getMutagenByStem(0);
		eq(`${t.禄}${t.权}${t.科}${t.忌}`, "廉贞破军武曲太阳");
	});
	ok("四化：流年干索引按 (year-4)%10 计（1990 → 庚 = 6，仅流年用）", () => {
		// 注意：这是**公历年取模**口径，只服务流年四化（用户问「2026 年运势」即指公历
		// 年份对应的干支年）。生年四化必须用 chart.lunarInfo.yearStem（农历年干），
		// 两口径在 1-2 月出生者身上分叉 —— 见下方「与盘面 mutagen 一致」断言。
		eq(getYearStemIndex(1990), 6);
		eq(STEMS[getYearStemIndex(1990)], "庚");
	});
	ok("四化：生年四化取农历年干，与盘面 mutagen 逐颗一致（跨年月样本）", () => {
		// 1990-01-15 农历仍在己巳年（腊月），公历取模却是庚 —— 专挑两口径分叉的样本。
		// iztro 落在 Star.mutagen 上的 mutagen 按农历年干标注，是生年四化的金标准；
		// lunarInfo.yearStem 若与它分叉，CLI 的【生年四化】区块就会与宫详表自相矛盾。
		const c = generateChart({ year: 1990, month: 1, day: 15, timeIndex: 5, gender: "male" });
		eq(c.lunarInfo.yearStem, 5, "农历年干应为己（索引 5）");
		const tf = getMutagenByStem(c.lunarInfo.yearStem);
		const byStem = (["禄", "权", "科", "忌"] as const).map(h => `${h}:${tf[h]}`).sort();
		const onChart = c.palaces
			.flatMap(p => p.stars)
			.filter(s => s.mutagen)
			.map(s => `${s.mutagen}:${s.name}`)
			.sort();
		eq(onChart.join("、"), byStem.join("、"), "盘面 mutagen 与农历年干四化");
	});
	ok("流月：五虎遁 甲年正月 = 丙寅", () => {
		eq(getMonthlyMutagen(0, 1).stemName, "丙");
		eq(getMonthlyMutagen(1, 1).stemName, "戊", "乙年正月 ");
	});

	// ── 8. 知识源可用性 ──
	//
	ok("知识源：星曜释义覆盖十四主星", () => {
		const majorStars = [
			"紫微",
			"天机",
			"太阳",
			"武曲",
			"天同",
			"廉贞",
			"天府",
			"太阴",
			"贪狼",
			"巨门",
			"天相",
			"天梁",
			"七杀",
			"破军",
		];
		const miss = majorStars.filter(s => !STAR_DESCRIPTIONS[s]);
		if (miss.length) throw new Error(`缺失释义：${miss.join("、")}`);
		eq(Object.keys(STAR_DESCRIPTIONS).length, 14, "星曜释义条数 ");
	});
	ok("知识源：主题论断库 13 主题均可产出（样本盘，非空且宫名不失配）", () => {
		// TOPIC_PALACE_NAME 已适配项目宫名口径（「交友宫」而非 iztro 旧口径「仆役」）；
		// 若口径漂移，getTopicAnalysis 会静默落到「无法找到 xx」的兜底文案 —— 这条断言盯着它
		const c = generateChart(sample);
		const bad = (Object.keys(TOPIC_LABEL) as TopicKey[]).filter(k => {
			const t = getTopicAnalysis(c, k);
			return t.length < 100 || t.includes("无法找到");
		});
		if (bad.length) throw new Error(`以下主题产出异常：${bad.join("、")}`);
		return "13 主题全部产出";
	});
	ok("论断：四种 view（mingpan/daxian/liunian/liuyue）均可产出", () => {
		const c = generateChart(sample);
		for (const v of ["mingpan", "daxian", "liunian", "liuyue"] as AnalysisView[]) {
			const t = getTopicAnalysis(c, "wealth", { view: v, liunianYear: 2027, liuyueMonth: 6 });
			if (t.length < 100) throw new Error(`view=${v} 产出过短：${t.length} 字`);
		}
		return "mingpan / daxian / liunian / liuyue";
	});
	ok("引导层豁免有界：boot-hooks.ts 只依赖 node: 内置", () => {
		// scripts/boot-hooks.ts 是引导层**唯一**被允许静态 import 的非 node: 模块。
		// 「引导层不得出现普通静态 import」那条规则的实质是「禁止在钩子注册前触发 .ts 解析」，
		// 而 boot-hooks.ts 只依赖 node: 内置、调用点又写全了 .ts 扩展名，故由 Node 原生
		// 类型擦除加载，不触碰钩子 —— 这份豁免正是靠这一点成立。
		//
		// ⚠️ 越界有两种形态，只有一种会自己喊出来（两种都实测过）：
		//   · 省略扩展名（`import … from "./ziwei/constants"`）→ 钩子尚未注册，CLI 当场崩
		//     ERR_MODULE_NOT_FOUND。吵，但不危险 —— 不需要本断言。
		//   · 写全扩展名（`import … from "./ziwei/constants.ts"`）→ **照常跑通**，
		//     因为那个文件恰好没有自己的依赖。实测此时 48/49：除本断言外全绿。
		//     这是颗哑雷 —— 哪天该文件多一个 `@/` 或省略扩展名的 import，引导层就会在
		//     钩子注册前崩掉，而崩因指向的是一次看似无关的改动。
		// 本断言守的是后一种。
		const src = readFileSync(resolve(ctx.root, "boot-hooks.ts"), "utf8");
		const specs = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(
			m => m[1]
		);
		// 先确认真的扫到了东西：正则写歪或文件被改名都会得到空数组，那样的「零违规」是假绿。
		if (!specs.length)
			throw new Error("未扫到任何 import —— 正则或 boot-hooks.ts 的路径可能已失效");
		const bad = specs.filter(s => !s.startsWith("node:"));
		if (bad.length) {
			throw new Error(
				`boot-hooks.ts 不得依赖非 node: 模块（它要在解析钩子注册**之前**被加载），实得：${bad.join("、")}`
			);
		}
		return `${specs.length} 条 import 全为 node: 内置`;
	});

	ok("解析引擎：util.parseArgs tokens 底座——贪婪取值 / 等号式 / -- 分隔", () => {
		// 2026-09-30 引擎重写（spec §2.8）：cac 退役，底座换 Node 内置 util.parseArgs（tokens 模式）。
		// ⚠️ 贪婪取值是**版本敏感**行为（Node ≥ 22.15 实测贪婪；早期 18.x 会把负数当短选项），
		//    本断言钉死——Node 行为若回退立即变红。
		const a = parseArgs(["--limit", "-3"], "classics");
		eq(a.limit, "-3", "--limit -3 的值 ");
		eq(parseArgs(["--focus=财帛"], "astrology").focus, "财帛", "等号式 ");
		eq(parseArgs(["--", "-x", "y"], "astrology")._.join(","), "-x,y", "-- 之后全位置 ");
	});
	ok("解析引擎：重复参数与主别名同现必须报错", () => {
		// 旧引擎（cac）对重复参数取末值——静默择一。新契约：显式报错（宁可报错不静默）。
		for (const argv of [["--geju", "--geju"], ["--geju", "--pattern"]]) {
			let msg = "";
			try {
				parseArgs(argv, "astrology");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) throw new Error(`${argv.join(" ")} 未报错——重复参数应报错（旧「取末值」废止）`);
		}
	});
	ok("解析引擎：拼音别名归一到英文主名", () => {
		eq(parseArgs(["--geju"], "astrology").pattern, true, "--geju → pattern ");
		eq(parseArgs(["--sihua"], "astrology").mutagen, true, "--sihua → mutagen ");
		eq(parseArgs(["--liunian", "2027"], "astrology").yearly, "2027", "--liunian → yearly ");
	});
	ok("解析引擎：--year/--month/--day 三连已删，未知参数中文报错", () => {
		// 三连由 --date 完全覆盖（spec §1.2），删除后误敲 --year 由拼错建议引向 --yearly（距离 2）。
		let msg = "";
		try {
			parseArgs(["--year", "1990"], "astrology");
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg.includes("未知参数") || !msg.includes("--yearly"))
			throw new Error(`应报未知参数并建议 --yearly，实得：${msg}`);
	});
	ok("出生信息：位置参数形态归类（日期/时刻/性别/城市），与旗标形态同盘", () => {
		// 零参数快捷形态：astrology 1990-5-15 9:30 男 北京 —— 按形态归类、顺序无关。
		const pos = buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "北京"], "astrology"));
		const flg = buildBirthInfo(
			parseArgs(
				["--date", "1990-05-15", "--time", "09:30", "--gender", "male", "--city", "北京"],
				"astrology"
			)
		);
		eq(
			chartSignature(generateChart(pos.info)),
			chartSignature(generateChart(flg.info)),
			"位置参数与旗标 "
		);
		let dup = "";
		try {
			parseArgs(["1990-5-15", "1991-6-1"], "astrology");
		} catch (e) {
			dup = (e as Error).message;
		}
		if (!dup) throw new Error("两个日期 token 未报错");
		let badCity = "";
		try {
			buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "不存在的城市XYZ"], "astrology"));
		} catch (e) {
			badCity = (e as Error).message;
		}
		if (!badCity) throw new Error("未知城市 token 未报错（不得静默落 120°E）");
	});
	ok("出生信息：城市 token 三条边界（省市连写 / 裸省名按省会 / 带空格报错）", () => {
		const cn = buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "山东青岛"], "astrology"));
		eq(cn.info.longitude, 120.4, "山东青岛连写 ");
		const nmg = buildBirthInfo(
			parseArgs(["1990-5-15", "9:30", "男", "内蒙古鄂尔多斯"], "astrology")
		);
		eq(nmg.info.longitude, 109.8, "内蒙古鄂尔多斯连写 ");
		const prov = buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "山东"], "astrology"));
		eq(prov.info.longitude, 117, "裸省名按省会（济南）"); // 与 --province 山东 同值
		let spaced = "";
		try {
			buildBirthInfo(parseArgs(["1990-5-15", "9:30", "男", "山东", "青岛"], "astrology"));
		} catch (e) {
			spaced = (e as Error).message;
		}
		if (!spaced || !spaced.includes("连写"))
			throw new Error(`省+市带空格应报错并提示连写，实得：${spaced}`);
	});

	ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 拼错旗标以前是**静默**的：parseArgs 任何 `--xxx` 都照单全收，buildBirthInfo
		// 读不到就落回默认值 —— `--ctiy 喀什` 排出的是一张经度按默认 120°E 算的盘
		// （错约 176 分钟 ≈ 3 个时辰），全程零提示。这类静默错盘正是本项目
		// REQUIRED_EXPORTS 与 projectPalaceName 都在防的东西。
		//
		// 本断言锁的是**行为**（未知旗标必须抛错）而非文案 —— 文案可以改，
		// 但一旦有人把 parseArgs 的校验摘掉，静默错盘就会原样回来，而别的断言全绿。
		const probes: Array<[string, string]> = [
			["--ctiy", "city"], // 换位
			["--gendr", "gender"], // 漏字
			["--lunnar", "lunar"], // 多字
		];
		for (const [bad, want] of probes) {
			let msg = "";
			try {
				parseArgs([bad, "x"], "analyze");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) throw new Error(`${bad} 未报错 —— 未知旗标又变成静默忽略了`);
			if (!msg.includes(`--${want}`))
				throw new Error(`${bad} 的提示应指向 --${want}，实得：${msg}`);
		}
		// 作用域收窄探针：**本 skill 不认**的旗标必须报错，而不是静默收下。
		// 合并后 `--limit`（classics）与 `--chart`（synastry 的 --a-chart/--b-chart 裸底名）
		// 都进了本 skill 作用域，故收窄探针只剩**出生方前缀**这一维：`a-` / `b-` 前缀
		// 只有 synastry 命令认，叠在 analyze 上必须报「前缀只有 synastry 命令认」。
		//
		// ⚠️ 少了这一条，哪天有人把 args.ts 的前缀收窄摘掉，`analyze --a-chart x` 会静默
		// 通过 —— 而没有任何断言变红。
		const outOfScope: Array<[string, string]> = [
			// 合盘的命盘前缀（真实存在、只是归 synastry 命令）：探针必须挑这种「存在但错位」
			// 的旗标，不存在的旗标与上面那组拼写错误探针重叠。
			["--a-chart", "/tmp/a.json"],
			["--b-chart", "/tmp/b.json"],
		];
		for (const [flag, value] of outOfScope) {
			let msg = "";
			try {
				parseArgs([flag, value], "analyze");
			} catch (e) {
				msg = (e as Error).message;
			}
			if (!msg) throw new Error(`${flag} 在 analyze 上未报错 —— 旗标作用域收窄失效`);
		}
		return `${probes.length} 个拼写错误均被拦下，${outOfScope.length} 个作用域外旗标被拒`;
	});

	ok("参数面：专题参数族（info/pattern/mutagen/decadal/ages）均可解析", () => {
		// 专题参数族：每个参数对应一个输出专题，加了就只出该专题的详版（英文名主名，
		// 拼音别名见 OPTION_ALIASES）。switch 型裸开关给 true；decadal / ages 是可选值
		// 形态，带值给字符串、裸开关（= 默认当前虚岁）给 true。
		const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"];
		const a = parseArgs([...base, "--info", "--pattern", "--mutagen"], "analyze");
		eq(a.info, true, "--info ");
		eq(a.pattern, true, "--pattern ");
		eq(a.mutagen, true, "--mutagen ");
		const b = parseArgs([...base, "--decadal", "37"], "analyze");
		eq(b.decadal, "37", "--decadal 带值 ");
		const c = parseArgs([...base, "--decadal"], "analyze");
		eq(c.decadal, true, "--decadal 裸开关 ");
		const d = parseArgs([...base, "--ages", "45"], "analyze");
		eq(d.ages, "45", "--ages 带值 ");
		return "5 个专题参数（3 开关 + 2 可选值）";
		return "5 个专题旗标（3 开关 + 2 可选值）";
	});

	ok("运限定位：yearlyBranchOf 按公历年取年支（1990→午 / 2026→午 / 2000→辰）", () => {
		eq(BRANCHES[yearlyBranchOf(1990)], "午");
		eq(BRANCHES[yearlyBranchOf(2026)], "午");
		eq(BRANCHES[yearlyBranchOf(2000)], "辰");
	});
	ok("运限定位：agePalaceOf 找到该虚岁的小限宫，越界必须抛错", () => {
		const c = generateChart(sample);
		const p = agePalaceOf(c, 9);
		eq(p.name, "命宫", "1990 盘 9 岁 ");
		eq(BRANCHES[p.branch], "子", "命宫地支 ");
		let threw = false;
		try {
			agePalaceOf(c, 121);
		} catch {
			threw = true;
		}
		eq(threw, true, "121 岁（超出 1–120）");
	});
	ok("运限定位：parseAgesArg 解析虚岁参数（字符串 / 裸开关 / 缺省 / 非法）", () => {
		eq(parseAgesArg("37", 40, "--daxian"), 37, "带值 ");
		eq(parseAgesArg(true, 40, "--daxian"), 40, "裸开关取当前虚岁 ");
		eq(parseAgesArg(undefined, 40, "--daxian"), 40, "缺省取当前虚岁 ");
		for (const bad of ["abc", "0", "-3", "121"]) {
			let threw = false;
			try {
				parseAgesArg(bad, 40, "--daxian");
			} catch {
				threw = true;
			}
			eq(threw, true, `非法值 ${bad} `);
		}
	});

	ok("专题渲染：概览节 = 运限速览一行（虚岁/大限/流年命宫/小限）+ 专题指路", () => {
		const c = generateChart(sample);
		const text = overviewSection(c, 2026).join("\n");
		if (!text.includes("【运限速览】")) throw new Error("缺【运限速览】标题");
		if (!text.includes(`虚岁 ${c.currentAge}`)) throw new Error("缺当前虚岁");
		if (!text.includes("大限")) throw new Error("缺大限速览");
		if (!text.includes("2026 丙午")) throw new Error("缺流年干支");
		if (!text.includes("流年命宫")) throw new Error("缺流年命宫");
		if (!text.includes("小限")) throw new Error("缺小限速览");
		for (const f of ["--liunian", "--daxian", "--xiaoxian", "--info", "--geju", "--sihua", "--focus"])
			if (!text.includes(f)) throw new Error(`专题指路缺 ${f}`);
	});
	ok("专题渲染：基本信息专题逐项输出（2000-4-6 子时男，对齐外部排盘参照）", () => {
		const c = generateChart({ year: 2000, month: 4, day: 6, timeIndex: 0, gender: "male" });
		const text = infoSection(c, {
			clockTime: "2000-4-6 0:15",
			solarNote: "钟表 0:15 → 真太阳时校正 -7 分 → 子时",
			longitude: 120,
		}).join("\n");
		const want = [
			"性别 : 男",
			"地理经度 : 120.000",
			"钟表时间 : 2000-4-6 0:15",
			"农历时间 : 庚辰年三月初二日子时",
			"节气四柱 : 庚辰 庚辰 甲午 甲子",
			"非节气四柱 : 庚辰 庚辰 甲午 甲子",
			"五行局数 : 金四局",
			"命盘类型 : 三合盘(天盘)",
			"命主:廉贞",
			"身主:文昌",
			"子年斗君:戌",
			"身宫:辰",
			"不做八字论命",
		];
		const miss = want.filter(w => !text.includes(w));
		if (miss.length) throw new Error(`基本信息节缺以下行：\n  ${miss.join("\n  ")}`);
		return `${want.length} 项全部在`;
	});

	ok("专题渲染：流年专题（流年命宫 / 三方四正 / 四化落点 / 与大限关系）", () => {
		const c = generateChart(sample);
		const text = yearlySection(c, 2026).join("\n");
		if (!text.includes("年柱 丙午")) throw new Error("缺流年干支");
		if (!text.includes("流年命宫")) throw new Error("缺流年命宫标注");
		// 2026 午宫 = 迁移宫；流年三方四正 = 午戌寅 + 对宫子 = 迁移/夫妻/福德/命宫
		if (!text.includes("迁移宫")) throw new Error("缺流年命宫（迁移宫）");
		if (!text.includes("夫妻宫") || !text.includes("福德宫"))
			throw new Error("缺流年三方四正（午的三合=戌寅）");
		// 流年忌廉贞落迁移宫(午) = 流年命宫本身
		if (!text.includes("化忌 廉贞")) throw new Error("缺流年四化落宫");
		if (!text.includes("大限三方四正")) throw new Error("缺与当前大限三方的对照说明");
		// 生年忌天同与流年禄天同同星同宫（子女宫酉）→ 应有引动标注
		if (!text.includes("天同")) throw new Error("缺生年×流年同星引动标注");
	});
	ok("专题渲染：大限专题（时间轴 / 三方四正 / 四化落点 / 限内逐年）", () => {
		const c = generateChart(sample);
		const text = decadalSection(c, 37).join("\n");
		if (!text.includes("36-45")) throw new Error("缺当前大限区间");
		if (!text.includes("116-125")) throw new Error("缺大限时间轴首尾（116-125）");
		// 卯限的三方四正 = 卯未亥 + 对宫酉 = 田宅/疾厄/兄弟/子女
		if (!text.includes("疾厄宫") || !text.includes("兄弟宫"))
			throw new Error("缺大限三方四正");
		// 生年化科太阴落卯（大限本宫）
		if (!text.includes("太阴")) throw new Error("缺生年四化落大限三方的标注");
		// 限内逐年表：37 岁 = 2026 丙午 流年命宫午；小限官禄宫
		if (!text.includes("37岁") || !text.includes("丙午"))
			throw new Error("缺限内逐年对照表");
		if (!text.includes("小限")) throw new Error("逐年表缺小限列");
	});
	ok("专题渲染：小限专题（小限宫 / 三方四正 / 岁数分布 / 与流年关系）", () => {
		const c = generateChart(sample);
		const text = ageSection(c, 37, 2026).join("\n");
		// 37 岁小限 = 官禄宫(辰)
		if (!text.includes("官禄宫")) throw new Error("缺小限宫（37 岁应为官禄宫）");
		if (!text.includes("三方四正")) throw new Error("缺小限三方四正");
		if (!text.includes("小限岁数")) throw new Error("缺十二宫小限岁数分布表");
		if (!text.includes("流年")) throw new Error("缺小限与流年命宫的对照");
	});
	ok("专题渲染：格局专题沿用格局识别（含成立条件与出处）", () => {
		const c = generateChart(sample);
		const text = patternSection(c).join("\n");
		if (!text.includes("【格局识别】")) throw new Error("缺【格局识别】标题");
		if (!text.includes("英星入庙格")) throw new Error("缺样例盘必有格局（英星入庙）");
		if (!text.includes("出处")) throw new Error("缺出处行");
	});
	ok("专题渲染：四化专题（生年 + 流年 + 同星引动；流月可选）", () => {
		const c = generateChart(sample);
		const text = mutagenSection(c, 2026, null).join("\n");
		if (!text.includes("【生年四化】")) throw new Error("缺生年四化节");
		if (!text.includes("化禄 太阳 → 兄弟宫")) throw new Error("缺生年化禄落宫（兄弟宫）");
		if (!text.includes("【2026 流年四化】")) throw new Error("缺流年四化节");
		if (!text.includes("天同")) throw new Error("缺生年×流年同星引动标注");
		const withMonth = mutagenSection(c, 2026, 6).join("\n");
		if (!withMonth.includes("流月四化")) throw new Error("给了农历月却缺流月四化节");
	});
	ok("专题渲染：宫盘聚焦专题（三方四正会照 / 四化落宫 / 运限引动）", () => {
		const c = generateChart(sample);
		const text = focusSection(c, "命宫", 2026).join("\n");
		if (!text.includes("【聚焦：命宫】")) throw new Error("缺聚焦标题");
		if (!text.includes("会照")) throw new Error("缺三方四正会照星曜");
		// 命宫(子)的对宫是迁移宫(午) = 2026 流年命宫 → 应有引动标注
		if (!text.includes("流年命宫")) throw new Error("缺流年引动标注");
		if (!text.includes("大限")) throw new Error("缺大限年龄段标注");
	});

	ok("参数面：SKILL.md 提到的旗标都在 args.ts 的声明表里", () => {
		// SKILL.md 是给 Claude 读的**行为规范**（见 .claude/CLAUDE.md：改它就等于改 skill
		// 的行为）。它提到的旗标若在解析层不存在，Claude 会照着敲一个被拒的参数。
		//
		// 只查「SKILL.md → 声明表」这一个方向。反向（声明表里的旗标都要写进 SKILL.md）
		// 刻意不查：SKILL.md 是使用指南不是穷举清单，`topic` 的 13 个 key、`classics` 的
		// 位置参数这类细节本就不该塞进去。
		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
		const mentioned = [...md.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]);
		// 先确认真扫到了东西：正则写歪或文件挪了位置都会得到空数组，那样的「零违规」是假绿。
		if (!mentioned.length)
			throw new Error("未从 SKILL.md 扫到任何旗标 —— 正则或路径可能已失效");
		const names = [...new Set(mentioned)];
		const unknown = names
			.map(n => {
				// 剥掉出生方前缀再查表：`--a-late-zi` 声明的是 `late-zi`。前缀表取自
				// 本 skill 的作用域（`SIDE_PREFIXES`），从声明派生，作用域变了会自动跟上。
				const p = SIDE_PREFIXES.find(pre => n.startsWith(pre));
				return p ? n.slice(p.length) : n;
			})
			// 拼音别名归一到英文主名（--geju 提到的是 --pattern 的别名，同样合法）
			.map(n => OPTION_ALIASES[n] ?? n)
			.filter(n => !OPTION_NAMES.has(n));
		if (unknown.length)
			throw new Error(
				`SKILL.md 提到但 args.ts 未声明的参数：${unknown.map(n => "--" + n).join("、")}`
			);
		return `${names.length} 种参数写法全部有声明`;
	});

	ok("命令拆分：cities 命令已删（数据表保留）；analyze → astrology 改名；stars 仍可检索", () => {
		// 2026-09-30 命令面收敛（spec §3.1）：cities 只删查询命令（ziwei/cities.ts 数据表
		// 仍是 --city 容错解析的依据，保留）；analyze 拆进 cli/astrology.ts 并改名 cmdAstrology
		// （四命令融合留 Task 6，本条只钉「拆位与改名」这个中间态）。
		const src = readFileSync(resolve(ctx.root, "cli", "commands.ts"), "utf8");
		const table = src.match(/const COMMAND_TABLE = \{([\s\S]*?)\} satisfies/)?.[1];
		if (!table) throw new Error("未从 commands.ts 抽到 COMMAND_TABLE —— 声明块形状已变");
		const defined = [...table.matchAll(/^\t+"?([a-z][a-z0-9-]*)"?:/gm)].map(m => m[1]);
		if (defined.includes("cities")) throw new Error("cities 仍在 COMMAND_TABLE —— 应删（spec §3.1）");
		if (defined.includes("analyze")) throw new Error("analyze 仍在 COMMAND_TABLE —— 应改名 astrology");
		if (!defined.includes("astrology") || !defined.includes("chart") || !defined.includes("topic"))
			throw new Error(`拆位不完整（应含 astrology/chart/topic），实得：${defined.join("、")}`);
		// cities 删除后的数据表仍在（--city 容错解析在用）
		const cities = readFileSync(resolve(ctx.root, "ziwei", "cities.ts"), "utf8");
		if (!/export const PROVINCES/.test(cities)) throw new Error("ziwei/cities.ts 的 PROVINCES 不在了");
		// stars 检索不受拆分影响（直调拆出的 cmdStars）
		const s = cmdStars({ _: [], search: "紫微" });
		if (!s.includes("紫微") || !s.includes("关键词"))
			throw new Error(`stars --search 紫微 的释义不见了，实得：${s.slice(0, 60)}`);
		return "命令面收敛中间态就位";
	});

	ok("参数面：SKILL.md 命令速查表提到的命令都在 commands.ts 的命令表里", () => {
		// 与上一条同源：SKILL.md 是给 Claude 读的**行为规范**，它提到的命令若不存在，
		// Claude 会照着敲一条必然失败的命令行。
		//
		// ⚠️ 这里读的是 commands.ts 的**源码文本**而非它的导出 —— `COMMAND_TABLE` 里挂着
		// `cmdSelftest`，而本文件就是 selftest：静态 import 成环，动态 import 又要把
		// `cmdSelftest` 改成 async（波及调用点）。正则抽键是这两者之外的第三条路，
		// 与「读 SKILL.md 文本」正是同一手法。
		const src = readFileSync(resolve(ctx.root, "cli", "commands.ts"), "utf8");
		const table = src.match(/const COMMAND_TABLE = \{([\s\S]*?)\} satisfies/)?.[1];
		if (!table) throw new Error("未从 commands.ts 抽到 COMMAND_TABLE —— 声明块形状已变");
		// ⚠️ 键上的双引号是**可选**的，别把它从正则里省掉：命令名含连字符时
		// 不是合法标识符，对象字面量里**必须**加引号。只认裸键的写法会静默漏抽这一项，
		// 于是「表里有、扫描器看不见」→ 反向误报成「SKILL.md 提到但未定义」，
		// 而且报的方向正好与真相相反（实测踩过）。
		const defined = [...table.matchAll(/^\t+"?([a-z][a-z0-9-]*)"?:/gm)].map(m => m[1]);
		if (!defined.length)
			throw new Error("COMMAND_TABLE 里一个命令名都没抽到 —— 正则或路径可能已失效");

		const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
		const at = md.indexOf("## 命令速查");
		if (at < 0) throw new Error("SKILL.md 里找不到「## 命令速查」小节");
		// 只取该小节里的表格：正文提到命令名的散文（如「`analyze` 会自动输出两盘差异」）
		// 不构成「速查表说这个命令存在」的声明，卷进来只会产生误报。
		// 先跳过标题行与其后的空行，否则下面第一个 `\n\n` 就是标题后的空行，切出个空表。
		const body = md.slice(at + md.slice(at).indexOf("\n\n") + 2);
		const rows = body
			.slice(0, body.indexOf("\n\n"))
			.split("\n")
			.filter(l => l.startsWith("|"));
		// 字符类必须含数字与连字符：写成 `[a-z]+` 时 `` `synastry2` `` 会被**截断**成 `synastry`
		// 而 synastry 恰好是真实命令 —— 于是「真名 + 后缀」这类假命令全部溜过（实测踩过）。
		const mentioned = rows
			.map(l => l.match(/^\|\s*`([a-z][a-z0-9-]*)/)?.[1])
			.filter(n => n !== undefined);
		if (!mentioned.length) throw new Error("未从命令速查表扫到命令 —— 表格格式已变");

		const unknown = mentioned.filter(n => !defined.includes(n));
		if (unknown.length)
			throw new Error(`SKILL.md 提到但 commands.ts 未定义的命令：${unknown.join("、")}`);
		return `${mentioned.length} 个命令全部有实现`;
	});

	ok("合并自检：古籍 / 合盘断言组并入（三段合计）", () => {
		// 2026-09-30 三 skill 合一：classics 与 synastry 的自检断言各自住在
		// scripts/classics/selftest-asserts.ts 与 scripts/synastry/selftest-asserts.ts，
		// 由本命令汇总执行 —— 报告分三段（排盘 / 古籍 / 合盘），首行「通过 N/N」为合计。
		const classics = classicAsserts();
		const synastry = synastryAsserts();
		if (!classics.length || !synastry.length) throw new Error("断言组为空——搬移未完成");
		results.push({ pass: true, name: "── 古籍 ──", detail: "" });
		for (const r of classics) results.push(r);
		results.push({ pass: true, name: "── 合盘 ──", detail: "" });
		for (const r of synastry) results.push(r);
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
