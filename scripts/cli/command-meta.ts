/**
 * 命令元数据 —— 命令名清单与 HELP 渲染所需的描述文案。
 *
 * 2026-10-09 从 `commands.ts` 拆出（评审 selftest-performance 方案 B）：`commands.ts`
 * 静态 import 各命令实现（→ astrology → 内核 → iztro），HELP 渲染却只需要名字与
 * 文案。拆出后 `purple-star.ts` 的 help / 未知命令路径只加载本模块即可返回，不再为
 * 看一眼用法付出 iztro 冷启动（约 3.2 秒）。
 *
 * ⚠️ 本文件是**轻模块**：不得 import 任何命令实现或内核（help 渲染的依赖底线）。
 * 键集与 `commands.ts` 的 COMMAND_TABLE 互相钉住：那边 `satisfies Record<CommandName, Cmd>`，
 * 这边 `Record<CommandName, ...>` —— 任何一侧加命令漏改另一侧都编译不过。
 */

/** 合法命令名（顺序即 help COMMANDS 节的展示序）。 */
export const COMMAND_NAMES = [
	"astrology",
	"stars",
	"classics",
	"synastry",
	"selftest",
] as const;

/** 合法命令名类型。 */
export type CommandName = (typeof COMMAND_NAMES)[number];

/**
 * 命令名 → 多行详细说明（`<命令> --help` 的 DESCRIPTION 节，spec §3.2）。
 *
 * @remarks
 * 与 COMMAND_DESC 的分工：DESC 是一行速览（总览 COMMANDS 节），HELP 是逐命令展开
 * （功能 / 专属参数 / 注意事项）。类型钉在 CommandName 上，新增命令漏写说明编译不过。
 */
export const COMMAND_HELP: Record<CommandName, readonly string[]> = {
	astrology: [
		"排盘分析一条命令（2026-09-30 四命令合一：原 analyze / chart / topic 融入参数）。",
		"不带功能参数 = 概览：命盘总览三行 + 基本信息 12 行面板（无条件）+ 口径提示 + 运限速览 + 功能参数指路。",
		"专题参数可叠加：--pattern 格局 / --mutagen 四化 / --yearly [年] 流年 / --monthly 流月（须配 --mutagen）/",
		"--decadal [虚岁] 大限 / --ages [虚岁] 小限 / --focus <宫>（四项深化：三方四正逐宫全星曜、",
		"对宫完整详表、涉及格局全列、运限引动年份）。",
		"--info（只出基本信息面板）/ --palaces（十二宫逐宫详表）/ --topic（主题论断）是独占分支：",
		"给出即接管输出，与其余功能参数同给会报错指路；优先级 --palaces > --topic > 其他功能参数。",
		"出生信息支持零参数快捷形态（按形态归类、顺序无关）与完整参数形态，二者可混用（参数优先）。",
		"⚠️ 排盘四必问：日期、时间、性别、出生地 —— 缺一问一，不要猜。",
	],
	stars: ["星曜释义查询：不给关键词列出全部已收录星曜，给定时出该星的「关键词 · 星性 · 五行」。"],
	classics: [
		"古籍原文检索（骨髓赋 / 紫微斗数全集 / 紫微斗数全书三部全文）。",
		"逐段子串匹配（不分词、繁简不转换）；--limit 控制命中条数上限（默认 15，正整数）。",
		"解读需要引原句佐证时用本命令，不要凭记忆转写古籍。",
	],
	synastry: [
		"合盘（双宫联参）：看婚姻不能只看夫妻宫，必须同时看福德宫（倪海夏口径）。",
		"输入 --charts 为逗号分隔恰好两份 astrology --json 的产物（甲先乙后；两路径相同 = 自盘对照，允许）。",
		"输出两方命宫 / 夫妻宫 / 福德宫主星、天作之合判定、夫妻宫断语（空宫借对宫）、",
		"生年四化入夫妻宫、桃花孤克星；方法论与评分标准见 references/synastry-guide.md。",
		"⚠️ 本命令不排盘：没有出生信息回退路径，缺输入会指路先排盘。",
	],
	selftest: [
		"回归自检（排盘 / 古籍 / 合盘三段合一，末行自报项数）。",
		"改动本 skill、升级 iztro 或换 Node 版本后跑一次；有失败项时退出码非零。",
	],
};

/**
 * 命令名 → 一行说明，HELP 的命令段据此派生。
 *
 * @remarks
 * 类型写成 `Record<CommandName, string>` 而非 `Record<string, string>`：**新增命令忘了
 * 写说明就编译不过**。
 */
export const COMMAND_DESC: Record<CommandName, string> = {
	astrology: "排盘分析一条命令（概览默认 + 功能参数：专题/--palaces/--topic）★ 最常用",
	stars: "星曜释义",
	classics: "古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书）",
	synastry: "合盘（双宫联参 + 夫妻宫断语 + 四化入夫妻宫）",
	selftest: "回归自检（排盘 / 古籍 / 合盘三段：农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）",
};
