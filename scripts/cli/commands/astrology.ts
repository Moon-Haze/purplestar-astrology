/**
 * `astrology` 命令：排盘分析。各命令按文件拆分（spec §2.2）；chart/topic 融入参数。
 */

import type { BirthInfo, Mutagen, ZiweiChart } from "@/types";
import type { CliArgs } from "../args";
import {
	camelKey,
	DEEP_DIVE_KEYS,
	EXCLUSIVE_BRANCHES,
	EXCLUSIVE_PRIORITY_LABEL,
	SHADOWABLE_KEYS,
	VIEW_ALIASES,
	VIEW_TEXT,
} from "../args/table";
import { renderTemplate } from "../args/config-input";
import { clockOptsFromBasis } from "../birth/birth-info-defs";
import {
	birthplaceSection,
	fmtDate,
	genderCN,
	lateZiSection,
	locateSihua,
	renderPalace,
	surroundNames,
} from "../chart/render";
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
import { generateChartCached } from "../chart/chart-cache";
import { lateZiCounterChart } from "../chart/late-zi";
import { prepareAstrologyContext, type AstrologyContext } from "./astrology-context";
import { detectPatterns } from "@/patterns";
import { getMingGongSummary } from "@/analysis/soul-summary";
import { buildMutagenChain } from "@/mutagen";
import { STEMS, BRANCHES } from "@/data/ganzhi";
import { buildReport } from "./report";
import { getTopicAnalysis, TOPIC_LABEL, TOPIC_PALACE_NAME, type TopicKey } from "@/analysis";
import { KNOWLEDGE_GRADE_ORDER } from "@/analysis/grades";

/**
 * `--view` 别名 / 文案收在 `../args/table`（VIEW_ALIASES / VIEW_TEXT）：本模块 import 消费。
 */

/**
 * 抬头行：--palaces 与 --topic 共用；名字缺省省略，不留双空格（评审 N1：曾手拼缺名残留三空格，收编单点）。
 *
 * @param title - 抬头标题（本模块为「命盘  」或「【主题论断 · X】」）
 * @param info - 出生信息（`name` / `gender`；`name` 缺省省略名字槽）
 * @param note - 排盘口径说明（`CaliberBasis.note`，钟表时刻 → 时辰换算）
 * @returns 单行抬头
 */
function chartHeader(title: string, info: BirthInfo, note: string): string {
	const namePart = info.name ? `${info.name} ` : "";
	return `${title}${namePart}${fmtDate(info)} ${note} · ${genderCN(info.gender)}`;
}

/**
 * `--json` 产物（生产端）：`astrology --json` 顶层契约，`synastry/chart-view 的 readAnalyzeJson` 消费的形状。
 *
 * @remarks
 *
 * @param input - 语义入参：`chart` 命盘、`liuNianYear` 流年号、`liuYueMonth` 农历月（null 不算流月）、`liuRiDay` 农历日（null/undefined 不算流日）、`liuShiHour` 时支 0-12（null/undefined 不算流时，12 晚子时）、`basis` 排盘依据
 * @returns 顶层键恒定的 JSON 串（未配置运限层 `null`；键集以本函数序列化对象为准）
 *
 * 提为具名纯函数，契约一处生产、一处消费、一处对拍，selftest 可直调校验。
 * 顶层键十三键恒定、未配置运限层 null，冻结面见 docs/code/cli-commands.md，不复述（评审 S1：手抄清单曾漏三键致漂移无红灯）。
 */
export function buildAnalyzeJson(input: {
	chart: ZiweiChart;
	/** 流年号（`--yearly`；缺省当年由 caller 经 parseYearlyArg 归一） */
	liuNianYear: number;
	/** 农历月 1-12；`null` = 不算流月 */
	liuYueMonth: number | null;
	/** 农历日 1-30；`null`/`undefined` = 不算流日（须配 liuYueMonth） */
	liuRiDay?: number | null;
	/** 时支 0-12；`null`/`undefined` = 不算流时（须配 liuRiDay） */
	liuShiHour?: number | null;
	/**
	 * 排盘依据（日期换算 / 出生地解析 / 时辰校正），原样进 `basis`。传整包 `CaliberBasis`（结构超集，变量传参无 excess 检查；JSON 只出四键，冻结）
	 */
	basis: { note: string; notes: readonly string[]; lateZiCandidate: boolean; isLateZi: boolean };
}): string {
	const { chart, liuNianYear, liuYueMonth, liuRiDay, liuShiHour, basis } = input;
	// 派生收进内部：六层链单点在 @/mutagen 的 buildMutagenChain（含 1990-01-15 反例红线注释），本函数只装配 JSON。
	const { native, liuNian, liuYue, liuRi, liuShi, daXian } = buildMutagenChain(chart, {
		liuNianYear,
		liuYueMonth,
		liuRiDay,
		liuShiHour,
	});
	return JSON.stringify(
		{
			chart,
			patterns: detectPatterns(chart),
			mingGongSummary: getMingGongSummary(chart),
			nativeSiHua: {
				stem: native.stemName,
				transforms: native.transforms,
				located: locateSihua(chart, native.transforms),
			},
			liuNianSiHua: {
				year: liuNianYear,
				stem: liuNian.stemName,
				transforms: liuNian.transforms,
				located: locateSihua(chart, liuNian.transforms),
			},
			liuYueSiHua: liuYue
				? {
						month: liuYueMonth,
						stem: liuYue.stemName,
						transforms: liuYue.transforms,
						located: locateSihua(chart, liuYue.transforms),
					}
				: null,
			daXianSiHua: daXian
				? {
						stem: daXian.stemName,
						transforms: daXian.transforms,
						located: locateSihua(chart, daXian.transforms),
					}
				: null,
			liuRiSiHua: liuRi
				? {
						lunarYear: liuNianYear,
						lunarMonth: liuYueMonth,
						lunarDay: liuRiDay,
						stem: liuRi.stemName,
						transforms: liuRi.transforms,
						located: locateSihua(chart, liuRi.transforms),
					}
				: null,
			liuShiSiHua: liuShi
				? {
						hourBranch: liuShiHour,
						stem: liuShi.stemName,
						transforms: liuShi.transforms,
						located: locateSihua(chart, liuShi.transforms),
					}
				: null,
			// 流年命宫与小限宫（运限速览等价物，只加不删）。流年地支一次算好：三处同值，免「这三处是否同值」疑虑。
			liuNianPalace: (() => {
				const lnBranch = yearlyBranchOf(liuNianYear);
				return {
					year: liuNianYear,
					branchIndex: lnBranch,
					branch: BRANCHES[lnBranch],
					palaceName: chart.palaces.find(p => p.branch === lnBranch)?.name ?? null,
				};
			})(),
			xiaoXian: (() => {
				const p = agePalaceOf(chart, chart.currentAge);
				return {
					age: chart.currentAge,
					palaceBranchIndex: p.branch,
					palaceBranch: BRANCHES[p.branch],
					palaceName: p.name,
				};
			})(),
			lateZi: { candidate: basis.lateZiCandidate, applied: basis.isLateZi },
			// basis：让 JSON 自描述「这张盘是怎么来的」，下游据此复述真太阳时与晚子时提示。键名不叫 trueSolar（notes 含农历换算与出生地解析）。⚠️ 显式四键冻结契约（chart-view.ts 只声明四键）：整包序列化多出 longitude/lngNote/clockTime 等键，类型拦不住运行时，键集在此声明，论证见 docs/code/cli-commands.md。
			basis: {
				note: basis.note,
				notes: basis.notes,
				lateZiCandidate: basis.lateZiCandidate,
				isLateZi: basis.isLateZi,
			},
		},
		null,
		2
	);
}

/** 零输入演示的头部声明（面板前）与用法指路（面板后）。 */
const SAMPLE_HEADER = "（未给出生信息 —— 以下为内置虚构示例的演示盘）";
const SAMPLE_TRAILER = [
	"",
	"── 零输入演示：以上为虚构示例盘（2011-06-24 杭州男，与 help 示例同源）。排你自己的盘：",
	"   node scripts/purple-star.ts astrology 1990-5-15 9:30 男 北京",
	"   node scripts/purple-star.ts astrology --date 1990-5-15 --time 9:30 --gender 男 --city 北京",
	"   完整参数运行 help 查看。（示例数据为虚构，无真实人物）",
];

/**
 * 独占分支（`--palaces` / `--topic` / `--report` / `--info`）激活时其余参数不生效 —— 静默吞违反「宁可启动失败，也不静默产出错盘」，这里指路。
 *
 * 判定链单点在 `../args/table` 的 `EXCLUSIVE_BRANCHES`：本函数统一检测入口——前置段 bespoke 拒收抛专用文案（`--report × --view`），后置段通用被吞检测（放行集合 = `consumes`），清单序即优先级；见 docs/code/cli-commands.md。
 *
 * @param args - CLI 参数表（`camelKey` 查旗标；`undefined` 即未给）
 * @param exclusive - 命中的独占分支旗标名（带 `--`，须在 `EXCLUSIVE_BRANCHES` 登记）
 * @returns 无返回值；仅有参数被静默吞时抛错
 * @throws 分支声明 bespoke 拒收（如 `--report × --view`）且旗标在场抛专用文案；放行集合外有参数在场抛被吞清单与优先级指路
 */
function assertNoShadowedFeatures(
	args: CliArgs,
	exclusive: "--palaces" | "--topic" | "--report" | "--info"
): void {
	const entry = EXCLUSIVE_BRANCHES.find(b => `--${b.name}` === exclusive);
	// 前置段（bespoke 拒收）先于通用检测，「不接受 --view」这类信息量高的
	// 指路不被抢跑——次序由唯一入口的调用结构固定，没有可对调的调用点
	// （2026-11-11 移序后前提固化为结构）。
	const bespoke = entry?.rejectsWithNote;
	if (bespoke) {
		for (const key of bespoke.keys) {
			if ((args as Record<string, unknown>)[camelKey(key)] !== undefined) {
				throw new Error(bespoke.note.replace("{flag}", `--${key}`));
			}
		}
	}
	// 后置段（通用检测）：被吞域 = SHADOWABLE_KEYS − 独占自身 − 放行集合
	//（`consumes` 从清单派生，不手抄，见 EXCLUSIVE_BRANCHES）。
	const consumed = entry?.consumes ?? [];
	const shadowed = [...SHADOWABLE_KEYS]
		// 排除独占自身：info 在 SHADOWABLE（专题深入组），不过滤会报
		// 「--info 不会生效：--info」自指文案（palaces / topic 本不在集合）。
		.filter(n => n !== exclusive.slice(2))
		.filter(n => !consumed.includes(n))
		.filter(n => (args as Record<string, unknown>)[camelKey(n)] !== undefined);
	if (shadowed.length) {
		throw new Error(
			`${exclusive} 是独占分支，以下功能参数不会生效：${shadowed.map(n => `--${n}`).join("、")}。` +
				`独占分支请单独使用（优先级：${EXCLUSIVE_PRIORITY_LABEL}）。`
		);
	}
}

/**
 * 「给定 args + 排盘上下文 → 产出专题 section 序列」—— 候选 3 把旗标 → section 接线升为可直测 interface（原 `cmdAstrology` 内联块）：接线即被测物，fortune 各 `*Section` 退为零件，守卫链与 `parseAgesArg` / `deepDive` 门沉进同一实现。
 *
 * 行为契约：与迁移前内联块逐字节等价（无深掘带信息面板 + 运限速览；给专题旗标跳过基底，按 pattern → mutagen → yearly → decadal → ages → focus 序追加）。收益见 docs/code/cli-commands.md。
 *
 * @param ctx - 装配上下文（`prepareAstrologyContext` 产物）：chart / args / 流年月日时 / basis / info —— 与测试跨同一 seam（评审候选 4）
 * @returns 已按顺序拼好的输出行（不含末尾 join）
 */
export function composeSections(ctx: AstrologyContext): string[] {
	const { chart, args, liuNianYear, liuYueMonth, liuRiDay, liuShiHour, basis, info } = ctx;
	const out: string[] = [];
	out.push(...birthplaceSection(basis));
	out.push(...lateZiSection(chart, basis, lateZiCounterChart(info, basis)));
	// 深掘判据从声明派生（deep: true 六旗标）。
	const deepDive = DEEP_DIVE_KEYS.some(k => (args as Record<string, unknown>)[k] !== undefined);
	if (!deepDive) {
		out.push(
			"",
			...infoSection(chart, clockOptsFromBasis(basis)),
			"",
			...overviewSection(chart, liuNianYear)
		);
	}
	if (args.pattern) {
		out.push("", ...patternSection(chart));
	}
	// 流月/流日/流时四化随四化专题输出：单独给（不带 --mutagen）会被静默吞，这里指路。
	// 只约束文本路径 —— --json 的顶层键独立（基准对拍依赖裸 --json --monthly）。
	if (
		(args.monthly !== undefined || args.daily !== undefined || args.hourly !== undefined) &&
		!args.mutagen
	) {
		throw new Error(
			"--monthly / --daily / --hourly 需要 --mutagen：运限四化在四化专题中输出，请加 --mutagen（流年缺省取当年，可用 --yearly 指定）。"
		);
	}
	if (args.daily !== undefined && liuYueMonth === null) {
		throw new Error(
			"--daily 需要 --monthly：流日干挂在农历年月日上，请用 --monthly 提供农历月（流年缺省取当年，可用 --yearly 指定）。"
		);
	}
	if (args.hourly !== undefined && args.daily === undefined) {
		throw new Error(
			"--hourly 需要 --daily：流时干由日干五鼠遁推，请用 --daily 提供农历日（时支 12 = 晚子时，按当日日干起遁）。"
		);
	}
	if (args.mutagen) {
		out.push("", ...mutagenSection(chart, { liuNianYear, liuYueMonth, liuRiDay, liuShiHour }));
	}
	if (args.yearly !== undefined) {
		out.push("", ...yearlySection(chart, liuNianYear));
	}
	if (args.decadal !== undefined) {
		out.push(
			"",
			...decadalSection(chart, parseAgesArg(args.decadal, chart.currentAge, "--decadal"))
		);
	}
	if (args.ages !== undefined) {
		out.push(
			"",
			...ageSection(chart, parseAgesArg(args.ages, chart.currentAge, "--ages"), liuNianYear)
		);
	}
	if (args.focus !== undefined) {
		// typeof 判空挡掉「给了 --focus 却没跟值」（parseArgs 存 true）形态 ——
		// focusSection 的归一表查不到 true，自然落到「聚焦失败」分支并列出可用宫名。
		const focus = typeof args.focus === "string" ? args.focus : String(args.focus);
		out.push("", ...focusSection(chart, focus, liuNianYear));
	}
	// 头部三行删除后口径节可能为空（未给出生地且非晚子时）—— 清掉开头
	// 残留的空行，让面板或专题节直接顶格。
	while (out.length > 0 && out[0] === "") {
		out.shift();
	}
	return out;
}

/**
 * `astrology` 命令：解读用完整输入包。
 *
 * @param args - CLI 参数表；专题旗标族 `--info` / `--pattern` / `--mutagen` /
 *   `--decadal [虚岁]` / `--ages [虚岁]` / `--yearly [年]` / `--monthly` / `--focus` /
 *   `--report`
 * @returns 已渲染文本；带 `--json` 时返回命盘 + 格局 + 三组四化的原始 JSON 串
 *
 * @remarks
 * **精简概览 + 专题分发**：无旗标输出口径提示、信息面板与运限速览 + 专题指路；给旗标只追加该专题详版（可叠加，按 `--pattern` → `--mutagen` → `--yearly` → `--decadal` → `--ages` → `--focus` 序），不带面板与指路（已深入，是噪声）。
 *
 * **零输入演示**：出生信息没给且无其他输出意图时，以内置虚构样例演示并附用法指路；部分输入不适用，按「缺一问一」报错。完整契约见 docs/code/cli-commands.md。
 */
export function cmdAstrology(args: CliArgs) {
	// --template：打印配置模板即止（不排盘）
	if (args.template) {
		return renderTemplate();
	}
	// 装配链单点（评审候选 4 / W1）：--config 覆盖 → 零输入回退 → 出生信息 → basis → 命盘缓存 → 运限解析。顺序与前提是 interface 一部分，测试直调同一函数（astrology-context.ts），不各持复刻。
	const actx = prepareAstrologyContext(args);
	args = actx.args;
	const { info, basis, chart, liuNianYear, liuYueMonth, liuRiDay, liuShiHour, usingSample } =
		actx;

	// ── 融合分支（spec §1）──
	// --info：只输出信息面板这一节（面板默认输出无条件存在，本参数「只看面板」）
	if (args.info) {
		if (args.json) {
			throw new Error(
				"--info 是独占分支，与 --json 不可同给：--info 只输出文本面板（--json 仅与完整概览或 --palaces 组合）。"
			);
		}
		// 优先级链落地：排在 info 前的首个在场分支抢跑指路（派生自 EXCLUSIVE_BRANCHES 清单序，不手写三元梯）。--info 属链上「其他功能参数」：--palaces > --topic > --report > --info。
		const higherEntry = EXCLUSIVE_BRANCHES.slice(
			0,
			EXCLUSIVE_BRANCHES.findIndex(b => b.name === "info")
		).find(b => (args as Record<string, unknown>)[camelKey(b.name)] !== undefined);
		if (higherEntry) {
			throw new Error(
				`--${higherEntry.name} 是独占分支，以下功能参数不会生效：--info。` +
					`独占分支请单独使用（优先级：${EXCLUSIVE_PRIORITY_LABEL}）。`
			);
		}
		// 其余参数同给也不生效 —— 静默吞违反启动纪律，走独占检测指路。
		// palaces / topic / json 三者由上方各自的检查负责（职责不重复）。
		assertNoShadowedFeatures(args, "--info");
		return [
			...(usingSample ? [SAMPLE_HEADER, ""] : []),
			...infoSection(chart, clockOptsFromBasis(basis)),
			// --info 与「无功能参数的概览」同尾：面板后跟运限速览与专题指路 —— 两者都是「还没深入」形态，指路正好；给了专题参数则不带这两节（已深入，指路是噪声）。
			"",
			...overviewSection(chart, liuNianYear),
			...(usingSample ? SAMPLE_TRAILER : []),
		].join("\n");
	}

	// --palaces：十二宫逐宫详表。
	// --palaces --json 顶层即命盘本身（不带格局/四化包装）。
	if (args.palaces) {
		assertNoShadowedFeatures(args, "--palaces");
		if (args.json) {
			return JSON.stringify(chart, null, 2);
		}
		const out = [
			chartHeader("命盘  ", info, basis.note),
			`农历：${chart.lunarInfo.lunarYear}年${chart.lunarInfo.isLeapMonth ? "闰" : ""}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日 · 年柱${STEMS[chart.lunarInfo.yearStem]}${BRANCHES[chart.lunarInfo.yearBranch]}`,
			`命宫：${BRANCHES[chart.soulBranch]} · 身宫：${BRANCHES[chart.bodyBranch]} · 五行局：${chart.fiveElementsClassName} · 紫微：${BRANCHES[chart.ziweiPos]}`,
			"",
		];
		out.push(...birthplaceSection(basis));
		out.push(...lateZiSection(chart, basis, lateZiCounterChart(info, basis)));
		out.push("─".repeat(56));
		for (const p2 of chart.palaces) {
			out.push(renderPalace(p2, chart), "");
		}
		out.push(
			"大限：" +
				chart.decadals
					.map(
						d =>
							`${d.startAge}-${d.endAge}岁 ${d.palaceName}(${BRANCHES[d.palaceBranch]})`
					)
					.join(" | ")
		);
		out.push(
			`当前年龄：${chart.currentAge}岁 · 当前大限：${chart.decadals[chart.currentDecadalIndex]?.palaceName ?? "—"}`
		);
		return out.join("\n");
	}

	// --topic：主题论断。不带值（或裸开关）= 列全部主题清单。
	if (args.topic !== undefined) {
		if (args.json) {
			throw new Error(
				"--topic 是独占分支，与 --json 不可同给：主题论断只有文本形态（--json 仅与完整概览或 --palaces 组合）。"
			);
		}
		// 检测在列清单前：yearly / monthly 是 --topic 自消费参数（已放行），其余被吞参数在列清单路径同样不生效，一并指路。
		assertNoShadowedFeatures(args, "--topic");
		if (args.topic === true) {
			const rows = (Object.keys(TOPIC_LABEL) as TopicKey[]).map(
				k => `  ${k.padEnd(11)} ${TOPIC_LABEL[k]}（看${TOPIC_PALACE_NAME[k]}）`
			);
			return [
				`${Object.keys(TOPIC_LABEL).length} 个主题（--topic <key> 选其一）：`,
				...rows,
				"",
				`view 可选：${VIEW_TEXT.choices}`,
				`　　　　 也可用同名英文：${VIEW_TEXT.enSpaced}`,
				"示例：node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --topic love（示例数据为虚构）",
			].join("\n");
		}
		const topic = String(args.topic) as TopicKey;
		if (!TOPIC_LABEL[topic]) {
			throw new Error(
				`--topic 应为 ${Object.keys(TOPIC_LABEL).length} 个主题之一（${Object.keys(TOPIC_LABEL).join("/")}），收到：${args.topic}`
			);
		}
		const viewRaw = args.view !== undefined ? String(args.view) : "mingpan";
		const view = VIEW_ALIASES[viewRaw];
		if (!view) {
			throw new Error(
				`--view 应为 ${VIEW_TEXT.zhSlashed}（或同名英文 ${VIEW_TEXT.enSlashed}），收到：${args.view}`
			);
		}
		const text = getTopicAnalysis(chart, topic, {
			view,
			liunianYear: liuNianYear,
			liuyueMonth: liuYueMonth ?? undefined,
		});
		return [
			chartHeader(`【主题论断 · ${TOPIC_LABEL[topic]}】`, info, basis.note),
			"",
			text,
			"",
			"⚠️ 知识来源分级：以上论断出自分析数据库 —— 其中「倪师说」引号句部分为传统口诀的",
			`   风格化转述，不一定是《天纪》逐字原话（${KNOWLEDGE_GRADE_ORDER.join(" / ")} 四级），`,
			"   引用下断语时请注明口径。",
		].join("\n");
	}

	// --report：全盘主题报告（Markdown，独占分支），13 板块一次出全，本命静态口径 —— 视角 / 流年 / 流月参数不属它，由独占检测指路（--view 的 bespoke 文案由清单前置段驱动，见 assertNoShadowedFeatures）。
	if (args.report) {
		if (args.json) {
			throw new Error(
				"--report 是独占分支，与 --json 不可同给：全盘报告只有 Markdown 文本形态（--json 仅与完整概览或 --palaces 组合）。"
			);
		}
		assertNoShadowedFeatures(args, "--report");
		return buildReport(chart, info, basis);
	}

	if (args.json) {
		// 契约生产端提为具名纯函数（buildAnalyzeJson）：键名集中一处，selftest 可直测。
		// 只传语义参数 —— 四化派生收在函数内部，天然一致。
		return buildAnalyzeJson({
			chart,
			liuNianYear,
			liuYueMonth,
			liuRiDay,
			liuShiHour,
			basis,
		});
	}

	// ── 未深入形态的输出基底 ──
	// 基本信息面板 + 运限速览 + 专题指路 / 深掘详版，统一交给 composeSections（候选 3：接线升为可测 interface，接线即被测物）。
	return composeSections(actx).join("\n");
}
