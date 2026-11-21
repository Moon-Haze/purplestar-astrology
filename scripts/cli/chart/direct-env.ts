/**
 * 回归 / 对拍链路的**直排豁免常量** —— 「缓存只求快、绝不参与正确性」这条纪律在
 * spawn 侧的机制层表达（评审 2026-11-21 N2）。
 *
 * @remarks
 * 决策「回归链路必须直排」此前住在各 spawn 点的 env 手抄里，`tools/review-gate.ts` 的
 * byte-diff 快照（「重构不改行为」的验收工具）恰恰漏抄一处 —— 重构若改了排盘输出又忘
 * 递增 `CACHE_VERSION`，对拍两侧读同一份旧缓存，在最需要暴露漂移的工具里假绿。
 *
 * 本模块只收编**同形的 env 决策**这一半：各消费点保留自己的 spawn 形态与内核根策略
 * （「机制共用、策略各异」，spawn 探针不收编的论证见 `cli/selftest/kit.ts` 头注），
 * 只把本常量 spread 进自己的 env。键名必须与 `chart-cache.ts` 读取的 env 键一致 ——
 * 缓存机制在本目录，豁免开关也在这里。
 */
export const DIRECT_CHART_ENV = { ZIWEI_NO_CACHE: "1" } as const;
