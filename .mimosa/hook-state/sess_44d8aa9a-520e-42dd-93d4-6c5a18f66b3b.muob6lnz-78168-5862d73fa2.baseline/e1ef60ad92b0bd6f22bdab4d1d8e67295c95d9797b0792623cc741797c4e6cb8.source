// ── skill 清单（仓库级，唯一源）──
//
// 2026-09-30 三 skill 合一：**仓库根 = skill 根**（根 `SKILL.md` + 根 `scripts/` +
// 根 `references/` + 根 `package.json`），classics 与 synastry 的内核分别住在
// `scripts/classics/` 与 `scripts/synastry/`，命令并入同一条 CLI。清单自此只有一项。
//
// ## 为什么清单仍从磁盘推导
//
// 手写一份名单会在**形态变化时静默漂移**：判据「根下有 `SKILL.md`」是唯一的事实来源
// （缺了它 Claude 根本不会触发这个 skill，自包含断言也会大面积失效）——
// 与本仓「目录存在与否是唯一事实来源」是同一条原则。
//
// ⚠️ 与之相对，{@link CHART_LIKE} **必须手写**：「排不排盘」是语义，磁盘上看不出来。
// 合并后它只剩根一项：合盘 skill 的 SKILL.md 已删，其底座哨兵句（铁律 / 晚子时 /
// 体系硬约束 / 虚岁）由根 SKILL.md 承担（Task 10 重写时补全三域内容）。
//
// ## 用法
//
// `test/` 由 `node --test` 直接跑，与内核一样靠 Node ≥ 22.15 的**原生类型擦除**加载 `.ts`，
// 故本文件对内核一律用**字面相对路径 + 写全 `.ts` 扩展名**，不用 `@/` 别名（那条别名只在
// CLI 运行期与 `tsconfig.json` 的 `paths` 里成立）。本文件**不 import 任何内核代码**：
// 它只读目录、算路径，因此与内核的演化解耦。

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 仓库根 —— 本文件在 `<仓库根>/test/lib/` 下，故退两级。 */
export const REPO_ROOT = resolve(HERE, "../..");

/** 唯一 skill 的名字 —— 排盘 / 古籍 / 合盘三域合一后的单 skill。 */
export const SOURCE_SKILL = "purplestar-astrology";

/**
 * 仓库里全部 skill 名。
 *
 * @remarks
 * 单 skill 形态：判据「仓库根下有 `SKILL.md`」（skill 的入口，缺了它 Claude 不会触发）。
 */
export const ALL_SKILLS: readonly string[] = existsSync(resolve(REPO_ROOT, "SKILL.md"))
	? [SOURCE_SKILL]
	: [];

/**
 * 「排盘类」skill：`SKILL.md` 里持有一份手抄的排盘底座。
 *
 * @remarks
 * `test/repo.test.ts` 会断言它的 `SKILL.md` 含那几条底座哨兵句（铁律 / 晚子时 /
 * 体系硬约束 / 虚岁）。这些是**整节漏抄**的探针，不是逐字校对。
 *
 * ⚠️ 这份名单无法从磁盘推导 —— 「排不排盘」是语义。故它由断言双向盯着：既要求名单里的
 * skill 真实存在，也要求名单非空（空名单会让哨兵检查跑完却什么都没查，那种恒真的守卫
 * 比没有守卫更坏，它会被当成保障）。
 */
export const CHART_LIKE: readonly string[] = [SOURCE_SKILL];

/**
 * skill 的目录绝对路径。
 *
 * @param name - skill 名（单 skill 形态下即 {@link SOURCE_SKILL}）
 * @returns skill 根的绝对路径 = 仓库根
 */
export function skillDir(name: string): string {
	if (name !== SOURCE_SKILL)
		throw new Error(`单 skill 形态下没有第二个 skill：${name}（2026-09-30 三 skill 合一）`);
	return REPO_ROOT;
}
