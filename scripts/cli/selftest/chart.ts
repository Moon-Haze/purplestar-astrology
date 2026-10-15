/**
 * 内核数据面断言组：排盘不变量、运限数据、三合派约束、格局四化、运限定位
 * （原 `cli/selftest.ts` 区块 5 / 5.5 / 6 / 7 与「运限定位」区）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入、
 * 样例盘改用 `./sample` 的 SAMPLE）；「体系合规」一条读 ctx.root 下的数据文件。
 * 「运限定位」三条在主 selftest 的调用序里排在契约对拍之后，与源码顺序一致。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { astro } from "iztro";
import { generateChart } from "@/algorithm";
import { detectPatterns } from "@/patterns";
import { palaceAtBranch } from "@/palace-relations";
import { checkForbiddenFeatures } from "@/school/guard";
import { SCHOOLS, DEFAULT_SCHOOL_ID } from "@/school/registry";
import { getPalaceByBranch } from "@/patterns/helpers";
import { getMutagenByStem, getYearStemIndex, getMonthlyMutagen } from "@/mutagen";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { yearlyBranchOf, agePalaceOf, parseAgesArg } from "../commands/fortune";
import { SAMPLE } from "./sample";
import { eq, type SelftestDeps } from "./kit";

/** 排盘不变量：十二宫齐全 / 地支不重复 / 命宫唯一 / 五行局合法 / 空宫借宫字段。 */
export function runChartInvariants({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("排盘不变量：换年口径显式锁在正月初一（yearDivide=normal）", () => {
		// generateChart 所在模块加载时已 astro.config({ yearDivide: "normal" })；
		// 这里读回全局配置钉住它 —— 库默认值漂移或全局配置被误改都会在此暴露
		const cfg = astro.getConfig();
		eq(cfg.yearDivide, "normal", "换年口径 ");
	});
	ok("排盘不变量：十二宫齐全 / 地支不重复 / 命宫唯一 / 五行局合法", () => {
		const c = generateChart(SAMPLE);
		eq(c.palaces.length, 12, "宫位数 ");
		eq(new Set(c.palaces.map(p => p.branch)).size, 12, "地支去重后 ");
		eq(c.palaces.filter(p => p.isSoulPalace).length, 1, "命宫数 ");
		if (![2, 3, 4, 5, 6].includes(c.fiveElementsClass)) {
			throw new Error(`五行局异常：${c.fiveElementsClass}`);
		}
		if (c.ziweiPos < 0 || c.ziweiPos > 11) {
			throw new Error(`紫微位异常：${c.ziweiPos}`);
		}
		if (c.decadals.length !== 12) {
			throw new Error(`大限数异常：${c.decadals.length}`);
		}
	});
	ok("排盘不变量：空宫均带借宫字段", () => {
		const c = generateChart(SAMPLE);
		for (const p of c.palaces.filter(x => x.isEmpty)) {
			if (p.borrowedFromName === undefined || p.borrowedStars === undefined) {
				throw new Error(`空宫 ${p.name} 缺 borrowedFromName / borrowedStars`);
			}
		}
	});
	ok("宫位查询：helpers 与 palace-relations 同源（候选 8）", () => {
		// 两实现曾各写查表（helpers 两步取模可缺省 / render 不取模必得），改一处
		// 不会有任何东西发现 —— 逐宫断言引用同一实现（收敛后此断言恒真，
		// 收敛前钉住「搬移无损」）。
		const c = generateChart(SAMPLE);
		for (const p of c.palaces) {
			const a = getPalaceByBranch(c, p.branch);
			const b = palaceAtBranch(c, p.branch);
			if (a !== b) {
				throw new Error(`branch ${p.branch} 两实现不同源`);
			}
		}
		return "12 宫两实现同源";
	});
}

/** 运限数据面：伪随机样本自洽、术语对齐、小限岁数表、命主身主、斗君。 */
export function runFortuneData({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("排盘不变量：随机样本自洽（伪随机 20 盘：十二宫 / ages 覆盖 / 斗君 / 星曜分类）", () => {
		// 随机性进测试覆盖、不进期望值（spec §3.4）：线性同余取**确定性伪随机**——
		// 「随机」的样本覆盖是可复现的，任何一次运行都不依赖真随机性。
		let seed = 20260930;
		const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
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
			if (c.palaces.length !== 12 || new Set(c.palaces.map(p => p.branch)).size !== 12) {
				throw new Error(`${year}-${month}-${day} 十二宫不自洽`);
			}
			const ages = [...new Set(c.palaces.flatMap(p => p.ages ?? []))].sort((a, b) => a - b);
			if (ages.length !== 120 || ages[0] !== 1 || ages[119] !== 120) {
				throw new Error(`${year}-${month}-${day} ages 覆盖不自洽`);
			}
			if (c.douJunBranch < 0 || c.douJunBranch > 11) {
				throw new Error("斗君越界");
			}
			if (
				c.palaces.some(p =>
					p.stars.some(st => !["major", "minor", "soft", "tough"].includes(st.type))
				)
			) {
				throw new Error("星曜类型值不自洽");
			}
		}
		return "20 个伪随机盘全部自洽";
	});
	ok("术语对齐：iztro 字段名生效（fiveElementsClass / soulBranch / ages / mutagen）", () => {
		// 术语五层对齐（spec §2.9）：类型值 lucky/sha→soft/tough、SiHua→Mutagen、
		// DaXian→Decadal；内核字段 wuxingJu→fiveElementsClass、mingGongBranch→soulBranch、
		// shenGongBranch→bodyBranch、xiaoXianAges→ages、isMingGong→isSoulPalace 等。
		const c = generateChart(SAMPLE);
		if (!("fiveElementsClass" in c) || !("soulBranch" in c) || !("bodyBranch" in c)) {
			throw new Error("chart 字段未对齐 iztro");
		}
		const p = c.palaces.find(x => x.isSoulPalace);
		if (!p) {
			throw new Error("isSoulPalace 不存在");
		}
		// ⚠️ 探针拆串（"lu"+"cky"）：防止后续批量改名 sed 把断言探针连同实现一起替换，
		//    那会让这条断言变成恒真（Task 3 实测踩过）。
		const oldLucky = "lu" + "cky";
		const oldSha = "s" + "ha";
		if (c.palaces.some(x => x.stars.some(s => s.type === oldLucky || s.type === oldSha))) {
			throw new Error("Star.type 仍有 lucky/sha 残留");
		}
		if (
			c.palaces.some(x => x.stars.some(s => s.type === "soft" || s.type === "tough")) ===
			false
		) {
			throw new Error("soft/tough 未出现");
		}
		return "字段/类型值对齐";
	});
	ok("运限数据：小限岁数表 1–120 连续、每宫恰 10 个（iztro ages 提取）", () => {
		const c = generateChart(SAMPLE);
		const all = c.palaces.flatMap(p => p.ages ?? []);
		const uniq = [...new Set(all)].sort((x, y) => x - y);
		eq(uniq.length, 120, "岁数去重后 ");
		for (let i = 0; i < 120; i++) {
			if (uniq[i] !== i + 1) {
				throw new Error(`岁数表不连续：第 ${i} 位是 ${uniq[i]}，应为 ${i + 1}`);
			}
		}
		for (const p of c.palaces) {
			if ((p.ages ?? []).length !== 10) {
				throw new Error(`${p.name} 的小限岁数不是 10 个：${(p.ages ?? []).join(",")}`);
			}
		}
		// 校准锚点：1990 样例命宫(子)的小限自虚岁 9 起
		const ming = c.palaces.find(p => p.isSoulPalace);
		if (!ming) {
			throw new Error("找不到命宫");
		}
		eq(ming.ages?.[0], 9, "命宫首岁 ");
	});
	ok("运限数据：命主 / 身主随盘输出（iztro soul / body）", () => {
		const c = generateChart(SAMPLE);
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
		const c = generateChart(SAMPLE);
		eq(BRANCHES[c.douJunBranch], "寅", "1990 样例斗君 ");
	});
}

/** 三合派硬约束守护（防止飞星派逻辑回流）与两库引句口径合规。 */
export function runSchoolGuard({ ok, ctx }: Pick<SelftestDeps, "ok" | "ctx">): void {
	// 绊线改为**声明式**：读 SchoolAdapter.forbiddenFeatures，不再硬编码「查 selfMutagen 字段」。
	// 换流派只需换适配器；不含该禁忌的空壳流派天然不报此错（见 test/school.test.ts）。
	ok("三合派约束：宫干自化未被填充（读 SchoolAdapter.forbiddenFeatures）", () => {
		const c = generateChart(SAMPLE);
		const v = checkForbiddenFeatures(c, SCHOOLS[DEFAULT_SCHOOL_ID]);
		if (v.length) {
			throw new Error(`体系禁用特征被触发：${v.map(x => x.detail).join("；")}`);
		}
	});
	ok("三合派约束：大限未携带宫干四化字段", () => {
		const c = generateChart(SAMPLE);
		const dirty = c.decadals.filter(
			d => d.mutagen !== undefined || d.stemIndex !== undefined || d.stemName !== undefined
		);
		if (dirty.length) {
			throw new Error(
				`检测到大限携带四化/宫干字段：${dirty.length} 条（飞星派逻辑疑似回流）`
			);
		}
	});
	ok("体系合规：合盘输出无飞星派断语，两库引句口径不打架", () => {
		const k = readFileSync(resolve(ctx.root, "synastry", "synastry-knowledge.ts"), "utf8");
		if (/自化(禄|权|科|忌)/.test(k)) {
			throw new Error(
				"synastry-knowledge 仍含「自化」断语——体系不计算宫干自化，用户可见文案不得出现"
			);
		}
		const d = readFileSync(resolve(ctx.root, "analysis", "data.ts"), "utf8");
		// 七杀「毁一半」引句是 suspect 档：两库各自引用时，引句前 40 字内必须带
		// 「坊间流传」口径标注（data.ts 形态「坊间流传倪师笑言（未核实）」、
		// synastry 形态「（坊间流传，未核实倪师原话）」）——两文件分开读、分开判，
		// 文件其他位置出现「坊间流传」四字不放行。
		const qiShaQuote = "差不多毁了一半";
		const assertQiShaLabeled = (src: string, srcName: string) => {
			const i = src.indexOf(qiShaQuote);
			if (i < 0) {
				return;
			} // 该库不引用此句则无需标注
			if (!src.slice(Math.max(0, i - 40), i).includes("坊间流传")) {
				throw new Error(`${srcName} 七杀「毁了一半」引句丢失「坊间流传」未核实标注`);
			}
		};
		assertQiShaLabeled(d, "data.ts");
		assertQiShaLabeled(k, "synastry-knowledge");
		if (k.includes("必有重大灾祸")) {
			throw new Error("太阳「三不见」在 synastry 侧被强化为「必有」——两库口径打架");
		}
		if (d.includes("二十八岁后")) {
			throw new Error("武曲晚婚门槛 data.ts 仍为 28 岁——应统一为 30 岁");
		}
		// corpus/data 侧的飞星词白名单机检（spec §4.3，与上方 synastry-knowledge 禁词
		// 对偶）：「自化 / 来因宫 / 飞化」只允许出现在否定 / 辨析语境——白名单按文件钉
		// **稳定子串**而非行号（行号随文案增删漂移，子串跟着语境走）：quanshu 的辨析条
		// （「北派飞星派之自化……倪师不主张使用」）与 quanji 的口径括注（「古籍原文如此」）。
		// gusuifu 零白名单——任何新出现的第三处即红。注释行不参与（非用户可见文案，
		// 与 grades 断言的过滤同一先例）。
		const FLYING_WORDS = /自化|来因宫|飞化/;
		const CLASSICS_FLYING_WHITELIST: Readonly<Record<string, readonly string[]>> = {
			"gusuifu.ts": [],
			"quanji.ts": ["古籍原文如此"],
			"quanshu.ts": ["北派飞星派之自化"],
		};
		for (const [file, pins] of Object.entries(CLASSICS_FLYING_WHITELIST)) {
			const src = readFileSync(resolve(ctx.root, "corpus", "data", file), "utf8");
			const offender = src
				.split("\n")
				.map((line, i) => ({ line: line.trim(), no: i + 1 }))
				.filter(({ line }) => FLYING_WORDS.test(line))
				.filter(({ line }) => !/^(\/\/|\/\*|\*)/.test(line))
				.find(({ line }) => !pins.some(p => line.includes(p)));
			if (offender) {
				throw new Error(
					`corpus/data/${file} L${offender.no} 出现白名单外飞星词（自化/来因宫/飞化）：` +
						`「${offender.line.slice(0, 40)}」——体系不计算宫干飞化，用户可见文案只允许` +
						`否定/辨析语境（本文件白名单：${pins.join("、") || "无"}）`
				);
			}
		}
	});
}

/** 格局识别与四化口径（生年取农历年干、流年取公历年取模、流月五虎遁）。 */
export function runPatternMutagen({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("格局识别：返回数组且每条含 name / level", () => {
		const ps = detectPatterns(generateChart(SAMPLE));
		if (!Array.isArray(ps)) {
			throw new Error("detectPatterns 未返回数组");
		}
		for (const p of ps) {
			if (!p.name || !p.level) {
				throw new Error(`格局条目缺字段：${JSON.stringify(p).slice(0, 80)}`);
			}
		}
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
}

/** 运限定位：年支 / 小限宫 / 虚岁参数解析（在主报告序里位于契约对拍之后）。 */
export function runFortuneLocator({ ok }: Pick<SelftestDeps, "ok">): void {
	ok("运限定位：yearlyBranchOf 按公历年取年支（1990→午 / 2026→午 / 2000→辰）", () => {
		eq(BRANCHES[yearlyBranchOf(1990)], "午");
		eq(BRANCHES[yearlyBranchOf(2026)], "午");
		eq(BRANCHES[yearlyBranchOf(2000)], "辰");
	});
	ok("运限定位：agePalaceOf 找到该虚岁的小限宫，越界必须抛错", () => {
		const c = generateChart(SAMPLE);
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
}
