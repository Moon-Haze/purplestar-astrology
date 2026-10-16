// `args/index.ts` —— 参数面的统一出口（`@/cli/args` 的落点）：聚合本目录四个模块，
// 使 `CliArgs` / `CliContext` 等公共类型锚点的引用方一字不改。
//
// ⚠️ 本门面**只 re-export 被外部实际消费的符号**，不做「整目录转手」—— 多导出一个符号
//    就多一处可能与源模块脱钩的名单。门面定位与消费方清单见 docs/code/cli-args.md。
export type { CliArgs, CliContext } from "./parse";
export { parseArgs, OPTION_NAMES, SIDE_PREFIXES } from "./parse";
