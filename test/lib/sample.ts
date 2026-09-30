// ── 仓库测试的固定样例盘（唯一来源）──
//
// 虚构样本，无真实人物（2026-09-30 起为文档 / help / --template 统一的一组全新虚构组合，
// 旧组合 1990-05-15 北京男 / 1993-08-22 上海女仅在既有断言的期望值锚定中沿用，不进公开文本）。
//
// 为什么收敛到一处：换样本组时改这一处即可（spec §3.4「测试固定样例」）。
// 既有断言的期望值按各自样本校准（大量断言锚定 1990-05-15 盘的具体星曜落宫，
// 整组换样本等于重写全部期望——那不是本文件的目的）。
// **新写测试用例时**优先取这里的常量，不要再手写日期组合。

import type { BirthInfo } from "../../scripts/ziwei/types";

/** 甲方虚构样本：2011-06-24 辰时（07:45），男，杭州 */
export const SAMPLE_A: BirthInfo = { year: 2011, month: 6, day: 24, hour: 4, gender: "male" };

/** 乙方虚构样本：1999-11-03 申时（15:20），女，成都 */
export const SAMPLE_B: BirthInfo = { year: 1999, month: 11, day: 3, hour: 8, gender: "female" };

/** SAMPLE_A 的 CLI 参数形态（配合 buildBirthInfo / 端到端子进程用例） */
export const SAMPLE_A_ARGS = ["--date", "2011-06-24", "--time", "07:45", "--city", "杭州", "--gender", "male"] as const;

/** SAMPLE_B 的 CLI 参数形态 */
export const SAMPLE_B_ARGS = ["--date", "1999-11-03", "--time", "15:20", "--city", "成都", "--gender", "female"] as const;
