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

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU, MARRIAGE_STARS_BRIEF } from "./synastry-knowledge";

/** 单条断言的结果（与 cli/selftest.ts 的 Assertion 同形）。 */
export interface Assertion {
	pass: boolean;
	name: string;
	detail: string;
}

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
					hour: 5,
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
				mingGongBranch: o.mingBranch,
				shenGongBranch: (o.mingBranch + 4) % 12,
				wuxingJu: 2,
				wuxingJuName: "火六局",
				ziweiPos: o.mingBranch,
				palaces,
				daXians: [],
				currentAge: 36,
				currentDaXianIndex: 0,
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
export function asserts(): Assertion[] {
	const results: Assertion[] = [];
	const ok = (name: string, fn: () => unknown) => {
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};

	/** 起子进程跑一次合并后的根 CLI（测「入口 → 解析 → 命令表 → 渲染」整条链）。 */
	const run = (args: string[]): { code: number; out: string; err: string } => {
		const r = spawnSync(process.execPath, [resolve(ROOT, "..", "purple-star.ts"), ...args], {
			encoding: "utf8",
		});
		return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
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
		const PAIR = ["--a-chart", fileA, "--b-chart", fileB];

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

		ok("合盘护栏：缺 --b-chart 必须报错，并指向排盘命令", () => {
			// 合盘不排盘，缺了命盘就什么都做不了。报错必须**指路先排盘**，
			// 而不是回退去读出生信息旗标 —— 那种回退会让本命令悄悄变成排盘方。
			const r = run(["synastry", "--a-chart", fileA]);
			if (r.code === 0) throw new Error("缺 --b-chart 却退出码为 0 —— 缺旗标的护栏失效");
			if (!r.err.includes("--b-chart"))
				throw new Error(`报错未点名 --b-chart，实得：${r.err.trim()}`);
			if (!r.err.includes("analyze"))
				throw new Error(`报错未指向排盘命令 analyze，实得：${r.err.trim()}`);
			return "缺 --b-chart 被拦下，且指路到排盘命令";
		});

		ok("合盘护栏：拿 `chart --json` 的输出来顶替时报错，并说清为什么不行", () => {
			// 这是最容易踩的坑：`chart` 命令也输出 JSON，但**顶层就是命盘本身**，
			// 没有 `chart` 键，更没有四化落宫与排盘依据。照收会让合盘静默少两节结论。
			const wrong = join(tmp, "wrong.json");
			writeFileSync(wrong, JSON.stringify({ birthInfo: {}, palaces: [], mingGongBranch: 0 }));
			const r = run(["synastry", "--a-chart", wrong, "--b-chart", fileB]);
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
			const r = run(["synastry", "--a-chart", p, "--b-chart", fileB]);
			if (r.code === 0) throw new Error("缺 nativeSiHua 却退出码为 0 —— 逐项校验失效");
			if (!r.err.includes("nativeSiHua"))
				throw new Error(`报错未点名 nativeSiHua，实得：${r.err.trim()}`);
			return "缺 nativeSiHua 被拦下";
		});

		ok("合盘护栏：命盘文件不是合法 JSON 时报错", () => {
			const broken = join(tmp, "broken.json");
			writeFileSync(broken, "未知命令「analyze」。可用：synastry / selftest\n");
			const r = run(["synastry", "--a-chart", broken, "--b-chart", fileB]);
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

		ok("合盘参数面：a- / b- 前缀旗标不得用在别的命令上", () => {
			// 只有 `synastry` 读前缀；别的命令给它一个 `--a-chart` 是**用户搞错了命令**，
			// 静默忽略会让人以为「带了命盘却没生效」。靶子用 selftest（无副作用的命令）。
			//
			// ⚠️ 断言要**同时**确认「报错了」与「报的是前缀错位」：若哪天前缀被整个删掉，
			// `--a-chart` 会退化成「未知参数 --a-chart」，仍然报错、仍然退出码 1 ——
			// 只看退出码的话，这条会在一片绿里失去意义。
			const probes: Array<[string, string]> = [
				["--a-chart", "stars"],
				["--b-chart", "stars"],
				["--a-json", "stars"],
			];
			for (const [flag, cmd] of probes) {
				const r = run([cmd, flag, "x"]);
				if (r.code === 0)
					throw new Error(`${cmd} 上的 ${flag} 未报错 —— 前缀旗标的归属校验失效了`);
				if (!r.err.includes("前缀"))
					throw new Error(`${cmd} 上的 ${flag} 报的不是前缀错位，实得：${r.err.trim()}`);
			}
			return `${probes.length} 种越界写法均被拦下`;
		});

		ok("合盘参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
			// 探针围绕 `--chart` 写（剥前缀后的裸名）：最近邻建议在裸名集合里找
			// 编辑距离 ≤ 2 的最近者，三个探针的编辑距离都在阈值内，提示必然指向 `--chart`。
			const probes: Array<[string, string]> = [
				["--a-chrt", "chart"], // 漏字
				["--a-chrat", "chart"], // 换位
				["--a-chartss", "chart"], // 多字
			];
			for (const [bad, want] of probes) {
				const r = run(["synastry", bad, "x"]);
				if (r.code === 0) throw new Error(`${bad} 未报错 —— 未知旗标又变成静默忽略了`);
				if (!r.err.includes(`--${want}`))
					throw new Error(`${bad} 的提示应指向 --${want}，实得：${r.err.trim()}`);
			}
			return `${probes.length} 个拼写错误均被拦下`;
		});

		ok("合盘参数面：取值旗标裸写必须报错并点名（不是静默当成开关）", () => {
			// `--b-chart` 后不跟值：合并引擎下它成为布尔 `true`，命令层读不到字符串，
			// 由「缺 --b-chart」护栏拦下 —— 锚点是**报错里带着他敲的那个键**且退出码非 0。
			// （解析层的裸写拒收由 Task 4 的新引擎统一钉死。）
			const r = run(["synastry", "--b-chart"]);
			if (r.code === 0) throw new Error("裸写 --b-chart 未报错 —— 取值旗标被当成了开关");
			if (!r.err.includes("--b-chart"))
				throw new Error(`报错未点名 --b-chart，实得：${r.err.trim()}`);
			return "裸写被拦下，且点名了旗标";
		});

		ok("合并接线：synastry 在主命令表有实现，前缀参数在主作用域已声明", () => {
			// 三 skill 合一的接线守卫：命令进了 COMMAND_TABLE、`chart`（a-/b- 前缀的裸底名）
			// 进了 FLAG_SCOPE 且 synastry 在 prefixedCommands 里 —— 任何一侧漏接，
			// 用户敲 `synastry --a-chart` 就是「未知参数」。
			// 读源码文本而非 import：命令表里挂着 cmdSelftest，直接 import 会成环。
			const cmdSrc = readFileSync(resolve(ROOT, "..", "cli", "commands.ts"), "utf8");
			if (!/^\tsynastry: cmdSynastry,?$/m.test(cmdSrc))
				throw new Error("cli/commands.ts 的 COMMAND_TABLE 里没有 synastry 条目 —— 合并接线断了");
			const scopeSrc = readFileSync(resolve(ROOT, "..", "cli", "flag-scope.ts"), "utf8");
			for (const f of ['"chart"', '"a-"', '"synastry"']) {
				if (!scopeSrc.includes(f))
					throw new Error(`cli/flag-scope.ts 的 FLAG_SCOPE 里没有 ${f} —— 合盘前缀参数未声明`);
			}
			return "命令表与作用域双侧接线在";
		});
	} finally {
		// 临时目录在断言跑完后必删（含失败路径）。
		rmSync(tmp, { recursive: true, force: true });
	}

	return results;
}
