// `args/index.ts` —— 参数面的统一出口（`@/cli/args` 的落点）。
//
// ## 为什么是门面而不是改写引用方
//
// `CliArgs` / `CliContext` 是**全 CLI 的公共类型锚点**：`knowledge/` 各源、`selftest` 各组、
// `commands/` 与 `host/` 都从 `@/cli/args` 取它。本门面聚合本目录四个模块，
// 使这些引用一字不改 —— 目录分组是**物理组织**的变更，不该连带改语义引用。
//
// ⚠️ 本门面**只 re-export 被外部实际消费的那些符号**（下表即全部），
// 不做「整目录转手」：门面多导出一个符号，就多一处可能与源模块脱钩的名单。
// 各模块之间仍按需直接 import 具体文件（`./parse` / `./table`），不必绕本门面。
//
// | 符号 | 来源 | 谁在用 |
// |---|---|---|
// | `CliArgs` `CliContext` | `parse.ts` | 全 CLI 类型锚点（knowledge / selftest / commands / host） |
// | `parseArgs` | `parse.ts` | selftest 各组、引导层 |
// | `OPTION_NAMES` `SIDE_PREFIXES` | `parse.ts` | selftest 参数组、`config-input` |
export type { CliArgs, CliContext } from "./parse";
export { parseArgs, OPTION_NAMES, SIDE_PREFIXES } from "./parse";
