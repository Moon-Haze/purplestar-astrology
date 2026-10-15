## 目标

落地 [docs/reviews/structure-review-20261011.md](docs/reviews/structure-review-20261011.md) 的候选 1（`OptionScope` 类型归位）与候选 2（`args.ts` 声明数据与解析逻辑分离）。候选 3–5 按报告结论不动。

## 改动一：候选 1 —— `OptionScope` 类型归位

1. `args.ts:83-112` 的 `OptionScope` 接口（含 JSDoc）**剪切到 `option-scope.ts`**，删除其 `import type { OptionScope } from "./args"`（L18）——此后 option-scope 零依赖，类型与 `OPTION_SCOPE` 值同居，模块图严格单向。
2. `args.ts` 删除 L32-34 的「运行期无环」注释（双向引用已消解），`import { OPTION_SCOPE }` 值导入保留（`checkOptionName` 在用）。
3. `args.ts:422` JSDoc 的 `{@link OptionScope.prefixedCommands}` 改为文字指涉；`option-scope.ts` 头注释微调。
4. 影响面已核实：`OptionScope` 全仓仅 option-scope.ts 一处引用，无需 re-export。

## 改动二：候选 2 —— 新建 `args-table.ts` 纯声明面

**新建 `scripts/cli/args-table.ts`（约 250 行，零依赖）**：
`OptionSpec` / `OptionGroup` 接口、`OPTION_GROUPS`（≈190 行）、`OPTION_ALIASES`、`ALL_OPTION_NAMES`、`camelKey`（声明域键名编码规则）。头注释声明「声明面唯一定义处、零逻辑、零依赖」。

**`args.ts`（651 → 约 390 行）保留解析引擎**：`CliArgs` / `CliContext` / `Token` / `ALL_SPECS` / `editDistance` / `suggestOption` / `checkOptionName` / `parseArgs` / `classifyPositionals`，以及 **`OPTION_NAMES` 与 `SIDE_PREFIXES` 留在 args** —— 这里偏离报告原案（原案两个派生 Set 都搬），理由：`OPTION_NAMES` 是「全集 − excluded」的校验域派生而非声明数据，且 `classics/synastry` 两个断言组动态 `import("../cli/args")` 取它；收窄后 args-table 保持零依赖。`args.ts` 从 `./args-table` import：`OPTION_GROUPS` / `OPTION_ALIASES` / `ALL_OPTION_NAMES` / `camelKey` / `type OptionSpec`。

**消费方 import 改道**（数据符号 → args-table，类型/解析/校验符号 → args）：

- `config.ts`：`camelKey`/`OPTION_ALIASES`/`OPTION_GROUPS` → args-table；`CliArgs`/`OPTION_NAMES` 留 args
- `help.ts`：`OPTION_GROUPS`/`OPTION_ALIASES`/`type OptionSpec` → args-table
- `astrology.ts`：`camelKey`/`OPTION_GROUPS` → args-table；`CliArgs` 留 args
- `selftest/args.ts`：`ALL_OPTION_NAMES`/`OPTION_ALIASES` → args-table；`OPTION_NAMES`/`SIDE_PREFIXES`/`parseArgs` 留 args
- `selftest/commands.ts`：`OPTION_GROUPS` → args-table
- `purple-star.ts`：启动自检 `LOADED` 表登记 `@/cli/args-table`（新增 load + 类型 + 表行——沿用「新模块进清单、导出自动受检」的既定设计）；头注释职责描述同步

## 不改的

`classics/synastry` 断言组动态 import（`OPTION_NAMES` 留 args 后无需动）；fortune、astrology 主体、help 逻辑等全部候选 3–5 项。

## 执行步骤

1. 重取基线：当前工作区跑 `selftest` 两次确认输出稳定并存档。
2. 改动一（候选 1）→ 验证：`tsc` + selftest 输出 diff=0。
3. 改动二（候选 2，含 6 个消费方改道与 LOADED 登记）→ 验证：`tsc` + selftest diff=0 + `npm test` + `npx tsx tools/cli-samples.ts` + prettier。
4. 评估报告 `docs/reviews/structure-review-20261011.md` 候选 1/2 标注「已实施」。

## 验收口径

- selftest 报告输出与基线逐字节一致（断言名/detail/顺序零变化）；
- `npm test` 533 全绿、cli-samples 52/52、tsc 与 prettier 通过；
- import 依赖图实测：option-scope 零依赖、args-table 零依赖、args → args-table + option-scope 单向。
