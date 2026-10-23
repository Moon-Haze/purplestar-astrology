/**
 * CLI 参数声明面 —— 「有哪些参数」的唯一定义处（纯数据，零依赖）。
 *
 * 三层分工：本文件管**声明了什么**、`./scope` 管**本 skill 认哪些**、`./parse` 管**怎么解析**。
 *
 * ⚠️ **键名是 camelCase**（`late-zi` → `lateZi`），换算只有 {@link camelKey} 一处，
 *    而 `name` 仍写 kebab（它同时是用户敲的名字、help 的显示名）。
 * ⚠️ 本文件由引导层在 `registerHooks` **之后**经 `./parse` 间接加载 —— 不要在
 *    purple-star.ts 顶部用静态 `import` 引它（钩子未注册时解析会失败）。
 *    声明表的来历与各套派生的论证见 docs/code/cli-args.md。
 */

/**
 * 一个参数的完整声明。
 *
 * @remarks
 * 界面刻意只留四格 `name / kind / value / desc` —— 声明表要能被一眼扫完（见
 * docs/code/cli-args.md）。其余语义标志见下方字段。
 */
export interface OptionSpec {
	/** 参数名，不含 `--`。`synastry` 可用 `a-` / `b-` 前缀叠在它前面（如 `--a-chart`） */
	name: string;
	/** `"value"` 取值、`"switch"` 纯开关（help 据此决定写不写值域占位） */
	kind: "value" | "switch";
	/** 值域占位，如 `"YYYY-MM-DD"`；`kind: "switch"` 时不给 */
	value?: string;
	/**
	 * 可选值形态：裸开关（不带值）**合法**，由命令侧取缺省（`--yearly` = 当年）或
	 * 列清单（`--topic`）。help 据此把值域显示成 `<[x]>`；不标注即必值，末尾缺值
	 * 会以「需要一个值」被命令侧指路。
	 */
	optionalValue?: boolean;
	/** 一行说明，即 help 里那一行的描述列 */
	desc: string;
	// ── 语义标志（候选 2）：四套派生的真相源，均可选、缺省即「不属于」 ──
	/** 可被独占分支吞掉（输出与选题组的 yearly / monthly / focus / topic / report） */
	shadow?: true;
	/** 显式排除出可吞集合（专题深入组的 palaces —— 它自身就是独占参数） */
	noShadow?: true;
	/** 专题深入旗标（pattern / mutagen / yearly / decadal / ages / focus）——
	 *  深入态基底显隐的判据（旧 astrology 里硬编码的 deepDive 六旗标） */
	deep?: true;
	/** 排除出「输出意图」判据（info 是零输入演示目标本身；config 是参数来源而非输出形态） */
	noIntent?: true;
	// ── 归属标志（候选 4）：help 归属投影的真相源，取代 help.ts 手抄 OPTION_OWNERSHIP ──
	/** 读取本参数的命令（kebab 主名）；help 的每命令 OPTIONS 节据此过滤 */
	cmds?: readonly string[];
	/** 全局参数（任意命令可用）—— 不进任何命令的专属列表，help 在节尾单列一行 */
	global?: true;
}

/**
 * 选项组的语义角色（候选 2）—— 四套派生（shadow / birth / intent / deep）与优先级链
 * 全部从 role + 参数标志投影，不再按中文 title 的 `startsWith` 反推。
 */
export type GroupRole = "birth" | "topic-deep" | "output-select" | "other";

/** 一组参数（`title` 是给读声明表的人看的分类，不进 help 参数段；`role` 是派生用的语义角色）。 */
export interface OptionGroup {
	title: string;
	/** 语义角色：出生信息三组 → `birth`；专题深入 → `topic-deep`；输出与选题 → `output-select`；其余 → `other` */
	role: GroupRole;
	options: readonly OptionSpec[];
}

/**
 * 全部参数（英文主名），按 help 的展示顺序分组。
 *
 * @remarks
 * 专题参数族主名英文化，拼音原名成为 {@link OPTION_ALIASES} 别名；`--year` / `--month` /
 * `--day` 三连**已删**（`--date` 完全覆盖，误敲 `--year` 由拼错建议引向 `--yearly`）。
 *
 * ⚠️ 分组标题里的「三选一」「二选一」是**口径**而非装饰：`buildBirthInfo` 对
 *    `--date` / `--lunar` 与 `--time` / `--branch` 各取其一（见 docs/code/cli-args.md）。
 */
export const OPTION_GROUPS: readonly OptionGroup[] = [
	{
		title: "出生日期（二选一）",
		role: "birth",
		options: [
			{
				name: "date",
				cmds: ["astrology"],
				kind: "value",
				value: "YYYY-MM-DD",
				desc: "公历生日（格式宽松，月日不补零）",
			},
			{
				name: "lunar",
				cmds: ["astrology"],
				kind: "value",
				value: "YYYY-MM-DD",
				desc: "农历生日（脚本自动换算，勿与 --date 同用）",
			},
			{ name: "leap", cmds: ["astrology"], kind: "switch", desc: "配合 --lunar，表示闰月" },
		],
	},
	{
		title: "出生时辰（二选一）",
		role: "birth",
		options: [
			{
				name: "time",
				cmds: ["astrology"],
				kind: "value",
				value: "HH:MM",
				desc: "钟表时间（配合 --lng / --city 自动换算真太阳时；1986–91 夏令时区间自动回拨 1 小时）",
			},
			{
				name: "branch",
				cmds: ["astrology"],
				kind: "value",
				value: "0-12",
				desc: "直接指定时辰支（0=子 … 11=亥；12=晚子时），与 --time 二选一",
			},
			{
				name: "late-zi",
				cmds: ["astrology"],
				kind: "switch",
				desc: "配合 --time：23:00–23:59 出生改按「晚子时算次日」排",
			},
			{
				name: "eot",
				cmds: ["astrology"],
				kind: "switch",
				desc: "配合 --time：真太阳时额外计入均时差（±16 分），默认不计",
			},
			{
				name: "no-dst",
				cmds: ["astrology"],
				noIntent: true,
				kind: "switch",
				desc: "配合 --time：不做 1986–91 中国夏令时自动回拨（出生证明时间已自行减过 1 小时时用）",
			},
		],
	},
	{
		title: "其他出生信息",
		role: "birth",
		options: [
			{
				name: "gender",
				cmds: ["astrology"],
				kind: "value",
				value: "male|female|男|女",
				desc: "性别",
			},
			{
				name: "lng",
				cmds: ["astrology"],
				kind: "value",
				value: "116.4",
				desc: "出生地经度（默认 120，即不做经度校正）",
			},
			{
				name: "city",
				cmds: ["astrology"],
				kind: "value",
				value: "北京",
				desc: "用城市名代替 --lng（容错「石家庄市」「山东青岛」等写法）",
			},
			{
				name: "province",
				cmds: ["astrology"],
				kind: "value",
				value: "山东",
				desc: "用省份代替 --lng（按省会计）",
			},
			{
				name: "name",
				cmds: ["astrology"],
				kind: "value",
				value: "张三",
				desc: "可选，只影响输出抬头",
			},
		],
	},
	{
		title: "命盘输入（synastry 专用）",
		role: "other",
		options: [
			{
				name: "charts",
				cmds: ["synastry"],
				kind: "value",
				value: "/tmp/a.json,/tmp/b.json",
				desc: "合盘输入：逗号分隔恰好两份 astrology --json 的输出（甲先乙后）",
			},
		],
	},
	{
		title: "专题深入（可叠加；不带任何专题参数时只出精简概览）",
		role: "topic-deep",
		options: [
			{
				name: "info",
				cmds: ["astrology"],
				noIntent: true,
				kind: "switch",
				desc: "只出基本信息面板 + 运限速览 + 专题指路（与无功能参数的概览同尾，不展开专题详版）",
			},
			{
				name: "pattern",
				cmds: ["astrology"],
				deep: true,
				kind: "switch",
				desc: "格局识别专题（格局判词 / 成立与破格条件 / 出处）",
			},
			{
				name: "mutagen",
				cmds: ["astrology"],
				deep: true,
				kind: "switch",
				desc: "四化专题（生年 / 流年 / 流月四化落宫与叠宫）",
			},
			{
				name: "decadal",
				cmds: ["astrology"],
				deep: true,
				kind: "value",
				value: "虚岁",
				optionalValue: true,
				desc: "大限专题（十年大运时间轴 + 指定岁所在限的三方四正深入；缺省 = 当前虚岁）",
			},
			{
				name: "ages",
				cmds: ["astrology"],
				deep: true,
				kind: "value",
				value: "虚岁",
				optionalValue: true,
				desc: "小限专题（指定岁小限宫 + 十二宫小限岁数表；缺省 = 当前虚岁）",
			},
			{
				name: "palaces",
				cmds: ["astrology"],
				noShadow: true,
				kind: "switch",
				desc: "十二宫逐宫详表",
			},
		],
	},
	{
		title: "输出与选题",
		role: "output-select",
		options: [
			{
				name: "json",
				cmds: ["astrology", "synastry"],
				kind: "switch",
				desc: "输出原始 JSON（供程序消费）",
			},
			{
				name: "no-cache",
				cmds: ["astrology"],
				noIntent: true,
				kind: "switch",
				desc: "跳过排盘缓存，强制现排（默认同一农历年内复用 .cache/charts 里的排盘结果）",
			},
			{
				name: "out",
				global: true,
				kind: "value",
				value: "out.md",
				desc: "把输出写入文件（覆盖写，末尾恰一个换行；进度提示走 stderr，stdout 不再打印正文）",
			},
			{
				name: "yearly",
				cmds: ["astrology"],
				shadow: true,
				deep: true,
				kind: "value",
				value: "年",
				optionalValue: true,
				desc: "指定流年（默认今年）",
			},
			{
				name: "monthly",
				cmds: ["astrology"],
				shadow: true,
				kind: "value",
				value: "1-12",
				desc: "配合 --mutagen 四化专题：追加该农历月的流月四化（流年缺省取当年）",
			},
			{
				name: "daily",
				cmds: ["astrology"],
				kind: "value",
				value: "1-30",
				desc: "配合 --mutagen --monthly：追加该农历日的流日四化（日干由 lunar-typescript 现算）",
			},
			{
				name: "hourly",
				cmds: ["astrology"],
				kind: "value",
				value: "0-12",
				desc: "配合 --mutagen --monthly --daily：追加该时支的流时四化（五鼠遁，由日干推；12=晚子时按当日日干）",
			},
			{
				name: "focus",
				cmds: ["astrology"],
				kind: "value",
				value: "财帛",
				shadow: true,
				deep: true,
				desc: "额外展开指定宫位",
			},
			{
				name: "topic",
				cmds: ["astrology", "knowledge"],
				shadow: true,
				kind: "value",
				value: "key",
				optionalValue: true,
				desc: "主题论断选主题（不带值时列全部 key 清单）",
			},
			{
				name: "view",
				cmds: ["astrology"],
				kind: "value",
				value: "mingpan",
				desc: "主题论断展示口径：mingpan（本命，默认）/ daxian（当前大限）/ liunian（流年）/ liuyue（流月），后三者也接受同名英文 decadal/yearly/monthly",
			},
			{
				name: "report",
				cmds: ["astrology"],
				shadow: true,
				kind: "switch",
				desc: "全盘主题报告（Markdown）：13 个板块一次出全，本命静态口径，独占分支（单独使用）",
			},
			{
				name: "search",
				cmds: ["knowledge"],
				kind: "value",
				value: "机月同梁",
				desc: "knowledge 检索关键字（也可用位置参数）",
			},
			{
				name: "limit",
				cmds: ["knowledge"],
				kind: "value",
				value: "15",
				desc: "knowledge 命中条数上限（正整数）",
			},
			{
				name: "source",
				cmds: ["knowledge"],
				kind: "value",
				value: "books",
				desc: "knowledge 知识域：books 古籍（默认）/ stars 星曜释义 / tianji 天纪判语 / oracle 断语手册",
			},
			{
				name: "book",
				cmds: ["knowledge"],
				kind: "value",
				value: "01-stars",
				desc: "knowledge tianji 域限册（册代号或中文名，如 主星/十二宫/格局/四化/疾厄）",
			},
			{
				name: "star",
				cmds: ["knowledge"],
				kind: "value",
				value: "七杀",
				desc: "knowledge oracle 域选星（配合 --topic；缺省列 14 星概览）",
			},
			{
				name: "config",
				cmds: ["astrology"],
				noIntent: true,
				kind: "value",
				value: "my.json",
				desc: "读 JSON 配置文件（键 = 参数 camelCase 主名；命令行同名参数覆盖配置）",
			},
			{
				name: "template",
				cmds: ["astrology"],
				kind: "switch",
				desc: "打印可直接使用的配置模板到 stdout（--template > my.json 落盘）",
			},
		],
	},
];

/**
 * 拼音别名 → 英文主名（spec §1.1）。
 *
 * @remarks
 * 别名是**显式声明**的映射，不是拼错容错 —— `--patern` 仍然报错（由 `suggestOption`
 * 建议主名）。help / SKILL.md 一律用主名，别名在 help 的参数描述尾注。
 */
export const OPTION_ALIASES: Record<string, string> = {
	geju: "pattern",
	sihua: "mutagen",
	liunian: "yearly",
	liuyue: "monthly",
	liuri: "daily",
	liushi: "hourly",
	daxian: "decadal",
	xiaoxian: "ages",
};

/**
 * 声明表里的**全部**参数名（英文主名，不含别名）。
 *
 * @remarks
 * 单 skill 形态下作用域即全集。校验时先查 {@link OPTION_ALIASES} 归一，再查这张表。
 */
export const ALL_OPTION_NAMES: ReadonlySet<string> = new Set(
	OPTION_GROUPS.flatMap(g => g.options.map(o => o.name))
);

/**
 * kebab-case → camelCase：**键名换算的唯一一处**。
 *
 * @param name - 参数名，可带 `synastry` 的 `a-` / `b-` 前缀（如 `"a-late-zi"`）
 * @returns camelCase 形式（`"aLateZi"`）
 */
export function camelKey(name: string): string {
	return name.replace(/-([a-z0-9])/g, (_m: string, c: string) => c.toUpperCase());
}

// ══════════════════ 语义派生（候选 2）══════════════════
// 四套派生 + 优先级链同源于 role 与参数标志：新增专题旗标只需标 `deep: true`。
// 域注意：SHADOWABLE 用 kebab 原名，其余三个用 camelCase（消费 args 键）
// —— 论证见 docs/code/cli-args.md。

/**
 * 可被独占分支吞掉的功能参数（kebab 原名）：专题深入组除 `palaces`（noShadow）外全部，
 * 加上输出与选题组标了 `shadow` 的五项。独占参数自身也在集合里（让「两个独占分支同给」
 * 被指路而非静默吞掉）—— 自指由调用处的 `n !== exclusive` 兜住，见 docs/code/cli-args.md。
 */
export const SHADOWABLE_KEYS: ReadonlySet<string> = new Set(
	OPTION_GROUPS.flatMap(g => {
		if (g.role === "topic-deep") {
			return g.options.filter(o => o.noShadow !== true).map(o => o.name);
		}
		if (g.role === "output-select") {
			return g.options.filter(o => o.shadow === true).map(o => o.name);
		}
		return [];
	})
);

/**
 * 出生相关参数名（camelCase）—— `role: "birth"` 三个组的全部参数。零输入演示的判据之一：
 * 这些键**全部**缺席（只给 `--gender` 是部分输入，按「缺一问一」报错，不走演示盘）。
 * 位置参数归类与 `--config` 注入也算「已输入」—— 见 docs/code/cli-args.md。
 */
export const BIRTH_KEYS: readonly string[] = OPTION_GROUPS.filter(g => g.role === "birth").flatMap(
	g => g.options.map(o => camelKey(o.name))
);

/**
 * 表达了输出意图的功能参数（camelCase）—— 专题深入与输出选题两组，刨去标了 `noIntent`
 * 的 `info` 与 `config`。零输入 + 这些参数在场 = 用户要特定输出，**不替他排虚构盘**
 * （`--json` / `--report` 尤其如此）—— 见 docs/code/cli-args.md。
 */
export const INTENT_KEYS: readonly string[] = OPTION_GROUPS.filter(
	g => g.role === "topic-deep" || g.role === "output-select"
).flatMap(g => g.options.filter(o => o.noIntent !== true).map(o => camelKey(o.name)));

/**
 * 专题深入旗标（camelCase）—— 深入态基底的显隐判据：任一在场即「已在深入，基底与指路是
 * 噪声」。旧 astrology 的硬编码六旗标由此收编；新增专题参数只需标 `deep: true`。
 */
export const DEEP_DIVE_KEYS: readonly string[] = OPTION_GROUPS.flatMap(g =>
	g.options.filter(o => o.deep === true).map(o => camelKey(o.name))
);

/** 独占分支优先级链文案 —— astrology 报错与 help 说明共用的唯一真相源。 */
export const EXCLUSIVE_PRIORITY_LABEL = "--palaces > --topic > --report > 其他功能参数";

// ══════════════════ 归属投影（候选 4）══════════════════
// 「哪个参数归哪条命令」此前是 help.ts 手抄的第二真相源（零正向测试、早已漂移），
// 现收进声明表：每个参数标 `cmds`、全局参数标 `global`，help 只做投影。

/**
 * 全局参数（kebab 名）—— 标了 `global: true` 的参数，任意命令可用。
 * 现仅 `--out`（落盘通道在引导层 main，对每条命令都生效）。
 */
export const GLOBAL_OPTIONS: readonly string[] = OPTION_GROUPS.flatMap(g => g.options)
	.filter(o => o.global === true)
	.map(o => o.name);

/**
 * 命令 → 该命令实际读取的专属参数（kebab 名，投影非转录）。
 *
 * @param cmd - 命令名（kebab 主名）
 * @returns 标了 `cmds` 含该命令、且非全局的参数名，按声明表顺序
 *
 * @remarks
 * help 视图：未列出的参数对该命令无害（skill 级作用域收下不用），但 help 不展示。
 * ⚠️ 作用域仍是 skill 级，本投影**不做硬校验**（见 docs/code/cli-args.md）。
 */
export function ownedOptions(cmd: string): readonly string[] {
	return OPTION_GROUPS.flatMap(g => g.options)
		.filter(o => o.global !== true && (o.cmds ?? []).includes(cmd))
		.map(o => o.name);
}
