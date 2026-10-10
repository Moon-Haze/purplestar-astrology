#!/usr/bin/env node
// ── CLI 参数输出样例生成器：把 purple-star 各命令/参数逐条实跑，输出成 markdown ──
//
// 给谁用：测试人员核对 `node scripts/purple-star.ts` 各参数的**输出形态**。
// 脚本对样例表里的每条命令**进程内直调**（与 CLI 同一命令函数 —— CLI 入口本就是
// `console.log(COMMANDS[cmd](args, ctx))`，直调拿到的是同一份字符串，逐字一致；
// 机制与 scripts/synastry/selftest-asserts.ts 的直调探针同款，还省去每次约
// 3 秒的 node + iztro 冷启动），把输出 / 错误 / 退出码 / 耗时**流式**渲染成
// markdown 打到 stdout。
//
// 用法（仓库根执行）：
//   npx tsx tools/cli-samples.ts                          # markdown 打到终端
//   npx tsx tools/cli-samples.ts > docs/cli-samples.md    # 重定向落盘成 markdown 文件
//   npx tsx tools/cli-samples.ts -h                       # 本帮助
//
// 落盘刻意交给 shell 重定向而非 --out 参数：本脚本因此没有「读参数 → 拼路径 →
// 写文件」的链路，安全面最小（进度日志走 stderr，不污染重定向的 markdown）。
//
// 退出码：0 = 全部样例的退出码符合预期；1 = 有意外（命令意外失败 / 错误样例
// 意外成功）。意外不代表文档不生成 —— markdown 照常输出，意外条目在文末
// 「汇总」节列明细并标 ⚠。
//
// 直调与子进程的两点口径差（都不影响输出形态核对）：
//   1. 错误路径：CLI 是 stderr「错误：<msg>」+ exit 1；直调由 cli/selftest-kit 的
//      callDirect 复刻同一前缀与退出码。
//   2. 引导层路径：help / <cmd> --help 由 CLI 入口在命令表之前拦截，直调则直接
//      调 help 模块的同一渲染函数。
//
// ⚠️ 样例表是**手动维护**的：新增 CLI 参数时在 SAMPLES 里补一条（组别就近），
//    本文档才跟着覆盖到。示例数据均为虚构（与 help 的示例同款），无真实人物。
//    样例输入文件（config / 两份示例盘）静态放在 tools/samples/，文档里的命令
//    测试人员可直接手敲复现。
//
// 结构说明：执行与渲染刻意**全部内联在 main 里流式打印**（不收进数组、不经过
// 二次函数传递）—— 命令输出是外部数据，直连消费的形态最简单也最好审。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, type CliContext } from "@/cli/args";
import { COMMANDS } from "@/cli/commands";
import { renderCommandHelp, renderOverviewHelp } from "@/cli/help";
import { callDirect } from "@/cli/selftest-kit";
import { cmdSelftest } from "@/cli/selftest";

const HERE = dirname(fileURLToPath(import.meta.url)); // <仓库根>/tools
const SKILL_ROOT = resolve(HERE, "..");
/** 内核根与 CLI 启动时的口径一致（purple-star.ts 传的就是 scripts/ 目录） */
const CTX: CliContext = { root: resolve(SKILL_ROOT, "scripts"), rootLabel: "仓库自带内核" };

/** 一条样例：一条真实执行的命令 + 文档里的展示信息。 */
interface Sample {
	/** 分组标题（文档二级标题） */
	group: string;
	/** 小节标题 */
	title: string;
	/** 一句话说明这条参数是干什么的 */
	desc: string;
	/** 完整命令（purple-star.ts 之后的部分；仓库根相对路径直接可用） */
	args: string[];
	/** 错误路径样例：期待非 0 退出码（用于核对报错文案） */
	expectFail?: boolean;
}

// ── 样例表：覆盖 help 的 OPTIONS 段全部参数 + 五个命令域 + 常见报错 ──
// 出生信息统一用 help 示例同款（2011-06-24 07:45 男 杭州；女盘用 1999-11-3 15:20 成都）。
const SAMPLES: Sample[] = [
	// ── 帮助 ──
	{
		group: "帮助",
		title: "总帮助 help",
		desc: "三域合一的总帮助：命令清单 + 全参数面 + 示例",
		args: ["help"],
	},
	{
		group: "帮助",
		title: "astrology 专属帮助",
		desc: "各命令的专属用法（任何命令可用 -h / --help）",
		args: ["astrology", "--help"],
	},

	// ── astrology：概览与出生信息 ──
	{
		group: "astrology · 概览与出生信息",
		title: "零输入演示形态",
		desc: "出生信息一项不给时不报错：以内置虚构示例演示基本信息面板并附用法指路（裸跑与 --info 同效）",
		args: ["astrology"],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "零输入 + 显式 --info",
		desc: "--info 被刨出「输出意图」表：零输入时显式给它同样落演示而非报错（输出与裸跑逐字一致）",
		args: ["astrology", "--info"],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "零参数快捷形态（位置参数归类）",
		desc: "日期/时刻/性别/中文城市名按形态归类，顺序无关",
		args: ["astrology", "2011-06-24", "07:45", "男", "杭州"],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "旗标全形态概览",
		desc: "--date 公历 + --time 钟表时 + --city 城市经度 + --gender；不带专题参数时只出精简概览",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "--name 抬头署名",
		desc: "可选，只影响输出抬头，不参与排盘",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"男",
			"--name",
			"张三",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "农历入参 --lunar + --branch",
		desc: "农历生日自动换算公历；时辰直接指定时辰支（0=子 … 11=亥）",
		args: ["astrology", "--lunar", "1990-4-21", "--branch", "5", "--gender", "female"],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "闰月 --leap",
		desc: "配合 --lunar 表示闰月（2020 年闰四月 → 公历 2020-05-30）",
		args: ["astrology", "--lunar", "2020-4-8", "--leap", "--branch", "3", "--gender", "男"],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "真太阳时（--city 经度校正）",
		desc: "钟表 07:45 杭州东经 120.1°；校正量与所落时辰在输出头部交代",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"男",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "--city 容错写法",
		desc: "「杭州市」等带行政后缀的写法容错解析（输出提示按哪个城市计）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州市",
			"--gender",
			"男",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "--province 按省会计",
		desc: "省份名代替城市，按省会经度计",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--province",
			"山东",
			"--gender",
			"男",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "--lng 直接指定经度",
		desc: "东经为正（喀什 75.9，校正量 -177 分，可把时辰推出当天）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--lng",
			"75.9",
			"--gender",
			"男",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "--eot 计入均时差",
		desc: "真太阳时额外加均时差（±16 分，与经度无关），默认不计",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"男",
			"--eot",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "晚子时 --late-zi",
		desc: "23:00–23:59 出生改按「晚子时算次日」排（与当日早子时是两张不同的盘）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"23:30",
			"--city",
			"杭州",
			"--gender",
			"男",
			"--late-zi",
		],
	},
	{
		group: "astrology · 概览与出生信息",
		title: "--branch 12 直接指定晚子时",
		desc: "不经 --time，直接给时辰支 12（晚子时口径）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--branch",
			"12",
			"--city",
			"杭州",
			"--gender",
			"男",
		],
	},

	// ── astrology：专题参数 ──
	{
		group: "astrology · 专题深入",
		title: "--info 只出基本信息面板",
		desc: "面板默认已在概览里；此参数只输出这一节",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"男",
			"--info",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--pattern / --geju 格局识别",
		desc: "格局判词 / 成立与破格条件 / 出处",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--pattern",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--mutagen 四化专题",
		desc: "生年四化落宫与叠宫（默认含当年流年四化）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--mutagen",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--mutagen --yearly 2027 指定流年",
		desc: "流年四化按指定公历年取年干（默认今年）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--mutagen",
			"--yearly",
			"2027",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--mutagen --monthly 5 追加流月四化",
		desc: "流月干由流年干五虎遁推出（流年缺省取当年）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--mutagen",
			"--yearly",
			"2027",
			"--monthly",
			"5",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--decadal 大限专题（缺省当前虚岁）",
		desc: "十年大运时间轴 + 当前虚岁所在限的三方四正深入",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--decadal",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--decadal 30 指定虚岁",
		desc: "看指定虚岁所在大限的三方四正",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--decadal",
			"30",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--ages 小限专题（缺省当前虚岁）",
		desc: "指定岁小限宫 + 十二宫小限岁数表",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--ages",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--ages 12 指定虚岁",
		desc: "12 虚岁的小限落宫",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--ages",
			"12",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--palaces 十二宫逐宫详表",
		desc: "独占分支：给出即接管输出",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--palaces",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "--focus 聚焦指定宫位",
		desc: "额外展开指定宫（宫名写法支持本项目口径）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--focus",
			"财帛",
		],
	},
	{
		group: "astrology · 专题深入",
		title: "专题叠加（格局 + 四化 + 流年 + 聚焦）",
		desc: "help 示例同款：专题参数可叠加",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--pattern",
			"--mutagen",
			"--yearly",
			"2027",
			"--focus",
			"财帛",
		],
	},

	// ── astrology：主题论断 ──
	{
		group: "astrology · 主题论断",
		title: "--topic 裸开关列主题清单",
		desc: "不带值时列出 13 个主题 key",
		args: [
			"astrology",
			"--date",
			"1999-11-3",
			"--time",
			"15:20",
			"--city",
			"成都",
			"--gender",
			"female",
			"--topic",
		],
	},
	{
		group: "astrology · 主题论断",
		title: "--topic love 感情婚姻",
		desc: "主题论断（help 示例同款）；--view 缺省 = mingpan 本命口径",
		args: [
			"astrology",
			"--date",
			"1999-11-3",
			"--time",
			"15:20",
			"--city",
			"成都",
			"--gender",
			"female",
			"--topic",
			"love",
		],
	},
	{
		group: "astrology · 主题论断",
		title: "--topic love --view daxian",
		desc: "同一主题换当前大限口径展示",
		args: [
			"astrology",
			"--date",
			"1999-11-3",
			"--time",
			"15:20",
			"--city",
			"成都",
			"--gender",
			"female",
			"--topic",
			"love",
			"--view",
			"daxian",
		],
	},
	{
		group: "astrology · 主题论断",
		title: "--topic love --view liuyue",
		desc: "流月口径展示",
		args: [
			"astrology",
			"--date",
			"1999-11-3",
			"--time",
			"15:20",
			"--city",
			"成都",
			"--gender",
			"female",
			"--topic",
			"love",
			"--view",
			"liuyue",
		],
	},

	// ── astrology：输出形态与配置 ──
	{
		group: "astrology · 输出与配置",
		title: "--json 原始 JSON",
		desc: "供程序消费的完整结构（chart / patterns / 四化 / 流年 / 小限 / 合盘基准）",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--time",
			"07:45",
			"--city",
			"杭州",
			"--gender",
			"male",
			"--json",
		],
	},
	{
		group: "astrology · 输出与配置",
		title: "--template 打印配置模板",
		desc: "可直接落盘的 JSON 模板（--template > my.json）",
		args: ["astrology", "--template"],
	},
	{
		group: "astrology · 输出与配置",
		title: "--config 读配置文件",
		desc: "键 = 参数 camelCase 主名；命令行同名参数覆盖配置值（本条吃 tools/samples/ 里的模板原样文件）",
		args: ["astrology", "--config", "tools/samples/config.example.json"],
	},

	// ── stars ──
	{
		group: "stars · 星曜释义",
		title: "--search 星曜释义",
		desc: "星曜的体系内释义",
		args: ["stars", "--search", "紫微"],
	},
	{
		group: "stars · 星曜释义",
		title: "位置参数形态",
		desc: "检索词也可作位置参数（stars 擎羊）",
		args: ["stars", "擎羊"],
	},

	// ── classics ──
	{
		group: "classics · 古籍检索",
		title: "--search 古籍原文检索",
		desc: "骨髓赋 / 紫微斗数全集 / 全书的原文段落",
		args: ["classics", "--search", "机月同梁"],
	},
	{
		group: "classics · 古籍检索",
		title: "--limit 命中条数上限",
		desc: "正整数，截取前 N 条命中",
		args: ["classics", "--search", "紫微", "--limit", "3"],
	},

	// ── synastry ──
	{
		group: "synastry · 合盘",
		title: "--charts 双宫联参",
		desc: "恰好两份 astrology --json 输出（甲先乙后）；两份示例盘见 tools/samples/（chart-a / chart-b，help 示例同款生辰）",
		args: ["synastry", "--charts", "tools/samples/chart-a.json,tools/samples/chart-b.json"],
	},

	// ── selftest ──
	{
		group: "selftest · 回归自检",
		title: "selftest 三段合一",
		desc: "排盘 / 古籍 / 合盘自检：农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束",
		args: ["selftest"],
	},

	// ── 错误路径（期待非 0 退出码，核对报错文案）──
	{
		group: "错误路径（期待报错）",
		title: "零输入 --json",
		desc: "机器接口不喂虚构数据：零输入演示只限文本面板，--json 仍要求出生信息",
		args: ["astrology", "--json"],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "部分输入只给日期",
		desc: "给了一半说明想排特定的盘，按「缺一问一」报错而非落示例",
		args: ["astrology", "--date", "1990-5-15"],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "缺 --gender",
		desc: "性别决定大限顺逆，缺失必须报错而非静默兜底",
		args: ["astrology", "--date", "2011-06-24", "--branch", "4"],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "--date 与 --lunar 同用",
		desc: "一个是公历一个是农历，同用报错",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--lunar",
			"1990-4-21",
			"--branch",
			"4",
			"--gender",
			"男",
		],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "拼错参数 --ctiy（最近邻建议）",
		desc: "未知参数当场报错并给最近邻建议，不静默落回默认值",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--branch",
			"4",
			"--gender",
			"男",
			"--ctiy",
			"北京",
		],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "日期不存在 2011-02-30",
		desc: "round-trip 校验拦下静默归一化的错日期（JS Date 会把 02-30 滚成 03-02）",
		args: ["astrology", "--date", "2011-02-30", "--branch", "4", "--gender", "男"],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "--branch 13 越界",
		desc: "时辰支域 0–12，越界报错",
		args: ["astrology", "--date", "2011-06-24", "--branch", "13", "--gender", "男"],
		expectFail: true,
	},
	{
		group: "错误路径（期待报错）",
		title: "未收录城市",
		desc: "城市表查不到时报错并给出可用的替代写法提示",
		args: [
			"astrology",
			"--date",
			"2011-06-24",
			"--branch",
			"4",
			"--city",
			"亚特兰蒂斯",
			"--gender",
			"男",
		],
		expectFail: true,
	},
];

// ── 主流程：执行与渲染全部内联在此，流式打印（见文件头「结构说明」）──
async function main(): Promise<void> {
	if (process.argv.includes("-h") || process.argv.includes("--help")) {
		console.log("用法：npx tsx tools/cli-samples.ts [> docs/cli-samples.md]");
		console.log("  markdown 打到 stdout；落盘用 shell 重定向。进度日志走 stderr，不污染文档。");
		console.log("  退出码 0 = 全部样例退出码符合预期；1 = 有意外（明细在文档「汇总」节）。");
		process.exit(0);
	}

	// ── 样例输入文件自检：样例表引用的 tools/samples/ 文件必须在场（缺了会让对应
	// 样例以 ENOENT 意外失败，文档里只剩 ⚠ 却看不出原因）。它们刻意不入库（仅本地
	// 存在，同 docs/cli-samples.md 的口径），丢了按指引重建 —— 宁可启动时明确指路，
	// 也不产出一份带糊涂 ⚠ 的文档。检查对象从样例表**实际引用**里派生（--charts 的
	// 值是逗号拼接的两个路径，须拆开），删样例不误报。
	const referenced = new Set<string>();
	for (const s of SAMPLES)
		for (const a of s.args)
			for (const part of a.split(",")) if (part.startsWith("tools/samples/")) referenced.add(part);
	const missing = [...referenced].filter(f => !existsSync(resolve(SKILL_ROOT, f)));
	if (missing.length) {
		console.error(`✘ 缺少样例输入文件：${missing.join("、")}`);
		console.error("  它们仅本地存在（不入库），在仓库根执行以下命令重建：");
		console.error("    mkdir -p tools/samples");
		console.error("    node scripts/purple-star.ts astrology --template >| tools/samples/config.example.json");
		console.error("    node scripts/purple-star.ts astrology --date 2011-06-24 --time 07:45 --city 杭州 --gender male --json >| tools/samples/chart-a.json");
		console.error("    node scripts/purple-star.ts astrology --date 1999-11-3 --time 15:20 --city 成都 --gender female --json >| tools/samples/chart-b.json");
		process.exit(1);
	}

	// ── 文档头部（生成环境戳）──
	const now = new Date();
	const pad = (x: number) => String(x).padStart(2, "0");
	const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
	const git = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
		cwd: SKILL_ROOT,
		encoding: "utf8",
	});
	const commit = git.status === 0 ? (git.stdout ?? "").trim() : "unknown";
	const pkg = JSON.parse(readFileSync(resolve(SKILL_ROOT, "package.json"), "utf8"));
	const engines = `iztro ${pkg.dependencies?.iztro ?? "?"} + lunar-typescript ${pkg.dependencies?.["lunar-typescript"] ?? "?"}`;

	console.log(`# purple-star CLI 参数输出样例`);
	console.log(``);
	console.log(
		`> 由 \`tools/cli-samples.ts\` 生成：对 \`node scripts/purple-star.ts\` 各命令/参数逐条实跑并记录输出，`
	);
	console.log(
		`> 供测试人员核对各参数的输出形态。示例数据均为虚构（与 help 示例同款），无真实人物。`
	);
	console.log(
		`> 命令均为**进程内直调**（与 CLI 同一命令函数，输出一致；含 --yearly/--ages 等随时间漂移的样例，`
	);
	console.log(`> 复跑时对应字段可能随当天日期变化）。`);
	console.log(``);
	console.log(`- 生成时间：${stamp}　git：\`${commit}\`　Node：${process.version}`);
	console.log(`- 引擎：${engines}　相对仓库根执行，文档里的命令可直接复制到终端复现`);
	console.log(
		`- 样例 ${SAMPLES.length} 条，输出全量；「错误路径」各条期待非 0 退出码，核对的是**报错文案**`
	);

	// ── 逐条执行 + 渲染 ──
	console.error(`样例 ${SAMPLES.length} 条，开始执行…`);
	let group = "";
	let n = 0;
	let unexpected = 0;
	const unexpectedTitles: string[] = [];
	let totalMs = 0;
	for (const s of SAMPLES) {
		n++;
		console.error(`  [${n}/${SAMPLES.length}] ${s.args.join(" ")}`);
		const t0 = Date.now();

		// 执行（分派口径见文件头注释；错误前缀「错误：」与 CLI stderr 一致）
		const [cmd, ...rest] = s.args;
		let exitCode: number;
		let stdout: string;
		let stderr: string;
		if (cmd === "help" || !cmd) {
			exitCode = 0;
			stdout = renderOverviewHelp();
			stderr = "";
		} else if (rest.includes("--help") || rest.includes("-h")) {
			exitCode = 0;
			stdout = renderCommandHelp(cmd as Parameters<typeof renderCommandHelp>[0]);
			stderr = "";
		} else if (cmd === "selftest") {
			try {
				stdout = await cmdSelftest(CTX);
				exitCode = 0;
				stderr = "";
			} catch (err) {
				stdout = "";
				exitCode = 1;
				stderr = `错误：${(err as Error).message}`;
			}
		} else {
			const fn = COMMANDS[cmd as keyof typeof COMMANDS];
			if (!fn) {
				stdout = "";
				exitCode = 1;
				stderr = `未知命令「${cmd}」。`;
			} else {
				const r = callDirect(cmd, rest, fn, parseArgs, CTX);
				exitCode = r.code;
				stdout = r.out;
				stderr = r.err;
			}
		}
		const ms = Date.now() - t0;
		totalMs += ms;
		const ok = s.expectFail ? exitCode !== 0 : exitCode === 0;
		if (!ok) {
			unexpected++;
			unexpectedTitles.push(`${s.title} → 退出码 ${exitCode}`);
		}

		// 渲染（就地流式打印）
		if (s.group !== group) {
			group = s.group;
			console.log(``);
			console.log(`## ${group}`);
			console.log(``);
		}
		console.log(`### ${n}. ${s.title}`);
		console.log(``);
		console.log("```bash");
		console.log(`node scripts/purple-star.ts ${s.args.join(" ")}`);
		console.log("```");
		console.log(``);
		console.log(`${s.desc}。`);
		console.log(``);
		const verdict = ok
			? `退出码 **${exitCode}**`
			: `退出码 **${exitCode}** ⚠ ${s.expectFail ? "错误样例意外成功" : "意外失败"}`;
		console.log(`${verdict}　耗时 ${(ms / 1000).toFixed(2)}s`);
		console.log(``);
		const body = stdout.replace(/\n$/, "");
		if (body) {
			console.log("输出：");
			console.log(``);
			console.log("```text");
			console.log(body);
			console.log("```");
			console.log(``);
		} else {
			console.log(`（无 stdout）`);
			console.log(``);
		}
		const errBody = stderr.replace(/\n$/, "");
		if (errBody) {
			console.log("stderr：");
			console.log(``);
			console.log("```text");
			console.log(errBody);
			console.log("```");
			console.log(``);
		}
	}

	// ── 汇总 ──
	console.log(``);
	console.log(`## 汇总`);
	console.log(``);
	console.log(
		`- 样例 ${SAMPLES.length} 条，退出码符合预期 ${SAMPLES.length - unexpected}/${SAMPLES.length}，总耗时 ${(totalMs / 1000).toFixed(1)}s`
	);
	if (unexpectedTitles.length) {
		console.log(`- ⚠ 意外 ${unexpectedTitles.length} 条：`);
		for (const t of unexpectedTitles) console.log(`  - ${t}`);
	}
	console.log(``);

	console.error(
		unexpected
			? `✘ ${unexpected} 条样例退出码不符合预期（明细见文档「汇总」节）`
			: `✔ ${SAMPLES.length} 条样例全部符合预期`
	);
	process.exit(unexpected ? 1 : 0);
}

// ── 仅直接执行时跑 main（守卫口径同 tools/db/*.ts）──
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
