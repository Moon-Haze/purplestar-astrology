# 注释锚点成批腐烂批改 + 注释指针有效性守卫

## Why

四波改名各留了一批不解析的注释指针，其中一处是**用户可见的产品输出**：

| 波次 | 残留 | 实据 |
| --- | --- | --- |
| CLAUDE.md→AGENTS.md 改名 | `CLAUDE.md` 引用 ×12（11 个文件：`purple-star.ts:85,98` / `algorithm.ts:243` / `cli/selftest/args.ts:261` / `commands/fortune.ts:9` / `synastry-knowledge.ts:22` / `data/sihua.ts:16` / `test/repo.test.ts:24` / `test/lib/loader.ts:81` / `test/lib/citation-guard.ts` / `test/cli.test.ts:34` / `tools/review-gate.ts:580`） | 文件已不存在 |
| ziwei/ 拆平（2026-10-12） | **help.ts:179-180**——总览 help 的 DESCRIPTION 输出「内核住 scripts/ziwei\|corpus\|synastry/」，引读者找不存在的目录；该行进每次 `help` 的 stdout | 用户可见 |
| commands/ 重组 + parseLiuNianArg 迁移 | `fortune/primitives.ts:58`（指已改名搬走的 `parseLiuNianArg`）、`fortune/mutagen.ts:16`（指旧路径 `cli/astrology.ts`）、`commands/index.ts:4`（称有 cmdFortune——实为 re-export 壳） | 指针失效 |
| selectGender 结构化投影（779b161） | **行为契约写反**：`analysis/report.ts:5` 与 `analysis/index.ts:60-62` 仍把「最后整篇过性别过滤」描述为现行行为，实态是「性别已在各 view 经 selectGender 投影」（`index.ts:89`）——读码者会得出「改 view 时性别处理可以不管」的**反向指导** | 契约级 |
| 建库消费方退役（12a3e4d） | `corpus/citation-core.ts:6-9` 的 module 放置辩护词（「建库时共用同一判据」）指向已删消费方，动摇「为什么在 corpus/ 不在 test/lib」的判断 | 放置理由失效 |

摩擦本质：本仓评审文化依赖「注释可当真」；锚点成批腐烂让指路失效、行为契约反向指导。
且这是**复发性**失效模式——四波改名四次留尸，现有闸门（typecheck / selftest / npm test /
lint）全部查不到。

## What Changes

1. **纯文案批改（零逻辑）**：上表五组逐处修正——CLAUDE.md 引用改 AGENTS.md（逐处语义
   核对，不机械替换）；help DESCRIPTION 改实际布局（scripts/ 根排盘模块 + corpus|synastry|
   knowledge/ 知识内容）；性别过滤契约两处改为「已在各 view 经 selectGender 投影」并同步
   `docs/code/analysis.md`；citation-core 放置理由改为现状陈述（唯一现行消费者是测试侧，
   建库消费方已退役，直出链回归时须共引）；三个改名残留跟新。
2. **轻守卫**：`test/repo.test.ts` 新增「注释指针有效性」扫描——`scripts/` `test/` `tools/`
   源码注释中出现的 `*.md` 引用词元（根级文件名与 docs/ references/ 相对路径）SHALL 在
   仓库内实际存在；误报白名单显式登记且带理由（跳过必须看得见）。
3. spec：quality-gates 新增「注释指针有效性守卫」requirement（守卫清单登记 + 可验证
   scenario）。

## Capabilities

- **Modified Capabilities**：`quality-gates`（ADDED requirement：注释指针有效性守卫——
  属验证纪律，须提案）。
- **New Capabilities**：无。注释批改本体不触及任何 spec（code-style spec 自我声明
  「不管注释的技术正确性」）。

## 不做什么

- **不新增注释内容审查机制**——守卫只查指针对象**存在性**，不查注释说了什么对不对
  （那是 review 的事，与 code-style spec 的分工一致）。
- **不批改「候选 N 编号撞车」类历史注记**——Speculative 观察（记录不动），不纳入本 change。
- **不动 help 的其余文案**——只改 DESCRIPTION 的内核布局行；候选 1 已管 knowledge 面。

## 验证义务

**纯重构档 + 测试面 +1**：先记录 `npm test` 与 `selftest` 项数基线；批改后三件套全绿；
`npm test` repo 层项数 = 基线 + 1（新守卫）。**预期输出变化**：`help` 总览 DESCRIPTION
一行（ziwei 路径改为实际布局），其余输出逐字节不变。

## 被否决的备选方案

- **守卫扫全部注释引用（含函数名 / 文件路径 .ts）**：否决——.ts 路径引用的失效由
  typecheck 与 grep 纪律覆盖成本低；全量符号引用解析是个大机制，为一类已证实的失效
  （.md 指针）引入全量解析不成比例。只扫 `.md`。
- **把守卫放进 code-style spec**：否决——code-style spec 明文「只管放置与篇幅，不管
  技术正确性」；指针有效性是仓库一致性守卫，归属 quality-gates 守卫清单。
- **不做守卫、只批改存量**：否决——四波改名四次留尸证明这是复发性失效；quality-gates
  的准入判据（守机器查不到的东西）恰好满足。若评审认为断言密度已过高，本 change 可
  降级为纯批改（砍任务 3），spec delta 随之撤销——该决定在 apply 前由用户确认。
