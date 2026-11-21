# Proposal

## Why

AGENTS.md 明文「内核（`scripts/` 根的排盘模块）内部一律相对路径 import」，但磁盘实况有 6 处 `@/data/*` 违例（`scripts/algorithm.ts:20-21`、`scripts/mutagen.ts:17-18`、`scripts/palace-relations.ts:10`、`scripts/patterns/medium.ts:15`）。规则的存在理由在单 skill 形态下依然成立：`@/` 运行期解析到「正在跑的 CLI 的内核根」，交叉根加载（`ZIWEI_ROOT` / 测试 loader）时内核会拿到**别人根下**的数据表——2026-11-21 架构评审裁决为「文档对、改代码」，且规则目前零机械执行面（eslint 无 no-restricted-imports），改完还会再漂。

同批收口两项同域小项（评审 W4 / W5）：`analysis/` 内部的类型级环（palace-query → overview-material → type 引回 context）；天纪册名表手抄双源（`knowledge/sources/tianji.ts:16-22` 手写五册映射，与生成语料的 `TianjiBook` 类型脱钩，重导出现第 6 册时 `?? b` 兜底静默显原始代号）。

## What Changes

- **6 处内核 import 归位相对路径**（根散件用 `./data/…`，`patterns/medium.ts` 用 `../data/ganzhi`）——同根部署解析到同一文件，零行为变化。
- **eslint `no-restricted-imports` 守卫**：`scripts/*.ts`（根散件）与 `scripts/patterns/**`、`scripts/data/**` 禁 `@/*` 静态 import；引导层 `load<>("@/…")` 动态字面量与 `cli/` 静态别名不在辖域。
- **starBadge 挪 `analysis/lookups.ts`**（W4）：消 `palace-query → overview-material → (type) context` 类型级环，纯函数挪家、两消费方改 import 源。
- **天纪册名表单点化**（W5）：新伴生模块 `corpus/data/tianji-books.ts`，以 `Record<TianjiBook, string>` 引用生成物导出的册代号联合类型——typecheck 穷尽性即守卫（生成物重导新增册码而映射未跟时直接红）；`sources/tianji.ts` 删本地表与已类型化查表的 `??` 兜底。

**不做什么**：

- 不动 `@/` 钩子机制与 boot-hooks 双候选序——只改内核侧的 import 写法。
- 不改 `import-tianji.ts` 生成器与生成物 `corpus/data/tianji.ts`（册名映射是展示层，单点化不需要重导）。
- 不给 kernel-contract 冻结面加东西——6 处 import 改写不触及任何导出形状。

**被否决的备选**（留档）：

- 改 AGENTS.md 措辞迁就实况（「内核可以用 @/ 引 data」）：否决——规则有真实理由（交叉根加载语义），迁就措辞等于放弃内核自洽。
- 运行时守卫（invariants 扫内核文件源码）：否决——lint 的 no-restricted-imports 是现成机制、报错更早（编辑期），自写扫描是重复造闸门；与「机器已经查了的，人不要重复查」同旨。
- 册名表挪进生成器随重导导出：否决——映射是展示层事实，绑进生成链会让「改显示名」也变成重导事件；`Record<TianjiBook, string>` 已由 typecheck 给出更强的穷尽性守卫。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `quality-gates`: ADDED「内核相对路径 import 纪律」——内核文件禁 `@/` 静态 import，由 lint 面机械执行。

## Impact

- `scripts/`：6 处 import 行改写、starBadge 定义挪家（`analysis/overview-material.ts` → `analysis/lookups.ts`）与两处 import 源调整、新增 `corpus/data/tianji-books.ts`、`knowledge/sources/tianji.ts` 删本地映射与 `??` 兜底；`eslint.config.mjs` +1 规则块。
- 冻结内核契约不受影响（导出形状零变化）；`import-tianji.ts` 与生成物不动。
- 验证义务申报：**重构档**——与改动前基线逐字节 diff=0（CLI 样例输出先取基线），另跑三件套 + lint。
