/**
 * 本 skill 的**参数作用域** —— 单 skill 认哪些参数（**差量形态**：默认全集，只声明排除项）。
 *
 * @remarks
 * 与 `./parse.ts` 的分工：那份管「怎么解析」，本文件管「认哪些」—— {@link OptionScope}
 * 契约与 {@link OPTION_SCOPE} 值同居于此，本文件不 import 任何模块（依赖图叶子）。
 *
 * ⚠️ **粒度仍是 skill 级**：「本 skill 有、但当前命令不读」的参数仍会被收下不用
 *    （归属只过滤 help 视图，不做硬校验）。差量形态的取舍见 docs/code/cli-args.md。
 */

/**
 * 本 skill 的**参数作用域** —— 声明「声明表里那些参数中，本 skill 认哪些」。
 *
 * @remarks
 * 单 skill 形态下这份清单即全量。声明是**裸参数名的正面清单**，不按「本 skill 认哪些
 * 命令」派生 —— 那会重建解析层刻意不维护的归属表（help 归属表是视图，不做硬校验）。
 */
export interface OptionScope {
	/**
	 * 从声明表**排除**的参数名（差量形态：默认全集）。单 skill 形态下为空数组 ——
	 * 全集即作用域，旧的「正面清单全量手抄」已退役（它恒等于全集，只付拼错静默失效
	 * 与逐项维护两笔成本）。每一项都必须是声明表 `OPTION_GROUPS` 里真有的名字。
	 */
	readonly excluded: readonly string[];
	/** 本 skill 认的出生方前缀（合盘用 `["a-", "b-"]`）；不认就给空数组。 */
	readonly sidePrefixes: readonly string[];
	/**
	 * 哪些命令接受 {@link sidePrefixes} 前缀。空数组表示本 skill 没有这种命令。
	 *
	 * @remarks
	 * ⚠️ 这一维**不能省**：它是「前缀写在别的命令上」这条静默失败的判据。若只看
	 * `sidePrefixes` 非空就放行，`selftest --a-chart` 会从「报错」变成「静默忽略」。
	 */
	readonly prefixedCommands: readonly string[];
	/**
	 * 按参数名覆盖 help 里的说明文案（声明表的 desc 是全集视角时用）。
	 */
	readonly descOverrides?: Readonly<Record<string, string>>;
}

/**
 * ⚠️ 类型标注写成 `: OptionScope`，**不要**改成 `as const satisfies OptionScope`：
 * 后者会把类型钉成字面量对象类型，可选字段没写时 `args.ts` 的访问就编译不过
 * （完整理由见 docs/code/cli-args.md）。
 */
export const OPTION_SCOPE: OptionScope = {
	/**
	 * 从声明表**排除**的参数名（英文主名）。单 skill 形态下为空 —— 将来出现第二个
	 * skill（或要下线某个参数）时，在这里差量声明。
	 *
	 * ⚠️ 每一项都必须是 `OPTION_GROUPS` 里真有的名字：selftest 会盯差集，但「想排除一个
	 *    不存在的名字」仍是拼写错误，别等红灯才发现（见 docs/code/cli-args.md）。
	 */
	excluded: [],
	/**
	 * 出生方前缀已退役：synastry 输入用 `--charts` 单参数 —— 两个空表让解析层的前缀
	 * 分支整个不可达（空表机制的说明见 docs/code/cli-args.md）。
	 */
	sidePrefixes: [],
	prefixedCommands: [],
};
