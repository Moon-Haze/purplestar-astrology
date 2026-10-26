# Proposal

## Why

三个 report 质量 change（refine-report-dedup-citations / structure-content-branches / dynamic-topic-suggestions）落地后的回归实测（`/tmp/regress-report.md`，2000-04-06 盘）暴露 4 项残余缺陷：①条件分支拆走后 `common` 尾分号残留（L372「兄弟宫同理；」、L421「朝令夕改；」、L523「最好的发挥；」，迁移只剥了拆走段的分号）；②双主星的全文首现漂移——主场板块核心论断只展开第一主星，第二主星（天相/天府/巨门/太阴）全文被其他板块的三方联动抢走首现，指引指回非语义主场板块（天相指「财富运势」、巨门指「健康状况」）；③性格特质板块核心论断与「性格深描」小节逐字重复、总览注入（mods+格局行）与命格总览板块逐字重复，约 900 字纯冗余；④四化注句未纳入去重——「化权，掌财有道……」在 5 个板块重复、天同化忌注在 4 个板块重复。

## What Changes

- **尾分号清洗**：已迁移 `BranchedContent` 条目的 `common` 尾部孤立分号清洗为句号（存量数据修正）；`selectBranches` 投影层对分支条目的 common 段尾分号做兜底清洗（增量防线，未迁移条目不受影响）。
- **双主星主场展开**：`buildOverviewMaterial` 增产第二主星的同宫语境全文；核心论断节的「同宫第二主星」从一句简述升级为简述 + 全文（该星无对应语境数据时维持简述）；装配层预扫描同时登记第二主星文本，使其主场板块 = 本板块，三方联动的指引指回正确板块。`--topic` 单主题总论同步获得第二主星全文（内容增强，非去重）。
- **性格板块去重**：`getTopicReport` 的 personality 板块不再渲染「性格深描」小节（其内容与核心论断逐字同源），也不再注入 mods 与格局行（与命格总览板块逐字重复）。`getTopicReport` 仅服务 `--report`，`--topic` 终端路径（`getTopicAnalysis`）行为不变——两端形态差异在 design 记录理由。
- **四化注首现**：`renderMutagen` 接入既有去重表——注句（`getMutagenNote` 语义注）首现板块全文，复现板块只保留落点行（🔵 星化X（落宫））；落点行恒出，不隐藏四化事实。
- **不做什么**：不修四化注的语境错位（健康板块出「感情多波折」，属 `topic_mods` 主题视角切换，另项）；不动 34 条豁免条目的全枚举（人工改写语料违反逐字保留底线，需单独立项）；不动引文宫位错位、建议信号集、大限节增强、双主星经典出处、总览格局 3/6 问题（评估清单 #5–#11，后续 change）；不动 13 板块结构、文档头、尾注；不动排盘内核。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `report-assembly`: 新增三条装配行为——双主星主场展开（第二主星全文在本板块核心论断出现，指引指回主场）、四化注首现原则（注句全报告一次，落点行恒出）、板块总览唯一（personality 板块不重复 overview 板块的总览注入与深描内容）。
- `interpretation-content`: 新增结构化投影的句读完整性要求——已迁移条目的投影输出不得以孤立分号收尾。

## Impact

- **代码**：`scripts/analysis/overview-material.ts`（secondStarContent）、`scripts/analysis/report.ts`（getTopicReport 的 personality 去重 + 预扫描第二主星 + renderMutagen 传 dedupe）、`scripts/analysis/views/mutagen.ts`（renderMutagen 可选 dedupe）、`scripts/analysis/lookups.ts`（selectBranches 分号兜底）、`scripts/analysis/data.ts`（存量 common 分号清洗）。
- **输出行为**：`--report` 的四项缺陷消失；`--topic` 的总论第二主星从一句简述升级为简述+全文（内容增强），其余单主题行为零变化。
- **测试**：`astrology-sections.test.ts` 的报告装配断言组与 `topic-suggestions.test.ts` 的两端同源断言需同步（第二主星全文改变「- - -」……具体为 personality 板块小节流与指引指向断言）；新增分号残留、指引落空、注首现三类断言。
- **验证义务**：内容与装配层改动，不触排盘内核——`npm run typecheck` + `selftest` 必跑 + `npm test`（报告相关断言被牵动）；改动前先取 `--report` 与 `--topic personality` 基线供对拍。
