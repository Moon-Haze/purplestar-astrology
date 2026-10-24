# Design

## Context

见 proposal.md（Why 与 exit code 漂移实锤）。约束：参数声明单点在 `cli/args/table.ts`（归一层只消费不声明）；registry 清单注册纪律（ADR-002）不动；knowledge/ 与 cli/ 之间的静态反向依赖是 ADR-003 红线，现状靠 sources/* 的 `await import` 断环。

## Goals / Non-Goals

**Goals:**

- 三态判定 / 位置参数回退 / limit 校验从四份抄写收敛为一个归一层
- 错误语义单点：缺值 / 非法一律非零退出 + stderr
- 删三个 deletion test 不过的转发壳；「一个域住哪」只有一个答案（`cli/knowledge/`）
- 生年四化适配（chart → 年干）从 cli/fortune 归位内核 mutagen，六层可空性进类型

**Non-Goals:**

- 不改检索行为（命中集合、排序、高亮、默认 limit）
- 不重构 knowledge/ ↔ cli/ 的分层方向（动态 import 断环模式维持；进一步分离留待将来独立变更）
- 不动 `--charts` / astrology 等其余命令的参数处理

## Decisions

> **apply 期修订（2026-10-24）**：决策 1/2/4 按实现期发现修订如下——① oracle 的位置参数
> 语义异构（`args._[0]/[1]` 是 topic/star 而非检索词），公共「查询对象」塞不下域特定回退，
> 真正四域同形的只有三态判定与 limit 校验；② `sources/stars.ts` 现状已是 kernel 静态
> 反向 import cli（ADR-003 灰区既存），且 extensibility 落地状态表格写死 `sources/*.ts`
> 位置——归位方向反转：三域渲染实现从 cli/knowledge/ 挪进 kernel sources/（与 books
> 同层），cli↔kernel 往返彻底消除，registry 一行不动。

1. **归一层形态：命令入口前置守卫（`assertKnowledgeArgs`），`search(args: CliArgs)` 签名不动。**
   守卫单点做两件四域同形的事：`--search` 裸开关（boolean）一律 throw；`--limit` 给了就必须是正整数（统一文案，books/tianji 两份合一）。位置参数回退**留各域**——它是域知识（books/stars/tianji 回退为检索词、oracle 回退为 topic/star），收进公共层反而制造特例。备选「产出解码查询对象 + 签名收窄」被 oracle 位置语义否决。
2. **错误语义统一为 throw（非零退出 + stderr）。** books.ts 既有注释自证 return 是错的（「机器路径无法感知」）；books 的 `--search` 缺值分支由入口守卫统一 throw；selftest 现固化两种「正确」的断言随之修正（books 缺值从「stdout 含文案」改「非零退出」）。
3. **（保留）错误文案保留域语境**：守卫的报错文案统一骨架（参数名 + 期望 + 实得 + 例句），例句由守卫按 `--source` 现域拼域语境（如「knowledge --source stars 紫微」）。
4. **归位方向：三域渲染实现挪 `knowledge/sources/`（与 books 同层、同「实现即插件」形态），删三个纯转发壳。** cli/knowledge/ 只剩 index.ts（命令入口 + 前置守卫）。registry.ts 一行不动（它引用的 `sources/*` 从壳变实现）。ADR-003 运行时面干净：sources/* 运行时只依赖 kernel 数据（`@/corpus` / `@/analysis` / `@/data/stars`）与 `cli/args` 的**纯类型**（擦除，与 books.ts 现状同款）；懒加载纪律不变（tianji/oracle 重数据的 `await import` 随实现住在 `search` 函数体内）。
5. **`getNativeMutagen(chart)` 落内核 mutagen.ts 并入冻结面。** 六层符号已被 kernel-contract 冻结；新增第七个导出按纪律显式同步该测试（断言「六层 + 生年适配」的符号存在与返回形状），不改既有断言语义。可空性统一为同一结果类型（简单联合即可——「哪层可空」进类型签名）。
6. **流日非法日期的中文报错随函数下沉内核**（现在 fortune 侧 throw 的文案搬进 getDailyMutagen 的参数校验）。

## Risks / Trade-offs

- [books 挪位与删壳是文件物理变动] → 三类字符串排查进任务：import 语句、`load<>("@/…")` 字面量、`resolve(ctx.root, …)` 拼路径
- [cli-samples 若收录 books 缺值样例，期望值从 exit 0 变 exit 1] → 改完跑覆盖守卫（OPTION_GROUPS ⊆ SAMPLES）与样例重生成，期望值同步
- [kernel-contract 同步被误当「顺手改断言」] → 同步仅新增断言项，既有六层断言一字不动；提交说明显式引用冻结面纪律
- [四域错误文案统一可能丢域内语境] → 统一的是通道（stderr）与退出码，文案保留域语境（例句各自给）

## Migration Plan

1. 归一层 + 接口签名收窄 → 2. 四域改写 + books 挪位 + 删三壳 → 3. selftest 断言修正 → 4. getNativeMutagen + 冻结面同步 → 5. 五闸门 + 样例重生成。回滚：单提交 revert。

## Open Questions

（无）
