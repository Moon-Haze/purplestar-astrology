# 三处零消费 pass-through：interface 面收敛到消费面

## Why

三处死在**导出/interface 面**——tsconfig 无 `noUnusedLocals` 只拦局部量，re-export 与
interface 字段连这道闸都不经过，typecheck 永绿：

1. `cli/birth/birth-info.ts:588-593`：拆分时的兼容 re-export（`BirthInfoResult` /
   `LongitudeHit` / `TrueSolarOptions` / `TrueSolarResult` 四型，注释称「调用方一行不用
   改」）——全仓 grep：四个名字在 birth-info 两文件外**零出现**。兼容面建了没兼容对象
   （拆分时调用方已同步改道），是上一轮「单点建了没接线」的镜像。
2. `cli/args/scope.ts:38-39`：`OptionScope.descOverrides` 接口字段——`OPTION_SCOPE`
   不设、`parse.ts` 不读、全仓零引用。为一维「将来可能」预留的 interface 面，违反
   「每个新抽象必须答得出删掉它会多写几行」。
3. `knowledge/sources/tianji.ts:35`：`query.term ?? query.positional.join(" ") ?? ""`
   ——`positional: string[]` 非可选，`join` 永不返回 undefined，尾 `?? ""` 恒死。

deletion test：三项全部「复杂度湮灭」（零 caller、零断言、零行为变化）。

## What Changes

1. `cli/birth/birth-info.ts`：删 `:588-593` 兼容 re-export 块及其注释（四个类型仍从
   `./birth-info-defs` 正常导出，直接消费者不受影响）。
2. `cli/args/scope.ts`：删 `descOverrides` 字段及其 doc 注释，`OptionScope` 回到
   「四条规则的形状」。
3. `knowledge/sources/tianji.ts:35`：删尾 `?? ""`。

## Capabilities

- **New / Modified Capabilities**：无。三处均为实现内部 interface 面，不触及任何
  spec requirement（knowledge-retrieval 的 KnowledgeQuery 条款管的是查询字段面，
  与 tianji 源内部的空值收窄无关）→ `skip_specs`。

## 不做什么

- **不开启 `noUnusedLocals`**——那是编译器纪律变更，牵动全仓存量，与本 change 的
  三处定点清理无关；若要开，走独立 change 评估存量清理面。
- **不动 `birth-info-defs.ts` 的类型导出**——四型的权威导出点不动，只删转发壳。

## 验证义务

**纯重构档**：`npm run typecheck` + `npx eslint`（三个 touched 文件）+ 三件套全绿且
分层项数与基线一致；行为零变化——`tianji` 域检索输出与基线逐字节 diff=0，astrology /
synastry 面不受影响。

## 被否决的备选方案

- **给 re-export 补消费者**：否决——兼容面等不来兼容对象；「等调用方出现再加导出」
  成本是一行，与候选 3 同判据。
- **`descOverrides` 保留为文档化扩展点**：否决——interface 字段的成本是每个读
  `OptionScope` 的人都要理解一条不存在的规则；真需要时再加（届时它会有消费方与
  测试）。
