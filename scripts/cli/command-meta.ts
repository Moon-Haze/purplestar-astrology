/**
 * 命令元数据 —— 命令名清单与 HELP 渲染所需的描述文案。
 *
 * `commands.ts` 静态 import 各命令实现（→ astrology → 内核 → iztro），HELP 渲染却只需要
 * 名字与文案。本模块拆出后 `purple-star.ts` 的 help / 未知命令路径只加载它即可返回，不再为
 * 看一眼用法付出 iztro 冷启动（约 3.2 秒）。
 *
 * ⚠️ 本文件是**轻模块**：不得 import 任何命令实现或内核（help 渲染的依赖底线）。
 * 键集与 `commands.ts` 的 COMMAND_TABLE 互相钉住：那边 `satisfies Record<CommandName, Cmd>`，
 * 这边 `Record<CommandName, ...>` —— 任何一侧加命令漏改另一侧都编译不过。
 */

// 优先级链的真相源在声明表（纯数据零依赖，不破本文件的轻模块底线）——
// 旧手抄文案漏了 `--report`，与 astrology 实际报错和 options.md 均不符，收拢即修正。
import { EXCLUSIVE_PRIORITY_LABEL } from "./args-table";

/** 合法命令名（顺序即 help COMMANDS 节的展示序）。 */
export const COMMAND_NAMES = ["astrology", "knowledge", "synastry", "selftest"] as const;

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
		"排盘分析一条命令。",
		"不带功能参数 = 概览：基本信息面板（含公历生日 / 命宫 / 身宫 / 紫微落 / 三方四正）+ 口径提示 + 运限速览 + 专题指路。",
		"专题参数可叠加：--pattern 格局 / --mutagen 四化（生年/大限宫干/流年，配 --monthly 流月、--daily 流日、--hourly 流时）/",
		"--yearly [年] 流年 / --decadal [虚岁] 大限 / --ages [虚岁] 小限 / --focus <宫>（四项深化：三方四正逐宫全星曜、",
		"对宫完整详表、涉及格局全列、运限引动年份）。给了专题参数则只出口径提示 + 专题详版",
		"（基本信息面板 / 运限速览 / 专题指路均不带 —— 已在深入）。",
		"--info（面板 + 运限速览 + 专题指路，与概览同尾）/ --palaces（十二宫逐宫详表）/ --topic（主题论断）是独占分支：",
		`给出即接管输出，与其余功能参数同给会报错指路；优先级 ${EXCLUSIVE_PRIORITY_LABEL}。`,
		"出生信息支持零参数快捷形态（按形态归类、顺序无关）与完整参数形态，二者可混用（参数优先）。",
		"完全零输入（出生信息一项不给）时不报错：以虚构示例（2011-06-24 杭州）演示基本信息面板 +",
		"运限速览 + 专题指路并附用法指引。--json 与其他功能参数仍要求出生信息，",
		"部分输入按「缺一问一」报错。",
		"⚠️ 排盘四必问：日期、时间、性别、出生地 —— 缺一问一，不要猜。",
	],
	knowledge: [
		"统一知识检索，四域合一（--source 选域，缺省 books）。",
		"books（默认）：古籍原文检索（骨髓赋 / 紫微斗数全集 / 全书三部全文），逐段子串匹配，",
		"  --limit 控制命中上限（默认 15）——解读需要引原句佐证时用它，不要凭记忆转写古籍。",
		"stars：星曜释义（--search <星名>，或位置参数；缺省列全部星曜的「关键词 · 星性 · 五行」）。",
		"tianji：天纪判语检索（《天纪》讲稿原话 + 秒级回放溯源，紫微五册：主星 / 十二宫 / 格局 /",
		"  四化 / 疾厄；--book 限册、--limit 限条），引用「倪师说」时用它找原话出处；语料 CC BY-NC-SA 4.0。",
		"oracle：断语手册（13 主题 × 十四主星的分类断语快照；--topic <key> [--star <星名>]，",
		"  缺 --star 时列 14 星概览）；快照为本命静态口径，解读仍需结合具体命盘。",
		"⚠️ 本命令原名 classics（四域合并时改名，books 用法逐字不变）；旧命令 stars / oracle",
		"已并入（--source …），原命令名不再保留。",
	],
	synastry: [
		"合盘（双宫联参）：看婚姻不能只看夫妻宫，必须同时看福德宫（倪海厦口径）。",
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
	knowledge:
		"统一知识检索（--source 四域：books 古籍默认 / stars 星曜释义 / tianji 天纪判语 / oracle 断语手册）",
	synastry: "合盘（双宫联参 + 夫妻宫断语 + 四化入夫妻宫）",
	selftest:
		"回归自检（排盘 / 古籍 / 合盘三段：农历换算 / 真太阳时 / 晚子时 / 排盘不变量 / 三合派约束）",
};
