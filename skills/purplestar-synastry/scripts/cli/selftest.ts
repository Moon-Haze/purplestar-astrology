/**
 * 回归自检 —— 合盘 skill 的命令冒烟与自身一致性。
 *
 * ⚠️ **本文件是手写的，不是副本**（见 `CLAUDE.md` 的「副本边界与同步流程」）。
 *
 * ## 为什么这里**不复制**排盘解读 skill 的那几百行断言
 *
 * 本 skill 的排盘内核**已不存在**（2026-09-27 起命盘由 purplestar-astrology 产出），
 * 剩下的逐字节副本是 `boot-hooks.ts` / `cli/args.ts` 这类基础设施 —— 没人会就地改它们，
 * 开发循环是「改源 → `npm test` → `npm run sync:skills`」。把排盘内核的断言复制过来，
 * 只会生产两份需要手工同步的副本，而漏同步的那一份会静默失效。
 * 排盘内核回归的主场是源 skill 的 `selftest` 与仓库的 `npm test`。
 *
 * 本文件只负责**本 skill 自己的**事，四类：
 *   1. 命令冒烟 —— 引导层 → 解析钩子 → 命令表 → 渲染这条链真的跑得通
 *   2. 输入护栏 —— 缺 `--a-chart` / 坏 JSON / 拿 `chart --json` 顶替，都要当场说清
 *   3. 参数面 —— 拼错旗标要报错、`a-` / `b-` 前缀不得越界、SKILL.md 与实现双向一致
 *   4. 引导层豁免有界
 *
 * 外加两条**只此一份**的守卫（源里没有对应物可比）：
 *   · 参考文档守卫 —— `references/synastry-guide.md` 不被任何运行时路径读取，
 *     删空或改名不会让别的断言变红，故由本条盯着
 *   · 引文核对 —— 扫**本 skill 的根**，盯 `synastry-knowledge.ts` 里那些「倪师说」引文
 *     有没有未核实却强归属的
 *
 * ⚠️ 它留在 `scripts/` 而非 `test/`，与源 skill 同理：分发时只带走
 * `SKILL.md + scripts/ + package.json`，自检必须在交付包内，否则装到别人机器上就没法自证。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import。
 */

import type { CliContext } from "./args";
import { FLAG_NAMES, SIDE_PREFIXES, parseArgs } from "./args";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// ⚠️ `@/` 在这里可用：它解析到**本 skill 的内核根**（`scripts/`），而引文守卫的副本
//    就在其中（切片保留，见 tools/skills.ts）。若哪天它被移出切片，本行会让 selftest
//    加载失败并走引导层的错误指引 —— 不会静默少一条断言。
import { scanCitations } from "@/ziwei/citation-guard";
// ⚠️ 相对路径而非 `@/`：合盘内核已不住在源 skill 里（见 ./commands.ts 同一处注释）。
import {
	STAR_IN_FUQI_GU,
	SIHUA_IN_FUQI_GU,
	MARRIAGE_STARS_BRIEF,
} from "../ziwei/synastry-knowledge";

// ── 冒烟用的假命盘 ──────────────────────────────────────────

/**
 * 项目口径的十二宫名，下标即 fixture 里的排布顺序。
 *
 * @remarks
 * 顺序照传统宫序（命宫 → 兄弟 → 夫妻 → …）。**仅用于造 fixture**：本 skill 不排盘，
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
 * @param o - 两方各自的差异项
 * @returns 该份 JSON 的文本（已美化）
 *
 * @remarks
 * ## 为什么是内嵌的假盘，而不是「真排一张再喂进来」
 *
 * 本 skill 里**没有排盘内核**了，`generateChart` 无从调用；去起 purplestar-astrology 的
 * 子进程则要一套「定位另一个已安装 skill」的机制 —— 那正是本次改造刻意避开的耦合，
 * 且装到 `~/.claude/skills/` 之后并不成立（见 `test/repo.test.ts` 里那条既有记录：
 * skill 之间互相转指一律用**技能名**而非路径）。故冒烟自带假盘，自包含、可离线跑。
 *
 * ## 边界（诚实交代）
 *
 * 本 fixture 只保证 `synastry` **真正读到的**字段齐全（`chart.birthInfo` /
 * `chart.palaces` / `chart.mingGongBranch` / `chart.wuxingJuName` / `nativeSiHua` /
 * `lateZi` / `basis`），**不**追求与真盘等形（没有 `daXians`、没有真星曜分布）。
 * 「synastry 读的字段与 `analyze --json` 的真实形状对不对得上」由仓库的
 * `test/cli.test.ts` 用**真排出来的盘**端到端守住 —— 那条在源在场时才跑得了，
 * 分工如此：自包含的冒烟管「链通不通」，仓库的端到端管「契约对不对」。
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
	// 夫妻宫在主星之外还挂了桃花/孤克星；`located` 指向它，好让「四化入夫妻宫」那节非空
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
 * `selftest` 命令：跑一组命令冒烟与一致性断言，返回逐项报告。
 *
 * @param ctx - 运行期上下文（内核根与其来源）—— 自检要在输出里交代用的是哪一份内核
 * @returns 已渲染好的报告文本；首行为「通过 N/N」，第二行是内核根
 *
 * @remarks
 * 首行自报项数，故任何文档都不写死这个数字（本仓既有规矩：计数类事实能自报的自报）。
 *
 * ⚠️ 有失败项时**不抛错，而是先 `console.error` 全量报告再 `process.exit(1)`** ——
 * `test/cli.test.ts` 依赖这个退出码判定自检是否全绿。
 */
export function cmdSelftest(ctx: CliContext): string {
	/** 单条断言的结果 */
	interface Assertion {
		pass: boolean;
		name: string;
		detail: string;
	}
	const results: Assertion[] = [];
	/** 跑一条断言并登记结果；抛错即判失败，一条失败不影响其余断言继续跑。 */
	const ok = (name: string, fn: () => unknown) => {
		try {
			const detail = fn();
			results.push({ pass: true, name, detail: detail == null ? "" : String(detail) });
		} catch (err) {
			results.push({ pass: false, name, detail: (err as Error).message });
		}
	};

	// ── 命令冒烟 ──
	//
	// ⚠️ 这里**起子进程**而不是就地 import `./commands`：`cli/commands.ts` 静态 import 本文件
	// （命令表里挂着 `cmdSelftest`），就地 import 它会成环。更实际的理由是——冒烟要测的正是
	// 「引导层 → 解析钩子 → 命令表 → 渲染」这**整条链**，只调一个函数测不到其中任何一环。
	const CLI = resolve(ctx.root, "purple-star.ts");
	const run = (args: string[]): { code: number; out: string; err: string } => {
		const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
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

		ok("冒烟：synastry 读两份命盘 JSON 跑得通，三个块标题都在", () => {
			const r = run(["synastry", ...PAIR]);
			if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			// 三个块标题各盯一件事：「双宫联参」是倪师口径的标志（缺了它本 skill 就没有立场）、
			// 「夫妻宫断语」是唯一依赖 STAR_IN_FUQI_GU 的输出、「生年四化入夫妻宫」是唯一依赖
			// **排盘方给的** nativeSiHua.located 的输出（缺了它说明 JSON 契约没接上）。
			for (const sec of ["【合盘 · 双宫联参】", "【夫妻宫断语】", "【生年四化入夫妻宫】"]) {
				if (!r.out.includes(sec)) throw new Error(`输出缺少「${sec}」`);
			}
			return `${r.out.split("\n").length} 行`;
		});

		ok("冒烟：双向对应的两方被判为「天作之合」，且晚子时提醒照常出现", () => {
			// 这条盯的是**判定逻辑**与**排盘方标记的转述**，两者都不是「跑通了没有」：
			// fixture 甲夫妻宫的星 == 乙命宫的星、反之亦然，故必须判成双向对应。
			const r = run(["synastry", ...PAIR]);
			if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
			if (!r.out.includes("双向对应，符合「天作之合」最高级匹配"))
				throw new Error("两方主星互映却未判为双向对应 —— 对应关系判定可能已坏");
			// 晚子时提示来自 JSON 里的 lateZi 标记，本 skill 不重算真太阳时
			if (!r.out.includes("晚子时"))
				throw new Error("lateZi.candidate 为真却没出现晚子时提醒 —— 排盘依据的转述断了");
			return "判定与提醒均按 JSON 里的标记产出";
		});

		ok("护栏：缺 --b-chart 必须报错，并指向排盘方", () => {
			// 本 skill 不排盘，缺了命盘就什么都做不了。报错必须**指向 purplestar-astrology**，
			// 而不是像从前那样回退去读出生信息旗标 —— 那种回退会让本 skill 悄悄又变成排盘方。
			const r = run(["synastry", "--a-chart", fileA]);
			if (r.code === 0) throw new Error("缺 --b-chart 却退出码为 0 —— 缺旗标的护栏失效");
			if (!r.err.includes("--b-chart"))
				throw new Error(`报错未点名 --b-chart，实得：${r.err.trim()}`);
			if (!r.err.includes("purplestar-astrology"))
				throw new Error(`报错未指向 purplestar-astrology，实得：${r.err.trim()}`);
			return "缺 --b-chart 被拦下，且指路到排盘 skill";
		});

		ok("护栏：拿 `chart --json` 的输出来顶替时报错，并说清为什么不行", () => {
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

		ok("护栏：命盘 JSON 缺 nativeSiHua 时报错（逐项校验的证据）", () => {
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

		ok("护栏：命盘文件不是合法 JSON 时报错", () => {
			const broken = join(tmp, "broken.json");
			writeFileSync(broken, "未知命令「analyze」。可用：synastry / selftest\n");
			const r = run(["synastry", "--a-chart", broken, "--b-chart", fileB]);
			if (r.code === 0) throw new Error("文件不是 JSON 却退出码为 0");
			if (!/JSON/.test(r.err)) throw new Error(`报错未提到 JSON，实得：${r.err.trim()}`);
			return "坏 JSON 被拦下";
		});

		ok("参考文档：references/synastry-guide.md 在，评分标准与方法论两节都有内容", () => {
			// 评分标准与完整方法论是**恒定静态文本**（与「这一对是谁」无关）。2026-09-27 起从
			// `synastry-guide` 命令改为本 skill 的参考文档 —— `synastry` 只在末尾留一行指针。
			// ⚠️ 它**不被任何运行时路径读取**（不引入「内核读 md」这种新模式），所以删空它、
			// 改名它、把两节之一删掉，都不会让别的断言变红 —— 本断言是唯一的提示。
			const p = resolve(ctx.root, "..", "references", "synastry-guide.md");
			const md = readFileSync(p, "utf8");
			// 两个锚点各盯一节：评分标准取首档（五星）判词，方法论取首章标题。
			for (const anchor of [
				"双方夫妻宫互映天作之合，四化相互补益，大限同走旺运，福德宫双吉",
				"## 合盘分析核心框架（倪海夏体系 + 《紫微斗数全书》综合）",
			]) {
				if (!md.includes(anchor))
					throw new Error(`references/synastry-guide.md 缺少锚点：${anchor}`);
			}
			return `${md.split("\n").length} 行`;
		});

		ok("知识源：合盘断语与四化断语非空", () => {
			// 这条 2026-09-27 从排盘解读 skill 的 selftest 搬来 —— 那几个常量随
			// `ziwei/synastry-knowledge.ts` 一起归了本 skill，源那边的扫描根已够不到它们
			// （源扫不到的东西不该由源声明它可用）。搬过来不是抄一份：源里那条**已删除**。
			// ⚠️ 方法论与评分标准**不在本文件核对的范围内** —— 它们已搬去
			// `references/synastry-guide.md`，由上面那条参考文档守卫盯着。
			if (!Object.keys(STAR_IN_FUQI_GU).length) throw new Error("STAR_IN_FUQI_GU 为空");
			if (!Object.keys(SIHUA_IN_FUQI_GU).length) throw new Error("SIHUA_IN_FUQI_GU 为空");
			return `夫妻宫断语 ${Object.keys(STAR_IN_FUQI_GU).length} 星`;
		});

		ok("引文核对：未核实引文不得冒充倪师原话（扫本 skill 的根）", () => {
			// ⚠️ 这条是**本次改造一并修的既有缺陷**：`ziwei/citation-guard.ts` 早就被切进本
			// skill，`tools/skills.ts` 的注释也写明理由是「synastry 的 selftest 扫自己的根」，
			// 但本文件里**从来没有调用点** —— 那两个文件一直是死代码，而 `CLAUDE.md` 已声称
			// 这道守卫在 synastry 生效。本次删掉排盘内核后，`synastry-knowledge.ts` 里那些
			// 「倪师说」引文若不在这里扫，就**彻底没有覆盖**了（源的内核树够不到本 skill）。
			//
			// 扫描与比对全在 `ziwei/citation-guard.ts`，本断言只负责把结果翻译成人话。
			// 守卫的失效模式（扫了个空却一片绿）由 `test/citation-guard.test.ts` 用构造的
			// 目录树测，那里能造出违例文件；这里造不出来，只能信它 —— 故下面两条「扫到了
			// 没有」的检查是必需的。
			const { violations, checked, skipped } = scanCitations(ctx.root);
			if (!checked.length)
				throw new Error(`未扫到任何源码文件 —— 内核根 ${ctx.root} 或递归逻辑可能已失效`);
			if (!skipped.length)
				throw new Error(
					"未跳过任何核对表 —— 扫描范围可能已把 annotations.ts 卷进来（其内容会自我命中）"
				);
			if (violations.length)
				throw new Error(
					`以下未核实引文仍冒充倪师原话（应改古诀云/紫微斗数有云/一说）：\n     ${violations.join("\n     ")}`
				);
			return `扫 ${checked.length} 个文件，suspect/fabricated 引文零强归属`;
		});

		// ── 参数面 ──

		ok("参数面：a- / b- 前缀旗标不得用在别的命令上", () => {
			// 只有 `synastry` 读前缀；别的命令给它一个 `--a-chart` 是**用户搞错了命令**，
			// 静默忽略会让人以为「带了命盘却没生效」，排查方向被整个带偏。本 skill 除
			// `synastry` 外只剩 `selftest` 一条命令，故靶子都用它。
			const probes: Array<[string, string]> = [
				["--a-chart", "selftest"],
				["--b-chart", "selftest"],
				["--a-json", "selftest"],
			];
			for (const [flag, cmd] of probes) {
				let msg = "";
				try {
					parseArgs([flag, "x"], cmd);
				} catch (e) {
					msg = (e as Error).message;
				}
				if (!msg) throw new Error(`${cmd} 上的 ${flag} 未报错 —— 前缀旗标的归属校验失效了`);
			}
			return `${probes.length} 种越界写法均被拦下`;
		});

		ok("参数面：出生信息旗标已被整个拒收（本 skill 不再排盘）", () => {
			// 这是本次改造**最要紧的行为变更**：从前 synastry 认 15 个出生信息旗标，
			// 漏写 `a-` 前缀会**静默**按默认经度排出错盘（实测整盘从「巳时·火六局·命宫子破军」
			// 变成「卯时·土五局·命宫寅廉贞」，输出里一个字都没说）。
			// 现在它们既不在作用域里、也不在声明表里，用了直接报「未知参数」—— 缺口不存在了。
			// ⚠️ 若哪天它们又被收进来，本条会变红：那时该做的是**同步恢复 SKILL.md 的措辞**，
			// 而不是把断言改回去迁就实现。
			const probes = ["--a-date", "--a-time", "--a-gender", "--a-city", "--a-late-zi"];
			for (const flag of probes) {
				let msg = "";
				try {
					parseArgs([flag, "x"], "synastry");
				} catch (e) {
					msg = (e as Error).message;
				}
				if (!msg)
					throw new Error(`${flag} 在 synastry 上被接受了 —— 出生信息旗标又漏回作用域了`);
			}
			return `${probes.length} 个出生信息旗标全部被拒`;
		});

		ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
			// 拼错旗标以前是**静默**的：parseArgs 任何 `--xxx` 都照单全收，命令读不到就落回
			// 默认值。本断言锁的是**行为**而非文案。
			//
			// ⚠️ 探针围绕 `--chart` 写（本 skill 作用域里只剩 `chart` / `json` 两个名字）：
			// `suggestFlag` 只在**剥掉前缀后的裸名集合**里找编辑距离 < 3 的最近者，
			// 故三个探针的编辑距离都在阈值内，提示必然指向 `--chart`。
			const probes: Array<[string, string]> = [
				["--a-chrt", "chart"], // 漏字
				["--a-chrat", "chart"], // 换位
				["--a-chartss", "chart"], // 多字
			];
			for (const [bad, want] of probes) {
				let msg = "";
				try {
					parseArgs([bad, "x"], "synastry");
				} catch (e) {
					msg = (e as Error).message;
				}
				if (!msg) throw new Error(`${bad} 未报错 —— 未知旗标又变成静默忽略了`);
				if (!msg.includes(`--${want}`))
					throw new Error(`${bad} 的提示应指向 --${want}，实得：${msg}`);
			}
			return `${probes.length} 个拼写错误均被拦下`;
		});

		ok("参数面：SKILL.md 提到的旗标都在 args.ts 的声明表里", () => {
			// SKILL.md 是给 Claude 读的**行为规范**（改它就等于改 skill 的行为）。它提到的旗标若在
			// 解析层不存在，Claude 会照着敲一个被拒的参数。只查「SKILL.md → 声明表」一个方向：
			// 反向刻意不查 —— 声明表是各 skill 的**全集**，本 skill 的 SKILL.md 本就不该提到
			// `--focus` / `--liunian` 那些用不上的旗标。
			//
			// ⚠️ 比对前**必须先剥 `a-` / `b-` 前缀**：`FLAG_NAMES` 存的是**裸名**（`chart`），
			// 带前缀的写法由 `checkFlagName` 递归剥掉前缀后才查它。不剥就会得到一份
			// 「全部未声明」的假红 —— 本文件初版正是这么错的。前缀表同样从 `args.ts` 取
			// （`SIDE_PREFIXES`），不在这里写第二份。
			const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
			const mentioned = [...md.matchAll(/--([a-z][a-z0-9-]*)/g)].map(m => m[1]);
			// 先确认真扫到了东西：正则写歪或文件挪了位置都会得到空数组，那样的「零违规」是假绿。
			if (!mentioned.length)
				throw new Error("未从 SKILL.md 扫到任何旗标 —— 正则或路径可能已失效");
			const unknown: string[] = [];
			let prefixed = 0;
			for (const n of new Set(mentioned)) {
				const p = SIDE_PREFIXES.find(x => n.startsWith(x));
				// 裸的 `--a-` / `--b-`（后面不接旗标名）不是旗标，是散文里在说前缀本身 ——
				// 剥完是空串，跳过；否则 SKILL.md 每提一次「`a-` / `b-` 前缀」都会误报。
				if (p && n.length === p.length) continue;
				if (p) prefixed++;
				const bare = p ? n.slice(p.length) : n;
				if (!FLAG_NAMES.has(bare)) unknown.push("--" + n);
			}
			if (unknown.length)
				throw new Error(`SKILL.md 提到但 args.ts 未声明的旗标：${unknown.join("、")}`);
			return `${mentioned.length} 处旗标写法（含 ${prefixed} 个带前缀）全部有声明`;
		});

		ok("参数面：SKILL.md 命令速查表提到的命令都在 commands.ts 的命令表里", () => {
			// 与上一条同源：SKILL.md 提到的命令若不存在，Claude 会照着敲一条必然失败的命令行。
			//
			// ⚠️ 这里读的是 commands.ts 的**源码文本**而非它的导出 —— `COMMAND_TABLE` 里挂着
			// `cmdSelftest`，而本文件就是 selftest：静态 import 成环。正则抽键是与「读 SKILL.md
			// 文本」同一手法，也是源 skill 那份 selftest 用的办法。
			const src = readFileSync(resolve(ctx.root, "cli", "commands.ts"), "utf8");
			const table = src.match(/const COMMAND_TABLE = \{([\s\S]*?)\} satisfies/)?.[1];
			if (!table) throw new Error("未从 commands.ts 抽到 COMMAND_TABLE —— 声明块形状已变");
			// ⚠️ 键上的双引号是**可选**的：命令名含连字符时不是合法标识符，必须加引号。
			// 本 skill 现存命令名都无连字符，但正则保留这条兼容 —— 只认裸键的写法会静默漏抽。
			const defined = [...table.matchAll(/^\t+"?([a-z][a-z0-9-]*)"?:/gm)].map(m => m[1]);
			if (!defined.length)
				throw new Error("COMMAND_TABLE 里一个命令名都没抽到 —— 正则或路径可能已失效");

			const md = readFileSync(resolve(ctx.root, "..", "SKILL.md"), "utf8");
			const at = md.indexOf("## 命令速查");
			if (at < 0) throw new Error("SKILL.md 里找不到「## 命令速查」小节");
			// 只取该小节里的表格：正文提到命令名的散文不构成「速查表说这个命令存在」的声明。
			// 先跳过标题行与其后的空行，否则下面第一个 `\n\n` 就是标题后的空行，切出个空表。
			const body = md.slice(at + md.slice(at).indexOf("\n\n") + 2);
			const rows = body
				.slice(0, body.indexOf("\n\n"))
				.split("\n")
				.filter(l => l.startsWith("|"));
			const mentioned = rows
				.map(l => l.match(/^\|\s*`([a-z][a-z0-9-]*)/)?.[1])
				.filter(n => n !== undefined);
			if (!mentioned.length) throw new Error("未从命令速查表扫到命令 —— 表格格式已变");

			const unknown = mentioned.filter(n => !defined.includes(n));
			if (unknown.length)
				throw new Error(`SKILL.md 提到但 commands.ts 未定义的命令：${unknown.join("、")}`);
			return `${mentioned.length} 个命令全部有实现`;
		});

		// ── 引导层豁免有界 ──

		ok("引导层豁免有界：boot-hooks.ts 只依赖 node: 内置", () => {
			// scripts/boot-hooks.ts 是引导层**唯一**被允许静态 import 的非 node: 模块。
			// 「引导层不得出现普通静态 import」那条规则的实质是「禁止在钩子注册前触发 .ts 解析」，
			// 而 boot-hooks.ts 只依赖 node: 内置、调用点又写全了 .ts 扩展名，故由 Node 原生类型擦除
			// 加载，不触碰钩子 —— 这份豁免正是靠这一点成立。
			//
			// ⚠️ 越界有两种形态，只有一种会自己喊出来：
			//   · 省略扩展名 → 钩子尚未注册，CLI 当场崩 ERR_MODULE_NOT_FOUND。吵，但不危险。
			//   · 写全扩展名 → **照常跑通**（那个文件恰好没有自己的依赖）。这是颗哑雷 ——
			//     哪天它多一个 `@/` 依赖，引导层就会在钩子注册前崩掉，而崩因指向一次看似无关的改动。
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
	} finally {
		// 临时目录在断言跑完后必删（含失败路径）。⚠️ 它在 `process.exit(1)` **之前**执行 ——
		// 下面的输出段才决定退出码，故失败时也清理得到。
		rmSync(tmp, { recursive: true, force: true });
	}

	// ── 输出 ──
	const passed = results.filter(r => r.pass).length;
	const failed = results.length - passed;
	const srcNote = ctx.rootLabel === "技能自带内核" ? "" : `（来源：${ctx.rootLabel}）`;
	const out = [
		`紫微斗数合盘 skill 回归自检 —— 通过 ${passed}/${results.length}`,
		`内核根：${ctx.root} ${srcNote}`,
		"",
	];
	for (const r of results) {
		out.push(`${r.pass ? "✅" : "❌"} ${r.name}${r.detail ? `\n     ${r.detail}` : ""}`);
	}
	if (failed) {
		out.push(
			"",
			`❌ ${failed} 项未通过。若为命令或护栏行为变更所致，请核对 scripts/cli/ 下的实现与` +
				`本文件的断言哪一侧该改；若为副本漂移，跑 npm run sync:skills；` +
				`若为引文核对失败，改引文的呈现方式（古诀云/紫微斗数有云/一说）而不是删断言。`
		);
	} else {
		out.push("", "✅ 全部通过。");
	}
	const text = out.join("\n");
	if (failed) {
		console.error(text);
		process.exit(1);
	}
	return text;
}
