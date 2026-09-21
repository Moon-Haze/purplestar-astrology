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
import { loadAlgorithm, loadSihua } from "./lib/loader.ts";
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

/** 跑一次 CLI 的任意子命令，返回 stdout。失败时抛出带 stderr 的错误。 */
async function cliCmd(sub: string, args: string[]): Promise<string> {
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
const { getSiHuaByStem, getYearStemIndex } = await loadSihua();

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
				const transforms = getSiHuaByStem(getYearStemIndex(chart.birthInfo.year));
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
			const viaCli = await cliJson([
				"--date", "1990-05-15", "--branch", "5", "--lng", "120", "--gender", "male",
			]);
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
});
