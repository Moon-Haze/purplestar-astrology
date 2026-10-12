# 可扩展架构设计（知识内容驱动的单体 skill）· 2026-10-12

> 身份：软件架构师（架构通）。范围已与用户对齐——**保持单 skill 形态**（拷贝 + `npm install` 即用），
> 增长引擎是**知识内容**（更多古籍原文 / 更多主题断语库 / 更多流派口径），而非新排盘领域或多宿主平台。
> 本文是**新扩展轴**的设计，不重复 `docs/architecture-review-20261011.md`（进程内模块收敛）与
> `docs/plans/2026-10-11-ziwei-three-layer-split.md`（契约/数据/计算三层拆分）已覆盖的内容——本文与之兼容并向上叠加。

---

## 0. 结论先行

当前架构的真正扩展瓶颈**不是模块边界，而是"内容耦合进内核"**：

- `scripts/` 约 9.9 万行，其中 `corpus/data/manual/` 13 个断语库 ≈ 7 万行、`tianji.ts` 天纪语料 ≈ 1.2 万行，
  排盘/解析/合盘内核合计才约 2 万行。**增长 90% 是内容，10% 是逻辑。**
- 加一套新断语库 / 新古籍 / 新流派，现在要改 `analysis/data.ts`（1749 行引擎）、`corpus/data/manual/index.ts`、
  `cli/knowledge/*` 与 `SKILL.md`/`references/`，**绕不开内核与 CLI 外壳**。

**设计主张**：把"知识内容"从内核里抽出来，变成**自包含、可注册的插件**；内核（排盘确定性算法）与 CLI 外壳
保持为**稳定不变的两层**。新增内容 = 落一个插件目录 + 在注册表加一行，**零改内核、零改 CLI 分发、typecheck 仍兜底**。

这把你们已有的两条纪律延伸到内容层：
1. `COMMAND_TABLE` / `OPTION_GROUPS` 的"单点声明真相源" → 升级为"插件注册表单点声明"。
2. `selftest-asserts` 的"每个内核自带断言组" → 升级为"每个插件自带断言组 + 引文核对表"。

---

## 1. 设计目标与不可逾越的约束

**目标**
- G1 新增知识内容（古籍 / 主题断语 / 流派）不触碰排盘内核与 CLI 分发。
- G2 保持"拷贝 + `npm install`"的单 skill 分发形态，**不引入外部插件包、不引入构建步骤**。
- G3 新增内容仍受现有三道质量防线覆盖：启动期 `LOADED` 自检、CLI `selftest`、七层 `npm test`（含引文守卫）。
- G4 渐进披露不变：`SKILL.md` 仍是骨架，插件细则只在被读到时进上下文。

**约束（来自既有决策，不可动）**
- C1 单 skill，仓库根 = skill 根；无构建，Node ≥ 22.18 直跑 `.ts`。
- C2 排盘确定性：内核只改 `iztro` + 自研算法，不靠模型推算。
- C3 三合派（倪海厦《天纪》）体系立场；飞星派（宫干自化 / 来因宫）继续禁用，绊线字段 `Palace.selfMutagen` 不得填回。
- C4 解析钩子候选序（`.ts` 优先于同名目录）已是类型检查与运行双重钉死，任何拆分不得破坏。

---

## 2. 当前架构的扩展性评估

**已经做对的（复用，不重做）**
- CLI 外壳已收敛为稳定层：`dispatch`（候选 1）、`args-table` 单点声明（候选 2/4）让命令与参数面与实现解耦。
- 内容已有初步隔离：`analysis/`（主题论断引擎）、`corpus/`（古籍 + 天纪）、`synastry/`（合盘断语）各成内核，
  `corpus/data/manual/` 已把 13 主题断语物理拆成独立文件——**这是插件化的现成地基**。
- 三层拆分计划把 `constants`/`wenmo` 数据下沉到 `data/`，与"内容层"方向一致。

**真正的缺口（本文要补的）**
| 缺口 | 现状 | 后果 |
|---|---|---|
| 内容无统一接口 | 古籍走 `corpus/index.ts`、主题走 `analysis/data.ts`、星曜/天纪/断语走 `cli/knowledge/*`，三套加载与查询形态 | 加内容要同时懂三套内部契约 |
| 内容无注册表 | `knowledge --source` 的 4 域是 `cli/knowledge/index.ts` 硬编码分支；`analysis` 主题在 `data.ts` 内 `switch` | 新源 = 改 CLI 分支 + 改引擎 |
| 流派硬编码 | 文墨亮度 + 倪师框架写死在 `wenmo-brightness.ts`/`mutagen.ts`/`types.ts` 绊线；引文守卫只认倪师 | 加流派要动内核多处 |
| 引文守卫单流派 | `citations.test.ts` 只扫"冒充倪师原话"，核对表只有 `annotations.ts` | 多流派时引文归属会错乱 |

---

## 3. 目标架构（C4 组件视图）

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Host：AI 助手 + SKILL.md 行为规范（渐进披露骨架）                      │
└───────────────────────────────────────┬──────────────────────────────┘
                                        │ 触发
┌───────────────────────────────────────▼──────────────────────────────┐
│  CLI 外壳层（稳定，几乎不动）                                          │
│  dispatch · args-table · args · render · birth-info · selftest         │
└───────────────────────────────────────┬──────────────────────────────┘
                                        │ 消费（只经注册表接口）
╔═══════════════════════════════════════▼════════════════════════════════╗
║  知识插件层（★扩展点：新增内容只动这一层）                              ║
║  ┌─ KnowledgeSource 注册表 ─────────────────────────────────────────┐ ║
║  │  古籍(books) · 星曜(stars) · 天纪(tianji) · 断语(oracle) · +新古籍 │ ║
║  └───────────────────────────────────────────────────────────────────┘ ║
║  ┌─ TopicProvider 注册表 ───────────────────────────────────────────┐ ║
║  │  13 主题论断（overview/love/…）· +新主题                          │ ║
║  └───────────────────────────────────────────────────────────────────┘ ║
║  ┌─ SchoolAdapter 注册表 ───────────────────────────────────────────┐ ║
║  │  文墨+倪师（默认）· +新流派（覆写亮度/四化/论断框架/引文核对表）  │ ║
║  └───────────────────────────────────────────────────────────────────┘ ║
║  每个插件 = 自包含模块：数据 + 查询函数 + 引文核对表 + selftest 断言组  ║
╚═══════════════════════════════════════▲════════════════════════════════╝
                                        │ 调用（纯函数，内容无关）
┌───────────────────────────────────────┴──────────────────────────────┐
│  排盘内核（稳定核心，绝不因内容扩展而改）                              │
│  algorithm · patterns · mutagen · analysis 核心 · types · data/        │
└───────────────────────────────────────┬──────────────────────────────┘
                                        │ 依赖
┌───────────────────────────────────────▼──────────────────────────────┐
│  引擎/数据底座：iztro · lunar-typescript · 干支四化表 · 文墨亮度表      │
└───────────────────────────────────────────────────────────────────────┘
```

**依赖方向单向向下**：CLI 外壳 → 插件注册表接口 → 排盘内核 → 引擎底座。插件层**禁止**反向依赖 CLI；
插件**只消费**内核暴露的纯函数（如 `generateChart`、宫位/四化查询），**不修改**内核状态。

---

## 4. 三个扩展点（接口形态，TypeScript 草图）

> 形态为设计示意，落地时按现有 `selftest-kit` 的 `Assertion[]` / `load<T>()` 机制具体化。
> 关键原则：**注册表用"清单 import"而非文件系统自动发现**（见 ADR-002）。

### 4.1 KnowledgeSource（古籍 / 星曜 / 天纪 / 断语 / 新古籍）

```ts
// scripts/knowledge/types.ts
export interface KnowledgeSource {
  id: string;                      // 'gusuifu' | 'quanji' | 'quanshu' | 'tianji' | 'stars' | 'oracle' | <新>
  label: string;                  // 中文显示名（进 help）
  school?: SchoolId;              // 归属流派，喂引文守卫（ADR-004）
  search(query: string, opts?: { limit?: number; book?: string }): SearchHit[];
  citations?: CitationTable;      // 该源自己的引文核对表（取代全局 annotations.ts）
}
// scripts/knowledge/registry.ts —— 单点注册（新增源 = 加一行 import）
export const KNOWLEDGE_SOURCES: Record<string, KnowledgeSource> = {
  gusuifu: await import("./sources/gusuifu"),
  quanji:   await import("./sources/quanji"),
  quanshu:  await import("./sources/quanshu"),
  tianji:   await import("./sources/tianji"),
  stars:    await import("./sources/stars"),
  oracle:   await import("./sources/oracle"),
  // 新古籍：import("./sources/<new>")  ← 仅此一行，不改 CLI 分支
};
```

`cli/knowledge/index.ts` 改为"按 `--source` 查 `KNOWLEDGE_SOURCES[source].search(...)`"，删掉硬编码 4 域分支。

### 4.2 TopicProvider（13 主题论断 / 新主题）

```ts
// scripts/analysis/topic-types.ts
export interface TopicProvider {
  key: TopicKey;                  // 'overview' | 'love' | ... | <新主题>
  palace: PalaceName;             // 主管宫（进输出契约）
  getAssertions(chart: ZiweiChart, ctx: TopicCtx): Assertion[];
}
// scripts/analysis/topics/registry.ts
export const TOPIC_PROVIDERS: Record<TopicKey, TopicProvider> = {
  overview: await import("./topics/overview"),
  love:     await import("./topics/love"),
  // ... 13 项；新主题 = 加一个 ./topics/<new>.ts + 一行注册
};
```

`analysis/index.ts` 的 `getTopicAnalysis` 改为遍历注册表汇聚，不再在 `data.ts` 里 `switch(key)`。
`corpus/data/manual/` 的 13 个文件成为各 `TopicProvider` 的**内容载荷**，与引擎解耦。

### 4.3 SchoolAdapter（流派口径 / 新流派）

```ts
// scripts/school/types.ts
export interface SchoolAdapter {
  id: SchoolId;                   // 'wenmo-nishi'（默认）| <新流派>
  brightnessTable?: BrightnessTable;     // 可选覆写星曜亮度
  sihuaLayers?: SihuaLayer[];            // 可选覆写四化层集合
  assertionFramework: AssertionFramework;// 论断框架（命宫为本/三方为用 等）
  forbiddenFeatures?: ForbiddenFeature[];// 如 ['self-mutagen','lai-yin']（继承绊线语义）
  citationRoots: CitationTable[];        // 该流派权威语料核对表（多流派隔离）
}
// scripts/school/registry.ts
export const SCHOOLS: Record<SchoolId, SchoolAdapter> = {
  "wenmo-nishi": await import("./schools/wenmo-nishi"),  // 现行混合口径
  // 新流派：import("./schools/<new>")  ← 一行注册
};
```

现行"文墨亮度 + 倪师框架 + 飞星禁用"整体封进 `schools/wenmo-nishi`，`Palace.selfMutagen` 等绊线
改由 `forbiddenFeatures` 声明式表达（断言仍盯"不被填回"，但归属从硬编码改为读适配器）。

---

## 5. 架构决策记录（ADR）

### ADR-001 · 保持单 skill 形态，内容插件不引外部包
- **Status**：Accepted
- **Context**：未来增长是知识内容，非新排盘领域/多宿主。用户已确认"单 skill 内扩展"。
- **Decision**：插件以**仓库内目录 + 注册表**形式存在，不拆 npm 子包、不引插件市场。
- **Consequences**：✅ 守住"拷贝 + `npm install`"分发；typecheck 可静态验证插件完整性。
  ❌ 插件不能与主仓独立版本化/独立发布（当前不需要）。

### ADR-002 · 插件用"清单注册"而非文件系统自动发现
- **Status**：Accepted
- **Context**：项目无构建步骤，`@/` 钩子在运行时解析；已有 `ALL_SKILLS`（磁盘推导）与
  `COMMAND_TABLE`（静态注册）两套先例。
- **Decision**：每个插件层用一个 `registry.ts` 显式 `import` 各插件模块；新增插件 = 加一行。
- **Consequences**：✅ 与"单点声明真相源"哲学一致；typecheck 兜底（漏注册即报错）；
  `selftest` 可逐项断言"注册表声明 ⊆ SKILL.md 提到的源"。
  ❌ 比 glob 自动发现多一行样板（可接受，且这正是你们已有的取舍）。

### ADR-003 · 排盘内核与知识内容严格分层，内容扩展不触碰内核
- **Status**：Accepted
- **Context**：90% 增长是内容；当前加内容要改 `analysis/data.ts` 与 `cli/knowledge/*`。
- **Decision**：内核只暴露纯函数供插件消费；插件层禁止反向依赖 CLI、禁止修改内核模块状态。
  三层拆分的 `data/` 只放**跨流派共享**的底座数据（干支/四化/亮度），**流派特有**内容归插件。
- **Consequences**：✅ 内核回归（`selftest` 排盘段 / `npm test`）在加内容时**完全不必重跑**；
  内容漂移被关进插件自身的断言组。❌ 内核接口需先稳定（见路线图 Phase 0）。

### ADR-004 · 流派作为一等扩展点，引文守卫随流派
- **Status**：Accepted
- **Context**：现行引文守卫只认倪师、核对表只有 `annotations.ts`；多流派会使归属错乱。
- **Decision**：`SchoolAdapter` 自带 `citationRoots`；`citations.test.ts` 改为按流派分别扫描各自
  插件目录，核对表随插件走，不再有全局单一核对表。
- **Consequences**：✅ 加流派不污染倪师引文纪律；绊线语义从"硬编码字段"升级为"适配器声明"。
  ❌ 引文守卫需重构为按流派分派（工程量中等，见 Phase 3）。

---

## 6. 长期演进路线图

> 前提：Phase 0 的内核稳定是后续一切的基础——**内核未稳前不要开始插件化**，否则插件接口会随内核漂移。

### Phase 0 · 内核稳定（现在 → 约 2 周）
- 落地既有 8 候选深化 + 三层拆分（`docs/plans/2026-10-11-*`）。
- 冻结内核对外纯函数面（`generateChart`、宫位/四化查询、亮度查询），写进 `types.ts` 注释作为契约。
- **退出标准**：`selftest` 全绿、`npm test` 549+ 全绿、`typecheck` 0 错；内核对外接口有文档化契约。

### Phase 1 · KnowledgeSource 接缝（证明 seam，重构不改行为）
- 抽 `KnowledgeSource` 接口；把现有 books/stars/tianji/oracle 4 源**迁**到 `knowledge/sources/` 后注册。
- `cli/knowledge/index.ts` 改为查注册表；`SKILL.md`/`references/` 同步"源清单来自注册表"。
- **退出标准**：对外行为逐字节不变；`selftest` 新增"注册表声明 ⊆ SKILL.md 提到的源"断言。

### Phase 2 · TopicProvider 接缝
- 抽 `TopicProvider` 接口；13 主题从 `analysis/data.ts` 的 `switch` 迁到 `analysis/topics/` 后注册。
- `corpus/data/manual/` 13 文件成为各 provider 的内容载荷。
- **退出标准**：`astrology --topic` 输出 diff=0；新增主题只加文件 + 一行注册。

### Phase 3 · SchoolAdapter + 按流派引文守卫
- 现行混合口径封进 `schools/wenmo-nishi`；`citations.test.ts` 改为按流派分派，核对表随插件。
- 绊线字段 `Palace.selfMutagen` 的"不被填回"断言改为读 `forbiddenFeatures`。
- **退出标准**：倪师引文纪律零退化；加一个空壳新流派适配器不触发任何倪师断言。

### Phase 4 · 端到端验证（首个纯插件新增）
- 加一个**真实新内容**作为纯插件（建议：第 4 部古籍，或第 14 个主题），**全程零改内核与 CLI 外壳**。
- **退出标准**：新内容经 `knowledge` / `astrology --topic` 可用；`selftest` + `npm test` 仅新增插件自身断言，内核层项数与基线一致。

### Phase 5 ·（可选，仅当未来转向多 skill）内核+框架抽取
- 若某天要做八字/塔罗等**新排盘领域**，本设计的"内核 + 插件框架 + CLI 外壳 + 测试骨架"已可被抽取为共享底座，
  每个领域 skill 是"底座 + 自己的内核插件 + 自己的内容插件"。**本阶段不在当前范围内**，仅记此伏笔。

---

## 7. 风险与护栏（保住现有质量纪律）

1. **插件完整性自检**：沿用 `LOADED` 全量导出扫描思想——注册表加载时对每个插件做非空扫描，缺导出直接启动失败，
   "宁可启动失败，也不静默产出错盘/错论断"。
2. **不改内核就不跑排盘回归**：Phase 1–4 加内容时，`selftest` 排盘段与 `npm test` 层 1 项数必须**与基线一致**；
   若变动，说明插件越界碰了内核——红灯即报警。
3. **引文守卫不退化**：多流派下，每个流派插件自带核对表，守卫扫各自目录；新增流派不得复用倪师核对表。
4. **解析钩子候选序**：插件目录命名避开与 `constants.ts` 等门面同名（沿用三层拆分的 D1 教训），
   新建 `knowledge/`、`analysis/topics/`、`schools/` 不与既有 `.ts` 同名。
5. **计数不写死**：注册表插件数、各插件断言数由首行自报/派生，不手抄（与现有 `selftest` 项数自报一致）。

---

## 8. 待用户确认

1. Phase 0 的内核对外契约冻结范围是否认可（哪些函数进契约、哪些仍内部）？
2. 插件目录命名（`knowledge/sources/` · `analysis/topics/` · `schools/`）是否采用，还是并入现有 `corpus/`？
3. 首个 Phase 4 验证内容选哪类（新古籍 / 新主题 / 新流派空壳）？
