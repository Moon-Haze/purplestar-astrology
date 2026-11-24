/** @remarks docs/code/cli-chart.md */

import { writeFileSync } from "node:fs";

/**
 * @param path - 无 `..`
 * @param text - 正文
 * @returns 无
 * @throws `..`/IO 原样抛
 */
export function writeOutFile(path: string, text: string): void {
	if (path.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	writeFileSync(path, `${text}\n`, "utf8");
}
