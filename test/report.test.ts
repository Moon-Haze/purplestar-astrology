// ── 层 2.5：astrology --report 全盘主题报告 ──
//
// --report 是独占分支（本命静态口径、Markdown 文档形态），与 --topic（单主题、
// 终端文本形态）共用同一套叶子 view 与数据表，但编排与装配在 cli/commands/report.ts。
// 本文件测三件事：
//   1. 文档形态契约 —— 13 个板块齐全且顺序固定（用户口径，非 TOPIC_KEYS 存储序）、
//      文档头骨架行、每节的定调 / 命盘依据 / 综合建议、知识来源分级尾注
//   2. 独占分支纪律 —— 与 --json / 其他功能参数 / --view 同给必须报错指路，零输入
//      报「缺一问一」（全盘报告不喂虚构数据）
//   3. 子进程端到端 —— 直调与真 CLI 子进程输出逐字一致（与 cli.test.ts 的防漂移
//      断言同一纪律）
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { load, ROOT, ROOT_LABEL } from "./lib/loader.ts";
// 虚构样本的 argv 单点（评审候选 6 / W4）：不再本地手写同款组合。
import { DEMO_ARGV, DEMO_FEMALE_ARGV } from "../scripts/cli/selftest/sample.ts";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "..");

// ── 报告的板块序（与 scripts/cli/commands/report.ts 的 REPORT_TOPICS 同一份用户口径）──
// 存储序（TOPIC_KEYS）是 parquet 列序动不得；报告序是产品口径 —— 两者不同是有意的，
// 这条清单钉住后者，编排层重排板块时此处必须同步改。
const REPORT_TOPICS = [
	"命格总览",
	"财富运势",
	"事业职业",
	"感情婚姻",
	"性格特质",
	"健康状况",
	"兄弟合伙",
	"子女缘分",
	"迁移外出",
	"人际贵人",
	"田宅不动产",
	"精神福德",
	"父母长辈",
] as const;

/** 与 cli.test.ts 的 cliCmdInProcess 同款：进程内直调 COMMANDS（省冷启动税）。 */
async function cliCmdInProcess(args: string[]): Promise<string> {
	const { COMMANDS } = await load<typeof import("@/cli/commands")>("@/cli/commands");
	const { parseArgs } = await load<typeof import("@/cli/args")>("@/cli/args");
	const fn = COMMANDS.astrology;
	if (!fn) {
		throw new Error("astrology 命令未注册");
	}
	return fn(parseArgs(args, "astrology"), { root: ROOT, rootLabel: ROOT_LABEL });
}

/** 直调失败包装成带 .message 的普通错误（错误形态断言用）。 */
async function cmdFails(args: string[]): Promise<string> {
	try {
		await cliCmdInProcess(args);
	} catch (err) {
		return (err as Error).message;
	}
	assert.fail(`命令本应失败却成功了：${args.join(" ")}`);
}

/** 男盘（help 示例同款，命宫有主星）—— argv 单点见 cli/selftest/sample.ts。 */
const MALE = [...DEMO_ARGV];
/** 女盘（命宫空宫，借对宫论事 —— 覆盖 report 的借宫路径）。 */
const FEMALE = [...DEMO_FEMALE_ARGV];

// 独占分支判定链声明（2026-11-17 判定链收拢 + 2026-11-18 矩阵封闭派生）：组合
// 矩阵三根轴（分支轴 / 被吞旗标轴 / allow 方向）从它派生，测试面无手抄副本。
const argsTable = await load<typeof import("@/cli/args/table")>("@/cli/args/table");

/**
 * 提取 `--topic` 单主题输出的「本宫主星：」行（命盘推演节）。
 * 两形态（--topic 与 --report）同一行应逐字同源（overview-material 单点）。
 */
function extractTopicMainStarLine(out: string): string {
	const m = out.match(/^本宫主星：.*$/m);
	assert.ok(m, "--topic 输出应包含「本宫主星：」行");
	return m[0];
}

/**
 * 提取 `--report` 某主题板块「命盘推演」节下的「本宫主星：」行。
 * 报告按 `## 主题名（…）` 分块，定位到目标板块后再取其命盘推演小节。
 */
function extractReportMainStarLine(report: string, topicLabel: string): string {
	const blocks = report.split(/^## /m);
	for (const block of blocks) {
		if (!block.startsWith(`${topicLabel}（`)) {
			continue;
		}
		const sect = block.indexOf("### 命盘推演");
		if (sect === -1) {
			continue;
		}
		const line = block.slice(sect).match(/本宫主星：.*/);
		if (line) {
			return line[0];
		}
	}
	assert.fail(`--report 未找到「${topicLabel}」板块的命盘推演本宫主星行`);
}

describe("astrology --report 全盘报告", () => {
	it("13 个板块齐全且顺序符合用户口径（财运在事业前、性格在感情后）", async () => {
		const t = await cliCmdInProcess([...MALE, "--report"]);
		// 大限独立节（refine-report-dedup-citations）不是主题板块，排除后比对报告序
		const headings = [...t.matchAll(/^## (.+?)（/gm)]
			.map(m => m[1])
			.filter(n => n !== "当前大限");
		assert.deepEqual(headings, [...REPORT_TOPICS], "主题板块应为 13 个且按报告序");
		assert.ok(t.includes("\n## 当前大限（"), "文档头区应有当前大限独立节");
		assert.ok(!t.includes("\n### 当前大限\n"), "板块内不应再有大限小节");
	});

	it("文档头含出生信息 / 农历 / 骨架 / 生年四化 / 格局 / 运限六要素", async () => {
		const t = await cliCmdInProcess([...MALE, "--report"]);
		assert.ok(t.startsWith("# 紫微斗数全盘报告\n"), "应以一级标题开头");
		for (const key of [
			"- 出生：",
			"- 农历：",
			"- 命宫：",
			"- 生年四化",
			"- 已入格局",
			"- 当前虚岁",
		]) {
			assert.ok(t.includes(key), `文档头应有「${key}」行`);
		}
	});

	it("每一节都有定调 / 命盘依据 / 综合建议三要素，末尾带知识来源分级尾注", async () => {
		const t = await cliCmdInProcess([...MALE, "--report"]);
		assert.equal((t.match(/> \*\*定调/g) ?? []).length, 13, "13 个定调引用块");
		assert.equal((t.match(/^### 命盘依据$/gm) ?? []).length, 13, "13 个命盘依据小节");
		assert.equal((t.match(/^### 综合建议$/gm) ?? []).length, 13, "13 个综合建议小节");
		assert.ok(t.includes("⚠️ **知识来源分级**"), "尾注应披露来源分级");
	});

	it("经典出处引文出自本仓古籍库（含《骨髓赋》等书名）", async () => {
		const t = await cliCmdInProcess([...MALE, "--report"]);
		const cites = [...t.matchAll(/^- 《(.+?)》/gm)].map(m => m[1]);
		assert.ok(cites.length > 0, "至少一条引文");
		for (const loc of cites) {
			assert.match(
				loc,
				/骨髓赋|紫微斗数全集|紫微斗数全书/,
				`引文出处应属三部古籍之一，实得：${loc}`
			);
		}
	});

	it("女盘命宫空宫借对宫：标题带「借对宫」徽标且不落「无法找到」兜底", async () => {
		const t = await cliCmdInProcess([...FEMALE, "--report"]);
		assert.ok(t.includes("（命宫 · 借对宫"), "空宫主题的标题应标借对宫");
		assert.ok(!t.includes("无法找到"), "按宫名找宫失配会输出兜底文案");
	});

	it("两形态同源：--topic 与 --report 的「本宫主星：」行逐字相同（借宫盘与非借宫盘）", async () => {
		// overview 主题对应报告「命格总览」板块；男盘命宫有主星（非借宫）。
		// 2.3 覆盖两种借宫形态（期望值均来自真实 CLI 实跑，非评审转述）：
		//  - 女盘命宫空宫借对宫：行带「借对宫天机论事」注（1.4 修复的漂移形态）；
		//  - 女盘财帛宫空宫借天梁化科：非命宫借宫块，行直接落借入星（无注）。
		const cases: Array<{
			argv: string[];
			topic: string;
			reportLabel: string;
			expectInLine?: string;
			note: string;
		}> = [
			{ argv: MALE, topic: "overview", reportLabel: "命格总览", note: "非借宫盘" },
			{
				argv: FEMALE,
				topic: "overview",
				reportLabel: "命格总览",
				expectInLine: "借对宫天机论事",
				note: "命宫借宫（行带借宫注）",
			},
			{
				argv: FEMALE,
				topic: "wealth",
				reportLabel: "财富运势",
				expectInLine: "天梁化科（落陷）",
				note: "非命宫借宫块（行落借入星）",
			},
		];
		for (const { argv, topic, reportLabel, expectInLine, note } of cases) {
			const topicOut = await cliCmdInProcess([...argv, "--topic", topic]);
			const reportOut = await cliCmdInProcess([...argv, "--report"]);
			const reportLine = extractReportMainStarLine(reportOut, reportLabel);
			// 对拍为主断言：两形态必须逐字同源（漂移回潮时第一个红的就是它）。
			const topicLine = extractTopicMainStarLine(topicOut);
			assert.equal(
				topicLine,
				reportLine,
				`同盘同主题下 --topic 与 --report 的「本宫主星：」行应逐字相同（${note}）`
			);
			if (expectInLine !== undefined) {
				assert.ok(
					reportLine.includes(expectInLine),
					`${note}：--report 行应体现借宫语义（期望含「${expectInLine}」），实得：${reportLine}`
				);
			}
		}
	});

	it("独占分支：--report 与 --json / 功能参数 / --view 同给均报错指路", async () => {
		const jsonErr = await cmdFails([...MALE, "--report", "--json"]);
		assert.ok(jsonErr.includes("--report") && jsonErr.includes("--json"));
		const patErr = await cmdFails([...MALE, "--report", "--pattern"]);
		assert.ok(patErr.includes("--pattern"), "被吞参数必须点名");
		const viewErr = await cmdFails([...MALE, "--report", "--view", "daxian"]);
		assert.ok(
			viewErr.includes("--report") &&
				viewErr.includes("--view") &&
				viewErr.includes("不接受"),
			"bespoke 文案必须点名并含「不接受」指路——通用文案也能过前两个子串，此钉子串防止 bespoke 被通用检测抢跑成死代码（次序回退即红）"
		);
	});

	it("独占分支：--topic 与 --report 互斥（两个独占分支同给必报错）", async () => {
		const err = await cmdFails([...MALE, "--topic", "love", "--report"]);
		assert.ok(err.includes("--report"), "低优先级的 --report 必须被点名");
		const err2 = await cmdFails([...MALE, "--report", "--info"]);
		assert.ok(err2.includes("--info"), "report 视角下 --info 也应被点名");
	});

	it("独占分支 × 功能参数矩阵（三根轴封闭派生）：被吞必点名、消费白名单必放行", async () => {
		// 三根轴（分支轴 / 被吞旗标轴 / allow 方向）全部从 table.ts 声明表派生，构成
		// 封闭枚举（2026-11-18-report-test-matrix-closed-derivation）：新增/退役分支
		// 或旗标、调整放行 = 声明表一处表态，测试面零协同。两张探针映射只是「怎么调用」
		// 的夹具（design D2），不重复声明表的任何决策；派生条目在映射缺席时由缺名守卫
		// 当场红（design D3）——「新分支/旗标未入矩阵」从静默变失败可见。跳过格各有
		// 指名的分管断言：自指格（旗标即分支自身）端到端触发 parse 层参数判重而非被吞
		// 文案；放行格由下方 allow 断言分管；bespoke 格（report × view）由上方
		//「不接受」子串钉点分管。覆盖格数由派生轴计算自报，不写死（落地时点 45 + 3）。
		const { EXCLUSIVE_BRANCHES, SHADOWABLE_KEYS, OPTION_GROUPS } = argsTable;
		// 形态判定单一来源：声明表 kind 字段（switch 不带值；value / optionalValue
		// 统一按带值调用，不影响被吞语义）。
		const kindOf = new Map(
			OPTION_GROUPS.flatMap(g => g.options.map(o => [o.name, o.kind] as const))
		);
		// 探针映射（design D2 夹具）：分支取值映射（其余分支裸旗标）+ 值形态旗标的
		// 合法样本值（switch 形态 mutagen / pattern / info / report 不需要条目）。
		const branchProbeArgs: Record<string, readonly string[]> = { topic: ["love"] };
		const flagProbeValue: Record<string, string> = {
			ages: "34",
			daily: "10",
			decadal: "2",
			focus: "财帛",
			hourly: "3",
			monthly: "5",
			topic: "love",
			view: "daxian",
			yearly: "2027",
		};
		// 缺名守卫（design D3）：派生轴上非 switch 形态的条目缺席探针取值即红并点名，
		// 「未入矩阵」不静默。
		const branchArgv = (name: string): readonly string[] => {
			const probe = branchProbeArgs[name];
			if (kindOf.get(name) !== "switch" && probe === undefined) {
				assert.fail(`独占分支 --${name} 未登记探针取值，新分支未入矩阵`);
			}
			return [`--${name}`, ...(probe ?? [])];
		};
		const flagArgv = (flag: string): readonly string[] => {
			const value = flagProbeValue[flag];
			if (kindOf.get(flag) !== "switch" && value === undefined) {
				assert.fail(`被吞旗标 --${flag} 未登记探针取值，新旗标未入矩阵`);
			}
			return value === undefined ? [`--${flag}`] : [`--${flag}`, value];
		};
		let genericCells = 0;
		let allowCells = 0;
		for (const entry of EXCLUSIVE_BRANCHES) {
			for (const flag of SHADOWABLE_KEYS) {
				const skip =
					flag === entry.name ||
					entry.consumes.includes(flag) ||
					(entry.rejectsWithNote?.keys.includes(flag) ?? false);
				if (skip) {
					continue;
				}
				const err = await cmdFails([...MALE, ...branchArgv(entry.name), ...flagArgv(flag)]);
				assert.ok(
					err.includes(`--${flag}`) && err.includes("不会生效"),
					`独占分支 --${entry.name} 应点名被吞参数 --${flag}，实得：${err}`
				);
				genericCells += 1;
			}
		}
		// allow 方向：consumes 非空的分支自动进放行断言循环，消费白名单在 table.ts
		// 是唯一表态处。断言子串「本宫主星：」是 --topic 主题论断的形态契约；新分支
		// 的放行产物形态不同时，在此以其实际契约替换并留注释指名（显式表态，非静默跟随）。
		for (const entry of EXCLUSIVE_BRANCHES.filter(b => b.consumes.length > 0)) {
			for (const flag of entry.consumes) {
				const out = await cliCmdInProcess([
					...MALE,
					...branchArgv(entry.name),
					...flagArgv(flag),
				]);
				assert.ok(
					out.includes("本宫主星：") && !out.includes("不会生效"),
					`--${entry.name} 消费 --${flag} 应正常出主题论断（无误伤报错）`
				);
				allowCells += 1;
			}
		}
		console.log(
			`[矩阵自报] 分支 ${EXCLUSIVE_BRANCHES.length} × 旗标 ${SHADOWABLE_KEYS.size}，` +
				`通用断言 ${genericCells} 格 + allow ${allowCells} 格` +
				`（跳过格归自指/放行/bespoke 各自的分管断言）`
		);
	});

	it("零输入 --report 报「缺一问一」，不喂虚构演示盘", async () => {
		const err = await cmdFails(["--report"]);
		assert.ok(err.includes("缺少出生日期"), `应报缺出生日期，实得：${err}`);
	});

	it("真子进程端到端：输出与进程内直调逐字一致（防漂移）", async () => {
		const direct = await cliCmdInProcess([...MALE, "--report"]);
		const { stdout } = await execFileAsync(
			"node",
			[join(SKILL_ROOT, "scripts/purple-star.ts"), "astrology", ...MALE, "--report"],
			{ cwd: SKILL_ROOT }
		);
		// CLI 入口 console.log 恰好多打一个尾随换行 —— 精确断言到这一行为。
		assert.equal(stdout, `${direct}\n`);
	});
});
