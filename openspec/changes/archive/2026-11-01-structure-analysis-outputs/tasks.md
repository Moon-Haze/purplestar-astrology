# Tasks

## 1. 基线与条目模型

- [x] 1.1 **先取基线**：固定样本集（设计样本抽样，覆盖 14 主星 × 亮度/化曜关键形态）上取
      `getTopicAnalysis`（13 主题）与 `getTopicReport` 的文本输出到 /tmp 基线库，附样本清单
      （后续每个 view 的 diff=0 判据与终验共用）。判据：基线可复取且两次一致（同盘同参确定性）。
- [x] 1.2 定义 `AnalysisItem` 条目模型（design D1）与 `formatItem` 文本投影函数（前缀徽标 /
      括号注记 / `---` / 空行策略与现有拼接逐字对齐），typecheck 0 错误。判据：
      `npx tsc --noEmit` 通过；`formatItem` 此阶段未被消费（模型先行，不动 view）。
- [x] 1.3 时钟依赖标记落点：定位 `context.ts` 中大限/流年/流月的系统时钟注入点，条目携带
      `clockDependent` 的判定函数落地。判据：对抽样盘断言 decadal/yearly 相关条目标记为
      true、静态条目无标记（/tmp 抽查脚本，跑完即删）。

## 2. views 逐个重构（每 view 一组条目流 + formatter + diff=0）

- [x] 2.1 `renderOverview`（总览 / 命盘关键定制 / 星曜深层特质 / 特殊格局）：改产
      `AnalysisItem[]`，`getTopicAnalysis` 经 `formatItem` 拼行。判据：基线 diff=0
      （13 主题 × 抽样盘，双形态）；`npm test` 主题注册表层全绿。
- [x] 2.2 `renderSanFang`（三方四正联动，含 ▍ 宫头与 ✦ 次星配对——结构化后配对来自 ctx
      宫位结构，不再文本解析）。判据：同 2.1。
- [x] 2.3 `renderMutagen`（本命四化会照 + note 归属——归属来自 ctx 四化结构）。判据：同 2.1。
- [x] 2.4 `renderYearStem`（年干四化·关键宫位影响）。判据：同 2.1。
- [x] 2.5 `renderPersonality` / `renderHealth` / `renderKuiYue`（三小节一批）。判据：同 2.1。
- [x] 2.6 `report.ts` 装配层（`getTopicReport` 五节模板 + 跨节去重 + 引文递入——去重状态在
      结构化面的承载按 design Open Question 以 diff=0 定案）。判据：基线 diff=0（全盘报告
      形态 × 抽样盘）；`npm test` 层 2 CLI 端到端全绿。
- [x] 2.7 `renderDecadal` / `renderLiuNian`（动态节：条目带 `clockDependent: true`，文本
      投影不变）。判据：同 2.1。

## 3. 结构化 API 与直出链

- [x] 3.1 `getTopicAnalysisStructured(chart, topic)` 公开 API（ctx 单次构建双投影）挂入
      `analysis/index.ts` 公开面。判据：结构化条目流经 `formatItem` 拼回的文本与
      `getTopicAnalysis` 逐字节一致（同盘同参，/tmp 对拍脚本验证后即删）。
- [x] 3.2 `generate-shards.ts` 扩展结构化产出（`structured-*.jsonl.gz`，design D3），样本
      空间 = 设计样本 518,400 枚举。判据：小样本试跑产出可解析、无时钟依赖条目；
      全量直出后台跑完（~2h）并自报条目数。
- [x] 3.3 **实施修正**：结构化入库不经 DuckDB——`export-manual.ts db` 直接消费分片 jsonl
      的 `items` 字段建 oracle.db schema v2（design D4 本意），DuckDB `topics` 文本表保留
      （继续服务 md 归档与 verify 链，最小 diff）。判据并入 4.1（1924 试跑通过；全量
      sha256 可复现在终验）。

## 4. 建库端与消费端切换

- [x] 4.1 `export-manual.ts` 建库端消费结构化条目直接建 `oracle.db` schema v2（语义列 +
      行文本字典整行共享），引文校验前移到条目级（`citation-core` 判据不变）；
      **`classifyOracle` / `staticLines` 删除**。1924 单年试跑通过（43,167 条目、时钟
      排除 2.2M、跨盘去重 v1 uniq 语义保留）；全量 sha256 可复现与检索对拍在终验。
- [x] 4.2 `corpus/data/manual/index.ts` 组装层改语义列直读（section 字符串协议退役），
      `OracleStar` 契约不变。判据：三形态检索输出与 v1 逐字一致（同 4.1 差异口径）；
      typecheck 0。
- [x] 4.3 `docs/manual/` md 归档维持 DuckDB topics 文本链（3.3 实施修正的组成部分：文本表
      保留服务 md 归档）；`manual:check` 双通道对拍（md 逐字 + 库 sha256）在终验。
- [x] 4.4 引文守卫与键域断言迁移：`citations.test.ts` 库抽取组改抽 texts v2（判据不变）；
      `invariants.test.ts` 新增语义列值域互证（星/宫/亮度/化曜 ↔ 内核真相源）。判据：
      `ZIWEI_NO_CACHE=1 npm test` 全绿。

## 5. 文档与终验

- [x] 5.1 文档同步：`AGENTS.md`（数据链描述、生成物清单）、`docs/code/analysis.md`（一源
      双投影）、`docs/code/knowledge.md`、`docs/manual/README.md`（schema v2 与直出血缘）。
      判据：grep 无「classifyOracle / staticLines / tar 文本消费」残留描述。
- [x] 5.2 终验：`typecheck` + `ZIWEI_NO_CACHE=1 selftest` + `npm test` 三件套全绿（退出码
      直取）；`npm run manual:check` 零退出；`npm run pack` + `unzip -t` 交叉验 + 分发态
      oracle 检索可用。判据：全部退出码 0。
- [x] 5.3 工作区清点：变更面与本 change 任务一一对应、/tmp 一次性产物已清、
      `openspec validate --all` 零警告。判据：`git status` 可逐条对应；validate 退出码 0
      且无 WARNING。

## Workflow follow-up

- **归档顺序依赖**：本 change 的 `manual-store` MODIFIED delta 以 `migrate-manual-to-sqlite`
  先行归档为前提（manual-store 主 spec 由该 change 引入）——先归档前一个，再 apply 本 change。
- 评审通过后 archive：折回 specs（`analysis-structured` 新建 + `manual-store` /
  `quality-gates` MODIFIED）、`openspec validate --all` 复验零警告、
  AGENTS.md「项目约束」节若受影响先同步、一个逻辑变更一个 commit。
- v4 真实公历口径（外部数据源仓补 birthInfo）为独立后续协作，不入本 change。
