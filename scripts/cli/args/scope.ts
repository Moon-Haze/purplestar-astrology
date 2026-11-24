/**
 * 参数作用域：认哪些参数（差量形态：默认全集，只声明排除项）。
 * @remarks 与 `./parse.ts` 分工：那份管「怎么解析」，本文件管「认哪些」（{@link OptionScope}
 * 契约与 {@link OPTION_SCOPE} 值同居）；不 import 模块（依赖图叶子）。
 * ⚠️ 粒度仍 skill 级：「本 skill 有、但当前命令不读」参数收下不用（归属仅过滤 help，不硬校验）；
 * 取舍见 docs/code/cli-args.md。
 * @file 参数作用域
 */

/**
 * 声明「声明表里那些参数中，本 skill 认哪些」。
 *
 * @remarks
 * 单 skill 下清单即全量。裸参数名的正面清单，不按「本 skill 认哪些
 * 命令」派生 —— 否则重建解析层刻意不维护的归属表（help 归属表是视图，不硬校验）。
 */
export interface OptionScope {
	/**
	 * 从声明表排除的参数名（默认全集）；单 skill 下空数组即全集。「正面清单全量手抄」
	 * 已退役（恒等于全集，只付拼错静默失效与维护成本）。每项须是 `OPTION_GROUPS` 真有的名字。
	 */
	readonly excluded: readonly string[];
	/** 本 skill 认的出生方前缀（合盘用 `["a-", "b-"]`）；不认就给空数组。 */
	readonly sidePrefixes: readonly string[];
	/**
	 * 接受 {@link sidePrefixes} 前缀的命令；空数组表示无此命令。
	 *
	 * @remarks
	 * ⚠️ 此维不能省：它是「前缀写在别的命令上」静默失败的判据。若只凭 `sidePrefixes`
	 * 非空放行，`selftest --a-chart` 会从「报错」变成「静默忽略」。
	 */
	readonly prefixedCommands: readonly string[];
}

/**
 * ⚠️ 类型标注写 `: OptionScope`，不要改成 `as const satisfies OptionScope`：后者钉成
 * 字面量类型，可选字段没写时 `args.ts` 访问编译不过（见 docs/code/cli-args.md）。
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
	 * 出生方前缀已退役：synastry 输入用 `--charts` 单参数 —— 两空表让前缀分支不可达
	 * （空表机制见 docs/code/cli-args.md）。
	 */
	sidePrefixes: [],
	prefixedCommands: [],
};
