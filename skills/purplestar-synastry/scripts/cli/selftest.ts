/**
 * 回归自检 —— 合盘 skill 的命令冒烟与自身一致性。
 *
 * ⚠️ **本文件是手写的，不是副本**（见 `CLAUDE.md` 的「副本边界与同步流程」）。
 *
 * ## 为什么这里**不复制**排盘解读 skill 的那 700 行断言
 *
 * 本 skill 的内核是**副本**，没人会就地改它 —— 开发循环是「改源 → `npm test` →
 * `npm run sync:skills`」。把排盘内核的断言复制过来，只会生产两份需要手工同步的副本，
 * 而漏同步的那一份会静默失效。内核回归的主场是源 skill 的 `selftest` 与仓库的 `npm test`。
 *
 * 本文件只负责**本 skill 自己的**事，三类：
 *   1. 命令冒烟 —— 引导层 → 解析钩子 → 命令表 → 渲染这条链真的跑得通
 *   2. 参数面 —— 拼错旗标要报错、`a-` 前缀不得越界、SKILL.md 与实现双向一致
 *   3. 引导层豁免有界
 *
 * 外加一条**参考文档守卫**：`references/synastry-guide.md`（评分标准与方法论全文）不被任何
 * 运行时路径读取，删空或改名不会让别的断言变红，故由本条盯着（见文件内的对应断言）。
 *
 * ⚠️ 它留在 `scripts/` 而非 `test/`，与源 skill 同理：分发时只带走
 * `SKILL.md + scripts/ + package.json`，自检必须在交付包内，否则装到别人机器上就没法自证。
 *
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**动态加载，故可放心静态 import 内核。
 */

import type { CliContext } from "./args";
import { FLAG_NAMES, SIDE_PREFIXES, parseArgs } from "./args";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildBirthInfo } from "./birth-info";
// ⚠️ 相对路径而非 `@/`：合盘内核已不住在源 skill 里（见 ./commands.ts 同一处注释）。
import { STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU } from "../ziwei/synastry-knowledge";

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
	/** 一对固定的出生信息（含 `a-` / `b-` 前缀），冒烟与契约断言共用。 */
	const PAIR = [
		"--a-date",
		"1990-05-15",
		"--a-time",
		"09:30",
		"--a-gender",
		"male",
		"--b-date",
		"1993-08-22",
		"--b-time",
		"14:00",
		"--b-gender",
		"female",
	];

	ok("冒烟：synastry 跑得通，且输出含双宫联参与夫妻宫断语两节", () => {
		const r = run(["synastry", ...PAIR]);
		if (r.code !== 0) throw new Error(`退出码 ${r.code}，stderr：${r.err.trim()}`);
		// 两个块标题各盯一件事：「双宫联参」是倪师口径的标志（缺了它本 skill 就没有立场），
		// 「夫妻宫断语」是那段唯一依赖 synastry-knowledge.ts 的输出（缺了它说明断语表没被切进来）。
		for (const sec of ["【合盘 · 双宫联参】", "【夫妻宫断语】"]) {
			if (!r.out.includes(sec)) throw new Error(`输出缺少「${sec}」`);
		}
		return `${r.out.split("\n").length} 行`;
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

	ok("护栏：synastry 缺一方性别必须报错，不替用户猜", () => {
		// 性别决定大限顺逆（男女可差 80 年），缺了它是**排不出对的盘**，不是少个字段。
		// 这里从 PAIR 里摘掉 `--b-gender female` 与它的值。
		const i = PAIR.indexOf("--b-gender");
		const noGender = [...PAIR.slice(0, i), ...PAIR.slice(i + 2)];
		const r = run(["synastry", ...noGender]);
		if (r.code === 0) throw new Error("缺 --b-gender 却退出码为 0 —— 性别护栏失效");
		if (!/gender|性别/.test(r.err)) throw new Error(`报错未提到性别，实得：${r.err.trim()}`);
		return "缺性别被拦下";
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

	ok("性别：synastry 缺 --a-gender 时，文案应指向 --a-gender", () => {
		// 与上面那条护栏互补：护栏测的是**命令**退出码非 0（子进程端到端），这条测的是
		// **文案**能不能指出缺的是哪一个（`--a-gender` 而不是笼统的 `--gender`）。
		// 同样搬自排盘解读 skill 的 selftest（那里已无 `a-` 前缀可用）。
		let msg: string | null = null;
		try {
			buildBirthInfo(parseArgs(["--a-date", "1990-05-15", "--a-branch", "0"]), "a-");
		} catch (e) {
			msg = (e as Error).message;
		}
		if (!msg) throw new Error("缺 --a-gender 时未报错");
		if (!msg.includes("--a-gender")) throw new Error(`文案应含 --a-gender，实得：${msg}`);
		return msg;
	});

	// ── 参数面 ──

	ok("参数面：a- / b- 前缀旗标不得用在别的命令上", () => {
		// 只有 `synastry` 读前缀；别的命令给它一个 `--a-date` 是**用户搞错了命令**，静默忽略
		// 会让人以为「带了出生信息却没生效」，排查方向被整个带偏。本 skill 除 `synastry` 外
		// 只剩 `selftest` 一条命令，故靶子都用它，靠**旗标**不同来覆盖几种写法。
		const probes: Array<[string, string]> = [
			["--a-date", "selftest"],
			["--b-gender", "selftest"],
			["--a-lunar", "selftest"],
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

	ok("参数面：synastry 上无前缀的出生信息旗标被**静默接受**（已知现状）", () => {
		// ⚠️ 这条断言锁的是一个**已知缺陷**，不是期望行为 —— 它的存在是为了「有记录、被盯住」，
		// 而不是为了让人以为这里没问题。
		//
		// 现状：`checkFlagName` 只拦「`a-` / `b-` 前缀用在非 synastry 命令上」，**不拦反方向**。
		// 于是 `synastry --a-date ... --city 喀什`（`--city` 漏了 `a-`）既不报错也不生效，
		// 脚本按默认东经 120° 排盘 —— 实测甲方整盘从「巳时·火六局·命宫子破军」变成
		// 「卯时·土五局·命宫寅廉贞」，而输出里一个字都没说。这是本 skill 最危险的入口。
		//
		// 唯一的兜底是**性别**：`--gender` 漏前缀会让 `buildBirthInfo` 读不到 `aGender`
		// 而报错（下一条断言盯着）。日期、城市、`--eot`、`--late-zi` 漏前缀则全无提示。
		//
		// ⚠️ 因此：**`SKILL.md` 里那段「漏前缀会静默排出错盘」的警告是这条断言的对手方**。
		// 哪天这个缺口被修好（`args.ts` 开始报错），本条会变红 —— 那时**应当做的事是
		// 同步改 `SKILL.md` 的警告段并删掉本条**，而不是把断言改回去迁就实现。
		const probes: Array<[string, string]> = [
			["--city", "北京"],
			["--eot", "true"],
			["--late-zi", "true"],
		];
		for (const [flag, value] of probes) {
			let threw = "";
			try {
				parseArgs([flag, value], "synastry");
			} catch (e) {
				threw = (e as Error).message;
			}
			if (threw)
				throw new Error(
					`${flag} 在 synastry 上开始报错了（${threw}）—— 缺口已被修复，` +
						`请同步更新 SKILL.md 的「漏前缀」警告段并删除本条断言`
				);
		}
		return `${probes.length} 个漏前缀旗标仍被静默接受`;
	});

	ok("参数面：synastry 上漏前缀的 --gender 由性别护栏兜住", () => {
		// 上一条说漏前缀普遍静默，**唯独性别例外** —— 因为 `--gender` 是必填的，
		// 读不到 `aGender` 就直接抛错。这条是那个「唯一兜底」的证据，也是上一条的对照：
		// 两者一起说明「为什么偏偏是性别救了我们」，免得后人以为漏前缀整体无害。
		const a = parseArgs(
			["--a-date", "1990-05-15", "--a-time", "09:30", "--gender", "male"],
			"synastry"
		);
		if (a.aGender !== undefined)
			throw new Error("`--gender` 竟被当成了 aGender —— 前缀规则变了，上一条的结论已失效");
		return "--gender 未被当作 aGender，交由 buildBirthInfo 报错";
	});

	ok("参数面：拼错的旗标必须报错，并指向最接近的合法名", () => {
		// 拼错旗标以前是**静默**的：parseArgs 任何 `--xxx` 都照单全收，命令读不到就落回默认值
		// —— `--a-dtae 1990-05-15` 会让甲方出生日期整个缺失。本断言锁的是**行为**而非文案。
		//
		// ⚠️ 提示里给的是**剥掉前缀之后**的名字（`--date`，不是 `--a-date`）：`checkFlagName`
		// 剥完前缀才查 {@link FLAG_NAMES}，`suggestFlag` 因此只在裸名集合里找最近者。
		// 对敲了 `--a-dtae` 的用户来说，「最接近的是 --date」略欠一步，但方向是对的；
		// 这条断言按**实际行为**写，改文案不会让它红，改行为才会。
		const probes: Array<[string, string]> = [
			["--a-dtae", "date"], // 换位
			["--a-dat", "date"], // 漏字
			["--a-datess", "date"], // 多字
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
		// ⚠️ 比对前**必须先剥 `a-` / `b-` 前缀**：`FLAG_NAMES` 存的是**裸名**（`date` / `city`），
		// 带前缀的写法由 `checkFlagName` 递归剥掉前缀后才查它。不剥就会得到一份「全部未声明」的
		// 假红 —— 本文件初版正是这么错的。前缀表同样从 `args.ts` 取（`SIDE_PREFIXES`），
		// 不在这里写第二份。
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
			`❌ ${failed} 项未通过。若为内核重构所致，请核对 scripts/cli/ 各模块的 import 列表与` +
				`scripts/ziwei/ 的实际导出是否对得上；若为副本漂移，跑 npm run sync:skills。`
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
