/**
 * 出生信息解析层 —— CLI 参数 → 排盘内核要的 BirthInfo。
 *
 * 拆自 purple-star.ts。这一层是一整个内聚单元：输入是 `CliArgs`，输出是 `BirthInfoResult`，
 * 中间的复杂之处全在「真太阳时」与「农历换算」两件事上，与渲染、命令分发无关。
 *
 * 依赖：./args（参数表）、./render（日期格式化）、@/ziwei/{constants,cities}、lunar-javascript
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliArgs } from "./args";
import { fmtDate } from "./render";
import type { BirthInfo } from "@/ziwei/types";
import { BRANCHES, SHICHEN } from "@/ziwei/constants";
import { PROVINCES } from "@/ziwei/cities";
import { Lunar, type Solar } from "lunar-javascript";

/**
 * 时辰支索引 → `"巳时(09:00-11:00)"`。
 *
 * @param i - 时辰支索引 0–11（0=子 … 11=亥）
 * @returns 时辰名与钟点区间拼接成的标签；索引越界时两处都取不到（结果是 `undefined时()`）
 *
 * @remarks
 * `SHICHEN` 是 `{ branch, name, range }` 对象数组，与 `BRANCHES` 同为 0–11 序，故两处都能查到名字。
 */
const shichenLabel = (i: number) =>
	`${SHICHEN[i]?.name ?? BRANCHES[i] + "时"}(${SHICHEN[i]?.range ?? ""})`;

/**
 * 带符号的分钟数，用于拼「+4 分 / -14 分」这类交代文案。
 *
 * @param n - 已取整的分钟数，可为负
 * @returns 非负数带 `+` 前缀；负数保留自身的 `-`
 */
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/**
 * 均时差（equation of time），单位：分钟。真太阳时 = 平太阳时 + 均时差。
 *
 * @param year - 公历年；只用来判断闰年（决定 B 的分母是 366 还是 365）
 * @param month - 公历月 1–12
 * @param day - 公历日
 * @returns 当日的均时差（分钟），可正可负
 *
 * @remarks
 * 用常见的工程近似式（`9.87·sin2B − 7.53·cosB − 1.5·sinB`，B 由「年内第几天」折算），
 * 全年幅度实测 −14.6 ~ +16.5 分钟。
 *
 * ⚠️ 该项**与经度无关**：即使 `--lng 120`（标准经线）也不为 0。所以「`--lng 120` = 不做校正」
 * 这个直觉只在默认口径下成立；开了 `--eot` 之后，120° 出生的盘照样会被均时差推动。
 */
export function equationOfTime(year: number, month: number, day: number): number {
	const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const doy =
		Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
	const b = (2 * Math.PI * (doy - 81)) / (isLeap ? 366 : 365);
	return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/**
 * {@link calcTrueSolar} 的可选项。
 *
 * @remarks
 * `eot` 决定是否计入均时差，其余三项是均时差所需的日期。
 *
 * ⚠️ 只有 `year` 有显式校验（开了 `eot` 却缺它就直接抛错）；`month` / `day` 缺省时会原样下传，
 * 在 {@link equationOfTime} 里静默算出 `NaN`，故开了 `eot` 就应该三项一起给。
 */
export interface TrueSolarOptions {
	/** 是否额外计入均时差。默认 `false`，即传统口径（只做经度校正） */
	eot?: boolean;
	/** 公历年，`eot` 为真时必填 */
	year?: number;
	/** 公历月 1–12，`eot` 为真时应提供 */
	month?: number;
	/** 公历日，`eot` 为真时应提供 */
	day?: number;
}

/** {@link calcTrueSolar} 的返回值。 */
export interface TrueSolarResult {
	/** 时辰支 0–11（0=子 … 11=亥）。注意：此值不会是 12，晚子时由 {@link isLateZi} 单独标记 */
	branch: number;
	/**
	 * 校正后是否落在 23:00–23:59（晚子时）。
	 *
	 * ⚠️ 这个区分很重要：子时横跨两日，23:00 后出生按传统三合派应「算次日」，
	 * 排出的盘与当日早子时完全不同。
	 */
	isLateZi: boolean;
	/**
	 * 校正后跨了几天的**日界**：0 = 未跨天，+1 = 落到次日，-1 = 落到前一日。
	 *
	 * ⚠️ **调用方必须据此调整日期**：真太阳时是一条连续的时间轴，日期与时辰都得取自它。
	 * 只取时辰而把日期留在钟表轴上，「日 + 时」这个组合指向的就不是出生时刻。
	 * 例：喀什 00:30 的真太阳时是前一日 21:38，日期不回退则「亥时」偏了约 9 小时，
	 * 农历日跟着错一天 → 紫微星定位错 → 整盘十二宫全变。
	 */
	dayOffset: number;
	/**
	 * 总校正（经度 + 均时差），分钟。
	 *
	 * 算法是**分项各自取整后相加**，好让提示里的「经度 A + 均时差 B = C」自洽
	 * （若先相加再取整，-14.4 与 +3.8 会显示成 -14 + 4 = -11，看着像算错了）。
	 */
	offsetMinutes: number;
	/** 经度项的贡献 `(经度 − 120) × 4`，取整后的分钟数 */
	longitudeMinutes: number;
	/** 均时差项的贡献，取整后的分钟数；未开 `eot` 时恒为 0 */
	eotMinutes: number;
	/** 校正后的**当日分钟数** 0–1439（已按 1440 取模归一，故不含跨天信息），取整后 */
	solarMinutes: number;
}

/**
 * 北京时间 + 经度 → 真太阳时。
 *
 * @param clockHour - 钟表时的小时 0–23
 * @param clockMinute - 钟表时的分钟 0–59
 * @param longitude - 出生地经度，**东经为正**；调用方未给出生地时传 120（即不做经度校正）
 * @param opts - 口径开关与均时差所需日期，缺省即传统口径
 * @returns 时辰支、晚子时标记、跨天日界与各项校正量；逐字段含义见 {@link TrueSolarResult}
 * @throws 开了 `opts.eot` 却没给 `opts.year` 时
 *
 * @remarks
 * 与 `components/BirthForm.tsx` 的 `calcTrueSolarBranch` 保持同一换算公式。
 *
 * 校正量默认**只含经度项** `(经度 − 120) × 4`；传 `opts.eot` 时再加均时差，
 * 得到天文学严格意义上的真太阳时。两种口径的差别不是小数点级的 —— 均时差可达 ±16 分钟，
 * 足以把结果推过时辰边界（实测北京全年约 5% 的出生时间会因此换一个时辰，而时辰一换整张盘全变）。
 * 故默认保持传统口径，要严格口径须显式开 `--eot`，**不做静默切换**。
 *
 * 判定（`dayOffset` / `isLateZi` / `branch`）一律用**未取整**的校正量：未开 `--eot` 时均时差恒为 0，
 * 故默认口径与旧实现逐位相同，不存在行为漂移；而跨没跨过午夜由精确时刻决定，先取整再判断会在边界翻车。
 *
 * ⚠️ 均时差依赖具体日期，缺了会静默算出 `NaN` —— 宁可当场失败，也不产出错时辰。
 */
export function calcTrueSolar(
	clockHour: number,
	clockMinute: number,
	longitude: number,
	opts: TrueSolarOptions = {}
): TrueSolarResult {
	const clockMins = clockHour * 60 + clockMinute;
	if (opts.eot && !Number.isInteger(opts.year))
		throw new Error("calcTrueSolar：开启 eot 时必须提供 year/month/day");
	const longitudeRaw = (longitude - 120) * 4;
	// year 已由上一行保证为整数；month/day 照原样下传（缺省时得到 NaN，与迁移前逐位一致）
	const eotRaw = opts.eot
		? equationOfTime(opts.year as number, opts.month as number, opts.day as number)
		: 0;
	// 判定一律用未取整的 offsetRaw —— 未开 --eot 时 eotRaw 恒为 0，
	// 故默认口径与旧实现逐位相同，不存在行为漂移。
	const totalRaw = clockMins + longitudeRaw + eotRaw;
	// dayOffset 也取未取整值：跨没跨过午夜由精确时刻决定，先取整再判断会在边界处翻车
	const dayOffset = Math.floor(totalRaw / 1440);
	const solar = ((totalRaw % 1440) + 1440) % 1440;
	const isLateZi = solar >= 1380; // 23:00–23:59
	const branch = solar >= 1380 || solar < 60 ? 0 : Math.floor((solar - 60) / 120) + 1;
	const longitudeMinutes = Math.round(longitudeRaw);
	const eotMinutes = Math.round(eotRaw);
	return {
		branch,
		isLateZi,
		dayOffset,
		offsetMinutes: longitudeMinutes + eotMinutes,
		longitudeMinutes,
		eotMinutes,
		solarMinutes: Math.round(solar),
	};
}

/**
 * 按天数偏移公历日期。
 *
 * @param year - 公历年
 * @param month - 公历月 1–12
 * @param day - 公历日
 * @param days - 偏移天数，可为负；调用点传的是 {@link TrueSolarResult.dayOffset}（0 / +1 / -1）
 * @returns 偏移后的 `{ year, month, day }`（月份已归一为 1–12）
 *
 * @remarks
 * 用 `Date.UTC` 做日历运算，而不是 `day ± 86400000` —— 后者跨月、跨年、闰年都要自己判，
 * 且一旦掺进本地时区就会在夏令时切换日出错。UTC 没有夏令时，日期进退交给它算最稳。
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
 * 行政区划后缀：用户常写「石家庄市」「石家庄地区」「XX自治州」，而城市表里存的是简称。
 *
 * 只匹配**结尾**的后缀；匹配到的整段会被 {@link stripSuffix} 去掉。
 */
const ADMIN_SUFFIX = /(特别行政区|自治州|自治县|自治区|地区|盟|市|县|区|旗)$/;

/**
 * 去掉城市名末尾的行政区划后缀。
 *
 * @param s - 用户输入的城市名（如「石家庄市」）
 * @returns 去空白、去后缀后的名字（如「石家庄」）；没有后缀时原样返回
 */
const stripSuffix = (s: string) => String(s).trim().replace(ADMIN_SUFFIX, "");

/**
 * {@link findLongitude} 的命中结果。
 */
export interface LongitudeHit {
	/** 命中城市的经度，东经为正 */
	longitude: number;
	/** 实际命中的**表内**城市名（可能与用户所写不同，即发生了容错解析） */
	matched: string;
	/** 是否精确命中：`true` = 用户写的就是表里那个名字；`false` = 做了容错解析 */
	exact: boolean;
	/** 同长度的同名候选（最多 5 个，形如「吉林(126.57)」）；无歧义时为 `null` */
	ambiguous: string[] | null;
}

/**
 * 按城市名查经度（容错匹配）。
 *
 * @param cityName - 用户输入的城市名，可带行政区划后缀
 * @returns 命中结果；未收录（或输入为空）时返回 `null`
 *
 * @remarks
 * 依次尝试：原名精确 → 去行政后缀精确 → 双向包含（`c.name.includes(bare) || bare.includes(c.name)`）。
 *
 * 双向包含命中多个时**取最短的城市名**（最短名最贴近用户所写），并将同长度的其余候选记进
 * `ambiguous` 提醒用户确认。
 */
export function findLongitude(cityName: string): LongitudeHit | null {
	const raw = String(cityName).trim();
	if (!raw) return null;
	const bare = stripSuffix(raw);
	const all = PROVINCES.flatMap(p => p.cities);

	const hit =
		all.find(c => c.name === raw) ?? (bare !== raw ? all.find(c => c.name === bare) : null);
	// exact 表示「用户写的就是表里那个名字」，用于上层决定要不要提示已做容错解析
	if (hit)
		return {
			longitude: hit.longitude,
			matched: hit.name,
			exact: hit.name === raw,
			ambiguous: null,
		};

	const cands = all.filter(c => c.name.includes(bare) || bare.includes(c.name));
	if (!cands.length) return null;
	// 命中最短的城市名（最短名最贴近用户所写），并记录同长度候选供提示
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
 * {@link buildBirthInfo} 的结果。
 *
 * @remarks
 * `info` 可直接喂给 `generateChart`；其余字段供上层渲染提示，**不参与排盘**。
 */
export interface BirthInfoResult {
	/** 可直接用于排盘的出生信息（钟表时已换算为时辰序号，日期已按跨天调整） */
	info: BirthInfo;
	/** 时辰那一条说明（`notes` 的其中一项） */
	note: string;
	/** 日期 / 出生地 / 时辰三类说明的合集，已滤掉空串 */
	notes: string[];
	/** 本次实际采用的经度（东经为正）；`info.longitude` 与它同值 */
	longitude: number;
	/** 出生地解析提示，精确命中时为空串 */
	lngNote: string;
	/** 同名候选城市列表，无歧义时为 null */
	lngAmbiguous: string[] | null;
	/** 校正后的真太阳时落在 23:00–23:59（需提醒用户复核晚子时口径） */
	lateZiCandidate: boolean;
	/** 本次排盘是否真的按晚子时口径（hour === 12） */
	isLateZi: boolean;
}

/**
 * 从参数构造 BirthInfo。
 *
 * @param args - CLI 参数表；heming 的甲/乙两方各传一次本函数
 * @param p - 参数前缀；heming 传 `"a-"` / `"b-"`，其余命令传空串（默认）
 * @returns 排盘用的 `info` 加上供渲染提示的说明字段，见 {@link BirthInfoResult}
 * @throws 日期缺失 / 格式非法 / 农历换算失败、性别缺失或非法、出生地未收录、
 *   时辰缺失或非法，以及 `--lunar` 与 `--date` 同用、`--late-zi` 未配合 `--time`
 *
 * @remarks
 * 日期（三选一）：
 * - `--date YYYY-MM-DD` 公历生日
 * - `--lunar YYYY-MM-DD` 农历生日（自动换算成公历，配合 `--leap` 表示闰月）
 * - `--year` / `--month` / `--day` 公历生日（分写）
 *
 * 时辰（二选一）：
 * - `--time HH:MM` 配合 `--lng` / `--city` / `--province` → 走 {@link calcTrueSolar} 换算真太阳时
 * - `--branch 0-12` → 直接指定时辰支（0=子 … 11=亥；12=晚子时）
 * - `--late-zi` 配合 `--time`，把 23:00–23:59 改按「晚子时算次日」排
 * - `--eot` 配合 `--time`，真太阳时额外计入均时差
 *
 * 出生地（`--lng` 优先，其次 `--city` / `--province`，都没有则按东经 120°）与性别护栏的
 * 「宁可启动失败，也不静默产出错盘」立场，见各自的块内注释。
 *
 * ⚠️ 真太阳时跨过午夜时，此处会就地用 {@link shiftDate} 调整 `year` / `month` / `day` 并记进
 * `note` —— 日期是单点流入 `info` 的，改在这里，下游（农历、排盘、合盘、流年）自动跟随。
 */
export function buildBirthInfo(args: CliArgs, p = ""): BirthInfoResult {
	const g = (k: string) => args[p + k];

	// ── 出生日期 ──
	let year: number | undefined,
		month: number | undefined,
		day: number | undefined,
		dateNote = "";
	const lunarStr = g("lunar");
	const solarStr = g("date");

	if (lunarStr && solarStr)
		throw new Error("--lunar 与 --date 不能同时使用（一个是农历，一个是公历）");

	if (lunarStr) {
		const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(lunarStr));
		if (!m) throw new Error(`农历日期格式应为 YYYY-MM-DD，收到：${lunarStr}`);
		const ly = Number(m[1]),
			lm = Number(m[2]),
			ld = Number(m[3]);
		const isLeap = g("leap") === true || g("leap") === "true";
		if (lm < 1 || lm > 12) throw new Error(`农历月份应为 1-12，收到：${lm}`);
		if (ld < 1 || ld > 30) throw new Error(`农历日期应为 1-30，收到：${ld}`);
		let solar: Solar;
		try {
			// lunar-javascript 约定：闰月用负数月份表示；该年若无此闰月会抛 "wrong lunar year ..."
			solar = Lunar.fromYmd(ly, isLeap ? -lm : lm, ld).getSolar();
		} catch (err) {
			const hint = isLeap
				? `${ly} 年可能没有闰${lm}月（闰月并非每年都有）`
				: "请核对年月日是否存在";
			throw new Error(
				`农历 ${ly}年${isLeap ? "闰" : ""}${lm}月${ld}日 换算失败：${hint}。原始错误：${(err as Error).message}`
			);
		}
		year = solar.getYear();
		month = solar.getMonth();
		day = solar.getDay();

		// 回环校验：换算结果反查回来必须与输入一致，防止静默的日期滚动（错一天，整盘皆错）
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
		if (!m) throw new Error(`日期格式应为 YYYY-MM-DD，收到：${solarStr}`);
		[, year, month, day] = m.map(Number);
	} else {
		year = Number(g("year"));
		month = Number(g("month"));
		day = Number(g("day"));
	}
	if (!year || !month || !day)
		throw new Error(
			"缺少出生日期：需 --date YYYY-MM-DD、--lunar YYYY-MM-DD 或 --year/--month/--day"
		);

	// 性别决定大限顺逆：同一张盘男女的大限可差 80 年（26-35岁 ↔ 106-115岁）。
	// 缺失或非法若被静默兜底成 male，用户拿到的是一张没有任何异常信号的错盘，
	// 故按「宁可启动失败，也不静默产出错盘」处理：一律报错。
	const genderRaw = g("gender");
	if (genderRaw === undefined)
		throw new Error(
			`缺少性别：需 --${p}gender male|female（性别决定大限顺逆，缺失会排出错盘）`
		);
	const genderValue = String(genderRaw).toLowerCase();
	if (!["male", "m", "男", "female", "f", "女"].includes(genderValue))
		throw new Error(`--${p}gender 应为 male 或 female，收到：${genderRaw}`);
	const gender = ["female", "f", "女"].includes(genderValue) ? "female" : "male";

	// ── 真太阳时口径：默认只做经度校正；--eot 额外计入均时差 ──
	// 均时差与经度无关（--lng 120 时也不为 0），故这个开关独立于「出生地是否给出」。
	const useEot = g("eot") === true || g("eot") === "true";

	// ── 经度：--lng 优先，其次 --city / --province，默认 120（东八区标准经线，即不做校正）──
	let longitude: number,
		lngNote = "",
		lngAmbiguous: string[] | null = null;
	if (g("lng") !== undefined) {
		longitude = Number(g("lng"));
		if (!Number.isFinite(longitude)) throw new Error(`--lng 应为数字，收到：${g("lng")}`);
	} else if (g("city")) {
		const found = findLongitude(String(g("city")));
		if (!found)
			throw new Error(
				`未收录城市：${g("city")}（可用 \`cities --search <关键词>\` 查询，或改用 --lng 指定经度）`
			);
		longitude = found.longitude;
		// 仅在「做了容错解析」或「存在同名歧义」时提示——用户写的就是表里的名字时不必打扰
		if (!found.exact)
			lngNote = `「${g("city")}」按「${found.matched}」解析 → 东经 ${found.longitude}°`;
		lngAmbiguous = found.ambiguous;
		if (lngAmbiguous && !lngNote) lngNote = `「${g("city")}」→ 东经 ${found.longitude}°`;
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
	let hour: number, hourNote: string;
	const wantLateZi = g("late-zi") === true || g("late-zi") === "true";
	// 23:00–23:59 出生 → 早/晚子时两口径会排出不同的盘，此标记用于上层给出提醒
	let lateZiCandidate = false;

	if (g("branch") !== undefined) {
		hour = Number(g("branch"));
		// 12 = 晚子时（安星按次日），是本 CLI 对 iztro timeIndex 12 的显式暴露
		if (!Number.isInteger(hour) || hour < 0 || hour > 12)
			throw new Error("--branch 应为 0-11（0=子 … 11=亥）或 12（晚子时）");
		hourNote =
			hour === 12 ? "直接指定 晚子时（子时，安星按次日）" : `直接指定 ${shichenLabel(hour)}`;
	} else if (g("time") !== undefined) {
		const m = /^(\d{1,2}):(\d{2})$/.exec(String(g("time")));
		if (!m) throw new Error(`时间格式应为 HH:MM，收到：${g("time")}`);
		const ch = Number(m[1]),
			cm = Number(m[2]);
		if (ch > 23 || cm > 59) throw new Error(`时间超出范围：${g("time")}`);
		const t = calcTrueSolar(ch, cm, longitude, { eot: useEot, year, month, day });
		lateZiCandidate = t.isLateZi;

		// 校正把时刻推出当天时，日期必须跟着走 —— 否则 (日, 时) 这个组合指向的不是出生时刻。
		// 真太阳时是一条连续时间轴，日期与时辰都得取自它（缘由见 calcTrueSolar 的 dayOffset）。
		// 日期是单点流入 info 的，改这里，下游（农历、排盘、合盘、流年）自动跟随。
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

		// 校正量的构成：默认只有经度项；开了 --eot 则多一项均时差（与经度无关，可能反号）
		const corrText = useEot
			? `经度 ${signed(t.longitudeMinutes)} 分 + 均时差 ${signed(t.eotMinutes)} 分 = ${signed(t.offsetMinutes)} 分`
			: `${signed(t.offsetMinutes)} 分`;
		const clockText = `钟表 ${String(ch).padStart(2, "0")}:${m[2]}`;

		if (t.isLateZi && wantLateZi) {
			hour = 12;
			hourNote = `${clockText} → 真太阳时校正 ${corrText} → 晚子时（安星按次日）`;
		} else {
			hour = t.branch;
			hourNote = `${clockText} → 真太阳时校正 ${corrText} → ${shichenLabel(hour)}`;
			if (t.isLateZi) hourNote += "（晚子时，按当日早子时口径）";
		}
		hourNote += dayShiftText;
	} else {
		throw new Error("缺少出生时辰：需 --time HH:MM 或 --branch 0-12");
	}

	if (wantLateZi && g("time") === undefined && g("branch") === undefined) {
		throw new Error("--late-zi 需配合 --time 使用");
	}

	const notes = [dateNote, lngNote, hourNote].filter(Boolean);
	return {
		info: {
			year,
			month,
			day,
			hour,
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
		isLateZi: hour === 12,
	};
}
