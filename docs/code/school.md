# school —— 流派适配器

本篇覆盖 `scripts/school/`：`types.ts`（`SchoolAdapter` 接缝）· `registry.ts`（流派注册表）·
`guard.ts`（禁用特征守卫）· `schools/wenmo-nishi.ts`（默认流派）。

收录的是这些文件里 **B 类模块头论文**与 **C 类 ⚠️ 防呆警告**的原文；A 类 TSDoc 契约与
D 类口径锁留在源码。分类判据见 [README.md](README.md)。

---

## 一、`types.ts`：流派适配器接口

> 流派适配器接口（Phase 3 · SchoolAdapter 接缝 · ADR-004）
>
> 架构文档 §4.3：把"文墨亮度 + 倪师论断框架 + 飞星禁用绊线"封成一个可注册、自包含的
> 流派扩展点。加一个新流派 = 写一个 `schools/<id>.ts` + 在 `registry.ts` 加一行，
> 不必改排盘内核（ADR-003），也不必改 CLI 分发。
>
> ⚠️ **引用而非迁移（守住 Phase 0 冻结内核契约 0C 的红线）**：
> 本接口**不持有**任何亮度表 / 四化表 / 论断文案的副本——那些是冻结内核（`wenmo-brightness.ts` /
> `mutagen.ts` / `corpus/data/*`）的专属数据，插件只**引用**它们：
> - `defaultBrightnessSchool` 只记录冻结内核的默认流派（"XD2"），**不在适配器里改内核状态**；
> - `citationRoots[].checklist` 直接引用内核的 `ANNOTATIONS`（全局唯一核对表），**不另存一份**，
>   避免副本漂移——这正是 ADR-004「核对表随插件走」的落地方式（引用走，不是复制走）。
> 适配器是**声明式口径**：声明自己是谁、禁什么、扫哪、对哪份核对表负责。

### 1.1 `CitationRoot`：多流派隔离的关键

> `scanRoot` 是绝对路径（通常一个 skill 的 `scripts/`，或某流派插件自己的目录）；
> `checklist` 是该根下权威语料的核对表（多流派隔离的关键：每个流派只对自己声明的
> 核对表负责，不拿别人的核对表去审自己的内容）。

---

## 二、`registry.ts`：清单注册

> 流派注册表（Phase 3 · SchoolAdapter 接缝 · ADR-002：清单注册而非文件系统自动发现）
>
> 把各流派收成一张声明式注册表。CLI / 引文守卫 / selftest 只查这张表，不再写死"只有倪师"。
> 新增一个流派 = 写一个 `schools/<id>.ts` + 下面加一行，不必改排盘内核（ADR-003），
> 也不必改任何分发入口。typecheck 兜底：漏注册即报错。

⚠️ `SCHOOLS` 的**键序即概览列出与报错提示的顺序**；`SCHOOL_IDS` 是键集合的单一真相源，
自检断言复用它，**不手抄字符串**。`DEFAULT_SCHOOL_ID` 是单 skill 形态下的默认流派。

---

## 三、`guard.ts`：禁用特征守卫（零运行时依赖）

> 流派禁用特征守卫（Phase 3 · SchoolAdapter 接缝 · ADR-004）
>
> 把"飞星派逻辑不得回流"的绊线语义从**硬编码字段检查**升级为**读 `SchoolAdapter.forbiddenFeatures`
> 的声明式检查**（计划里程碑 3C）。同一份逻辑同时被两处消费：
> - `test/school.test.ts`（用 300 条真实基准盘，覆盖面大）
> - `scripts/cli/selftest/chart.ts`（CLI 启动期自检）
>
> ⚠️ 本模块**零运行时依赖**（只 import 类型）：`checkForbiddenFeatures` 是纯函数，
> 输入一张盘与一个流派适配器，输出违例清单。它不 import 任何内核状态、不触发排盘，
> 因此被 selftest 在启动期调用时几乎零成本。

### 3.1 数据驱动：空壳流派不报此错

> 关键在**数据驱动**：只有 `school.forbiddenFeatures` 里声明的特征才会被检查。
> 一个不声明 `self-mutagen` 的空壳流派 → 返回空数组（即"加空壳新流派不报此错"，
> 计划 Phase 3 退出标准之一）。这把原硬编码的"飞星派字段必须恒空"升级为可随流派增减的声明。

---

## 四、`schools/wenmo-nishi.ts`：默认流派

> 默认流派适配器：文墨排盘 + 倪海厦《天纪》三合派（Phase 3 · SchoolAdapter 接缝）
>
> 现行"文墨亮度 + 倪师论断框架 + 飞星禁用"整体封进本适配器。它是 `SCHOOLS` 注册表的
> 唯一（默认）项；加新流派时本文件不被改动，只新增一个 `schools/<id>.ts` + 一行注册。
>
> ⚠️ **引用而非迁移**（守住 0C 冻结红线）：
> - `defaultBrightnessSchool: "XD2"` 只是引用冻结内核 `wenmo-brightness.ts` 的默认流派常量，
>   **不**在本文件调用 `setBrightnessSchool`（不改内核运行时状态）；
> - `citationRoots[].checklist` 直接 import 内核的 `ANNOTATIONS`（全局唯一核对表），
>   **不**复制一份——避免核对表副本漂移；
> - `scanRoot` 解析到本 skill 的 `scripts/`，与 `citations.test.ts` 原扫根完全一致，覆盖零退化。
