// ── 层 2：CLI 端到端 ──
//
// 这一层测的是**基准样本覆盖不到的 CLI 层逻辑**：样本的 longitude 恒为 120（真太阳时
// 校正量恒为 0）、hour 只有 0-11（无晚子时）、出生信息恒为公历。这些逻辑全在 CLI 层，
// 故无 golden 基准可依，用手工基准 + 独立换算（lunar-typescript）互证。
//
// 本文件另有一条**防漂移断言**：内核直调结果必须等于 CLI --json 的输出。
// test/lib/loader.ts 是 scripts/purple-star.ts 加载机制的副本，这条断言盯着两者不分叉。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BirthInfo, ZiweiChart } from "@/ziwei/types";
import { loadAlgorithm, loadSihua, load, ROOT, ROOT_LABEL } from "./lib/loader.ts";
import { BRANCHES, chartSignature } from "./lib/compare.ts";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, "../scripts/purple-star.ts");
const SKILL_ROOT = resolve(HERE, "..");

// ── CLI --json 输出的形态 ──
// chart 即 ZiweiChart 的 JSON 往返形态：值为 undefined 的可选键（如无四化的 Star.siHua）
// 在 stringify 时消失，而可选键本就允许缺失，故结构上兼容 ZiweiChart —— 在此边界处
// 以 as 断言收窄（JSON.parse 只能给出 unknown，取值合法性由后续断言把守）。
/** analyze --json 的输出。 */
interface AnalyzeJson {
	chart: ZiweiChart;
}
/** heming --json 里一方（a / b）的输出。 */
interface HemingSide {
	chart: ZiweiChart;
	fuQiGong: string[];
	fuDeGong: string[];
}
/** locateSihua 的一项（analyze --json 的 located 数组元素）。 */
interface LocatedSihuaItem {
	hua: string;
	star: string;
	palace?: string | null;
	branch?: string | null;
	isMajor: boolean;
}
/** analyze --json 的动态四化层（liuNianSiHua / liuYueSiHua 共用形态）。 */
interface DynamicSihua {
	year?: number;
	month?: number;
	stem: string;
	transforms: Record<string, string>;
	located: LocatedSihuaItem[];
}
/** heming --json 的输出。 */
interface HemingJson {
	a: HemingSide;
	b: HemingSide;
}

/** 独立预言机组里一方的出生信息（合盘样本，只取 CLI `--a-*` / `--b-*` 需要的字段）。 */
interface HemingCase {
	date: string;
	time: string;
	gender: "male" | "female";
}

/** 把命令抛错包装成与 execFile 失败同形（带 .stderr），兼容 cliFails / cmdFails。 */
function asCliFailure(msg: string): Error & { stderr: string } {
	const e = new Error(`错误：${msg}`) as Error & { stderr: string };
	e.stderr = `错误：${msg}`;
	return e;
}

// 进程内复用的 COMMANDS 表（懒加载一次；含 iztro/db-analysis/classics/nihai，仅付一次冷启动税）。
let commandsMod: typeof import("@/cli/commands") | null = null;
let parseArgsFn: typeof import("@/cli/args").parseArgs | null = null;

/**
 * 进程内执行子命令：直接调 COMMANDS[sub](parseArgs(args), ctx)，与 purple-star.ts main() 同路径。
 * parseArgs / buildBirthInfo / 业务逻辑全部仍被测，只省掉「每个用例起一个 node 子进程」的冷启动税。
 */
async function cliCmdInProcess(sub: string, args: string[]): Promise<string> {
	if (!commandsMod) commandsMod = await load<typeof import("@/cli/commands")>("@/cli/commands");
	if (!parseArgsFn) ({ parseArgs: parseArgsFn } = await load<typeof import("@/cli/args")>("@/cli/args"));
	const fn = commandsMod.COMMANDS[sub];
	if (!fn) throw asCliFailure(`未知命令「${sub}」`);
	try {
		return await fn(parseArgsFn(args), { root: ROOT, rootLabel: ROOT_LABEL });
	} catch (err) {
		throw asCliFailure((err as Error).message);
	}
}

/** 永远走真子进程（防漂移冒烟用）：进程内路径替代不了它对子进程入口的覆盖。 */
async function cliReal(args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("node", [CLI, "analyze", ...args], { cwd: SKILL_ROOT });
	return stdout;
}

/**
 * 跑一次 CLI 的任意子命令，返回 stdout。失败时抛出带 stderr 的错误。
 *
 * 默认走**进程内**（直接调 COMMANDS[sub]，省掉每个用例起 node 子进程的冷启动税，CLI 层
 * 从 ~150s 降到 ~5s）。语义等价已用「进程内输出 ≡ 真子进程 stdout（仅差 console.log 尾部换行）」
 * 逐字节验证。真子进程入口由「内核加载防漂移」断言（cliReal）持续冒烟。
 * 需要全量真子进程时设 CLI_SUBPROCESS=1。
 */
async function cliCmd(sub: string, args: string[]): Promise<string> {
	if (!process.env.CLI_SUBPROCESS) return cliCmdInProcess(sub, args);
	const { stdout } = await execFileAsync("node", [CLI, sub, ...args], { cwd: SKILL_ROOT });
	return stdout;
}

/** 跑一次 CLI（analyze 子命令），返回 stdout。 */
async function cli(args: string[]): Promise<string> {
	return cliCmd("analyze", args);
}

/** 跑一次 CLI 并解析 --json 输出。 */
async function cliJson<T = AnalyzeJson>(args: string[]): Promise<T> {
	return JSON.parse(await cli([...args, "--json"])) as T;
}

/** 跑一次 CLI，断言它失败（非零退出），返回 stderr。 */
async function cliFails(args: string[]): Promise<string> {
	try {
		await cli(args);
	} catch (err) {
		return (err as { stderr?: string }).stderr ?? "";
	}
	assert.fail(`命令本应失败却成功了：purple-star.ts ${args.join(" ")}`);
}

const { generateChart } = await loadAlgorithm();
const { getSiHuaByStem } = await loadSihua();

describe("CLI 端到端", () => {
	describe("真太阳时校正", () => {
		// 样本 longitude 恒为 120，无法覆盖这段逻辑，故手工构造。
		// 经度 120°E 处校正量为 0；北京 116.4°E 偏西 3.6°，钟表时间需减 14.4 分钟。
		it("东经 120° 不做校正", async () => {
			const o = await cliJson(["--date", "1990-05-15", "--time", "09:10", "--lng", "120", "--gender", "male"]);
			assert.equal(o.chart.birthInfo.hour, 5, "09:10 应归巳时（branch 5）");
		});

		it("偏西经度把时辰推前一位（跨时辰边界）", async () => {
			// 09:10 经北京校正后为 08:55.6 —— 跨过 09:00 的时辰边界，落回辰时
			const o = await cliJson(["--date", "1990-05-15", "--time", "09:10", "--city", "北京", "--gender", "male"]);
			assert.equal(o.chart.birthInfo.longitude, 116.4);
			assert.equal(o.chart.birthInfo.hour, 4, "校正后应为辰时（branch 4），与不校正时差一位");
		});

		it("--eot 计入均时差，可把结果推过时辰边界；默认不计", async () => {
			// 1990-01-07 的均时差约 -6 分。北京经度校正 -14.4 分，09:20 只做经度校正时为 09:05.6，
			// 仍是巳时(5)；再减 6 分掉到 08:59.3，跨过 09:00 边界退回辰时(4)。
			// 这条同时钉住两件事：默认口径不变（第一段），以及两种口径的差别不是小数点级的（末段）。
			const base = ["--date", "1990-01-07", "--time", "09:20", "--city", "北京", "--gender", "male"];
			const mean = await cliJson(base);
			assert.equal(mean.chart.birthInfo.hour, 5, "默认口径（不计均时差）应为巳时");

			const apparent = await cliJson([...base, "--eot"]);
			assert.equal(apparent.chart.birthInfo.hour, 4, "计入均时差后应退回辰时");

			// 时辰一换，整张盘都换 —— 不是微调
			assert.notEqual(
				chartSignature(mean.chart),
				chartSignature(apparent.chart),
				"两种口径排出的是不同的盘，不能只当它是小数级差异"
			);
		});

		describe("真太阳时跨午夜：日期必须跟着走", () => {
			// 真太阳时是一条连续时间轴，日期与时辰都得取自它。只换时辰、把日期留在钟表轴上，
			// 排出的 (日, 时) 组合指向的就不是出生时刻：农历日错一天 → 紫微星定位错 → 十二宫全变。
			//
			// 等价性基准：真太阳时校正后的日期，用户本可以自己算出来手输。所以
			//   「跨天自动调整」的结果 必须等于「手工输入校正后的日期」的结果。
			// 这条基准不依赖任何写死的星曜值，且与实现走的是两条不同的输入路径。

			it("西部凌晨：校正后退回前一日（喀什 00:30 → 前一日 21:38 亥时）", async () => {
				const rolled = await cliJson([
					"--date", "1990-05-15", "--time", "00:30", "--lng", "75.99", "--gender", "male", "--eot",
				]);
				assert.equal(rolled.chart.birthInfo.day, 14, "真太阳时落到前一日，日期须回退");
				assert.equal(rolled.chart.birthInfo.hour, 11, "21:38 属亥时");

				// 手工输入校正后的日期与时辰，应得到同一张盘
				const manual = await cliJson([
					"--date", "1990-05-14", "--branch", "11", "--gender", "male",
				]);
				assert.equal(
					chartSignature(rolled.chart),
					chartSignature(manual.chart),
					"自动跨天与手工输入校正后日期，必须排出同一张盘"
				);
			});

			it("东部深夜：校正后前进到次日（哈尔滨 23:30 → 次日 00:00 子时）", async () => {
				const rolled = await cliJson([
					"--date", "1990-05-15", "--time", "23:30", "--lng", "126.6", "--gender", "male", "--eot",
				]);
				assert.equal(rolled.chart.birthInfo.day, 16, "真太阳时落到次日，日期须顺延");
				assert.equal(rolled.chart.birthInfo.hour, 0, "00:00 属子时");

				const manual = await cliJson([
					"--date", "1990-05-16", "--branch", "0", "--gender", "male",
				]);
				assert.equal(
					chartSignature(rolled.chart),
					chartSignature(manual.chart),
					"自动跨天与手工输入校正后日期，必须排出同一张盘"
				);
			});

			it("跨天才调日期：不跨天时日期一位不动", async () => {
				// 同样是西部城市，正午不会跨天；日期若被无条件改动，这条会红
				const o = await cliJson([
					"--date", "1990-05-15", "--time", "12:00", "--lng", "75.99", "--gender", "male", "--eot",
				]);
				assert.equal(o.chart.birthInfo.day, 15);
			});
		});
	});

	describe("城市名解析", () => {
		it("简称 / 全称 / 省市全名 解析为同一经度", async () => {
			const forms = ["杭州", "杭州市", "浙江省杭州市"];
			const lngs: Array<number | undefined> = [];
			for (const city of forms) {
				const o = await cliJson(["--date", "1990-05-15", "--time", "09:30", "--city", city, "--gender", "male"]);
				lngs.push(o.chart.birthInfo.longitude);
			}
			assert.equal(new Set(lngs).size, 1, `三种写法应给同一经度，实际 ${JSON.stringify(lngs)}`);
			assert.ok(lngs[0]! > 119 && lngs[0]! < 121, `杭州经度应在 119-121 之间，实际 ${lngs[0]}`);
		});

		it("未收录城市报错而非静默取默认值", async () => {
			const stderr = await cliFails([
				"--date", "1990-05-15", "--time", "09:30", "--city", "不存在的地名", "--gender", "male",
			]);
			assert.match(stderr, /城市|经度/, "应提示城市无法解析");
		});
	});

	describe("性别护栏", () => {
		// 性别决定大限顺逆，缺失会排出错盘 —— CLI 必须报错而不是替用户猜
		it("缺失性别时报错退出", async () => {
			const stderr = await cliFails(["--date", "1990-05-15", "--time", "09:30"]);
			assert.match(stderr, /性别/);
		});

		it("性别取值非法时报错退出", async () => {
			const stderr = await cliFails(["--date", "1990-05-15", "--time", "09:30", "--gender", "xyz"]);
			assert.match(stderr, /性别|male|female/);
		});

		it("male / m / 男 等价，female / f / 女 等价", async () => {
			const males: string[] = [];
			for (const g of ["male", "m", "男"]) {
				const o = await cliJson(["--date", "1990-05-15", "--branch", "5", "--gender", g]);
				males.push(JSON.stringify(o.chart.daXians));
			}
			assert.equal(new Set(males).size, 1, "三种 male 写法应给同一张大限表");

			const a = await cliJson(["--date", "1990-05-15", "--branch", "5", "--gender", "female"]);
			// 字段名写死为 birthInfo.gender 并断言**确切值**，不用 `??` 兜底 ——
			// 兜底写法（`a.chart.gender ?? a.chart.birthInfo.gender` 不等于 "male"）在字段
			// 改名时会假通过：两边都取不到即 undefined，而 undefined !== "male" 恒成立。
			// 这里正是最需要盯住的地方 —— 性别决定大限顺逆，取错会排出整张错盘。
			assert.equal(a.chart.birthInfo.gender, "female", "性别应回填为 female");
			assert.notEqual(
				JSON.stringify(a.chart.daXians),
				males[0],
				"性别决定大限顺逆，female 与 male 的大限表不应相同"
			);
		});
	});

	describe("农历入参", () => {
		it("--lunar 换算出的农历与回填的 lunarInfo 一致", async () => {
			const o = await cliJson(["--lunar", "1988-06-26", "--branch", "5", "--gender", "male"]);
			assert.equal(o.chart.lunarInfo.lunarYear, 1988);
			assert.equal(o.chart.lunarInfo.lunarMonth, 6);
			assert.equal(o.chart.lunarInfo.lunarDay, 26);
			assert.equal(o.chart.lunarInfo.isLeapMonth, false);
		});

		it("闰月用 --leap 指定，且与 lunar-typescript 的独立换算一致", async () => {
			// 1960 年闰六月。用 lunar-typescript 独立算出该闰月首日的公历日期作为期望值。
			const { Lunar } = await import("lunar-typescript");
			const expected = Lunar.fromYmd(1960, -6, 1).getSolar();
			const o = await cliJson(["--lunar", "1960-06-01", "--leap", "--branch", "5", "--gender", "male"]);
			assert.equal(o.chart.birthInfo.year, expected.getYear());
			assert.equal(o.chart.birthInfo.month, expected.getMonth());
			assert.equal(o.chart.birthInfo.day, expected.getDay());
			assert.equal(o.chart.lunarInfo.isLeapMonth, true, "应识别为闰月");
			assert.equal(o.chart.lunarInfo.lunarMonth, 6);
		});

		it("公历与等价农历排出同一张盘", async () => {
			const viaSolar = await cliJson(["--date", "1988-08-08", "--branch", "5", "--gender", "male"]);
			const { Lunar } = await import("lunar-typescript");
			const l = Lunar.fromYmd(1988, 6, 26);
			const s = l.getSolar();
			const viaLunar = await cliJson([
				"--lunar", `1988-06-26`, "--branch", "5", "--gender", "male",
			]);
			assert.equal(viaLunar.chart.birthInfo.year, s.getYear());
			assert.equal(
				chartSignature(viaLunar.chart),
				chartSignature(viaSolar.chart),
				"农历入参与其对应公历入参应排出同一张盘"
			);
		});
	});

	describe("晚子时", () => {
		// 23:00-23:59 出生时两种口径排出的是两张不同的盘。--branch 12 即「算次日」口径。
		it("--branch 12 ≡ 次日 --branch 0（逐宫一致）", async () => {
			const lateZi = await cliJson(["--date", "1990-05-15", "--branch", "12", "--gender", "male"]);
			const nextDay = await cliJson(["--date", "1990-05-16", "--branch", "0", "--gender", "male"]);
			assert.equal(
				chartSignature(lateZi.chart),
				chartSignature(nextDay.chart),
				"晚子时口径应与次日早子时排出同一张盘"
			);
		});

		it("晚子时与当日早子时是两张不同的盘", async () => {
			const early = await cliJson(["--date", "1990-05-15", "--branch", "0", "--gender", "male"]);
			const late = await cliJson(["--date", "1990-05-15", "--branch", "12", "--gender", "male"]);
			assert.notEqual(
				chartSignature(early.chart),
				chartSignature(late.chart),
				"同日早子时与晚子时不应排出同一张盘（这是本项目反复强调的陷阱）"
			);
		});
	});

	// ── 宫名口径在 CLI 层的行为 ──
	//
	// 这两组是本仓**唯一**覆盖 `--focus` 与 `heming` 的断言（此前零覆盖），
	// 而它们恰是宫名从 iztro 口径切到项目口径时最容易静默失效的两个点：
	// `--focus` 靠宫名字符串查找，`heming` 靠宫名字符串取宫后立刻读 `.branch`
	// （旧名会返回 undefined → TypeError，且 `--json` 分支更早 return，会**静默输出空数组**）。
	describe("--focus 的宫名写法", () => {
		const BIRTH = ["--date", "1990-05-15", "--time", "09:30", "--gender", "male"];

		/**
		 * 从 analyze 文本输出里取出聚焦到的宫名与地支 —— 取的是**渲染值**，不是查找键。
		 * 断言「不同写法解析到同一宫」只能靠比对渲染结果，输入字符串本身没有可比性。
		 */
		function focusOf(stdout: string): { name: string; branch: string } {
			const m = stdout.match(/【聚焦：(.+?)】\n\s*(.+?)【(.)/);
			assert.ok(m, `输出里找不到聚焦段落：\n${stdout.slice(0, 300)}`);
			return { name: m[1], branch: m[3] };
		}

		it("「交友宫 / 交友 / 仆役 / 仆役宫」四种写法聚焦到同一宫", async () => {
			const got: Array<{ w: string; name: string; branch: string }> = [];
			for (const w of ["交友宫", "交友", "仆役", "仆役宫"]) {
				got.push({ w, ...focusOf(await cli([...BIRTH, "--focus", w])) });
			}
			for (const g of got.slice(1)) {
				assert.equal(g.name, got[0].name, `--focus ${g.w} 与 --focus 交友宫 落在不同的宫`);
				assert.equal(g.branch, got[0].branch, `--focus ${g.w} 与 --focus 交友宫 地支不同`);
			}
			// 再钉住实际值：这张盘（1990-05-15 巳时，命宫在子）的交友宫在巳。
			// 安星法若变了这里会红 —— 那是要人看一眼的信号，与上面「四种写法一致」是两回事。
			assert.equal(got[0].name, "交友宫");
			assert.equal(got[0].branch, "巳");
		});

		it("普通宫的「全名」与「去宫字简称」等价", async () => {
			const full = focusOf(await cli([...BIRTH, "--focus", "夫妻宫"]));
			const short = focusOf(await cli([...BIRTH, "--focus", "夫妻"]));
			assert.equal(short.name, full.name);
			assert.equal(short.branch, full.branch);
			assert.equal(full.name, "夫妻宫");
		});

		it("地支名仍走分支匹配", async () => {
			// 地支匹配的是「地支为该字的那一宫」，**不一定是命宫**。这里刻意取一个非命宫的
			// 地支，把「地支被当成宫名简称」这种误读挡在门外。
			const p = focusOf(await cli([...BIRTH, "--focus", "巳"]));
			assert.equal(p.branch, "巳");
			assert.equal(p.name, "交友宫", "巳宫在这张盘上应是交友宫");
		});
	});

	describe("heming 合盘", () => {
		const PAIR = [
			"--a-date", "1990-05-15", "--a-time", "09:30", "--a-gender", "male",
			"--b-date", "1992-08-20", "--b-time", "14:00", "--b-gender", "female",
		];

		it("--json 的夫妻宫/福德宫派生字段与 chart 自洽", async () => {
			const o = JSON.parse(await cliCmd("heming", [...PAIR, "--json"])) as HemingJson;
			for (const side of ["a", "b"] as const) {
				const chart = o[side].chart;
				for (const [field, palaceName] of [
					["fuQiGong", "夫妻宫"],
					["fuDeGong", "福德宫"],
				] as const) {
					// mustPalace 取不到宫会抛错、走不到这里；但**取错了宫**（例如内部退回 iztro
					// 旧名却恰好命中了别的宫）不抛错，故把派生字段与 chart 里同名宫的主星对一遍。
					const p = chart.palaces.find(x => x.name === palaceName);
					assert.ok(p, `${side}.chart 里没有「${palaceName}」—— 宫名口径已漂移`);
					assert.deepEqual(
						o[side][field],
						p.stars.filter(s => s.type === "major").map(s => s.name),
						`${side}.${field} 与 chart 里「${palaceName}」的主星不符`
					);
				}
			}
		});

		it("文本路径同样跑通（宫名查找失败在此路径表现为崩溃）", async () => {
			const text = await cliCmd("heming", PAIR);
			assert.match(text, /【合盘/);
			assert.match(text, /夫妻宫/);
			assert.match(text, /福德宫/);
		});
	});

	// ── 合盘：独立预言机 ──
	//
	// 上一组守的是「宫名查找落空」（旧名会让 `--json` 静默输出空数组、文本路径抛 TypeError）。
	// 这一组守的是**合盘的论断本身**：两方参数有没有各就各位、取到的宫位与生年四化算没算对、
	// 天作之合的交叉判定方向有没有写反 —— 这几处出错都**不报错**，只是输出一份看起来正常的错结论。
	//
	// 独立性来自两条分岔的路径：
	//   1. **期望值**一律由本进程用 `generateChart` 独立排盘、再按安星法恒等式复算，
	//      或取「交换 `--a-*` / `--b-*` 后的另一次运行」—— 都不读 `cmdHeming` 的中间量；
	//   2. **被测值**只取 CLI 子进程的文本 / JSON 输出，从不反过来拿它算期望值。
	describe("heming 合盘：独立预言机", () => {
		// 刻意与上一组用**不同**的一对出生信息，两组合起来覆盖更多盘。
		// 这一对是挑过的：甲乙**都**有生年四化入夫妻宫，且乙方夫妻宫主星与甲方命宫主星相交
		// （两向交集若都为空，「交集列表为空」与「方向写反」都会通过，断言就空转了）。
		const A: HemingCase = { date: "1980-02-03", time: "18:30", gender: "male" };
		const B: HemingCase = { date: "1992-08-20", time: "14:00", gender: "female" };
		// 第二对：专为「天作之合」的**方向**而挑。要求 `甲夫 ∩ 乙命` 非空、而
		// `甲夫 ∩ 甲命` 为空 —— 否则交叉判定写反成「甲夫 ∩ 甲命」时结论不变，注入测试
		// 验证过：在原本那一对上，方向写反**不会**让任何断言变红。
		const CROSS_A: HemingCase = { date: "1975-01-04", time: "00:30", gender: "male" };
		const CROSS_B: HemingCase = { date: "1976-09-13", time: "12:30", gender: "female" };
		// 第三对：甲方夫妻宫**空宫**、须借对宫主星论 —— 那是合盘断语的常见路径，单独覆盖。
		const EMPTY_A: HemingCase = { date: "1985-01-10", time: "06:30", gender: "male" };

		const argsOf = (a: HemingCase, b: HemingCase): string[] => [
			"--a-date", a.date, "--a-time", a.time, "--a-lng", "120", "--a-gender", a.gender,
			"--b-date", b.date, "--b-time", b.time, "--b-lng", "120", "--b-gender", b.gender,
		];

		/** 时刻 → 时辰支（东经 120° 校正量为 0 时）。用的是安星法的时辰划分，独立于 CLI 实现。 */
		const toHour = (t: string): number => Math.floor((Number(String(t).split(":")[0]) + 1) / 2) % 12;

		/** 用内核按同一出生信息独立排一张盘 —— 本 describe 里所有期望值的唯一来源。 */
		const chartOf = (cfg: HemingCase): ZiweiChart => {
			const [year, month, day] = cfg.date.split("-").map(Number);
			return generateChart({ year, month, day, hour: toHour(cfg.time), gender: cfg.gender, longitude: 120 });
		};

		/**
		 * 对齐序列化：`--json` 的盘是 JSON 往返过的，值为 `undefined` 的键（如无四化的
		 * `Star.siHua`）在 `stringify` 时已消失；直排的盘没这一步。不先对齐的话，
		 * 差异全来自序列化而非排盘 —— 那正是「比对器测错了东西」的经典形态。
		 * 只丢 `undefined` 值的键，有值的字段一个不少。
		 */
		const asJson = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

		const majorsOf = (chart: ZiweiChart, name: string): string[] =>
			chart.palaces.find(p => p.name === name)!.stars.filter(s => s.type === "major").map(s => s.name);

		// 起一次 CLI 子进程约 0.6 秒，故每个组合只跑一次，全 describe 共用（node:test 同文件内串行）。
		const memo = <T>(fn: () => T): (() => T) => {
			let v: T | undefined;
			return () => (v ??= fn());
		};
		const pairJson = memo(async () => JSON.parse(await cliCmd("heming", [...argsOf(A, B), "--json"])) as HemingJson);
		const swapJson = memo(async () => JSON.parse(await cliCmd("heming", [...argsOf(B, A), "--json"])) as HemingJson);
		const pairText = memo(() => cliCmd("heming", argsOf(A, B)));
		const crossText = memo(() => cliCmd("heming", argsOf(CROSS_A, CROSS_B)));
		const emptyText = memo(() => cliCmd("heming", argsOf(EMPTY_A, B)));

		it("交换 --a-* / --b-* 后，两方命盘精确互换", async () => {
			const d = await pairJson();
			const s = await swapJson();
			assert.notDeepEqual(
				d.a.chart,
				d.b.chart,
				"两方出生信息不同却排出同一张盘 —— --a-* / --b-* 可能读到了同一份参数"
			);
			assert.deepEqual(s.a.chart, d.b.chart, "交换后甲方的盘应精确等于原乙方的盘");
			assert.deepEqual(s.b.chart, d.a.chart, "交换后乙方的盘应精确等于原甲方的盘");
		});

		it("两方命盘各自等于按同一出生信息独立排的盘（时辰、经度、性别都不串台）", async () => {
			// 这条比上面强：它逐字段核对**整张盘**，因而连性别（决定大限顺逆）也一并钉住 ——
			// 若 `--b-gender` 被忽略、两方都按男命排，这里会红，而「交换后互换」是察觉不到的。
			const o = await pairJson();
			for (const [side, cfg, who] of [
				["a", A, "甲"],
				["b", B, "乙"],
			] as const) {
				assert.deepEqual(
					o[side].chart,
					asJson(chartOf(cfg)),
					`${who}方的盘与按 ${cfg.date} ${cfg.time} ${cfg.gender} 独立排的盘不符`
				);
			}
		});

		it("文本里的命宫/夫妻宫/福德宫地支满足「相对命宫逆行」恒等式", async () => {
			// 「夫妻宫 = 命宫地支 −2、福德宫 = 命宫地支 +2」出自安星法本身，与被测实现零共享路径。
			// `mustPalace` 取错宫、或渲染时用错变量，都会让某一行与**同一方的命宫行**对不上 ——
			// 而命宫行的地支由 `mingGongBranch` 直取，是这一组里最可信的锚点。
			const texts = [
				["样本一", await pairText()],
				["样本二", await crossText()],
			] as const;
			for (const [tag, t] of texts) {
				const rows = [...t.matchAll(/^  (命宫|夫妻宫|福德宫) (.)：/gm)].map(m => ({
					palace: m[1],
					branch: BRANCHES.indexOf(m[2]),
				}));
				assert.equal(rows.length, 6, `${tag}：应有甲乙两方 × 三宫共 6 行，实得 ${rows.length} 行`);
				for (const s of [0, 1]) {
					const who = `${tag}${s ? "乙" : "甲"}方`;
					const [ming, fuqi, fude] = rows.slice(s * 3, s * 3 + 3);
					assert.equal(ming.palace, "命宫", `${who}第 1 行应为命宫`);
					assert.equal(fuqi.palace, "夫妻宫", `${who}第 2 行应为夫妻宫`);
					assert.equal(fude.palace, "福德宫", `${who}第 3 行应为福德宫`);
					assert.ok(ming.branch >= 0, `${who}命宫地支解析失败：${ming.branch}`);
					assert.equal((fuqi.branch - ming.branch + 12) % 12, 10, `${who}夫妻宫应在命宫地支 −2`);
					assert.equal((fude.branch - ming.branch + 12) % 12, 2, `${who}福德宫应在命宫地支 +2`);
				}
			}
		});

		it("生年四化入夫妻宫的判定与独立复算一致", async () => {
			const t = await pairText();
			let hits = 0;
			for (const [cfg, who] of [
				[A, "甲"],
				[B, "乙"],
			] as const) {
				const chart = chartOf(cfg);
				// 年干取农历年干（chart.lunarInfo.yearStem），与 iztro 落在 Star.siHua 上的
				// mutagen 同源。样本 A（1980-02-03）农历仍在己未年 —— 若预言机按公历年取模
				// （庚），它会与被测实现共用同一个错口径，测试假绿（历史上确实如此）。
				const transforms = getSiHuaByStem(chart.lunarInfo.yearStem);
				// 独立路径：先由年干取四化**星名**，再到盘上找那颗星坐在哪个宫 —— 不调 locateSihua。
				const expect = (["禄", "权", "科", "忌"] as const).filter(h =>
					chart.palaces.some(
						p => p.name === "夫妻宫" && p.stars.some(s => s.name === transforms[h])
					)
				);
				const got = [
					...t.matchAll(new RegExp(`^  ${who}方 生年.干 化(.+?)（.+?）入夫妻宫：`, "gm")),
				].map(m => m[1]);
				assert.deepEqual(got, expect, `${who}方：文本列出的四化与独立复算不符`);
				hits += expect.length;
			}
			// 样本守卫：这一对若一条都没命中，`[] === []` 会静默通过，断言就成了摆设。
			assert.ok(hits > 0, "这对样本没有任何四化入夫妻宫，本条断言在空转 —— 请换样本");
		});

		it("天作之合的交叉集合与判定方向与独立复算一致", async () => {
			const t = await crossText();
			const [cA, cB] = [chartOf(CROSS_A), chartOf(CROSS_B)];
			const [mA, mB] = [majorsOf(cA, "命宫"), majorsOf(cB, "命宫")];
			const [fA, fB] = [majorsOf(cA, "夫妻宫"), majorsOf(cB, "夫妻宫")];
			const crossA = fA.filter(s => mB.includes(s));
			const crossB = fB.filter(s => mA.includes(s));
			assert.ok(
				t.includes(`甲方夫妻宫主星 ∩ 乙方命宫主星：${crossA.join("、") || "无"}`),
				"「甲夫 ∩ 乙命」的交集列表与独立复算不符"
			);
			assert.ok(
				t.includes(`乙方夫妻宫主星 ∩ 甲方命宫主星：${crossB.join("、") || "无"}`),
				"「乙夫 ∩ 甲命」的交集列表与独立复算不符"
			);
			const verdict =
				crossA.length && crossB.length
					? "双向对应"
					: crossA.length || crossB.length
						? "单向对应"
						: "无主星对应";
			assert.ok(t.includes(`→ ${verdict}`), `对应关系判定应为「${verdict}」`);
			// 样本守卫：两向交集皆空时，「列表为空」与「方向整个写反」输出完全一样。
			assert.ok(crossA.length || crossB.length, "这对样本两向交集皆空，本条断言在空转 —— 请换样本");
		});

		it("晚子时提醒只落在命中的一方，且参数前缀正确", async () => {
			// 甲方钟表 23:30、东经 120°（校正量为 0），校正后仍是晚子时；乙方正常。
			const t = await cliCmd("heming", argsOf({ ...A, time: "23:30" }, B));
			assert.ok(t.includes("⚠️ 甲方出生时间落在 23:00–23:59"), "应提示甲方落在晚子时");
			assert.ok(t.includes("--a-late-zi"), "应指明改用 --a-late-zi 复核");
			assert.ok(!t.includes("⚠️ 乙方出生时间"), "乙方不在晚子时，不应被提示");
		});

		it("夫妻宫空宫时，断语改用借自对宫的主星", async () => {
			const t = await emptyText();
			const fuqi = chartOf(EMPTY_A).palaces.find(p => p.name === "夫妻宫")!;
			// 样本前提先钉死，否则下面两条会退化成都市真（空数组、空字符串都不会报错）。
			assert.equal(fuqi.stars.filter(s => s.type === "major").length, 0, "样本前提：甲方夫妻宫须为空宫");
			assert.ok(fuqi.borrowedStars?.length, "样本前提：该空宫须借得到对宫主星");
			assert.ok(
				t.includes(`甲方夫妻宫空宫，借对宫 ${fuqi.borrowedFromName} 主星论：`),
				"夫妻宫空宫时未按借宫口径出断语"
			);
			for (const s of fuqi.borrowedStars ?? [])
				assert.ok(t.includes(`    ${s}：`), `借来的主星 ${s} 没有出断语`);
		});
	});

	describe("内核加载防漂移", () => {
		// test/lib/loader.ts 是 scripts/purple-star.ts 加载机制的副本。
		// 若两侧的 registerHooks / pickRoot 分叉（例如 CLI 改了别名解析而测试没跟上），
		// 这条断言会把差异暴露出来 —— 否则测试可能一直在验证一个与线上不同的内核。
		it("内核直调结果 ≡ CLI --json 输出", async () => {
			const birth: BirthInfo = { year: 1990, month: 5, day: 15, hour: 5, gender: "male", longitude: 120 };
			const direct = generateChart({ ...birth });
			// ⚠️ 这条必须走**真子进程**（cliReal）：它盯的是「测试进程内的内核」与「真实 CLI 子进程」不漂移。
			//    走进程内 cliJson 会退化成「进程内 ≡ 进程内」，失去防漂移意义。
			const viaCli = JSON.parse(await cliReal([
				"--date", "1990-05-15", "--branch", "5", "--lng", "120", "--gender", "male", "--json",
			])) as AnalyzeJson;
			assert.equal(
				chartSignature(direct),
				chartSignature(viaCli.chart),
				"内核直调与 CLI 输出的盘不一致 —— 两侧加载机制可能已分叉"
			);
			assert.deepEqual(
				direct.lunarInfo,
				viaCli.chart.lunarInfo,
				"农历信息也应一致（--lng 120 时无真太阳时校正）"
			);
		});
	});

	describe("生年四化的年干口径", () => {
		// iztro 落在 Star.siHua 上的 mutagen 按农历年干标注；analyze / heming 的
		// 【生年四化】区块若改按公历年取模（getYearStemIndex），1-2 月出生（农历仍在
		// 上一年）者两口径分叉：同屏出现「武曲化禄」（宫详表，农历口径）与「化权武曲」
		// （区块，公历口径）互相矛盾。区块必须与盘面同源 —— 即 chart.lunarInfo.yearStem。
		it("跨年月出生按农历年干（1990-01-15 = 农历己巳年腊月，非公历取模的庚）", async () => {
			const chart = generateChart({ year: 1990, month: 1, day: 15, hour: 5, gender: "male" });
			assert.equal(chart.lunarInfo.yearStem, 5, "样本前提：1990-01-15 农历年干应为己（索引 5）");
			const t = await cli(["--date", "1990-01-15", "--branch", "5", "--gender", "male"]);
			assert.ok(t.includes("【生年四化】年干 己"), "年干应取农历年干「己」，而非公历取模的「庚」");
			for (const h of ["禄", "权", "科", "忌"] as const) {
				const star = getSiHuaByStem(5)[h];
				assert.ok(t.includes(`化${h} ${star}`), `化${h} 应为己干四化的「${star}」`);
			}
		});

		it("生年四化区块与盘面 mutagen 标记逐颗一致（金标准不变量）", async () => {
			// 盘面 Star.siHua（iztro mutagen，农历年干口径）是金标准：区块里的四颗
			// 「化X 星Y」必须恰为盘面上所有带 siHua 标记的星，一颗不多一颗不少。
			const birth = { year: 1990, month: 1, day: 15, hour: 5, gender: "male" } as const;
			const onChart = generateChart({ ...birth })
				.palaces.flatMap(p => p.stars)
				.filter(s => s.siHua)
				.map(s => `${s.siHua}:${s.name}`)
				.sort();
			const t = await cli(["--date", "1990-01-15", "--branch", "5", "--gender", "male"]);
			// 只取【生年四化】区块 —— 流年/流月区块的行格式相同，混入会误判
			const block = t.split("【生年四化】")[1]?.split("【")[0] ?? "";
			const inBlock = [...block.matchAll(/化([禄权科忌]) (.+?) → /g)]
				.map(m => `${m[1]}:${m[2]}`)
				.sort();
			assert.deepEqual(inBlock, onChart, "【生年四化】区块与盘面 mutagen 不一致 —— 双口径分叉");
		});
	});

	describe("流年/流月四化", () => {
		// 层 3 已核过两函数的算术（五虎遁口诀表、lunar 年柱、固定向量），这里测
		// **CLI 组装**：标题行、四化落宫、以及三条只有端到端才能钉住的口径 ——
		// 流月由「流年干」推（不串生年干）、生年/流年两口径刻意分家、--json 派生字段。
		// 期望值一律由本进程 generateChart 独立排盘后**按星名直接找宫**，不走 locateSihua
		//（那是被测实现的渲染路径，用它算期望值就成了复读机）。

		/** 独立定位：按星名在盘上找宫，返回与文本行同形态的「宫名(支)」；找不到即「（未上盘）」。 */
		const locateByStar = (chart: ZiweiChart, star: string): string => {
			const p = chart.palaces.find(pp => pp.stars.some(s => s.name === star));
			return p ? `${p.name}(${BRANCHES[p.branch]})` : "（未上盘）";
		};

		/** 复核一整层四化：每颗「化X 星Y → 宫(支)」行都须与独立复算逐字一致。
		 *  各调用用例的 --date 均为 1990-05-15，故独立排盘也钉这份出生信息。 */
		const assertRows = async (args: string[], header: string, stemIndex: number) => {
			const t = await cli(args);
			const block = t.split(header)[1]?.split("【")[0] ?? "";
			const rows = [...block.matchAll(/化([禄权科忌]) (\S+) → (.+)$/gm)];
			assert.equal(rows.length, 4, `${header} 区块应恰有 4 行，实得 ${rows.length}`);
			const transforms = getSiHuaByStem(stemIndex);
			const chart = generateChart({ year: 1990, month: 5, day: 15, hour: 5, gender: "male" });
			for (const m of rows) {
				const [hua, star, palace] = [m[1]!, m[2]!, m[3]!];
				assert.equal(transforms[hua as "禄"], star, `化${hua}应为该干四化的「${transforms[hua as "禄"]}」`);
				assert.equal(palace, locateByStar(chart, star), `化${hua} ${star} 的落宫应与独立复算一致`);
			}
			return t;
		};

		it("--liunian 2026：年干丙，四化落宫与独立复算一致", async () => {
			// (2026−4) mod 10 = 2 → 丙。标题行钉干支，四行落宫走 assertRows 独立复算。
			await assertRows(
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liunian", "2026"],
				"【2026 流年四化】",
				2
			);
		});

		it("--liuyue 走五虎遁：2027 丁年正月月干壬，落宫与独立复算一致", async () => {
			const t = await assertRows(
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liunian", "2027", "--liuyue", "1"],
				"【2027 年 农历1月 流月四化】",
				8 // 丁年正月壬寅 → 月干壬
			);
			assert.ok(
				t.includes("月干 壬（五虎遁，由流年干 丁 推）"),
				"标题应写明月干壬及其推导来源（丁年正月起壬寅）"
			);
		});

		it("流月由流年干推，不串生年干（生年庚 × 流年甲 → 正月月干丙）", async () => {
			// 1990-06-15 在农历庚午年内（生年干庚）；--liunian 2024 为甲年，正月丙寅。
			// 若误用生年干庚推月干会得「戊」—— 两口径月干不同，此样本专钉不串台。
			const chart = generateChart({ year: 1990, month: 6, day: 15, hour: 5, gender: "male" });
			assert.equal(chart.lunarInfo.yearStem, 6, "样本前提：1990-06-15 农历年干应为庚（索引 6）");
			const t = await cli([
				"--date", "1990-06-15", "--branch", "5", "--gender", "male",
				"--liunian", "2024", "--liuyue", "1",
			]);
			assert.ok(
				t.includes("月干 丙（五虎遁，由流年干 甲 推）"),
				"甲年正月应起丙寅；若串成生年干庚会推得「戊」"
			);
		});

		it("生年与流年的年干口径刻意分家：1990-01-15 生年己（农历）、流年庚（公历）同屏", async () => {
			// 生年四化取农历年干（chart.lunarInfo.yearStem，2026-09 修复），流年四化取
			// 公历年取模 —— 两口径在 1-2 月出生者身上分叉，且**应当**分家：
			// 问「1990 年流年」指公历 1990 这一年，与出生那年的农历归属无关。
			const t = await cli([
				"--date", "1990-01-15", "--branch", "5", "--gender", "male", "--liunian", "1990",
			]);
			assert.ok(t.includes("【生年四化】年干 己"), "生年应取农历年干「己」（己巳年腊月）");
			assert.ok(t.includes("【1990 流年四化】年干 庚"), "流年应取公历取模的「庚」");
		});

		it("--liunian / --liuyue 参数护栏（缺值、越界、非数字均报错，不静默产出）", async () => {
			for (const args of [
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liunian"], // 旗标没跟值
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liunian", "0"],
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liunian", "10000"],
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liuyue", "0"],
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liuyue", "13"],
				["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liuyue", "abc"],
			] as string[][]) {
				const stderr = await cliFails(args);
				const flag = args.includes("--liunian") ? "--liunian" : "--liuyue";
				assert.ok(stderr.includes(flag), `报错应点名 ${flag}（${args[args.length - 1]}），实得：${stderr}`);
			}
		});

		it("--json 的 liuNianSiHua / liuYueSiHua 与独立复算一致", async () => {
			const j = await cliJson<AnalyzeJson & { liuNianSiHua: DynamicSihua; liuYueSiHua: DynamicSihua }>([
				"--date", "1990-05-15", "--branch", "5", "--gender", "male",
				"--liunian", "2026", "--liuyue", "3",
			]);
			assert.equal(j.liuNianSiHua.year, 2026);
			assert.equal(j.liuNianSiHua.stem, "丙");
			assert.equal(j.liuYueSiHua.month, 3);
			assert.equal(j.liuYueSiHua.stem, "壬", "丙年正月起庚寅，三月壬（五虎遁顺推）");
			const chart = generateChart({ year: 1990, month: 5, day: 15, hour: 5, gender: "male" });
			for (const [transforms, located] of [
				[getSiHuaByStem(2), j.liuNianSiHua.located],
				[getSiHuaByStem(8), j.liuYueSiHua.located],
			] as const) {
				assert.equal(located.length, 4, "每层四化应恰 4 颗");
				for (const x of located) {
					assert.equal(transforms[x.hua as "禄"], x.star, `化${x.hua}的星名与四化表不符`);
					const palace = chart.palaces.find(p => p.stars.some(s => s.name === x.star));
					assert.equal(x.palace ?? null, palace?.name ?? null, `${x.star} 的落宫应与独立复算一致`);
				}
			}
		});
	});

	describe("analyze 参数校验", () => {
		it("--liunian 非数字报错退出（不得静默产出 NaN 四化）", async () => {
			const stderr = await cliFails([
				"--date", "1990-05-15", "--branch", "5", "--gender", "male", "--liunian", "abc",
			]);
			assert.ok(stderr.includes("--liunian"), `报错应点名 --liunian，实得：${stderr}`);
		});

		it("--late-zi 与 --branch 同用报错（该开关只配合 --time）", async () => {
			const stderr = await cliFails([
				"--date", "1990-05-15", "--branch", "5", "--gender", "male", "--late-zi",
			]);
			assert.ok(stderr.includes("--late-zi"), `报错应点名 --late-zi，实得：${stderr}`);
		});
	});

	describe("topic 论断命令", () => {
		/** 跑一次任意子命令并断言失败（cliFails 是 analyze 专用的）。 */
		async function cmdFails(sub: string, args: string[]): Promise<string> {
			try {
				await cliCmd(sub, args);
			} catch (err) {
				return (err as { stderr?: string }).stderr ?? "";
			}
			assert.fail(`命令本应失败却成功了：purple-star.ts ${sub} ${args.join(" ")}`);
		}

		it("不带 --topic 时列出 13 个主题清单", async () => {
			const t = await cliCmd("topic", ["--date", "1990-05-15", "--branch", "5", "--gender", "male"]);
			assert.ok(t.includes("overview") && t.includes("love") && t.includes("parents"),
				"应列出全部主题 key");
		});

		it("love 主题产出夫妻宫论断（本命视角，非空壳）", async () => {
			const t = await cliCmd("topic", [
				"--date", "1990-05-15", "--branch", "5", "--gender", "male", "--topic", "love",
			]);
			assert.ok(t.includes("夫妻"), "love 主题应指向夫妻宫（宫名口径适配生效）");
			assert.ok(t.length > 300, `论断文本不应是空壳，实得 ${t.length} 字`);
			assert.ok(!t.includes("无法找到"), "按宫名找宫失配会输出兜底文案 —— 宫名口径未适配");
		});

		it("friends 主题适配项目宫名口径（iztro 旧口径「仆役」→「交友宫」）", async () => {
			const t = await cliCmd("topic", [
				"--date", "1990-05-15", "--branch", "5", "--gender", "male", "--topic", "friends",
			]);
			assert.ok(!t.includes("无法找到"), "friends 主题按「交友宫」找宫不应失配");
		});

		it("四种 view（本命/大限/流年/流月）均可产出", async () => {
			const base = ["--date", "1990-05-15", "--branch", "5", "--gender", "male", "--topic", "wealth"];
			for (const view of ["mingpan", "daxian", "liunian", "liuyue"]) {
				const t = await cliCmd("topic", [...base, "--view", view]);
				assert.ok(t.length > 100 && !t.includes("无法找到"), `view=${view} 应正常产出`);
			}
		});

		it("未知 topic 报错并列出可用值", async () => {
			const stderr = await cmdFails("topic", [
				"--date", "1990-05-15", "--branch", "5", "--gender", "male", "--topic", "xyz",
			]);
			assert.ok(stderr.includes("--topic"), `报错应点名 --topic，实得：${stderr}`);
		});

		it("输出末尾带知识来源分级提示", async () => {
			const t = await cliCmd("topic", [
				"--date", "1990-05-15", "--branch", "5", "--gender", "male", "--topic", "career",
			]);
			assert.ok(t.includes("转述") || t.includes("来源"), "论断输出应披露来源分级，防止把转述当原话");
		});
	});

	// ── cities 容错解析 ──
	// `ziwei/cities.ts` 只是数据表，没有分支；会「静默取错经度」的是 `cli/birth-info.ts`
	// 的 findLongitude —— 经度差 1° 就是真太阳时差 4 分钟，足以把时辰推过边界、整张盘换掉。
	describe("cities 容错解析（findLongitude 分支）", () => {
		const loadFind = () => load<typeof import("@/cli/birth-info")>("@/cli/birth-info");

		it("歧义分支：同长度候选记进 ambiguous，且最多 5 个（超出截断）", async () => {
			const { findLongitude } = await loadFind();
			// 「海」的同长度候选实测 7 个（海东/海口/海西/琼海/上海/威海/珠海），返回值只给 5 个。
			// 一条断言同时钉住两件事：有歧义必须提示，提示又不能无限长。
			const hit = findLongitude("海");
			assert.ok(hit, "「海」应容错解析出城市");
			assert.equal(hit.ambiguous?.length, 5, "同长度候选超过 5 个时只应保留 5 个");
			for (const c of hit.ambiguous ?? [])
				assert.match(c, /^.+\(\d+(\.\d+)?\)$/, `候选应形如「城市(经度)」，实得：${c}`);
			assert.ok(
				!(hit.ambiguous ?? []).some(c => c.startsWith(`${hit.matched}(`)),
				"ambiguous 装的是「其余候选」，不能把命中项自己也算进去"
			);
		});

		it("歧义分支：命中项必是表内真实城市，且经度与表内一致（独立预言机）", async () => {
			const { findLongitude } = await loadFind();
			const { PROVINCES } = await load<typeof import("@/ziwei/cities")>("@/ziwei/cities");
			// 期望值取自 PROVINCES 数据表，不读 findLongitude 自己的返回值 ——
			// 否则「取错城市」时两边一起错，断言照样全绿（本仓历史上栽过同一个跟头）。
			const all = PROVINCES.flatMap(p => p.cities);
			for (const q of ["海", "张家", "晋", "阳", "石家庄市", "河北省石家庄市"]) {
				const hit = findLongitude(q);
				assert.ok(hit, `「${q}」应能解析`);
				const inTable = all.find(c => c.name === hit.matched);
				assert.ok(inTable, `「${q}」命中「${hit.matched}」，但它不在城市表里`);
				assert.equal(hit.longitude, inTable.longitude, `「${q}」的经度应与表内一致`);
			}
		});

		it("exact 只对「写的就是表里的名字」为真；无歧义时 ambiguous 为 null 而非空数组", async () => {
			const { findLongitude } = await loadFind();
			// 上层按 exact 决定要不要提示「已做容错解析」，判错会让提示漏发或误发；
			// null 与 [] 的区别同样对上层可见 —— null 才表示「不必提示」。
			assert.equal(findLongitude("石家庄")?.exact, true, "精确命中");
			assert.equal(findLongitude("石家庄市")?.exact, false, "去后缀属容错，需提示");
			assert.equal(findLongitude("河北省石家庄市")?.exact, false, "省市全名同上");
			assert.equal(findLongitude("石家庄市")?.ambiguous, null, "无歧义应给 null");
		});

		it("未收录返回 null：不靠「包含」关系瞎匹配", async () => {
			const { findLongitude } = await loadFind();
			assert.equal(findLongitude("不存在XYZ"), null, "查无此城");
			assert.equal(findLongitude(""), null, "空串");
			assert.equal(findLongitude("   "), null, "纯空白");
			// 「海南」是省名不是城市名。省份走 buildBirthInfo 的 --province 分支
			// （实测 --province 海南 → 110.3，按省会海口计），--city 不该靠包含关系猜一个市。
			assert.equal(findLongitude("海南"), null, "省名不是城市名，不得瞎猜");
		});

		it("CLI 层把歧义提示透出，并受同样的 5 个上限约束", async () => {
			// 解析层记了 ambiguous 而 CLI 不打印，用户照样不知道取了哪个市 —— 这条盯透出。
			const t = await cliCmd("cities", ["--search", "海"]);
			const line = t.split("\n").find(l => l.includes("存在同名候选"));
			assert.ok(line, `应提示同名候选，实得输出：\n${t}`);
			assert.ok(line.includes("已取最短名"), "应说明按什么规则取的");
			const listed = line
				.replace(/^.*存在同名候选：/, "")
				.replace(/，已取最短名.*$/, "")
				.split("、");
			assert.equal(listed.length, 5, `提示里的候选也应是 5 个，实得 ${listed.length} 个`);
		});

		it("「未收录」与「容错可解析」文案互斥", async () => {
			// 同一段输出先否定再自证是自相矛盾的：说「未收录」就不能再说「能容错解析」。
			const miss = await cliCmd("cities", ["--search", "不存在XYZ"]);
			assert.ok(miss.includes("未收录"), "真查不到应说未收录");
			assert.ok(!miss.includes("容错解析"), "查不到就不该再提容错解析");

			const fuzzy = await cliCmd("cities", ["--search", "石家庄市"]);
			assert.ok(fuzzy.includes("未直接命中"), "没直接命中应说明");
			assert.ok(fuzzy.includes("容错解析"), "应告诉用户排盘时能识别");
			assert.ok(!fuzzy.includes("未收录"), "能解析就不能说未收录");
		});
	});

	// ── classics 古籍检索 ──
	describe("classics 古籍检索（searchClassics 分支）", () => {
		const loadClassics = () => load<typeof import("@/classics/index")>("@/classics/index");

		it("空查询返回空数组（不把空白当关键词）", async () => {
			const { searchClassics } = await loadClassics();
			for (const q of ["", "   ", "\n", "\t "])
				assert.deepEqual(searchClassics(q, 10), [], `「${JSON.stringify(q)}」不该有命中`);
		});

		it("limit 截断命中数；命中不足时返回全部", async () => {
			const { searchClassics } = await loadClassics();
			const total = searchClassics("星", 10_000).length;
			assert.ok(total > 10, `「星」的命中应足够多才测得出截断，实得 ${total}`);
			assert.equal(searchClassics("星", 5).length, 5, "超过上限只返回 limit 条");
			assert.equal(searchClassics("星", total).length, total, "上限恰等于总数时全返回");
			assert.equal(searchClassics("星", total + 1).length, total, "上限高于总数时返回全部");
		});

		it("limit 非正数或 NaN 时返回空，Infinity 视为无上限", async () => {
			const { searchClassics } = await loadClassics();
			// 修复前：上限判定排在 push 之后，limit=0/-3 恒返回 1 条；
			// NaN 参与比较恒为假，反而返回全部。上限设了却给不出对应结果，两种都是错的。
			for (const bad of [0, -1, -3, Number.NaN])
				assert.deepEqual(searchClassics("星", bad), [], `limit=${bad} 应返回空`);
			assert.equal(
				searchClassics("星", Number.POSITIVE_INFINITY).length,
				searchClassics("星", 10_000).length,
				"Infinity 是「无上限」，应返回全部而非空"
			);
		});

		it("计数单位是段落，不是出现次数", async () => {
			const { searchClassics } = await loadClassics();
			// gsf-1-1 原文含「星」六处，但只应产出 1 条 —— 否则命中数会被长段落灌水。
			const hits = searchClassics("星", 10_000).filter(h => h.paragraphId === "gsf-1-1");
			assert.equal(hits.length, 1, "同段落内多次出现只算一条");
			assert.ok(
				hits[0].text.split("星").length - 1 >= 2,
				"样本段本身应确有多处命中，否则这条断言是空转"
			);
		});

		it("按文档顺序返回（书序→章序→段序），无相关度排序", async () => {
			const { searchClassics, ALL_BOOKS } = await loadClassics();
			const order = ALL_BOOKS.map(b => b.slug);
			const hits = searchClassics("星", 10_000);
			assert.ok(hits.length > 5, "命中太少则顺序断言无意义");
			for (let i = 1; i < hits.length; i++) {
				const p = hits[i - 1],
					c = hits[i];
				const pi = order.indexOf(p.bookSlug),
					ci = order.indexOf(c.bookSlug);
				assert.ok(
					pi < ci || (pi === ci && p.paragraphId <= c.paragraphId),
					`顺序应单调：${p.bookSlug}/${p.paragraphId} 之后不该是 ${c.bookSlug}/${c.paragraphId}`
				);
			}
		});

		it("snippet 的上下文窗口是前后各 40 字，两端截断才补 …", async () => {
			const { searchClassics } = await loadClassics();
			// 规则级断言（跑全部 41 条命中），不是单点快照：
			//   前置 … ⇔ 命中位置 > 40；后置 … ⇔ 命中之后仍有超过 40 字。
			const hits = searchClassics("星", 10_000);
			assert.ok(hits.length > 5, "命中太少则规则断言无意义");
			for (const h of hits) {
				const idx = h.text.indexOf("星");
				assert.ok(idx >= 0, `${h.paragraphId} 的原文应含检索词`);
				assert.equal(h.snippet.startsWith("…"), idx > 40, `前置 … 判错：${h.paragraphId}`);
				assert.equal(
					h.snippet.endsWith("…"),
					idx + 1 + 40 < h.text.length,
					`后置 … 判错：${h.paragraphId}`
				);
			}
		});

		it("snippet 两端都被截断时，前后上下文恰各 40 字", async () => {
			const { searchClassics } = await loadClassics();
			// 段落普遍短于 81 字，全库只有 qj-1-1（85 字）容得下两端都截断的命中。
			// 下列三条 guard 保证算术成立，任一失效都会指名道姓地报出来，而不是静默变松。
			const hit = searchClassics("之", 10_000).find(h => h.paragraphId === "qj-1-1");
			assert.ok(hit, "「之」应命中 qj-1-1");
			assert.equal(hit.text.length, 85, "样本段长度变了，下面的 40+40 算术需重新核对");
			assert.equal(hit.text.indexOf("之"), 41, "命中位置变了，同上");
			assert.ok(!/[<>&"']/.test(hit.text), "该段含需转义字符，长度会被 &quot; 撑大");

			const before = hit.snippet.replace(/^…/, "").split("<mark>")[0];
			const after = hit.snippet.replace(/…$/, "").split("</mark>")[1];
			assert.equal(before.length, 40, "前置上下文应为 40 字");
			assert.equal(after.length, 40, "后置上下文应为 40 字");
		});

		it("snippet 先转义原文再拼 <mark>：原文的引号不会混成标签", async () => {
			const { searchClassics } = await loadClassics();
			// gsf-8-4 原文是 `玄学等"非实"行业`（ASCII 双引号，全库共 11 段含它）。
			// 转义若排在拼 <mark> 之后，原文里的引号就会被当成 HTML 注入 —— 盯的是顺序。
			// 反向注入验证：去掉这三处 escapeHtml，本用例即变红。
			const hit = searchClassics("非实", 5)[0];
			assert.ok(hit, "「非实」应有命中");
			assert.ok(
				hit.snippet.includes("&quot;<mark>非实</mark>&quot;"),
				`应形如 &quot;<mark>非实</mark>&quot;，实得：${hit.snippet}`
			);
			// 边界登记（实测）：全库 75 段无一段含裸 < 、> 或 &，只 11 段含 "。
			// 也就是说 escapeHtml 的尖括号分支在当前数据下**不可达**，任何断言都触发不了它
			// —— 故此处不写「snippet 无裸尖括号」那种永远为真的断言，只锁真正走得通的引号路径。
			// 若将来书目引入 < 或 &，这里要补回尖括号断言。
			for (const h of searchClassics("之", 10_000))
				assert.ok(!h.snippet.includes('"'), `${h.paragraphId} 的 snippet 漏出裸引号`);
		});

		it("TOTAL_PARAGRAPHS 与书目结构自洽（独立复算）", async () => {
			const { ALL_BOOKS, TOTAL_PARAGRAPHS } = await loadClassics();
			// 常量与结构必须由两条路算出来再对上，否则改书时容易只改一处。
			const counted = ALL_BOOKS.reduce(
				(n, b) => n + b.chapters.reduce((m, c) => m + c.paragraphs.length, 0),
				0
			);
			assert.equal(TOTAL_PARAGRAPHS, counted, "总段数应由书目结构数出来");
		});

		it("无参数时列出全部书目；未命中给明确文案", async () => {
			const t = await cliCmd("classics", []);
			for (const b of ["gusuifu", "quanji", "quanshu"])
				assert.ok(t.includes(b), `书目清单应含 ${b}`);
			assert.ok(t.includes("用法：classics --search"), "应给出用法");

			const miss = await cliCmd("classics", ["--search", "紫微星"]);
			assert.equal(miss.trim(), "古籍中未找到「紫微星」。", "未命中应有明确文案");
		});

		it("CLI 把 <mark> 高亮转成『』（不透出 HTML 标签）", async () => {
			const t = await cliCmd("classics", ["--search", "紫微", "--limit", "2"]);
			assert.ok(t.includes("『紫微』"), `命中词应被『』裹住，实得：\n${t}`);
			assert.ok(!t.includes("<mark>"), "不该把 <mark> 透给终端用户");
		});

		it("--limit 非正整数时指出是参数问题，不谎报「未找到」", async () => {
			// 内核把非法 limit 归成空结果后，若 CLI 不加区分，`--limit 0` 会输出
			// 「古籍中未找到「星」。」—— 明明有 41 条命中，只是上限被设成了 0。
			for (const bad of ["0", "-3", "abc"]) {
				const t = await cliCmd("classics", ["--search", "星", "--limit", bad]);
				assert.ok(!t.includes("未找到"), `--limit ${bad} 不该谎报未找到，实得：${t}`);
				assert.ok(t.includes("--limit"), `--limit ${bad} 应指出是 limit 的问题，实得：${t}`);
			}
		});
	});

	// ── chart 命令 ──
	describe("chart 命令", () => {
		it("渲染冒烟：关键段落齐全", async () => {
			const t = await cliCmd("chart", [
				"--date", "1990-05-15", "--time", "09:30", "--city", "北京", "--gender", "male",
			]);
			for (const seg of ["命盘", "农历：", "命宫：", "身宫：", "五行局：", "紫微：", "大限：", "当前年龄："])
				assert.ok(t.includes(seg), `chart 输出应含「${seg}」，实得：\n${t.slice(0, 400)}`);
		});

		it("--json 输出十二宫齐全，地支 0-11 各一次", async () => {
			const c = JSON.parse(
				await cliCmd("chart", [
					"--date", "1990-05-15", "--time", "09:30", "--city", "北京", "--gender", "male", "--json",
				])
			) as ZiweiChart;
			assert.equal(c.palaces.length, 12, "恒为十二宫");
			assert.deepEqual(
				c.palaces.map(p => p.branch).sort((a, b) => a - b),
				[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
				"地支 0-11 各出现一次"
			);
		});
	});
});
