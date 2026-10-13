/**
 * `--out` 的落盘通道 —— 把命令产出的文本写到用户指定文件。
 *
 * @remarks
 * 写入点收敛在唯一函数：路径先过 `..` 段校验（穿越防护，子目录与绝对路径不受影响），
 * 再整体写盘。末尾补的这一个换行与 `console.log` 的输出行为逐字一致 —— 两条通道
 * 产物可 diff 对拍；落盘后正文不再占 stdout（进度提示由引导层走 stderr）。
 */

import { writeFileSync } from "node:fs";

/** 把 `text` 写入 `path`（覆盖写，末尾恰一个换行）；路径含 `..` 段时抛错。 */
export function writeOutFile(path: string, text: string): void {
	if (path.split(/[\\/]/).includes("..")) {throw new Error("--out 路径不允许包含 .. 段");}
	writeFileSync(path, `${text}\n`, "utf8");
}
