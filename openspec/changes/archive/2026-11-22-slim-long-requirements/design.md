# Design

## Context

两条超长 requirement 同一成因：归档折回时把本该住在场景里的边界细节写进了描述
（polish-prose-with-humanizer 的留档事项）。validate 对超长描述的修复建议即
「Move examples and edge cases into scenarios, or split」——本变更选前一条路，理由见 D1。

## Goals / Non-Goals

**Goals:** 描述回到「义务 + 覆盖面」陈述，边界细节由既有场景承载；`validate --all` 零警告。

**Non-Goals:** 不改场景语义、不拆 requirement、不动守卫实现与 validate 阈值。

## Decisions

**D1 挪进场景而非拆分。** 被删文本在场景 THEN 中逐字可寻（extensibility：守卫红形态 ↔
「断言组豁免边界」、「内核只暴露纯函数」↔「插件反向依赖」；quality-gates：稀疏豁免 ↔
「格局补注键漂移」、空退化 ↔「断言空退化」、可选链缩水 ↔「全域表缺宫」），删除不丢事实。
拆分的代价：豁免 carve-out 与分层规则分家，读者两处拼口径；MODIFIED 块不得丢场景，迁移
场景须 ADDED 承接，结构收益为零。删「内核只暴露纯函数供插件消费」另有一条依据：它是
「禁止反向依赖」的正面表述，姊妹 requirement「插件引用而非迁移」与场景共同承载同一原则。

**D2 描述保留的底线：SHALL 义务与覆盖面清单逐条保留。** 裁剪只删「结果形态复述」与
场景已承载的禁令展开；域清单（五张宫名键表 / 两张主星键表 / 补注双键 / 全域表完备性）与
豁免白名单枚举原样——它们是规范本体，场景只举形态不列清单。

## Risks / Trade-offs

- [裁剪误伤规范性内容] → 判据写死：SHALL / SHALL NOT 句逐条对照，只删场景已覆盖的形态
  枚举；场景块经脚本比对与主 spec 逐字节一致
- [压缩后语义走样] → 两处白名单 / 域清单逐字保留；折回后通读对照主 spec 复核

## 不可逾越的约束

- 冻结语义：SHALL 义务集合、场景集合、判定形态（断言 / 反向注入）不变
- 本变更文本不含引语，不触引文纪律
