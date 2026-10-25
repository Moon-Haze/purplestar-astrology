# Proposal

## Why

架构评审 2026-10-25（候选 1）：`KnowledgeSource.search(args: CliArgs)` 把整张 CLI 参数面
（松散索引签名 `string | boolean | string[]`）递给四个域实现，`knowledge/types.ts` 与四个
`sources/*.ts` 各自 `import type { CliArgs } from "@/cli/args"` —— 插件层反向依赖 `cli/` 类型，
与 ADR-003「插件层禁止反向依赖 `cli/`」的 extensibility 场景字面冲突（该场景未豁免 type-only import）。

2026-10-24 的 `unify-knowledge-source-interface` 已把 `--search`/`--limit` 三态守卫收进
`assertKnowledgeArgs`，但刻意保留了 `search(args: CliArgs)` 签名（「单一查询对象」收窄因
oracle 位置参数异构被否决）。本变更**不重开那次否决**，只完成「归一层」的下一半：把守卫从
「只校验」升级为「校验 + 解码」，让插件层彻底脱离 `cli/args` 类型。

## What Changes

- 新增 CLI 无关的 `KnowledgeQuery` 类型（`knowledge/types.ts`）：精确字段 `term` / `limit` /
  `book` / `topic` / `star` / `positional`（`positional` 保留原始位置参数，供 oracle 的
  `_[0]`/`_[1]` 异构语义自己消费，不做公共解码）
- `cli/knowledge/index.ts` 的 `assertKnowledgeArgs` 升级为 `decodeKnowledgeQuery(args, source)`：
  校验（不变）之外，把 `--search`/`--limit`/`--book`/`--topic`/`--star` 解码成精确类型并返回；
  `--book`/`--topic` 裸开关守卫从 tianji/oracle 源内上收到入口（与 `--search` 同口径）
- 四源 `search(query: KnowledgeQuery)` 签名收窄：删各自 `import type { CliArgs }` 与
  `typeof x === "boolean"` + `String(x)` 防御性收窄；`knowledge/types.ts` 与 registry 不再 import
  `@/cli/args`

## What Doesn't Change

- **不重开 2026-10-24 否决**：不搞「单一公共查询对象」——位置参数回退**留各域**（books/stars/
  tianji 回退为检索词、oracle 回退为 topic/star），这正是当时否决「签名收窄 + 查询对象」的理由，
  本变更以「`positional` 原样透传」规避该否决，不改域知识归属
- **检索行为不变**：books 多关键词 AND、高亮位置、默认 limit、各域输出内容零变化
- **错误语义不变**：缺值/非法一律 throw（非零退出 + stderr），仅 `--book`/`--topic` 守卫的
  **位置**从源内挪到入口，报错文案骨架不变
- **清单注册不动**（ADR-002）：registry 仍是 `Record<string, KnowledgeSource>`，新增域 = 写文件 + 加一行

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `knowledge-retrieval`: 「知识源可插拔」需求的 `search` 签名从 `CliArgs` 改为 CLI 无关的
  `KnowledgeQuery`，并新增「插件层不依赖 `cli/args` 类型」场景

## Impact

- 代码：`scripts/knowledge/types.ts`（`KnowledgeQuery` + 接口签名）、`scripts/knowledge/sources/{books,stars,tianji,oracle}.ts`（签名收窄、删防御收窄）、`scripts/cli/knowledge/index.ts`（`decodeKnowledgeQuery`）
- 验证义务：**纯重构档**（行为不变）——`knowledge --source {books,stars,tianji,oracle}` 四域
  输出与错误路径退出码**逐字节 diff=0**（先取基线）；`npm run typecheck` 零错；`selftest` 全绿
