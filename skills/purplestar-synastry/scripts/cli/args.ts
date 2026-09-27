/**
 * CLI 参数面 —— 旗标声明表 + 校验 + 解析 + 帮助渲染。不依赖任何内核模块，
 * 也不使用 `@/` 别名。
 *
 * 拆自 purple-star.ts。依赖图的最底层（args / render 并列底层，
 * 其余模块都建立在它们之上）：
 *
 *   args ─┐
 *         ├─→ birth-info ─→ commands ─→ selftest
 *   render┘        ↑____________|
 *
 * ⚠️ 本文件由引导层（purple-star.ts）在 `registerHooks` **之后**动态加载。
 *    不要在 purple-star.ts 顶部用静态 `import` 引它 —— 它静态 import 了本地的
 *    `./flag-scope`（一个 `.ts` 文件），钩子未注册时那一步解析会失败。
 *
 * ## 为什么旗标要有声明表
 *
 * 此前「有哪些旗标」这件事只存在于三处**手写副本**里：`parseArgs` 不检查名字（任何
 * `--xxx` 都照单全收）、`purple-star.ts` 的 `HELP` 字符串、`SKILL.md` 的散文。
 * 三处靠注释互相提醒「要同步」，而漂移的代价是不对称的：
 *
 * - 拼错一个旗标名（`--ctiy 喀什`）以前**不报错**。`buildBirthInfo` 读的是 `city`，
 *   读不到就落回默认经度 120°E —— 排出的是一张经度错约 176 分钟（≈3 个时辰）的盘，
 *   全程没有任何提示。这类静默错盘正是本项目 `REQUIRED_EXPORTS` 与 `algorithm.ts`
 *   的 `projectPalaceName` 都在防的东西，参数面却是敞开的。
 * - `--a-chart` 写在 `analyze` 上同理：`a-` 前缀只有 `synastry` 会去读，别处直接报错。
 *
 * 现在 {@link FLAG_GROUPS} 是唯一来源：{@link parseArgs} 据它拒绝未知旗标、
 * 据它算出交给 `parseArgs` 的选项表、{@link renderHelp} 据它渲染 help 的参数段、
 * `SKILL.md` 则由 `selftest` 断言兜底。
 *
 * ## 解析引擎：Node 内置的 `node:util` 的 `parseArgs`（零依赖）
 *
 * ⚠️ **本文件不再是源 skill 的副本**。2026-09-27 起，两个**派生** skill（本 skill 与
 * `purplestar-synastry`）改用 Node 内置的 `parseArgs`，源（`purplestar-astrology`）
 * 仍用 `cac`。故这里有两个后果，改文件前先读：
 *
 * - 本文件在**两个派生 skill 之间**仍是逐字节相同的**一对**副本（仓库测试守着），
 *   但与源那一份**不再相同** —— 引擎不同，逐字节断言无从成立，故改为
 *   「`FLAG_GROUPS` 与源 deep-equal」（声明表才是真正不能漂移的东西）。
 * - **两个派生 skill 从此零依赖**：不必 `npm install`，`package.json` 里没有
 *   `dependencies`，拷进 `~/.claude/skills/` 即可运行。这是选内置模块最直接的收益。
 *
 * ### 实测（Node v26.10.0）—— 下面每条都是量出来的，不是照 `cac` 的印象推的
 *
 * - **键名原样返回**：`--late-zi` 的键就是 `"late-zi"`，**不做 camelCase**。
 *   故 kebab → camel 的换算成了**本项目自己的约定**（{@link camelKey}），
 *   而不是「抵消引擎的归一」。
 * - **未给出的选项根本不进 `values`**（空参数时 `values` 是 `{}`）——
 *   「`undefined` 即未给出」的判空天然成立，归一化时无须过滤。
 * - **不认 `default` 也就罢了**，本文件刻意不给：给了之后未出现的参数也会进结果，
 *   同样会破坏上面那条判空。
 * - **重复选项取末值**（`--limit 5 --limit 2` → `"2"`），不必自己归并。
 * - **值一律是 `string`**：`--limit 007` 保持 `"007"`，不会被转成数字（`cac`/`mri`
 *   会转，前导零在那里就丢了）。
 * - **`--` 之后的内容全进 `positionals`** —— 故无需再处理引擎吐出的 `"--"` 键。
 * - **单独的 `-` 是位置参数**（stdin 的传统写法），而 `-x` 在 `strict` 下抛
 *   `ERR_PARSE_ARGS_UNKNOWN_OPTION`。
 * - ⚠️ **`--key value` 里的值若以 `-` 开头会被判「歧义」而丢弃**
 *   （`--limit -3` 抛 `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`，`allowNegative`
 *   实测毫无效果）。故前置扫描把取值类旗标**改写成等号式**再交给引擎，
 *   见 {@link parseArgs} 的 ②。
 * - **`strict: true`（默认）下未知选项抛错**，但抛的是**英文且无最近邻建议**
 *   —— 「拼错旗标」这件事仍只有前置扫描能给出中文与 {@link suggestFlag}。
 */

import { parseArgs as parseNodeArgs } from "node:util";

// ⚠️ 本文件是两个派生 skill 之间**逐字节相同**的一对副本，而 `./flag-scope` 是
//    **各 skill 自己写**的（源 / 合盘 / 古籍各一份，内容不同）。二者必须分开：
//    解析骨架抄两份已经是不得已（源那一份是 cac 版，见文件头），而「本 skill 认哪些
//    旗标」本来就因 skill 而异，正是该各写各的那部分。
//    故：本文件**不进**同步清单，作用域文件同样不进（见 tools/skills.ts）。
//
// 运行期无环：本行是**值**导入，而 `flag-scope.ts` 只以 `import type` 取下面的
// {@link FlagScope}（类型导入被完全擦除）。
import { FLAG_SCOPE } from "./flag-scope";

/**
 * CLI 参数表：`_` 收位置参数，其余键对应 `--key`。
 *
 * @remarks
 * 带值的参数存 `string`，纯开关存 `boolean` 的 `true`（见 {@link parseArgs}），
 * 因此取值前通常要先收窄类型。
 *
 * ⚠️ **键是 camelCase**（`late-zi` → `lateZi`、`a-chart` → `aChart`）。
 * 这是**本项目自己的键名约定**，由 {@link camelKey} 在归一化那一步做 ——
 * 引擎（`parseArgs`）返回的键是原样的 kebab。换算只有 {@link camelKey} 一处；
 * 按下标读参数的地方（`birth-info.ts` 的 `g()`）必须经它拼键。
 *
 * 索引签名里保留 `string[]` 是为了与 `_` 的写入同域 —— TS 要求索引签名涵盖所有具名属性。
 */
export interface CliArgs {
	/** 位置参数：非 `--` 开头的 argv 项，按出现顺序收集 */
	_: string[];
	[key: string]: string | boolean | string[];
}

// ── 旗标声明：CLI 参数面的唯一定义处 ──────────────────────────

/**
 * 一个旗标的完整声明。
 *
 * @remarks
 * 界面刻意只留四格 `name / kind / value / desc` —— 声明表要能被一眼扫完，
 * 免得「加旗标」变成一件要读文档才敢做的事（那正是这份声明想消灭的成本）。
 */
export interface FlagSpec {
	/** 旗标名，不含 `--`。`synastry` 可用 `a-` / `b-` 前缀叠在它前面（如 `--a-chart`） */
	name: string;
	/** `"value"` 取值、`"switch"` 纯开关（HELP 据此决定写不写值域占位） */
	kind: "value" | "switch";
	/** 值域占位，如 `"YYYY-MM-DD"`；`kind: "switch"` 时不给 */
	value?: string;
	/** 一行说明，即 HELP 里那一行的描述列 */
	desc: string;
}

/**
 * 一组旗标。
 *
 * @remarks
 * `title` **进 HELP**：参数段由 {@link renderHelp} 自己渲染（引擎不再提供 help 设施），
 * 故这里的分组第一次真的显示出来。它同时承载一句只有此处可写的口径提示
 * （「三选一」「二选一」）—— 那句是**口径**而非装饰：`buildBirthInfo` 对
 * `--date` / `--lunar` / `--year+--month+--day` 与 `--time` / `--branch` 各取其一，
 * 同时给出时按该处的优先级静默择一。
 *
 * ⚠️ 改造前这里写着「`title` 不进 HELP：cac 渲染的参数段是平铺列表，不带分组」。
 *    换成内置引擎后那句不再成立 —— help 由本仓渲染，分组自然可见。
 */
export interface FlagGroup {
	title: string;
	flags: readonly FlagSpec[];
}

/**
 * 本 skill 的**旗标作用域** —— 声明「这份声明表里，本 skill 认其中哪些」。
 *
 * @remarks
 * 各 skill 写在自己的 `scripts/cli/flag-scope.ts` 里，本文件静态 import 它。
 * 声明是**裸旗标名的正面清单**，不按「本 skill 认哪些命令」派生 —— 那会重建本文件
 * 刻意不维护的「旗标属于哪个命令」归属表（见 {@link checkFlagName} 的 ⚠️）。
 * 正面清单还有个好处：**fail-closed** —— 往 {@link FLAG_GROUPS} 加一个新旗标，
 * 它不会自动泄漏给没声明它的 skill，加的人必须决定它归谁。
 *
 * 收窄发生在四个点上，全在本文件内：交给引擎的 {@link OPTIONS} 选项表、
 * {@link renderHelp} 渲染的参数段（二者都只遍历 {@link FLAG_NAMES}，故 help 里的
 * 可见性与引擎的接受面自动一致）、{@link FLAG_NAMES} 本身（校验基准与
 * {@link suggestFlag} 的候选集）、{@link LEGAL_KEYS}。
 *
 * ⚠️ **收窄的粒度是 skill 级，不是命令级**：`stars --json` 这类「本 skill 有、
 * 但当前命令不读」的参数仍会被收下不用。要修得把每条命令实际读的键也声明出来，
 * 那正是 {@link checkFlagName} 拒绝维护的归属表，本仓不做。
 */
export interface FlagScope {
	/** 本 skill 认的旗标名（不含 `--`）；每一项都必须是 {@link FLAG_GROUPS} 里的名字。 */
	readonly flags: readonly string[];
	/** 本 skill 认的出生方前缀（合盘用 `["a-", "b-"]`）；不认就给空数组。 */
	readonly sidePrefixes: readonly string[];
	/**
	 * 哪些命令接受 {@link sidePrefixes} 前缀。空数组表示本 skill 没有这种命令。
	 *
	 * @remarks
	 * ⚠️ 这一维**不能省**：它是「前缀写在别的命令上」这条静默失败的判据。若只看
	 * `sidePrefixes` 非空就放行，`selftest --a-chart` 会从「报错」变成「静默忽略」
	 * —— 既违反「宁可报错，不静默」，又会让合盘 selftest 里那条断言变红。
	 */
	readonly prefixedCommands: readonly string[];
	/**
	 * 按旗标名覆盖 HELP 里的说明文案。
	 *
	 * @remarks
	 * 声明表里的 desc 是**全集视角**写的（`--search` 写着「classics / stars / cities」），
	 * 而各 skill 的命令集不同 —— 源删掉 `classics` 后，那句在源的 help 里就指着一个
	 * 不存在的命令。作用域只管「列哪些旗标」管不到文案，故留这个口子。
	 */
	readonly descOverrides?: Readonly<Record<string, string>>;
}

/**
 * 全部旗标，按 HELP 的展示顺序分组。
 *
 * @remarks
 * ⚠️ **这张表必须与源 skill 的那份 `deepStrictEqual`**（仓库测试守着）：
 * 它是「有哪些旗标」的唯一来源，而漂移的代价是静默的 —— 见文件头那两类错盘。
 * 两个派生 skill 换了引擎，但**声明表与源共用同一份内容**，改这里就要同步改源。
 */
export const FLAG_GROUPS: readonly FlagGroup[] = [
	{
		title: "出生日期（三选一；synastry 加 a- / b- 前缀）",
		flags: [
			{ name: "date", kind: "value", value: "YYYY-MM-DD", desc: "公历生日" },
			{
				name: "lunar",
				kind: "value",
				value: "YYYY-MM-DD",
				desc: "农历生日（脚本自动换算，勿与 --date 同用）",
			},
			{ name: "leap", kind: "switch", desc: "配合 --lunar，表示闰月" },
			{
				name: "year",
				kind: "value",
				value: "1990",
				desc: "公历出生年（与 --month / --day 分写）",
			},
			{ name: "month", kind: "value", value: "1-12", desc: "公历出生月（分写）" },
			{ name: "day", kind: "value", value: "1-31", desc: "公历出生日（分写）" },
		],
	},
	{
		title: "出生时辰（二选一）",
		flags: [
			{
				name: "time",
				kind: "value",
				value: "HH:MM",
				desc: "钟表时间（配合 --lng / --city 自动换算真太阳时）",
			},
			{
				name: "branch",
				kind: "value",
				value: "0-12",
				desc: "直接指定时辰支（0=子 … 11=亥；12=晚子时），与 --time 二选一",
			},
			{
				name: "late-zi",
				kind: "switch",
				desc: "配合 --time：23:00–23:59 出生改按「晚子时算次日」排",
			},
			{
				name: "eot",
				kind: "switch",
				desc: "配合 --time：真太阳时额外计入均时差（±16 分），默认不计",
			},
		],
	},
	{
		title: "其他出生信息",
		flags: [
			{ name: "gender", kind: "value", value: "male|female", desc: "性别" },
			{
				name: "lng",
				kind: "value",
				value: "116.4",
				desc: "出生地经度（默认 120，即不做经度校正）",
			},
			{
				name: "city",
				kind: "value",
				value: "北京",
				desc: "用城市名代替 --lng（容错「石家庄市」「石家庄地区」等写法）",
			},
			{
				name: "province",
				kind: "value",
				value: "山东",
				desc: "用省份代替 --lng（按省会计）",
			},
			{ name: "name", kind: "value", value: "张三", desc: "可选，只影响输出抬头" },
		],
	},
	{
		title: "命盘输入（替代整组出生信息；synastry 加 a- / b- 前缀）",
		flags: [
			{
				name: "chart",
				kind: "value",
				value: "/tmp/a.json",
				desc: "读 purplestar-astrology 的 analyze --json 输出，代替该方出生信息",
			},
		],
	},
	{
		title: "输出与选题",
		flags: [
			{ name: "json", kind: "switch", desc: "输出原始 JSON（供程序消费）" },
			{
				name: "liunian",
				kind: "value",
				value: "2027",
				desc: "analyze / topic 指定流年（默认今年）。勿用 --year，那是出生年",
			},
			{
				name: "liuyue",
				kind: "value",
				value: "1-12",
				desc: "analyze / topic 追加该农历月的流月四化（需先有流年）",
			},
			{ name: "focus", kind: "value", value: "财帛", desc: "analyze 额外展开指定宫位" },
			{
				name: "topic",
				kind: "value",
				value: "love",
				desc: "topic 选主题（13 个 key 之一；不带值时列清单）",
			},
			{
				name: "view",
				kind: "value",
				value: "mingpan",
				desc: "topic 展示口径：mingpan / daxian / liunian / liuyue",
			},
			{
				name: "search",
				kind: "value",
				value: "机月同梁",
				desc: "classics / stars / cities 检索关键字（也可用位置参数）",
			},
			{ name: "limit", kind: "value", value: "15", desc: "classics 命中条数上限（正整数）" },
		],
	},
];

/**
 * 声明表里的**全部**旗标名（不含 `--`），跨所有 skill —— 这是全集，不是校验基准。
 *
 * @remarks
 * 与 {@link FLAG_NAMES} 的区别就是作用域。仓库测试用它断言「各 skill 的作用域并起来
 * = 全集」：**每个旗标都必须有归属**，加旗标的人要决定它归谁，否则没人认领的旗标
 * 会静默地从所有 help 里消失（加了却谁也用不上，是比拼错更难发现的一类失败）。
 */
export const ALL_FLAG_NAMES: ReadonlySet<string> = new Set(
	FLAG_GROUPS.flatMap(g => g.flags.map(f => f.name))
);

/**
 * **本 skill** 认的旗标名（不含 `--`）—— {@link parseArgs} 的校验基准。
 *
 * @remarks
 * 直接取自 {@link FLAG_SCOPE}，故它同时是 {@link suggestFlag} 的候选集：
 * 「拼错了？最接近的是……」只会指向本 skill 真有的旗标，不会建议一个传了也没用的。
 */
export const FLAG_NAMES: ReadonlySet<string> = new Set(FLAG_SCOPE.flags);

/**
 * kebab-case → camelCase：**键名换算的唯一一处**。
 *
 * @param name - 旗标名，可带 `synastry` 的 `a-` / `b-` 前缀（如 `"a-late-zi"`）
 * @returns camelCase 形式（`"aLateZi"`）
 *
 * @remarks
 * ⚠️ 这条规则的**来源变了，行为没变**：以前它是「抵消 cac 的归一」（cac 自己就把
 * `--late-zi` 变成 `lateZi`），现在是**本项目自己的约定** —— `parseArgs` 原样返回
 * kebab 键（实测），把 `CliArgs` 的键统一成 camelCase 是本文件主动做的一步。
 * 所以这条注释以前说的是「规则来自引擎」，现在说的是「规则由本仓定义」；
 * 好处是它不再随引擎变动而漂移。
 *
 * 连前缀段一并处理，故调用方只要拼出完整 kebab 名再交给本函数即可。
 * `birth-info.ts` 的 `g(k)` 是全项目唯一按下标读参数的地方（15 个键都从它过），
 * 那边因此只需在拼键时套上本函数，不必逐个改键名。
 */
export function camelKey(name: string): string {
	return name.replace(/-([a-z0-9])/g, (_m: string, c: string) => c.toUpperCase());
}

/**
 * 本 skill 认的出生方前缀（合盘是 `a-` / `b-`，它要分别读两方出生信息）。
 *
 * @remarks
 * 取自 {@link FLAG_SCOPE} —— 不排合盘的 skill 在这里是空数组，于是下面
 * {@link checkFlagName} 的前缀分支与 {@link LEGAL_KEYS} 的前缀展开**整个不可达**，
 * 「前缀」这个概念在那个 skill 里根本不存在。
 *
 * 导出是给 `cli/selftest.ts` 用的：它扫 `SKILL.md` 里提到的旗标，要先剥掉这层前缀
 * 才能与 {@link FLAG_NAMES} 比对 —— 前缀表不该有第二份。
 */
export const SIDE_PREFIXES: readonly string[] = FLAG_SCOPE.sidePrefixes;

/**
 * 旗标名 → 声明（**全集**，未按作用域过滤）。
 *
 * @remarks
 * 前置扫描要用它区分「这个旗标吃不吃值」（见 {@link parseArgs} 的 ②）。
 * 查表必然命中：调用点只在前置扫描里，而那里在此之前已经过 {@link checkFlagName}，
 * 拿到的是 {@link FLAG_NAMES} 里的名字，必是全集的一员。
 */
const FLAG_BY_NAME: ReadonlyMap<string, FlagSpec> = new Map(
	FLAG_GROUPS.flatMap(g => g.flags.map(f => [f.name, f] as const))
);

/**
 * 交给 `parseArgs` 的选项表 —— 从 {@link FLAG_GROUPS} **算出来**，不手写第二份。
 *
 * @remarks
 * 这是作用域收窄在**引擎**这一侧的实现：不在 {@link FLAG_NAMES} 里的旗标不声明，
 * 于是 `strict: true` 下它们会被引擎拒绝 —— 与 {@link checkFlagName} 的结论一致，
 * 只是兜底的第二道门（第一道在前置扫描，它给的是中文 + 最近邻建议）。
 *
 * ⚠️ **`kind: "value"` 一律映射成 `type: "string"`，即值必填**。`parseArgs` 只有
 * 「必填值」与「不吃值」两态，没有 cac 那种「可选值」（裸写给布尔 `true`）的形态。
 * 裸写的取值旗标因此由**前置扫描**给中文报错，见 {@link parseArgs} 的 ② ——
 * 这不是行为变更：`SKILL.md` 早就承诺「写了 `--limit` 却没跟值会被明确拒绝」，
 * 以前由各命令自己的取值校验兑现，现在提前到解析层，两处都保留。
 *
 * ⚠️ **刻意不给 `default`**：给了之后未出现的选项也会进 `values`，
 * 破坏调用方「`undefined` 即未给出」的判空（`cmdClassics` 的 `--limit` 就靠它取默认值）。
 */
const OPTIONS: Readonly<Record<string, { type: "string" | "boolean" }>> = (() => {
	const table: Record<string, { type: "string" | "boolean" }> = {};
	for (const group of FLAG_GROUPS) {
		for (const flag of group.flags) {
			// ⚠️ 作用域外的旗标**不声明**。这一句同时管两件事：help 的参数段只列本 skill
			//    认的旗标（{@link renderHelp} 遍历的是同一份 FLAG_NAMES），引擎也只接受它们。
			if (!FLAG_NAMES.has(flag.name)) continue;
			const type = flag.kind === "value" ? "string" : "boolean";
			table[flag.name] = { type };
			// 前缀旗标同样声明（合盘的 `--a-chart`）；不收前缀的 skill 里 SIDE_PREFIXES
			// 是空数组，这一步自然什么都不做。
			for (const prefix of SIDE_PREFIXES) table[prefix + flag.name] = { type };
		}
	}
	return table;
})();

/**
 * 编辑距离：把 `a` 改成 `b` 至少几步。只用于「拼错了？最接近的是……」这句提示，
 * 故实现取最朴素的滚动数组版本，不追求性能。
 */
function editDistance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
			cur[j] = Math.min(sub, prev[j] + 1, cur[j - 1] + 1);
		}
		prev = cur;
	}
	return prev[b.length];
}

/**
 * 在合法旗标名里找与 `name` 最接近的一个。
 *
 * @param name - 用户实际敲的旗标名（不含 `--`）
 * @returns 编辑距离 ≤ 2 的最近者；都不够近则 `null`
 *
 * @remarks
 * 阈值取 2 是权衡：`ctiy` → `city` 距离 2（换位算 2 步），要抓；
 * 再放宽就会开始乱建议（`view` 会指到 `name`），反而把提示变成噪声。
 */
export function suggestFlag(name: string): string | null {
	let best: string | null = null;
	let bestD = 3;
	for (const n of FLAG_NAMES) {
		const d = editDistance(name, n);
		if (d < bestD) {
			bestD = d;
			best = n;
		}
	}
	return best;
}

/**
 * 校验旗标名，不合法即抛错。
 *
 * @param key - 已剥掉 `--` 的旗标名
 * @param command - 当前命令名；接受前缀的那几条由 {@link FlagScope.prefixedCommands} 声明
 * @returns 剥掉出生方前缀后的**裸旗标名**（无前缀时即 `key` 本身）。调用方靠它查
 *   {@link FLAG_BY_NAME}，免得前缀剥法有第二份
 *
 * @remarks
 * 三条规则各挡一种**静默失败**，都是本文件顶部注释里那两类错盘的入口：
 *
 * 1. 名字不在 {@link FLAG_NAMES}：拼错。以前照收不误，`buildBirthInfo` 读不到就读不到，
 *    直接落回默认值排出一张错盘。此处报错并给出最近的名字。
 * 2. `a-` / `b-` 前缀出现在不收它的命令上：那里读的是不带前缀的名字，带前缀的写法会被
 *    整个忽略（`analyze --a-city 北京` 排的是默认经度的盘）。
 * 3. 前缀后面接的仍必须是声明过的名字：`--a-ctiy` 同样要抓。
 *
 * ⚠️ 刻意**不**校验「这个旗标属于这个命令」：`--json` 给 `classics` 是无害的多余参数，
 * 而把归属做成硬约束会让每条命令的合法集合成为第二个需要维护的真相 —— 拼错才是要挡的，
 * 归属错了顶多是没生效，不会排错盘。
 *
 * ⚠️ 但规则 2 **必须带「命令」这一维**（{@link FlagScope.prefixedCommands}），不能只按 skill
 * 收窄：若只看「本 skill 认 `a-` 前缀」就放行，`selftest --a-chart` 会从「报错」退化成
 * 「静默忽略」—— 既违反「宁可报错，不静默」，又会让合盘 selftest 里那条断言直接变红。
 */
function checkFlagName(key: string, command: string | undefined): string {
	const prefix = SIDE_PREFIXES.find(p => key.startsWith(p));
	if (prefix) {
		// 前缀只在作用域声明的那几条命令上合法（合盘是 synastry）。判据取自 FLAG_SCOPE，
		// 不写死命令名 —— 「哪条命令要分别读两方」本就是该 skill 自决的事。
		if (command === undefined || !FLAG_SCOPE.prefixedCommands.includes(command)) {
			throw new Error(
				`--${key}：\`${prefix}\` 前缀只有 ${FLAG_SCOPE.prefixedCommands.join(" / ")} 命令认` +
					`（它要分别读 ${SIDE_PREFIXES.join(" / ")} 两方）。` +
					`${command ? `当前命令是 ${command}，` : ""}请改用 --${key.slice(prefix.length)}。`
			);
		}
		return checkFlagName(key.slice(prefix.length), command);
	}
	if (FLAG_NAMES.has(key)) return key;
	const hint = suggestFlag(key);
	throw new Error(
		`未知参数 --${key}。${hint ? `最接近的是 --${hint}。` : ""}运行 help 查看全部参数。`
	);
}

/**
 * 把引擎抛出的英文错误翻成中文。
 *
 * @param err - `parseArgs` 抛出的错误
 * @returns 中文提示（不含栈）
 *
 * @remarks
 * 前置扫描是第一道门，正常情况下引擎不会抛 —— 但它仍是**必须有的兜底**：
 * `--json=true`（开关带等号）这类写法前置扫描没有理由拦，而 `strict: true` 下引擎
 * 会以英文抛错。放一句英文到用户面前不符合本仓口径。
 *
 * 判据是 `err.code` 而**不是**去解析英文 message 取旗标名 —— 文案会变，错误码是 API。
 * 取不到旗标名就不要猜，给一句能指路的话即可。
 */
function translateParseError(err: unknown): string {
	const code = (err as { code?: string }).code;
	if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") return "未知参数。运行 help 查看全部参数。";
	if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE")
		return "某个参数的值不合法（取值旗标要写值，开关旗标不能带值）。运行 help 查看全部参数。";
	return `参数解析失败：${(err as Error).message}`;
}

/**
 * 参数解析：`--key value` / `--flag`。
 *
 * @param argv - 待解析的参数数组（引导层传入的是 `process.argv.slice(2)` 去掉命令名之后的部分）
 * @param command - 当前命令名。给了就**校验旗标名**（见 {@link checkFlagName}），
 *   未知或错位的前缀旗标一律抛错而非静默忽略
 * @returns 参数表；`--flag` 后无值时存为布尔 `true`
 *
 * @remarks
 * 三步：**前置扫描 → 引擎分词 → 归一**。
 *
 * ### ① 前置扫描：中文报错 + 最近邻建议 + 等号式归一
 *
 * 引擎在 `strict: true` 下也会拒绝未知选项，但它抛的是**英文且无最近邻建议**（实测），
 * 而「拼错旗标不报错」正是文件头那类静默错盘的入口 —— 故这道中文门一个字都不能少。
 * 它**不修改**传入的 `argv`，而是另建一份归一后的数组交给引擎。
 *
 * 扫描途中做两件引擎做不到的事：
 *
 * - **取值旗标后没有值** → 抛中文错并点名该旗标。引擎会抛「argument missing」的英文；
 *   而本仓的 `SKILL.md` 早就承诺「写了 `--limit` 却没跟值会被明确拒绝」，见
 *   {@link OPTIONS} 的 ⚠️。
 * - **把 `--key value` 改写成 `--key=value`**。这不是洁癖：实测 `--limit -3` 直接喂给
 *   引擎会被判「argument is ambiguous」而**丢掉值**（`cac` 那边同样丢，只是方式不同），
 *   于是 `--limit -3` 到不了命令层的中文取值校验，用户看到的是英文错。改写之后
 *   `-3` 原样到达，由命令层给出「`--limit` 需为正整数」。顺带修掉「以 `-` 开头的值
 *   拿不到」（`--search -foo`）这个固有缺陷。
 *
 * 判据一律取自 {@link FLAG_BY_NAME} 的 `kind`，不按「下一个 token 长什么样」猜。
 *
 * ### ② 引擎分词
 *
 * `--key=value` / `--key value` / `--flag` / `--` 分隔符 / 重复选项取末值，全部交给
 * `node:util` 的 `parseArgs`。`allowPositionals: true` **必须显式开** —— 本 skill 的
 * `classics` 接受位置参数形式的检索词，默认 `false` 会让它抛错。
 *
 * ### ③ 归一
 *
 * 引擎原样返回 kebab 键，这里用 {@link camelKey} 换成本项目的 camelCase 约定，
 * 并用 {@link LEGAL_KEYS} 看门。未给出的选项根本不进 `values`（实测），
 * 故无须过滤 —— 「`undefined` 即未给出」的判空天然成立。
 *
 * `command` 省略即退回「照单全收」的宽松解析 —— 供不关心旗标面、只想拿个参数表的
 * 调用方（如 `test/` 里构造输入的小工具）使用。宽松模式下前置扫描与键名看门人都不生效，
 * 但键名归一（camelCase）仍在，键名形态与严格模式一致。
 */
export function parseArgs(argv: string[], command?: string): CliArgs {
	// ① 前置扫描：中文报错 + 最近邻建议 + 把 `--key value` 归一成 `--key=value`
	const normalized: string[] = [...argv];
	if (command !== undefined) {
		const out: string[] = [];
		for (let i = 0; i < argv.length; i++) {
			const a = argv[i];
			// `--` 是位置参数分隔符：它之后的一切都原样交给引擎（引擎会全放进 positionals），
			// 不再当旗标校验，也不做等号式改写。
			if (a === "--") {
				out.push(a, ...argv.slice(i + 1));
				break;
			}
			if (!a.startsWith("--")) {
				// `-` 单独出现是「stdin」的传统写法，不当短选项；其余 `-x` 一律拒绝：
				// 本项目没有任何短选项，而引擎会把 `-x` 报成「未知选项」的英文。
				if (a.startsWith("-") && a !== "-")
					throw new Error(
						`未知参数 ${a}。本项目只有 --xxx 长旗标形式。运行 help 查看全部参数。`
					);
				out.push(a);
				continue;
			}
			// `--key=value` 等号式：旗标名只到 `=` 为止，值在同一 token 内
			const eq = a.indexOf("=");
			const key = eq < 0 ? a.slice(2) : a.slice(2, eq);
			const bare = checkFlagName(key, command);
			if (eq >= 0) {
				out.push(a);
				continue;
			}
			// 开关不吃值，下一个 token 是它自己的事（可能正是位置参数）。
			const spec = FLAG_BY_NAME.get(bare);
			if (spec?.kind !== "value") {
				out.push(a);
				continue;
			}
			const next: string | undefined = argv[i + 1];
			// 值不会以 `--` 开头（`--limit --json` 里的 `--json` 是另一个旗标，不是值）。
			// `-3` 这类以单 `-` 开头的**是**合法值，故只挡双横线。
			if (next === undefined || next.startsWith("--"))
				throw new Error(
					`--${key} 需要一个值${spec.value ? `（如 --${key} ${spec.value}）` : ""}。` +
						`运行 help 查看全部参数。`
				);
			out.push(`${a}=${next}`);
			i++;
		}
		normalized.length = 0;
		normalized.push(...out);
	}

	// ② 分词交给引擎。`args` 直接给 argv —— 不像 cac 那样需要补 `[node, 脚本名]` 的假前缀。
	let values: Readonly<Record<string, string | boolean | (string | boolean)[] | undefined>>;
	let positionals: readonly string[];
	try {
		const parsed = parseNodeArgs({
			args: normalized,
			options: OPTIONS,
			allowPositionals: true,
			strict: true,
		});
		values = parsed.values;
		positionals = parsed.positionals;
	} catch (err) {
		throw new Error(translateParseError(err));
	}

	// ③ 归一：把引擎的形状搬回 CliArgs 的形状
	const args: CliArgs = { _: [...positionals] };
	for (const [key, raw] of Object.entries(values)) {
		// 未给出的选项根本不进 values（实测）；`undefined` 分支是类型上的可能性，不是运行时的。
		if (raw === undefined) continue;
		// 本项目没有任何旗标声明 `multiple`，故数组分支不可达。真出现了说明 OPTIONS 被人
		// 加了 `multiple` —— 那是静默丢值，宁可在这里炸掉。
		if (Array.isArray(raw))
			throw new Error(`参数 --${key} 被解析成多个值（声明表不该有 multiple）。`);
		const camel = camelKey(key);
		// 看门人：`LEGAL_KEYS` 由 camelKey 从声明表派生。`strict: true` 下引擎返回的键
		// 必然是声明过的，但 kebab→camel 的换算仍是本文件自己的约定 —— 换算写错
		// （规则变了、键名对不上）在这里抛错，否则 `birth-info.ts` 会读不到值、
		// 静默落回默认经度排出错盘，正是文件头那类失败。
		if (command !== undefined && !LEGAL_KEYS.has(camel))
			throw new Error(
				`参数 --${key} 归一后得到键名 \`${camel}\`，不在声明表里。` +
					`若键名约定有变，需同步 camelKey。运行 help 查看全部参数。`
			);
		args[camel] = raw;
	}
	return args;
}

/**
 * 引擎归一后**可能出现的全部合法键**（camelCase），归一化时充当键名规则的看门人
 * （见 {@link parseArgs} 的 ③）。
 *
 * @remarks
 * 两部分：无前缀的键，以及 {@link SIDE_PREFIXES} 声明的出生方前缀键（`--a-city` → `aCity`）。
 * 前缀键**一律收进集合**，不按命令过滤 —— 该不该用是 {@link checkFlagName} 按命令判的，
 * 这里只管「这个键的形状是不是我方声明表能产出的」。不收前缀的 skill 里
 * {@link SIDE_PREFIXES} 是空数组，这一步自动退化成「只有无前缀键」。
 */
const LEGAL_KEYS: ReadonlySet<string> = new Set([
	...[...FLAG_NAMES].map(camelKey),
	...SIDE_PREFIXES.flatMap(p => [...FLAG_NAMES].map(n => camelKey(p + n))),
]);

// ── HELP 渲染：引擎不提供帮助设施，故由本文件从声明表渲染 ──────────

/**
 * 字符串在等宽终端里占的列数：CJK / 全角字符算 2 列，其余算 1 列。
 *
 * @remarks
 * 只为 help 的对齐服务。用 `String.length` 会在含中文的旗标名
 * （`--search <机月同梁>`）上把描述列推歪 —— 那是**看得见**的排版缺陷，
 * 故值得这几行。区间取常见的几段（CJK 部首 / 假名 / 统一表意文字 / 全角形式 /
 * 谚文），不求 Unicode 宽度表的完整实现：本文件的旗标名与值域占位只可能出现这些字符。
 */
function displayWidth(s: string): number {
	let width = 0;
	for (const ch of s) {
		const c = ch.codePointAt(0) ?? 0;
		const wide =
			(c >= 0x1100 && c <= 0x115f) ||
			(c >= 0x2e80 && c <= 0xa4cf) ||
			(c >= 0xac00 && c <= 0xd7a3) ||
			(c >= 0xf900 && c <= 0xfaff) ||
			(c >= 0xfe30 && c <= 0xfe6f) ||
			(c >= 0xff00 && c <= 0xff60) ||
			(c >= 0xffe0 && c <= 0xffe6);
		width += wide ? 2 : 1;
	}
	return width;
}

/**
 * 渲染整份 HELP 文本（`Usage:` / `Commands:` / `Options:` 三段 + 调用方给的追加段）。
 *
 * @param opts - 首行说明、命令表（`COMMAND_DESC`）、追加段
 * @returns 已排好版的完整帮助文本（不含尾随换行）
 *
 * @remarks
 * ⚠️ **引擎不提供任何 help 设施**（`cac` 有 `cli.help` / `cli.outputHelp`，
 * `parseArgs` 没有对应物），故版式由本仓负责。这换来一件好事：整份 help 是
 * {@link FLAG_GROUPS} 与 `COMMAND_DESC` 的**纯函数** —— 参数段与命令段各只有一个真相，
 * 且都自动继承作用域收窄（参数段只遍历 {@link FLAG_NAMES}）。
 *
 * 命令表**作为入参**传入而不是 import 进来：`commands.ts` 依赖本文件，反向 import 会成环。
 *
 * `-h, --help` 那一行由本函数统一给出 —— 每个 skill 的引导层都在解析之前拦下
 * `-h` / `--help`（它们到不了 {@link parseArgs}），故这行与各 skill 的命令集无关。
 */
export function renderHelp(opts: {
	head: string;
	commands: Readonly<Record<string, string>>;
	notes?: readonly { title: string; body: string }[];
}): string {
	const lines: string[] = [opts.head, "", "Usage:", "  $ purple-star <command> [options]"];
	const names = Object.keys(opts.commands);

	if (names.length) {
		lines.push("", "Commands:");
		const w = Math.max(...names.map(displayWidth)) + 2;
		for (const n of names) lines.push(`  ${n.padEnd(w)}${opts.commands[n]}`);
		lines.push(
			"",
			"For more info, run any command with the `--help` flag:",
			...names.map(n => `  $ purple-star ${n} --help`)
		);
	}

	// 参数段：只列本 skill 认的旗标（作用域收窄），并按声明表的分组显示标题。
	// 先算出描述列的绝对位置，再让分组内的缩进与 `-h, --help` 那一行对齐。
	const flagLines = FLAG_GROUPS.map(group => ({
		title: group.title,
		flags: group.flags.filter(f => FLAG_NAMES.has(f.name)),
	})).filter(g => g.flags.length);
	const label = (f: FlagSpec) => (f.kind === "value" ? `--${f.name} <${f.value ?? "值"}>` : `--${f.name}`);
	const HELP_OPTION = "-h, --help";
	const column =
		4 + Math.max(displayWidth(HELP_OPTION), ...flagLines.flatMap(g => g.flags.map(f => displayWidth(label(f))))) + 2;
	const row = (indent: number, name: string, desc: string) =>
		" ".repeat(indent) + name + " ".repeat(Math.max(1, column - indent - displayWidth(name))) + desc;

	lines.push("", "Options:");
	for (const g of flagLines) {
		lines.push(`  ${g.title}`);
		for (const f of g.flags) lines.push(row(4, label(f), FLAG_SCOPE.descOverrides?.[f.name] ?? f.desc));
	}
	lines.push(row(2, HELP_OPTION, "Display this message"));

	for (const note of opts.notes ?? []) lines.push("", `${note.title}:`, note.body);
	return lines.join("\n");
}

/**
 * 运行期上下文：只有引导层才知道的东西。
 *
 * 目前仅 selftest 用得上（它要在输出里交代「排这张盘用的是哪一份内核」），
 * 但类型在此统一，免得将来再多一个命令时又改一遍所有签名。
 */
export interface CliContext {
	/** 实际生效的内核根目录（已解析为绝对路径） */
	root: string;
	/** 该根目录的来源描述，如「技能自带内核」「ZIWEI_ROOT 环境变量」 */
	rootLabel: string;
}
