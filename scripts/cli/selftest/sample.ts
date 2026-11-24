/**
 * 1990-05-15 巳时（时辰5）男；虚构，换样本组改这里，期望值按本盘校准。
 * @remarks 由 `cli/selftest.ts` 与 `selftest/` 下组文件共用。
 * **argv 单点**（评审6/W4）：`SAMPLE_ARGV` 为各断言组 base 唯一来源；
 * `DEMO_*` 供 help 示例/零输入/review-gate/report 共用（值驻角色，argv 在此）。位置参数与变体（如 `--gender abc`）就地保留。
 * @file 排盘断言固定样例盘
 */

import type { BirthInfo } from "@/types";

/** 样例盘。 */
export const SAMPLE: BirthInfo = { year: 1990, month: 5, day: 15, timeIndex: 5, gender: "male" };

/** base 来源。 */
export const SAMPLE_ARGV = ["--date", "1990-05-15", "--branch", "5", "--gender", "male"] as const;

/** help 示例盘——换样例改这里。 */
export const DEMO_PARTS = {
	date: "2011-06-24",
	time: "07:45",
	city: "杭州",
	gender: "male",
} as const;

/** 女盘。 */
export const DEMO_FEMALE_PARTS = {
	date: "1999-11-03",
	time: "15:20",
	city: "成都",
	gender: "female",
} as const;

/** 旗标形态（cli-samples 消费）。 */
export const DEMO_ARGV = [
	"--date",
	DEMO_PARTS.date,
	"--time",
	DEMO_PARTS.time,
	"--city",
	DEMO_PARTS.city,
	"--gender",
	DEMO_PARTS.gender,
] as const;

/** 女盘旗标。 */
export const DEMO_FEMALE_ARGV = [
	"--date",
	DEMO_FEMALE_PARTS.date,
	"--time",
	DEMO_FEMALE_PARTS.time,
	"--city",
	DEMO_FEMALE_PARTS.city,
	"--gender",
	DEMO_FEMALE_PARTS.gender,
] as const;

/** 位置参数形态（`astrology 2011-06-24 07:45 男 杭州`）。 */
export const DEMO_POSITIONAL = ["2011-06-24", "07:45", "男", "杭州"] as const;
