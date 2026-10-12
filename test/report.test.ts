// ── 层 2.5：astrology --report 全盘主题报告 ──
//
// --report 是独占分支（本命静态口径、Markdown 文档形态），与 --topic（单主题、
// 终端文本形态）共用同一套叶子 view 与数据表，但编排与装配在 cli/report.ts。
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

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "..");

// ── 报告的板块序（与 scripts/cli/report.ts 的 REPORT_TOPICS 同一份用户口径）──
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
	if (!fn) {throw new Error("astrology 命令未注册");}
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

/** 男盘（help 示例同款，命宫有主星）。 */
const MALE = ["--date", "2011-06-24", "--time", "07:45", "--city", "杭州", "--gender", "male"];
/** 女盘（命宫空宫，借对宫论事 —— 覆盖 report 的借宫路径）。 */
const FEMALE = ["--date", "1999-11-3", "--time", "15:20", "--city", "成都", "--gender", "female"];

describe("astrology --report 全盘报告", () => {
	it("13 个板块齐全且顺序符合用户口径（财运在事业前、性格在感情后）", async () => {
		const t = await cliCmdInProcess([...MALE, "--report"]);
		const headings = [...t.matchAll(/^## (.+?)（/gm)].map(m => m[1]);
		assert.deepEqual(headings, [...REPORT_TOPICS], "## 二级标题应为 13 板块按报告序");
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
		])
			{assert.ok(t.includes(key), `文档头应有「${key}」行`);}
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
		for (const loc of cites)
			{assert.match(
				loc,
				/骨髓赋|紫微斗数全集|紫微斗数全书/,
				`引文出处应属三部古籍之一，实得：${loc}`
			);}
	});

	it("女盘命宫空宫借对宫：标题带「借对宫」徽标且不落「无法找到」兜底", async () => {
		const t = await cliCmdInProcess([...FEMALE, "--report"]);
		assert.ok(t.includes("（命宫 · 借对宫"), "空宫主题的标题应标借对宫");
		assert.ok(!t.includes("无法找到"), "按宫名找宫失配会输出兜底文案");
	});

	it("独占分支：--report 与 --json / 功能参数 / --view 同给均报错指路", async () => {
		const jsonErr = await cmdFails([...MALE, "--report", "--json"]);
		assert.ok(jsonErr.includes("--report") && jsonErr.includes("--json"));
		const patErr = await cmdFails([...MALE, "--report", "--pattern"]);
		assert.ok(patErr.includes("--pattern"), "被吞参数必须点名");
		const viewErr = await cmdFails([...MALE, "--report", "--view", "daxian"]);
		assert.ok(viewErr.includes("--report") && viewErr.includes("--view"));
	});

	it("独占分支：--topic 与 --report 互斥（两个独占分支同给必报错）", async () => {
		const err = await cmdFails([...MALE, "--topic", "love", "--report"]);
		assert.ok(err.includes("--report"), "低优先级的 --report 必须被点名");
		const err2 = await cmdFails([...MALE, "--report", "--info"]);
		assert.ok(err2.includes("--info"), "report 视角下 --info 也应被点名");
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
