/**
 * 合盘自检断言组 —— 2026-09-30 三 skill 合一时从 synastry 自带的 selftest.ts 抽出。
 *
 * 断言体基本原样；适配点有三类：
 * 1. **参数面断言改跑合并后的根 CLI**（`node scripts/purple-star.ts synastry …`）；
 * 2. 「出生信息旗标被整个拒收」一条在合并后**暂缓**：主引擎的参数面是 skill 级，
 *    `--a-date` 剥前缀后 `date` 在全量声明表里（synastry 命令不读它，仍会因缺
 *    `--a-chart` / `--b-chart` 报错指路）—— 这条守卫在 Task 7 输入改 `--charts`
 *    后以「`--a-chart` 是未知参数」的形态重新钉死；
 * 3. 两条 SKILL.md 一致性断言换成「合并接线」断言（根 SKILL.md 的重写在 Task 10）。
 *
 * 与 `cli/selftest.ts` 的接口：导出 {@link asserts}，逐条结果由主 selftest 汇总。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU, MARRIAGE_STARS_BRIEF } from "./synastry-knowledge";
import { readAnalyzeJson } from "./chart-view";
import { createHarness, callDirect, type Assertion } from "../cli/selftest-kit";

/** 本内核目录（`scripts/synastry`）。 */
const ROOT = dirname(fileURLToPath(import.meta.url));

// ── 冒烟用的假命盘 ──────────────────────────────────────────

/**
 * 项目口径的十二宫名，下标即 fixture 里的排布顺序。
 *
 * @remarks
 * 顺序照传统宫序（命宫 → 兄弟 → 夫妻 → …）。**仅用于造 fixture**：合盘不排盘，
 * 这里不追求宫序的排盘学含义，只要十二个名字齐、且 `mustPalace` 找得到即可。
 */
const PALACE_NAMES = [
	"命宫",
	"兄弟宫",
	"夫妻宫",
	"子女宫",
	"财帛宫",
	"疾厄宫",
	"迁移宫",
	"交友宫",
	"官禄宫",
	"田宅宫",
	"福德宫",
	"父母宫",
];

/** 星辰：主星（`majorsOf` 只认 `type === "major"`） */
const major = (name: string) => ({ name, type: "major", brightness: "bright" });
/** 星辰：非主星（桃花 / 孤克星一类的席位） */
const aux = (name: string) => ({ name, type: "minor" });

/**
 * 造一份最小的 `analyze --json` 输出，供命令冒烟喂给 `synastry`。
 *
 * @remarks
 * 自包含的假盘（合盘内核无排盘函数可调）：只保证 `synastry` **真正读到的**字段齐全，
 * 不追求与真盘等形。「synastry 读的字段与 `analyze --json` 的真实形状对不对得上」由仓库的
 * `test/cli.test.ts` 用**真排出来的盘**端到端守住 —— 分工：自包含冒烟管「链通不通」，
 * 仓库端到端管「契约对不对」。
 */
function makeFixture(o: {
	name: string;
	gender: "male" | "female";
	mingBranch: number;
	mingStar: string;
	fuqiStar: string;
	extraFuqiStar: string | null;
	lateZiCandidate: boolean;
}): string {
	const palaces = PALACE_NAMES.map((name, i) => {
		const branch = (o.mingBranch + i) % 12;
		const stars =
			name === "夫妻宫"
				? [major(o.fuqiStar), ...(o.extraFuqiStar ? [aux(o.extraFuqiStar)] : [])]
				: name === "命宫" || name === "福德宫"
					? [major(o.mingStar)]
					: [];
		return {
			branch,
			stem: 0,
			name,
			stars,
			oppositeBranch: (branch + 6) % 12,
			isEmpty: stars.length === 0,
		};
	});
	const fuqiBranch = (o.mingBranch + PALACE_NAMES.indexOf("夫妻宫")) % 12;
	const note = "钟表 09:30 → 真太阳时校正 -14 分 → 巳时(09:00-11:00)";
	return JSON.stringify(
		{
			chart: {
				birthInfo: {
					year: 1990,
					month: 5,
					day: 15,
					timeIndex: 5,
					gender: o.gender,
					name: o.name,
				},
				lunarInfo: {
					lunarYear: 1990,
					lunarMonth: 4,
					lunarDay: 21,
					yearStem: 6,
					yearBranch: 6,
					isLeapMonth: false,
				},
				soulBranch: o.mingBranch,
				bodyBranch: (o.mingBranch + 4) % 12,
				fiveElementsClass: 2,
				fiveElementsClassName: "火六局",
				ziweiPos: o.mingBranch,
				palaces,
				decadals: [],
				currentAge: 36,
				currentDecadalIndex: 0,
			},
			nativeSiHua: {
				stem: "庚",
				located: [
					{ hua: "禄", star: o.fuqiStar, palace: "夫妻宫", branch: null, isMajor: true },
				],
			},
			lateZi: { candidate: o.lateZiCandidate, applied: false },
			basis: { note, notes: [note] },
		},
		null,
		2
	);
}

/**
 * 合盘断言组：命令冒烟、输入护栏、参考文档、知识源与参数面（经子进程）。
 *
 * @returns 逐条结果；由 `cli/selftest.ts` 并入主报告
 */
export async function asserts(): Promise<Assertion[]> {
	// harness（Assertion / ok）共用 cli/selftest-kit，此处不再有本地定义。
	const { results, ok } = createHarness();
	// 命令表与作用域：动态 import 打断「commands → selftest → 本文件」静态环（Cmd 已
	// 放宽为可返回 Promise），取代旧的「读源码文本做子串匹配」—— 物理排版退出契约。
	const { COMMANDS } = await import("../cli/commands");
	const { OPTION_NAMES, parseArgs } = await import("../cli/args");
	const { OPTION_SCOPE } = await import("../cli/option-scope");

	/**
	 * 进程内直调一条命令（原 spawnSync 子进程——每次约 3.2 秒 iztro 冷启动，本组
	 * 11 个调用点 ≈ 35 秒；直调复用本进程已加载的 iztro，判据同构：code/out/err
	 * 三元组、错误路径同一「错误：」前缀文案）。「stderr 前缀 + exit 1」真链路由
	 * 主 selftest 的三条子进程冒烟覆盖。
	 */
	const run = (argv: string[]): { code: number; out: string; err: string } => {
		const [cmd, ...rest] = argv;
		const fn = COMMANDS[cmd as keyof typeof COMMANDS];
		if (!fn) return { code: 1, out: "", err: `未知命令「${cmd}」。` };
		return callDirect(cmd, rest, fn, parseArgs, {
			root: resolve(ROOT, ".."),
			rootLabel: "技能自带内核",
		});
	};

	// 临时目录：两份假盘写在这里，喂给子进程。用 mkdtemp 而非固定名，避免并行跑时互相踩。
	const tmp = mkdtempSync(join(tmpdir(), "synastry-selftest-"));

	try {
		// 冒烟用的星名全部取自断语库本身 —— 硬写「紫微」「天府」会在断语库改名后静默失效，
		// 而用真键则保证「夫妻宫断语」那节必然有内容可渲染。
		const FUQI_STAR = Object.keys(STAR_IN_FUQI_GU)[0];
		const MING_STAR = Object.keys(STAR_IN_FUQI_GU)[1] ?? FUQI_STAR;
		const MARRY_STAR = Object.keys(MARRIAGE_STARS_BRIEF)[0] ?? null;
		// 甲：命宫 MING_STAR、夫妻宫 FUQI_STAR；乙：对调 —— 于是「甲夫妻宫 ∩ 乙命宫」与
		// 「乙夫妻宫 ∩ 甲命宫」双向命中，「天作之合」那行的判定路径被真正走到。
		const fileA = join(tmp, "a.json");
		const fileB = join(tmp, "b.json");
		writeFileSync(
			fileA,
			makeFixture({
				name: "甲某",
				gender: "male",
				mingBranch: 2,
				mingStar: MING_STAR,
				fuqiStar: FUQI_STAR,
				extraFuqiStar: MARRY_STAR,
				// 甲命中晚子时（candidate 真、applied 假）→ 顺带盯住那段提醒
				lateZiCandidate: true,
			})
		);
		writeFileSync(
			fileB,
			makeFixture({
				name: "乙某",
				gender: "female",
				mingBranch: 8,
				mingStar: FUQI_STAR,
				fuqiStar: MING_STAR,
				extraFuqiStar: null,
				lateZiCandidate: false,
			})
		);
		const PAIR = ["--charts", `${fileA},${fileB}`];

		ok("合盘冒烟：synastry 读两份命盘 JSON 跑得通，三个块标题都在", () => {
			const r = run(["synastry", ...PAIR]);
			if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			// 三个块标题各盯一件事：「双宫联参」是倪师口径的标志、「夫妻宫断语」是唯一依赖
			// STAR_IN_FUQI_GU 的输出、「生年四化入夫妻宫」是唯一依赖**排盘方给的**
			// nativeSiHua.located 的输出（缺了它说明 JSON 契约没接上）。
			for (const sec of ["【合盘 · 双宫联参】", "【夫妻宫断语】", "【生年四化入夫妻宫】"]) {
				if (!r.out.includes(sec)) throw new Error(`输出缺少「${sec}」`);
			}
			return `${r.out.split("\n").length} 行`;
		});

		ok("合盘冒烟：双向对应的两方被判为「天作之合」，且晚子时提醒照常出现", () => {
			const r = run(["synastry", ...PAIR]);
			if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			if (!r.out.includes("双向对应，符合「天作之合」最高级匹配"))
				throw new Error("两方主星互映却未判为双向对应 —— 对应关系判定可能已坏");
			if (!r.out.includes("晚子时"))
				throw new Error("lateZi.candidate 为真却没出现晚子时提醒 —— 排盘依据的转述断了");
			return "判定与提醒均按 JSON 里的标记产出";
		});

		ok("合盘护栏：--charts 只给一份（或三份）必须报错，并说明「甲,乙」形态", () => {
			// --charts 是逗号分隔的**恰好两个**路径（甲先乙后）。一份/三份都是输入错误，
			// 报错须点名期望形态，而不是静默取前两个。
			for (const argv of [
				["--charts", fileA],
				["--charts", `${fileA},${fileB},${fileA}`],
			]) {
				const r = run(["synastry", ...argv]);
				if (r.code === 0) throw new Error(`${argv[1]} 未报错 —— 份数护栏失效`);
				if (!r.err.includes("两个") || !r.err.includes("--charts"))
					throw new Error(`报错应点名 --charts 与「两个文件路径」，实得：${r.err.trim()}`);
			}
			return "一份与三份均被拦下";
		});

		ok("合盘护栏：--charts 两路径相同允许（自盘对照有意义）", () => {
			const r = run(["synastry", "--charts", `${fileA},${fileA}`]);
			if (r.code !== 0)
				throw new Error(`同路径应放行（自盘对照），实得：${r.err.trim()}`);
			if (!r.out.includes("甲方") || !r.out.includes("乙方"))
				throw new Error("同路径输出应仍有甲乙两方");
			return "同路径放行";
		});

		ok("合盘护栏：拿 `--palaces --json` 的输出来顶替时报错，并说清为什么不行", () => {
			// 这是最容易踩的坑：`chart` 命令也输出 JSON，但**顶层就是命盘本身**，
			// 没有 `chart` 键，更没有四化落宫与排盘依据。照收会让合盘静默少两节结论。
			const wrong = join(tmp, "wrong.json");
			writeFileSync(wrong, JSON.stringify({ birthInfo: {}, palaces: [], soulBranch: 0 }));
			// ⚠️ 输入必须是 --charts 形态：--a-chart 在解析层就是未知参数，到不了读文件的
			//    契约校验（2026-09-30 评审发现的原断言假绿——子串 "chart" 被参数名误满足）。
			const r = run(["synastry", "--charts", `${wrong},${fileB}`]);
			if (r.code === 0) throw new Error("顶层无 chart 键却退出码为 0 —— 契约校验失效");
			if (!r.err.includes("chart"))
				throw new Error(`报错未提到缺失的 chart，实得：${r.err.trim()}`);
			return "拿 chart --json 顶替被拦下";
		});

		ok("合盘护栏：命盘 JSON 缺 nativeSiHua 时报错（逐项校验的证据）", () => {
			// 上一条证明「顶层形状不对」会被拦；这条证明**单个必需字段**缺失也会被拦 ——
			// 四化落宫缺了，「生年四化入夫妻宫」那节会整个空掉，那是静默的结论缺失。
			const partial = JSON.parse(readFileSync(fileA, "utf8")) as Record<string, unknown>;
			delete partial.nativeSiHua;
			const p = join(tmp, "partial.json");
			writeFileSync(p, JSON.stringify(partial));
			const r = run(["synastry", "--charts", `${p},${fileB}`]);
			if (r.code === 0) throw new Error("缺 nativeSiHua 却退出码为 0 —— 逐项校验失效");
			if (!r.err.includes("nativeSiHua"))
				throw new Error(`报错未点名 nativeSiHua，实得：${r.err.trim()}`);
			return "缺 nativeSiHua 被拦下";
		});

		ok("合盘护栏：命盘文件不是合法 JSON 时报错", () => {
			const broken = join(tmp, "broken.json");
			writeFileSync(broken, "错误：未知命令「astrology」。\n");
			const r = run(["synastry", "--charts", `${broken},${fileB}`]);
			if (r.code === 0) throw new Error("文件不是 JSON 却退出码为 0");
			if (!/JSON/.test(r.err)) throw new Error(`报错未提到 JSON，实得：${r.err.trim()}`);
			return "坏 JSON 被拦下";
		});

		ok("合盘参考文档：references/synastry-guide.md 在，评分标准与方法论两节都有内容", () => {
			// 评分标准与完整方法论是**恒定静态文本**（与「这一对是谁」无关），不被任何运行时
			// 路径读取（不引入「内核读 md」这种新模式）—— 本断言是唯一的提示。
			// 2026-09-30 起住在仓库根 references/（合并前在合盘 skill 自己的 references/）。
			const p = resolve(ROOT, "..", "..", "references", "synastry-guide.md");
			const md = readFileSync(p, "utf8");
			for (const anchor of [
				"双方夫妻宫互映天作之合，四化相互补益，大限同走旺运，福德宫双吉",
				"## 合盘分析核心框架（倪海夏体系 + 《紫微斗数全书》综合）",
			]) {
				if (!md.includes(anchor))
					throw new Error(`references/synastry-guide.md 缺少锚点：${anchor}`);
			}
			return `${md.split("\n").length} 行`;
		});

		ok("合盘知识源：合盘断语与四化断语非空", () => {
			if (!Object.keys(STAR_IN_FUQI_GU).length) throw new Error("STAR_IN_FUQI_GU 为空");
			if (!Object.keys(SIHUA_IN_FUQI_GU).length) throw new Error("SIHUA_IN_FUQI_GU 为空");
			return `夫妻宫断语 ${Object.keys(STAR_IN_FUQI_GU).length} 星`;
		});

		// ── 参数面（子进程跑合并后的根 CLI）──

		ok("合盘参数面：a- / b- 前缀已退役（--a-chart 是未知参数）", () => {
			// 2026-09-30 输入改 --charts 单参数（spec §2.3）：a- / b- 前缀体系整个不需要，
			// 前缀旗标一律「未知参数」。spec 原文：原「前缀必须报错」断言改为
			// 「--a-chart 是未知参数」。
			const probes = ["--a-chart", "--b-chart", "--a-date", "--a-time", "--a-gender", "--a-city"];
			for (const flag of probes) {
				const r = run(["synastry", flag, "x"]);
				if (r.code === 0) throw new Error(`${flag} 在 synastry 上被接受了 —— 前缀漏回了作用域`);
				if (!r.err.includes("未知参数"))
					throw new Error(`${flag} 的报错不是「未知参数」，实得：${r.err.trim()}`);
			}
			return `${probes.length} 个前缀旗标全部按未知参数被拒`;
		});

		ok("合盘参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
			// 探针围绕 `--charts` 写（本命令的标志性参数）：最近邻建议找编辑距离 ≤ 2 者。
			const probes: Array<[string, string]> = [
				["--chart", "charts"], // 漏尾字
				["--chartss", "charts"], // 多字
				["--json", "json"], // 自身合法（对照：不报错的那组不在此测）
			];
			for (const [bad, want] of probes) {
				if (bad === "--json") continue;
				const r = run(["synastry", bad, "x"]);
				if (r.code === 0) throw new Error(`${bad} 未报错 —— 未知旗标又变成静默忽略了`);
				if (!r.err.includes(`--${want}`))
					throw new Error(`${bad} 的提示应指向 --${want}，实得：${r.err.trim()}`);
			}
			return "拼写错误均被拦下";
		});

		ok("合盘参数面：--charts 裸写或给单路径由份数护栏拦下", () => {
			// 引擎把裸写归一为布尔 true / 单路径只有一份 —— 两种形态都过不了「恰好两份」
			// 这道命令层护栏，报错点名 --charts。
			for (const argv of [["--charts"], ["--charts", "only-one.json"]]) {
				const r = run(["synastry", ...argv]);
				if (r.code === 0) throw new Error(`${argv[0]} ${argv[1] ?? ""} 未报错`);
				if (!r.err.includes("--charts"))
					throw new Error(`报错未点名 --charts，实得：${r.err.trim()}`);
			}
			return "裸写与单路径均被拦下";
		});

		ok("契约闭环：astrology --json 的真实产物过 readAnalyzeJson 校验", () => {
		// 交付包内唯一能跑的自检层要直接盯住生产端-消费端 seam：typecheck 对
		// JSON 边界无能为力（JSON.parse 后 as 断言），假盘 fixture 又只是契约的
		// 手写拷贝，接不住生产端键名漂移 —— 让 run（进程内直调）排一张真盘落临时
		// 文件，喂给 readAnalyzeJson 逐项校验，闭环不依赖交付包外的 test/。
			const r = run(["astrology", "--date", "1990-05-15", "--branch", "5", "--gender", "male", "--json"]);
			if (r.code !== 0) throw new Error(`astrology --json 非零退出：${r.err.trim()}`);
			const tmp = mkdtempSync(join(tmpdir(), "synastry-contract-"));
			try {
				const p = join(tmp, "real.json");
				writeFileSync(p, r.out, "utf8");
				const parsed = readAnalyzeJson(p, "甲");
				if (!parsed.chart?.palaces?.length) throw new Error("readAnalyzeJson 产物缺宫位 —— 契约校验形同虚设");
			} finally {
				rmSync(tmp, { recursive: true, force: true });
			}
		});

		ok("合并接线：synastry 在主命令表有实现，--charts 在主作用域已声明", () => {
			// 三 skill 合一的接线守卫：命令进了 COMMAND_TABLE、`charts` 进了 OPTION_NAMES、
			// 前缀表已清空（a-/b- 退役）—— 任何一侧漏接，用户敲 `synastry --charts` 就是「未知参数」。
			// 键集来自函数顶部的动态 import（见彼处注释）。
			if (!("synastry" in COMMANDS))
				throw new Error("cli/commands.ts 的命令表里没有 synastry 条目 —— 合并接线断了");
			if (!OPTION_NAMES.has("charts"))
				throw new Error("cli 的 OPTION_NAMES 里没有 charts —— 合盘输入参数未声明");
			if (OPTION_SCOPE.sidePrefixes.includes("a-") || OPTION_SCOPE.sidePrefixes.includes("b-"))
				throw new Error("a-/b- 前缀仍在 OPTION_SCOPE —— 应已退役（Task 7）");
			return "命令表与作用域双侧接线在，前缀已退役";
		});
	} finally {
		// 临时目录在断言跑完后必删（含失败路径）。
		rmSync(tmp, { recursive: true, force: true });
	}

	return results;
}
