# docs/code/ —— 源码注释的搬迁目的地

本目录是 `scripts/` 源码里**长注释**的家：模块头论文（为什么存在、历史包袱、与其他模块的契约）
与 ⚠️ 防呆警告（哪里不能改、改了会怎么静默出错）。它们原先贴在签名之间，让「读实现」变成
「在注释里淘金」；现在搬到这里，**原文照搬、一条不丢**，代码里只留一行摘要 + ⚠️ 结论 + 指路牌。

搬迁的动机、分类判据与分批顺序见
`openspec/changes/move-code-comments-to-docs/`（proposal / design / tasks）。

## 注释四分类（判据：消费者的可达场景）

| 类  | 是什么                                          | 处置           | 为什么                                                        |
| --- | ----------------------------------------------- | -------------- | ------------------------------------------------------------- |
| A   | TSDoc 契约（`@param` / `@returns` / `@throws`） | **留在源码**   | 消费者是 IDE 悬停里的**调用方**，写调用代码时才需要，必须就地 |
| B   | 模块头论文（`@packageDocumentation` 长文）      | **搬到本目录** | 消费者是**要改这个模块的人**，`docs/` 可达且更适合整篇读      |
| C   | ⚠️ 防呆警告（「不要改这里」）                   | **搬到本目录** | 同上；源码留 ⚠️ 结论一行 + 指路牌                             |
| D   | 口径锁（解释不直观算式 / 显式配置的一行注释）   | **留在源码**   | 「防将来人删掉显式配置」的钓鱼线，一行成本，留                |

**本目录只收 B / C**，且是**搬运不是改写**——「文档一份、注释一份」的措辞分叉从起点就不允许发生。

## 导航表（15 篇）

| 篇                                 | 覆盖的源码                                                                                         | 单元                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| [README.md](README.md)             | 本篇：导航 + 维护纪律 + 引文软纪律                                                                 | 目录入口               |
| [boot-layer.md](boot-layer.md)     | `scripts/purple-star.ts` · `scripts/boot-hooks.ts`                                                 | 引导层                 |
| [chart-kernel.md](chart-kernel.md) | `scripts/types.ts` · `algorithm.ts` · `palace-relations.ts` · `mutagen.ts` · `wenmo-brightness.ts` | 排盘内核               |
| [patterns.md](patterns.md)         | `scripts/patterns/`                                                                                | 格局层                 |
| [analysis.md](analysis.md)         | `scripts/analysis/`                                                                                | 论断库                 |
| [data-tables.md](data-tables.md)   | `scripts/data/`                                                                                    | 数据表                 |
| [corpus.md](corpus.md)             | `scripts/corpus/`                                                                                  | 古籍语料               |
| [knowledge.md](knowledge.md)       | `scripts/knowledge/`                                                                               | 知识源扩展点           |
| [school.md](school.md)             | `scripts/school/`                                                                                  | 流派适配器             |
| [synastry.md](synastry.md)         | `scripts/synastry/`                                                                                | 合盘内核               |
| [cli-args.md](cli-args.md)         | `scripts/cli/args/`                                                                                | CLI 参数面             |
| [cli-birth.md](cli-birth.md)       | `scripts/cli/birth/`                                                                               | CLI 出生信息           |
| [cli-chart.md](cli-chart.md)       | `scripts/cli/chart/` · `scripts/cli/host/`                                                         | CLI 命盘产物与宿主装配 |
| [cli-commands.md](cli-commands.md) | `scripts/cli/commands/` · `cli/fortune/` · `cli/knowledge/`                                        | CLI 命令层             |
| [cli-selftest.md](cli-selftest.md) | `scripts/cli/selftest/`                                                                            | CLI 回归自检           |

篇名 = 单元名，改到哪个目录就打开哪一篇。未在上表出现的源码文件，说明它没有 B/C 长注释
（或密度未到搬迁线），其注释原地保留。

## 维护纪律

1. **改模块设计先改文档。** 动了模块的存在理由、对外契约、口径、踩坑点，先改本目录对应篇，
   再动代码——反过来做，文档会从落成那天起就开始漂移。
2. **指路牌不得退化。** 源码里被搬空的位置必须保留「一行摘要 + ⚠️ 结论 + `docs/code/<篇>.md`」；
   删掉指路牌等于把防呆降级成「靠读者自觉」。
3. **搬运不是改写。** 已有条目只允许整段移动与订正事实错误，不允许顺手润色——两个副本的
   措辞一旦分叉，就再没人知道哪份算数。
4. **路径写仓库根相对口径**（`docs/code/chart-kernel.md`），与 `CLAUDE.md` 一致；不写 `../../`
   这种随目录层级变动就失效的相对路径。

## 倪师引文纪律（已硬化）

搬进本目录的倪师引文（「倪师 / 倪海厦 + 引号句」形态）**与源码同受 `ANNOTATIONS` 核对表约束**：
出现该形态必须在 `analysis/grades.ts` 登记档位，**占位或自撰内容绝不可挂倪师引语**（属伪造引文）。

这条纪律**有机器在看**：引文守卫（`test/lib/citation-guard.ts`）除 `.ts` 外也收 `.md`
（`scanMarkdownCitations`，按仓库根扫全部手写文档，`SKILL.md` / `references/` / 本目录 /
`README.md` 等一并纳入），往任何 `.md` 里写一句未核实引文挂到倪师名下，`npm test` 立刻红。

排除只有一处：`docs/manual/`（`export-manual.ts` 的生成导出）—— 源头 `analysis/data.ts`
本就在 `.ts` 扫描范围内，镜像的历史引文形态是 db 版本问题、重建即消。
判据是**黑名单制**（只拦 suspect / fabricated 的引文核心），合法古籍引用不受影响。

## 与分发的关系

`docs/` 整个目录**不进分发件**（zip 只含 `SKILL.md` / `package.json` / `references/` / `scripts/`），
所以本目录是纯仓库协作者向：skill 宿主在 `~/.claude/skills/` 内读 `scripts/` 时看不到它。
这可接受——宿主的规范来源是 `SKILL.md` + `references/`，源码注释从来不是它的契约面。
