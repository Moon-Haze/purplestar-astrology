/**
 * 本 skill 的**旗标作用域** —— 古籍检索认哪些旗标。
 *
 * @remarks
 * 与 `./args.ts` 的分工：那份是**三份逐字节相同**的副本（声明表 + cac/mri 的解析骨架），
 * 本文件则是**各 skill 自己写**的那一层差异。故它不进同步清单（见 `tools/skills.ts`），
 * 派生 skill 里各有一份内容不同的同名文件。
 *
 * ## 正面清单，且刻意不按命令派生
 *
 * 只列「认哪些旗标」，不列「哪条命令读哪个旗标」—— 后者正是 `args.ts` 的
 * {@link checkFlagName} 明确拒绝维护的归属表（见那里的 ⚠️）。正面清单还天然 fail-closed：
 * 往声明表加一个新旗标，它不会自动泄漏给没声明它的 skill，加的人必须决定它归谁。
 *
 * ## 本 skill 只认两个旗标，且不含任何出生信息
 *
 * 古籍检索**不排盘**：本 skill 的内核里没有 `ziwei/`，`classics` 命令也不读日期 / 时辰 /
 * 性别。故那些旗标在这里既不注册（help 里看不到）也不被接受（用了直接报「未知参数」），
 * 而不是以前那样被静默收下不用。
 *
 * ⚠️ 两条连带影响，改 `SKILL.md` 时要记住：
 *   · `SKILL.md` 里曾有一句「help 的参数段会列出 `--date` / `--gender` 等用不上的旗标」
 *     —— 收窄后不再成立，那句必须删（本 skill 的 `selftest` 会扫 `SKILL.md` 提到的旗标，
 *     提到 `--date` 就会变红）。
 *   · `--limit` 是**本 skill 独有**的旗标：另外两个 skill 的作用域里都没有它。
 */
import type { FlagScope } from "./args";

/**
 * ⚠️ 类型标注写成 `: FlagScope`，**不要**改成 `as const satisfies FlagScope`：
 * 后者会把 `FLAG_SCOPE` 的类型钉成这里**字面量写出来的那个对象类型**，于是一旦某个
 * 可选字段没写，`args.ts` 里对它的可选访问就成了「访问一个不存在的属性」而编译不过
 * —— 可选字段的「可选」在那一侧整个失效。这里也不需要字面量类型。
 */
export const FLAG_SCOPE: FlagScope = {
	/**
	 * `--search` 检索关键词、`--limit` 命中条数上限。
	 *
	 * ⚠️ 这里的每一项都必须是 `args.ts` 的 `FLAG_GROUPS` 里真有的名字：拼错不会报错，
	 * 只会让那个旗标在**本 skill 里失效**（用户在 help 里看不到它，用了则报「未知参数」）。
	 * 仓库测试盯这条：各作用域 ⊆ 全集，且全集 ⊆ 三作用域之并 —— 后半句意味着
	 * **每个旗标都得有归属**，`--limit` 归本 skill。
	 */
	flags: ["search", "limit"],
	/** 古籍检索没有「两方出生信息」这回事，前缀在本 skill 里整个不可达。 */
	sidePrefixes: [],
	prefixedCommands: [],
	/** 声明表里的 desc 是**全集视角**写的（「classics / stars / cities」），本 skill 只有 classics。 */
	descOverrides: {
		search: "检索关键词（也可用位置参数）",
	},
};
