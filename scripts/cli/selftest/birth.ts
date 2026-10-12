/**
 * 出生信息构造层断言组：城市容错、性别护栏、出生信息形态（原 `cli/selftest.ts`
 * 区块 4 / 4.5 与「出生信息」区）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入）；
 * 「出生信息形态」三条在主 selftest 的调用序里排在解析引擎之后，与源码顺序一致。
 */

import { buildBirthInfo, findLongitude } from "../birth-info";
import { parseArgs } from "../args";
import { chartSignature } from "../render";
import { generateChart } from "@/algorithm";
import { eq, type SelftestDeps } from "../selftest-kit";

/** 城市容错：别名解析 / 未收录 / exact 标志 / 未给地点提示。 */
export function runCityTolerance({ ok }: Pick<SelftestDeps, "ok">): void {
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
}

/** 性别护栏：缺失 / 非法一律报错，别名等价。 */
export function runGenderGuard({ ok }: Pick<SelftestDeps, "ok">): void {
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
	//    搬去 `synastry` 的断言组（`synastry/selftest-asserts.ts`）—— `a-` / `b-` 前缀
	//    只有 `synastry` 命令认（`--a-chart` 在这里是**未知参数**，直接报错），那条文案护栏
	//    在排盘侧没有可复现的入口。
}

/** 出生信息形态：位置参数归类、城市 token 边界、日期 round-trip 校验。 */
export function runBirthInfoShape({ ok }: Pick<SelftestDeps, "ok">): void {
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
	ok("出生信息：公历日期不存在的 round-trip 校验（不静默归一化出错盘）", () => {
		// JS Date 会把 2011-02-30 静默归一化成 03-02：标题印 02-30、实际排 03-02 的错盘，
		// --json 的 birthInfo.day=30 与 lunarInfo.lunarDay 更自相矛盾。反查
		// 必须原样回来，否则报错（与农历路径的回环校验同一立场）。文案须回显原始输入。
		for (const bad of ["2011-02-30", "2011-02-29"]) {
			let msg = "";
			try {
				buildBirthInfo(parseArgs(["--date", bad, "07:45", "杭州", "male"], "astrology"));
			} catch (e) {
				msg = (e as Error).message;
			}
			// 文案判据按任务口径二选一：含原始输入（回显）或含「不存在」
			if (!msg || !(msg.includes(bad) || msg.includes("不存在")))
				throw new Error(`${bad} 未报错或文案未回显原始输入，实得：${msg || "未报错"}`);
		}
		// 位置参数形态与 --date 在 buildBirthInfo 汇合，必须同受校验（宽松格式 2011-2-30）
		let posMsg = "";
		try {
			buildBirthInfo(parseArgs(["2011-2-30", "07:45", "杭州", "male"], "astrology"));
		} catch (e) {
			posMsg = (e as Error).message;
		}
		if (!posMsg.includes("2011-2-30"))
			throw new Error(`位置参数 2011-2-30 未报错或未回显原文，实得：${posMsg || "未报错"}`);
		// 闰年边界不得误伤：2012-02-29 必须原样通过
		const leap = buildBirthInfo(
			parseArgs(["--date", "2012-02-29", "07:45", "杭州", "male"], "astrology")
		);
		eq(leap.info.year, 2012, "闰年 2-29 年份 ");
		eq(leap.info.month, 2, "闰年 2-29 月份 ");
		eq(leap.info.day, 29, "闰年 2-29 日 ");
		// 宽松合法格式先归一再校验，1990-5-15 不受影响
		const loose = buildBirthInfo(
			parseArgs(["--date", "1990-5-15", "07:45", "杭州", "male"], "astrology")
		);
		eq(loose.info.day, 15, "宽松格式 1990-5-15 日 ");
		return "2-30 / 平年 2-29 报错并回显；闰年 2-29 与宽松格式放行";
	});
}
