# Proposal

## Why

架构评审 2026-10-25（候选 2）：性别内容裂成两套机制——`summary` 已是结构化 `male/female`，
但 `STAR_CONTENT_MAP` 其余十三个宫位字段（`mingGong`/`personality`/`fuQi`/`guanLu`/`caiBo`/
`jiE`/`xiongDi`/`ziNv`/`qianYi`/`jiaoYou`/`tianZhai`/`fuDe`/`fuMu`/`topic_mods`，`data.ts` 101 处）
把性别子句当内联标记（`；女命…` / `女命…。` / `（女命）…`）塞进散文，靠 `filterGenderContent`
在成稿末尾用正则剥离。标记约定是数据作者与过滤器之间的**隐式接口**：新增宫位文案必须记得按
约定写标记，漏写即男命看到女命句。这是「文本即接口」的脆弱 seam。

## What Changes

- `StarContent` 各宫位字段从 `string` 改为结构化 `{ common: string; male?: string; female?: string; suffix?: string }`
  （共享散文进 `common`，性别专属子句进 `male`/`female`，中置性别段的后缀进 `suffix`）
- `STAR_CONTENT_MAP` 全量重写：101 处内联性别标记拆进结构化字段（改源文案，不碰排盘内核）
- 删除 `filterGenderContent` 及其在 `analysis/index.ts`、`analysis/report.ts` 的两处调用；
  view 层按 `ctx.gender` 选 `common + (male|female) + suffix` 拼接
- `analysis/context.ts` 暴露 `gender`；`analysis/views/*.ts` 消费点改为结构化投影
- `analysis/grades.ts` 的 `NI_GRADES` 字段路径（`mingGong`、`topic_mods.*.ji` 等）随结构同步；
  引文守卫的匹配逻辑适配结构化字段

## What Doesn't Change

- **输出不变（核心契约）**：`astrology --topic` 与 `--report` 在给定性别下的输出与改前
  （正则剥离后）**逐字节一致**——`filterGenderContent` 作为迁移期独立预言机，结构化版本必须
  复现其剥离结果，复现不了即结构化有误
- **不碰排盘内核**（`algorithm.ts`/`mutagen.ts`/`patterns/`/`data/`/`wenmo-brightness.ts`）——
  纯内容层重构，内核回归（`selftest` 排盘段 / `npm test` 内核层）不必重跑，项数不得变动
- **oracle 手册与天纪语料不改源**：`corpus/data/manual/*`（生成快照）与 `corpus/data/tianji.ts`
  （倪师原话）是 `filterGenderContent` 的**下游产物**，不是它过滤的对象；本变更只保证其输出
  逐字节不变，重建库 + 重导仅作验证，不直接手改产物

## Capabilities

### New Capabilities

- `interpretation-content`: 解读内容数据模型——性别差异以结构化字段承载（`common` + `male`/`female`/`suffix`
  视图），不以散文内联标记 + 成稿后正则剥离实现

### Modified Capabilities

- （无）

## Impact

- 代码：`analysis/data.ts`（`StarContent` 类型 + `STAR_CONTENT_MAP` 全量）、`analysis/lookups.ts`
  （删 `filterGenderContent`）、`analysis/index.ts` / `analysis/report.ts`（删调用）、
  `analysis/context.ts`（暴露 `gender`）、`analysis/views/*`（结构化投影）、`analysis/grades.ts`
  （字段路径）、`cli/selftest/render.ts`（性别过滤断言改为结构化断言）、`test/citations.test.ts`
  （若守卫匹配依赖字段路径）
- 验证义务：**纯重构档**（行为不变）——给定性别 `--topic`/`--report` 输出**逐字节 diff=0**
  （先取基线）；引文守卫全绿（`NI_GRADES` 字段路径不脱节）；`npm run typecheck` 零错
