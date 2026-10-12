/**
 * 换算层断言组：农历 → 公历、真太阳时、晚子时等价性（原 `cli/selftest.ts` 区块 1–3）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入）；
 * 报告顺序由主 selftest 的调用序保证。
 */

import { Lunar } from "lunar-typescript";
import {
	buildBirthInfo,
	calcTrueSolar,
	equationOfTime,
	findLongitude,
	shiftDate,
} from "../birth-info";
import { parseArgs } from "../args";
import { chartSignature, fmtDate } from "../render";
import { generateChart } from "@/algorithm";
import { eq, type SelftestDeps } from "../selftest-kit";

/** 农历 → 公历换算（含 --lunar 输入路径与闰月边界）。 */
export function runLunar({ ok }: Pick<SelftestDeps, "ok">): void {
	const sol = (y: number, m: number, d: number) => `${y}-${m}-${d}`;
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
}

/** 真太阳时：经度项 / 均时差 / 跨天边界与自洽性。 */
export function runTrueSolar({ ok }: Pick<SelftestDeps, "ok">): void {
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
}

/** 晚子时等价性（本技能最易错处）：两口径分野与 --branch 12 / --late-zi 路径。 */
export function runLateZi({ ok }: Pick<SelftestDeps, "ok">): void {
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
}
