/**
 * @file 单 skill 清单与排盘能力判定；全文见 docs/code/boot-layer.md。
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** 仓库根（本文件在 test/lib/ 下退两级）。 */
export const REPO_ROOT = resolve(HERE, "../..");

/** 唯一 skill 名。 */
export const SOURCE_SKILL = "purplestar-astrology";

/** 全部 skill 名（判据：根下有 SKILL.md）。 */
export const ALL_SKILLS: readonly string[] = existsSync(resolve(REPO_ROOT, "SKILL.md"))
	? [SOURCE_SKILL]
	: [];

/** 「排盘类」skill（语义判定，见 docs/code/boot-layer.md）。 */
export const CHART_LIKE: readonly string[] = [SOURCE_SKILL];

/**
 * skill 根目录绝对路径。
 * @param name - skill 名
 * @returns 绝对路径
 * @throws name 非 SOURCE_SKILL 时抛错
 */
export function skillDir(name: string): string {
	if (name !== SOURCE_SKILL) {
		throw new Error(`单 skill 形态下没有第二个 skill：${name}`);
	}
	return REPO_ROOT;
}
