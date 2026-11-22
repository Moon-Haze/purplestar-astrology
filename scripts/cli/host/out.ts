/**
 * `--out` 的落盘通道 —— 把命令产出的文本写到用户指定文件。
 *
 * @remarks
 * 写入点收敛在唯一函数：路径先过 `..` 段校验（穿越防护），再整体写盘。
 *
 * ⚠️ 末尾补的这一个换行与 `console.log` 的输出行为**逐字一致** —— 两条通道产物可 diff
 *    对拍；落盘后正文不再占 stdout（进度提示走 stderr）。详见 docs/code/cli-chart.md。
 */

import { writeFileSync } from "node:fs";

/**
 * 把 `text` 写入 `path`（覆盖写，末尾恰一个换行）；路径含 `..` 段时抛错。
 *
 * @param path - 目标文件路径（正斜杠与反斜杠都按分隔符切；不允许出现 `..` 段）
 * @param text - 要落盘的正文（本函数负责补末尾换行，与 `console.log` 输出逐字对齐）
 * @returns 无返回值；成功时文件内容即 `text` + 一个换行
 * @throws 路径含 `..` 段时抛错（穿越防护，先于写盘判定）；写盘本身的 IO 错误由 `writeFileSync` 原样抛出
 */
export function writeOutFile(path: string, text: string): void {
	if (path.split(/[\\/]/).includes("..")) {
		throw new Error("--out 路径不允许包含 .. 段");
	}
	writeFileSync(path, `${text}\n`, "utf8");
}
