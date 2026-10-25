# Tasks

## 1. 类型收窄

- [x] 1.1 `scripts/school/types.ts` 的 `ForbiddenFeature` 从 `"self-mutagen" | "lai-yin" | (string & {})` 收成闭集 `"self-mutagen" | "lai-yin"`，顶部注释同步（不再声称可放任意特征，guard 只兑现已声明的特征）。判据：`npm run typecheck` 零错（`wenmo-nishi` 的 `forbiddenFeatures: ["self-mutagen","lai-yin"]` 仍合法，typecheck 兜底闭集）

- [x] 1.2 确认 `checkForbiddenFeatures` 两分支与闭集一致（`self-mutagen` 真查、`lai-yin` 空分支注释已如实化，不动）。判据：`node scripts/purple-star.ts selftest` 全绿；`test/school.test.ts` 绊线断言一字未动且通过

## 2. 验证

- [x] 2.1 五闸门：`npm run typecheck`（0 错）、`node scripts/purple-star.ts selftest`（全绿）、`npm test`（全绿）、`npm run lint`、`npm run format`（干净）。判据：各命令退出码 0、无报错
