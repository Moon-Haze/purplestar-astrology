/**
 * 出生信息解析层 —— CLI 参数 → 排盘内核要的 BirthInfo。输入 `CliArgs`、输出
 * `BirthInfoResult`，复杂处全在「真太阳时」与「农历换算」，与渲染、分发无关。
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可静态 import 内核。
 * 口径论证（真太阳时 / 晚子时两盘 / 夏令时 / 城市容错 / 护栏）见 docs/code/cli-birth.md。
 * @file 出生信息解析层 —— CLI 参数 → BirthInfo
 */

import type { CliArgs } from "../args";
import { camelKey } from "../args/table";
import { fmtDate } from "../chart/render";
import { BRANCHES, SHICHEN } from "@/data/ganzhi";
import { PROVINCES } from "./cities";
import { Lunar, type Solar } from "lunar-typescript";
// 接口与常量住 ./birth-info-defs，本文件只为函数实现；公开面文末 re-export 兜住。
import {
	ADMIN_SUFFIX,
	ALL_CITIES,
	type BirthInfoResult,
	type LongitudeHit,
	type TrueSolarOptions,
	type TrueSolarResult,
} from "./birth-info-defs";

/**
 * 时辰支索引 → `"巳时(09:00-11:00)"`。
 * @param i - 时辰支索引 0–11（0=子 … 11=亥）
 * @returns 时辰名与区间标签；越界时两处都取不到（`undefined时()`）
 * @remarks `SHICHEN` 是 `{ branch, name, range }` 数组，与 `BRANCHES` 同为 0–11 序。
 */
const shichenLabel = (i: number) =>
	`${SHICHEN[i]?.name ?? BRANCHES[i] + "时"}(${SHICHEN[i]?.range ?? ""})`;

/**
 * 带符号分钟数，拼「+4 分 / -14 分」文案。
 * @param n - 已取整分钟数，可为负
 * @returns 非负带 `+` 前缀；负数保留 `-`
 */
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/**
 * 均时差（equation of time），分钟。真太阳时 = 平太阳时 + 均时差。
 * @param year - 公历年（只判闰年，定 B 分母 366/365）
 * @param month - 公历月 1–12
 * @param day - 公历日
 * @returns 当日均时差（分钟），可正可负
 * @remarks 工程近似式 `9.87·sin2B − 7.53·cosB − 1.5·sinB`，幅度 −14.6 ~ +16.5 分。
 * ⚠️ **与经度无关**：`--lng 120` 时也不为 0 —— 开了 `--eot` 后照样参与校正（见 docs/code/cli-birth.md）。
 */
export function equationOfTime(year: number, month: number, day: number): number {
	const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const doy = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
	const b = (2 * Math.PI * (doy - 81)) / (isLeap ? 366 : 365);
	return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/**
 * 北京时间 + 经度 → 真太阳时。
 * @param clockHour - 钟表时小时 0–23
 * @param clockMinute - 钟表时分钟 0–59
 * @param longitude - 出生地经度，**东经为正**；未给传 120（不校正）
 * @param opts - 口径开关与均时差日期，缺省传统口径
 * @returns 时辰支、晚子时标记、跨天日界与校正量；逐字段见 {@link TrueSolarResult}
 * @throws 开 `opts.eot` 却没给 `opts.year` 时
 * @remarks 与 `calcTrueSolarBranch` 同公式。校正量默认
 * **只含经度项** `(经度 − 120) × 4`，传 `opts.eot` 再加均时差；两口径差别非小数点级
 * （北京全年约 5% 出生时间因此换时辰，时辰换则整盘变），故默认传统，严格口径显式开
 * `--eot`，**不静默切换**。判定（`dayOffset`/`isLateZi`/`branch`）一律用**未取整**量，
 * 先取整再判会边界翻车。⚠️ 均时差依赖日期，缺了静默算 `NaN` —— 宁可失败不错时辰。
 */
export function calcTrueSolar(
	clockHour: number,
	clockMinute: number,
	longitude: number,
	opts: TrueSolarOptions = {}
): TrueSolarResult {
	const clockMins = clockHour * 60 + clockMinute;
	if (
		opts.eot &&
		(!Number.isInteger(opts.year) ||
			!Number.isInteger(opts.month) ||
			!Number.isInteger(opts.day))
	) {
		throw new Error(
			"calcTrueSolar：开启 eot 时必须提供 year/month/day 三项（缺项会静默算出 NaN）"
		);
	}
	const longitudeRaw = (longitude - 120) * 4;
	// 日期已校验为整数，安全下传
	const eotRaw = opts.eot
		? equationOfTime(opts.year as number, opts.month as number, opts.day as number)
		: 0;
	const dstRaw = opts.dstMinutes ?? 0;
	// 判定用未取整 offsetRaw —— 未开 --eot 时 eotRaw 恒 0，默认口径与旧实现逐位相同。
	const totalRaw = clockMins + longitudeRaw + eotRaw - dstRaw;
	// dayOffset 取未取整值：跨午夜由精确时刻定，先取整会在边界翻车
	const dayOffset = Math.floor(totalRaw / 1440);
	const solar = ((totalRaw % 1440) + 1440) % 1440;
	const isLateZi = solar >= 1380; // 23:00–23:59
	const branch = solar >= 1380 || solar < 60 ? 0 : Math.floor((solar - 60) / 120) + 1;
	const longitudeMinutes = Math.round(longitudeRaw);
	const eotMinutes = Math.round(eotRaw);
	const dstMinutes = Math.round(dstRaw);
	return {
		branch,
		isLateZi,
		dayOffset,
		offsetMinutes: longitudeMinutes + eotMinutes - dstMinutes,
		longitudeMinutes,
		eotMinutes,
		dstMinutes,
		solarMinutes: Math.round(solar),
	};
}

/**
 * 中国夏令时六年区间表。
 * @remarks 以 IANA tzdata（`Asia/Shanghai`，Rule PRC）为准（百科 1988 起日与 tzdata 有
 * 出入，取 tzdata）。表驱动而非动态算规则：1986 首年特例使规则计算须带分支，写六年更直白。
 */
const CHINA_DST_YEARS: ReadonlyArray<{
	year: number;
	start: readonly [number, number];
	end: readonly [number, number];
}> = [
	{ year: 1986, start: [5, 4], end: [9, 14] },
	{ year: 1987, start: [4, 12], end: [9, 13] },
	{ year: 1988, start: [4, 17], end: [9, 11] },
	{ year: 1989, start: [4, 16], end: [9, 17] },
	{ year: 1990, start: [4, 15], end: [9, 16] },
	{ year: 1991, start: [4, 14], end: [9, 15] },
];

/** 月日压成可比较整数（不补零时字典序即年内日序） */
const mdKey = (month: number, day: number): number => month * 100 + day;

/** 夏令时起止都在凌晨 02:00（拨快/拨回切换时刻） */
const DST_BOUNDARY_MIN = 2 * 60;

/**
 * 判定出生时刻（公历日 + 钟表时刻）是否在中国夏令时期间。
 * @param year - 公历年
 * @param month - 公历月 1–12
 * @param day - 公历日
 * @param clockMins - 当日分钟数（0–1439）
 * @returns `true` 表按夏令时读数，排盘前回拨 60 分
 * @remarks 起止日**当天**参与判定（含首尾），按 02:00 细分；结束日 01:00–01:59
 * 物理出现两次取首次。`--branch` 直给路径不调用本函数（换算由用户负责）。
 */
export function isChinaDstClock(
	year: number,
	month: number,
	day: number,
	clockMins: number
): boolean {
	const rec = CHINA_DST_YEARS.find(r => r.year === year);
	if (!rec) {
		return false;
	}
	const md = mdKey(month, day);
	// 闭区间放行首尾两日（按 02:00 细分），区间外日期排除
	if (md < mdKey(rec.start[0], rec.start[1]) || md > mdKey(rec.end[0], rec.end[1])) {
		return false;
	}
	if (md === mdKey(rec.start[0], rec.start[1])) {
		return clockMins >= DST_BOUNDARY_MIN;
	}
	if (md === mdKey(rec.end[0], rec.end[1])) {
		return clockMins < DST_BOUNDARY_MIN;
	}
	return true;
}

/**
 * 按天数偏移公历日期。
 * @param year - 公历年
 * @param month - 公历月 1–12
 * @param day - 公历日
 * @param days - 偏移天数可为负；调用点传 {@link TrueSolarResult.dayOffset}（0/+1/-1）
 * @returns 偏移后的 `{ year, month, day }`（月已归一 1–12）
 * @remarks 用 `Date.UTC` 而非 `day ± 86400000`（后者跨月/年/闰年须自判，掺本地时区会在
 * 夏令时切换日错）；UTC 无夏令时，日期进退交给它算最稳。
 */
export function shiftDate(
	year: number,
	month: number,
	day: number,
	days: number
): { year: number; month: number; day: number } {
	const d = new Date(Date.UTC(year, month - 1, day + days));
	return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * 去掉城市名末尾的行政区划后缀。
 *
 * @param s - 用户输入的城市名（如「石家庄市」）
 * @returns 去空白、去后缀后的名字（如「石家庄」）；没有后缀时原样返回
 */
const stripSuffix = (s: string) => String(s).trim().replace(ADMIN_SUFFIX, "");

/**
 * 省级行政区去词缀后的简称（「海南省」→「海南」、「广西壮族自治区」→「广西」）。
 * 裸省简称**不参与城市包含匹配**：青海「海南州」、吉林「吉林市」都含省简称，`--city`
 * 若被包含匹配截胡即跨省错配（经度差足以换时辰）。省简称一律交回 {@link buildBirthInfo}
 * 的省名回退，按省会计。
 */
const PROVINCE_SHORT_NAMES = new Set(
	PROVINCES.map(p => p.name.replace(/(维吾尔|壮族|回族)?自治区|特别行政区|省$/, ""))
);

/**
 * 按城市名查经度（容错匹配）。
 * @param cityName - 用户输入城市名，可带行政后缀
 * @returns 命中结果；未收录（或空）返回 `null`
 * @remarks 依次尝试：原名精确 → 去后缀精确 → 双向包含（裸省简称除外，见
 * {@link PROVINCE_SHORT_NAMES}）。命中多个**取最短城市名**，同长度其余候选记进
 * `ambiguous` 提醒确认（见 docs/code/cli-birth.md）。
 */
export function findLongitude(cityName: string): LongitudeHit | null {
	const raw = String(cityName).trim();
	if (!raw) {
		return null;
	}
	const bare = stripSuffix(raw);

	const hit =
		ALL_CITIES.find(c => c.name === raw) ??
		(bare !== raw ? ALL_CITIES.find(c => c.name === bare) : null);
	// exact 表「用户写的就是表里那个名字」，供上层决定是否提示容错解析
	if (hit) {
		return {
			longitude: hit.longitude,
			matched: hit.name,
			exact: hit.name === raw,
			ambiguous: null,
		};
	}

	// 裸省简称不猜城市，交回省名回退
	if (PROVINCE_SHORT_NAMES.has(bare)) {
		return null;
	}

	const cands = ALL_CITIES.filter(c => c.name.includes(bare) || bare.includes(c.name));
	if (!cands.length) {
		return null;
	}
	// 取最短城市名，记同长度候选供提示
	cands.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
	const best = cands[0];
	const rivals = cands.filter(c => c.name !== best.name && c.name.length === best.name.length);
	return {
		longitude: best.longitude,
		matched: best.name,
		exact: false,
		ambiguous: rivals.length ? rivals.slice(0, 5).map(c => `${c.name}(${c.longitude})`) : null,
	};
}

/**
 * 从参数构造 BirthInfo。
 * @param args - CLI 参数表
 * @returns 排盘 `info` + 渲染提示字段，见 {@link BirthInfoResult}
 * @throws 日期缺失/格式非法/公历日期不存在（round-trip，如 2011-02-30）/农历换算失败/
 *   性别缺失或非法/出生地未收录/时辰缺失或非法，及 `--lunar` 与 `--date` 同用、
 *   `--late-zi` 未配 `--time`
 * @remarks 日期（二选一）：`--date YYYY-MM-DD` 公历 / `--lunar YYYY-MM-DD` 农历（配 `--leap`）。
 * 时辰（二选一）：`--time HH:MM`（配 `--lng`/`--city`/`--province` 走 {@link calcTrueSolar}）/
 * `--branch 0-12`（12=晚子时）；`--late-zi`、`--eot` 均配 `--time`。出生地 `--lng` 优先，
 * 其次 `--city`/`--province`，都无则东经 120°。⚠️ 真太阳时跨午夜时用 {@link shiftDate}
 * 就地调整 `year`/`month`/`day` 并记进 `note` —— 日期单点流入 `info`，改此处，下游
 * （农历、排盘、合盘、流年）自动跟随。护栏立场见 docs/code/cli-birth.md。
 */
export function buildBirthInfo(args: CliArgs): BirthInfoResult {
	// `CliArgs` 键是 camelCase，`k` 按声明表 kebab 写（如 `"late-zi"`），故拼键时过一道
	// camelKey —— 所有键读取都从 `g` 走，换算只一处。
	/** 按 kebab 键读参数（换 camelCase 后取）。 */
	const g = (k: string) => args[camelKey(k)];

	// ── 出生日期 ──
	let year: number | undefined,
		month: number | undefined,
		day: number | undefined,
		dateNote = "";
	const lunarStr = g("lunar");
	const solarStr = g("date");

	if (lunarStr && solarStr) {
		throw new Error("--lunar 与 --date 不能同时使用（一个是农历，一个是公历）");
	}

	if (lunarStr) {
		const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(lunarStr));
		if (!m) {
			throw new Error(`农历日期格式应为 YYYY-MM-DD，收到：${lunarStr}`);
		}
		const ly = Number(m[1]),
			lm = Number(m[2]),
			ld = Number(m[3]);
		const isLeap = g("leap") === true || g("leap") === "true";
		if (lm < 1 || lm > 12) {
			throw new Error(`农历月份应为 1-12，收到：${lm}`);
		}
		if (ld < 1 || ld > 30) {
			throw new Error(`农历日期应为 1-30，收到：${ld}`);
		}
		let solar: Solar;
		try {
			// lunar-typescript 闰月用负数月表示；无此闰月会抛 "wrong lunar year ..."
			solar = Lunar.fromYmd(ly, isLeap ? -lm : lm, ld).getSolar();
		} catch (err) {
			const hint = isLeap
				? `${ly} 年可能没有闰${lm}月（闰月并非每年都有）`
				: "请核对年月日是否存在";
			throw new Error(
				`农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 换算失败：${hint}。原始错误：${(err as Error).message}`,
				{ cause: err }
			);
		}
		year = solar.getYear();
		month = solar.getMonth();
		day = solar.getDay();

		// 回环校验：换算结果反查须与输入一致，防静默日期滚动（错一天整盘皆错）
		const back = solar.getLunar();
		const backMonth = back.getMonth();
		if (back.getYear() !== ly || backMonth !== (isLeap ? -lm : lm) || back.getDay() !== ld) {
			throw new Error(
				`农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 换算后回查不一致：` +
					`得到 ${back.getYear()}年${backMonth < 0 ? "闰" : ""}${Math.abs(backMonth)}月${back.getDay()}日。请核对农历日期。`
			);
		}
		dateNote = `农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 → 公历 ${year}-${month}-${day}`;
	} else if (solarStr) {
		const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(solarStr));
		if (!m) {
			throw new Error(`日期格式应为 YYYY-MM-DD，收到：${solarStr}`);
		}
		const [sy, sm, sd] = m.slice(1).map(Number);
		if (sm < 1 || sm > 12) {
			throw new Error(`日期不存在：${solarStr}（月份应为 1-12，收到 ${sm}）`);
		}
		// round-trip：JS Date 把 2011-02-30 静默归一为 03-02，下传即「标题印着 02-30、实际排 03-02」错盘
		// —— 反查须原样。Solar 不归一化，故用 JS Date 反查。
		const probe = new Date(Date.UTC(sy, sm - 1, sd));
		// Date 对 0-99 年有「+1900」遗留映射，故年份仅 ≥100 时参与反查；月/日滚动不受影响，
		// 必被下面比较拦下。
		const roundTripOk =
			(sy >= 100 || probe.getUTCFullYear() === sy) &&
			probe.getUTCMonth() === sm - 1 &&
			probe.getUTCDate() === sd;
		if (!roundTripOk) {
			const maxDay = new Date(Date.UTC(sy, sm, 0)).getUTCDate();
			throw new Error(`日期不存在：${solarStr}（${sy} 年 ${sm} 月只有 ${maxDay} 天）`);
		}
		year = sy;
		month = sm;
		day = sd;
	}
	// ⚠️ 日期二选一（--date/--lunar，spec §1.2）：--date 完全覆盖。
	if (!year || !month || !day) {
		throw new Error("缺少出生日期：需 --date YYYY-MM-DD 或 --lunar YYYY-MM-DD");
	}

	// ── 真太阳时：默认只校正经度；--eot 加均时差 ──
	// 均时差与经度无关（--lng 120 也不为 0），开关独立于「出生地是否给出」。
	const useEot = g("eot") === true || g("eot") === "true";

	// ── 经度：--lng 优先，再 --city/--province，默认 120 ──
	let longitude: number,
		lngNote = "",
		lngAmbiguous: string[] | null = null;
	if (g("lng") !== undefined) {
		longitude = Number(g("lng"));
		if (!Number.isFinite(longitude)) {
			throw new Error(`--lng 应为数字，收到：${g("lng")}`);
		}
	} else if (g("city")) {
		const cityRaw = String(g("city"));
		const found = findLongitude(cityRaw);
		if (found) {
			longitude = found.longitude;
			// 仅在「做了容错解析」或「存在同名歧义」时提示——写的即表名时不必打扰
			if (!found.exact) {
				lngNote = `「${cityRaw}」按「${found.matched}」解析 → 东经 ${found.longitude}°`;
			}
			lngAmbiguous = found.ambiguous;
			if (lngAmbiguous && !lngNote) {
				lngNote = `「${cityRaw}」→ 东经 ${found.longitude}°`;
			}
		} else {
			// 城市未命中时的省名回退：「山东」「内蒙古」按省会计，与 --province 同实现。
			const prov = PROVINCES.find(x => x.name === cityRaw || x.name.startsWith(cityRaw));
			if (prov) {
				longitude = prov.cities[0]?.longitude ?? 120;
				lngNote = `${prov.name}（按省会 ${prov.cities[0]?.name} 计）`;
			} else {
				throw new Error(
					`未收录城市：${cityRaw}（可试省+市连写如「山东青岛」，或改用 --province / --lng 直接指定）`
				);
			}
		}
	} else if (g("province")) {
		const prov = PROVINCES.find(
			x => x.name === g("province") || x.name.startsWith(String(g("province")))
		);
		longitude = prov?.cities[0]?.longitude ?? 120;
		lngNote = prov
			? `${prov.name}（按省会 ${prov.cities[0]?.name} 计）`
			: "省份未收录，按 120° 处理";
	} else {
		longitude = 120;
		lngNote = useEot
			? "未给出生地，按东经 120° 处理（不做经度校正，仅计入均时差）"
			: "未给出生地，按东经 120° 处理（不做真太阳时校正，结果可能有偏差）";
	}

	// ── 时辰 ──
	let timeIndex: number, hourNote: string;
	const wantLateZi = g("late-zi") === true || g("late-zi") === "true";
	// 23:00–23:59 出生早晚子时两口径排不同盘，此标记供上层提醒
	let lateZiCandidate = false;

	// --late-zi 只对 --time 有意义（--branch 直给时辰，晚子时即 --branch 12）：同用属误用，
	// 当场报错而非静默忽略（旧校验位置不可达=没校验，见 docs/code/cli-birth.md）。
	if (wantLateZi && g("time") === undefined) {
		throw new Error("--late-zi 需配合 --time 使用；直接指定时辰时，晚子时请用 --branch 12");
	}

	if (g("branch") !== undefined) {
		timeIndex = Number(g("branch"));
		// 12 = 晚子时（安星按次日），本 CLI 对 iztro timeIndex 12 的显式暴露
		if (!Number.isInteger(timeIndex) || timeIndex < 0 || timeIndex > 12) {
			throw new Error("--branch 应为 0-11（0=子 … 11=亥）或 12（晚子时）");
		}
		hourNote =
			timeIndex === 12
				? "直接指定 晚子时（子时，安星按次日）"
				: `直接指定 ${shichenLabel(timeIndex)}`;
	} else if (g("time") !== undefined) {
		const m = /^(\d{1,2}):(\d{2})$/.exec(String(g("time")));
		if (!m) {
			throw new Error(`时间格式应为 HH:MM，收到：${g("time")}`);
		}
		const ch = Number(m[1]),
			cm = Number(m[2]);
		if (ch > 23 || cm > 59) {
			throw new Error(`时间超出范围：${g("time")}`);
		}
		// 1986–91 夏令时：按夏令时读数先回拨 60 分（--no-dst 关闭）
		const noDst = g("no-dst") === true || g("no-dst") === "true";
		const dstMinutes = !noDst && isChinaDstClock(year, month, day, ch * 60 + cm) ? 60 : 0;
		const t = calcTrueSolar(ch, cm, longitude, {
			eot: useEot,
			year,
			month,
			day,
			dstMinutes,
		});
		lateZiCandidate = t.isLateZi;

		// 校正推出当天时日期必须跟着走，否则 (日,时) 非出生时刻。日期单点流入 info，改此处，
		// 下游（农历、排盘、合盘、流年）自动跟随（论证见 docs/code/cli-birth.md）。
		let dayShiftText = "";
		if (t.dayOffset !== 0) {
			const shifted = shiftDate(year, month, day, t.dayOffset);
			dayShiftText = `（真太阳时已跨过午夜，出生日期${
				t.dayOffset > 0 ? "顺延至次日" : "回退至前一日"
			} ${fmtDate(shifted)}）`;
			year = shifted.year;
			month = shifted.month;
			day = shifted.day;
		}

		// 校正量：默认仅经度项；开 --eot 加均时差，夏令时回拨减一项。DST 生效时即使未开 --eot
		// 也展开明细 —— 总数混入 −60 分而不显来源，等于静默切换口径。
		const dstText = t.dstMinutes ? ` − 夏令时 ${t.dstMinutes} 分` : "";
		const corrText = useEot
			? `经度 ${signed(t.longitudeMinutes)} 分 + 均时差 ${signed(t.eotMinutes)} 分${dstText} = ${signed(t.offsetMinutes)} 分`
			: t.dstMinutes
				? `经度 ${signed(t.longitudeMinutes)} 分${dstText} = ${signed(t.offsetMinutes)} 分`
				: `${signed(t.offsetMinutes)} 分`;
		const clockText = `钟表 ${String(ch).padStart(2, "0")}:${m[2]}`;

		if (t.isLateZi && wantLateZi) {
			timeIndex = 12;
			hourNote = `${clockText} → 真太阳时校正 ${corrText} → 晚子时（安星按次日）`;
		} else {
			timeIndex = t.branch;
			hourNote = `${clockText} → 真太阳时校正 ${corrText} → ${shichenLabel(timeIndex)}`;
			if (t.isLateZi) {
				hourNote += "（晚子时，按当日早子时口径）";
			}
		}
		hourNote += dayShiftText;
		if (t.dstMinutes) {
			hourNote += `；生于夏令时期间，钟表时间已回拨 1 小时（若出生证明时间当时已自行减过，加 --no-dst 复原）`;
		}
	} else {
		throw new Error("缺少出生时辰：需 --time HH:MM 或 --branch 0-12");
	}

	// 性别决定大限顺逆（男女大限可差 80 年）：缺失/非法若兜底 male 即无信号错盘，故报错。
	// 校验在时辰之后，保持「日期→时辰→性别」顺序。
	const genderRaw = g("gender");
	if (genderRaw === undefined) {
		throw new Error(
			`缺少性别：需 --gender male|female|男|女（性别决定大限顺逆，缺失会排出错盘）`
		);
	}
	const genderValue = String(genderRaw).toLowerCase();
	if (!["male", "m", "男", "female", "f", "女"].includes(genderValue)) {
		throw new Error(`--gender 应为 male|female|男|女，收到：${genderRaw}`);
	}
	const gender = ["female", "f", "女"].includes(genderValue) ? "female" : "male";

	const notes = [dateNote, lngNote, hourNote].filter(Boolean);
	return {
		info: {
			year,
			month,
			day,
			timeIndex,
			gender,
			name: g("name") ? String(g("name")) : undefined,
			longitude,
		},
		note: hourNote,
		notes,
		longitude,
		lngNote,
		lngAmbiguous,
		lateZiCandidate,
		isLateZi: timeIndex === 12,
	};
}
