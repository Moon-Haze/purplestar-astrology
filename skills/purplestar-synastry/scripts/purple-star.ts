#!/usr/bin/env node
/**
 * purple-star.ts — 紫微斗数合盘 CLI（入口 / 引导层）
 *
 * 本文件只做四件事：**定位内核根 → 注册 TS 解析钩子 → 启动期内核自检 → 把命令分发出去**。
 *
 * ## 本 skill 的切面：零排盘引擎、零依赖
 *
 * ⚠️ **本 skill 不排盘**（2026-09-27 起）。命盘由排盘解读 skill（`purplestar-astrology`）
 * 产出，本 skill 读它 `analyze --json` 的输出做合盘。故这里既没有 `ziwei/algorithm.ts`，
 * 也没有 `iztro` 之类的排盘依赖 —— 与 `purplestar-classics` 同构，是第二个「零排盘内核」
 * 的 skill。
 *
 * 切片里只剩三类东西：
 *   · **自有内核** —— `ziwei/synastry-knowledge.ts`（合盘断语库，源里没有对应物）
 *   · **类型契约** —— `ziwei/types.ts`（纯 interface，运行期被完全擦除）
 *   · **引文守卫** —— `ziwei/citation-guard.ts` ＋ 它带出的 `annotations.ts`，
 *     扫 `synastry-knowledge.ts` 里那些「倪师说」引文有没有被强归属
 *
 * ⚠️ **依赖已清零**：参数解析用的是 Node 内置的 `node:util` 的 `parseArgs`，故本 skill
 * 连 `npm install` 都不需要，拷进 `~/.claude/skills/` 即可运行。
 *
 * ⚠️ **仍在同步清单里的只剩 `boot-hooks.ts`**：改源再 `npm run sync:skills`，就地改本目录
 * 的副本会被同步器覆盖，且 `test/repo.test.ts` 的层 6 会先变红。
 * 而 `cli/args.ts` **不再是源那边的副本** —— 两个派生各存一份、两份逐字节相同，以
 * `purplestar-classics` 那份为准（层 6 有断言钉着）。切片清单见 `<仓库根>/tools/skills.ts`。
 *
 * 依赖 Node ≥ 22.15（module.registerHooks + 原生 TS 类型擦除）。
 * 用法：node scripts/purple-star.ts <command> [options]   （在 skill 根目录下执行；脚本本身也可从任意 cwd 运行）
 * 帮助：node scripts/purple-star.ts help
 * 自检：node scripts/purple-star.ts selftest
 *
 * @packageDocumentation
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ⚠️ 引导层**唯一**被允许的非 `node:` 静态 import，理由见下方「引导层为什么能静态 import
//    boot-hooks.ts」—— 该文件自身只依赖 `node:` 内置，且调用点用的是带 `.ts` 扩展名的
//    说明符，靠 Node 原生类型擦除即可加载，**不需要解析钩子**。除此之外本文件不允许出现
//    任何普通静态 import。
import { installHooks, loadFailureHint, makeLoader, pickRoot } from "./boot-hooks.ts";

// ── 类型层：`import type` 与 `typeof import(...)` 在运行时被**完全擦除**，不产生任何静态依赖 ──
// 这一点是本文件能同时「自举注册 TS 钩子」与「拿到内核/子模块类型」的关键：
// ESM 的静态 import 会被提升到模块求值之前，若用普通 import 引内核或 scripts/cli/*，
// 钩子还没注册、对方的 .ts 就已经要加载了。类型节点擦除后什么都不剩，故安全。
//
// ⚠️ 因此：**本文件里除 `node:` 内置模块与 ./boot-hooks.ts 外，不允许出现任何普通静态 import**
//    —— `scripts/cli/` 下的自家子模块也不行（它们静态 import 内核，同样会触发提前加载）。
//    凡是要用的值，一律走下面的 load<T>()。这是本文件最容易被改坏的一处。
// ⚠️ 自有内核用**相对路径**而非 `@/`：`@/` 在 tsc 眼里只映到**源** skill 的内核根
//    （见 tsconfig 的 paths），而 `synastry-knowledge.ts` 已不住在源里（2026-09-27 起归本
//    skill），写 `@/` 会让 `npm run typecheck` 报「找不到模块」。相对路径在两侧都对：
//    运行期由钩子的 `.` 分支按**本文件**所在目录补 `.ts`，tsc 也按文件位置解析。
type synastryModule = typeof import("./ziwei/synastry-knowledge");
// ⚠️ `cli/*` 同样走**相对路径**，不用 `@/` —— 2026-09-27 换引擎后本 skill 的 `cli/args.ts`
//    与源那份**不再相同**（源仍是 `cac` 版），而 `@/` 在 tsc 眼里只映到**源**的内核根，
//    于是 `typeof import("@/cli/args")` 描述的是**另一个文件**：源那边没有 `renderHelp`、
//    却有本 skill 已删掉的 `cli`。类型写对了、指向错了，`npm run typecheck` 会报属性不存在。
//    相对路径在两侧都对：运行期由钩子的 `.` 分支按 boot-hooks.ts 所在目录补 `.ts`（它与本
//    文件同目录），tsc 也按文件位置解析。
type ArgsModule = typeof import("./cli/args");
type CommandsModule = typeof import("./cli/commands");

/** 本脚本所在目录，即 `<skill 根>/scripts`（内核根的第一个候选，见 {@link pickRoot}） */
const HERE = dirname(fileURLToPath(import.meta.url));

// ── 内核根目录：两级优先级 ──
/**
 * 本 CLI 的内核根候选清单（判定规则与失败呈现都在 `./boot-hooks.ts`，此处只给**策略**）。
 *
 * @remarks
 * 优先级：
 * 1. `ZIWEI_ROOT` 环境变量 —— 显式指定（想把内核指到别处时用）
 * 2. 技能自带内核 —— 就是本脚本所在目录 `<skill 根>/scripts/`
 *
 * 内核根 = `scripts/` **本身**：CLI（`purple-star.ts`、`cli/`）与内核目录（`ziwei/`）
 * 同处一层。因此 `@/` 别名指向的是 `scripts/`，而**不是** skill 根。
 */
const ROOT_CANDIDATES: Array<[string | undefined, string]> = [
	[process.env.ZIWEI_ROOT && resolve(process.env.ZIWEI_ROOT), "ZIWEI_ROOT 环境变量"],
	[HERE, "技能自带内核"],
];

/**
 * 本 skill 的内核入口 —— `pickRoot` 拿它判定「这份内核在不在」。
 *
 * @remarks
 * 由调用方传入而非写死在 `boot-hooks.ts`：各 skill 各有各的内核，本 skill 里没有
 * `classics/`，古籍检索 skill 里也没有 `ziwei/`，拿别人的入口来判定只会得到误导信息。
 *
 * 取 `ziwei/synastry-knowledge.ts` —— 它是本 skill 的**自有内核**（合盘断语库），
 * 缺了它这个 skill 就没有存在意义。排盘内核已不住在这里（命盘由 purplestar-astrology
 * 产出），故不再拿 `ziwei/algorithm.ts` 当判据：那个文件在本 skill 里根本不存在，
 * 拿它判定只会得到一句「找不到排盘内核」的误导信息。
 */
const KERNEL_ENTRY = "ziwei/synastry-knowledge.ts";

const picked = pickRoot(ROOT_CANDIDATES, KERNEL_ENTRY);

if (!picked.root) {
	console.error(
		`[ziwei 启动失败] 找不到内核入口（${KERNEL_ENTRY}）\n` +
			`  已尝试：\n` +
			picked.tried.map(t => `    - ${t}`).join("\n") +
			"\n" +
			`  处理：\n` +
			`    ① 确认 skill 目录完整 —— scripts/ 下应同时有 purple-star.ts、cli/ 与 ziwei/（拷贝时漏带内核会走到这里）；或\n` +
			`    ② 用 ZIWEI_ROOT=<含 ziwei/ 的目录> 显式指定内核位置。`
	);
	process.exit(1);
}

/**
 * 内核根（已确定为非空）。
 *
 * @remarks
 * `picked` 是判别联合，`!picked.root` 的守卫之后整体收窄为 `RootFound`，故 `root` 与 `label`
 * 都直接是 `string`。收窄不会延续到函数体内（`load` 的错误分支就要用 `ROOT`），
 * 故此处显式落成非空 `string`，免得每个闭包里都得再断言一次。
 */
const ROOT: string = picked.root;
const ROOT_LABEL: string = picked.label;

// ── 让 Node 直接加载 TS：解析 @/ 别名，补全省略的 .ts / index.ts，并把裸包名指向当前根 ──
// 钩子本体在 ./boot-hooks.ts，此处只负责**注册时机**：必须在任何内核模块被求值之前执行。
installHooks(ROOT);

/**
 * 动态加载内核或 `scripts/cli/*` 子模块；任何上游模块挂了都给排查指引而不是裸栈。
 *
 * @remarks
 * 机制在 `./boot-hooks.ts` 的 `makeLoader`；此处只给**策略** —— 失败即渲染指引并
 * `process.exit(1)`，故调用点拿到的返回值必然非空，不必再写 try/catch。
 */
const load = makeLoader(ROOT, ROOT_LABEL, f => {
	console.error(
		`[ziwei 启动失败] 无法加载 ${f.spec}\n  ${f.error.message}\n${loadFailureHint(f)}`
	);
	process.exit(1);
});

// 钩子已就绪，从这里开始才能安全地加载任何 .ts。
const { STAR_IN_FUQI_GU, MARRIAGE_STARS_BRIEF } = await load<synastryModule>(
	"./ziwei/synastry-knowledge"
);

const { parseArgs, renderHelp } = await load<ArgsModule>("./cli/args");
const { COMMANDS, COMMAND_DESC } = await load<CommandsModule>("./cli/commands");

// ── 启动自检：内核若重构导致关键导出消失，立即报错，而不是静默给出空结果 ──
/**
 * 启动期必须存在的上游导出清单，每项是 `[导出名, 运行时值]`。
 *
 * @remarks
 * 子模块是静态 import 内核的，少一个导出本来就会让它们加载失败；但那时抛的是裸的
 * `SyntaxError: does not provide an export named ...`，指不到该改哪里。这里先 load 一遍
 * 并逐项点名，把「哪个导出没了、当前内核根在哪、接下来怎么办」一次说清。
 *
 * ⚠️ 也因此：在内核里重命名或删除导出会让 CLI 立刻报错 —— **这是有意的，不是脆弱**。
 * 清单**按本 skill 的实际用量**列，不是排盘解读那份的全集：`generateChart` / `patterns` /
 * `analysis` 的导出在本 skill 的内核里根本不存在（本 skill 不排盘），照抄那份只会让启动
 * 必然失败。清单因此很短 —— 短是事实，不是漏写。
 */
const REQUIRED_EXPORTS = [
	["STAR_IN_FUQI_GU", STAR_IN_FUQI_GU],
	["MARRIAGE_STARS_BRIEF", MARRIAGE_STARS_BRIEF],
];
{
	const missing = REQUIRED_EXPORTS.filter(([, v]) => v === undefined || v === null).map(
		([n]) => n
	);
	if (missing.length) {
		console.error(
			`[ziwei 启动自检失败] 以下上游导出缺失：${missing.join("、")}\n` +
				`  当前内核根：${ROOT}（来源：${ROOT_LABEL}）\n` +
				`  可能原因：内核被重构，或导出被改名 / 删除。\n` +
				`  处理：核对 scripts/cli/ 各模块的 import 列表与 scripts/ziwei/ 的实际导出是否对得上。`
		);
		process.exit(1);
	}
}

// ══════════════════════ 入口 ══════════════════════

/**
 * 常用调用示例，作为 help 的追加段。
 *
 * @remarks
 * ⚠️ 这段是**手写的领域知识**（`renderHelp` 渲染不到它），改参数名时要一并改 ——
 * 且**没有断言盯着它**：
 * `selftest` 那条旗标断言扫的是 `SKILL.md` 的正文，本文件的示例不在它的覆盖范围内。
 * 示例里的排盘命令属于 `purplestar-astrology`，那几个参数以那个 skill 为准，本 skill
 * 不复述它的参数面（复述就是第二份需要手工同步的真相）。
 */
const HELP_EXAMPLES = `  # ① 先在 purplestar-astrology skill 里各排一张盘
  #    （必须是 analyze，不是 chart —— 后者没有四化落宫与排盘依据）
  node <purplestar-astrology>/scripts/purple-star.ts analyze \\
    --date 1990-05-15 --time 09:30 --city 北京 --gender male --json > /tmp/a.json
  node <purplestar-astrology>/scripts/purple-star.ts analyze \\
    --date 1993-08-22 --time 14:00 --city 上海 --gender female --json > /tmp/b.json

  # ② 把两份 JSON 交给本命令（两方各一份，前缀 a- / b-）
  node scripts/purple-star.ts synastry --a-chart /tmp/a.json --b-chart /tmp/b.json

  # 方法论与评分标准是静态参考，住在 skill 内的 references/synastry-guide.md
  # （按需读文件，不经 CLI 输出）

  # 回归自检
  node scripts/purple-star.ts selftest`;

/**
 * 关于「命盘从哪来、前缀怎么加」的说明，作为 help 的追加段。
 *
 * @remarks
 * 从前这里写的是「参数段里有一堆用不上的旗标」—— 自 2026-09-27 收窄作用域后
 * **不再成立**：`cli/flag-scope.ts` 只认 `--chart` / `--json`，help 的参数段只遍历
 * 本 skill 认的那几个（`args.ts` 的 `renderHelp` 按 `FLAG_NAMES` 过滤），
 * 参数段里已经没有别的旗标了。那段说明若留着，会把用户引向一个不存在的问题。
 *
 * 现在要说清的是另一件事：`--chart` 是本 skill 独有的一维，**必须写成两份并各加前缀**
 * （`--a-chart` / `--b-chart`），而 `analyze --json` 要到另一个 skill 里去跑。
 */
const HELP_FLAGS_NOTE = `本 skill **不排盘**：命盘由 purplestar-astrology 的 \`analyze --json\` 产出，
本命令只读它的输出。故 --chart 要写两次并各加前缀：
  --a-chart /tmp/a.json --b-chart /tmp/b.json
两个文件都必须来自 analyze（不是 chart）—— 后者没有四化落宫与排盘依据。`;

/**
 * 整份帮助文本。
 *
 * @remarks
 * 由 `cli/args.ts` 的 `renderHelp` 从**声明表**渲染（参数段）+ `COMMAND_DESC` 渲染
 * （命令段）+ 本文件的两段领域知识拼成。故 help 与 CLI 的实际行为同源，不会各说各话。
 *
 * ⚠️ 命令表**作为入参**交给 `renderHelp`，而不是让它 import `commands.ts` ——
 * 后者依赖 `args.ts`，反向 import 会成环。
 */
const HELP_TEXT = renderHelp({
	head: "紫微斗数合盘与合婚 —— 双宫联参（夫妻宫 × 福德宫）",
	commands: COMMAND_DESC,
	notes: [
		{ title: "说明", body: HELP_FLAGS_NOTE },
		{ title: "示例", body: HELP_EXAMPLES },
	],
});

/**
 * CLI 入口：取命令名 → 查 `COMMANDS` 表 → 解析参数 → 打印命令的返回值。
 *
 * @remarks
 * `console.log` 只在这一处发生 —— 各 `cmdXxx` 一律**返回**已渲染好的文本字符串，由这里统一输出。
 *
 * 无参数、`help`、`--help`、`-h` 都打印 {@link HELP_TEXT}；未知命令与命令内部抛出的错误都以
 * 非零码退出（只打印 `err.message`，不打印栈）。传给命令的第二个参数是 `CliContext`
 * （内核根及其来源），目前只有 `selftest` 用得上。
 *
 * ⚠️ 这一段的判定必须留在 `parseArgs` **之前**：`--help` / `-h` 不是本 skill 声明的旗标，
 * 交给解析器只会得到一句「未知参数」。留在前面还有个副作用 —— `--help` 出现在任何位置
 * （含 `synastry --a-chart x --help`）都会走帮助，这是刻意保留的宽松。
 *
 * ⚠️ 命令名直接来自 `argv`，故查表必然可能未命中 —— `COMMANDS` 的值类型显式带 `| undefined`。
 */
function main() {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	if (!cmd || cmd === "help" || argv.includes("--help") || argv.includes("-h")) {
		console.log(HELP_TEXT);
		return;
	}
	const fn = COMMANDS[cmd];
	if (!fn) {
		console.error(
			`未知命令「${cmd}」。可用：${Object.keys(COMMANDS).join(" / ")}\n运行 help 查看完整用法。`
		);
		process.exit(1);
	}
	try {
		// 命令名一并交给 parseArgs：旗标面要按命令校验（如 a- / b- 前缀只有 synastry 认）
		const args = parseArgs(argv.slice(1), cmd);
		console.log(fn(args, { root: ROOT, rootLabel: ROOT_LABEL }));
	} catch (err) {
		console.error(`错误：${(err as Error).message}`);
		process.exit(1);
	}
}

main();
