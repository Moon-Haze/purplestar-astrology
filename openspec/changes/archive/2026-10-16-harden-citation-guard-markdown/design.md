# Design

## Context

读代码才知道的现状与约束：

- **守卫现状**（`test/lib/citation-guard.ts`）：`scanCitations(root, checklist)` 收一个根，
  经 `collectTsFiles` 递归收**所有** `.ts`，排除三类对象——`node_modules` / 点目录 /
  `corpus/data/manual/`（生成快照），再排除**语义上**识别出的核对表自身
  （`isChecklistSource`：导出 `ANNOTATIONS`）。违例判据 = 引文核心落在黑名单
  （`ANNOTATIONS` 里 suspect / fabricated 条目的引号内核心）。
- **驱动方式**：`test/citations.test.ts` 按 `SCHOOLS[id].citationRoots` 分派，
  每个 (流派, 根) 跑一次真扫描；另有喂构造临时树的元测试组，验扫描范围与排除规则本身。
- **`.md` 侧实测**（本提案立项前用探针跑过，判据与守卫逐字相同）：
  全仓 84 个 `.md`，倪师引文形态命中 859 处，其中**黑名单内 77 处，全部位于
  `docs/manual/topics/*.md`（12 个文件）**——即 `export-manual.ts` 的生成导出。
  排除该目录后余量为 **0**。「引号核心允许跨行 / 禁止跨行」两种判据实测差异为 0
  （77/77 两种都命中同一批），故不为 `.md` 单独收紧跨行规则。
- **已核实的约束**：`test/` 与 `docs/` 均不进分发件；`scripts/` 一行不动；
  无任何测试断言源码注释文本；`docs/code/README.md` 的软纪律段落是本变更要改的对象。

## Goals / Non-Goals

**Goals:**

- `docs/`（含 `docs/code/` 与 `SKILL.md` / `references/`）里的倪师引文**有机器在看**，
  失效模式与 `.ts` 侧一致（写一句未核实引文 → 立刻红）。
- 复用同一份黑名单与同一套形态正则——不出现「文档一份判据、源码一份判据」的分叉。
- 假绿防护与 `.ts` 侧对齐：`checked` 非空、排除规则有反向验证、有构造树元测试。

**Non-Goals:**

- 不改 `scanCitations` 的 `.ts`-only 语义（见 D2）。
- 不扫生成导出（见 D3）。
- 不给合法古籍引用开白名单（判据本就是黑名单，无需豁免）。
- 不把文档根塞进流派适配器的 `citationRoots`（见 D4）。

## Decisions

### D1：新函数而非改 `scanCitations` 的收集面

`scanCitations` 的收集面从「一棵源码树的所有 `.ts`」扩成「`.ts` + `.md`」看似增量最小，
实则踩两处坑：① 它的调用方是**流派适配器声明的 `citationRoots`**，根是 `<skill>/scripts/`，
`SKILL.md` / `docs/` 不在那个根下——扩了收集面也扫不到想要的文件，反而让
「扫哪个根」这件事变得更难推理；② `test/citations.test.ts` 现存一条元测试
（「非 `.ts` 文件不进扫描范围」）记录的正是 `scanCitations` 的职责边界，改收集面会让它
从「文档化的分工」变成「被破坏的断言」。

故新增 `scanMarkdownCitations(root, checklist)`：**同一个模块、同一份判据、另一棵收集面**。
两者共享 `buildBannedSet` 与 `findViolations`，差异只在 `collectTsFiles` / `collectMdFiles`。

**Alternatives**：给 `scanCitations` 加 `exts` 参数（调用面更统一，但 D1-② 的断言矛盾依旧，
且「一个函数两种收集面」会让排除规则缠成一个参数矩阵）；把 `.md` 扫描写进
`test/citations.test.ts` 内联（判据分叉，正是本提案要消灭的东西）。

### D2：`.ts` 侧与 `.md` 侧并列，不合环

两个函数都只做「怎么扫、怎么判」，`test/citations.test.ts` 各自驱动：
`.ts` 侧继续按流派分派（`citationRoots`），`.md` 侧按**仓库根**单次扫描。
失败信息各自独立——`.md` 侧的红不应被读成「某个流派的内核出了问题」。

### D3：`docs/manual/` 按路径排除，判据写在注释里

与 `.ts` 侧排除 `corpus/data/manual/` **同源同理**：那里是 `export-manual.ts` 把样本库
主题文本转印出的 Markdown 镜像，源头（`analysis/data.ts`）本就在 `.ts` 扫描范围内；
镜像可能带着旧版库的历史引文形态，那是 db 版本问题、重建即消，不是新写的未核实引文。

⚠️ 这条排除是**按路径**的（`docs/manual`），与 `isChecklistSource` 的按语义排除不同——
生成目录没有可识别的语义特征（它的文件不导出任何东西）。为此在注释里写明理由与
「源头在扫描范围内」这条兜底论证，并在元测试里钉住「`docs/manual/` 下的违例不被报、
同内容的违例放在别的目录要被报」这一对反向验证，防止排除范围悄悄扩大。

**Alternatives**：修生成器让导出不带 suspect 引文（开新战场，且历史库的引文形态是数据
问题不是格式问题）；按内容猜（镜像与手写在文本上不可区分）。

### D4：文档根不进 `SchoolAdapter.citationRoots`

`citationRoots` 的语义是「这个流派对哪些**内核源码**负责、用哪份核对表审」（ADR-004）。
仓库级文档（`SKILL.md` / `docs/` / `README.md`）不属于任何单一流派：它们描述整个 skill，
将来多流派时更不属于倪师一家。塞进去会让每个流派被迫各声明一份文档根，或让倪师流派
越界审别家内容。

故 `.md` 扫描由**测试侧**按仓库根驱动，与流派分派并列而非并入。

### D5：三处文档陈述同步，软纪律转硬

`docs/code/README.md` 的「倪师引文软纪律」一节当前写的是「现状是软约束…在此之前，
守这条纪律靠人」。变更落地后该段落改为「已硬化」+ 指向守卫，否则文档会说谎。
`openspec/config.yaml` 的「引文纪律」context 与 `test/README.md` 的层 7 描述同步补 `.md`。

⚠️ `openspec/config.yaml` 的 context 是**给未来的 agent 读的约束**，不是给人读的说明——
改它要按 archive guidance「若本次改动改变了项目约束，同步更新本文件的 context」执行，
且只补与引文扫描范围有关的一句，不借机改写别的段落。

## Risks / Trade-offs

- [排除范围悄悄扩大，把该扫的文档放过去] → D3 的反向验证元测试（同内容在 `docs/manual/`
  外必须被抓）+ 真扫描的 `checked` 非空断言（排除过头会让 `checked` 空掉，立刻红）。
- [`.md` 里的引文形态与 `.ts` 不同（如跨行、嵌套代码块）导致漏扫] → 形态正则与 `.ts` 侧
  **逐字共用**，不为 `.md` 放松；跨行差异已实测为 0。漏扫风险与 `.ts` 侧同量级，不新增。
- [将来 `docs/` 新增子目录意外进排除] → 排除只认 `docs/manual` 一个路径，
  且理由写死；新目录默认纳入扫描（收集面是推导的，同 `.ts` 侧原则）。
- [守卫变红阻塞无关改动] → 真扫描当前余量为 0（排除生成目录后），且判据是黑名单制，
  合法古籍引用不受影响（实测 782 处黑名单外命中零误报）。

## Migration Plan

无运行时部署概念。「迁移」= 守卫扩一个收集面 + 测试加一组 + 三处文档陈述改口。
回滚 = 单 commit revert。每步可验证：先写实现与元测试（构造树），再跑真扫描，
最后改文档陈述（文档改在实现之后，避免出现「文档说已硬化但机器还没干」的中间态）。

## Open Questions

无。扫描范围（仓库根全部手写 `.md`）、排除对象（`docs/manual/`）、判据（与 `.ts` 共用）、
驱动方式（测试侧并列）均已在此确认。
