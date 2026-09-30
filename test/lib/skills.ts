// ── skill 清单（仓库级，唯一源）──
//
// 本仓是**多个自包含 skill 的集合**：`skills/` 下每个子目录都能单独拷进
// `~/.claude/skills/` 直接使用，各自的 `SKILL.md` / `package.json` / `scripts/` 齐备。
//
// ⚠️ **2026-09-27 起，skill 之间不再有派生关系。** 此前排盘解读是唯一的内核来源、其余
// skill 由它派生，副本的一致性由一个同步器加一批逐字节断言维持（`tools/skills.ts` +
// `tools/sync-skills.ts`，两份都已删除）。断开之后每个 skill 都是普通 skill：文件就是它
// 自己的实现，读代码的人不必先问「这是源还是副本」。
//
// 所以本文件从一个 353 行的**切片声明**缩成了现在的样子：同步器没有了，「要复制哪些文件」
// 也就无从谈起。剩下的是测试侧真正需要的那几件事实 —— 仓库根在哪、有哪些 skill、
// 哪些是「排盘类」。
//
// ## 为什么 `ALL_SKILLS` 是从磁盘读的
//
// 手写一份名单会在**新增 skill 时静默漏掉它**：漏掉的 skill 不参与 `SKILL.md` 的接线检查、
// 不参与自包含检查，而那份名单看上去仍然是「完整的」。这与本仓「能派生的派生」是同一条
// 原则 —— 目录存在与否是唯一的事实来源，不必由谁记得回来补一行。
//
// ⚠️ 与之相对，{@link CHART_LIKE} **必须手写**：「排不排盘」是语义，磁盘上看不出来。
// 它只有两个成员，且其中一个（源）是另一份实现的出处，改它的机会很少。
//
// ## 用法
//
// `test/` 由 `node --test` 直接跑，与内核一样靠 Node ≥ 22.15 的**原生类型擦除**加载 `.ts`，
// 故本文件对内核一律用**字面相对路径 + 写全 `.ts` 扩展名**，不用 `@/` 别名（那条别名只在
// 源的 CLI 运行期与 `tsconfig.json` 的 `paths` 里成立）。本文件**不 import 任何内核代码**：
// 它只读目录、算路径，因此与内核的演化解耦。

import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 仓库根 —— 本文件在 `<仓库根>/test/lib/` 下，故退两级。 */
export const REPO_ROOT = resolve(HERE, "../..");

/** 各 skill 所在目录。 */
export const SKILLS_DIR = resolve(REPO_ROOT, "skills");

/** 源 skill 的目录名 —— 排盘内核的唯一出处，其余 skill 不再由它派生。 */
export const SOURCE_SKILL = "purplestar-astrology";

/**
 * 仓库里全部 skill 名（已排序）。
 *
 * @remarks
 * ⚠️ 2026-09-30 中间态（单 skill 合并进行中）：源 skill 已上提仓库根（仓库根 = skill 根），
 * classics / synastry 仍原地待搬。故清单 = 根（以 {@link SOURCE_SKILL} 名义）+ 磁盘读
 * `skills/` 下尚存的目录；Task 2 收口后清单收敛为「从根 SKILL.md 推导单 skill」。
 */
export const ALL_SKILLS: readonly string[] = [
	SOURCE_SKILL,
	...readdirSync(SKILLS_DIR, { withFileTypes: true })
		.filter(e => e.isDirectory() && existsSync(resolve(SKILLS_DIR, e.name, "SKILL.md")))
		.map(e => e.name),
].sort();

/**
 * 「排盘类」skill：`SKILL.md` 里持有一份手抄的排盘底座。
 *
 * @remarks
 * `test/repo.test.ts` 会断言它们的 `SKILL.md` 含那几条底座哨兵句（铁律 / 晚子时 /
 * 体系硬约束 / 虚岁）。这些是**整节漏抄**的探针，不是逐字校对 —— 排盘类 skill 的
 * `SKILL.md` 各有一份手抄的底座，而它们**不能**逐字节相同（合盘的旗标带 `--a-` / `--b-`
 * 前缀），故只能用哨兵。
 *
 * ⚠️ 这份名单无法从磁盘推导 —— 「排不排盘」是语义，不是文件名或目录形状的产物。
 * 故它由断言双向盯着：既要求名单里的 skill 真实存在，也要求名单非空
 * （空名单会让哨兵检查跑完却什么都没查，那种恒真的守卫比没有守卫更坏，它会被当成保障）。
 */
export const CHART_LIKE: readonly string[] = [SOURCE_SKILL, "purplestar-synastry"];

/**
 * skill 的目录绝对路径。
 *
 * @param name - skill 名（即 `skills/` 下的目录名）
 * @returns skill 根的绝对路径；源 skill（已上提）为仓库根本身
 */
export function skillDir(name: string): string {
	return name === SOURCE_SKILL ? REPO_ROOT : resolve(SKILLS_DIR, name);
}
