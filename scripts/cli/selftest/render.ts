/**
 * 渲染与知识源断言组：知识源可用性、专题渲染各节（原 `cli/selftest.ts`
 * 区块 8 与「专题渲染」区）。
 *
 * @remarks
 * 断言体原样搬移，只改依赖归属（harness 经 {@link SelftestDeps} 注入）；
 * 「知识源」组在主 selftest 的调用序里位于格局四化之后，「专题渲染」组
 * 位于运限定位之后，均与源码顺序一致。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateChart } from "@/ziwei/algorithm";
import { STAR_DESCRIPTIONS } from "@/ziwei/constants";
import {
	filterGenderContent,
	getTopicAnalysis,
	TOPIC_LABEL,
	type TopicKey,
	type AnalysisView,
} from "@/ziwei/analysis";
import {
	decadalSection,
	focusSection,
	patternSection,
	infoSection,
	yearlySection,
	overviewSection,
	mutagenSection,
	ageSection,
} from "../fortune";
import { SAMPLE } from "./sample";
import { eq, type SelftestDeps } from "../selftest-kit";

/** 知识源可用性：星曜释义、主题论断库、多视角产出、引导层依赖豁免。 */
export function runKnowledgeSource({ ok, ctx }: Pick<SelftestDeps, "ok" | "ctx">): void {
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
		const c = generateChart(SAMPLE);
		const bad = (Object.keys(TOPIC_LABEL) as TopicKey[]).filter(k => {
			const t = getTopicAnalysis(c, k);
			return t.length < 100 || t.includes("无法找到");
		});
		if (bad.length) throw new Error(`以下主题产出异常：${bad.join("、")}`);
		return "13 主题全部产出";
	});
	ok("论断：四种 view（mingpan/daxian/liunian/liuyue）均可产出", () => {
		const c = generateChart(SAMPLE);
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
}

/** 专题渲染：概览 / 基本信息 / 流年 / 大限 / 小限 / 格局 / 四化 / 聚焦各节形态。 */
export function runTopicRender({ ok }: Pick<SelftestDeps, "ok">): void {
	ok(
		"专题渲染：概览节 = 运限速览一行（虚岁/大限/流年命宫/小限）+ 专题指路（零输入演示态用）",
		() => {
			const c = generateChart(SAMPLE);
			const text = overviewSection(c, 2026).join("\n");
			if (!text.includes("【运限速览】")) throw new Error("缺【运限速览】标题");
			if (!text.includes(`虚岁 ${c.currentAge}`)) throw new Error("缺当前虚岁");
			if (!text.includes("大限")) throw new Error("缺大限速览");
			if (!text.includes("2026 丙午")) throw new Error("缺流年干支");
			if (!text.includes("流年命宫")) throw new Error("缺流年命宫");
			if (!text.includes("小限")) throw new Error("缺小限速览");
			for (const f of [
				"--yearly",
				"--decadal",
				"--ages",
				"--pattern",
				"--mutagen",
				"--focus",
				"--palaces",
				"--topic",
			])
				if (!text.includes(f)) throw new Error(`专题指路缺 ${f}`);
		}
	);
	ok("专题渲染：基本信息专题逐项输出（2000-4-6 子时男，对齐外部排盘参照）", () => {
		const c = generateChart({ year: 2000, month: 4, day: 6, timeIndex: 0, gender: "male" });
		const text = infoSection(c, {
			clockTime: "2000-4-6 0:15",
			solarNote: "钟表 0:15 → 真太阳时校正 -7 分 → 子时",
			longitude: 120,
		}).join("\n");
		const want = [
			"性别 : 男",
			"公历生日 : 2000-04-06",
			"地理经度 : 120.000",
			"钟表时间 : 2000-4-6 0:15",
			"农历时间 : 庚辰年三月初二日子时",
			// 两口径相同（该样例年柱/月柱分界一致）→ 合并为一行（O3：并列相同值是噪音）
			"四柱(节气与非节气同) : 庚辰 庚辰 甲午 甲子",
			"五行局数 : 金四局",
			"命盘类型 : 三合盘(天盘)",
			// 面板含命宫行与三方四正（公历生日见上）
			"命宫:",
			"紫微落:",
			"三方四正:",
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
	ok("专题渲染：节气与非节气四柱分叉时并列两行（2021-02-08，立春后/正月初一前）", () => {
		// 2021 立春 2-03、正月初一 2-12：2-08 出生者节气口径已入辛丑年、农历口径
		// 仍在庚子年腊月 —— 年/月柱分叉，正是需要并列对照的形态。
		const c = generateChart({ year: 2021, month: 2, day: 8, timeIndex: 4, gender: "male" });
		const text = infoSection(c, { clockTime: "8:30", solarNote: "", longitude: 120 }).join(
			"\n"
		);
		const jie = text.split("\n").find(l => l.startsWith("节气四柱 : "));
		const fei = text.split("\n").find(l => l.startsWith("非节气四柱 : "));
		if (!jie || !fei) throw new Error(`两口径分叉时应并列两行，实得：\n${text}`);
		if (jie.slice("节气四柱 : ".length) === fei.slice("非节气四柱 : ".length))
			throw new Error("样例选取失效：两口径竟然相同，请换立春/正月初一之间的日期");
		return "分叉时两行对照在";
	});
	ok("专题渲染：流年专题（流年命宫 / 三方四正 / 四化落点 / 与大限关系）", () => {
		const c = generateChart(SAMPLE);
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
		const c = generateChart(SAMPLE);
		const text = decadalSection(c, 37).join("\n");
		if (!text.includes("36-45")) throw new Error("缺当前大限区间");
		if (!text.includes("116-125")) throw new Error("缺大限时间轴首尾（116-125）");
		// 卯限的三方四正 = 卯未亥 + 对宫酉 = 田宅/疾厄/兄弟/子女
		if (!text.includes("疾厄宫") || !text.includes("兄弟宫")) throw new Error("缺大限三方四正");
		// 生年化科太阴落卯（大限本宫）
		if (!text.includes("太阴")) throw new Error("缺生年四化落大限三方的标注");
		// 限内逐年表：37 岁 = 2026 丙午 流年命宫午；小限官禄宫
		if (!text.includes("37岁") || !text.includes("丙午")) throw new Error("缺限内逐年对照表");
		if (!text.includes("小限")) throw new Error("逐年表缺小限列");
	});
	ok("专题渲染：小限专题（小限宫 / 三方四正 / 岁数分布 / 与流年关系）", () => {
		const c = generateChart(SAMPLE);
		const text = ageSection(c, 37, 2026).join("\n");
		// 37 岁小限 = 官禄宫(辰)
		if (!text.includes("官禄宫")) throw new Error("缺小限宫（37 岁应为官禄宫）");
		if (!text.includes("三方四正")) throw new Error("缺小限三方四正");
		if (!text.includes("小限岁数")) throw new Error("缺十二宫小限岁数分布表");
		if (!text.includes("流年")) throw new Error("缺小限与流年命宫的对照");
	});
	ok("专题渲染：格局专题沿用格局识别（含成立条件与出处）", () => {
		const c = generateChart(SAMPLE);
		const text = patternSection(c).join("\n");
		if (!text.includes("【格局识别】")) throw new Error("缺【格局识别】标题");
		if (!text.includes("英星入庙格")) throw new Error("缺样例盘必有格局（英星入庙）");
		if (!text.includes("出处")) throw new Error("缺出处行");
	});
	ok("专题渲染：四化专题（生年 + 大限宫干 + 流年 + 同星引动；流月可选）", () => {
		const c = generateChart(SAMPLE);
		const text = mutagenSection(c, { liuNianYear: 2026 }).join("\n");
		if (!text.includes("【生年四化】")) throw new Error("缺生年四化节");
		if (!text.includes("化禄 太阳 → 兄弟宫")) throw new Error("缺生年化禄落宫（兄弟宫）");
		if (!text.includes("大限四化")) throw new Error("缺大限宫干四化节（文墨排盘口径）");
		if (!text.includes("【2026 流年四化】")) throw new Error("缺流年四化节");
		if (!text.includes("天同")) throw new Error("缺生年×流年同星引动标注");
		const withMonth = mutagenSection(c, { liuNianYear: 2026, liuYueMonth: 6 }).join("\n");
		if (!withMonth.includes("流月四化")) throw new Error("给了农历月却缺流月四化节");
	});
	ok("专题渲染：宫盘聚焦专题（三方四正会照 / 四化落宫 / 运限引动）", () => {
		const c = generateChart(SAMPLE);
		const text = focusSection(c, "命宫", 2026).join("\n");
		if (!text.includes("【聚焦：命宫】")) throw new Error("缺聚焦标题");
		if (!text.includes("会照")) throw new Error("缺三方四正会照星曜");
		// 命宫(子)的对宫是迁移宫(午) = 2026 流年命宫 → 应有引动标注
		if (!text.includes("流年命宫")) throw new Error("缺流年引动标注");
		if (!text.includes("大限")) throw new Error("缺大限年龄段标注");
	});
	// ── 性别过滤上公开面（候选 7）：filterGenderContent 此前只被内核自用，
	// 外部（测试/消费方）无从直测 —— 断言**必须经 @/ziwei/analysis 公开面 import，
	// 直插 ./lookups 即本组失败的意义（公开面缺导出 → 模块链接期就崩）。 ──
	ok("性别过滤：male 的 getTopicAnalysis 不含女命残留（候选 7）", () => {
		const c = generateChart(SAMPLE);
		const out = getTopicAnalysis(c, "overview");
		if (out.includes("；女命") || out.includes("（女命）"))
			throw new Error("存在女命残留——整篇过滤未生效");
		return "男命输出无女命残留";
	});
	ok("性别过滤：filterGenderContent 三条规则直测", () => {
		const f = filterGenderContent("甲；女命宜静。乙\n（女命）丙\n女命主柔。", "male");
		if (f.includes("女命")) throw new Error(`规则未生效：${JSON.stringify(f)}`);
		const g = filterGenderContent("男命主刚。乙", "female");
		if (g.includes("男命")) throw new Error("female 侧未过滤男命句");
		return "male/female 两侧三规则在";
	});
	ok("性别过滤：整篇作用域——跨行子句在拼接后被删", () => {
		// 构造跨行输入：「；女命」子句横跨 \n，逐行过滤会漏、整篇过滤会删
		const input = "上句；女命\n下句继续。";
		const f = filterGenderContent(input, "male");
		if (f.includes("女命")) throw new Error("跨行子句残留——过滤未作用于整篇");
		return "整篇作用域在";
	});
}
