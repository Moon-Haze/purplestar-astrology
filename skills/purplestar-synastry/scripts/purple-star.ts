#!/usr/bin/env node
/**
 * purple-star.ts — 紫微斗数合盘 CLI（入口 / 引导层）
 *
 * 本文件只做四件事：**定位内核根 → 注册 TS 解析钩子 → 启动期内核自检 → 把命令分发出去**。
 *
 * ## 本 skill 的切面
 *
 * 内核是从排盘解读 skill（`purplestar-astrology`）**按 import 闭包切出来的副本**：合盘要排
 * 两张盘，故 `ziwei/algorithm.ts` 是根；再挂合盘断语（`synastry-knowledge.ts`）与四化
 * （`sihua.ts`）。格局库（`patterns/`）与主题论断库（`analysis/`）**不在其中** ——
 * 实测 `synastry` 一个都不碰，切走它们省下二十来个文件。
 *
 * ⚠️ **改内核一律改源**，然后 `npm run sync:skills`。就地改本目录的副本会被同步器覆盖，
 * 且 `test/repo.test.ts` 的层 6 会先变红。切片清单见 `<仓库根>/tools/skills.ts`。
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
type AlgorithmModule = typeof import("@/ziwei/algorithm");
// ⚠️ 合盘内核用**相对路径**而非 `@/`：`@/` 在 tsc 眼里只映到**源** skill 的内核根
//    （见 tsconfig 的 paths），而 synastry-knowledge.ts 已不住在源里（2026-09-27 起归本 skill），
//    写 `@/` 会让 `npm run typecheck` 报「找不到模块」。相对路径在两侧都对：运行期由钩子的
//    `.` 分支按**本文件**所在目录补 `.ts`，tsc 也按文件位置解析。
type synastryModule = typeof import("./ziwei/synastry-knowledge");
type SihuaModule = typeof import("@/ziwei/sihua");
type ArgsModule = typeof import("@/cli/args");
type CommandsModule = typeof import("@/cli/commands");

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
 * 取 `ziwei/algorithm.ts`（而不是 `synastry-knowledge.ts`）：排盘是合盘的**前置**，
 * 算法模块缺了则什么都做不了；断语模块缺了只影响输出的丰富度。
 */
const KERNEL_ENTRY = "ziwei/algorithm.ts";

const picked = pickRoot(ROOT_CANDIDATES, KERNEL_ENTRY);

if (!picked.root) {
	console.error(
		`[ziwei 启动失败] 找不到排盘内核（${KERNEL_ENTRY}）\n` +
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
const { generateChart } = await load<AlgorithmModule>("@/ziwei/algorithm");
const { STAR_IN_FUQI_GU, MARRIAGE_STARS_BRIEF } = await load<synastryModule>(
	"./ziwei/synastry-knowledge"
);
const { getSiHuaByStem } = await load<SihuaModule>("@/ziwei/sihua");

const { parseArgs, cli } = await load<ArgsModule>("@/cli/args");
const { COMMANDS, COMMAND_DESC } = await load<CommandsModule>("@/cli/commands");

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
 * 清单**按本 skill 的实际用量**列，不是排盘解读那份的全集：`patterns` / `analysis` 的导出
 * 在本 skill 的内核里根本不存在，照抄那份只会让启动必然失败。
 */
const REQUIRED_EXPORTS = [
	["generateChart", generateChart],
	["STAR_IN_FUQI_GU", STAR_IN_FUQI_GU],
	["MARRIAGE_STARS_BRIEF", MARRIAGE_STARS_BRIEF],
	["getSiHuaByStem", getSiHuaByStem],
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
 * ⚠️ 这段仍在手写（cac 渲染不到），改参数名时要一并改 —— `selftest` 有一条断言扫
 * `SKILL.md` 里的旗标写法，示例里的旗标因此也落在它的覆盖范围内。
 */
const HELP_EXAMPLES = `  # 合盘：双方出生信息各带 a- / b- 前缀
  node scripts/purple-star.ts synastry \\
    --a-date 1990-05-15 --a-time 09:30 --a-gender male --a-city 北京 \\
    --b-date 1993-08-22 --b-time 14:00 --b-gender female --b-city 上海

  # 方法论与评分标准是静态参考，住在 skill 内的 references/synastry-guide.md
  # （按需读文件，不经 CLI 输出）

  # 回归自检
  node scripts/purple-star.ts selftest`;

/**
 * 关于「参数段里为什么有一堆用不上的旗标」的说明，作为 help 的追加段。
 *
 * @remarks
 * `cli/args.ts` 是与另两个 skill **逐字节一致**的副本（见 `CLAUDE.md` 的「副本边界与同步流程」），
 * 它声明的是各 skill 的**全集**旗标。裁成按 skill 的旗标表会让它失去逐字节守卫，换来的
 * 只是 help 里少几行 —— 故保留全集，在这里说明白。
 *
 * 本例还要多一句：`--focus` / `--liunian` / `--liuyue` 属于 `analyze` / `topic`，
 * 本 skill 的两个命令都不认。
 */
const HELP_FLAGS_NOTE = `本 skill 只认 a- / b- 前缀的出生信息旗标（--a-date / --b-gender 等）。
上面参数段里的其余旗标（--gender / --focus / --liunian 等）来自各 skill 共享的参数表，
传了不会生效，也不会报错。`;

// 命令注册进 cac **只为让 help 列出命令**：分发仍由下面的 main() 查 COMMANDS 表 ——
// cac 的 action 模型与「cmdXxx 一律**返回**字符串、console.log 只在 main() 一处发生」不合。
for (const [name, desc] of Object.entries(COMMAND_DESC)) cli.command(name, desc);
cli.help(sections => [
	{ body: "紫微斗数合盘与合婚 —— 双宫联参（夫妻宫 × 福德宫）" },
	...sections,
	{ title: "说明", body: HELP_FLAGS_NOTE },
	{ title: "示例", body: HELP_EXAMPLES },
]);

/**
 * CLI 入口：取命令名 → 查 `COMMANDS` 表 → 解析参数 → 打印命令的返回值。
 *
 * @remarks
 * `console.log` 只在这一处发生 —— 各 `cmdXxx` 一律**返回**已渲染好的文本字符串，由这里统一输出。
 *
 * 无参数、`help`、`--help`、`-h` 都走 `cli.outputHelp()`；未知命令与命令内部抛出的错误都以
 * 非零码退出（只打印 `err.message`，不打印栈）。传给命令的第二个参数是 `CliContext`
 * （内核根及其来源），目前只有 `selftest` 用得上。
 *
 * ⚠️ 命令名直接来自 `argv`，故查表必然可能未命中 —— `COMMANDS` 的值类型显式带 `| undefined`。
 */
function main() {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	if (!cmd || cmd === "help" || argv.includes("--help") || argv.includes("-h")) {
		cli.outputHelp();
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
