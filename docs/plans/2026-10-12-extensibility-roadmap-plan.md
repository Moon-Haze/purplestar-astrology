# 可扩展架构执行计划（Phase 0–5）· 2026-10-12

> 来源链（设计已确认，本文件是其落地计划）：
> - 设计规格：`docs/architecture-extensibility-20261012.md`（内容插件化、ADR-001~004）
> - Phase 0 依赖：`docs/architecture-review-20261011.md`（8 候选深化）
> - Phase 0 依赖：`docs/plans/2026-10-11-ziwei-three-layer-split.md`（契约/数据/计算三层拆分）
> - 测试基线：`test/README.md`（七层 `npm test` + 启动期 `selftest`）
>
> 纪律：本计划按 `superpowers` 流程执行——隔离 worktree → 写计划 → TDD → 子代理执行 → 评审 → 收尾。
> **每个任务都有可验证的退出命令；改内核的任务必须"逐字节 diff=0"。**

---

## 0. 规划假设与待确认检查点

架构文档 §8 有 3 个待确认项。以下采用文档建议的默认值作为**工作计划假设**，在对应阶段入口设为人工确认检查点（未拍板前不推进该阶段）：

- **A1 / Q1（契约范围）**：Phase 0 冻结的内核对外面 = `generateChart`（`algorithm.ts`）、宫位关系查询（`palace-relations.ts`）、四化查询（`mutagen.ts`）、亮度查询（`wenmo-brightness.ts` 查询函数）+ `types.ts` 类型契约。**其余内部函数不进契约**，保持可改。
- **A2 / Q2（目录命名）**：采用 `knowledge/sources/` · `analysis/topics/` · `schools/`（与架构文档 §4 一致）；**不并入 `corpus/`**（`corpus/` 保留为古籍原文与天纪语料数据，插件目录放"接口+查询函数+引文核对表"）。
- **A3 / Q3（Phase 4 首个验证内容）**：默认选**"第 14 个主题断语库"**作首个纯插件（成本最低，只动 `analysis/topics/`，不改 `cli/knowledge` 分支）；备选"第 4 部古籍"。待你最终拍板后再锁定。

> 如任一假设与你的意图不符，请在执行前指出，我改计划而非悄悄动。

---

## 1. 工程纪律基线（每个阶段开头都重做）

> superpowers 第 2 步：隔离工作区 + 确认测试基线干净。Phase 0–5 每个阶段开独立分支，避免长线污染主分支。

### 任务 0·基线-1：开隔离分支并锁定基线计数
- 文件路径：`git`（仓库根 `/home/swix/Code/TypeScriptProjects/purplestar-astrology`）
- 要做的：
  ```bash
  git fetch master && git checkout -b feat/extensibility-phase0 master   # 每个阶段换名：phase1~phase4
  npm install                # 确认依赖装好（package-lock 在 .gitignore，属正常）
  npm run typecheck          # 记录 exit 0
  node scripts/purple-star.ts selftest    # 记录：全通过
  npm test 2>&1 | tail -5                  # 记录：549/549（基线计数，写进本文件 §9 基线表）
  ```
- 验证：`typecheck` exit 0、`selftest` 全通过、`npm test` 计数与基线表一致。任一红则先修再开工。

### 任务 0·基线-2：快照"零改动输出基准"
- 文件路径：`/tmp/ziwei-baseline.json`（每阶段重建）
- 要做的：
  ```bash
  node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --json > /tmp/ziwei-baseline.json
  node scripts/purple-star.ts knowledge --source tianji "命宫" --json > /tmp/knowledge-baseline.json
  ```
- 验证：两个文件非空且可被后续阶段 diff 比对（行为不变任务的硬证据）。

---

## 2. Phase 0 · 内核稳定（现在 → 约 2 周）

> 目标：**冻结内核对外纯函数契约**。后续所有插件化都依赖此契约稳定，故**内核未稳不开 Phase 1。**
> 0A/0B 复用既有详细计划（不再重复拆任务），本计划只负责编排 + 新增 0C 契约冻结。

> ⚠️ **执行复核（2026-10-12 开干时发现，重要）**：原假设「0A/0B 待落地」已不成立——当前代码里
> `dispatch.ts`/`command-meta.ts`/`args-table.ts`/`selftest-kit.ts` 均存在，`scripts/data/` 已建、
> `filterGenderContent`/`Basis`/`OPTION_OWNERSHIP` 均已落地，git log 也显示候选 8（宫位收敛）与
> `ziwei/` 目录拆除已完成。**Phase 0 的 0A/0B 绝大部分已实现，真正剩余工作量远小于原计划。**
> 逐项复核结论：
> - 候选 1 分发协议收成 module → **已落地**（`main()` 已调 `dispatch`，返回 code/out/err/outFile 三元组）
> - 候选 2 独占/专题语义收成声明 → **已落地**（`command-meta.ts`/`args-table.ts` 存在）
> - 候选 3 旗标→section 接线成可测 interface → **⛔ 未落地**（astrology.ts 无 `compose`/section 序列接口，`--decadal`/`--ages` 仍缺端到端覆盖）—— **Phase 0 唯一真实剩余项**
> - 候选 4 归属表改投影 → **已落地**（`OPTION_OWNERSHIP` 在 args-table.ts）
> - 候选 5 断言组 interface 统一 → **已落地**（`selftest-kit.ts` 存在）
> - 候选 6 口径提示 basis 收一处 → **已落地**（`birth-info-defs.ts` 的 `Basis`）
> - 候选 7 filterGenderContent 上公开面 → **已落地**（analysis/index.ts 已 re-export）
> - 候选 8 宫位查询收敛 → **已落地**（git log 207fbda）
> - 三层拆分（0B）→ **已落地**（`scripts/data/` 建好、`ziwei/` 已拆除）
> - 0C 冻结内核契约 → **本轮回填完成**（types.ts 契约区块 + `test/kernel-contract.test.ts`，554 全绿）
>
> **修正后的 Phase 0 实际范围**：只剩「候选 3」一项真实工作；完成后内核即稳定，可提前进入 Phase 1
> （原估 2 周压缩为约 1 个候选的量）。记此伏笔，避免后续把已完成项当待做重做。

### 里程碑 0A：落地 8 候选深化（引用 architecture-review-20261011）
- 详细任务见 `docs/architecture-review-20261011.md` 候选 1–8。
- 执行顺序建议（按文档成对关系与首选推荐）：
  1. 候选 1（分发协议收成 module）——首选推荐，且是候选 3 的地基。
  2. 候选 3（旗标→section 接线成可测 interface）——依赖候选 1。
  3. 候选 2 + 候选 4（同源 `args-table.ts`，一次声明深化同时养活语义派生与归属投影）。
  4. 候选 5（断言组 interface 统一 + rootLabel 分叉）。
  5. 候选 6（口径提示 basis 收一处）、候选 7（filterGenderContent 上公开面）。
  6. 候选 8（宫位查询收敛）——文档列为"可缓"，等下次实质改动顺手做，**本阶段可不强制**。
- 每候选验收：`typecheck` exit 0 · `selftest` 全通过 · `npm test` 计数不降。
- 退出：`docs/architecture-review-20261011.md` 全部 Strong/Worth-exploring 候选落地或显式挂起。

### 里程碑 0B：三层拆分（引用 ziwei-three-layer-split）
- 详细任务见 `docs/plans/2026-10-11-ziwei-three-layer-split.md` 第 3–6 节。
- 关键决策已确认（D1 命名 `data/`、D2 门面 re-export、D3 流派单例留计算层、D4 5 表保留、D5 selftest 路径断言同步）。
- 验收（该计划 §6 三件套 + 附加）：
  ```bash
  npm run typecheck                              # exit 0
  node scripts/purple-star.ts selftest           # 全通过
  npm test                                       # 549/549
  node scripts/purple-star.ts astrology 2011-06-24 07:45 男 杭州 --json > /tmp/after.json
  diff /tmp/ziwei-baseline.json /tmp/after.json && echo "BYTE-DIFF-ZERO"   # 必须逐字节一致
  # D3 证据：故意破坏一张 SB 表 → CLI 启动即抛错
  # D4 证据：5 张零消费者表逐一 import 断言非 undefined
  ```
- 退出：逐字节 diff=0、D3/D4 证据成立。

### 里程碑 0C：冻结内核对外契约（★本计划新增，0A/0B 不含）
- 任务 0C-1：在 `scripts/types.ts` 顶部新增契约区块（注释 + 类型导出，内容源自 A1）
  - 文件路径：`scripts/types.ts`
  - 要做的：新增 `// === 内核对外契约（冻结 @ 2026-10-12，扩展 Phase 不得修改此面）===` 区块，列出冻结符号：
    - `generateChart(...)`（来自 `algorithm.ts`）
    - 宫位关系查询（来自 `palace-relations.ts`）
    - 四化查询（来自 `mutagen.ts`）
    - 亮度查询（来自 `wenmo-brightness.ts` 查询函数）
    - 以及本节引用的 `types.ts` 既有类型（含绊线字段 `Palace.selfMutagen` 不得填回的口径）
  - 验证：仅注释/类型，无行为变化；`typecheck` exit 0、`npm test` 计数不变。
- 任务 0C-2：新增契约守卫测试，把"冻结面"变成可断言事实
  - 文件路径：`test/kernel-contract.test.ts`（新建）
  - 要做的：用 TDD——先写断言"以下符号存在且为函数/具预期元数"（`generateChart`、`palace-relations` 导出、`mutagen` 四化导出、`wenmo-brightness` 查询导出），再确认测试绿。
  - 验证：`npm test` 新增 1 项通过；此测试后续作为"插件越界改内核"的报警红线。
- 退出：契约区块就位 + 守卫测试绿。

### Phase 0 总退出标准
`typecheck` exit 0 · `selftest` 全通过 · `npm test` 549/549 · 逐字节 diff=0 · 内核对外契约区块 + 守卫测试就位。

---

## 3. Phase 1 · KnowledgeSource 接缝（重构不改行为）

> 目标：把现有 books/stars/tianji/oracle 4 源迁到 `knowledge/sources/` 后注册；`cli/knowledge/*` 改查注册表。
> 依赖：A2（目录命名）、Phase 0 完成。**全程对外行为逐字节不变。**

### 里程碑 1A：定义接口与注册表
- 任务 1A-1：写 `KnowledgeSource` 接口
  - 文件路径：`scripts/knowledge/types.ts`（新建，内容见架构文档 §4.1）
  - 要做的：导出 `interface KnowledgeSource { id; label; school?; search(query, opts?); citations? }`
  - 验证：`typecheck` exit 0（仅类型，无调用方）。
- 任务 1A-2：写注册表
  - 文件路径：`scripts/knowledge/registry.ts`（新建）
  - 要做的：导出 `KNOWLEDGE_SOURCES: Record<string, KnowledgeSource>`，先只含占位 import 骨架（TDD：先写"注册表声明 ⊆ SKILL.md 提到的源"的断言，再补 import）。
  - 验证：`typecheck` exit 0。

### 里程碑 1B：勘察并迁移现有 4 源（TDD，行为不变）
- 任务 1B-1：勘察当前 4 源实现位置与接口形状
  - 文件路径：`scripts/corpus/index.ts`、`scripts/cli/knowledge/*`
  - 要做的：列出每个源当前的 `search`/`citations` 接口签名与返回结构，产出一张"迁移对照表"存入本计划附录。
  - 验证：对照表覆盖 4 源，无遗漏导出。
- 任务 1B-2~1B-5：逐源迁到 `scripts/knowledge/sources/<id>.ts`
  - 文件路径：`scripts/knowledge/sources/gusuifu.ts`、`quanji.ts`、`quanshu.ts`、`tianji.ts`、`stars.ts`、`oracle.ts`（按对照表）
  - 要做的：把现有实现原样搬入 `KnowledgeSource` 形态；在 `registry.ts` 加一行 `import`。
  - 验证（每源）：`node scripts/purple-star.ts knowledge --source <id> "<样例查询>" --json` 输出与 `/tmp/knowledge-baseline.json` 对应段**逐字节一致**。

### 里程碑 1C：CLI 改查注册表 + 引文核对表随插件
- 任务 1C-1：改写 `cli/knowledge/index.ts`
  - 文件路径：`scripts/cli/knowledge/index.ts`
  - 要做的：删除硬编码 4 域分支，改为 `KNOWLEDGE_SOURCES[source].search(...)`；缺失源报错。
  - 验证：`knowledge --source tianji "命宫"` 输出与基线逐字节一致；未知源返回明确错误。
- 任务 1C-2：把全局 `annotations.ts` 引文核对表收进各 `KnowledgeSource.citations`
  - 文件路径：`scripts/corpus/annotations.ts` → 各 `sources/*.ts` 的 `citations`
  - 要做的：迁移核对表，旧全局表标记废弃（ADR-004 前置）。
  - 验证：`npm test` 引文守卫项零退化。

### 任务 1D：新增注册表完整性自检（护栏）
- 文件路径：`scripts/cli/selftest/`（沿用 `LOADED` 全量导出扫描思想）
- 要做的：selftest 新增断言"注册表声明 ⊆ SKILL.md 提到的源"；加载时对每个源做非空导出扫描，缺导出即启动失败。
- 验证：`selftest` 全通过；故意删一个源导出 → 启动即红。

### Phase 1 总退出标准
`typecheck` exit 0 · `selftest` 全通过 · `npm test` 计数与基线一致（内核层未动）· `knowledge` 四种源输出逐字节不变 · 新增注册表自检断言绿。

---

## 4. Phase 2 · 主题定义收编为单一真相源（重构不改行为）

> 目标：把 13 主题的扩展摩擦从「同步改 8 张平行 `TOPIC_*` 表」收敛为「只改一处」。
> 依赖：Phase 1 完成。

### ⚠️ 执行偏差（重要）：计划的"抽 switch"前提不成立
- 勘察结论（2026-10-12）：全仓 `scripts/analysis`、`scripts/corpus` **没有任何 `switch(topic)`**。
  主题系统早已**数据驱动**——`getTopicAnalysis`（analysis/index.ts）是统一管线，按 `TopicKey`
  查 `TOPIC_*` 常量表 + `STAR_CONTENT_MAP`（按宫名/星取内容）；`corpus/data/manual/index.ts`
  的 `LOADERS`（生成文件）已是**内容注册表**。架构文档 §4.2 设想的 `TopicProvider.getAssertions`
  对应的是"每主题独立论断逻辑"，而实际论断逻辑是统一的、没有 per-topic 分支。
- 因此 **计划 2B-2~2B-14（造 13 个 `analysis/topics/<key>.ts` case 文件）被否决**——那会把"主题
  定义"拆到两处（元数据在 `analysis/topics/`、重内容在已生成的 `corpus/data/manual/<key>.ts`），
  降低内聚、纯属碎片，且违反"无架构宇航员：每处抽象须 justify 其复杂度"。topics 本质是"同一引擎
  + 不同宫位/内容选择的参数化视图"，不是插件边界（真插件边界是已完成的 KnowledgeSource 与待做的
  SchoolAdapter）。
- **真正的扩展摩擦**是：`analysis/data.ts` 里 8 张平行手维护表（palace/label/sanFang/contentKey/
  summaryKey/keyPalaces/suggestions + `SUMMARY_TOPICS`）必须同步改。Phase 2 收编它们为单一真相源。

### 里程碑 2A：单一真相源 `TOPIC_DEFS`（已落地）
- 任务 2A-1：在 `scripts/analysis/data.ts` 新增 `TopicDef` 接口（含 `palace`/`label`/`sanFangLabels`/
  `contentKey`/`summaryKey`/`isSummaryTopic`/`keyPalaces`/`suggestions`），并保留 `TopicProvider = TopicDef`
  类型别名以兼容架构文档 §4.2 词汇。
- 任务 2A-2：新增 `TOPIC_DEFS: Record<TopicKey, TopicDef>`（单一真相源，13 条目全覆盖，含全部
  keyPalaces/suggestions 文案），并加 `projectTopicField` 辅助函数，使 8 张具名表
  （`TOPIC_PALACE_NAME`/`TOPIC_LABEL`/`TOPIC_SANFANG_LABELS`/`TOPIC_CONTENT_KEY`/`TOPIC_SUMMARY_KEY`/
  `TOPIC_KEY_PALACES`/`TOPIC_SUGGESTIONS`/`SUMMARY_TOPICS`）改为**由 `TOPIC_DEFS` 派生**。
  - 原 8 张字面量表（约 333 行）已删除，消费方 import 路径不变。

### 里程碑 2B：逐字节对拍（已落地，TDD 行为不变）
- 任务 2B：对 13 主题（含 `--yearly 2027` 变体，触发 keyPalaces/year-stem 视图）做重构前后
  `git stash` 取基线逐字节对拍 → **26/26 场景 BYTE-DIFF-ZERO**。

### 里程碑 2C：新增注册表守卫测试（已落地）
- 任务 2C：新增 `test/topic-defs.test.ts`（层 3，3 项）：守卫 `TOPIC_DEFS` 恰好覆盖 `TOPIC_KEYS`、
  每主题字段齐备、派生具名表与 `TOPIC_DEFS` 同步（防日后重加发散字面量表）。登记进 `run.ts`/`README`。

### Phase 2 总退出标准（已达成）
`typecheck` exit 0 · `selftest` 全通过 · `npm test` 564→567（内核层 117 未动）· `astrology --topic`
全 13 主题（含 yearly 变体）逐字节 diff=0 · **加一个主题 = 只在 `TOPIC_DEFS` 加一个条目**
（断语内容仍走 `corpus/data/manual/` 生成 + `LOADERS` 注册表）。固定退出标准里的"加文件+一行注册"
在本项目语境下降级为"一处条目"，因为内容层已是按主题生成文件、无需再为元数据造空壳文件。

---

## 5. Phase 3 · SchoolAdapter + 按流派引文守卫

> 目标：现行混合口径封进 `schools/wenmo-nishi`；引文守卫按流派分派；绊线语义升级为 `forbiddenFeatures`。
> 依赖：Phase 1（citations 已随插件）、Phase 2。

### 里程碑 3A：定义接口与默认适配器
- 任务 3A-1：写 `SchoolAdapter` 接口（架构文档 §4.3）
  - 文件路径：`scripts/school/types.ts`（新建）
  - 要做的：导出含 `id` / `brightnessTable?` / `sihuaLayers?` / `assertionFramework` / `forbiddenFeatures?` / `citationRoots` 的接口。
  - 验证：`typecheck` exit 0。
- 任务 3A-2：封装默认适配器
  - 文件路径：`scripts/school/schools/wenmo-nishi.ts`（新建）
  - 要做的：把 `wenmo-brightness.ts` 亮度表、`mutagen.ts` 四化层、倪师论断框架、`annotations.ts` 核对表整体迁入；`forbiddenFeatures: ["self-mutagen","lai-yin"]` 声明式表达绊线。
  - 验证：`typecheck` exit 0；排盘输出与基线一致。

### 里程碑 3B：引文守卫按流派分派（ADR-004）
- 任务 3B-1：重构 `citations.test.ts`
  - 文件路径：`test/citations.test.ts`
  - 要做的：从"全局扫 `scripts/` + 单一 `annotations.ts`"改为"按 `SchoolAdapter.citationRoots` 分派，扫各自插件目录"。
  - 验证（TDD）：先写"倪师引文零退化"断言，再写"新增空壳流派不触发任何倪师断言"，再重构实现使双绿。

### 里程碑 3C：绊线断言读 `forbiddenFeatures`
- 任务 3C-1：改写 `Palace.selfMutagen` "不被填回"守卫
  - 文件路径：相关断言/类型校验处
  - 要做的：从硬编码字段检查改为读 `forbiddenFeatures` 声明；归属从硬编码改为读适配器。
  - 验证：故意填回 `selfMutagen` → 断言红；加空壳流派（无该 forbidden）不报此错。

### Phase 3 总退出标准
倪师引文纪律零退化 · 加空壳新流派适配器不触发任何倪师断言 · `selftest`/`npm test` 全绿 · 绊线语义由声明驱动。

---

## 6. Phase 4 · 端到端验证（首个纯插件新增）

> 目标：加一个**真实新内容**作为纯插件，**全程零改内核与 CLI 外壳**。依赖：A3（默认第 14 主题）。
> ⚠️ 入口检查点：确认 A3（新古籍 / 新主题 / 新流派空壳）。

### 里程碑 4A：加一个纯插件（行为新增，TDD）
- 任务 4A-1（按 A3 默认）：新增第 14 主题
  - 文件路径：`scripts/analysis/topics/<new-key>.ts` + `corpus/data/manual/<new-key>.ts`（内容载荷）
  - 要做的：只写 `TopicProvider` + 一行注册；**不改 `analysis/index.ts` 聚合逻辑、不改 CLI、不改内核**。
  - 验证（TDD）：先写"新主题经 `astrology --topic <new-key>` 可用且断言组自报非空"的测试，再实现使绿。
- 任务 4A-1（备选 A3）：或新增第 4 部古籍 `scripts/knowledge/sources/<new>.ts` + 一行注册（不改 `cli/knowledge/index.ts`）。
- 验证：新内容可用；`selftest` + `npm test` **仅新增插件自身断言**，内核层项数与基线一致。

### Phase 4 总退出标准
新增内容经对应命令可用 · 内核层测试项数与基线 549 一致（证明零越界）· `cli/knowledge/index.ts` 与排盘内核本次 0 改动（git diff 验证）。

---

## 7. Phase 5 · 共享底座抽取（伏笔，仅条件触发）

> 触发条件：**仅当**未来确要做八字/塔罗等**新排盘领域**（多 skill 产品矩阵）。当前不在范围内。
> 不写任务，仅记架构伏笔：本路线已把"内核 + 插件框架 + CLI 外壳 + 测试骨架"解耦，届时抽取为共享底座，
> 每个领域 skill = "底座 + 自己的内核插件 + 自己的内容插件"。触发时再开独立计划。

---

## 8. 跨阶段护栏（每条都是红灯即报警）

1. **内核层测试计数锁定**：Phase 1–4 加内容时，`selftest` 排盘段与 `npm test` 内核层项数必须与基线（549）**完全一致**；若变动 = 插件越界碰了内核 → 红灯。
2. **插件完整性自检**：注册表加载时对每个插件做非空导出扫描，缺导出直接启动失败（沿用 `LOADED` 思想）。
3. **引文守卫不退化**：多流派下每个流派自带核对表，新增流派不得复用倪师核对表（Phase 3 落实）。
4. **解析钩子候选序**：新建 `knowledge/`、`analysis/topics/`、`schools/` 不与既有 `.ts` 同名（沿用三层拆分 D1 教训；避开 `constants.ts` 等门面）。
5. **计数不写死**：注册表插件数、各插件断言数由首行自报/派生，不手抄（与现有 `selftest` 项数自报一致）。
6. **逐字节 diff 必做**：所有"重构不改行为"任务必须 diff 输出基线，仅"行为新增"任务（Phase 4）允许输出变化。

---

## 9. 测试基线计数表（开工前由任务 0·基线-1 填充）

> 真实基线已捕获（2026-10-12，分支 `feat/extensibility-phase0`）：typecheck exit 0 · selftest 全通过 ·
> `npm test` **549/549**（墙钟 7.7s）· astrology 快照 28572B · knowledge 快照 6568B。
> Phase 0 的 0C 新增 `test/kernel-contract.test.ts`（5 条断言，钉死内核冻结面）→ 全仓升至 **554**。
> 故跨阶段护栏的"内核层计数"基线实为 **554**（549 原基线 + 5 契约守卫）；Phase 1–4 插件工作不得改动此数。

| 里程碑 | typecheck | selftest | npm test | 逐字节 diff |
|---|---|---|---|---|
| 开工基线 | 0 | 全通过 | 549/549 | — |
| Phase 0 退出（含 0C 契约守卫） | 0 | 全通过 | 554/554 | astrology/knowledge 一致 |
| Phase 1 退出 | 0 | 全通过 | 564/564 | knowledge 4 源 8 场景一致 |
| Phase 2 退出 | 0 | 全通过 | 567/567 | astrology --topic 13 主题 + yearly 变体（26 场景）逐字节一致 |
| Phase 3 退出 | 0 | 全通过 | 564 + 插件自身项 | 排盘一致 |
| Phase 4 退出 | 0 | 全通过 | 564 + 插件自身项 + 验证内容项 | 仅新增内容变化 |

> ⚠️ 「内核层计数」的精确口径：跨阶段护栏盯的是 **层 3（排盘结构不变量 + 内核契约）**，
> 实测 = 112（invariants）+ 5（kernel-contract）= **117 项**，Phase 0/1 全程未动。
> 计划 §9 旧写的「554」是当时把「549 总量」误当内核层计数；以层 3 = 117 为准。
> 总项数的增长一律来自「插件自身项」（候选 3 的 6 项 CLI 层 + Phase 1 的 4 项注册表层），
> 不污染内核层。

### 0C 已完成（本计划首批落地）
- `scripts/types.ts` 顶部新增「内核对外契约（冻结 @ 2026-10-12）」区块（A1 冻结面 + 绊线禁止回填）。
- 新增 `test/kernel-contract.test.ts`：5 条断言钉死冻结面（generateChart / 宫位关系 / 四化 / 亮度 符号+元数 + 绊线运行时恒空）。
- 登记进 `test/lib/run.ts` LAYERS（层 3 内核契约）与 `test/README.md` 文件树。
- 验证：typecheck 0 · selftest 全通过 · `npm test` 554/554。

### 候选 3 已完成（Phase 0 收尾 · 2026-10-12）
- 把 `cmdAstrology` 默认路径的「旗标→section 接线」抽成可直测 `composeSections`（签名 `(chart, args, opts) → string[]`）。
- 新增 `test/astrology-sections.test.ts`（层 2）：6 条断言锁定顺序契约
  （pattern→mutagen→yearly→decadal→ages）+ 无深掘基底 + 守卫链 + `--decadal`/`--ages` 端到端覆盖
  （计划 §3 复核指出的长期覆盖缺口已补）。
- 验证：默认路径 8 场景 + 错误路径经 `git stash` 取重构前基线**逐字节零差异**；`npm test` 560/560。
- 注：`selftest/args.ts` 用退役命令名 `analyze` 的「假绿」在代码库里已修复（现用 `parseArgs([...], "astrology")`），本候选不再处理。

### Phase 1 已完成（KnowledgeSource 接缝 · 2026-10-12）
- 新增 `scripts/knowledge/types.ts`（`KnowledgeSource` 接口）+ `scripts/knowledge/registry.ts`
  （`KNOWLEDGE_SOURCES` / `KNOWLEDGE_SOURCE_IDS`）。
- 四源迁到 `scripts/knowledge/sources/{books,stars,tianji,oracle}.ts`：books 从 `cli/knowledge/index.ts`
  内联 `renderBooks` 原样迁出；stars/tianji/oracle 复用现有 `render*`，tianji/oracle 在 `search`
  内 `await import` 重数据，**懒加载纪律完整保留**。
- `cli/knowledge/index.ts` 改为查表分发（删硬编码 switch + 内联 `renderBooks`）；未知源报错提示顺序不变。
- 新增 `test/knowledge-registry.test.ts`（层 2）：4 条断言守卫注册表完整性（四域齐全、顺序固定、
  每源 search 非空可调用、未知源报错）。
- 验证：knowledge 4 源 8 场景经 `git stash` 取重构前基线**逐字节零差异**；typecheck 0 · selftest 全通过
  · `npm test` **564/564**（内核层 117 未动，+4 仅注册表层）。
- **偏差（已记录）**：计划 1C-2 的「annotations 引文核对表迁入各源 `citations`」**推迟到 Phase 3**。
  原因：`corpus/annotations.ts` 是全局引文核对表，`citations.test.ts` 扫全仓依赖它；Phase 1 填充会破坏
  该测试。架构文档 §4.1 的 `citations` 扩展点已在 `KnowledgeSource` 接口预留（`citations?: CitationRef[]`），
  Phase 3（3B 按流派分派）落地时再填充并对齐 `annotations.ts`。

---

## 10. 执行顺序与人工检查点

```
Phase 0（内核稳定）
  ├─ 0A 8候选深化 ── 0B 三层拆分 ── 0C 冻结契约
  └─ ★ 检查点：A1 契约范围确认 → 否则回头改 0C
Phase 1 KnowledgeSource 接缝（★ A2 目录命名确认）
Phase 2 TopicProvider 接缝
Phase 3 SchoolAdapter + 引文守卫
Phase 4 端到端验证（★ A3 首个内容确认）
Phase 5 （休眠，条件触发）
```

每阶段结束：`npm test` 全绿 → 向你给出"合并 / 开 PR / 保留分支 / 丢弃"四选项 → 清理 worktree（若用）。
