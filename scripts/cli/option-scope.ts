/**
 * 本 skill 的**参数作用域** —— 单 skill 认哪些参数。
 *
 * @remarks
 * 与 `./args.ts` 的分工：那份是**声明表 + 解析骨架**（`util.parseArgs` tokens 底座 +
 * 薄适配层），本文件则是「本 skill 认声明表里的哪些参数」那一层。
 *
 * ## 差量形态：默认全集，只声明排除项
 *
 * 单 skill 形态下正面清单恒等于
 * `OPTION_GROUPS` 全集（25 项逐字重抄不产生任何信息），却要付两笔成本 —— 拼错
 * 一个名字静默失效（该参数直接不生效），以及每次加参数都要来这里抄一遍。差量形态下
 * `OPTION_NAMES` 由 `args.ts` 从全集派生，手抄清单退役。
 *
 * ⚠️ **粒度仍是 skill 级**：`stars --json` 这类「本 skill 有、但当前命令不读」的参数
 * 仍会被收下不用（归属只过滤 help 视图，不做硬校验）。
 */
import type { OptionScope } from "./args";

/**
 * ⚠️ 类型标注写成 `: OptionScope`，**不要**改成 `as const satisfies OptionScope`：
 * 后者会把 `OPTION_SCOPE` 的类型钉成这里**字面量写出来的那个对象类型**，于是一旦某个
 * 可选字段没写，`args.ts` 里对可选字段的访问就成了「访问一个不存在的属性」而编译不过。
 * 这里也不需要字面量类型（args.ts 只用它做差量过滤）。
 */
export const OPTION_SCOPE: OptionScope = {
	/**
	 * 从声明表**排除**的参数名（英文主名）。单 skill 形态下为空 —— 将来出现第二个
	 * skill（或要下线某个参数）时，在这里差量声明。
	 *
	 * ⚠️ 这里的每一项都必须是 `args.ts` 的 `OPTION_GROUPS` 里真有的名字：selftest
	 * 会盯差集，但「想排除一个不存在的名字」仍是拼写错误，别等红灯才发现。
	 */
	excluded: [],
	/**
	 * 出生方前缀已退役：synastry 输入用 `--charts` 单参数，
	 * a- / b- 前缀不再需要 —— 两个空表让解析层的前缀分支整个不可达。
	 */
	sidePrefixes: [],
	prefixedCommands: [],
};
