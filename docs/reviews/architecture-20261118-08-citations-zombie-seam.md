# 候选 8 · KnowledgeSource.citations：僵尸扩展点（Phase 3 已改道 school 接缝）（2026-11-18 第五轮）

**档位**：Worth exploring ｜ **分层**：knowledge 扩展点层 ｜ **规范面**：`docs/code/knowledge.md` 若记载该扩展点须同步；无需 openspec change ｜ **与已定决策冲突**：0（ADR-002 注册表纪律不动，删的是接缝上的死占位）

## 涉及文件

| 位置                                                                            | 角色                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/knowledge/types.ts:12-15`                                              | 头注：citations 占位承诺「Phase 3 落地时……该测试在 Phase 3 重构」             |
| `scripts/knowledge/types.ts:40-47`                                              | `CitationRef` interface（「占位形状；Phase 3 落地时与 annotations.ts 对齐」） |
| `scripts/knowledge/types.ts:58`                                                 | `KnowledgeSource.citations?: readonly CitationRef[]`                          |
| `scripts/school/types.ts:42-47` + `scripts/school/schools/wenmo-nishi.ts:20,34` | 引文接缝的**实际落点**：`SchoolAdapter.citationRoots` 引用内核 `ANNOTATIONS`  |
| `test/citations.test.ts:273-294`                                                | 按流派分派扫描的真实消费面                                                    |

## 问题（file:line 实据）

`citations` 是 Phase 1 留的「引文核对表扩展点占位」，注释承诺 Phase 3（SchoolAdapter + 按流派引文守卫）落地时收编。Phase 3 已经落地——但走的是 **SchoolAdapter.citationRoots** 这条接缝；三个知识源无一填充 `citations`，全仓没有任何消费方读它（`grep -rn "\.citations"` 仅剩两处不相干的注释词）。`types.ts:15` 所说「citations.test.ts 在 Phase 3 重构」也已发生——重构结果与这个占位无关。

结果：interface 上留着一个**永不填充、永不读取**的成员 + 一个无人实现的 `CitationRef` interface。读者会以为「给知识源挂核对表」是合法扩展姿势，实际那条路从未打通、也不会打通（引文分派的正主在 school 层）。

## 为什么是摩擦（词汇口径）

扩展点是 interface 的承诺：每个成员都在告诉实现者「你可能需要提供这个」。一个从未被接通的占位成员让 KnowledgeSource 的 interface 比它的真实契约大——deletion test 一眼见底：删掉它，没有一行代码需要重写（占位不是实现）。引文这一概念的真实 home 是 school 接缝（`citationRoots` 被 citations.test.ts 按流派真实分派），占位是同一概念的第二条从未施工的路。

## 方案方向

删 `citations` 成员与 `CitationRef` interface（约 10 行）；`types.ts` 头注的 Phase 3 段改为事实陈述并指向 school 接缝（「引文核对表按流派收在 SchoolAdapter.citationRoots，见 school/types.ts 与 citations.test.ts」）。三个知识源实现零改动（它们本来就没填）。

备选最小动作：只改注释注明「占位已由 CitationRoot 取代」。推荐前者——注释改口的占位仍然是死 interface，typecheck 与读者都还会看到它。

## deletion test

删的是重复占位，不是实现——引文分派的复杂度已有更深的家（school 接缝 + citations.test.ts 消费面），删除零转移，纯减熵。

## Before / After

```text
Before: 同一概念两条路，一条从未施工            After: 一条路，已施工
KnowledgeSource                                KnowledgeSource
  citations?: CitationRef[]  ← 僵尸占位           （成员删除，interface ≡ 真实契约）
SchoolAdapter.citationRoots ← 真实接缝          SchoolAdapter.citationRoots ← 唯一引文 seam
  ↑ citations.test.ts 真实消费                    ↑ 消费面不变
```

## 验收

- typecheck 0 错误（零消费由编译器兜底确认）。
- `npm test` 全绿：citations.test.ts 走 school 接缝分派，不触 knowledge/types（编译器验证这条依赖边界确实存在）。
- `docs/code/knowledge.md` 同步（若记载该扩展点）。

## 落地注意

- `docs/code/knowledge.md` 是「改模块设计先改文档」纪律对象，同步改。
- 删除属于 knowledge 接缝的公开面收敛，registry 三源与 CLI 分发零改动——按「接缝判据」验证：本候选删除后新增一个知识域的步骤仍是「写源 + 注册一行」。
