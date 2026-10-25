# Design

## Context

`STAR_CONTENT_MAP`（`analysis/data.ts`，1859 行）里 `summary` 已是结构化 `male/female`，但其余
13+ 宫位字段把性别子句当内联标记塞进散文，靠 `filterGenderContent`（`analysis/lookups.ts`）
在 `getTopicAnalysis` / `getTopicReport` 末尾正则剥离。数据血缘：`STAR_CONTENT_MAP` →
views 渲染 → `filterGenderContent` → `astrology --topic`/`--report` 输出；`corpus/data/manual/*`
是同一渲染在 518,400 样本上的预计算快照（`tools/db/export-manual.ts` 从 DuckDB 导出）。动机见 proposal.md。

不可逾越约束：体系立场（不碰排盘内核）、「输出逐字节 diff=0」重构纪律、`filterGenderContent`
的既有三规则（`；女命…` / `（女命）…` / `女命…。`）是「性别过滤」语义的**唯一权威定义**。

## Goals / Non-Goals

**Goals:**

- 性别成为数据属性：`StarContent` 各宫位字段结构化，消费方按 `gender` 投影
- 输出与改前逐字节一致（`filterGenderContent` 作迁移期预言机）

**Non-Goals:**

- 不改排盘内核；不重写 oracle 手册 / 天纪语料源（它们只需验证逐字节不变）
- 不改变性别过滤的语义边界（复用既有三规则，不新增规则）

## Decisions

1. **结构化形状 `{ common: string; male?: string; female?: string; suffix?: string }`。**
   共享散文进 `common`，性别专属子句进 `male`/`female`；性别段可能**中置**（如 `；女命…` 分号子句
   嵌在句中），故以 `suffix` 收住其后缀，投影为 `common + (male|female) + suffix`。
   备选「全量 `{male, female}` 双份」被否：会把约 80% 的共享散文复制两份，内容翻倍且两性副本必漂移。
   只写差异，避免双份复制。
2. **`filterGenderContent` 作为迁移期独立预言机，不做单点化。**
   重构期保留它：对每个字段，先按原三规则剥出 male/female 版本，再落成 `common`/`male`/`female`/`suffix`。
   这保证结构化版本**逐字节复现**正则剥离结果（config 口径：「test 侧独立预言机不得顺手单点化」）。
   全部字段结构化并验证后，才删 `filterGenderContent` 及其两处调用。
3. **投影入口统一在 `makeContext`**：`ctx.gender`（`chart.birthInfo.gender`）已可用，views 内
   把 `profile.mingGong` 这类字段改成 `selectGender(field, ctx.gender)`（一个纯函数：`common` +
   对应性别段 + `suffix`）。不散在各 view 里各自拼。
4. **`NI_GRADES` 字段路径随结构同步**：`field: "mingGong"` → `"mingGong.common"` / `"mingGong.female"`
   等（按引句实际落点）；引文守卫的匹配逻辑若按 `field` 路径定位，同步适配结构化字段。

**三问：**

- deletion test：删掉结构化 = 回到「标记 + 末尾正则」，性别知识散在散文标记 + 过滤器两处——故是
  **集中**（性别成为数据属性）而非搬家。
- 接缝判据：新增一段性别差异内容 = 写一个字段（`common`/`male`/`female`/`suffix`），不改过滤器、不改消费方。
- 抽象 justify：删掉 `selectGender` 投影会多写——每个 view 各自重写「common + gender 段」拼接。

## Risks / Trade-offs

- [101 处标记拆分是体力活且易错] → 逐字段跑预言机对拍，复现不了即报错，不静默通过
- [正则三规则的边界（跨句、分号子句）在结构化后可能漏] → 逐字节 diff 是硬门槛，任一字段不一致即红灯
- [oracle 手册重建管道（build:db + export-manual）是重活] → 输出逐字节不变故手册不变，
  重建仅作验证；若重建产出 diff，先怀疑内核层渲染变了（越界报警）

## Migration Plan

1. 加 `selectGender` 投影 + `ctx.gender` → 2. 逐字段结构化（预言机对拍）→ 3. 删 `filterGenderContent`
与调用 → 4. `NI_GRADES` 路径同步 + 引文守卫适配 → 5. 逐字节 diff + 五闸门 + 手册重建验证。
回滚：单提交 revert（数据在提交内，无外部状态）。
