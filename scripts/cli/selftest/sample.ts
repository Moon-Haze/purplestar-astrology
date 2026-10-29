/**
 * 排盘断言的固定样例盘：1990-05-15 巳时（时辰序号 5），男。
 *
 * @remarks
 * 虚构样本，无真实人物（换样本组时改这一处；各断言的期望值均按本样本盘校准）。
 * 各断言组共用，由 `cli/selftest.ts` 与 `selftest/` 下组文件 import。
 *
 * 本文件同时是**虚构样本的 argv 单点**（评审候选 6 / W4）：`SAMPLE_ARGV` 是各断言组
 * base 数组的唯一来源；`DEMO_*` 是 help 示例 / 零输入演示（cli/commands/astrology-context
 * 的 SAMPLE_BIRTH）/ review-gate / report 测试共用的同款虚构组合 —— 值驻各角色处，
 * argv 形态在此单点。期望值锚定、位置参数形态与变体（如 `--gender abc`）按需就地保留。
 */

import type { BirthInfo } from "@/types";

export const SAMPLE: BirthInfo = { year: 1990, month: 5, day: 15, timeIndex: 5, gender: "male" };

/** SAMPLE 的 CLI 旗标形态（selftest 各断言组的 base 数组由此派生）。 */
export const SAMPLE_ARGV = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"] as const;

/** help 示例同款虚构盘（2011-06-24 07:45 杭州男）—— 旗标形态。 */
export const DEMO_ARGV = [
	"--date",
	"2011-06-24",
	"--time",
	"07:45",
	"--city",
	"杭州",
	"--gender",
	"male",
] as const;

/** 同款女盘（1999-11-03 15:20 成都女）—— 旗标形态。 */
export const DEMO_FEMALE_ARGV = [
	"--date",
	"1999-11-03",
	"--time",
	"15:20",
	"--city",
	"成都",
	"--gender",
	"female",
] as const;

/** DEMO 的位置参数形态（`astrology 2011-06-24 07:45 男 杭州`）。 */
export const DEMO_POSITIONAL = ["2011-06-24", "07:45", "男", "杭州"] as const;
