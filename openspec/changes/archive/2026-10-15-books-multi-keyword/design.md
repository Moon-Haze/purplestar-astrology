# Design: books 多关键词 AND 检索

## Context

`searchClassics`（`scripts/corpus/index.ts:102`）是 books 域唯一检索入口，
三重遍历（书 → 章节 → 段落）里对每段做 `p.text.indexOf(q)`，整串不中即跳过。
调用方两处：`scripts/knowledge/sources/books.ts`（CLI）与
`scripts/corpus/selftest-asserts.ts`（selftest 古籍段）。无其他消费者。

## Goals / Non-Goals

- Goals：空白分词 + 段内全命中（AND）；单关键词路径零变化；snippet 仍恰含一个
  `<mark>` 高亮块（selftest 断言盯此形态）。
- Non-Goals：不改遍历顺序与 limit 语义；不引入 OR / 否定 / 短语语法；不动其他三域；
  不做性能优化（语料量级为百段级，分词后每段多次 `indexOf` 无感）。

## Decisions

### 分词与匹配

- `q.trim().split(/\s+/)` 得关键词数组；数组长度 ≤ 1 时**原路径直走**，
  保证单关键词逐字不变。
- 多关键词时对每段先取**最早命中位置**（各词 `indexOf` 取最小非负值），
  任一词 `indexOf < 0` 即整段跳过；命中段的 snippet 以该最早位置为锚，
  前后各 40 字，`<mark>` 只包住锚点词——保持「摘要里恰一个高亮块」的既有形态。
- 空串 / 纯空白在 trim + filter 后为空数组，沿用「零命中」路径
  （selftest 已有断言盯空串与纯空白）。

### 复用而非新写

锚点计算与 snippet 拼装抽成循环内的同一段逻辑（单/多词共用），不复制两份
拼装代码——副本会漂移（ADR-004 同理，只是这次在函数内）。

## Risks / Trade-offs

- 「含空白检索词」行为变化（整串 → 分词 AND）：该形态此前无合法用法依赖
  （样例表与文档均无含空白 --search 的用法），风险可忽略。
- `<mark>` 只高亮一个词：多词命中时其余词不高亮。保持单高亮块是为不破坏
  selftest 对 snippet 形态的断言与渲染端假设；全词高亮属增强，留待有真实诉求再说。

## Migration Plan

单次提交落地，无渐进切换。`docs/cli-samples.md` 由样例表再生。
