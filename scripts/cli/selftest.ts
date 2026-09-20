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
import { parseArgs } from "./args";
import {
	buildBirthInfo,
	calcTrueSolar,
	equationOfTime,
	findLongitude,
	shiftDate,
} from "./birth-info";
import { chartSignature, fmtDate } from "./render";
import type { BirthInfo } from "@/ziwei/types";
import { generateChart } from "@/ziwei/algorithm";
import { detectPatterns } from "@/ziwei/patterns";
import { getSiHuaByStem, getYearStemIndex, getLiuYueSiHua } from "@/ziwei/sihua";
import { STEMS, STAR_DESCRIPTIONS } from "@/ziwei/constants";
import { HEMING_METHODOLOGY, STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU } from "@/ziwei/heming-knowledge";
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from "@/classics/index";
import { TIANJI_MODULES, RENJI_MODULES, DIJI_MODULES } from "@/nihai/index";
import { Lunar } from "lunar-javascript";

/**
 * 覆盖：农历换算、真太阳时、晚子时等价性、城市容错、性别护栏、排盘不变量、三合派约束、格局与知识源可用性。
 *
 * 内核根从 `ctx` 取而非自己推导：那是引导层 `pickRoot()` 的职责，自检只负责把它交代出来
 * （用户得知道这张盘是用哪一份内核排的）。失败时以非零码退出，`test/cli.test.mjs` 依赖这一点。
 */
export function cmdSelftest(ctx: CliContext): string {
	interface Assertion {
		pass: boolean;
		name: string;
		detail: string;
	}
	const results: Assertion[] = [];
	const eq = (actual: unknown, expected: unknown, msg = "") => {
		if (actual !== expected)
			throw new Error(
				`${msg}期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`
			);
	};
	/** fn 抛错即判失败；返回值若非空则作为该项的补充说明 */
	const ok = (name: string, fn: () => unknown) => {
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};

	const sample: BirthInfo = { year: 1990, month: 5, day: 15, hour: 5, gender: "male" };
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
		eq(calcTrueSolar(12, 0, 116.4, { eot: true, year: 1990, month: 5, day: 15 }).dayOffset, 0, "北京正午");
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
					`${h}:${m} @${lng} → dayOffset=${t.dayOffset} solar=${t.solarMinutes}，还原得 ${back}，应为 ${total}`,
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
			hour: 12,
			gender: "male",
		});
		const nextEarly = generateChart({
			year: 1990,
			month: 5,
			day: 16,
			hour: 0,
			gender: "male",
		});
		eq(chartSignature(late), chartSignature(nextEarly), "晚子时与次日早子时");
	});
	ok("晚子时：与当日早子时是两张不同的盘", () => {
		const early = generateChart({
			year: 1990,
			month: 5,
			day: 15,
			hour: 0,
			gender: "male",
		});
		const late = generateChart({
			year: 1990,
			month: 5,
			day: 15,
			hour: 12,
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
		eq(viaBranch.info.hour, 12);
		eq(viaFlag.info.hour, 12);
		eq(
			chartSignature(generateChart(viaBranch.info)),
			chartSignature(generateChart(viaFlag.info))
		);
	});
	ok("晚子时：--time 23:40 默认走早子时口径并打上候选标记", () => {
		const b = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--time", "23:40", "--gender", "male"])
		);
		eq(b.info.hour, 0);
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
			parseArgs(["--date", "1990-05-15", "--branch", "0", "--city", "石家庄", "--gender", "male"])
		);
		const fuzzy = buildBirthInfo(
			parseArgs(["--date", "1990-05-15", "--branch", "0", "--city", "石家庄市", "--gender", "male"])
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
	ok("性别：heming 缺 --a-gender 时，文案应指向 --a-gender", () => {
		let msg: string | null = null;
		try {
			buildBirthInfo(parseArgs(["--a-date", "1990-05-15", "--a-branch", "0"]), "a-");
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg) throw new Error("缺 --a-gender 时未报错");
		if (!msg.includes("--a-gender")) throw new Error(`文案应含 --a-gender，实得：${msg}`);
		return msg;
	});

	// ── 5. 排盘不变量 ──
	ok("排盘不变量：十二宫齐全 / 地支不重复 / 命宫唯一 / 五行局合法", () => {
		const c = generateChart(sample);
		eq(c.palaces.length, 12, "宫位数 ");
		eq(new Set(c.palaces.map(p => p.branch)).size, 12, "地支去重后 ");
		eq(c.palaces.filter(p => p.isMingGong).length, 1, "命宫数 ");
		if (![2, 3, 4, 5, 6].includes(c.wuxingJu)) throw new Error(`五行局异常：${c.wuxingJu}`);
		if (c.ziweiPos < 0 || c.ziweiPos > 11) throw new Error(`紫微位异常：${c.ziweiPos}`);
		if (c.daXians.length !== 12) throw new Error(`大限数异常：${c.daXians.length}`);
	});
	ok("排盘不变量：空宫均带借宫字段", () => {
		const c = generateChart(sample);
		for (const p of c.palaces.filter(x => x.isEmpty)) {
			if (p.borrowedFromName === undefined || p.borrowedStars === undefined) {
				throw new Error(`空宫 ${p.name} 缺 borrowedFromName / borrowedStars`);
			}
		}
	});

	// ── 6. 三合派硬约束守护（防止飞星派逻辑回流）──
	ok("三合派约束：宫干自化未被填充", () => {
		const c = generateChart(sample);
		const dirty = c.palaces.filter(p => p.selfSihua);
		if (dirty.length)
			throw new Error(
				`检测到 selfSihua 被填充：${dirty.map(p => p.name).join("、")}（飞星派逻辑疑似回流）`
			);
	});
	ok("三合派约束：大限未携带宫干四化字段", () => {
		const c = generateChart(sample);
		const dirty = c.daXians.filter(
			d => d.siHua !== undefined || d.stemIndex !== undefined || d.stemName !== undefined
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
		const t = getSiHuaByStem(0);
		eq(`${t.禄}${t.权}${t.科}${t.忌}`, "廉贞破军武曲太阳");
	});
	ok("四化：生年干索引按 (year-4)%10 计（1990 → 庚 = 6）", () => {
		eq(getYearStemIndex(1990), 6);
		eq(STEMS[getYearStemIndex(1990)], "庚");
	});
	ok("流月：五虎遁 甲年正月 = 丙寅", () => {
		eq(getLiuYueSiHua(0, 1).stemName, "丙");
		eq(getLiuYueSiHua(1, 1).stemName, "戊", "乙年正月 ");
	});

	// ── 8. 知识源可用性 ──
	ok("知识源：古籍库非空", () => {
		if (!ALL_BOOKS.length) throw new Error("ALL_BOOKS 为空");
		if (!TOTAL_PARAGRAPHS) throw new Error("TOTAL_PARAGRAPHS 为 0");
		return `${ALL_BOOKS.length} 部 / ${TOTAL_PARAGRAPHS} 段`;
	});
	ok("知识源：古籍检索可命中", () => {
		const hits = searchClassics("紫微", 3);
		if (!hits.length) throw new Error("检索「紫微」无命中");
		return `命中 ${hits.length} 条`;
	});
	ok("知识源：倪海夏三纪模块非空", () => {
		if (!TIANJI_MODULES.length || !RENJI_MODULES.length || !DIJI_MODULES.length)
			throw new Error("三纪模块存在空数组");
		return `天纪 ${TIANJI_MODULES.length} / 人纪 ${RENJI_MODULES.length} / 地纪 ${DIJI_MODULES.length}`;
	});
	ok("知识源：合盘断语与四化断语非空", () => {
		if (!Object.keys(STAR_IN_FUQI_GU).length) throw new Error("STAR_IN_FUQI_GU 为空");
		if (!Object.keys(SIHUA_IN_FUQI_GU).length) throw new Error("SIHUA_IN_FUQI_GU 为空");
		if (!HEMING_METHODOLOGY) throw new Error("HEMING_METHODOLOGY 为空");
		return `夫妻宫断语 ${Object.keys(STAR_IN_FUQI_GU).length} 星`;
	});
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
