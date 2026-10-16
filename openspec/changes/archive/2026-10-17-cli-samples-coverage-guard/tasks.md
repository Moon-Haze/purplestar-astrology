# Tasks

## 1. 覆盖自检落地

- [x] 1.1 在 `tools/cli-samples.ts` main 的样例输入文件自检之后加参数覆盖自检：
  `OPTION_GROUPS`（`@/cli/args/table`）扁平化 `--<name>` 全集 ⊆ SAMPLES args 出现集
  （`--x=v` 形态取 `=` 前）；缺失指名报错退出。完成判据：`npx tsx tools/cli-samples.ts`
  在当前 SAMPLES 下要么通过、要么列出的缺口全部补齐后通过；`npm run typecheck` 0 错误。
- [x] 1.2 若 1.1 亮出现存缺口：在 SAMPLES 就近组别补样例（虚拟示例数据口径不变），
  并复核 `docs/cli-samples.md` 再生成后 diff 仅含新增节。完成判据：自检过 + 文档与
  实际输出一致（工具本身逐条实跑生成）。
- [x] 1.3 风格与回归：`npx prettier --check tools/cli-samples.ts` 过；
  `node scripts/purple-star.ts selftest` 全绿（本改动不触 scripts/，确认零波及）。

## Workflow follow-up

- 归档：`openspec archive cli-samples-coverage-guard`；提交等用户指示。
