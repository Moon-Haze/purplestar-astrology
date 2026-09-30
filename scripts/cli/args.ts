/**
 * CLI 参数面 —— 旗标声明表 + 校验 + 解析（cac 驱动）+ 帮助渲染。不依赖任何内核模块，
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
 *    不要在 purple-star.ts 顶部用静态 `import` 引它 —— 钩子未注册时解析会失败。
 *    也正因如此，`cac` 这个裸包名的静态 `import` 落在**本文件**（此处静态 import 是允许的），
 *    引导层只通过 `load<ArgsModule>()` 拿 {@link cli} 引用。
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
 * cac 据它注册选项并渲染 help 参数段、`SKILL.md` 则由 `selftest` 断言兜底。
 *
 * ## 解析为什么是 cac 驱动、而校验为什么还得自己做
 *
 * 分词（`--key value` / `--flag` / `--` 分隔符 / 重复选项归并）交给 `cac`；
 * 但 **cac 对未注册的选项是静默收下的**（连 `run: false` 也不校验），
 * 而「拼错旗标不报错」恰恰就是上面那个错盘入口 —— 所以 {@link checkFlagName}
 * 那套校验一个字都不能少，只是执行时机挪到了 cac 之前（见 {@link parseArgs}）。
 *
 * ⚠️ **键名是 camelCase**：cac 把 `--late-zi` 归一成 `lateZi`、`--a-late-zi` 归一成 `aLateZi`。
 *    换算只有 {@link camelKey} 一处，`FLAG_GROUPS` 里的 `name` 仍写 kebab
 *    （它同时是用户敲的名字、help 的显示名、`SKILL.md` 写的名字）。
 */

import { cac } from "cac";

// ⚠️ 本文件是**全仓唯一**的一份参数解析骨架（2026-09-27 起）：它曾经同步给两个派生 skill，
//    那两个在本次改造中断开派生关系，各写各的轻量解析循环（声明表 + 解析 + help 内联在各自的
//    `purple-star.ts` 里）—— 它们各自只认两三个旗标，不值得这份 350 行的实测行为骨架。
//    于是「共享全量表 → 收窄成本 skill」这层适配器在本仓只剩源这一份消费者，
//    `./flag-scope` 也不再是「各 skill 自写的那一层差异」，而是一处**已知的遗留冗余**
//    （`FLAG_GROUPS` 是全量、`FLAG_SCOPE` 也是全量）。留在原处是因为动它要连带改下面四个
//    收窄点与 `cli/selftest.ts`，收益只是删一个文件。
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
 * ⚠️ **键是 camelCase**（`late-zi` → `lateZi`、`a-chart` → `aChart`）—— 这是 cac 的归一规则。
 * 换算只有 {@link camelKey} 一处；按下标读参数的地方（`birth-info.ts` 的 `g()`）必须经它拼键。
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
 * ⚠️ `title` **不进 HELP**：cac 渲染的参数段是所有**已注册 option 的平铺列表**，不带分组。
 * 它是给读声明表的人看的分类，外加承载一句只有此处可写的口径提示（「三选一」「二选一」）。
 * 想改 help 里能看到的东西，只有 {@link FlagSpec.desc} 一条路（经 `cli.option` 交给 cac）。
 */
export interface FlagGroup {
	title: string;
	flags: readonly FlagSpec[];
}

/**
 * 本 skill 的**旗标作用域** —— 声明「声明表里那些旗标中，本 skill 认哪些」。
 *
 * @remarks
 * 本文件静态 import 它。**它如今只有源这一个消费者，且写的是全量**（见上方文件头的说明）——
 * 收窄能力仍在（下面四个收窄点都还生效），只是没有第二个 skill 需要被收窄。
 * 声明是**裸旗标名的正面清单**，不按「本 skill 认哪些命令」派生 —— 那会重建本文件
 * 刻意不维护的「旗标属于哪个命令」归属表（见 {@link checkFlagName} 的 ⚠️）。
 * 正面清单还有个好处：**fail-closed** —— 往 {@link FLAG_GROUPS} 加一个新旗标，
 * 它不会自动泄漏给没声明它的 skill，加的人必须决定它归谁。
 *
 * 收窄只发生在四个点上，全在本文件内：cac 的选项注册（HELP 的参数段由**已注册的
 * option** 渲染，故过滤这里 = help 自动收窄）、{@link FLAG_NAMES}（校验基准与
 * {@link suggestFlag} 的候选集）、{@link SIDE_PREFIXES}、{@link LEGAL_KEYS}。
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
 * 分组标题里的「三选一」「二选一」是**口径**而非装饰：`buildBirthInfo` 对
 * `--date` / `--lunar` / `--year+--month+--day` 与 `--time` / `--branch` 各取其一，
 * 同时给出时按该处的优先级静默择一 —— 这条规则只有写在这里才有人看得见。
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
		title: "analyze 专题深入（可叠加；不带任何专题旗标时只出精简概览）",
		flags: [
			{ name: "info", kind: "switch", desc: "基本信息专题（四柱 / 命主身主 / 斗君 / 五行局）" },
			{ name: "geju", kind: "switch", desc: "格局识别专题（格局判词 / 成立与破格条件 / 出处）" },
			{
				name: "sihua",
				kind: "switch",
				desc: "四化专题（生年 / 流年 / 流月四化落宫与叠宫）",
			},
			{
				name: "daxian",
				kind: "value",
				value: "[虚岁]",
				desc: "大限专题（十年大运时间轴 + 指定岁所在限的三方四正深入；缺省 = 当前虚岁）",
			},
			{
				name: "xiaoxian",
				kind: "value",
				value: "[虚岁]",
				desc: "小限专题（指定岁小限宫 + 十二宫小限岁数表；缺省 = 当前虚岁）",
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
 * 规则来自 cac 的归一行为（实测）：它把 `--late-zi` 变成 `lateZi`、`--a-late-zi` 变成
 * `aLateZi` —— **连前缀段一并处理**，所以调用方只要拼出完整 kebab 名再交给本函数即可。
 *
 * `birth-info.ts` 的 `g(k)` 是全项目唯一按下标读参数的地方（15 个键都从它过），
 * 那边因此只需在拼键时套上本函数，不必逐个改键名。
 */
export function camelKey(name: string): string {
	return name.replace(/-([a-z0-9])/g, (_m: string, c: string) => c.toUpperCase());
}

/**
 * cac 实例 —— 分词与 help 的引擎。
 *
 * @remarks
 * 全部旗标注册为**全局选项**（而非逐命令注册）：本项目刻意不校验「旗标属于哪个命令」
 * （见 {@link checkFlagName} 的 ⚠️），全局注册正与之同构，`a-` / `b-` 前缀旗标也只需声明一次。
 *
 * 注册形态**按 {@link FlagSpec.kind} 分两种**，与声明表的语义对齐：
 * - `"value"` → `--name [值域]`：可选值形态，实测无值时给布尔 `true`
 *   （必填的 `<值域>` 形态会让 cac 抢在自己报错前退出，绕开本文件的中文提示）。
 * - `"switch"` → `--name`：纯布尔，实测**不吃**后面的位置参数。
 *   此前手写解析器不区分 kind、一律吃值，`classics --json 机月同梁` 会把检索词吃进
 *   `json` 而让 `_` 空掉 —— 那是静默失败，不是需要保住的行为。
 *
 * ⚠️ 刻意**不**给 `default`：给了之后未出现的参数也会进 options，
 * 破坏调用方「`undefined` 即未给出」的判空（`cmdClassics` 的 `--limit` 等就靠它取默认值）。
 *
 * 引导层拿它注册命令与 help（见 `purple-star.ts` 的 `main()`）——
 * `cac` 的静态 import 必须留在本文件，理由见文件头注释。
 */
const cli = cac("purple-star");
for (const group of FLAG_GROUPS) {
	for (const flag of group.flags) {
		// ⚠️ 作用域外的旗标**不注册** —— 这一句就是「help 只列本 skill 认的旗标」的全部实现：
		//    cac 渲染的参数段取自**已注册的 option**，不注册即不出现，不必去改 purple-star.ts
		//    的 help 段（它只是往 cac 的输出上追加两段领域知识）。
		if (!FLAG_NAMES.has(flag.name)) continue;
		cli.option(
			flag.kind === "value" ? `--${flag.name} [${flag.value ?? "值"}]` : `--${flag.name}`,
			FLAG_SCOPE.descOverrides?.[flag.name] ?? flag.desc
		);
	}
}

export { cli };

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
function checkFlagName(key: string, command: string | undefined): void {
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
		checkFlagName(key.slice(prefix.length), command);
		return;
	}
	if (FLAG_NAMES.has(key)) return;
	const hint = suggestFlag(key);
	throw new Error(
		`未知参数 --${key}。${hint ? `最接近的是 --${hint}。` : ""}运行 help 查看全部参数。`
	);
}

/**
 * cac 归一后**可能出现的全部合法键**（camelCase），归一化时充当键名规则的看门人
 * （见 {@link parseArgs}）。
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

/**
 * 把 cac 给出的值归一成 {@link CliArgs} 的两种形态。
 *
 * @remarks
 * cac 的值有三种形态，与原手写解析器都不同，逐个搬回来：
 * - **数组**：同一选项重复给出时 cac 会累积。取**末值**，与原实现的「后值覆盖」一致。
 * - **数字**：cac 会把纯数字转成 `number`。一律 `String()` 还原 —— 本项目所有取值方
 *   （`buildBirthInfo` 的 `g()`）都按字符串走，给个数字会让 `=== true` 之类的判断错位。
 *   ⚠️ 这一步**不可逆**：`--search 007` 到不了这里就已经是数字 `7`，前导零丢了。
 * - **布尔** `true`：开关无值时的形态，原样保留（调用方判空时要考虑它）。
 */
function normalizeValue(raw: unknown): string | boolean {
	if (Array.isArray(raw)) return String(raw[raw.length - 1]);
	if (typeof raw === "boolean") return raw;
	return String(raw);
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
 * 三步：**前置校验 → cac 分词 → 归一**。分词（`--key value` / `--flag` / `--` 分隔符 /
 * 重复选项归并 / `--key=value` 等号式）全部交给 cac，本函数只负责它不管的那两件事。
 *
 * ⚠️ **校验必须在 cac 之前自己做**：cac 对未注册的选项是**静默收下**的（实测连
 * `run: false` 也不校验），而「拼错旗标不报错」正是文件头那类静默错盘的入口。
 * 扫描会连带吃掉 `--key value` 里的 value（判据同原来：值不会以 `--` 开头），
 * 免得把值误当成旗标名；等号式 `--key=value` 的值在同一 token 内，另行切分。
 *
 * ⚠️ 同一参数重复给出时取**末值**（cac 给数组，{@link normalizeValue} 取最后一项），
 * 与原实现的「后值覆盖」一致；不带值的开关存布尔 `true`。两者都是调用方判空时
 * 需要考虑的形态。
 *
 * `command` 省略即退回「照单全收」的宽松解析 —— 供不关心旗标面、只想拿个参数表的
 * 调用方（如 `test/` 里构造输入的小工具）使用。宽松模式下前置校验与键名看门人都不生效，
 * 但 cac 的归一（camelCase 键、数字转字符串、重复取末值）仍在，键名形态与严格模式一致。
 */
export function parseArgs(argv: string[], command?: string): CliArgs {
	// ① 前置校验：cac 静默收下未知选项，只有这里能拦住拼错
	if (command !== undefined) {
		for (let i = 0; i < argv.length; i++) {
			const a = argv[i];
			if (a.startsWith("--")) {
				// `--key=value` 等号式：旗标名只到 `=` 为止，值在同一 token 内
				const eq = a.indexOf("=");
				const key = eq < 0 ? a.slice(2) : a.slice(2, eq);
				checkFlagName(key, command);
				if (eq >= 0) continue;
				// 与 cac 一样吃掉「--key value」里的 value（判据同原解析器：值不会以 `--` 开头）。
				// ⚠️ `-3` 这类也在此被吃掉，但它到了 cac 手里会被当成短选项，取值反而丢掉
				//（mri 的固有行为，注册方式规避不了）。取值丢失由各命令自己的取值校验兜住
				//（如 `cmdClassics` 把布尔 `true` 判为非法），残影键则在归一化时滤掉。
				const next: string | undefined = argv[i + 1];
				if (next !== undefined && !next.startsWith("--")) i++;
			}
			// `-` 单独出现是「stdin」的传统写法，不当短选项；其余 `-x` 一律拒绝：
			// cac 会把它收成 `options.x` 这种凭空多出来的键，而本项目没有任何短选项。
			else if (a.startsWith("-") && a !== "-")
				throw new Error(
					`未知参数 ${a}。本项目只有 --xxx 长旗标形式。运行 help 查看全部参数。`
				);
		}
	}

	// ② 分词交给 cac：首两元素是它期望的 [node, 脚本名]（它内部 argv.slice(2)）
	const parsed = cli.parse(["node", "purple-star", ...argv], { run: false });

	// ③ 归一：把 cac 的形状搬回 CliArgs 的形状
	const args: CliArgs = { _: [...parsed.args] };
	for (const [key, raw] of Object.entries(parsed.options)) {
		// cac 恒带一个 `"--"` 键（`--` 分隔符之后的内容；没写 `--` 时是空数组）。
		// 真写了 `--` 的输入在前置校验里已被 `checkFlagName("")` 挡下，此处只需跳过它。
		if (key === "--") continue;
		// 短选项残影：cac/mri 把 `--limit -3` 的 `-3` 收成键 `3`（`-abc` 则拆成 a/b/c）。
		// 本项目既无短选项也无单字符旗标（见 {@link FLAG_GROUPS}），故单字符键必然是这类残影。
		if (key.length === 1) continue;
		// 看门人：`LEGAL_KEYS` 由 camelKey 从声明表派生，cac 的归一结果若与它不符
		// （规则变了、键名对不上），在这里抛错 —— 否则 `birth-info.ts` 会读不到值、
		// 静默落回默认经度排出错盘，正是文件头那类失败。它也顺手挡下短选项造出的键。
		if (command !== undefined && !LEGAL_KEYS.has(key))
			throw new Error(
				`参数 --${key} 的键名不在声明表里（cac 归一后为 \`${key}\`）。` +
					`若 cac 的键名规则有变，需同步 camelKey。运行 help 查看全部参数。`
			);
		args[key] = normalizeValue(raw);
	}
	return args;
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
