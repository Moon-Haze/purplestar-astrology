# Design

## Context

见 proposal.md（Why 与运行时实证数据）。三条背景约束决定方案形状：

- analysis 三表与 manual 快照的键改写属内容层（ADR-003 分层），不触排盘内核，不递增 `CACHE_VERSION`
- `compactPalaceKey` 上移 `scripts/data/` 是内核目录新增纯函数——`test/kernel-contract.test.ts` 冻结面是否覆盖 `data/` 新增导出需先核实（按「显式说明并同步，不顺手改断言迁就实现」纪律处理）
- 7978cb3 曾回退过「db 散表键归一」——那次回退范围是 tools/db 侧散表抄写维持上游紧凑原状；本设计改的是内核 analysis 表本体与取用链，边界必须写清避免误伤

## Goals / Non-Goals

**Goals:**

- 运行时直查全命中：十二宫无一落入兜底分支，次星深度文案与年干四化节回血
- 键域单一真相：宫名 = `PALACE_NAMES_ORDER`，十四主星 = `data/stars.ts`
- 互证断言钉住键域，未来新增键表自动被盯

**Non-Goals:**

- 不改 db 散表（上游紧凑原状维持，7978cb3）
- 不改 `TopicKey` 主题键空间（知识检索契约不动）
- 不重写 views 渲染逻辑（只随键域统一替换取值路径）

## Decisions

1. **键域方向：数据表改展开形，而非消费点归一。**
   运行时域已是规范口径（interpretation-contract「第 8 宫是交友宫，不是仆役宫」），数据表向运行时看齐。
   备选「消费点统一过归一函数」被否：每个消费点多一道调用，且新消费点漏调用的风险会重现——把不一致消灭在数据层比在调用侧打补丁 locality 更好。
   `compactPalaceKey` 仍上移内核：tools/db 重导管线继续用（db 散表维持紧凑、导出时归一），它从「内核缺失的补丁」变为「管线专用工具」，住址与用途如实。
2. **`TOPIC_DEFS` 内部双形态统一为展开形。** `palace`（已是展开形）与 `keyPalaces[].palace`（紧凑形）并存是漂移源，统一后关键宫位查询走同一宫名域。
3. **manual 重导在键域统一之后一次性做。** 手工改 12 个大文件不可行，走重导管线（bc21b4d 先例）；重导是同一语料的取材位置变化，不新增引文形态，重导前后各跑一次引文守卫确认。
4. **互证断言落 `test/invariants.test.ts`（已有文件）。** 与既有宫名两表互证同址同款；不新增测试文件，无需登记层表与 LAYERS。

## Risks / Trade-offs

- [重导后 manual 文本大面积 diff 淹没评审] → 重导前拍 diff 基线、独立提交；评审只看键域相关变化
- [kernel-contract 冻结面覆盖 `data/` 导出集合] → 上移前先读 kernel-contract.test.ts 断言范围；若需同步，在任务里显式列出，不改既有断言语义
- [键改写遗漏某个消费点] → 动手前全局 grep 三表全部读点列清单；改写后 invariants 断言兜底

## Migration Plan

1. `compactPalaceKey` 上移 → 2. 三表键改写 + 消费点跟随 → 3. invariants 互证断言 → 4. manual 重导 → 5. 全套闸门（typecheck / selftest / npm test / lint / format）+ 样例文档重生成

回滚：单提交 revert；manual 重导独立成提交便于单独回退。

## Open Questions

（无）
