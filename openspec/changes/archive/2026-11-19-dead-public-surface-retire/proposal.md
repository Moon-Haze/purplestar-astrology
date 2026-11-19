# Proposal · 四处死公开面退役（评审 2026-11-18 候选 5 / 11 / 8 纯减法批次）

## Why

四处死在**导出 / interface 面**的公开面成员：tsconfig 无 `noUnusedLocals` 只拦局部量，
re-export 与 interface 可选字段连这道闸都不经过，typecheck 永绿。每个死名目都让所在
interface 比真实契约大——读者要多懂一条「这条什么时候用」，而答案是「永远不用」：

1. `scripts/corpus/index.ts` 的 `getBookBySlug` / `getChapter` / `getParagraphById`
   三个按 slug / 章节下标 / 段落 id 直查的导出（`:44-46` / `:55-65` / `:76-87`）——
   全仓零运行时消费（`getBookBySlug` 唯一 caller 是文件内 `getChapter`），断语手册
   时代直出链与建库的余波（手册退役 12a3e4d 后悬空）。
2. `scripts/cli/args/config-input.ts:110` 的 `export const CONFIG_OPTION_GROUPS =
   OPTION_GROUPS`——全仓唯一出现处即定义行；注释声称「模板与校验共用一张防漂移」，
   但两个消费方本就在同文件内直接用局部 import 的 `OPTION_GROUPS`，该别名不承载
   任何 seam。
3. `scripts/knowledge/types.ts` 的 `KnowledgeSource.citations?: readonly CitationRef[]`
   （`:58`）与 `CitationRef` interface（`:40-47`）——Phase 1 留的引文核对表扩展点
   占位；Phase 3 实际落点改道 `SchoolAdapter.citationRoots`（extensibility ADR-004），
   三个知识源无一填充、全仓零读取，占位承诺的「Phase 3 收编」已以另一种形态发生。
4. （评审外补验项）`scripts/knowledge/types.ts:54` 的 `KnowledgeSource.school?:
   string`——与 `citations` 同批 Phase 3 占位（「Phase 3 SchoolAdapter 落地后填充」），
   grep 证实三个知识源零填充、全仓零读取。同文件同型同源，随本批次一并退役。

deletion test：四项全部「复杂度湮灭」——零 caller、零断言锚定、零行为变化，删除不
产生搬家成本。

## What Changes

1. **corpus 公开面收敛**（候选 5）：删 `getBookBySlug` / `getChapter` /
   `getParagraphById` 三导出及各自 docstring；文件头注 `:4` 改实态（「提供全文检索
   与书目/段落统计」）。`ALL_BOOKS` / `TOTAL_PARAGRAPHS` / `searchClassics` 不动。
2. **CONFIG_OPTION_GROUPS 删除**（候选 11）：删 `config-input.ts:110` 导出行及其
   注释，文件其余不动。
3. **citations / school 占位退役**（候选 8 + 补验项）：删 `KnowledgeSource.citations`
   成员、`KnowledgeSource.school` 成员与 `CitationRef` interface（约 12 行）；文件
   头注的 Phase 3 占位段改事实陈述，指向引文接缝的真实落点
   （`SchoolAdapter.citationRoots`，见 `scripts/school/types.ts` 与
   `test/citations.test.ts`）。三个知识源实现零改动（本来就没填）。
4. **docs 同步**：`docs/code/knowledge.md` 两处 citations 占位描述（`:26-28` / `:87`）
   改为事实陈述；`docs/code/cli-args.md` 的 `CONFIG_OPTION_GROUPS` 段（`:297-299`）
   随删除收敛。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无——四处均为实现内部公开面，spec 不钉任何一处：extensibility 主 spec 只在接缝
清单里点名 `KnowledgeSource` 文件位置，不钉 interface 成员形状；knowledge-retrieval
的 KnowledgeQuery 条款管查询字段面，与本批删除无关）→ `skip_specs: true`。
先例：`2026-11-05-dead-interface-face-cleanup`（同型纯减法，同判据）。

## Impact

- 代码：`scripts/corpus/index.ts`、`scripts/cli/args/config-input.ts`、
  `scripts/knowledge/types.ts`。零行为变化。
- 文档：`docs/code/knowledge.md`、`docs/code/cli-args.md`（「改模块设计先改文档」纪律）。
- 分发件 / 排盘内核 / 语料数据：不受影响。corpus 与 knowledge 不在冻结内核契约面
  （`test/kernel-contract.test.ts` 冻结的是排盘内核导出），删除不破坏契约。
- 扩展点语义不变：新增一个知识域仍是「写源 + registry 加一行」（接缝判据复核项）。

## 不做什么

- **不删 `escapeHtml`**——它是 `searchClassics` 的活实现零件；本 change 只动零消费面。
- **不动 `searchClassics` / `ALL_BOOKS` / `TOTAL_PARAGRAPHS`**——活的公开面。
- **不做评审候选 2 的注释存量清理**（含 knowledge/registry.ts 五处「四域」措辞）——
  那是独立的大清单 change（守卫扩展 + 存量一体），本批次不夹带。
- **不开 `noUnusedLocals`**——编译器纪律变更牵动全仓存量，先例
  （2026-11-05-dead-interface-face-cleanup）已否决，判据不变。
- **不改 `KnowledgeSource.search` 契约与 `KnowledgeQuery`**——查询字段面有 spec 条款。

## 被否决的备选方案（留档）

- **citations 占位只改注释注明「已由 CitationRoot 取代」**：否决。注释改口的占位仍是
  死 interface——typecheck 与读者都还会看到一个永不填充、永不读取的成员，后续读者
  仍可能把它当合法扩展姿势。删除是唯一让 interface ≡ 真实契约的路径。
- **给 `CONFIG_OPTION_GROUPS` 补消费方让它成真**（如让 selftest 经它审计模板面）：
  否决。为零名目造消费者是把接缝当目标本末倒置；模板与校验同文件直用
  `OPTION_GROUPS` 已无漂移可能，别名无信息增量。
- **`school` 字段暂留等 Phase 3.5**：否决。SchoolAdapter 已是流派的一等扩展点
  （ADR-004），KnowledgeSource.school 是同一概念从未施工的第二条路；留到「将来」
  只是让死面多活一个版本。若未来确需知识源声明流派，届时按真实需求重新设计字段。

## 验证义务申报

**纯减法档（行为零变化）**。「与基线逐字节 diff=0」判据不适用于删除类改动（删除
本身 diff ≠ 0），以等价判据替代：

- 删除名单逐项 `git grep` 归零（含 docs 同步点）；
- `npm run typecheck` 0 错误（零消费由编译器兜底确认：若有隐性消费会立刻爆）；
- `node scripts/purple-star.ts selftest` 全绿 → `npm test` 全绿（先 selftest 后
  npm test，退出码直取命令本身）；
- `npm run lint` / `npm run format` 对改动行无新增告警。
