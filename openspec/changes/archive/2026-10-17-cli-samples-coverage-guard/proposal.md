# Proposal

## Why

`tools/cli-samples.ts` 头部承诺「覆盖 help 的 OPTIONS 段全部参数」且自认样例表手动维护，
但全仓无任何守卫盯这层覆盖：新增 CLI 参数忘补样例时，`docs/cli-samples.md` 静默缺节，
无红灯。参数唯一真相源 `OPTION_GROUPS` 的另两个下游（help 归属投影、selftest 的
SKILL.md 对拍）都已有守卫，唯 cli-samples 这个消费者裸奔（architecture-review-20261016
候选 5）。

## What Changes

- 在 cli-samples 的 main 启动段（现有「样例输入文件自检」旁）加一条**派生自检**：
  遍历 `OPTION_GROUPS` 扁平化参数名，断言每个至少出现在一条 `SAMPLES` 的 args 里
  （`--focus=命宫` 与 `--focus 命宫` 两种形态都算），缺失则 `console.error` 指名并
  `process.exit(1)`——与现有文件自检同一失败形态。
- 检查对象从声明表**派生**，不引入第二份参数清单；守卫放工具自身而非 `test/`
  （tools/ 不进分发件，分发包内读不到；且这是工具的输入完整性检查，不是回归断言）。

## 不做什么

- 不新增 `test/*.test.ts`、不动 selftest / specs（`skip_specs: true`）。
- 不自动生成缺失样例（指名缺口，补样例仍是人工判断组别与文案的活）。
- 不改 SAMPLES 表内容（除非自检亮出现存缺口——那正是要暴露的）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——tools 侧自检，无 spec 级行为变化）

## Impact

- 仅 `tools/cli-samples.ts`（+1 段自检 +1 行 import）。
- 若现存样例已有缺口，本变更落地当天会暴露（补齐属于本变更 tasks）。
