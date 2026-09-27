/**
 * CLI 参数面 —— 旗标声明表 + 校验 + 解析 + 帮助渲染。纯函数，不依赖任何内核模块，
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
 * - `--a-city` 写在 `analyze` 上同理：`a-` 前缀只有 `heming` 会去读，别处完全忽略。
 *
 * 现在 {@link FLAG_GROUPS} 是唯一来源：{@link parseArgs} 据它拒绝未知旗标，
 * `HELP` 据 {@link renderFlagHelp} 派生参数段，`SKILL.md` 则由 `selftest` 断言兜底。
 */

/**
 * CLI 参数表：`_` 收位置参数，其余键对应 `--key`。
 *
 * @remarks
 * 带值的参数存 `string`，纯开关存 `boolean` 的 `true`（见 {@link parseArgs}），
 * 因此取值前通常要先收窄类型。
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
	/** 旗标名，不含 `--`。`heming` 可用 `a-` / `b-` 前缀叠在它前面（如 `--a-date`） */
	name: string;
	/** `"value"` 取值、`"switch"` 纯开关（HELP 据此决定写不写值域占位） */
	kind: "value" | "switch";
	/** 值域占位，如 `"YYYY-MM-DD"`；`kind: "switch"` 时不给 */
	value?: string;
	/** 一行说明，即 HELP 里那一行的描述列 */
	desc: string;
}

/** 一组旗标；`title` 即 HELP 里的分组标题（可含口径提示，如「三选一」）。 */
export interface FlagGroup {
	title: string;
	flags: readonly FlagSpec[];
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
		title: "出生日期（三选一；heming 加 a- / b- 前缀）",
		flags: [
			{ name: "date", kind: "value", value: "YYYY-MM-DD", desc: "公历生日" },
			{
				name: "lunar",
				kind: "value",
				value: "YYYY-MM-DD",
				desc: "农历生日（脚本自动换算，勿与 --date 同用）",
			},
			{ name: "leap", kind: "switch", desc: "配合 --lunar，表示闰月" },
			{ name: "year", kind: "value", value: "1990", desc: "公历出生年（与 --month / --day 分写）" },
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
			{ name: "province", kind: "value", value: "山东", desc: "用省份代替 --lng（按省会计）" },
			{ name: "name", kind: "value", value: "张三", desc: "可选，只影响输出抬头" },
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

/** 全部合法旗标名（不含 `--`）。{@link parseArgs} 的校验基准。 */
export const FLAG_NAMES: ReadonlySet<string> = new Set(
	FLAG_GROUPS.flatMap(g => g.flags.map(f => f.name))
);

/**
 * `heming` 的两个出生方前缀。只有 `heming` 会读它们（`buildBirthInfo(args, "a-")`）。
 *
 * @remarks
 * 导出是给 `cli/selftest.ts` 用的：它扫 `SKILL.md` 里提到的旗标，要先剥掉这层前缀
 * 才能与 {@link FLAG_NAMES} 比对 —— 前缀表不该有第二份。
 */
export const SIDE_PREFIXES = ["a-", "b-"] as const;

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
 * @param command - 当前命令名；只有 `heming` 接受 `a-` / `b-` 前缀
 *
 * @remarks
 * 三条规则各挡一种**静默失败**，都是本文件顶部注释里那两类错盘的入口：
 *
 * 1. 名字不在 {@link FLAG_NAMES}：拼错。以前照收不误，`buildBirthInfo` 读不到就读不到，
 *    直接落回默认值排出一张错盘。此处报错并给出最近的名字。
 * 2. `a-` / `b-` 前缀出现在 `heming` 之外：那里读的是不带前缀的名字，带前缀的写法会被
 *    整个忽略（`analyze --a-city 北京` 排的是默认经度的盘）。
 * 3. 前缀后面接的仍必须是声明过的名字：`--a-ctiy` 同样要抓。
 *
 * ⚠️ 刻意**不**校验「这个旗标属于这个命令」：`--json` 给 `classics` 是无害的多余参数，
 * 而把归属做成硬约束会让每条命令的合法集合成为第二个需要维护的真相 —— 拼错才是要挡的，
 * 归属错了顶多是没生效，不会排错盘。
 */
function checkFlagName(key: string, command: string | undefined): void {
	const prefix = SIDE_PREFIXES.find(p => key.startsWith(p));
	if (prefix) {
		if (command !== "heming") {
			throw new Error(
				`--${key}：\`${prefix}\` 前缀只有 heming 命令认（它要分别读 a / b 两方出生信息）。` +
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
 * 参数解析：`--key value` / `--flag`。
 *
 * @param argv - 待解析的参数数组（引导层传入的是 `process.argv.slice(2)` 去掉命令名之后的部分）
 * @param command - 当前命令名。给了就**校验旗标名**（见 {@link checkFlagName}），
 *   未知或错位的前缀旗标一律抛错而非静默忽略
 * @returns 参数表；`--flag` 后无值（或后接另一个 `--` 开关）时存为 `true`
 *
 * @remarks
 * 只认「`--key value`」与「`--flag`」两种形态：不处理 `-x` 短选项、`--key=value`，
 * 也不做类型转换（数值参数由调用方自行 `Number()`，如 `--liunian` / `--liuyue`）。
 *
 * ⚠️ 同一参数重复给出时**后值覆盖前值**（`args[key] = next`），不会累积成数组；
 * 不带值的开关存的是布尔 `true`，两者都是调用方判空时需要考虑的形态。
 *
 * `command` 省略即退回「照单全收」的宽松解析 —— 供不关心旗标面、只想拿个参数表的
 * 调用方（如 `test/` 里构造输入的小工具）使用。
 */
export function parseArgs(argv: string[], command?: string): CliArgs {
	const args: CliArgs = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith("--")) {
			const key = a.slice(2);
			if (command !== undefined) checkFlagName(key, command);
			// 显式标为可能 undefined：越界访问才是「这个开关没有取值」的真实来源
			const next: string | undefined = argv[i + 1];
			if (next === undefined || next.startsWith("--")) args[key] = true;
			else {
				args[key] = next;
				i++;
			}
		} else {
			args._.push(a);
		}
	}
	return args;
}

/**
 * 字符串的**显示宽度**：CJK 与全角标点占 2 列，其余占 1 列。
 *
 * @param s - 待测字符串
 * @returns 终端里实际占据的列数
 *
 * @remarks
 * 只为 {@link renderFlagHelp} 的列对齐服务。`String.prototype.padEnd` 数的是码元，
 * 而声明表里有 `北京` / `机月同梁` 这类值域 —— 不按显示宽度补空格，含中文的那几行
 * 描述列会比别行少缩进一格，看上去像排版坏了。
 *
 * 区间取的是**本文件声明表里实际会出现的字符范围**（汉字、假名、谚文、全角标点），
 * 不是完整的 East Asian Width 实现，也不处理组合字符与 emoji。
 */
function displayWidth(s: string): number {
	let w = 0;
	for (const ch of s) {
		const c = ch.codePointAt(0) ?? 0;
		const wide =
			(c >= 0x1100 && c <= 0x115f) || // 谚文字母
			(c >= 0x2e80 && c <= 0xa4cf) || // CJK 部首 … 注音（含汉字）
			(c >= 0xac00 && c <= 0xd7a3) || // 谚文音节
			(c >= 0xf900 && c <= 0xfaff) || // CJK 兼容汉字
			(c >= 0xfe30 && c <= 0xfe6f) || // CJK 兼容形式
			(c >= 0xff00 && c <= 0xff60) || // 全角形式
			(c >= 0xffe0 && c <= 0xffe6); // 全角符号
		w += wide ? 2 : 1;
	}
	return w;
}

/** HELP 里描述列的起始列（含两格缩进）。 */
const DESC_COLUMN = 23;

/**
 * 从 {@link FLAG_GROUPS} 渲染 HELP 的参数段。
 *
 * @returns 纯文本：每组「标题：」加若干「  --name <值域>  说明」行，组间空行
 *
 * @remarks
 * 说明列对齐到 {@link DESC_COLUMN} —— 声明表里写 `desc` 时不必自己数空格。
 * 说明过长时不换行、直接顶出去：HELP 是给人扫的，硬换行反而更难读。
 */
export function renderFlagHelp(): string {
	return FLAG_GROUPS.map(g =>
		[
			`${g.title}：`,
			...g.flags.map(f => {
				const left = f.value ? `--${f.name} ${f.value}` : `--${f.name}`;
				const gap = " ".repeat(Math.max(1, DESC_COLUMN - 2 - displayWidth(left)));
				return `  ${left}${gap}${f.desc}`;
			}),
		].join("\n")
	).join("\n\n");
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
