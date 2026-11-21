# Design

## Context

违例实况（已核验）：6 处 `@/data/*` 全部指向 data 层——`algorithm.ts:20-21`（ganzhi / wuxing）、`mutagen.ts:17-18`（sihua / ganzhi）、`palace-relations.ts:10`（ganzhi）、`patterns/medium.ts:15`（ganzhi）。`TianjiBook` 联合类型已由生成物导出（`corpus/data/tianji.ts:15`）。`lookups.ts` 不回引 overview-material / palace-query，starBadge（纯格式化函数、零依赖）挪入不成环。

## Goals / Non-Goals

- Goals：内核 import 面与 AGENTS.md 措辞一致且机械化；消 analysis 类型级环；册名映射单点化并获穷尽性守卫。
- Non-Goals：不动 `@/` 解析钩子；不动生成器与生成物；不扩冻结契约；不给 lint 引新插件（no-restricted-imports 是核心规则）。

## Decisions

1. **eslint 规则面 = `scripts/*.ts` + `scripts/patterns/**/*.ts` + `scripts/data/**/*.ts`，禁 `@/*`。**
   与 AGENTS.md「内核」的定义域一致（根散件 + patterns + data）；`cli/` / 插件层 / test / tools
   是 `@/` 的合法消费者，不入规则面。`purple-star.ts` 的 `load<>("@/…")` 是函数参数字符串
   而非 import 语法，天然不在 no-restricted-imports 辖域（落地后跑 lint 实证零误伤）。
   备选「全仓统一禁 @/」否决：别名机制本身是本仓引导设计，禁全体等于否定机制。

2. **starBadge 挪 `lookups.ts` 而非留在原地拆引用。**
   消费方向 palace-query → overview-material 是逆向的（格式化件被 query 层引 material 层），
   挪到两侧共用的 lookups 一次消环；备选「palace-query 复制一份」否决——徽标拼式自述
   「全仓唯一」，复制即双源漂移。

3. **册名表单点化走类型穷尽性，不走运行时守卫。**
   `Record<TianjiBook, string>` 引生成物导出的联合类型：重导新增第 6 册时 typecheck
   当场红（缺键），比运行时断言更早、零测试项增量的机器执行。`sources/tianji.ts` 对
   **已类型化**查表的 `?? b` 兜底随类型化删除（穷尽后不可能 miss）；用户输入侧的
   `?? bookStr`（:44，任意字符串查册）保留——那是用户 typo 的语义回落，不是键域 miss。

4. **重构档验收：先取基线再动手，逐字节 diff=0。**
   基线样例取覆盖面最广的 `--report`（topics + patterns + 运限，恰好扫过 starBadge
   与补注路径）+ 一条 `--pattern --mutagen --decadal` 组合；改动后重跑逐字节比对，
   外加三件套兜底。

## 不可逾越的约束

- 冻结内核契约：导出形状零变化（import 写法不在契约面）。
- 生成物 `corpus/data/tianji.ts` 不手改；伴生模块 `tianji-books.ts` 是手写展示层事实。
- lint 规则只辖内核文件面；`cli/` / 插件层 / 引导层 / test / tools 的 `@/` 消费合法如旧。

## Risks / Trade-offs

- [内核文件未来新增子树（如新的内核目录）漏进 eslint 规则面] → 规则面在 eslint.config.mjs
  以显式 glob 声明；AGENTS.md 键域口径式的「内核」定义已在文档单点，新增子树时两处同行
  演进，漏改的下场是规则面窄于文档面（可由评审兜住），不会误伤合法消费。
- [TianjiBook 若未来从生成物撤掉导出] → tianji-books.ts 的 type 引用当场红，撤导出必须
  连伴生模块一起决策——单点化的反向依赖恰好把这类生成器改动拉回显式流程。

## Open Questions

（无）
