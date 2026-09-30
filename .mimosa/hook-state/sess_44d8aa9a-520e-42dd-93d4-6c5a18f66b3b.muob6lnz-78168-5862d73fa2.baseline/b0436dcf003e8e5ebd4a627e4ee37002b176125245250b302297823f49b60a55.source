/**
 * `--config` / `--template` —— JSON 配置文件输入（spec §3.3，2026-09-30 新增）。
 *
 * - **`--config <file>`**：读 JSON 文件，键名与参数的 camelCase 主名同名
 *   （`date` / `time` / `city` / `gender` / `pattern` / `mutagen` / `yearly` …），
 *   出生信息与专题参数都可写。
 * - **优先级：命令行参数覆盖配置文件同名字段**（命令行更明确，必须赢；配置是基底）。
 * - **校验**：配置文件里的未知键、非法值与命令行同规则报错（不静默）；
 *   `_` 前缀键是注释性说明，跳过（模板里用它写人类备注）。
 * - **`--template`**：打印可直接使用的示例 JSON 模板到 stdout（含 `_说明` 键），
 *   用户 `--template > my.json` 落盘后可直接 `--config my.json` —— 模板本身
 *   必须是合法可跑的配置（selftest 有吃回闭环断言盯着）。
 */

import { readFileSync } from "node:fs";
import type { CliArgs } from "./args";
import { camelKey, OPTION_NAMES, OPTION_ALIASES, OPTION_GROUPS } from "./args";

/**
 * 把配置文件的键值合并进参数表（配置是基底，命令行已给的键不被覆盖）。
 *
 * @param argv - 命令行解析产物（其中 `--config` 给出的路径在 `argv.config`）
 * @returns 合成后的参数表；`config` / `template` 两个入口键已摘除
 * @throws 配置文件不可读、不是合法 JSON、含未知键或非法值 —— 一律中文报错
 */
export function applyConfig(argv: CliArgs): CliArgs {
	const file = argv.config;
	// 没给 --config：原样返回（只摘入口键，防下游误读）
	if (typeof file !== "string") {
		const { config: _c, template: _t, ...rest } = argv;
		void _c;
		void _t;
		return rest as CliArgs;
	}

	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(file, "utf8"));
	} catch (err) {
		throw new Error(
			`--config ${file} 读取或解析失败：${(err as Error).message}。` +
				`可先运行 astrology --template 查看合法配置的形状。`
		);
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw))
		throw new Error(`--config ${file} 的顶层应是 JSON 对象（键 = 参数的 camelCase 主名）。`);

	// 合法键集合：主名的 camelCase 形态（键名与 parseArgs 产出的键同域）
	const legalKeys = new Set<string>([...OPTION_NAMES].map(camelKey));

	const merged: CliArgs = { ...argv };
	delete merged.config;
	delete merged.template;

	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		// `_` 前缀键是注释性说明（模板里的人类备注），跳过
		if (key.startsWith("_")) continue;
		// 拼音别名同被接受（与命令行一致，归一到主名）
		const canonical = key.includes("-") ? key : (Object.entries(OPTION_ALIASES).find(([a]) => camelKey(a) === key)?.[1] ?? key);
		const storeKey = canonical.includes("-") ? camelKey(canonical) : canonical;
		if (!legalKeys.has(storeKey))
			throw new Error(
				`--config ${file} 含未知键「${key}」。键名与参数的 camelCase 主名同名（如 date / time / city / gender / pattern）。` +
					`运行 help 查看全部参数。`
			);
		if (typeof value !== "string" && typeof value !== "boolean" && !Array.isArray(value))
			throw new Error(
				`--config ${file} 的键「${key}」值类型非法（${typeof value}）：应为字符串 / 布尔 / 数组，与命令行同规则。`
			);
		// 命令行优先：只在命令行未给该键时采用配置值
		if (merged[storeKey] === undefined) merged[storeKey] = value as CliArgs[string];
	}
	return merged;
}

/**
 * `--template` 的产物：合法可跑的示例配置（虚构样例，spec §3.4）。
 *
 * @returns JSON 文本（stdout 直接打印；`_` 前缀键是注释）
 */
export function renderTemplate(): string {
	return JSON.stringify(
		{
			"_说明": [
				"紫微斗数排盘配置模板（示例数据为虚构，无真实人物）。",
				"键名与参数的 camelCase 主名同名；命令行同名参数会覆盖这里的值。",
				"用法：node scripts/purple-star.ts astrology --config my.json",
				"本模板可直接落盘使用：astrology --template > my.json && astrology --config my.json",
			].join("\n"),
			date: "2011-06-24",
			time: "07:45",
			gender: "male",
			city: "杭州",
			// 专题参数（可选，删掉即出默认概览）
			pattern: true,
			yearly: "2027",
			focus: "财帛",
		},
		null,
		2
	);
}

/** 导出声明表引用（模板与校验共用一张 OPTION_GROUPS，防两处漂移）。 */
export const CONFIG_OPTION_GROUPS = OPTION_GROUPS;
