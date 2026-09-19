// ── 层 2：CLI 端到端 ──
//
// 这一层测的是**基准样本覆盖不到的 CLI 层逻辑**：样本的 longitude 恒为 120（真太阳时
// 校正量恒为 0）、hour 只有 0-11（无晚子时）、出生信息恒为公历。这些逻辑全在 CLI 层，
// 故无 golden 基准可依，用手工基准 + 独立换算（lunar-javascript）互证。
//
// 本文件另有一条**防漂移断言**：内核直调结果必须等于 CLI --json 的输出。
// test/lib/loader.mjs 是 scripts/purple-star.mjs 加载机制的副本，这条断言盯着两者不分叉。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAlgorithm } from "./lib/loader.mjs";
import { chartSignature } from "./lib/compare.mjs";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(HERE, "../scripts/purple-star.mjs");
const SKILL_ROOT = resolve(HERE, "..");

/** 跑一次 CLI（analyze 子命令），返回 stdout。失败时抛出带 stderr 的错误。 */
async function cli(args) {
	const { stdout } = await execFileAsync("node", [CLI, "analyze", ...args], { cwd: SKILL_ROOT });
	return stdout;
}

/** 跑一次 CLI 并解析 --json 输出。 */
async function cliJson(args) {
	return JSON.parse(await cli([...args, "--json"]));
}

/** 跑一次 CLI，断言它失败（非零退出），返回 stderr。 */
async function cliFails(args) {
	try {
		await cli(args);
	} catch (err) {
		return err.stderr ?? "";
	}
	assert.fail(`命令本应失败却成功了：purple-star.mjs ${args.join(" ")}`);
}

const { generateChart } = await loadAlgorithm();

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
	});

	describe("城市名解析", () => {
		it("简称 / 全称 / 省市全名 解析为同一经度", async () => {
			const forms = ["杭州", "杭州市", "浙江省杭州市"];
			const lngs = [];
			for (const city of forms) {
				const o = await cliJson(["--date", "1990-05-15", "--time", "09:30", "--city", city, "--gender", "male"]);
				lngs.push(o.chart.birthInfo.longitude);
			}
			assert.equal(new Set(lngs).size, 1, `三种写法应给同一经度，实际 ${JSON.stringify(lngs)}`);
			assert.ok(lngs[0] > 119 && lngs[0] < 121, `杭州经度应在 119-121 之间，实际 ${lngs[0]}`);
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
			const males = [];
			for (const g of ["male", "m", "男"]) {
				const o = await cliJson(["--date", "1990-05-15", "--branch", "5", "--gender", g]);
				males.push(JSON.stringify(o.chart.daXians));
			}
			assert.equal(new Set(males).size, 1, "三种 male 写法应给同一张大限表");

			const a = await cliJson(["--date", "1990-05-15", "--branch", "5", "--gender", "female"]);
			assert.notEqual(a.chart.gender ?? a.chart.birthInfo.gender, "male");
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

		it("闰月用 --leap 指定，且与 lunar-javascript 的独立换算一致", async () => {
			// 1960 年闰六月。用 lunar-javascript 独立算出该闰月首日的公历日期作为期望值。
			const { Lunar } = await import("lunar-javascript");
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
			const { Lunar } = await import("lunar-javascript");
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

	describe("内核加载防漂移", () => {
		// test/lib/loader.mjs 是 scripts/purple-star.mjs 加载机制的副本。
		// 若两侧的 registerHooks / pickRoot 分叉（例如 CLI 改了别名解析而测试没跟上），
		// 这条断言会把差异暴露出来 —— 否则测试可能一直在验证一个与线上不同的内核。
		it("内核直调结果 ≡ CLI --json 输出", async () => {
			const birth = { year: 1990, month: 5, day: 15, hour: 5, gender: "male", longitude: 120 };
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
