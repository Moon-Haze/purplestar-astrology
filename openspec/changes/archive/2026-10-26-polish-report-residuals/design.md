# Design

## Context

实测样本（2000-04-06 盘 `/tmp/regress-report.md`）的四处残余，按层归属：①分号残留是 `structure-content-branches` 迁移瑕疵——`strip_tail` 只剥拆走段的分号，留下的 `common` 尾分号无人清洗（`selectBranches` 的补句号逻辑把「；」当已完整句读）；②双主星漂移是 `buildOverviewMaterial` 只产第一主星的 `content`，第二主星全文只能靠别处三方联动首现，登记到错误板块（天相→财富运势、巨门→健康状况、太阴→人际贵人）；③性格板块双渲染是 `getTopicReport` 对 personality 主题渲染核心论断（m.content 即 personality 键值）后又渲染 `renderPersonality` 同值小节，且 mods/geju 注入与命格总览板块逐字相同（`isCoreTopic` 含 personality）；④四化注重复是去重体系只接了 `renderSanFang` 的 fullContent，`renderMutagen` 的 `getMutagenNote` 注不在键空间。

关键事实：`getTopicReport` 仅服务 `--report`（`--topic` 终端路径走 `getTopicAnalysis` + `renderXxx` views）——③的修复可做成 `getTopicReport` 的内在逻辑，零 option、零 `--topic` 影响；②的 `secondStarContent` 产在 material 单点，两个编排器自然同享。

## Goals / Non-Goals

**Goals:**

- 四处残余清零：分号 0 残留、指引 0 落空（含第二主星）、性格板块 0 逐字重复、四化注全报告 1 次。
- `--topic` 单主题行为除第二主星增强外零变化。

**Non-Goals:**

- 四化注语境错位（`topic_mods` 主题视角切换）、豁免条目全枚举、引文宫位错位、建议格局信号、大限节增强、双主星经典出处、总览格局 3/6——评估清单 #5–#11 另项。
- `--topic` 终端路径的性格双渲染（见 D3 备选留档）。
- 排盘内核、13 板块结构、文档头、尾注。

## 不可逾越的约束

- **逐字保留**：分号清洗只作用于**已迁移条目**（`BranchedContent`）的投影路径；豁免清单与纯散文条目逐字不动（spec interpretation-content 场景钉住）。
- **分层红线**：改动全部在 `analysis/` 投影与装配层；去重状态仍由 `buildReport` 持有经 `ReportOptions` 正向递入。
- **引文纪律**：无新增「倪师 + 引号句」形态。
- **轻路径**：不新增重语料加载点。

## Decisions

### D1 分号清洗：数据修正为主、投影兜底为防

存量：扫描全部已迁移条目，`common` 尾部孤立分号清洗为句号（数据脚本 + diff 审查，量小可手工）。增量防线：`selectBranches` 对分支条目的 common 投影结果做尾部「；→。」清洗，防未来新增条目再犯。

- **备选 a**：只改投影不动数据——**否决**：数据持续脏，任何绕过投影的直接消费（如未来的 JSON 面）会复现。
- **备选 b**：只改数据不加防线——**否决**：迁移脚本的教训就是「靠人记得」必失守，防线一行。
- **两面**：收益——存量净、增量防、两层各自可断言；代价——清洗逻辑存在两处（一处数据一次性、一处代码常驻），需在注释互指。

### D2 双主星主场：material 产 `secondStarContent`，预扫描同登记

`buildOverviewMaterial` 增产第二主星在**同一 contentKey** 下自己的 profile 全文（无数据时 `undefined`，维持现状简述）；核心论断节的第二主星行升级为「简述行 + 全文」；`getTopicMainContentText` 预扫描同时登记第二主星文本（键值同文、板块 = 本板块）——三方联动指引自然指回主场。`renderOverview`（`--topic` 总论）同享该字段，第二主星从一句简述升级为简述+全文（内容增强，spec 已声明）。

- **备选 a**：只改预扫描登记、不展开第二主星全文——**否决**：登记的板块必须真实含全文，否则指引「指对了板块却找不到内容」，比指错更糟。
- **备选 b**：报告成品后处理重排——**否决**：正则手术丢失结构信息（与上一 change D1 备选 b 同理）。
- **两面**：收益——首现语义正确、指引 0 落空、`--topic` 免费受益；代价——报告体量小幅回升（第二主星全文进主场板块，但各省去它们在错误板块的首现与复现，净变化待实测）、`deletion test` 通过（删掉这层，第二主星的归属判断就散回各 view）。

### D3 性格板块去重：`getTopicReport` 内在逻辑，不动 `--topic`

`getTopicReport` 对 personality 主题：跳过 mods/geju 注入与「性格深描」小节。因其只服务 `--report`，无需新增 option；`--topic` 终端路径（`getTopicAnalysis` 的总论 + 「五、性格专属补充」双渲染同病）**登记为已知问题留待后续**——动它牵连 `getTopicAnalysis` 编排节序、views 注释与 topic-study 测试面，与本 change「报告残余」范围不同轴。

- **备选 a**：两端一起修——**否决**：`--topic` 的节结构是「总-分」既有版式，改它超出报告装配域且测试面扩散；同病不同治在 spec 场景里显式声明（终端路径保留）。
- **备选 b**：数据层给深描独立素材——**否决**：无新素材来源，编造违反语料纪律。
- **两面**：收益——报告内 ~900 字冗余清零、零 option、`--topic` 零风险；代价——两场景性格形态分叉（报告版精简、终端版重复），已登记为已知问题。

### D4 四化注首现：`renderMutagen` 接入既有 dedupe

`renderMutagen(ctx, dedupe?)`——注句文本入既有去重表（与 fullContent 同一 Map，键空间不碰撞：全枚举段 vs 一句注）；首现给注、复现只出落点行；落点行恒出。`getTopicReport` 传 `options.dedupe`；`getTopicAnalysis` 路径缺省不变。

- **备选 a**：复现处整条省略——**否决**：落点行是「哪颗星化什么落哪宫」的事实层，隐藏它会让板块的四化信息不完整。
- **备选 b**：复现处给指引行（详见某板块）——**否决**：注只有一句，指引行的引导成本高于内容本身，直接省略更干净。
- **两面**：收益——化权注 5→1、化忌注 4→1，四化事实仍每板块可见；代价——复现板块的四化节从两行变一行（信息密度提升，非缺失）。

## Risks / Trade-offs

- [第二主星展开使报告体量回升] → 净变化实测确认（预期小幅，因错误板块的首现与复现同步消失）；体量不是本 change 目标，语义正确优先。
- [指引落空断言需覆盖第二主星] → 既有「全文首现」断言扩用例（天相/巨门两盘星），tasks 列明。
- [数据清洗误伤未迁移条目] → 清洗脚本只匹配已迁移形态（`common:` 键内的尾分号），改前取基线、改后逐块核对 diff；未迁移条目逐字不变有断言。
- [--topic 第二主星增强波及 cli-samples] → 重导 + diff 逐块核对仅第二主星段变化。

## Migration Plan

一次性切换：基线 → 数据清洗 → 投影与装配层 → 断言同步 → 生成物重导 → 全量验证。回滚 = revert 单 commit。

## Open Questions

（无——落点、键形态、范围边界均已裁决；第二主星无语境数据的降级维持现状简述，无需新决策。）
