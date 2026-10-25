# Design

## Context

`knowledge/types.ts` 与四个 `sources/*.ts` 各自 `import type { CliArgs } from "@/cli/args"`；
`search(args: CliArgs)` 拿到松散索引签名（`[key: string]: string | boolean | string[]`）的全量参数，
各源做 `typeof x === "boolean"` + `String(x)` 防御收窄。2026-10-24 已把 `--search`/`--limit`
三态守卫收进 `assertKnowledgeArgs`（只校验不解码），但刻意保留 `CliArgs` 签名。动机见 proposal.md。

不可逾越约束：ADR-002（清单注册一行）、ADR-003（插件层禁止反向依赖 cli/）、参数声明单点在
`cli/args/table.ts`（解码层只消费不声明）、2026-10-24 否决「单一公共查询对象」（oracle 位置语义异构）。

## Goals / Non-Goals

**Goals:**

- 插件层（`knowledge/`）运行时与类型上都不再依赖 `cli/args`
- 四源的防御性收窄（`typeof === "boolean"` + `String()`）消失，读到的字段已是精确类型

**Non-Goals:**

- 不统一「位置参数回退」语义（各域仍是域知识）
- 不改检索行为、错误语义、清单注册形态

## Decisions

1. **`KnowledgeQuery` 精确字段 + `positional` 原样透传。**
   字段：`term?: string`、`limit: number`（默认 15）、`book?: string`、`topic?: string`、
   `star?: string`、`positional: string[]`。`positional` 保留原始位置参数，oracle 仍自己读
   `positional[0]`/`positional[1]` —— 这正是对 2026-10-24 否决的规避：**不搞公共解码对象**，
   只把**已集中的守卫**升级为**解码**。备选「单一公共查询对象」已否决（oracle 位置语义塞不下），
   不重开。
2. **`assertKnowledgeArgs` 升级为 `decodeKnowledgeQuery(args, source): KnowledgeQuery`。**
   校验逻辑不变（`--search` 裸开关 throw、`--limit` 正整数），新增解码：`String()`/`Number()` 收窄
   与默认 limit 15。`--book`/`--topic` 裸开关守卫从 tianji/oracle 源内上收到此函数（与 `--search`
   同口径，报错文案骨架不变）。`source` 参数只用于拼例句，**不引入 per-source 分支解码**。
3. **四源 `search(query: KnowledgeQuery)` 直读精确字段，删 `CliArgs` import 与防御收窄。**
   `term` 是 `--search` 值（未给为 undefined）；位置参数回退留各源——books/stars 的
   `q = query.term ?? query.positional.join(" ")`，tianji 再叠 `?? ""`，
   oracle 的 `topic = query.topic ?? query.positional[0]`、`star = query.star ?? query.positional[1]`。
   `--book` 裸开关守卫已在入口 throw，tianji 直接读 `query.book ?? ""`。

**三问：**

- deletion test：删掉 `KnowledgeQuery` 会让插件层重新 import `cli/args`、四源重新写防御收窄——
  复杂度回到「插件层依赖 CLI 类型」，故是**集中**（消除反向依赖）而非搬家。
- 接缝判据：新增域仍「一个文件 + 一行注册」；解码是「取字段」而非「按 source 分派」，不新增分支。
- 抽象 justify：删掉 `KnowledgeQuery` 会多写 4 处 `typeof === "boolean"` + `String()` 防御收窄
  与 5 处 `import type { CliArgs }`。

## Risks / Trade-offs

- [decode 收窄引入默认 limit 15 的单一位置] → 默认值仍单点（decode 内），不复制到各源
- [`--book`/`--topic` 守卫上收改变报错触发位置] → 文案骨架不变、退出码不变，selftest 断言以行为为准
- [类型边界搬迁被当「纯搬家」] → 收益是 ADR-003 字面合规 + 防御收窄消除，逐字节 diff 护航证明非搬家

## Migration Plan

1. 加 `KnowledgeQuery` + `decodeKnowledgeQuery` → 2. 四源改签名删防御收窄 → 3. selftest 复核 →
2. 四域输出逐字节 diff + typecheck。回滚：单提交 revert。
