/**
 * 排盘断言的固定样例盘：1990-05-15 巳时（时辰序号 5），男。
 *
 * @remarks
 * 虚构样本，无真实人物（换样本组时改这一处；各断言的期望值均按本样本盘校准）。
 * 各断言组共用，由 `cli/selftest.ts` 与 `selftest/` 下组文件 import。
 */

import type { BirthInfo } from "@/ziwei/types";

export const SAMPLE: BirthInfo = { year: 1990, month: 5, day: 15, timeIndex: 5, gender: "male" };
