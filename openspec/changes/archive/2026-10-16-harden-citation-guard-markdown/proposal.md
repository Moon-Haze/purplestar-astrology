# Proposal

## Why

`move-code-comments-to-docs` 把 `scripts/` 里的 B/C 类长注释原文搬进了 `docs/code/`（15 篇），
其中包含大量「倪师《天纪 0X》原话明示：…」形态的引文。该变更的 design D4 明确把这件事
列为**将来项**：

> 引文守卫不扩展，软纪律入 `docs/code/README.md` … 硬化守卫（让它也扫 `.md`）属验证
> 基础设施变更，另案提案。

本提案就是那个另案。现状是**软的**：`docs/code/README.md` 靠一段文字要求「搬入文档的倪师
引文与源码同受 `ANNOTATIONS` 核对表约束」，而守卫的 `collectTsFiles` 只收 `.ts`，
`docs/` 下的引文**没有任何机器在看**。往 `docs/code/` 里写一句未核实引文挂到倪师名下，
`npm test` 照旧全绿 —— 这正是引文守卫当年在 `.ts` 侧消灭掉的失效模式，在 `.md` 侧复现了。

更广一层看，skill 的**规范面**（`SKILL.md` + `references/`）也从未被守卫覆盖：那是 LLM
解读时真正读到的文本，一处伪造引文会直接流进每一次解读，比源码里的危害更大。

## What Changes

- **守卫的文档侧扫描**：`test/lib/citation-guard.ts` 新增 `scanMarkdownCitations(root, checklist)`，
  与既有 `scanCitations` 共用同一份黑名单构造与同一套引文形态正则，只把收集面从 `.ts`
  扩到 `.md`。`scanCitations` 行为**不变**（仍只扫 `.ts`，供流派适配器的 `citationRoots` 用）。
- **扫描根**：仓库根（`SKILL.md` / `references/` / `docs/` / `README.md` / `AGENTS.md` 等
  全部手写 `.md`），由 `test/citations.test.ts` 驱动，与 `.ts` 侧并列成第三组 describe。
- **排除规则**：`docs/manual/`（`tools/db/export-manual.ts` 的生成导出）按**路径**排除，
  理由与 `.ts` 侧排除 `corpus/data/manual/` 逐字同源——镜像可能带着旧版库的历史引文形态，
  源头本就在扫描范围内。排除判据写在注释里，不靠文件名猜。
- **软纪律转硬**：`docs/code/README.md` 的「倪师引文软纪律」一节改写为「已硬化」，
  指向本变更；`openspec/config.yaml` 的「引文纪律」context 补一句 `.md` 同样在扫描范围内。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。本变更只改**验证基础设施**（测试侧守卫）与三处文档陈述，不改任何产品代码、
不改排盘与解读行为、不改分发件内容（`test/` 与 `docs/` 均不进 zip）。

## Impact

- **源码**：仅 `test/lib/citation-guard.ts`（新增一个导出函数 + 抽一个共用的违例判定helper），
  `scripts/` 一行不动。
- **测试**：`test/citations.test.ts` 新增一组（构造树验 `.md` 纳入/排除 + 真扫描零违例），
  既有「非 `.ts` 不进 `scanCitations` 范围」一条的措辞随实现细化（它不是失效，是分工）。
- **文档**：`docs/code/README.md`（软纪律转硬）、`openspec/config.yaml`（引文纪律 context）、
  `test/README.md`（层 7 的覆盖面描述）。
- **分发**：零影响。

## 不做什么（Non-Goals）

- **不扫 `docs/manual/`**：生成导出的历史引文形态是 db 版本问题（重建即消），
  不是新写的未核实引文；处置与 `.ts` 侧一致，不开「修生成器」这个新战场。
- **不改 `ANNOTATIONS` 核对表本身**：本变更不加、不删、不改任何条目。
- **不把 `.md` 扫描塞进 `SchoolAdapter.citationRoots`**：那是流派适配器对**内核源码树**的
  声明面；仓库级文档不属于任何单一流派，硬塞进去会逼每个流派各自声明一份文档根。
- **不给 `docs/code/` 里的合法古籍引用开白名单**：守卫判据是「黑名单内的引文核心」，
  合法古籍引用本就不在黑名单里，无需豁免（实测 859 处形态命中中，黑名单外 782 处零误报）。
