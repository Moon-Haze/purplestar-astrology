/**
 * CLI 参数声明面 —— 「有哪些参数」的唯一定义处（纯数据，零依赖）。
 *
 * 与同目录两个模块的分工（三层自底向上）：
 *   1. 本文件：**声明了什么** —— 参数表 / 拼音别名 / 全集派生 / 键名换算，零逻辑零依赖；
 *   2. `option-scope.ts`：**本 skill 认哪些** —— 作用域契约与差量排除值；
 *   3. `args.ts`：**怎么解析** —— `util.parseArgs` tokens 底座 + 校验 + 薄适配层。
 *
 * ## 为什么参数要有声明表
 *
 * 「有哪些参数」的唯一来源是 {@link OPTION_GROUPS}：`args.ts` 的解析器据它拒绝未知参数、
 * help 据它渲染参数段、`SKILL.md` 则由 `selftest` 断言兜底。拼错参数名（`--ctiy 喀什`）
 * 曾静默落回默认经度排出错盘 —— 那正是这张表要消灭的失败模式。
 *
 * ⚠️ **键名是 camelCase**（`late-zi` → `lateZi`）。换算只有 {@link camelKey} 一处，
 *    声明表里的 `name` 仍写 kebab（它同时是用户敲的名字、help 的显示名）。
 *
 * ⚠️ 本文件由引导层（purple-star.ts）在 `registerHooks` **之后**经 `args.ts` 间接加载。
 *    不要在 purple-star.ts 顶部用静态 `import` 引它 —— 钩子未注册时解析会失败。
 */

/**
 * 一个参数的完整声明。
 *
 * @remarks
 * 界面刻意只留四格 `name / kind / value / desc` —— 声明表要能被一眼扫完，
 * 免得「加参数」变成一件要读文档才敢做的事。
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
 * - 专题参数族主名英文化（spec §1 表）：`pattern` / `mutagen` / `yearly` /
 *   `monthly` / `decadal` / `ages`；拼音原名成为 {@link OPTION_ALIASES} 别名。
 * - `--year` / `--month` / `--day` 三连**已删**：`--date 1990-5-15` 完全覆盖（格式宽松，
 *   月日不补零）。误敲 `--year` 由拼错建议引向 `--yearly`（编辑距离 2）。
 *
 * 分组标题里的「三选一」「二选一」是**口径**而非装饰：`buildBirthInfo` 对
 * `--date` / `--lunar` 与 `--time` / `--branch` 各取其一，同时给出时按该处的优先级处理。
 */
export const OPTION_GROUPS: readonly OptionGroup[] = [
	{
		title: "出生日期（二选一）",
		role: "birth",
		options: [
			{
				name: "date",
				kind: "value",
				value: "YYYY-MM-DD",
				desc: "公历生日（格式宽松，月日不补零）",
			},
			{
				name: "lunar",
				kind: "value",
				value: "YYYY-MM-DD",
				desc: "农历生日（脚本自动换算，勿与 --date 同用）",
			},
			{ name: "leap", kind: "switch", desc: "配合 --lunar，表示闰月" },
		],
	},
	{
		title: "出生时辰（二选一）",
		role: "birth",
		options: [
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
		role: "birth",
		options: [
			{ name: "gender", kind: "value", value: "male|female|男|女", desc: "性别" },
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
				desc: "用城市名代替 --lng（容错「石家庄市」「山东青岛」等写法）",
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
		title: "命盘输入（synastry 专用）",
		role: "other",
		options: [
			{
				name: "charts",
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
				noIntent: true,
				kind: "switch",
				desc: "只出基本信息面板 + 运限速览 + 专题指路（与无功能参数的概览同尾，不展开专题详版）",
			},
			{
				name: "pattern",
				deep: true,
				kind: "switch",
				desc: "格局识别专题（格局判词 / 成立与破格条件 / 出处）",
			},
			{
				name: "mutagen",
				deep: true,
				kind: "switch",
				desc: "四化专题（生年 / 流年 / 流月四化落宫与叠宫）",
			},
			{
				name: "decadal",
				deep: true,
				kind: "value",
				value: "虚岁",
				optionalValue: true,
				desc: "大限专题（十年大运时间轴 + 指定岁所在限的三方四正深入；缺省 = 当前虚岁）",
			},
			{
				name: "ages",
				deep: true,
				kind: "value",
				value: "虚岁",
				optionalValue: true,
				desc: "小限专题（指定岁小限宫 + 十二宫小限岁数表；缺省 = 当前虚岁）",
			},
			{
				name: "palaces",
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
			{ name: "json", kind: "switch", desc: "输出原始 JSON（供程序消费）" },
			{
				name: "out",
				kind: "value",
				value: "out.md",
				desc: "把输出写入文件（覆盖写，末尾恰一个换行；进度提示走 stderr，stdout 不再打印正文）",
			},
			{
				name: "yearly",
				shadow: true,
				deep: true,
				kind: "value",
				value: "年",
				optionalValue: true,
				desc: "指定流年（默认今年）",
			},
			{
				name: "monthly",
				shadow: true,
				kind: "value",
				value: "1-12",
				desc: "配合 --mutagen 四化专题：追加该农历月的流月四化（流年缺省取当年）",
			},
			{
				name: "daily",
				kind: "value",
				value: "1-30",
				desc: "配合 --mutagen --monthly：追加该农历日的流日四化（日干由 lunar-typescript 现算）",
			},
			{
				name: "hourly",
				kind: "value",
				value: "0-12",
				desc: "配合 --mutagen --monthly --daily：追加该时支的流时四化（五鼠遁，由日干推；12=晚子时按当日日干）",
			},
			{
				name: "focus",
				kind: "value",
				value: "财帛",
				shadow: true,
				deep: true,
				desc: "额外展开指定宫位",
			},
			{
				name: "topic",
				shadow: true,
				kind: "value",
				value: "key",
				optionalValue: true,
				desc: "主题论断选主题（13 个 key 之一；不带值时列清单）",
			},
			{
				name: "view",
				kind: "value",
				value: "mingpan",
				desc: "主题论断展示口径：mingpan（本命，默认）/ daxian（当前大限）/ liunian（流年）/ liuyue（流月），后三者也接受同名英文 decadal/yearly/monthly",
			},
			{
				name: "report",
				shadow: true,
				kind: "switch",
				desc: "全盘主题报告（Markdown）：13 个板块一次出全，本命静态口径，独占分支（单独使用）",
			},
			{
				name: "search",
				kind: "value",
				value: "机月同梁",
				desc: "knowledge 检索关键字（也可用位置参数）",
			},
			{ name: "limit", kind: "value", value: "15", desc: "knowledge 命中条数上限（正整数）" },
			{
				name: "source",
				kind: "value",
				value: "books",
				desc: "knowledge 知识域：books 古籍（默认）/ stars 星曜释义 / tianji 天纪判语 / oracle 断语手册",
			},
			{
				name: "book",
				kind: "value",
				value: "01-stars",
				desc: "knowledge tianji 域限册（册代号或中文名，如 主星/十二宫/格局/四化/疾厄）",
			},
			{
				name: "star",
				kind: "value",
				value: "七杀",
				desc: "knowledge oracle 域选星（配合 --topic；缺省列 14 星概览）",
			},
			{
				name: "config",
				noIntent: true,
				kind: "value",
				value: "my.json",
				desc: "读 JSON 配置文件（键 = 参数 camelCase 主名；命令行同名参数覆盖配置）",
			},
			{
				name: "template",
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
 * 别名是**显式声明**的映射，不是拼错容错 —— `--patern` 仍然报错，
 * `args.ts` 的 `suggestOption` 建议主名 `--pattern`。help / SKILL.md 一律用主名，
 * 别名在 help 的参数描述尾注。
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
// 四套派生 + 优先级链同源于 role 与参数标志：改 help 标题不再静默拆掉任何一套；
// 新增专题旗标只需标 `deep: true`，deepDive 自动认。域注意：SHADOWABLE 用 kebab
// 原名（调用处按 `exclusive.slice(2)` 对拍），其余三个用 camelCase（消费 args 键）。

/**
 * 可被独占分支吞掉的功能参数（kebab 原名）—— 专题深入组除 `palaces`（noShadow）
 * 之外的全部，加上输出与选题组标了 `shadow` 的五项（yearly / monthly / focus /
 * topic / report）。独占参数自身也在集合里，是为了让「两个独占分支同给」被指路
 * 而非静默吞掉低优先级的那个（自指由调用处的 `n !== exclusive` 过滤兜住）。
 */
export const SHADOWABLE_KEYS: ReadonlySet<string> = new Set(
	OPTION_GROUPS.flatMap(g => {
		if (g.role === "topic-deep")
			return g.options.filter(o => o.noShadow !== true).map(o => o.name);
		if (g.role === "output-select")
			return g.options.filter(o => o.shadow === true).map(o => o.name);
		return [];
	})
);

/**
 * 出生相关参数名（camelCase）—— `role: "birth"` 三个组的全部参数。零输入演示的
 * 判据之一：这些键**全部**缺席。「其他出生信息」组（gender / lng / city /
 * province / name）也在内 —— 只给 `--gender` 是部分输入，按「缺一问一」报错，
 * 不该走演示盘。位置参数归类与 `--config` 注入都发生在 parseArgs / applyConfig，
 * 二者给出的出生信息均算「已输入」。
 */
export const BIRTH_KEYS: readonly string[] = OPTION_GROUPS.filter(g => g.role === "birth").flatMap(
	g => g.options.map(o => camelKey(o.name))
);

/**
 * 表达了输出意图的功能参数（camelCase）—— 专题深入与输出选题两组，刨去标了
 * `noIntent` 的 `info`（零输入时它正是演示目标）与 `config`（参数来源而非输出形态）。
 * 零输入 + 这些参数在场 = 用户要特定输出，不替他排虚构盘 —— 交回原路径按「缺一问一」
 * 报错（`--json` / `--report` 尤其如此：机器接口与全盘报告都不喂虚构数据）。
 */
export const INTENT_KEYS: readonly string[] = OPTION_GROUPS.filter(
	g => g.role === "topic-deep" || g.role === "output-select"
).flatMap(g => g.options.filter(o => o.noIntent !== true).map(o => camelKey(o.name)));

/**
 * 专题深入旗标（camelCase）—— 深入态基底（基本信息面板 / 运限速览 / 专题指路）的
 * 显隐判据：任一在场即「已在深入，基底与指路是噪声」。旧 astrology 的 `deepDive`
 * 硬编码六旗标由此收编；新增专题参数只需标 `deep: true`。
 */
export const DEEP_DIVE_KEYS: readonly string[] = OPTION_GROUPS.flatMap(g =>
	g.options.filter(o => o.deep === true).map(o => camelKey(o.name))
);

/** 独占分支优先级链文案 —— astrology 报错与 help 说明共用的唯一真相源。 */
export const EXCLUSIVE_PRIORITY_LABEL = "--palaces > --topic > --report > 其他功能参数";
