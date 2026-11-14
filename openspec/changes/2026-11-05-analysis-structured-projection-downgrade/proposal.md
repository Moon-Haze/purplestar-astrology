# analysis 一源双投影的第二投影降级：导出面收敛、平行元数据删除、spec 退役条款折回

## Why

「一源双投影」落地时（structure-analysis-outputs）有两个真实 adapter：文本渲染 + 断语手册
建库——是真 seam。断语手册随 `remove-manual-oracle`（12a3e4d）整体退役后，第二个 adapter
消失，按本仓自己的判据（**一个 adapter = 假想 seam**）它已退化，但全套成本还在：

1. **write-only 导出面**：10 个 `renderXxxItems` 公开导出全仓零调用（唯一 import 点是
   `analysis/index.ts:28-37` 的 9 个死 import——import 而从不调用；`renderOverviewItems`
   连 import 都没有）；实跑 `npx eslint scripts/analysis/index.ts` 全绿——风格闸门抓不到。
   views 内部 `renderXxx = formatItems(renderXxxItems(ctx))` 才是真消费：条目形态实为
   views 的**内部实现形态**，却以公开导出的姿态活在 interface 上。
2. **平行元数据只为 write-only 字段服务**：`overview-material.ts:44-47` 的 `modsMeta` /
   `gejuMeta` 平行数组（注释自证「供结构化条目携带」）+ `:119-141` 专门构建逻辑 +
   `views/overview.ts:43-47,57-64` 的唯一读者——写进无人读取的条目字段。
3. **spec 为已退役消费方立法**：`analysis-structured` spec 的「确定性标记与直出契约」与
   「建库端退役文本解析」两条 Requirement 强制「直出链 SHALL 只取纯命盘条目」「建库管线
   SHALL 消费结构化条目直接写库」——建库管线已在 12a3e4d 退役。下一个人按 spec 扩展是在
   为死需求工作。四处 docstring 锚点（`items.ts:9-15,53`、`index.ts:74-75`、
   `views/overview.ts:23`）指着已删除的东西。

本 change 是把 12a3e4d 开始的退役**做完**：模型本体（views 内部以条目组织渲染）保留，
公开导出面收敛到被真实消费的文本投影。

## What Changes

1. `scripts/analysis/views/*.ts`：10 个 `renderXxxItems` 去 `export`（降为模块私有函数，
   同文件 `renderXxx` 的内部调用不动）。
2. `scripts/analysis/index.ts`：删 9 个 `renderXxxItems` 死 import（`:28-37` 各行只留
   文本投影函数）；`:74-75` 注释同步（条目化是 views 内部实现形态）。
3. `scripts/analysis/overview-material.ts`：删 `modsMeta` / `gejuMeta` 平行数组与
   `:119-141` 构建逻辑；`views/overview.ts` 删对应写入点与 write-only 条目字段。
4. `scripts/analysis/items.ts`：docstring 锚点修正（「断语手册库 v2 数据源」「直出链」
   表述改为内部实现口径）；`clockDependent` 消费面核验——若零读取则连同写入点一并删除，
   若 views 内部有读则保留并如实记录。
5. spec 折回（`analysis-structured`）：
   - **MODIFIED**「一源双投影」：公开面 = 两种文本输出形态；条目形态 SHALL 为 views
     内部实现、SHALL NOT 作为公开导出面；「SHALL NOT 从成文反解结构」禁令保留；
     文本输出逐字节锚定保留。
   - **REMOVED**「确定性标记与直出契约」「建库端退役文本解析」「条目模型」：消费方
     （断语手册建库管线）已退役；「条目模型」的字段值域纪律随消费面消失而失去可验证
     场景，其仍然存活的反解禁令并入 MODIFIED 条款。Purpose 同步改写。
   - **不动**「双形态取材单点」（刚落地、有对拍断言、健康）。

## Capabilities

- **Modified Capabilities**：`analysis-structured`（导出面条款收窄 + 三条退役 Requirement
  折回 + Purpose 改写）。
- **New Capabilities**：无。

## 不做什么

- **不动 views 内部的条目组织**（`formatItems` / 条目构造器 / 节槽结构）——它是活的
  内部 seam，文本投影经它产出；本 change 只卸掉它的公开导出姿态。
- **不动「双形态取材单点」requirement 与其测试**——上一 change（single-source-report-
  material）刚落地，三盘对拍断言在，零摩擦证据。
- **不触碰排盘内核与 `test/kernel-contract.test.ts`**——`@/analysis` 不在冻结契约面；
  本 change 不新增内核导出。
- **不改任何文本输出**——验收即逐字节 diff=0。

## 验证义务

**纯重构档**：先取基线（`--topic` 全部主题输出 + `--report` 全量输出），改动后与基线
**逐字节 diff=0**；三件套（`npm run typecheck` + `node scripts/purple-star.ts selftest`
+ `ZIWEI_NO_CACHE=1 npm test`）全绿；npm test 分层项数与基线一致（内核层项数不得变动，
内容层不新增断言）。

## 被否决的备选方案

- **保留导出、spec 改写为「休眠扩展点」**：否决——休眠扩展点仍要求每个新 view 维护两个
  导出函数、`OverviewMaterial` 背平行元数据，成本现付、收益无限期递延；「等消费方回来
  再加导出」的成本是一行 `export`（接缝判据：加回导出 = 一个文件一处改动），而保留的
  成本是持续的 interface 谎言。
- **连条目模型一起删（views 改直产文本行）**：否决——那是搬走 views 的内部组织方式，
  deletion test 不过（复杂度不是消失而是重分布到 11 个渲染函数）；条目形态作为内部
  seam 仍在产出真实价值（节槽结构 + 可测试的构造器）。
- **spec 整体删除、存活条款迁往其他 spec**：否决——跨 spec 搬迁属结构性大动，与最小
  diff 纪律冲突；本 spec 收窄后仍是「analysis 输出契约」的正确归属地。
